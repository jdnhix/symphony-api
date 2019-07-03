import {ObjectId} from "mongodb";


module.exports.room = (app, db) => {

    /**
     * @swagger
     * /room:
     *   get:
     *     tags:
     *       - Room
     *     name: Find test
     *     operationId: room
     *     summary: Retrieves list of all rooms or specific room by ID
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: object
     *          properties:
     *              roomId:
     *                  type: string
     *        description: numeric ID of room
     *     consumes:
     *       - application/json
     *     produces:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.get('/room', (req, res) => {
        const roomId = req.query.roomId || ''


        if (roomId) {

            db.development.collection('rooms').find(
                {_id: ObjectId(roomId)}
            ).toArray((err, docs) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(docs)
                }
            })

        } else {

            db.development.collection('rooms').find({}).toArray((err, docs) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(docs)
                }
            })

        }


    })


    /**
     * @swagger
     * /addRoom:
     *   post:
     *     tags:
     *       - Room
     *     name: Add Room
     *     operationId: addRoom
     *     summary: Adds a new room with an empty queue to the database
     *     parameters:
     *      - in: query
     *        name: roomName
     *        schema:
     *          type: string
     *        required: true
     *        description: name of room
     *      - in: query
     *        name: roomType
     *        schema:
     *          type: string
     *          enum: ['public', 'private']
     *        required: true
     *        description: type of room (public/private)
     *      - in: query
     *        name: hostName
     *        schema:
     *          type: string
     *        required: true
     *        description: name of room host
     *      - in: body
     *        name: settings
     *        schema:
     *          type: object
     *          required:
     *              -explicitAllowed
     *          properties:
     *              explicitAllowed:
     *                  type: boolean
     *              password:
     *                  type: string
     *              minVoteToPlay:
     *                  type: integer
     *              downVoteLimit:
     *                  type: integer
     *        required: true
     *        description: settings
     *     consumes:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    //todo should i rename this to room and somehow combine it with the deleteRoom route?
    app.post('/addRoom', (req, res) => {
        db.development.collection('rooms').updateOne(
            {
                roomName: req.query.roomName,
                roomType: req.query.roomType,
                hostName: req.query.hostName,

            },
            {
                $set:
                    {
                        audienceSize: 0,
                        Settings: req.body,
                        Queue: []
                    }
            },
            {
                upsert: true
            }, (err, result) => {
                // console.log(result)
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(result)
                }
            })
    })

    /**
     * @swagger
     * /removeRoom:
     *   post:
     *     tags:
     *       - Room
     *     name: Remove Room
     *     operationId: removeRoom
     *     summary: Removes a room
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: string
     *        required: true
     *        description: id of room
     *     consumes:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.post('/removeRoom', (req, res) => {
        db.development.collection('rooms').deleteOne({_id: ObjectId(req.query.roomId)},
            (err, result) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(result)
                }
            })
    })


    /**
     * @swagger
     * /addSongToQueue:
     *   post:
     *     tags:
     *       - Room
     *     name: Add Song To Queue
     *     operationId: addSongToRoom
     *     summary: Adds a song to the queue of a room
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: string
     *        required: true
     *        description: id of room
     *      - in: query
     *        name: songName
     *        schema:
     *          type: string
     *        required: true
     *        description: name of song
     *      - in: query
     *        name: artistName
     *        schema:
     *          type: string
     *        required: true
     *        description: name of artist
     *      - in: query
     *        name: songId
     *        schema:
     *          type: string
     *        required: true
     *        description: id of song
     *      - in: query
     *        name: coverArt
     *        schema:
     *           type: string
     *        required: true
     *        description: url to song cover art
     *     consumes:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.post('/addSongToQueue', (req, res) => {
        const roomId = req.query.roomId;
        const song = {
            songName: req.query.songName,
            artistName: req.query.artistName,
            songId: req.query.songId,
            coverArt: req.query.coverArt,
            rank: 0
        }

        db.development.collection('rooms').updateOne(
            {_id: ObjectId(roomId)},
            {$push: {Queue: song}},
            {
                upsert: true
            }, (err, result) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(result)
                }
            }
        )

    })


    /**
     * @swagger
     * /removeSongFromQueue:
     *   post:
     *     tags:
     *       - Room
     *     name: Remove Song From Queue
     *     operationId: removeSongFromQueue
     *     summary: Removes a song from a queue
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: string
     *        required: true
     *        description: roomId
     *      - in: query
     *        name: songId
     *        schema:
     *          type: string
     *        required: true
     *        description: id of song
     *     consumes:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.post('/removeSongFromQueue', (req, res) => {

        db.development.collection('rooms').updateOne(
            {_id: ObjectId(req.query.roomId)},
            {$pull: {"Queue": {songId: req.query.songId}}}, (err, result) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(result)
                }
            }
        )
    })

    /**
     * @swagger
     * /songRank:
     *   post:
     *     tags:
     *       - Room
     *     name: Change Song Rank
     *     operationId: songRank
     *     summary: increments a song's rank in the queue
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: string
     *        required: id of room
     *      - in: query
     *        name: songId
     *        schema:
     *          type: string
     *        required: id of song
     *      - in: query
     *        name: direction
     *        schema:
     *          type: string
     *          enum: ['inc', 'dec']
     *        required: true
     *        description: determines either increase rank or decrease rank
     *     consumes:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.post('/songRank', (req, res) => {
        const id = req.query.songId
        const direction = req.query.direction

        if(direction === 'inc'){
            db.development.collection('rooms').updateOne(
                {_id: ObjectId(req.query.roomId), "Queue.songId": id},
                {$inc: {'Queue.$.rank': 1}}, (err, result) => {
                    if (err) {
                        console.log(err)
                        res.error(err)
                    } else {
                        res.json(result)
                    }
                }
            )
        } else if (direction === 'dec') {
            db.development.collection('rooms').updateOne(
                {_id: ObjectId(req.query.roomId), "Queue.songId": id},
                {$inc: {'Queue.$.rank': -1}}, (err, result) => {
                    if (err) {
                        console.log(err)
                        res.error(err)
                    } else {
                        res.json(result)
                    }
                }
            )
        }


    })




    /**
     * @swagger
     * /sortQueue:
     *   post:
     *     tags:
     *       - Room
     *     name: Sort Queue
     *     operationId: sortQueue
     *     summary: Sorts queue by song rank
     *     parameters:
     *      - in: query
     *        name: roomId
     *        schema:
     *          type: string
     *        required: true
     *        description: numeric ID of room
     *     consumes:
     *       - application/json
     *     produces:
     *       - application/json
     *     responses:
     *       '200':
     *         description: A single test object
     *       '401':
     *         description: No auth token / no user found in db with that name
     *       '403':
     *         description: JWT token and username from client don't match
     */

    app.post('/sortQueue', (req, res) => {
        db.development.collection('rooms').update(
            {_id: ObjectId(req.query.roomId)},
            {$push: {Queue: {$each: [], $sort: {rank: -1}}}}, (err, result) => {
                if (err) {
                    console.log(err)
                    res.error(err)
                } else {
                    res.json(result)
                }
            }
        )
    })
}