// Room & RoomManager — manages online game rooms
const { BOARD_SIZE, MARKERS, PHASES, SPECIAL_SKILLS, SKILL_COSTS, GAME_SETTINGS,
        DIRECTION_TYPE, CROSS_DIRECTIONS, DIAGONAL_DIRECTIONS, KAMAKURA_PATTERNS } = require('../shared/constants');
const { Board } = require('../shared/board');
const { Player } = require('../shared/player');
const { GameLogic } = require('../shared/game-logic');

function generateRoomId() {
    // 6-character alphanumeric room code (easy to share)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

class Room {
    constructor(id, hostSocketId) {
        this.id = id;
        this.players = [hostSocketId, null]; // [player1, player2]
        this.currentTurn = 1; // player 1 starts
        this.lastActionSeq = { 1: 0, 2: 0 }; // per-player action seq tracking
        this.roomSecret = Math.random().toString(36).substr(2, 12); // for rejoin auth
        this.disconnectTimers = {}; // playerNum -> setTimeout handle
        this.gameState = null; // initialized when game starts
    }

    initGameState(p1Skill, p2Skill) {
        const board = new Board();
        const p1 = new Player(1, Math.floor(BOARD_SIZE / 2), 0);
        const p2 = new Player(2, Math.floor(BOARD_SIZE / 2), BOARD_SIZE - 1);
        p1.setSpecialSkill(p1Skill);
        p2.setSpecialSkill(p2Skill);

        this.gameLogic = new GameLogic(board, p1, p2);
        this.gameLogic.currentTurn = this.currentTurn;

        // Keep gameState as a reference for backward compatibility
        this.gameState = {
            board,
            players: { 1: p1, 2: p2 },
            currentTurn: this.currentTurn,
            phase: PHASES.ROLL,
            diceRoll: 0,
            placementType: 'stone',
            winner: null,
            winReason: null
        };
    }

    getGameState() {
        return this.gameState;
    }

    isFull() {
        return this.players[0] !== null && this.players[1] !== null;
    }

    addPlayer(socketId) {
        if (this.players[1] !== null) {
            return { error: 'Room is full' };
        }
        this.players[1] = socketId;
        return { playerNum: 2 };
    }

    getPlayerNum(socketId) {
        if (this.players[0] === socketId) return 1;
        if (this.players[1] === socketId) return 2;
        return null;
    }

    hasPlayer(socketId) {
        return this.players.includes(socketId);
    }

    replacePlayer(playerNum, newSocketId) {
        this.players[playerNum - 1] = newSocketId;
    }
}

class RoomManager {
    constructor() {
        this.rooms = new Map();        // roomId -> Room
        this.socketToRoom = new Map(); // socketId -> roomId
    }

    createRoom(hostSocketId) {
        // Generate unique room ID
        let id;
        do {
            id = generateRoomId();
        } while (this.rooms.has(id));

        const room = new Room(id, hostSocketId);
        this.rooms.set(id, room);
        this.socketToRoom.set(hostSocketId, id);
        return room;
    }

    joinRoom(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { error: 'Room not found' };
        }
        if (room.isFull()) {
            return { error: 'Room is full' };
        }

        const result = room.addPlayer(socketId);
        if (!result.error) {
            this.socketToRoom.set(socketId, roomId);
        }
        return result;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId) || null;
    }

    getRoomBySocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;
        return this.rooms.get(roomId) || null;
    }

    removeRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Clean up socket mappings
        for (const socketId of room.players) {
            if (socketId) {
                this.socketToRoom.delete(socketId);
            }
        }
        this.rooms.delete(roomId);
    }

    removeSocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (roomId) {
            this.socketToRoom.delete(socketId);
            return this.rooms.get(roomId) || null;
        }
        return null;
    }
}

module.exports = { Room, RoomManager };
