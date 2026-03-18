// Game State Management Class
class Game {
    constructor() {
        this.board = new Board();
        this.player1 = null;
        this.player2 = null;
        this.currentTurn = 1;
        this.phase = PHASES.START_SCREEN;
        this.gameMode = null; // 'pvp' or 'com'
        this.comDifficulty = null;
        this.showDifficultySelect = false;
        this.diceRoll = 0;
        this.placementType = 'stone';
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.warpSelectTiles = [];
        this.activeSkillType = null;
        this.winner = null;
        this.winReason = '';
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.sniperAnimating = false;
        this.sniperAnimStart = 0;
        this.fallAnimating = false;
        this.fallAnimStart = 0;
        this.fallAnimDir = { dr: 0, dc: 0 };
        this.fallAnimPlayerNum = 0;
        this.fallAnimPlayerPos = { row: 0, col: 0 };
        this.fallAnimInitialized = false;
        this.pendingFallDir = null;
        this.pendingFallPlayerNum = 0;
        this.bombAnimating = false;
        this.bombAnimStart = 0;
        this.bombAnimPlayerNum = 0;
        this.bombAnimPos = { row: 0, col: 0 };
        this.bombAnimInitialized = false;
        this.controlAnimating = false;
        this.controlAnimStart = 0;
        this.controlAnimTargetPos = { row: 0, col: 0 };
        this.controlAnimInitialized = false;
        this.hoveredSkill = null; // skill key hovered in selection screen
        this.skillTabP1 = 0; // active category tab index for P1
        this.skillTabP2 = 0; // active category tab index for P2
        this.hoveredTab = -1; // hovered tab index (-1 = none)
        this.hoveredTabPanel = 0; // which panel (1 or 2)
        this.kamakuraPatterns = [];       // [{middle:{row,col}, stones:[{row,col},...]}]
        this.hoveredKamakuraIndex = null; // index of hovered pattern
        this.pendingMoveRow = -1;
        this.pendingMoveCol = -1;

        // Online lobby state
        this.onlineLobbyMode = 'menu'; // 'menu', 'connecting', 'create', 'join', 'waiting', 'error'
        this.onlineRoomInput = '';
        this.onlineStatusMsg = '';

        // Replay state
        this.replaySelectScrollOffset = 0;
        this.replaySelectReplays = [];
        this.replayActionMode = null; // 'stone' | 'skill' | 'drill' — replay moved phase only
        this.showConfirmDialog = null; // null, 'save_log', 'online_disconnect', 'opponent_disconnected'

        // Turn banner state (online mode)
        this.turnBannerStart = 0;   // performance.now() when banner appeared
        this.turnBannerText = '';   // 'YOUR TURN' or 'WAITING...'

        // Mouse tracking (for hover-reveal UI)
        this._mouseX = 0;
        this._mouseY = 0;

        // Start animation state
        this.startAnimStart = 0;
        this.startAnimTileRevealOrder = [];
    }

    // --- Online Multiplayer Sync ---

    // Check if we're in an online game
    isOnlineMode() {
        return this.gameMode === 'online' && typeof onlineManager !== 'undefined' && onlineManager.isOnline();
    }

    // Check if it's the local player's turn
    isLocalPlayerTurn() {
        if (!this.isOnlineMode()) return true;
        return onlineManager.playerNum === this.currentTurn;
    }

    // Send a game action to the opponent via server
    _sendOnlineAction(action) {
        if (this.gameMode !== 'online') return;
        if (typeof onlineManager === 'undefined') return;
        if (!this._actionSeq) this._actionSeq = 0;
        action.seq = ++this._actionSeq;
        onlineManager.sendAction(action);
    }

