const socket = require('socket.io')
const temp = require('mongodb')
const ObjectId = temp.ObjectId
// import { ObjectId } from 'mongodb'
const request = require('request');

const client_id = '85ec7eb9dc0543fc9408c8ba05fd2bdb';
const client_secret = 'c9192d5af4bb450da0770bf5b23f4e49';

async function getNewToken(refreshToken) {
	const authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		headers: { Authorization: `Basic ${new Buffer(`${client_id}:${client_secret}`).toString('base64')}` },
		form: {
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		},
		json: true
	};

	return new Promise((resolve) => {
		request.post(authOptions, (error, response, body) => {
			console.log(body)
			if (!error && response.statusCode === 200) {
				const { access_token } = body
				resolve(access_token)
			}
		});
	})
}

module.exports.socket = (server, db) => {
	const io = socket(server)

	io.on('connection', (socket) => {
		console.log(`Socket Connection Established with ID: ${socket.id}`)

		// Room events

		socket.on('addRoom', async (room) => {
			room.queue = []
			room.currentSong = {
				songName: 'no current song',
				artistName: 'no current song',
				uri: '',
				coverArt: ''
			}
			room.audienceSize = 0

			db.development.collection('rooms').updateOne(
				{
					roomName: room.roomName,
					roomType: room.roomType,
					hostName: room.hostName
				},
				{
					$set: {
						audienceSize: room.audienceSize,
						password: room.password,
						downVoteLimit: room.downVoteLimit,
						queue: room.queue,
						currentSong: room.currentSong,
						accessToken: room.accessToken,
						refreshToken: room.refreshToken
					}
				},
				{
					upsert: true
				},
				(err, result) => {
					room._id = result.upsertedId._id
					io.emit('addRoom', room)
					if (err) {
						console.log(err)
					} else {
						console.log(room._id)
						socket.emit('setHostId', room)
					}
				}
			)
		})

		socket.on('join', (roomId) => {
			console.log(`CONNECTION: socket ${socket.id} joined room ${roomId}`)
			socket.join(`${roomId}`)
			io.in(roomId).emit('changeAudienceSize', { dir: 'inc', roomId })
		})

		socket.on('leave', (roomId) => {
			console.log(`DISCONNECTION: socket ${socket.id} left room ${roomId}`)
			socket.leave(`${roomId}`)
		})

		socket.on('closeRoom', (params) => {

			db.development.collection('rooms').deleteOne({ _id: ObjectId(params.roomId) },
				(err, result) => {
					if (err) {
						console.log(err)
					} else {
						// console.log(result)
					}
				})

			io.emit('closeRoom', params)
		})

		socket.on('getDevices', (params) => {
			const { token } = params

			const options = {
				url: 'https://api.spotify.com/v1/me/player/devices',
				headers: { Authorization: `Bearer ${token}` },
				json: true
			};

			request.get(options, (error, response, body) => {
				socket.emit('getDevices', body.devices)
			});

		})

		// Queue events
		// todo find where the db queue is being sorted
		socket.on('addSongToQueue', async (song) => {
			console.log('add song to queue')
			song.rank = 0
			const { roomId } = song

			delete song.roomId

			db.development.collection('rooms').updateOne(
				{ _id: ObjectId(roomId) },
				{ $push: { queue: song } },
				{
					upsert: true
				},
				(err) => {
					if (err) {
						console.log(err)
					} else {
						// console.log(result)
					}
				}
			)

			io.in(roomId).emit('addSongToQueue', song)
		})

		socket.on('removeQueueItem', async (params) => {
			db.development
				.collection('rooms')
				.updateOne(
					{ _id: ObjectId(params.roomId) },
					{ $pull: { queue: { songId: params.songId } } },
					(err) => {
						if (err) {
							console.log(err)
						} else {
							// console.log(result)
						}
					}
				)

			io.in(params.roomId).emit('removeQueueItem', params)
		})

		socket.on('songSearch', (params) => {

			const { accessToken } = params
			const { refreshToken } = params
			const { songName } = params


			const options = {
				url: 'https://api.spotify.com/v1/search',
				headers: { Authorization: `Bearer ${accessToken}` },
				qs: {
					q: `track:${songName}`,
					type: 'track',
				},
				json: true,
			};

			request.get(options, async (error, response, body) => {
				// updates token, retries request, and sends new token back
				if (body && body.error && body.error.message === 'Invalid access token') {
					console.log('error with access token, attempting to refresh token')
					const newAccessToken = await getNewToken(refreshToken)
					console.log(`New access token: ${newAccessToken}`)

					const newOptions = {
						url: 'https://api.spotify.com/v1/search',
						headers: { Authorization: `Bearer ${newAccessToken}` },
						qs: {
							q: `track:${songName}`,
							type: 'track',
						},
						json: true,
					};

					request.get(newOptions, async (error, response, body) => {
						socket.emit('songSearchResults', body)
					})

					db.development
						.collection('rooms')
						.updateOne(
							{ _id: ObjectId(params.roomId) },
							{ $set: { accessToken: newAccessToken } },
							// eslint-disable-next-line no-unused-vars
							(err, result) => {
								if (err) {
									console.log(err)
								} else {
									// console.log(result)
								}
							}
						)

					io.in(params.roomId).emit('updateToken', newAccessToken)

				} else {
					socket.emit('songSearchResults', body)
				}

			})
		})

		socket.on('changeSongRank', async (params) => {
			const id = params.song.songId
			const { direction } = params
			console.log(params)

			if (direction === 'inc') {
				db.development
					.collection('rooms')
					.updateOne(
						{ _id: ObjectId(params.roomId), 'queue.songId': id },
						{ $inc: { 'queue.$.rank': 1 } },
						(err, result) => {
							if (err) {
								console.log(err)
							} else {
								// console.log(result)
							}
						}
					)
			} else if (direction === 'dec') {
				db.development
					.collection('rooms')
					.updateOne(
						{ _id: ObjectId(params.roomId), 'queue.songId': id },
						{ $inc: { 'queue.$.rank': -1 } },
						(err, result) => {
							if (err) {
								console.log(err)
							} else {
								// console.log(result)
							}
						}
					)
			}

			db.development
				.collection('rooms')
				.update(
					{ _id: ObjectId(params.roomId) },
					{ $push: { queue: { $each: [], $sort: { rank: -1 } } } },
					(err, result) => {
						if (err) {
							console.log(err)
						} else {
							// console.log(result)
						}
					}
				)

			io.in(params.roomId).emit('changeSongRank', params)
		})

		// Player Events

		socket.poll = (token) => {
			const access_token = token

			const options = {
				url: 'https://api.spotify.com/v1/me/player',
				headers: { Authorization: `Bearer ${access_token}` },
				json: true
			}

			// todo ill have to put a check for the expired access token here eventually
			request.get(options, (error, response, body) => {
				if (body && body.is_playing) {
					// console.log(`playing at ${body.progress_ms} ms`)
					setTimeout(() => {
						socket.poll(token)
					}, 1000)
				} else if (body && body.progress_ms === 0) {
					console.log('music stopped')
					socket.emit('musicStop')
				} else {
					console.log('music paused')
					socket.emit('musicPause')
				}
			})
		}

		socket.on('playSong', async (params) => {
			if (params.song) {
				const access_token = params.token
				const options = {
					url: 'https://api.spotify.com/v1/me/player/play',
					headers: { Authorization: `Bearer ${access_token}` },
					json: true,
					body: {
						uris: [params.song.uri]
					}
				}

				request.put(options, async () => {
					console.log('song started')
					// set timeout here to prevent any weird overlap between songs
					setTimeout(() => {
						socket.poll(params.token)
					}, 500)
				})

				db.development
					.collection('rooms')
					.updateOne(
						{ _id: ObjectId(params.roomId) },
						{ $set: { currentSong: params.song } },
						// eslint-disable-next-line no-unused-vars
						(err, result) => {
							if (err) {
								console.log(err)
							} else {
								// console.log(result)
							}
						}
					)

				db.development
					.collection('rooms')
					.updateOne(
						{ _id: ObjectId(params.roomId) },
						{ $pop: { queue: -1 } },
						(err) => {
							if (err) {
								console.log(err)
							}
						}
					)
			} else {
				const access_token = params.token
				const options = {
					url: 'https://api.spotify.com/v1/me/player/play',
					headers: { Authorization: `Bearer ${access_token}` },
					json: true
				}

				request.put(options, () => {
					console.log('song resumed')
					// set timeout here to prevent any weird overlap
					setTimeout(() => {
						socket.poll(params.token)
					}, 500)
				})
			}

			io.in(params.roomId).emit('playSong', params)
		})

		socket.on('clearCurrentSong', (params) => {
			const currentSong = {
				songName: 'no current song',
				artistName: 'no current song',
				uri: '',
				coverArt: ''
			}

			db.development
				.collection('rooms')
				.updateOne(
					{ _id: ObjectId(params.roomId) },
					{ $set: { currentSong } },
					(err, result) => {
						if (err) {
							console.log(err)
						} else {
							// console.log(result)
						}
					}
				)

			io.in(params.roomId).emit('clearCurrentSong', currentSong)
		})
	})
}
