const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { RoomManager } = require('./room');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

// Static file server (serves the game files)
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const httpServer = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(data);
        }
    });
});

// Socket.io server
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);

    // Create a new room
    socket.on('create_room', (callback) => {
        const room = roomManager.createRoom(socket.id);
        socket.join(room.id);
        console.log(`[Room] ${socket.id} created room ${room.id}`);
        callback({ roomId: room.id, playerNum: 1 });
    });

    // Join an existing room
    socket.on('join_room', (roomId, callback) => {
        const result = roomManager.joinRoom(roomId, socket.id);
        if (result.error) {
            callback({ error: result.error });
            return;
        }
        socket.join(roomId);
        console.log(`[Room] ${socket.id} joined room ${roomId}`);
        callback({ roomId, playerNum: result.playerNum });

        // Notify both players that the room is full and game can start
        io.to(roomId).emit('room_ready', {
            roomId,
            players: roomManager.getRoom(roomId).players
        });
    });

    // Skill selection
    socket.on('select_skill', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        // Forward to the other player
        socket.to(room.id).emit('opponent_select_skill', data);
    });

    // Board setup (host sends initial board state to opponent)
    socket.on('board_setup', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        const playerNum = room.getPlayerNum(socket.id);
        if (playerNum !== 1) return; // only host can send board setup
        room.currentTurn = data.currentTurn || 1;
        socket.to(room.id).emit('board_setup', data);
        console.log(`[Room ${room.id}] Board setup sent, first turn: P${room.currentTurn}`);
    });

    // Game action (move, place stone, use skill, etc.)
    socket.on('game_action', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;

        // Validate it's this player's turn
        const playerNum = room.getPlayerNum(socket.id);
        if (playerNum !== room.currentTurn) {
            socket.emit('action_rejected', { reason: 'Not your turn' });
            return;
        }

        // Forward to opponent
        socket.to(room.id).emit('opponent_action', data);

        // Update turn if the action ends the turn
        if (data.endsTurn) {
            room.currentTurn = room.currentTurn === 1 ? 2 : 1;
        }
    });

    // Dice roll (server generates nextValue, uses client queue[0] as roll value)
    socket.on('request_dice', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;

        const playerNum = room.getPlayerNum(socket.id);
        if (playerNum !== room.currentTurn) return;

        const queue = data && data.queue ? data.queue : [1, 1, 1];
        const value = queue[0]; // Use client's current dice (what they see as CURRENT)
        const nextValue = Math.floor(Math.random() * 3) + 1;
        io.to(room.id).emit('dice_result', { playerNum, value, nextValue, queue });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`[Disconnect] ${socket.id}`);
        const room = roomManager.getRoomBySocket(socket.id);
        if (room) {
            socket.to(room.id).emit('opponent_disconnected');
            roomManager.removeRoom(room.id);
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Nine-Nine server running on http://localhost:${PORT}`);
});