    // Apply an action received from the opponent
    applyOnlineAction(data) {
        // Detect duplicate/out-of-order actions
        if (!this._lastReceivedSeq) this._lastReceivedSeq = 0;
        if (data.seq) {
            if (data.seq <= this._lastReceivedSeq) {
                console.warn('[Online] Ignoring duplicate action seq:', data.seq);
                return;
            }
            if (data.seq > this._lastReceivedSeq + 1) {
                console.warn('[Online] Gap detected: expected', this._lastReceivedSeq + 1, 'got', data.seq);
            }
            this._lastReceivedSeq = data.seq;
        }
        // If animating, skip animation immediately so action can be processed
        if (this.phase === PHASES.ANIMATING || this.phase === PHASES.START_ANIM) {
            if (this.phase === PHASES.START_ANIM) {
                this.finishStartAnim();
            } else if (typeof animManager !== 'undefined') {
                // Force-complete any active player animations
                for (const pNum of [1, 2]) {
                    const anim = animManager.playerAnims[pNum];
                    if (anim && anim.active) {
                        anim.active = false;
                        if (anim.onComplete) {
                            const cb = anim.onComplete;
                            anim.onComplete = null;
                            cb();
                        }
                    }
                }
            }
        }
        switch (data.type) {
            case 'roll_dice':
                // Dice value comes from server via dice_result event
                break;
            case 'stock_dice': {
                const cp = this.getCurrentPlayer();
                // Sync full state from the active player
                if (data.queue) cp.diceQueue = [...data.queue];
                if (data.stockedDice != null) cp.stockedDice = data.stockedDice;
                if (data.points != null) cp.points = data.points;
                // Trigger animation
                if (typeof animManager !== 'undefined' && animManager) {
                    animManager.startDiceTransition(cp.playerNum, 'stock', {
                        oldQueue: data.queue,
                        stockValue: data.stockedDice
                    });
                    animManager.startDiceReveal(cp.playerNum, cp.diceQueue[2]);
                }
                this.stockedThisTurn = true;
                break;
            }
            case 'use_stock': {
                const cp2 = this.getCurrentPlayer();
                // Sync queue state from active player
                if (data.queue) cp2.diceQueue = [...data.queue];
                cp2.stockedDice = null;
                // Trigger animation
                if (typeof animManager !== 'undefined' && animManager) {
                    animManager.startDiceTransition(cp2.playerNum, 'useStock', {
                        oldQueue: data.queue,
                        oldStock: null
                    });
                }
                this.stockedThisTurn = true;
                break;
            }
            case 'toggle_mode':
                this.toggleMoveMode();
                break;
            case 'move':
                this.findMovableTiles();
                this.movePlayer(data.row, data.col);
                break;
            case 'set_placement_type':
                this.setPlacementType(data.placementType);
                break;
            case 'activate_skill':
                this.activateSkill();
                break;
            case 'place':
                // Sync points before placing to prevent canAfford divergence
                if (data.p1pts != null) this.player1.points = data.p1pts;
                if (data.p2pts != null) this.player2.points = data.p2pts;
                this.placementType = data.placementType;
                this.findPlaceableTiles();
                this.placeObject(data.row, data.col);
                break;
            case 'drill':
                if (data.p1pts != null) this.player1.points = data.p1pts;
                if (data.p2pts != null) this.player2.points = data.p2pts;
                this.findDrillTargets();
                this.useDrill(data.row, data.col);
                break;
            case 'skill_target':
                if (data.p1pts != null) this.player1.points = data.p1pts;
                if (data.p2pts != null) this.player2.points = data.p2pts;
                this.activeSkillType = data.skillType;
                this.executeSkillTarget(data.row, data.col);
                break;
            case 'warp_select':
                this.getCurrentPlayer().moveTo(data.row, data.col);
                this.phase = PHASES.PLACE;
                this.placementType = 'stone';
                this.clearHighlights();
                this.findPlaceableTiles();
                break;
            case 'fall_trigger':
                this.findMovableTiles();
                // Find the fall trigger tile and simulate the click
                for (const tile of this.fallTriggerTiles) {
                    if (tile.row === data.row && tile.col === data.col) {
                        const currentPlayer = this.getCurrentPlayer();
                        const fromRow = currentPlayer.row;
                        const fromCol = currentPlayer.col;
                        this.pendingFallDir = { dr: tile.dr || 0, dc: tile.dc || 0 };
                        this.pendingFallPlayerNum = this.currentTurn;
                        this.pendingFallElectromagnet = tile.electromagnet || false;
                        currentPlayer.moveTo(tile.row, tile.col);
                        if (typeof animManager !== 'undefined') {
                            animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, tile.row, tile.col, 'move');
                        }
                        this.phase = PHASES.ANIMATING;
                        if (typeof animManager !== 'undefined') {
                            animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
                                this.fallAnimating = true;
                                this.fallAnimStart = performance.now();
                                this.fallAnimDir = this.pendingFallDir;
                                this.fallAnimPlayerNum = this.pendingFallPlayerNum;
                                this.fallAnimPlayerPos = { row: tile.row, col: tile.col };
                                this.fallAnimElectromagnet = this.pendingFallElectromagnet;
                                this.fallAnimInitialized = false;
                                this.phase = PHASES.MOVE;
                            };
                        }
                        break;
                    }
                }
                break;
        }
    }

    // Execute a skill target action (used by both local and online)
    executeSkillTarget(row, col) {
        switch (this.activeSkillType) {
            case SPECIAL_SKILLS.SNIPER:
                this.executeSniper();
                break;
            case SPECIAL_SKILLS.HITOKIRI:
                this.executeHitokiri(row, col);
                break;
            case SPECIAL_SKILLS.MOMONGA:
                this.executeMomonga(row, col);
                break;
            case SPECIAL_SKILLS.KAMAKURA:
                this.executeKamakura(row, col);
                break;
            case SPECIAL_SKILLS.METEOR:
                this.executeMeteor();
                break;
        }
    }

    // Apply online dice result from server
    applyOnlineDice(data) {
        // Clear retry timeout
        if (this._diceTimeout) {
            clearTimeout(this._diceTimeout);
            this._diceTimeout = null;
        }
        // Ignore stale/duplicate dice results via nonce check
        if (this.isLocalPlayerTurn() && data.nonce && data.nonce !== this._pendingDiceNonce) {
            console.warn('[Online] Ignoring stale dice result (nonce mismatch)');
            return;
        }
        this._pendingDiceNonce = null;
        const currentPlayer = this.getCurrentPlayer();
        // Sync queue from the rolling player's state to prevent desync
        if (data.queue && data.queue.length === 3) {
            currentPlayer.diceQueue = [...data.queue];
        }
        this._onlineNextValue = data.nextValue;
        this.rollDice();
        this._onlineNextValue = null;
    }

    // Send board setup to opponent (host only)
    sendBoardSetup() {
        if (!this.isOnlineMode()) return;
        if (onlineManager.playerNum !== 1) return;

        const data = {
            tiles: this.board.tiles,
            bombOwners: this.board.bombOwners,
            checkpointOwners: this.board.checkpointOwners,
            snowTurnsLeft: this.board.snowTurnsLeft,
            electromagnetOwners: this.board.electromagnetOwners,
            currentTurn: this.currentTurn,
            p1Skill: this.player1.specialSkill,
            p2Skill: this.player2.specialSkill,
            p1Queue: [...this.player1.diceQueue],
            p2Queue: [...this.player2.diceQueue]
        };
        onlineManager.sendBoardSetup(data);
    }

    // Receive and apply board setup (guest only)
    receiveBoardSetup(data) {
        // Apply board state
        this.board.tiles = data.tiles;
        this.board.bombOwners = data.bombOwners || {};
        this.board.checkpointOwners = data.checkpointOwners || {};
        this.board.snowTurnsLeft = data.snowTurnsLeft || {};
        this.board.electromagnetOwners = data.electromagnetOwners || {};
        this.currentTurn = data.currentTurn;
        // Sync dice queues
        this.player1.diceQueue = data.p1Queue;
        this.player2.diceQueue = data.p2Queue;
        // Start animation
        this.startAnimTileRevealOrder = this._buildTileRevealOrder();
        this.phase = PHASES.START_ANIM;
        this.startAnimStart = performance.now();
    }

    generateDiceValue() {
        return Math.floor(Math.random() * 3) + 1;
    }

    init() {
        this.board.reset();
        this.player1 = new Player(1, Math.floor(BOARD_SIZE / 2), 0);
        this.player2 = new Player(2, Math.floor(BOARD_SIZE / 2), BOARD_SIZE - 1);
        this.currentTurn = 1;
        this.diceRoll = 0;
        this.winner = null;
        if (typeof gameLog !== 'undefined') gameLog.reset();
        this.winReason = '';
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.drillForSurvival = false;
        this.skillTargetTiles = [];
        this.activeSkillType = null;
        this.sniperAnimating = false;
        this.sniperAnimStart = 0;
        this.fallAnimating = false;
        this.fallAnimStart = 0;
        this.fallAnimDir = { dr: 0, dc: 0 };
        this.fallAnimPlayerNum = 0;
        this.fallAnimPlayerPos = { row: 0, col: 0 };
        this.fallAnimInitialized = false;
        this.pendingFallDir = null;
        this.pendingFallPlayerNum = 0;
        this.bombAnimating = false;
        this.bombAnimStart = 0;
        this.bombAnimPlayerNum = 0;
        this.bombAnimPos = { row: 0, col: 0 };
        this.bombAnimInitialized = false;
        this.controlAnimating = false;
        this.controlAnimStart = 0;
        this.controlAnimTargetPos = { row: 0, col: 0 };
        this.controlAnimInitialized = false;
        this.kamakuraPatterns = [];
        this.hoveredKamakuraIndex = null;
        this.showDifficultySelect = false;
        this.showConfirmDialog = null;
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.reset();
        }
        if (typeof comPlayer !== 'undefined' && comPlayer) {
            comPlayer.reset();
        }
        const gen = () => this.generateDiceValue();
        this.player1.initDiceQueue(gen);
        this.player2.initDiceQueue(gen);
        this.clearHighlights();
    }

    startGame(mode) {
        this.gameMode = mode;
        this.init();
        this.phase = PHASES.SKILL_SELECTION;
        // In COM mode, trigger COM's skill selection after a delay
        if (mode === 'com' && typeof comPlayer !== 'undefined' && comPlayer) {
            comPlayer.difficulty = this.comDifficulty || COM_DIFFICULTY.NORMAL;
            comPlayer.executeAfterDelay(() => comPlayer.decideSkillSelection(), 'SKILL_SELECTION');
        }
    }

    selectSkill(playerNum, skill) {
        const player = playerNum === 1 ? this.player1 : this.player2;
        if (!player.skillConfirmed) {
            player.setSpecialSkill(skill);
            if (typeof gameLog !== 'undefined') gameLog.log('skill_select', { player: playerNum, skill });

            // Online: send skill selection to opponent
            if (this.isOnlineMode() && playerNum === onlineManager.playerNum) {
                onlineManager.sendSkillSelect({ skill });
            }
        }

        if (this.player1.skillConfirmed && this.player2.skillConfirmed) {
            // All modes: go to turn order selection
            this.turnOrderP1 = null;
            this.turnOrderP2 = null;
            this._turnOrderConflict = false;
            this._resolvedFirstTurn = null;
            if (this.gameMode === 'com') {
                // COM auto-selects "any"
                this.turnOrderP2 = 'any';
            }
            this.phase = PHASES.TURN_ORDER_SELECT;
        }
    }

    // Turn order selection
    selectTurnOrder(playerNum, choice) {
        if (playerNum === 1) this.turnOrderP1 = choice;
        else this.turnOrderP2 = choice;

        // Online: send selection to opponent
        if (this.isOnlineMode() && typeof onlineManager !== 'undefined' && playerNum === onlineManager.playerNum) {
            onlineManager.sendTurnOrder({ choice });
        }

        // COM mode: auto-confirm when P1 selects
        if (this.gameMode === 'com' && playerNum === 1) {
            this.turnOrderP2 = 'any';
        }

        if (this.turnOrderP1 && this.turnOrderP2) {
            this.resolveTurnOrder();
        }
    }

    resolveTurnOrder() {
        const p1 = this.turnOrderP1;
        const p2 = this.turnOrderP2;
        this._turnOrderConflict = false;

        // If either chose random, result is random
        if (p1 === 'random' || p2 === 'random') {
            this._resolvedFirstTurn = Math.random() < 0.5 ? 1 : 2;
        }
        // Both chose first or both chose second → conflict → random
        else if (p1 === p2 && (p1 === 'first' || p1 === 'second')) {
            this._turnOrderConflict = true;
            this._resolvedFirstTurn = Math.random() < 0.5 ? 1 : 2;
        }
        // One wants first, other wants second
        else if (p1 === 'first' && p2 === 'second') {
            this._resolvedFirstTurn = 1;
        } else if (p1 === 'second' && p2 === 'first') {
            this._resolvedFirstTurn = 2;
        }
        // One chose "any", other has preference
        else if (p1 === 'any' && p2 === 'first') {
            this._resolvedFirstTurn = 2;
        } else if (p1 === 'any' && p2 === 'second') {
            this._resolvedFirstTurn = 1;
        } else if (p1 === 'first' && p2 === 'any') {
            this._resolvedFirstTurn = 1;
        } else if (p1 === 'second' && p2 === 'any') {
            this._resolvedFirstTurn = 2;
        }
        // Both "any"
        else {
            this._resolvedFirstTurn = Math.random() < 0.5 ? 1 : 2;
        }

        // Show conflict message briefly, then proceed
        if (this._turnOrderConflict) {
            this._turnOrderConflictStart = performance.now();
            // Proceed after 1.5 seconds
            setTimeout(() => this._startGameAfterTurnOrder(), 1500);
        } else {
            this._startGameAfterTurnOrder();
        }
    }

    _startGameAfterTurnOrder() {
        if (this.isOnlineMode()) {
            // Only host (P1) generates the board
            if (typeof onlineManager !== 'undefined' && onlineManager.playerNum === 1) {
                this.setupInitialBoard();
                this.sendBoardSetup();
                this.phase = PHASES.START_ANIM;
                this.startAnimStart = performance.now();
                this.startAnimTileRevealOrder = this._buildTileRevealOrder();
            }
            // P2 waits for board_setup event (handled in receiveBoardSetup)
        } else {
            this.setupInitialBoard();
            this.phase = PHASES.START_ANIM;
            this.startAnimStart = performance.now();
            this.startAnimTileRevealOrder = this._buildTileRevealOrder();
        }
    }

    handleTurnOrderClick(x, y) {
        const btnW = 200, btnH = 50, gap = 10;
        const choices = ['first', 'second', 'any', 'random'];
        const startY = 200;

        const checkPanel = (panelX, playerNum) => {
            for (let i = 0; i < choices.length; i++) {
                const bx = panelX;
                const by = startY + i * (btnH + gap);
                if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
                    this.selectTurnOrder(playerNum, choices[i]);
                    return true;
                }
            }
            return false;
        };

        // Online: only click own panel
        if (this.isOnlineMode()) {
            if (typeof onlineManager !== 'undefined' && onlineManager.playerNum === 1) {
                return checkPanel(40, 1);
            } else {
                return checkPanel(SCREEN_WIDTH - PANEL_WIDTH + 40, 2);
            }
        }

        if (checkPanel(40, 1)) return true;
        if (this.gameMode !== 'com' && checkPanel(SCREEN_WIDTH - PANEL_WIDTH + 40, 2)) return true;
        return false;
    }

    setupInitialBoard() {
        // Place fountain tiles (one-time +100pt pickup)
        const p1FountainPos = this.findValidFountainPosition(1);
        const p2FountainPos = this.findValidFountainPosition(2);
        this.board.setTile(p1FountainPos.row, p1FountainPos.col, MARKERS.FOUNTAIN);
        this.board.setTile(p2FountainPos.row, p2FountainPos.col, MARKERS.FOUNTAIN);

        // Place 3 random stones
        const bannedPositions = this.getBannedPositions(p1FountainPos, p2FountainPos);
        const stonePositions = this.getRandomPositions(3, bannedPositions);
        for (const pos of stonePositions) {
            this.board.setTile(pos.row, pos.col, MARKERS.STONE);
        }
        this.currentTurn = this._resolvedFirstTurn || (Math.random() < 0.5 ? 1 : 2);
        if (typeof gameLog !== 'undefined') gameLog.recordSetup(this);
    }

    // 開始アニメーション用: 盤面上のタイル（石・ファウンテン）の出現順序をランダムに生成
    _buildTileRevealOrder() {
        const order = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const tile = this.board.getTile(r, c);
                if (tile !== MARKERS.EMPTY) {
                    order.push({ row: r, col: c, type: tile });
                }
            }
        }
        // Fisher-Yates shuffle
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return order;
    }

    // 開始アニメーション完了 → ゲーム開始
    finishStartAnim() {
        this.phase = PHASES.ROLL;

        // Show initial turn banner in online mode
        if (this.gameMode === 'online' && typeof onlineManager !== 'undefined') {
            this.turnBannerStart = performance.now();
            this.turnBannerText = (this.currentTurn === onlineManager.playerNum) ? 'YOUR TURN' : "OPPONENT'S TURN";
        }

        // COM先攻の場合、COMターンを開始
        if (this.gameMode === 'com' && this.currentTurn === 2) {
            if (typeof comPlayer !== 'undefined' && comPlayer) {
                comPlayer.startTurn();
            }
        }
    }

    findValidFountainPosition(playerNum) {
        const playerPos = playerNum === 1 ? this.player1.getPosition() : this.player2.getPosition();
        const zone = [];

        if (playerNum === 1) {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < Math.floor(BOARD_SIZE / 2) - 1; c++) {
                    if (this.chebyshevDistance(playerPos, { row: r, col: c }) > 3) {
                        zone.push({ row: r, col: c });
                    }
                }
            }
        } else {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = Math.floor(BOARD_SIZE / 2) + 2; c < BOARD_SIZE; c++) {
                    if (this.chebyshevDistance(playerPos, { row: r, col: c }) > 3) {
                        zone.push({ row: r, col: c });
                    }
                }
            }
        }

        return zone[Math.floor(Math.random() * zone.length)];
    }

    getBannedPositions(p1Fountain, p2Fountain) {
        const banned = new Set();

        // Fountains
        banned.add(`${p1Fountain.row},${p1Fountain.col}`);
        banned.add(`${p2Fountain.row},${p2Fountain.col}`);

        // Player positions and surrounding cells
        for (const player of [this.player1, this.player2]) {
            const pos = player.getPosition();
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    banned.add(`${pos.row + dr},${pos.col + dc}`);
                }
            }
        }
        return banned;
    }

    getRandomPositions(count, bannedSet) {
        const positions = [];
        const available = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (!bannedSet.has(`${r},${c}`)) {
                    available.push({ row: r, col: c });
                }
            }
        }

        for (let i = 0; i < count && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            positions.push(available.splice(idx, 1)[0]);
        }

        return positions;
    }

    manhattanDistance(pos1, pos2) {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
    }

    chebyshevDistance(pos1, pos2) {
        return Math.max(Math.abs(pos1.row - pos2.row), Math.abs(pos1.col - pos2.col));
    }

    hasAnyMovableTile() {
        const savedMode = this.moveMode;

        this.moveMode = DIRECTION_TYPE.CROSS;
        this.findMovableTiles();
        const crossOk = this.movableTiles.length > 0 || this.fallTriggerTiles.length > 0;

        if (!crossOk) {
            this.moveMode = DIRECTION_TYPE.DIAGONAL;
            this.findMovableTiles();
            const diagOk = this.movableTiles.length > 0 || this.fallTriggerTiles.length > 0;

            if (!diagOk) {
                this.moveMode = savedMode;
                this.findMovableTiles();
                return false;
            }
        }

        this.moveMode = savedMode;
        this.findMovableTiles();
        return true;
    }

    rollDice() {
        this.moveMode = DIRECTION_TYPE.CROSS;
        const currentPlayer = this.getCurrentPlayer();
        const oldQueue = [...currentPlayer.diceQueue];
        this.diceRoll = currentPlayer.shiftDiceQueue(() =>
            this._onlineNextValue != null ? this._onlineNextValue : this.generateDiceValue()
        );
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(currentPlayer.playerNum, 'roll', {
                oldQueue: oldQueue,
                newQueue: [...currentPlayer.diceQueue]
            });
            animManager.startDiceReveal(currentPlayer.playerNum, currentPlayer.diceQueue[2]);
        }
        if (typeof gameLog !== 'undefined') gameLog.log('roll', { player: this.currentTurn, dice: this.diceRoll, queue: [...currentPlayer.diceQueue] });
        if (!this.hasAnyMovableTile()) {
            this.gameOver(this.currentTurn === 1 ? 2 : 1, 'is blocked and cannot move!');
        } else {
            this.phase = PHASES.MOVE;
        }
    }

    stockCurrentDice() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.stock)) {
            return false;
        }
        const oldQueue = [...currentPlayer.diceQueue];
        currentPlayer.deductPoints(SKILL_COSTS.stock);
        const diceValue = currentPlayer.shiftDiceQueue(() =>
            this._onlineNextValue != null ? this._onlineNextValue : this.generateDiceValue()
        );
        currentPlayer.stockDice(diceValue);
        this.stockedThisTurn = true;
        if (typeof gameLog !== 'undefined') gameLog.log('stock', { player: this.currentTurn, storedDice: diceValue });
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(currentPlayer.playerNum, 'stock', {
                oldQueue: oldQueue,
                stockValue: diceValue
            });
            animManager.startDiceReveal(currentPlayer.playerNum, currentPlayer.diceQueue[2]);
        }
        // Stay in ROLL phase — player must click Select to use the new CURRENT
        return true;
    }

    useStockedDice() {
        const currentPlayer = this.getCurrentPlayer();
        const oldQueue = [...currentPlayer.diceQueue];
        const oldStock = currentPlayer.stockedDice;
        // Replace CURRENT with stocked value
        const stockVal = currentPlayer.useStock();
        currentPlayer.diceQueue[0] = stockVal;
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(currentPlayer.playerNum, 'useStock', {
                oldQueue: oldQueue,
                oldStock: oldStock
            });
        }
        if (typeof gameLog !== 'undefined') gameLog.log('use_stock', { player: this.currentTurn, stockVal, queue: [...currentPlayer.diceQueue] });
        // Stay in ROLL phase — player must click Select to use the new CURRENT
        this.stockedThisTurn = true;
    }

    findMovableTiles() {
        this.movableTiles = [];
        this.fallTriggerTiles = [];

        const currentPlayer = this.getCurrentPlayer();
        const otherPlayer = this.getOtherPlayer();
        const playerPos = currentPlayer.getPosition();
        const otherPos = otherPlayer.getPosition();

        const allDirections = this.moveMode === DIRECTION_TYPE.DIAGONAL
            ? DIAGONAL_DIRECTIONS.map(d => ({ ...d, type: DIRECTION_TYPE.DIAGONAL }))
            : CROSS_DIRECTIONS.map(d => ({ ...d, type: DIRECTION_TYPE.CROSS }));

        for (const dir of allDirections) {
            let steps = this.diceRoll;
            let currentPos = { row: playerPos.row, col: playerPos.col };
            let finalDest = null;
            const visitedTiles = new Set();
            let step = 1;

            while (step <= steps) {
                const nextPos = {
                    row: currentPos.row + dir.dr,
                    col: currentPos.col + dir.dc
                };

                if (!this.board.isValidPosition(nextPos.row, nextPos.col)) {
                    if (finalDest) {
                        this.fallTriggerTiles.push({ ...finalDest, dr: dir.dr, dc: dir.dc });
                    }
                    break;
                }

                const tile = this.board.getTile(nextPos.row, nextPos.col);

                // Electromagnet collision: opponent gets electrocuted, owner is safely blocked
                if (tile === MARKERS.ELECTROMAGNET) {
                    const emOwner = this.board.getElectromagnetOwner(nextPos.row, nextPos.col);
                    if (emOwner !== currentPlayer.playerNum) {
                        // Opponent collision → electrocution (same as neon border)
                        if (finalDest) {
                            this.fallTriggerTiles.push({ ...finalDest, dr: dir.dr, dc: dir.dc, electromagnet: true });
                        }
                    } else {
                        // Owner collision → safely blocked like a normal stone
                        if (finalDest) {
                            this.movableTiles.push(finalDest);
                        }
                    }
                    break;
                }

                if (tile === MARKERS.STONE || tile === MARKERS.SNOW ||
                    (nextPos.row === otherPos.row && nextPos.col === otherPos.col)) {
                    if (finalDest) {
                        this.movableTiles.push(finalDest);
                    }
                    break;
                }

                finalDest = { row: nextPos.row, col: nextPos.col, directionType: dir.type };
                currentPos = nextPos;

                // Warp hole: stop movement here, add as destination
                if (tile === MARKERS.WARP) {
                    this.movableTiles.push(finalDest);
                    finalDest = null;
                    break;
                }

                const tileKey = `${nextPos.row},${nextPos.col}`;
                if (tile === MARKERS.ICE && !visitedTiles.has(tileKey)) {
                    steps++;
                    visitedTiles.add(tileKey);
                }
                if (tile === MARKERS.SWAMP && !visitedTiles.has(tileKey)) {
                    steps = Math.max(step, steps - 2);
                    visitedTiles.add(tileKey);
                }

                step++;
            }

            if (step > steps && finalDest) {
                this.movableTiles.push(finalDest);
            }
        }

        this.movableTiles = this.removeDuplicatePositions(this.movableTiles);
        this.fallTriggerTiles = this.removeDuplicatePositions(this.fallTriggerTiles);
    }

    toggleMoveMode() {
        const currentPlayer = this.getCurrentPlayer();
        if (this.moveMode === DIRECTION_TYPE.CROSS) {
            if (!currentPlayer.canAfford(SKILL_COSTS.diagonal_move)) {
                return false;
            }
            this.moveMode = DIRECTION_TYPE.DIAGONAL;
        } else {
            this.moveMode = DIRECTION_TYPE.CROSS;
        }
        this.findMovableTiles();
        if (typeof gameLog !== 'undefined') gameLog.log('toggle_mode', { player: this.currentTurn, mode: this.moveMode });
        return true;
    }

    removeDuplicatePositions(positions) {
        const seen = new Set();
        return positions.filter(pos => {
            const key = `${pos.row},${pos.col}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    movePlayer(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        const tile = this.board.getTile(row, col);

        if (tile === MARKERS.BOMB) {
            const bombOwner = this.board.getBombOwner(row, col);
            if (bombOwner !== currentPlayer.playerNum) {
                // Start bomb explosion animation
                this.board.setTile(row, col, MARKERS.EMPTY);
                this.bombAnimating = true;
                this.bombAnimStart = performance.now();
                this.bombAnimPlayerNum = currentPlayer.playerNum;
                this.bombAnimPos = { row, col };
                this.bombAnimInitialized = false;
                // Keep phase as MOVE (bomb anim renders in MOVE/PLACE case block)
                return;
            }
            this.board.setTile(row, col, MARKERS.EMPTY);
        }

        const moveTile = this.movableTiles.find(t => t.row === row && t.col === col)
                      || this.fallTriggerTiles.find(t => t.row === row && t.col === col);
        this.lastMoveDirectionType = (moveTile && moveTile.directionType) || DIRECTION_TYPE.CROSS;

        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        if (typeof gameLog !== 'undefined') gameLog.log('move', { player: this.currentTurn, from: { row: fromRow, col: fromCol }, to: { row, col }, mode: this.moveMode });

        if (this.moveMode === DIRECTION_TYPE.DIAGONAL) {
            currentPlayer.deductPoints(SKILL_COSTS.diagonal_move);
        }

        // Start movement animation
        this.pendingMoveRow = row;
        this.pendingMoveCol = col;
        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, row, col, 'move');
        this.phase = PHASES.ANIMATING;
        animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
            this.completeMoveAfterAnim();
        };
    }

    completeMoveAfterAnim() {
        const currentPlayer = this.getCurrentPlayer();
        const row = this.pendingMoveRow;
        const col = this.pendingMoveCol;

        // Fountain tile bonus (one-time: consume tile)
        const landedTile = this.board.getTile(row, col);
        if (landedTile === MARKERS.FOUNTAIN) {
            currentPlayer.addPoints(GAME_SETTINGS.fountainPickup);
            this.board.setTile(row, col, MARKERS.EMPTY);
            if (typeof gameLog !== 'undefined') gameLog.log('fountain', { player: this.currentTurn, pos: { row, col }, pts: GAME_SETTINGS.fountainPickup });
        }

        // Warp hole effect: teleport to another warp hole
        if (landedTile === MARKERS.WARP) {
            const otherWarps = this.getOtherWarpHoles(row, col);
            if (otherWarps.length > 0) {
                this.clearHighlights();
                this.warpSelectTiles = otherWarps;
                this.phase = PHASES.WARP_SELECT;
                // Trigger COM warp decision
                if (this.gameMode === 'com' && this.currentTurn === 2 && !this.winner) {
                    comPlayer.executeAfterDelay(() => comPlayer.decideWarpSelect(), 'WARP');
                }
                return;
            }
            // No other warp holes → fall through to normal PLACE
        }

        this.phase = PHASES.PLACE;
        this.placementType = 'stone';
        this.clearHighlights();
        this.findPlaceableTiles();

        // Trigger COM place decision
        if (this.gameMode === 'com' && this.currentTurn === 2 && !this.winner) {
            comPlayer.executeAfterDelay(() => comPlayer.decidePlacePhase(), 'PLACE');
        }
    }

    canUseDrillToSurvive() {
        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer.isDominated()) return false;
        if (!currentPlayer.canAfford(SKILL_COSTS.drill)) return false;
        const playerPos = currentPlayer.getPosition();
        for (const dir of CROSS_DIRECTIONS) {
            const r = playerPos.row + dir.dr;
            const c = playerPos.col + dir.dc;
            if (this.board.isValidPosition(r, c)) {
                const t = this.board.getTile(r, c);
                if (t === MARKERS.STONE || t === MARKERS.ELECTROMAGNET) return true;
            }
        }
        return false;
    }

    findPlaceableTiles() {
        this.placeableTiles = [];
        const currentPlayer = this.getCurrentPlayer();
        const otherPlayer = this.getOtherPlayer();
        const playerPos = currentPlayer.getPosition();
        const otherPos = otherPlayer.getPosition();

        const directions = CROSS_DIRECTIONS;

        for (const dir of directions) {
            const r = playerPos.row + dir.dr;
            const c = playerPos.col + dir.dc;

            if (!this.board.isValidPosition(r, c)) continue;
            if (r === otherPos.row && c === otherPos.col) continue;

            const tile = this.board.getTile(r, c);

            if (this.placementType === 'stone') {
                if (tile !== MARKERS.STONE && tile !== MARKERS.SNOW) {
                    this.placeableTiles.push({ row: r, col: c });
                }
            } else if (['bomb', 'ice', 'swamp', 'warp', 'electromagnet'].includes(this.placementType)) {
                if (tile === MARKERS.EMPTY) {
                    this.placeableTiles.push({ row: r, col: c });
                }
            }
        }

        if (this.placeableTiles.length === 0 && this.winner === null) {
            if (this.canUseDrillToSurvive()) {
                this.drillForSurvival = true;
                this.phase = PHASES.DRILL_TARGET;
                this.findDrillTargets();
            } else {
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'has no place to put an object!');
            }
        }
    }

    placeObject(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        if (typeof gameLog !== 'undefined') gameLog.log('place', { player: this.currentTurn, pos: { row, col }, type: this.placementType });

        if (this.placementType === 'stone') {
            // Destroy checkpoint if stone is placed on it
            if (this.board.getTile(row, col) === MARKERS.CHECKPOINT) {
                const owner = this.board.getCheckpointOwner(row, col);
                if (owner) {
                    const ownerPlayer = owner === 1 ? this.player1 : this.player2;
                    ownerPlayer.checkpointPos = null;
                }
                delete this.board.checkpointOwners[`${row},${col}`];
            }
            // Destroy snow if stone is placed on it
            if (this.board.getTile(row, col) === MARKERS.SNOW) {
                delete this.board.snowTurnsLeft[`${row},${col}`];
            }
            // Destroy electromagnet if stone is placed on it
            if (this.board.getTile(row, col) === MARKERS.ELECTROMAGNET) {
                delete this.board.electromagnetOwners[`${row},${col}`];
            }
            this.board.setTile(row, col, MARKERS.STONE);
            this.endTurn();
        } else if (this.placementType === 'bomb') {
            if (currentPlayer.deductPoints(SKILL_COSTS.bomb)) {
                this.board.setBomb(row, col, currentPlayer.playerNum);
                this.endTurn();
            }
        } else if (this.placementType === 'ice') {
            if (currentPlayer.deductPoints(SKILL_COSTS.ice)) {
                this.board.setTile(row, col, MARKERS.ICE);
                this.endTurn();
            }
        } else if (this.placementType === 'swamp') {
            if (currentPlayer.deductPoints(SKILL_COSTS.swamp)) {
                this.board.setTile(row, col, MARKERS.SWAMP);
                this.endTurn();
            }
        } else if (this.placementType === 'warp') {
            if (currentPlayer.deductPoints(SKILL_COSTS.warp)) {
                this.board.setTile(row, col, MARKERS.WARP);
                this.endTurn();
            }
        } else if (this.placementType === 'electromagnet') {
            if (currentPlayer.deductPoints(SKILL_COSTS.electromagnet)) {
                this.board.setElectromagnet(row, col, currentPlayer.playerNum);
                if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'electromagnet', pos: { row, col } });
                this.endTurn();
            }
        }
    }

    setPlacementType(type) {
        const currentPlayer = this.getCurrentPlayer();
        const cost = SKILL_COSTS[type];

        if (cost !== undefined && !currentPlayer.canAfford(cost)) {
            return false;
        }

        this.placementType = type;

        if (type === 'drill') {
            this.findDrillTargets();
            if (this.drillTargetTiles.length === 0) {
                this.phase = PHASES.PLACE;
                this.placementType = 'stone';
                this.findPlaceableTiles();
                return false;
            }
            this.phase = PHASES.DRILL_TARGET;
        } else {
            this.phase = PHASES.PLACE;
            this.findPlaceableTiles();
        }

        return true;
    }

    findDrillTargets() {
        this.drillTargetTiles = [];
        const currentPlayer = this.getCurrentPlayer();
        const playerPos = currentPlayer.getPosition();

        const directions = CROSS_DIRECTIONS;

        for (const dir of directions) {
            const r = playerPos.row + dir.dr;
            const c = playerPos.col + dir.dc;

            if (this.board.isValidPosition(r, c)) {
                const t = this.board.getTile(r, c);
                if (t === MARKERS.STONE || t === MARKERS.ELECTROMAGNET) {
                    this.drillTargetTiles.push({ row: r, col: c });
                }
            }
        }
    }

    useDrill(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer.deductPoints(SKILL_COSTS.drill)) {
            if (typeof gameLog !== 'undefined') gameLog.log('drill', { player: this.currentTurn, pos: { row, col } });
            // Clean up owner data if drilling electromagnet
            if (this.board.getTile(row, col) === MARKERS.ELECTROMAGNET) {
                delete this.board.electromagnetOwners[`${row},${col}`];
            }
            this.board.setTile(row, col, MARKERS.EMPTY);
            if (this.drillForSurvival) {
                this.drillForSurvival = false;
            }
            this.endTurn();
        }
    }

    // --- Skill System ---

    getSkillKey(specialSkill) {
        const info = SKILL_INFO[specialSkill];
        return info ? info.costKey : null;
    }

    activateSkill() {
        const currentPlayer = this.getCurrentPlayer();
        const skill = currentPlayer.specialSkill;

        if (currentPlayer.isDominated()) return false;

        switch (skill) {
            case SPECIAL_SKILLS.ICE:
                return this.setPlacementType('ice');
            case SPECIAL_SKILLS.BOMB:
                return this.setPlacementType('bomb');
            case SPECIAL_SKILLS.DOMINATION:
                return this.useDomination();
            case SPECIAL_SKILLS.SNIPER:
                return this.activateSniper();
            case SPECIAL_SKILLS.HITOKIRI:
                return this.activateHitokiri();
            case SPECIAL_SKILLS.SURIASHI:
                return this.activateSuriashi();
            case SPECIAL_SKILLS.METEOR:
                return this.activateMeteor();
            case SPECIAL_SKILLS.MOMONGA:
                return this.activateMomonga();
            case SPECIAL_SKILLS.SWAMP:
                return this.setPlacementType('swamp');
            case SPECIAL_SKILLS.WARP:
                return this.setPlacementType('warp');
            case SPECIAL_SKILLS.CHECKPOINT:
                return this.useCheckpoint();
            case SPECIAL_SKILLS.KAMAKURA:
                return this.activateKamakura();
            case SPECIAL_SKILLS.ELECTROMAGNET:
                return this.setPlacementType('electromagnet');
        }
        return false;
    }

    useDomination() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.domination)) return false;
        currentPlayer.deductPoints(SKILL_COSTS.domination);
        const otherPlayer = this.getOtherPlayer();
        otherPlayer.dominationTurnsLeft = 1;
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'domination' });
        // Start control animation instead of immediately ending turn
        this.controlAnimating = true;
        this.controlAnimStart = performance.now();
        this.controlAnimTargetPos = { row: otherPlayer.row, col: otherPlayer.col };
        this.controlAnimInitialized = false;
        return true;
    }

    useCheckpoint() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.checkpoint)) return false;

        if (currentPlayer.hasCheckpoint()) {
            // --- Teleport mode ---
            const cp = currentPlayer.getCheckpoint();
            const otherPos = this.getOtherPlayer().getPosition();
            // Cannot teleport if opponent is on checkpoint
            if (cp.row === otherPos.row && cp.col === otherPos.col) return false;
            currentPlayer.deductPoints(SKILL_COSTS.checkpoint);
            if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'checkpoint_teleport', to: { row: cp.row, col: cp.col } });
            const fromRow = currentPlayer.row;
            const fromCol = currentPlayer.col;
            currentPlayer.moveTo(cp.row, cp.col);
            animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, cp.row, cp.col, 'teleport');
            this.phase = PHASES.ANIMATING;
            animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
                this.endTurn();
            };
        } else {
            // --- Place mode ---
            const pos = currentPlayer.getPosition();
            currentPlayer.deductPoints(SKILL_COSTS.checkpoint);
            if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'checkpoint_place', pos: { row: pos.row, col: pos.col } });
            this.board.setCheckpoint(pos.row, pos.col, currentPlayer.playerNum);
            currentPlayer.setCheckpoint(pos.row, pos.col);
            // Destroy surrounding 4-direction stones (cross only)
            const allDirs = CROSS_DIRECTIONS;
            for (const dir of allDirs) {
                const r = pos.row + dir.dr;
                const c = pos.col + dir.dc;
                if (this.board.isValidPosition(r, c) &&
                    this.board.getTile(r, c) === MARKERS.STONE) {
                    this.board.setTile(r, c, MARKERS.EMPTY);
                }
            }
            this.endTurn();
        }
        return true;
    }

    findKamakuraPatterns() {
        const pPos = this.getCurrentPlayer().getPosition();
        const patterns = [];
        for (const pattern of KAMAKURA_PATTERNS) {
            let allStones = true;
            const stonePositions = [];
            for (const offset of pattern.stones) {
                const r = pPos.row + offset.dr;
                const c = pPos.col + offset.dc;
                if (!this.board.isValidPosition(r, c) ||
                    this.board.getTile(r, c) !== MARKERS.STONE) {
                    allStones = false;
                    break;
                }
                stonePositions.push({ row: r, col: c });
            }
            if (allStones) {
                patterns.push({
                    middle: { row: pPos.row + pattern.middle.dr, col: pPos.col + pattern.middle.dc },
                    stones: stonePositions
                });
            }
        }
        return patterns;
    }

    activateKamakura() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.kamakura)) return false;
        const patterns = this.findKamakuraPatterns();
        if (patterns.length === 0) return false;
        this.kamakuraPatterns = patterns;
        this.hoveredKamakuraIndex = null;
        this.skillTargetTiles = patterns.map(p => ({ row: p.middle.row, col: p.middle.col }));
        this.activeSkillType = SPECIAL_SKILLS.KAMAKURA;
        this.phase = PHASES.SKILL_TARGET;
        return true;
    }

    executeKamakura(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.kamakura);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'kamakura', target: { row, col } });
        const pattern = this.kamakuraPatterns.find(
            p => p.middle.row === row && p.middle.col === col
        );
        if (pattern) {
            for (const s of pattern.stones) {
                this.board.setSnow(s.row, s.col, 2);
            }
        }
        this.kamakuraPatterns = [];
        this.hoveredKamakuraIndex = null;
        this.endTurn();
    }

    updateKamakuraHover(row, col) {
        if (this.activeSkillType !== SPECIAL_SKILLS.KAMAKURA) return;
        this.hoveredKamakuraIndex = null;
        for (let i = 0; i < this.kamakuraPatterns.length; i++) {
            const p = this.kamakuraPatterns[i];
            if (p.middle.row === row && p.middle.col === col) {
                this.hoveredKamakuraIndex = i;
                return;
            }
        }
    }

    checkSniperCondition() {
        const currentPlayer = this.getCurrentPlayer();
        const otherPlayer = this.getOtherPlayer();
        const pPos = currentPlayer.getPosition();
        const oPos = otherPlayer.getPosition();

        const dr = oPos.row - pPos.row;
        const dc = oPos.col - pPos.col;

        // Must be on same row, col, or diagonal
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;

        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        if (dist < 4) return false;

        // Check for stone obstacles in line of sight
        const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
        for (let i = 1; i < dist; i++) {
            const r = pPos.row + stepR * i;
            const c = pPos.col + stepC * i;
            const t = this.board.getTile(r, c);
            if (t === MARKERS.STONE || t === MARKERS.SNOW) return false;
        }
        return true;
    }

    activateSniper() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.sniper)) return false;
        if (!this.checkSniperCondition()) return false;
        currentPlayer.deductPoints(SKILL_COSTS.sniper);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'sniper' });
        // Start sniper animation instead of immediate game over
        this.sniperAnimating = true;
        this.sniperAnimStart = performance.now();
        return true;
    }

    checkHitokiriCondition() {
        const currentPlayer = this.getCurrentPlayer();
        const otherPlayer = this.getOtherPlayer();
        const pPos = currentPlayer.getPosition();
        const oPos = otherPlayer.getPosition();

        for (const dir of CROSS_DIRECTIONS) {
            if (pPos.row + dir.dr === oPos.row && pPos.col + dir.dc === oPos.col) return true;
        }
        return false;
    }

    activateHitokiri() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.hitokiri)) return false;
        if (!this.checkHitokiriCondition()) return false;
        currentPlayer.deductPoints(SKILL_COSTS.hitokiri);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'hitokiri' });
        this.gameOver(this.currentTurn, 'slashed the opponent!');
        return true;
    }

    activateSuriashi() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.suriashi)) return false;

        const pPos = currentPlayer.getPosition();
        const oPos = this.getOtherPlayer().getPosition();
        this.skillTargetTiles = [];

        for (const dir of DIAGONAL_DIRECTIONS) {
            const r = pPos.row + dir.dr;
            const c = pPos.col + dir.dc;
            if (!this.board.isValidPosition(r, c)) continue;
            if (r === oPos.row && c === oPos.col) continue;
            const st = this.board.getTile(r, c);
            if (st === MARKERS.STONE || st === MARKERS.SNOW) continue;
            this.skillTargetTiles.push({ row: r, col: c });
        }
        if (this.skillTargetTiles.length === 0) return false;
        this.activeSkillType = SPECIAL_SKILLS.SURIASHI;
        this.phase = PHASES.SKILL_TARGET;
        return true;
    }

    executeSuriashi(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.suriashi);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'suriashi', target: { row, col } });
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, row, col, 'move');
        this.phase = PHASES.ANIMATING;
        animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
            this.endTurn();
        };
    }

    activateMeteor() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.meteor)) return false;

        const oPos = this.getOtherPlayer().getPosition();
        const pPos = currentPlayer.getPosition();
        this.skillTargetTiles = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board.getTile(r, c) !== MARKERS.EMPTY) continue;
                if (r === oPos.row && c === oPos.col) continue;
                if (r === pPos.row && c === pPos.col) continue;
                this.skillTargetTiles.push({ row: r, col: c });
            }
        }
        if (this.skillTargetTiles.length === 0) return false;
        this.activeSkillType = SPECIAL_SKILLS.METEOR;
        this.phase = PHASES.SKILL_TARGET;
        return true;
    }

    executeMeteor(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.meteor);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'meteor', target: { row, col } });
        this.board.setTile(row, col, MARKERS.STONE);
        this.endTurn();
    }

    findNearestStones() {
        const pPos = this.getCurrentPlayer().getPosition();
        let minDist = Infinity;
        const stones = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board.getTile(r, c) === MARKERS.STONE) {
                    const dist = this.manhattanDistance(pPos, { row: r, col: c });
                    if (dist < minDist) {
                        minDist = dist;
                        stones.length = 0;
                        stones.push({ row: r, col: c });
                    } else if (dist === minDist) {
                        stones.push({ row: r, col: c });
                    }
                }
            }
        }
        return stones;
    }

    activateMomonga() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.momonga)) return false;

        const nearestStones = this.findNearestStones();
        if (nearestStones.length === 0) return false;

        const oPos = this.getOtherPlayer().getPosition();
        const pPos = currentPlayer.getPosition();
        this.skillTargetTiles = [];
        const seen = new Set();

        for (const stone of nearestStones) {
            for (const dir of CROSS_DIRECTIONS) {
                const r = stone.row + dir.dr;
                const c = stone.col + dir.dc;
                const key = `${r},${c}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (!this.board.isValidPosition(r, c)) continue;
                if (r === oPos.row && c === oPos.col) continue;
                if (r === pPos.row && c === pPos.col) continue;
                const mt = this.board.getTile(r, c);
                if (mt === MARKERS.STONE || mt === MARKERS.SNOW) continue;
                this.skillTargetTiles.push({ row: r, col: c });
            }
        }
        if (this.skillTargetTiles.length === 0) return false;
        this.activeSkillType = SPECIAL_SKILLS.MOMONGA;
        this.phase = PHASES.SKILL_TARGET;
        return true;
    }

    executeMomonga(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.momonga);
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'momonga', target: { row, col } });
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, row, col, 'move');
        this.phase = PHASES.ANIMATING;
        animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
            this.endTurn();
        };
    }

    // --- Turn Management ---

    endTurn() {
        if (typeof gameLog !== 'undefined') {
            gameLog.log('end_turn', {
                player: this.currentTurn,
                p1pts: this.player1.points,
                p2pts: this.player2.points,
                p1Queue: [...this.player1.diceQueue],
                p2Queue: [...this.player2.diceQueue],
                p1Stock: this.player1.stockedDice,
                p2Stock: this.player2.stockedDice
            });
            gameLog.incrementTurn();
        }
        const oldPlayer = this.getCurrentPlayer();
        if (oldPlayer.dominationTurnsLeft > 0) {
            oldPlayer.dominationTurnsLeft--;
        }

        // Tick snow timers
        this.board.tickSnow();

        this.currentTurn = this.currentTurn === 1 ? 2 : 1;

        const newPlayer = this.getCurrentPlayer();
        newPlayer.addPoints(GAME_SETTINGS.turnBonus);

        this.phase = PHASES.ROLL;
        this.diceRoll = 0;
        this.stockedThisTurn = false;
        this.clearHighlights();

        // Show turn banner in online mode
        if (this.gameMode === 'online' && typeof onlineManager !== 'undefined') {
            this.turnBannerStart = performance.now();
            this.turnBannerText = (this.currentTurn === onlineManager.playerNum) ? 'YOUR TURN' : "OPPONENT'S TURN";
        }

        // Trigger COM turn
        if (this.gameMode === 'com' && this.currentTurn === 2 && !this.winner) {
            comPlayer.startTurn();
        }

    }

    getOtherWarpHoles(currentRow, currentCol) {
        const otherPos = this.getOtherPlayer().getPosition();
        const warpHoles = [];
        for (let r = 0; r < this.board.size; r++) {
            for (let c = 0; c < this.board.size; c++) {
                if (this.board.getTile(r, c) === MARKERS.WARP &&
                    !(r === currentRow && c === currentCol) &&
                    !(r === otherPos.row && c === otherPos.col)) {
                    warpHoles.push({ row: r, col: c });
                }
            }
        }
        return warpHoles;
    }

    completeWarp(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        if (typeof gameLog !== 'undefined') gameLog.log('warp', { player: this.currentTurn, from: { row: fromRow, col: fromCol }, to: { row, col } });
        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, row, col, 'teleport');
        this.phase = PHASES.ANIMATING;
        animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
            this.phase = PHASES.PLACE;
            this.placementType = 'stone';
            this.clearHighlights();
            this.findPlaceableTiles();
        };
    }

    handleWarpSelectClick(x, y) {
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;
        for (const tile of this.warpSelectTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({ type: 'warp_select', row: tile.row, col: tile.col });
                this.completeWarp(tile.row, tile.col);
                return true;
            }
        }
        return false;
    }

    clearHighlights() {
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.warpSelectTiles = [];
        this.activeSkillType = null;
        this.kamakuraPatterns = [];
        this.hoveredKamakuraIndex = null;
    }

    // Compute skill targets for replay preview (no side effects: no point deduction, no phase change, no logging)
    computeSkillPreview() {
        const currentPlayer = this.getCurrentPlayer();
        const skill = currentPlayer.specialSkill;
        this.clearHighlights();

        switch (skill) {
            // Placement skills: reuse findPlaceableTiles() with appropriate type
            case SPECIAL_SKILLS.ICE:
                this.placementType = 'ice';
                this.findPlaceableTiles();
                break;
            case SPECIAL_SKILLS.BOMB:
                this.placementType = 'bomb';
                this.findPlaceableTiles();
                break;
            case SPECIAL_SKILLS.SWAMP:
                this.placementType = 'swamp';
                this.findPlaceableTiles();
                break;
            case SPECIAL_SKILLS.WARP:
                this.placementType = 'warp';
                this.findPlaceableTiles();
                break;

            // Targeting skills: compute targets without side effects
            case SPECIAL_SKILLS.SURIASHI: {
                const pPos = currentPlayer.getPosition();
                const oPos = this.getOtherPlayer().getPosition();
                for (const dir of DIAGONAL_DIRECTIONS) {
                    const r = pPos.row + dir.dr;
                    const c = pPos.col + dir.dc;
                    if (!this.board.isValidPosition(r, c)) continue;
                    if (r === oPos.row && c === oPos.col) continue;
                    const st = this.board.getTile(r, c);
                    if (st === MARKERS.STONE || st === MARKERS.SNOW) continue;
                    this.skillTargetTiles.push({ row: r, col: c });
                }
                this.activeSkillType = SPECIAL_SKILLS.SURIASHI;
                break;
            }
            case SPECIAL_SKILLS.METEOR: {
                const oPos = this.getOtherPlayer().getPosition();
                const pPos = currentPlayer.getPosition();
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (this.board.getTile(r, c) !== MARKERS.EMPTY) continue;
                        if (r === oPos.row && c === oPos.col) continue;
                        if (r === pPos.row && c === pPos.col) continue;
                        this.skillTargetTiles.push({ row: r, col: c });
                    }
                }
                this.activeSkillType = SPECIAL_SKILLS.METEOR;
                break;
            }
            case SPECIAL_SKILLS.MOMONGA: {
                const nearestStones = this.findNearestStones();
                const oPos = this.getOtherPlayer().getPosition();
                const pPos = currentPlayer.getPosition();
                const seen = new Set();
                for (const stone of nearestStones) {
                    for (const dir of CROSS_DIRECTIONS) {
                        const r = stone.row + dir.dr;
                        const c = stone.col + dir.dc;
                        const key = `${r},${c}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        if (!this.board.isValidPosition(r, c)) continue;
                        if (r === oPos.row && c === oPos.col) continue;
                        if (r === pPos.row && c === pPos.col) continue;
                        const mt = this.board.getTile(r, c);
                        if (mt === MARKERS.STONE || mt === MARKERS.SNOW) continue;
                        this.skillTargetTiles.push({ row: r, col: c });
                    }
                }
                this.activeSkillType = SPECIAL_SKILLS.MOMONGA;
                break;
            }
            case SPECIAL_SKILLS.KAMAKURA: {
                const patterns = this.findKamakuraPatterns();
                this.kamakuraPatterns = patterns;
                this.skillTargetTiles = patterns.map(p => ({ row: p.middle.row, col: p.middle.col }));
                this.activeSkillType = SPECIAL_SKILLS.KAMAKURA;
                break;
            }
            case SPECIAL_SKILLS.CHECKPOINT: {
                if (currentPlayer.hasCheckpoint()) {
                    const cp = currentPlayer.getCheckpoint();
                    const otherPos = this.getOtherPlayer().getPosition();
                    if (cp.row !== otherPos.row || cp.col !== otherPos.col) {
                        this.skillTargetTiles.push({ row: cp.row, col: cp.col });
                    }
                } else {
                    const pos = currentPlayer.getPosition();
                    this.skillTargetTiles.push({ row: pos.row, col: pos.col });
                }
                this.activeSkillType = SPECIAL_SKILLS.CHECKPOINT;
                break;
            }
            // Instant skills: no target tiles to show
            case SPECIAL_SKILLS.DOMINATION:
            case SPECIAL_SKILLS.SNIPER:
            case SPECIAL_SKILLS.HITOKIRI:
                this.activeSkillType = skill;
                break;
        }
    }

    gameOver(winner, reason) {
        if (this.winner === null) {
            const loser = winner === 1 ? 2 : 1;
            this.winner = winner;
            const loserLabel = (this.gameMode === 'com' && loser === 2) ? 'COM' : `Player ${loser}`;
            this.winReason = `${loserLabel} ${reason}`;
            this.phase = PHASES.GAME_OVER;
            if (typeof gameLog !== 'undefined') gameLog.log('game_over', {
                winner, reason,
                p1pts: this.player1.points,
                p2pts: this.player2.points,
                p1Queue: [...this.player1.diceQueue],
                p2Queue: [...this.player2.diceQueue],
                p1Stock: this.player1.stockedDice,
                p2Stock: this.player2.stockedDice
            });
            // Cancel any pending COM actions
            if (typeof comPlayer !== 'undefined' && comPlayer) {
                comPlayer.cancelPending();
            }
            // Auto-save replay to localStorage
            if (typeof replayEngine !== 'undefined' && replayEngine && typeof gameLog !== 'undefined') {
                replayEngine.saveToStorage(gameLog);
            }
        }
    }

    getCurrentPlayer() {
        return this.currentTurn === 1 ? this.player1 : this.player2;
    }

    getOtherPlayer() {
        return this.currentTurn === 1 ? this.player2 : this.player1;
    }

    // --- Click Handlers ---

    handleConfirmDialogClick(x, y) {
        // Opponent disconnected dialog — single "OK" button
        if (this.showConfirmDialog === 'opponent_disconnected') {
            const btnW = 140, btnH = 45;
            const dy = (SCREEN_HEIGHT - 180) / 2;
            const btnX = (SCREEN_WIDTH - btnW) / 2;
            const btnY = dy + 110;
            if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
                this.showConfirmDialog = null;
                this.gameMode = null;
                this.phase = PHASES.START_SCREEN;
            }
            return true;
        }

        // Online disconnect confirm — "Disconnect" / "Cancel"
        if (this.showConfirmDialog === 'online_disconnect') {
            const btnW = 140, btnH = 45;
            const dy = (SCREEN_HEIGHT - 180) / 2;
            const btnY = dy + 110;
            const gap = 20;
            const totalW = btnW * 2 + gap;
            const startX = (SCREEN_WIDTH - totalW) / 2;

            // Disconnect button
            if (x >= startX && x <= startX + btnW && y >= btnY && y <= btnY + btnH) {
                this.showConfirmDialog = null;
                onlineManager.disconnect();
                this.gameMode = null;
                this.phase = PHASES.START_SCREEN;
                return true;
            }
            // Cancel button
            if (x >= startX + btnW + gap && x <= startX + totalW && y >= btnY && y <= btnY + btnH) {
                this.showConfirmDialog = null;
                return true;
            }
            return true;
        }

        // Default: save_log dialog (3 buttons)
        const btnW = 110, btnH = 40;
        const dh = 180;
        const dy = (SCREEN_HEIGHT - dh) / 2;
        const btnY = dy + 110;
        const startX = (SCREEN_WIDTH - (btnW * 3 + 10 * 2)) / 2; // 465

        // 保存する (Save)
        if (x >= startX && x <= startX + btnW && y >= btnY && y <= btnY + btnH) {
            if (typeof replayEngine !== 'undefined' && replayEngine && typeof gameLog !== 'undefined') {
                replayEngine.saveToStorage(gameLog);
            }
            if (typeof comPlayer !== 'undefined' && comPlayer) comPlayer.cancelPending();
            this.showConfirmDialog = null;
            this.phase = PHASES.START_SCREEN;
            return true;
        }

        // 保存しない (Discard)
        if (x >= startX + btnW + 10 && x <= startX + btnW * 2 + 10 && y >= btnY && y <= btnY + btnH) {
            if (typeof comPlayer !== 'undefined' && comPlayer) comPlayer.cancelPending();
            this.showConfirmDialog = null;
            this.phase = PHASES.START_SCREEN;
            return true;
        }

        // キャンセル (Cancel)
        if (x >= startX + (btnW + 10) * 2 && x <= startX + btnW * 3 + 10 * 2 && y >= btnY && y <= btnY + btnH) {
            this.showConfirmDialog = null;
            return true;
        }

        // Block clicks outside dialog
        return true;
    }

    handleClick(x, y) {
        // Confirm dialog takes priority over everything (even during animation)
        if (this.showConfirmDialog) {
            return this.handleConfirmDialogClick(x, y);
        }

        // Block input during animation
        if (this.phase === PHASES.ANIMATING) return false;
        if (this.phase === PHASES.START_ANIM) return false;

        // Hover-menu: skill selection → return to menu (online: disconnect confirm)
        if (this.phase === PHASES.SKILL_SELECTION && y < 50) {
            if (x >= 20 && x <= 160 && y >= 8 && y <= 42) {
                if (this.gameMode === 'online') {
                    this.showConfirmDialog = 'online_disconnect';
                } else {
                    this.phase = PHASES.START_SCREEN;
                }
                return true;
            }
        }

        // Hover-menu: gameplay → show confirm dialog
        const gameplayPhases = [PHASES.ROLL, PHASES.MOVE, PHASES.PLACE,
            PHASES.DRILL_TARGET, PHASES.SKILL_TARGET, PHASES.WARP_SELECT];
        if (gameplayPhases.includes(this.phase) && y < 50) {
            if (x >= 20 && x <= 160 && y >= 8 && y <= 42) {
                if (this.gameMode === 'online') {
                    this.showConfirmDialog = 'online_disconnect';
                } else {
                    this.showConfirmDialog = 'save_log';
                }
                return true;
            }
        }

        // Block clicks during COM's turn (except menus and replay)
        if (this.gameMode === 'com' && this.currentTurn === 2 &&
            this.phase !== PHASES.START_SCREEN &&
            this.phase !== PHASES.GAME_OVER &&
            this.phase !== PHASES.SETTINGS &&
            this.phase !== PHASES.SKILL_SELECTION &&
            this.phase !== PHASES.REPLAY &&
            this.phase !== PHASES.TUTORIAL &&
            this.phase !== PHASES.ONLINE_LOBBY) {
            return false;
        }

        // Block clicks during opponent's turn in online mode (except menus/skill_selection)
        // Use gameMode check (not isOnlineMode) to keep blocking even after disconnect
        if (this.gameMode === 'online' && typeof onlineManager !== 'undefined' &&
            onlineManager.playerNum !== this.currentTurn &&
            this.phase !== PHASES.START_SCREEN &&
            this.phase !== PHASES.GAME_OVER &&
            this.phase !== PHASES.SKILL_SELECTION &&
            this.phase !== PHASES.TURN_ORDER_SELECT &&
            this.phase !== PHASES.ONLINE_LOBBY) {
            return false;
        }

        switch (this.phase) {
            case PHASES.START_SCREEN:
                return this.handleStartScreenClick(x, y);
            case PHASES.TUTORIAL:
                return this.handleTutorialClick(x, y);
            case PHASES.ONLINE_LOBBY:
                return this.handleOnlineLobbyClick(x, y);
            case PHASES.SETTINGS:
                return this.handleSettingsClick(x, y);
            case PHASES.SKILL_SELECTION:
                return this.handleSkillSelectionClick(x, y);
            case PHASES.TURN_ORDER_SELECT:
                return this.handleTurnOrderClick(x, y);
            case PHASES.ROLL:
                return this.handleRollPhaseClick(x, y);
            case PHASES.MOVE:
                return this.handleMovePhaseClick(x, y);
            case PHASES.PLACE:
                return this.handlePlacePhaseClick(x, y);
            case PHASES.DRILL_TARGET:
                return this.handleDrillPhaseClick(x, y);
            case PHASES.SKILL_TARGET:
                return this.handleSkillTargetClick(x, y);
            case PHASES.WARP_SELECT:
                return this.handleWarpSelectClick(x, y);
            case PHASES.GAME_OVER:
                return this.handleGameOverClick(x, y);
            case PHASES.REPLAY:
                return this.handleReplayClick(x, y);
        }
    }

    handleSkillSelectionClick(x, y) {
        const tabH = 28, tabGap = 4, tabY = 160;
        const btnWidth = 115, btnHeight = 90, gapX = 10, gapY = 8, startY = 200;

        const checkPanel = (player, panelX, tabProp) => {
            if (player.skillConfirmed) return false;

            // Tab clicks
            const tabCount = SKILL_CATEGORIES.length;
            const totalTabW = PANEL_WIDTH - 40;
            const tabW = (totalTabW - tabGap * (tabCount - 1)) / tabCount;
            for (let t = 0; t < tabCount; t++) {
                const tx = panelX + t * (tabW + tabGap);
                if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
                    this[tabProp] = t;
                    return true;
                }
            }

            // Skill button clicks
            const cat = SKILL_CATEGORIES[this[tabProp]];
            if (!cat) return false;
            for (let i = 0; i < cat.skills.length; i++) {
                const row = Math.floor(i / 2), col = i % 2;
                const bx = panelX + col * (btnWidth + gapX);
                const by = startY + row * (btnHeight + gapY);
                if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                    this.selectSkill(player.playerNum, cat.skills[i]);
                    return true;
                }
            }
            return false;
        };

        // Online mode: only allow clicking your own panel
        if (this.isOnlineMode()) {
            if (onlineManager.playerNum === 1) {
                return checkPanel(this.player1, 20, 'skillTabP1');
            } else {
                return checkPanel(this.player2, SCREEN_WIDTH - PANEL_WIDTH + 20, 'skillTabP2');
            }
        }

        if (checkPanel(this.player1, 20, 'skillTabP1')) return true;
        if (this.gameMode !== 'com' && checkPanel(this.player2, SCREEN_WIDTH - PANEL_WIDTH + 20, 'skillTabP2')) return true;

        return false;
    }

    handleStartScreenClick(x, y) {
        const cx = SCREEN_WIDTH / 2;

        // PvP button (center y=370, h=70)
        if (x >= cx - 150 && x <= cx + 150 && y >= 335 && y <= 405) {
            this.showDifficultySelect = false;
            this.startGame('pvp');
            return true;
        }

        // COM button (center y=470, h=70)
        if (x >= cx - 150 && x <= cx + 150 && y >= 435 && y <= 505) {
            this.showDifficultySelect = true;
            return true;
        }

        // Difficulty buttons (shown when showDifficultySelect is true)
        if (this.showDifficultySelect) {
            const btnW = 90, btnH = 50, gap = 10;
            const startX = cx - (btnW * 3 + gap * 2) / 2;
            const btnY = 515;

            if (y >= btnY && y <= btnY + btnH) {
                if (x >= startX && x <= startX + btnW) {
                    this.comDifficulty = COM_DIFFICULTY.EASY;
                    this.startGame('com');
                    return true;
                }
                if (x >= startX + btnW + gap && x <= startX + 2 * btnW + gap) {
                    this.comDifficulty = COM_DIFFICULTY.NORMAL;
                    this.startGame('com');
                    return true;
                }
                // Hard is disabled (Coming Soon)
            }
        }

        // Online Match button (center y=560, h=60)
        if (x >= cx - 150 && x <= cx + 150 && y >= 530 && y <= 590) {
            this.phase = PHASES.ONLINE_LOBBY;
            return true;
        }

        // How to Play button (center at cx-80, y=680, size 145x50)
        if (x >= cx - 152 && x <= cx - 8 && y >= 655 && y <= 705) {
            this.phase = PHASES.TUTORIAL;
            if (typeof tutorial !== 'undefined') tutorial.reset();
            return true;
        }

        // Replay button (center at cx+80, y=680, size 145x50)
        if (x >= cx + 8 && x <= cx + 152 && y >= 655 && y <= 705) {
            this.enterReplaySelect();
            return true;
        }

        // Developer Settings gear icon (at cx+175, 370)
        if (x >= cx + 157 && x <= cx + 193 && y >= 352 && y <= 388) {
            this.phase = PHASES.SETTINGS;
            return true;
        }
        return false;
    }

    handleTutorialClick(x, y) {
        const panelW = 900, panelH = 580;
        const px = (SCREEN_WIDTH - panelW) / 2;
        const py = (SCREEN_HEIGHT - panelH) / 2;
        const slideH = 420;
        const titleY = py + 20 + slideH + 25;
        const navY = titleY + 55;

        // Prev button
        if (x >= px + 20 && x <= px + 100 && y >= navY && y <= navY + 36) {
            if (typeof tutorial !== 'undefined' && tutorial.currentSlide > 0) {
                tutorial.goToSlide(tutorial.currentSlide - 1);
            }
            return true;
        }

        // Next / Close button (left side)
        if (x >= px + panelW - 190 && x <= px + panelW - 110 && y >= navY && y <= navY + 36) {
            if (typeof tutorial !== 'undefined') {
                if (tutorial.isLastSlide()) {
                    this.phase = PHASES.START_SCREEN;
                } else {
                    tutorial.nextSlide();
                }
            }
            return true;
        }

        // Skip button (right side)
        if (x >= px + panelW - 100 && x <= px + panelW - 20 && y >= navY && y <= navY + 36) {
            this.phase = PHASES.START_SCREEN;
            return true;
        }

        // Dots
        if (typeof tutorial !== 'undefined') {
            const dotSpacing = 18;
            const dotStartX = SCREEN_WIDTH / 2 - (tutorial.slideCount() * dotSpacing) / 2;
            for (let i = 0; i < tutorial.slideCount(); i++) {
                const dotX = dotStartX + i * dotSpacing + dotSpacing / 2;
                const dotY = navY + 18;
                if (Math.hypot(x - dotX, y - dotY) < 8) {
                    tutorial.goToSlide(i);
                    return true;
                }
            }
        }

        return true; // consume all clicks in tutorial mode
    }

    handleOnlineLobbyClick(x, y) {
        const cx = SCREEN_WIDTH / 2;
        const panelW = 500, panelH = 400;
        const px = (SCREEN_WIDTH - panelW) / 2;
        const py = (SCREEN_HEIGHT - panelH) / 2;

        // Back button (top-left of panel)
        if (x >= px + 10 && x <= px + 90 && y >= py + 10 && y <= py + 42) {
            if (typeof onlineManager !== 'undefined') onlineManager.disconnect();
            this.onlineLobbyMode = 'menu';
            this.phase = PHASES.START_SCREEN;
            return true;
        }

        if (this.onlineLobbyMode === 'menu') {
            // "Create Room" button
            if (x >= cx - 120 && x <= cx + 120 && y >= py + 160 && y <= py + 210) {
                this._onlineConnect('create');
                return true;
            }
            // "Join Room" button
            if (x >= cx - 120 && x <= cx + 120 && y >= py + 230 && y <= py + 280) {
                this.onlineLobbyMode = 'join';
                this.onlineRoomInput = '';
                return true;
            }
        } else if (this.onlineLobbyMode === 'join') {
            // "Paste" button (right of input box)
            if (x >= cx + 110 && x <= cx + 170 && y >= py + 165 && y <= py + 205) {
                const self = this;
                if (navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(text => {
                        const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                        if (cleaned) self.onlineRoomInput = cleaned;
                    }).catch(() => {});
                }
                return true;
            }
            // "Connect" button
            if (x >= cx - 60 && x <= cx + 60 && y >= py + 280 && y <= py + 320) {
                if (this.onlineRoomInput.length > 0) {
                    this._onlineConnect('join');
                }
                return true;
            }
            // "Back" to menu
            if (x >= cx - 60 && x <= cx + 60 && y >= py + 335 && y <= py + 365) {
                this.onlineLobbyMode = 'menu';
                return true;
            }
        } else if (this.onlineLobbyMode === 'waiting') {
            // Copy room code on click
            if (x >= cx - 120 && x <= cx + 120 && y >= py + 160 && y <= py + 210) {
                const roomId = onlineManager.roomId;
                if (roomId) {
                    const self = this;
                    const showCopied = () => {
                        self.onlineStatusMsg = 'Copied!';
                        setTimeout(() => {
                            if (self.onlineLobbyMode === 'waiting') {
                                self.onlineStatusMsg = 'Waiting for opponent...';
                            }
                        }, 1500);
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(roomId).then(showCopied).catch(() => {
                            // Fallback: execCommand
                            const ta = document.createElement('textarea');
                            ta.value = roomId;
                            ta.style.position = 'fixed';
                            ta.style.left = '-9999px';
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            showCopied();
                        });
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = roomId;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showCopied();
                    }
                }
                return true;
            }
            // Cancel button
            if (x >= cx - 60 && x <= cx + 60 && y >= py + 320 && y <= py + 360) {
                if (typeof onlineManager !== 'undefined') onlineManager.disconnect();
                this.onlineLobbyMode = 'menu';
                return true;
            }
        } else if (this.onlineLobbyMode === 'error') {
            // Back button
            if (x >= cx - 60 && x <= cx + 60 && y >= py + 320 && y <= py + 360) {
                if (typeof onlineManager !== 'undefined') onlineManager.disconnect();
                this.onlineLobbyMode = 'menu';
                return true;
            }
        }

        return true; // consume all clicks
    }

    // Connect to online server and create/join room
    _onlineConnect(action) {
        if (typeof onlineManager === 'undefined') return;

        this.onlineLobbyMode = 'connecting';
        this.onlineStatusMsg = 'Connecting to server...';

        // Determine server URL (same origin for now)
        const serverUrl = window.location.origin;

        onlineManager.connect(serverUrl).then(() => {
            if (action === 'create') {
                this.onlineStatusMsg = 'Creating room...';
                return onlineManager.createRoom();
            } else {
                this.onlineStatusMsg = 'Joining room...';
                return onlineManager.joinRoom(this.onlineRoomInput);
            }
        }).then((result) => {
            if (action === 'create') {
                this.onlineLobbyMode = 'waiting';
                this.onlineStatusMsg = 'Waiting for opponent...';
            }
            // If joining, room_ready event will fire from server
        }).catch((err) => {
            this.onlineLobbyMode = 'error';
            this.onlineStatusMsg = err.message || 'Connection failed';
        });

        // Set up room_ready callback
        onlineManager.onRoomReady = (data) => {
            this.gameMode = 'online';
            this.init();
            this.phase = PHASES.SKILL_SELECTION;
        };

        // Opponent selected a skill
        onlineManager.onOpponentSelectSkill = (data) => {
            const opponentNum = onlineManager.playerNum === 1 ? 2 : 1;
            this.selectSkill(opponentNum, data.skill);
        };

        // Opponent selected turn order
        onlineManager.onOpponentSelectTurnOrder = (data) => {
            const opponentNum = onlineManager.playerNum === 1 ? 2 : 1;
            this.selectTurnOrder(opponentNum, data.choice);
        };

        // Board setup received from host (P2 only)
        onlineManager.onBoardSetup = (data) => {
            this.receiveBoardSetup(data);
        };

        // Server dice result
        onlineManager.onDiceResult = (data) => {
            this.applyOnlineDice(data);
        };

        // Opponent game action
        onlineManager.onOpponentAction = (data) => {
            this.applyOnlineAction(data);
        };

        // Opponent's connection was lost (grace period started, may rejoin)
        onlineManager.onOpponentConnectionLost = () => {
            if (this.phase === PHASES.ONLINE_LOBBY || this.phase === PHASES.SKILL_SELECTION) {
                this.onlineStatusMsg = 'Opponent connection lost...';
            } else {
                this._opponentReconnecting = true;
            }
        };

        // Opponent reconnected after connection loss
        onlineManager.onOpponentReconnected = () => {
            this._opponentReconnecting = false;
            if (this.phase === PHASES.ONLINE_LOBBY) {
                this.onlineStatusMsg = '';
            }
        };

        // Self reconnected after connection loss
        onlineManager.onReconnected = () => {
            this._selfReconnecting = false;
        };

        // Opponent disconnected permanently (grace period expired)
        onlineManager.onOpponentDisconnected = () => {
            this._opponentReconnecting = false;
            if (this.phase === PHASES.ONLINE_LOBBY || this.phase === PHASES.SKILL_SELECTION) {
                this.onlineStatusMsg = 'Opponent disconnected';
                this.onlineLobbyMode = 'error';
                this.phase = PHASES.ONLINE_LOBBY;
            } else {
                this.showConfirmDialog = 'opponent_disconnected';
            }
            onlineManager.disconnect();
        };
    }

    enterReplaySelect() {
        if (typeof replayEngine !== 'undefined' && replayEngine) {
            this.replaySelectReplays = replayEngine.loadFromStorage();
        } else {
            this.replaySelectReplays = [];
        }
        this.replaySelectScrollOffset = 0;
        this.phase = PHASES.REPLAY;
        this.winner = null;
        this._replayMode = 'select'; // 'select' or 'playback'
    }

    handleSettingsClick(x, y) {
        if (x >= 30 && x <= 180 && y >= 15 && y <= 65) {
            this.phase = PHASES.START_SCREEN;
            return true;
        }
        if (x >= SCREEN_WIDTH - 220 && x <= SCREEN_WIDTH - 30 && y >= 15 && y <= 65) {
            if (typeof settings !== 'undefined') {
                settings.resetAll();
            }
            return true;
        }
        return false;
    }

    // Roll dice: for online mode, request from server; for offline, roll locally
    _doRoll() {
        if (this.isOnlineMode()) {
            const currentPlayer = this.getCurrentPlayer();
            // Generate nonce to prevent duplicate dice processing
            this._pendingDiceNonce = Date.now() + '_' + Math.random();
            onlineManager.requestDice([...currentPlayer.diceQueue], this._pendingDiceNonce);
            // Safety timeout: if server doesn't respond, retry with NEW nonce
            if (this._diceTimeout) clearTimeout(this._diceTimeout);
            this._diceTimeout = setTimeout(() => {
                if (this.phase === PHASES.ROLL) {
                    console.warn('[Online] Dice request timeout, retrying...');
                    this._pendingDiceNonce = Date.now() + '_' + Math.random();
                    onlineManager.requestDice([...this.getCurrentPlayer().diceQueue], this._pendingDiceNonce);
                }
            }, 3000);
        } else {
            this.rollDice();
        }
    }

    handleRollPhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
        const currentPlayer = this.getCurrentPlayer();
        const isDominated = currentPlayer.isDominated();

        if (isDominated) {
            if (x >= panelX && x <= panelX + 200 && y >= 385 && y <= 435) {
                this._doRoll();
                return true;
            }
        } else if (this.stockedThisTurn) {
            if (x >= panelX && x <= panelX + 200 && y >= 385 && y <= 435) {
                this._doRoll();
                return true;
            }
        } else if (currentPlayer.hasStock()) {
            if (x >= panelX && x <= panelX + 200 && y >= 385 && y <= 435) {
                this._doRoll();
                return true;
            }
            if (x >= panelX && x <= panelX + 200 && y >= 443 && y <= 493) {
                this.useStockedDice();
                this._sendOnlineAction({
                    type: 'use_stock',
                    queue: [...currentPlayer.diceQueue],
                    stockedDice: null
                });
                return true;
            }
        } else {
            if (x >= panelX && x <= panelX + 200 && y >= 385 && y <= 435) {
                this._doRoll();
                return true;
            }
            if (x >= panelX && x <= panelX + 200 && y >= 443 && y <= 493) {
                if (!currentPlayer.canAfford(SKILL_COSTS.stock)) return false;
                this.stockCurrentDice();
                // Send full queue state + stock value so opponent stays in sync
                this._sendOnlineAction({
                    type: 'stock_dice',
                    queue: [...currentPlayer.diceQueue],
                    stockedDice: currentPlayer.stockedDice,
                    points: currentPlayer.points
                });
                return true;
            }
        }
        return false;
    }

    handleMovePhaseClick(x, y) {
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        const currentPlayer = this.getCurrentPlayer();
        const playerPos = currentPlayer.getPosition();
        if (clickedCell.row === playerPos.row && clickedCell.col === playerPos.col) {
            this.toggleMoveMode();
            this._sendOnlineAction({ type: 'toggle_mode' });
            return true;
        }

        if (this.fallAnimating || this.bombAnimating || this.controlAnimating) return false;

        for (const tile of this.fallTriggerTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({ type: 'fall_trigger', row: tile.row, col: tile.col, endsTurn: true });
                const currentPlayer = this.getCurrentPlayer();
                const fromRow = currentPlayer.row;
                const fromCol = currentPlayer.col;
                this.pendingFallDir = { dr: tile.dr || 0, dc: tile.dc || 0 };
                this.pendingFallPlayerNum = this.currentTurn;
                this.pendingFallElectromagnet = tile.electromagnet || false;
                currentPlayer.moveTo(tile.row, tile.col);
                animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, tile.row, tile.col, 'move');
                this.phase = PHASES.ANIMATING;
                animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
                    this.fallAnimating = true;
                    this.fallAnimStart = performance.now();
                    this.fallAnimDir = this.pendingFallDir;
                    this.fallAnimPlayerNum = this.pendingFallPlayerNum;
                    this.fallAnimPlayerPos = { row: tile.row, col: tile.col };
                    this.fallAnimElectromagnet = this.pendingFallElectromagnet;
                    this.fallAnimInitialized = false;
                    this.phase = PHASES.MOVE;
                };
                return true;
            }
        }

        for (const tile of this.movableTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({ type: 'move', row: clickedCell.row, col: clickedCell.col });
                this.movePlayer(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handlePlacePhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 365-415)
        if (x >= panelX && x <= panelX + 200 && y >= 365 && y <= 415) {
            this.setPlacementType('stone');
            this._sendOnlineAction({ type: 'set_placement_type', placementType: 'stone' });
            return true;
        }
        // Skill button (Y: 423-473)
        if (x >= panelX && x <= panelX + 200 && y >= 423 && y <= 473) {
            this.activateSkill();
            this._sendOnlineAction({ type: 'activate_skill' });
            return true;
        }
        // Drill button (Y: 481-531)
        if (x >= panelX && x <= panelX + 200 && y >= 481 && y <= 531) {
            if (this.getCurrentPlayer().isDominated()) return false;
            this.setPlacementType('drill');
            this._sendOnlineAction({ type: 'set_placement_type', placementType: 'drill' });
            return true;
        }

        // Board click
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.placeableTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({
                    type: 'place', row: clickedCell.row, col: clickedCell.col,
                    placementType: this.placementType,
                    p1pts: this.player1.points, p2pts: this.player2.points,
                    endsTurn: true
                });
                this.placeObject(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handleDrillPhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 365-415)
        if (x >= panelX && x <= panelX + 200 && y >= 365 && y <= 415) {
            this.drillForSurvival = false;
            this.setPlacementType('stone');
            this._sendOnlineAction({ type: 'set_placement_type', placementType: 'stone' });
            return true;
        }
        // Skill button (Y: 423-473)
        if (x >= panelX && x <= panelX + 200 && y >= 423 && y <= 473) {
            this.drillForSurvival = false;
            this.activateSkill();
            this._sendOnlineAction({ type: 'activate_skill' });
            return true;
        }
        // Drill button (Y: 481-531) — already in drill mode
        if (x >= panelX && x <= panelX + 200 && y >= 481 && y <= 531) {
            return true;
        }

        // Board click for drill targets
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.drillTargetTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({ type: 'drill', row: clickedCell.row, col: clickedCell.col, p1pts: this.player1.points, p2pts: this.player2.points, endsTurn: true });
                this.useDrill(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handleSkillTargetClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 365-415) — cancel skill target
        if (x >= panelX && x <= panelX + 200 && y >= 365 && y <= 415) {
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.placementType = 'stone';
            this.findPlaceableTiles();
            this._sendOnlineAction({ type: 'set_placement_type', placementType: 'stone' });
            return true;
        }
        // Skill button (Y: 423-473) — cancel skill target, re-activate skill
        if (x >= panelX && x <= panelX + 200 && y >= 423 && y <= 473) {
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.placementType = 'stone';
            this.findPlaceableTiles();
            this.activateSkill();
            this._sendOnlineAction({ type: 'activate_skill' });
            return true;
        }
        // Drill button (Y: 481-531) — cancel skill target, switch to drill
        if (x >= panelX && x <= panelX + 200 && y >= 481 && y <= 531) {
            if (this.getCurrentPlayer().isDominated()) return false;
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.setPlacementType('drill');
            this._sendOnlineAction({ type: 'set_placement_type', placementType: 'drill' });
            return true;
        }

        // Board click
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.skillTargetTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this._sendOnlineAction({ type: 'skill_target', row: tile.row, col: tile.col, skillType: this.activeSkillType, p1pts: this.player1.points, p2pts: this.player2.points, endsTurn: true });
                switch (this.activeSkillType) {
                    case SPECIAL_SKILLS.SURIASHI:
                        this.executeSuriashi(tile.row, tile.col);
                        break;
                    case SPECIAL_SKILLS.METEOR:
                        this.executeMeteor(tile.row, tile.col);
                        break;
                    case SPECIAL_SKILLS.MOMONGA:
                        this.executeMomonga(tile.row, tile.col);
                        break;
                    case SPECIAL_SKILLS.KAMAKURA:
                        this.executeKamakura(tile.row, tile.col);
                        break;
                }
                return true;
            }
        }

        return false;
    }

    handleGameOverClick(x, y) {
        // Main Menu button
        if (x >= SCREEN_WIDTH / 2 - 230 && x <= SCREEN_WIDTH / 2 - 10 &&
            y >= SCREEN_HEIGHT / 2 + 50 && y <= SCREEN_HEIGHT / 2 + 120) {
            if (this.gameMode === 'online') onlineManager.disconnect();
            this.phase = PHASES.START_SCREEN;
            return true;
        }
        // Watch Replay button
        if (x >= SCREEN_WIDTH / 2 + 10 && x <= SCREEN_WIDTH / 2 + 230 &&
            y >= SCREEN_HEIGHT / 2 + 50 && y <= SCREEN_HEIGHT / 2 + 120) {
            if (typeof replayEngine !== 'undefined' && replayEngine && typeof gameLog !== 'undefined') {
                const logData = { setup: gameLog.setupData, log: gameLog.entries };
                replayEngine.load(logData);
                replayEngine.first();
                replayEngine.applyToGame(this);
                this._replayMode = 'playback';
                this.phase = PHASES.REPLAY;
            }
            return true;
        }
        return false;
    }

    handleReplayClick(x, y) {
        if (this._replayMode === 'select') {
            return this._handleReplaySelectClick(x, y);
        } else if (this._replayMode === 'playback') {
            return this._handleReplayPlaybackClick(x, y);
        }
        return false;
    }

    _handleReplaySelectClick(x, y) {
        const cx = SCREEN_WIDTH / 2;

        // Back button (top-left)
        if (x >= 30 && x <= 180 && y >= 15 && y <= 65) {
            this.phase = PHASES.START_SCREEN;
            return true;
        }

        // Import Log button (top-right)
        if (x >= SCREEN_WIDTH - 220 && x <= SCREEN_WIDTH - 20 && y >= 15 && y <= 65) {
            const fileInput = document.getElementById('replay-file-input');
            if (fileInput) fileInput.click();
            return true;
        }

        // Scroll buttons
        const listY = 100;
        const itemH = 70;
        const listH = SCREEN_HEIGHT - 120;
        const maxVisible = Math.floor(listH / itemH);

        // Scroll Up (if offset > 0)
        if (this.replaySelectScrollOffset > 0 &&
            x >= cx - 30 && x <= cx + 30 && y >= listY - 25 && y <= listY) {
            this.replaySelectScrollOffset--;
            return true;
        }

        // Scroll Down
        if (this.replaySelectScrollOffset + maxVisible < this.replaySelectReplays.length &&
            x >= cx - 30 && x <= cx + 30 &&
            y >= listY + maxVisible * itemH && y <= listY + maxVisible * itemH + 25) {
            this.replaySelectScrollOffset++;
            return true;
        }

        // Click on replay entry
        const replays = this.replaySelectReplays;
        for (let i = 0; i < maxVisible && i + this.replaySelectScrollOffset < replays.length; i++) {
            const entryY = listY + i * itemH;
            if (x >= 40 && x <= SCREEN_WIDTH - 40 && y >= entryY && y <= entryY + itemH - 5) {
                const replay = replays[i + this.replaySelectScrollOffset];
                if (replay && replay.log) {
                    if (typeof replayEngine !== 'undefined' && replayEngine) {
                        replayEngine.load(replay.log);
                        replayEngine.first();
                        // Need to ensure game objects exist for rendering
                        if (!this.player1) {
                            this.player1 = new Player(1, 4, 0);
                            this.player2 = new Player(2, 4, BOARD_SIZE - 1);
                        }
                        this.gameMode = replay.mode || null;
                        replayEngine.applyToGame(this);
                        this._replayMode = 'playback';
                    }
                }
                return true;
            }
        }

        return false;
    }

    _handleReplayPlaybackClick(x, y) {
        if (typeof replayEngine === 'undefined' || !replayEngine) return false;

        // Top hover-reveal area (y < 50)
        if (y < 50) {
            // Back to Menu button
            if (x >= 20 && x <= 160 && y >= 8 && y <= 42) {
                this.phase = PHASES.START_SCREEN;
                this._replayMode = null;
                return true;
            }
            // Back to List button
            if (x >= 170 && x <= 325 && y >= 8 && y <= 42) {
                this.enterReplaySelect();
                return true;
            }
        }

        // Player piece click for movement mode toggle during 'rolled' phase
        const snap = replayEngine.getCurrent();
        if (snap && snap.phase === 'rolled' && snap.diceRoll) {
            const clickedCell = this.getCellFromCoords(x, y);
            if (clickedCell) {
                const currentPlayer = this.getCurrentPlayer();
                if (clickedCell.row === currentPlayer.row && clickedCell.col === currentPlayer.col) {
                    if (this.moveMode === DIRECTION_TYPE.CROSS) {
                        this.moveMode = DIRECTION_TYPE.DIAGONAL;
                    } else {
                        this.moveMode = DIRECTION_TYPE.CROSS;
                    }
                    this.findMovableTiles();
                    return true;
                }
            }
        }

        // Action buttons during 'moved' phase
        if (snap && snap.phase === 'moved') {
            const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

            // Stone button (Y: 365-415)
            if (x >= panelX && x <= panelX + 200 && y >= 365 && y <= 415) {
                this.replayActionMode = 'stone';
                this.clearHighlights();
                this.placementType = 'stone';
                this.findPlaceableTiles();
                return true;
            }
            // Skill button (Y: 423-473)
            if (x >= panelX && x <= panelX + 200 && y >= 423 && y <= 473) {
                this.replayActionMode = 'skill';
                this.computeSkillPreview();
                return true;
            }
            // Drill button (Y: 481-531)
            if (x >= panelX && x <= panelX + 200 && y >= 481 && y <= 531) {
                this.replayActionMode = 'drill';
                this.clearHighlights();
                this.findDrillTargets();
                return true;
            }
        }

        // Control bar at bottom (only active when hover-revealed)
        const barY = SCREEN_HEIGHT - 55;
        const showBottomBar = (this._mouseY !== undefined && this._mouseY > SCREEN_HEIGHT - 70);
        const btnY = barY + 8;
        const btnH = 40;
        const btnW = 55;
        const cx = SCREEN_WIDTH / 2;

        if (showBottomBar && y >= btnY && y <= btnY + btnH) {
            // ◀◀ First
            if (x >= cx - 325 && x <= cx - 325 + btnW) {
                replayEngine.first();
                replayEngine.applyToGame(this);
                return true;
            }
            // ◀ Prev Turn
            if (x >= cx - 260 && x <= cx - 260 + btnW) {
                if (replayEngine.prevTurn()) {
                    replayEngine.applyToGame(this);
                }
                return true;
            }
            // ◁ Prev Phase
            if (x >= cx - 195 && x <= cx - 195 + btnW) {
                if (replayEngine.prev()) {
                    replayEngine.applyToGame(this);
                }
                return true;
            }
            // ▷ Next Phase
            if (x >= cx + 140 && x <= cx + 140 + btnW) {
                if (replayEngine.next()) {
                    replayEngine.applyToGame(this);
                }
                return true;
            }
            // ▶ Next Turn
            if (x >= cx + 205 && x <= cx + 205 + btnW) {
                if (replayEngine.nextTurn()) {
                    replayEngine.applyToGame(this);
                }
                return true;
            }
            // ▶▶ Last
            if (x >= cx + 270 && x <= cx + 270 + btnW) {
                replayEngine.last();
                replayEngine.applyToGame(this);
                return true;
            }
        }

        return false;
    }

    getCellFromCoords(x, y) {
        const col = Math.floor((x - BOARD_OFFSET_X) / CELL_SIZE);
        const row = Math.floor((y - BOARD_OFFSET_Y) / CELL_SIZE);

        if (this.board.isValidPosition(row, col)) {
            return { row, col };
        }
        return null;
    }
}
