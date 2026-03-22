const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { RoomManager } = require('./room');
const { DIRECTION_TYPE } = require('../shared/constants');

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
    cors: { origin: '*' },
    pingInterval: 10000,  // ping every 10s (keep connection alive on Render)
    pingTimeout: 15000    // disconnect if no pong within 15s
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);

    // Create a new room
    socket.on('create_room', (callback) => {
        const room = roomManager.createRoom(socket.id);
        socket.join(room.id);
        console.log(`[Room] ${socket.id} created room ${room.id}`);
        callback({ roomId: room.id, playerNum: 1, roomSecret: room.roomSecret });
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
        const room = roomManager.getRoom(roomId);
        callback({ roomId, playerNum: result.playerNum, roomSecret: room.roomSecret });

        // Notify both players that the room is full and game can start
        io.to(roomId).emit('room_ready', {
            roomId,
            players: room.players
        });
    });

    // Skill selection
    socket.on('select_skill', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        // Forward to the other player
        socket.to(room.id).emit('opponent_select_skill', data);
    });

    // Turn order selection
    socket.on('select_turn_order', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        socket.to(room.id).emit('opponent_select_turn_order', data);
    });

    // Board setup (host sends initial board state to opponent)
    socket.on('board_setup', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        const playerNum = room.getPlayerNum(socket.id);
        if (playerNum !== 1) return; // only host can send board setup
        room.currentTurn = data.currentTurn || 1;

        // Initialize server-side game state
        if (data.p1Skill && data.p2Skill) {
            room.initGameState(data.p1Skill, data.p2Skill);
            if (data.board) room.gameLogic.board.deserialize(data.board);
            if (data.p1) room.gameLogic.player1.deserialize(data.p1);
            if (data.p2) room.gameLogic.player2.deserialize(data.p2);
            room.gameLogic.currentTurn = room.currentTurn;
            // Keep gameState in sync
            room.gameState.currentTurn = room.currentTurn;
            console.log(`[Room ${room.id}] Server game state initialized (GameLogic)`);
        }

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

        // Reject duplicate turn-ending actions (prevents double-click race)
        if (data.endsTurn && data.seq) {
            if (data.seq <= room.lastActionSeq[playerNum]) {
                socket.emit('action_rejected', { reason: 'Duplicate action' });
                return;
            }
            room.lastActionSeq[playerNum] = data.seq;
        }

        // Server-side validation and state tracking via GameLogic
        if (room.gameLogic) {
            const gl = room.gameLogic;
            try {
                switch (data.type) {
                    case 'move': {
                        gl.findMovableTiles();
                        const valid = gl.movableTiles.find(t => t.row === data.row && t.col === data.col)
                                   || gl.fallTriggerTiles.find(t => t.row === data.row && t.col === data.col);
                        if (!valid) {
                            console.warn(`[Room ${room.id}] Invalid move (${data.row},${data.col}) rejected`);
                            socket.emit('action_rejected', { reason: 'Invalid move' });
                            return;
                        }
                        const moveResult = gl.movePlayerLogic(data.row, data.col);
                        if (moveResult.bombHit) {
                            // Bomb hit: set winner on server
                            const loser = gl.currentTurn;
                            gl.winner = loser === 1 ? 2 : 1;
                            gl.winReason = `Player ${loser} stepped on a bomb!`;
                        } else {
                            // Complete move logic (fountain pickup, warp detection, etc.)
                            gl.completeMoveLogic(data.row, data.col);
                        }
                        // Reset moveMode after move
                        gl.moveMode = DIRECTION_TYPE.CROSS;
                        break;
                    }
                    case 'toggle_mode':
                        gl.toggleMoveMode();
                        break;
                    case 'place': {
                        if (data.placementType) gl.placementType = data.placementType;
                        gl.findPlaceableTiles();
                        gl.placeObject(data.row, data.col);
                        break;
                    }
                    case 'set_placement_type':
                        gl.setPlacementType(data.placementType);
                        break;
                    case 'drill':
                        gl.findDrillTargets();
                        gl.useDrill(data.row, data.col);
                        break;
                    case 'activate_skill':
                        gl.activateSkill();
                        break;
                    case 'skill_target':
                        if (data.skillType) gl.activeSkillType = data.skillType;
                        gl.executeSkillTarget(data.row, data.col);
                        break;
                    case 'stock_dice':
                        gl.stockCurrentDice();
                        break;
                    case 'use_stock':
                        gl.useStockedDice();
                        break;
                    case 'warp_select':
                        gl.completeWarpLogic(data.row, data.col);
                        break;
                }
            } catch (e) {
                console.error(`[Room ${room.id}] GameLogic error on ${data.type}:`, e.message);
            }
        }

        // Forward to opponent
        socket.to(room.id).emit('opponent_action', data);

        // Update turn if the action ends the turn
        if (data.endsTurn) {
            room.currentTurn = room.currentTurn === 1 ? 2 : 1;
            if (room.gameLogic) room.gameLogic.currentTurn = room.currentTurn;
        }

        // Send authoritative state sync to both clients (Phase 7)
        if (room.gameLogic) {
            const sync = {
                board: room.gameLogic.board.serialize(),
                p1: room.gameLogic.player1.serialize(),
                p2: room.gameLogic.player2.serialize(),
                currentTurn: room.gameLogic.currentTurn,
                winner: room.gameLogic.winner,
                winReason: room.gameLogic.winReason,
                diceRoll: room.gameLogic.diceRoll,
                moveMode: room.gameLogic.moveMode,
            };
            io.to(room.id).emit('state_sync', sync);
        }
    });

    // Dice roll (server-authoritative: server executes rollDice on its GameLogic)
    socket.on('request_dice', (data) => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) {
            console.warn(`[Dice] ${socket.id} requested dice but not in a room`);
            return;
        }

        const playerNum = room.getPlayerNum(socket.id);
        if (playerNum !== room.currentTurn) {
            console.warn(`[Dice] P${playerNum} requested dice but it's P${room.currentTurn}'s turn`);
            return;
        }

        const nonce = data && data.nonce ? data.nonce : null;

        if (room.gameLogic) {
            // Server-authoritative: execute rollDice on server's GameLogic
            const result = room.gameLogic.rollDice();
            const player = room.gameLogic.getCurrentPlayer();
            io.to(room.id).emit('dice_result', {
                playerNum,
                value: result.diceValue,
                queue: [...player.diceQueue],
                nonce,
                serverAuthoritative: true
            });
        } else {
            // Fallback: legacy behavior
            const queue = data && data.queue ? data.queue : [1, 1, 1];
            const value = queue[0];
            const nextValue = Math.floor(Math.random() * 3) + 1;
            io.to(room.id).emit('dice_result', { playerNum, value, nextValue, queue, nonce });
        }
    });

    // Rejoin a room after reconnection
    socket.on('rejoin_room', (data, callback) => {
        if (!data || !data.roomId || !data.playerNum || !data.roomSecret) {
            callback({ error: 'Invalid rejoin data' });
            return;
        }
        const room = roomManager.getRoom(data.roomId);
        if (!room) {
            callback({ error: 'Room no longer exists' });
            return;
        }
        if (room.roomSecret !== data.roomSecret) {
            callback({ error: 'Invalid room secret' });
            return;
        }
        // Cancel the grace period timer
        if (room.disconnectTimers[data.playerNum]) {
            clearTimeout(room.disconnectTimers[data.playerNum]);
            delete room.disconnectTimers[data.playerNum];
        }
        // Replace the old socket with the new one
        const oldSocketId = room.players[data.playerNum - 1];
        room.replacePlayer(data.playerNum, socket.id);
        roomManager.socketToRoom.delete(oldSocketId);
        roomManager.socketToRoom.set(socket.id, room.id);
        socket.join(room.id);
        console.log(`[Rejoin] P${data.playerNum} rejoined room ${room.id} (${socket.id})`);
        // Notify opponent
        socket.to(room.id).emit('opponent_reconnected');
        callback({ success: true, currentTurn: room.currentTurn });
    });

    // Rematch
    socket.on('rematch_request', () => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        socket.to(room.id).emit('rematch_request');
    });
    socket.on('rematch_accept', () => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        // Reset room state for new game
        room.currentTurn = 1;
        room.lastActionSeq = { 1: 0, 2: 0 };
        io.to(room.id).emit('rematch_accepted');
    });
    socket.on('rematch_decline', () => {
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        socket.to(room.id).emit('rematch_declined');
    });

    // Disconnect — grace period before destroying room
    socket.on('disconnect', () => {
        console.log(`[Disconnect] ${socket.id}`);
        const room = roomManager.getRoomBySocket(socket.id);
        if (room) {
            const playerNum = room.getPlayerNum(socket.id);
            // Notify opponent about connection loss
            socket.to(room.id).emit('opponent_connection_lost');
            // Start 30-second grace period
            room.disconnectTimers[playerNum] = setTimeout(() => {
                console.log(`[Timeout] P${playerNum} did not rejoin room ${room.id}, destroying`);
                // Notify remaining player
                const remainingSocketIdx = playerNum === 1 ? 1 : 0;
                const remainingSocketId = room.players[remainingSocketIdx];
                if (remainingSocketId) {
                    io.to(remainingSocketId).emit('opponent_disconnected');
                }
                roomManager.removeRoom(room.id);
            }, 30000);
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Nine-Nine server running on http://localhost:${PORT}`);
});
