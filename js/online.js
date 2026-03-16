// Online Multiplayer Client — Socket.io communication module

class OnlineManager {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.playerNum = null;  // 1 or 2
        this.connected = false;
        this.state = 'idle'; // idle, connecting, in_lobby, waiting, in_game
        this.error = null;
        this.serverUrl = null;
    }

    // Connect to the server
    connect(serverUrl) {
        if (this.socket) this.disconnect();

        this.state = 'connecting';
        this.error = null;
        this.serverUrl = serverUrl;

        return new Promise((resolve, reject) => {
            if (typeof io === 'undefined') {
                this.error = 'Socket.io not loaded';
                this.state = 'idle';
                reject(new Error(this.error));
                return;
            }

            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('[Online] Connected:', this.socket.id);
                this.connected = true;
                this.state = 'in_lobby';
                this.error = null;
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                console.error('[Online] Connection error:', err.message);
                this.error = 'Could not connect to server';
                this.state = 'idle';
                this.connected = false;
                reject(err);
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[Online] Disconnected:', reason);
                this.connected = false;
                if (this.state === 'in_game') {
                    this.error = 'Disconnected from server';
                }
            });

            this._setupGameEvents();
        });
    }

    // Set up Socket.io event listeners
    _setupGameEvents() {
        // Room is full, both players ready
        this.socket.on('room_ready', (data) => {
            console.log('[Online] Room ready:', data);
            this.state = 'in_game';
            if (this.onRoomReady) this.onRoomReady(data);
        });

        // Opponent selected a skill
        this.socket.on('opponent_select_skill', (data) => {
            if (this.onOpponentSelectSkill) this.onOpponentSelectSkill(data);
        });

        // Board setup from host
        this.socket.on('board_setup', (data) => {
            console.log('[Online] Received board setup');
            if (this.onBoardSetup) this.onBoardSetup(data);
        });

        // Opponent performed a game action
        this.socket.on('opponent_action', (data) => {
            if (this.onOpponentAction) this.onOpponentAction(data);
        });

        // Server-generated dice result
        this.socket.on('dice_result', (data) => {
            if (this.onDiceResult) this.onDiceResult(data);
        });

        // Action was rejected by server
        this.socket.on('action_rejected', (data) => {
            console.warn('[Online] Action rejected:', data.reason);
        });

        // Opponent disconnected
        this.socket.on('opponent_disconnected', () => {
            console.log('[Online] Opponent disconnected');
            this.state = 'idle';
            if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        });
    }

    // Create a new room (host)
    createRoom() {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                reject(new Error('Not connected'));
                return;
            }

            this.socket.emit('create_room', (response) => {
                if (response.error) {
                    this.error = response.error;
                    reject(new Error(response.error));
                    return;
                }
                this.roomId = response.roomId;
                this.playerNum = response.playerNum;
                this.state = 'waiting';
                console.log('[Online] Created room:', this.roomId, 'as P' + this.playerNum);
                resolve(response);
            });
        });
    }

    // Join an existing room
    joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                reject(new Error('Not connected'));
                return;
            }

            this.socket.emit('join_room', roomId.toUpperCase(), (response) => {
                if (response.error) {
                    this.error = response.error;
                    reject(new Error(response.error));
                    return;
                }
                this.roomId = response.roomId;
                this.playerNum = response.playerNum;
                console.log('[Online] Joined room:', this.roomId, 'as P' + this.playerNum);
                resolve(response);
            });
        });
    }

    // Send skill selection to opponent
    sendSkillSelect(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('select_skill', data);
    }

    // Send board setup (host only)
    sendBoardSetup(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('board_setup', data);
    }

    // Send a game action to the server
    sendAction(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('game_action', data);
    }

    // Request a dice roll from server
    requestDice(queue) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('request_dice', { queue });
    }

    // Disconnect from server
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.state = 'idle';
        this.roomId = null;
        this.playerNum = null;
        this.error = null;
    }

    // Check if currently in an online game
    isOnline() {
        return this.state === 'in_game' && this.connected;
    }

    // Check if it's this player's turn
    isMyTurn(currentTurn) {
        if (!this.isOnline()) return true;
        return currentTurn === this.playerNum;
    }
}
