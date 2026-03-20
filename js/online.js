// Online Multiplayer Client — Socket.io communication module

class OnlineManager {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.playerNum = null;  // 1 or 2
        this.roomSecret = null; // for rejoin auth
        this.connected = false;
        this.reconnecting = false; // true while attempting auto-rejoin
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
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000
            });

            this.socket.on('connect', () => {
                console.log('[Online] Connected:', this.socket.id);
                this.connected = true;
                this.error = null;

                // Auto-rejoin if we were in a game
                if (this.state === 'in_game' && this.roomId && this.roomSecret) {
                    this._attemptRejoin();
                } else if (this.state !== 'in_game') {
                    this.state = 'in_lobby';
                }
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                console.error('[Online] Connection error:', err.message);
                if (this.state !== 'in_game') {
                    this.error = 'Could not connect to server';
                    this.state = 'idle';
                }
                this.connected = false;
                reject(err);
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[Online] Disconnected:', reason);
                this.connected = false;
                if (this.state === 'in_game') {
                    this.reconnecting = true;
                    this.error = 'Reconnecting...';
                }
            });

            this._setupGameEvents();
        });
    }

    // Attempt to rejoin room after reconnection
    _attemptRejoin() {
        this.reconnecting = true;
        console.log('[Online] Attempting rejoin room:', this.roomId);
        this.socket.emit('rejoin_room', {
            roomId: this.roomId,
            playerNum: this.playerNum,
            roomSecret: this.roomSecret
        }, (response) => {
            this.reconnecting = false;
            if (response.error) {
                console.error('[Online] Rejoin failed:', response.error);
                this.error = 'Could not rejoin game';
                this.state = 'idle';
                if (this.onOpponentDisconnected) this.onOpponentDisconnected();
            } else {
                console.log('[Online] Rejoined successfully');
                this.error = null;
                if (this.onReconnected) this.onReconnected();
            }
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

        // Opponent selected turn order
        this.socket.on('opponent_select_turn_order', (data) => {
            if (this.onOpponentSelectTurnOrder) this.onOpponentSelectTurnOrder(data);
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

        // Server-authoritative state sync (Phase 7)
        this.socket.on('state_sync', (data) => {
            if (this.onStateSync) this.onStateSync(data);
        });

        // Action was rejected by server
        this.socket.on('action_rejected', (data) => {
            console.warn('[Online] Action rejected:', data.reason);
        });

        // Opponent's connection was lost (grace period started)
        this.socket.on('opponent_connection_lost', () => {
            console.log('[Online] Opponent connection lost (waiting for rejoin...)');
            if (this.onOpponentConnectionLost) this.onOpponentConnectionLost();
        });

        // Opponent reconnected after connection loss
        this.socket.on('opponent_reconnected', () => {
            console.log('[Online] Opponent reconnected');
            if (this.onOpponentReconnected) this.onOpponentReconnected();
        });

        // Opponent disconnected permanently (grace period expired)
        this.socket.on('opponent_disconnected', () => {
            console.log('[Online] Opponent disconnected permanently');
            this.state = 'idle';
            if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        });

        // Rematch events
        this.socket.on('rematch_request', () => {
            if (this.onRematchRequest) this.onRematchRequest();
        });
        this.socket.on('rematch_accepted', () => {
            if (this.onRematchAccepted) this.onRematchAccepted();
        });
        this.socket.on('rematch_declined', () => {
            if (this.onRematchDeclined) this.onRematchDeclined();
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
                this.roomSecret = response.roomSecret;
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
                this.roomSecret = response.roomSecret;
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

    // Send turn order selection to opponent
    sendTurnOrder(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('select_turn_order', data);
    }

    // Send board setup (host only)
    sendBoardSetup(data) {
        if (!this.socket || !this.connected) return;
        this.socket.emit('board_setup', data);
    }

    // Send a game action to the server
    sendAction(data) {
        if (!this.socket) return;
        this.socket.emit('game_action', data);
    }

    // Request a dice roll from server
    requestDice(queue, nonce) {
        if (!this.socket) return;
        this.socket.emit('request_dice', { queue, nonce });
    }

    // Disconnect from server
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.reconnecting = false;
        this.state = 'idle';
        this.roomId = null;
        this.playerNum = null;
        this.roomSecret = null;
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

    // Rematch
    sendRematchRequest() {
        if (this.socket && this.connected) this.socket.emit('rematch_request');
    }
    sendRematchAccept() {
        if (this.socket && this.connected) this.socket.emit('rematch_accept');
    }
    sendRematchDecline() {
        if (this.socket && this.connected) this.socket.emit('rematch_decline');
    }
}
