// Replay Engine — Parse game logs and step through turns
class ReplayEngine {
    constructor() {
        this.snapshots = [];
        this.currentIndex = 0;
        this.logData = null;
        this.gameInfo = null;
    }

    // ─── Load & Build ────────────────────────────────────────

    load(logData) {
        this.logData = logData;
        this.snapshots = [];
        this.currentIndex = 0;
        this.gameInfo = {
            mode: logData.setup.gameMode,
            difficulty: logData.setup.comDifficulty
        };
        // Store skill costs from when the game was played (fallback to current global)
        this.skillCosts = logData.setup.skillCosts
            ? { ...logData.setup.skillCosts }
            : { ...SKILL_COSTS };
        this.buildSnapshots();
    }

    buildSnapshots() {
        const setup = this.logData.setup;
        const entries = this.logData.log;

        // Virtual state initialised from setup
        const state = {
            board: setup.board.map(row => [...row]),
            bombOwners: {},
            checkpointOwners: {},
            snowTurnsLeft: {},
            electromagnetOwners: {},
            currentTurn: setup.firstTurn,
            p1: {
                row: setup.player1.position.row,
                col: setup.player1.position.col,
                points: 0,
                specialSkill: setup.player1.skill,
                stockedDice: null,
                dominationTurnsLeft: 0,
                checkpointPos: null,
                diceQueue: setup.player1.diceQueue ? [...setup.player1.diceQueue] : []
            },
            p2: {
                row: setup.player2.position.row,
                col: setup.player2.position.col,
                points: 0,
                specialSkill: setup.player2.skill,
                stockedDice: null,
                dominationTurnsLeft: 0,
                checkpointPos: null,
                diceQueue: setup.player2.diceQueue ? [...setup.player2.diceQueue] : []
            },
            winner: null,
            winReason: ''
        };

        // Snapshot 0 — initial board state before any turns
        this.snapshots.push(this._capture(state, [], { turnNumber: 0, phase: 'initial' }));

        let turnActions = [];
        let currentTurnNum = 1;
        let phaseActionsRoll = [];
        let phaseActionsMove = [];
        let capturedRoll = false;
        let capturedMove = false;
        let currentDiceRoll = 0;

        for (const entry of entries) {
            const { action, data } = entry;
            const fmtAction = this._fmtAction(action, data);
            turnActions.push(fmtAction);

            switch (action) {

                /* ── Setup ── */
                case 'skill_select':
                    this._p(state, data.player).specialSkill = data.skill;
                    break;

                /* ── Dice phase ── */
                case 'roll':
                    currentDiceRoll = data.dice;
                    phaseActionsRoll.push(fmtAction);
                    // Update dice queue from the logged post-shift queue
                    if (data.queue) {
                        this._p(state, data.player).diceQueue = [...data.queue];
                    }
                    if (!capturedRoll) {
                        this.snapshots.push(this._capture(state, [...phaseActionsRoll],
                            { turnNumber: currentTurnNum, phase: 'rolled', diceRoll: currentDiceRoll }));
                        capturedRoll = true;
                    }
                    break;

                case 'stock':
                    this._p(state, data.player).stockedDice = data.storedDice;
                    phaseActionsRoll.push(fmtAction);
                    break;

                case 'use_stock':
                    currentDiceRoll = data.dice;
                    this._p(state, data.player).stockedDice = null;
                    phaseActionsRoll.push(fmtAction);
                    if (data.queue) {
                        this._p(state, data.player).diceQueue = [...data.queue];
                    }
                    if (!capturedRoll) {
                        this.snapshots.push(this._capture(state, [...phaseActionsRoll],
                            { turnNumber: currentTurnNum, phase: 'rolled', diceRoll: currentDiceRoll }));
                        capturedRoll = true;
                    }
                    break;

                case 'toggle_mode':
                    phaseActionsRoll.push(fmtAction);
                    break;

                /* ── Movement phase ── */
                case 'move': {
                    const p = this._p(state, data.player);
                    const dr = data.to.row, dc = data.to.col;
                    const destKey = `${dr},${dc}`;
                    if (state.board[dr][dc] === MARKERS.BOMB &&
                        state.bombOwners[destKey] === data.player) {
                        state.board[dr][dc] = MARKERS.EMPTY;
                        delete state.bombOwners[destKey];
                    }
                    p.row = dr;
                    p.col = dc;
                    phaseActionsMove.push(fmtAction);
                    break;
                }

                case 'fountain':
                    state.board[data.pos.row][data.pos.col] = MARKERS.EMPTY;
                    phaseActionsMove.push(fmtAction);
                    break;

                case 'warp': {
                    const p = this._p(state, data.player);
                    p.row = data.to.row;
                    p.col = data.to.col;
                    phaseActionsMove.push(fmtAction);
                    break;
                }

                /* ── Action phase (place/drill/skill) ── */
                case 'place':
                    // Capture 'moved' snapshot before action if we have move data
                    if (!capturedMove && phaseActionsMove.length > 0) {
                        this.snapshots.push(this._capture(state,
                            [...phaseActionsRoll, ...phaseActionsMove],
                            { turnNumber: currentTurnNum, phase: 'moved' }));
                        capturedMove = true;
                    }
                    this._applyPlace(state, data);
                    // Capture 'acted' snapshot
                    this.snapshots.push(this._capture(state, turnActions.slice(),
                        { turnNumber: currentTurnNum, phase: 'acted' }));
                    break;

                case 'drill':
                    if (!capturedMove && phaseActionsMove.length > 0) {
                        this.snapshots.push(this._capture(state,
                            [...phaseActionsRoll, ...phaseActionsMove],
                            { turnNumber: currentTurnNum, phase: 'moved' }));
                        capturedMove = true;
                    }
                    state.board[data.pos.row][data.pos.col] = MARKERS.EMPTY;
                    this.snapshots.push(this._capture(state, turnActions.slice(),
                        { turnNumber: currentTurnNum, phase: 'acted' }));
                    break;

                case 'skill':
                    if (!capturedMove && phaseActionsMove.length > 0) {
                        this.snapshots.push(this._capture(state,
                            [...phaseActionsRoll, ...phaseActionsMove],
                            { turnNumber: currentTurnNum, phase: 'moved' }));
                        capturedMove = true;
                    }
                    this._applySkill(state, data);
                    this.snapshots.push(this._capture(state, turnActions.slice(),
                        { turnNumber: currentTurnNum, phase: 'acted' }));
                    break;

                /* ── Turn Boundary ── */
                case 'end_turn': {
                    // Authoritative points from log
                    state.p1.points = data.p1pts;
                    state.p2.points = data.p2pts;
                    if (data.p1Queue) state.p1.diceQueue = [...data.p1Queue];
                    if (data.p2Queue) state.p2.diceQueue = [...data.p2Queue];
                    if (data.p1Stock !== undefined) state.p1.stockedDice = data.p1Stock;
                    if (data.p2Stock !== undefined) state.p2.stockedDice = data.p2Stock;
                    // Decrement domination
                    const oldP = this._p(state, data.player);
                    if (oldP.dominationTurnsLeft > 0) oldP.dominationTurnsLeft--;
                    // Tick snow
                    this._tickSnow(state);
                    // Switch turn
                    state.currentTurn = state.currentTurn === 1 ? 2 : 1;
                    // Turn bonus for new current player
                    this._p(state, state.currentTurn).points += GAME_SETTINGS.turnBonus;
                    // No separate end snapshot — next turn's 'rolled' serves as boundary
                    currentTurnNum++;
                    turnActions = [];
                    phaseActionsRoll = [];
                    phaseActionsMove = [];
                    capturedRoll = false;
                    capturedMove = false;
                    currentDiceRoll = 0;
                    break;
                }

                /* ── Game Over ── */
                case 'game_over': {
                    state.winner = data.winner;
                    state.winReason = data.reason || '';
                    if (data.p1pts !== undefined) state.p1.points = data.p1pts;
                    if (data.p2pts !== undefined) state.p2.points = data.p2pts;
                    if (data.p1Queue) state.p1.diceQueue = [...data.p1Queue];
                    if (data.p2Queue) state.p2.diceQueue = [...data.p2Queue];
                    if (data.p1Stock !== undefined) state.p1.stockedDice = data.p1Stock;
                    if (data.p2Stock !== undefined) state.p2.stockedDice = data.p2Stock;
                    this.snapshots.push(this._capture(state, turnActions.slice(),
                        { turnNumber: currentTurnNum, phase: 'end' }));
                    turnActions = [];
                    break;
                }
            }
        }
    }

    // ─── State Mutation Helpers ───────────────────────────────

    _p(state, num) { return num === 1 ? state.p1 : state.p2; }

    _applyPlace(state, data) {
        const r = data.pos.row, c = data.pos.col;
        const key = `${r},${c}`;

        switch (data.type) {
            case 'stone':
                // Checkpoint destruction
                if (state.board[r][c] === MARKERS.CHECKPOINT && state.checkpointOwners[key]) {
                    const owner = state.checkpointOwners[key];
                    this._p(state, owner).checkpointPos = null;
                    delete state.checkpointOwners[key];
                }
                // Snow destruction
                if (state.board[r][c] === MARKERS.SNOW) {
                    delete state.snowTurnsLeft[key];
                }
                state.board[r][c] = MARKERS.STONE;
                break;
            case 'bomb':
                state.board[r][c] = MARKERS.BOMB;
                state.bombOwners[key] = data.player;
                break;
            case 'ice':
                state.board[r][c] = MARKERS.ICE;
                break;
            case 'swamp':
                state.board[r][c] = MARKERS.SWAMP;
                break;
            case 'warp':
                state.board[r][c] = MARKERS.WARP;
                break;
            case 'electromagnet':
                state.board[r][c] = MARKERS.ELECTROMAGNET;
                state.electromagnetOwners = state.electromagnetOwners || {};
                state.electromagnetOwners[`${r},${c}`] = data.player;
                break;
        }
    }

    _applySkill(state, data) {
        const p = this._p(state, data.player);
        switch (data.skill) {
            case 'domination': {
                const opp = data.player === 1 ? state.p2 : state.p1;
                opp.dominationTurnsLeft = 1;
                break;
            }
            case 'suriashi':
                if (data.target) { p.row = data.target.row; p.col = data.target.col; }
                break;
            case 'meteor':
                if (data.target) state.board[data.target.row][data.target.col] = MARKERS.STONE;
                break;
            case 'momonga':
                if (data.target) { p.row = data.target.row; p.col = data.target.col; }
                break;
            case 'electromagnet':
                // Electromagnet placement is handled by _applyPlace
                break;
            case 'checkpoint_place':
                if (data.pos) {
                    const r = data.pos.row, c = data.pos.col;
                    state.board[r][c] = MARKERS.CHECKPOINT;
                    state.checkpointOwners[`${r},${c}`] = data.player;
                    p.checkpointPos = { row: r, col: c };
                    // Destroy surrounding stones (8-direction)
                    const allDirs = [...CROSS_DIRECTIONS, ...DIAGONAL_DIRECTIONS];
                    for (const dir of allDirs) {
                        const nr = r + dir.dr;
                        const nc = c + dir.dc;
                        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE &&
                            state.board[nr][nc] === MARKERS.STONE) {
                            state.board[nr][nc] = MARKERS.EMPTY;
                        }
                    }
                }
                break;
            case 'checkpoint_teleport':
                if (data.to) { p.row = data.to.row; p.col = data.to.col; }
                break;
            case 'kamakura':
                // Reconstruct which stones to convert from pattern + player position
                if (data.target) {
                    for (const pattern of KAMAKURA_PATTERNS) {
                        const midR = p.row + pattern.middle.dr;
                        const midC = p.col + pattern.middle.dc;
                        if (midR === data.target.row && midC === data.target.col) {
                            for (const offset of pattern.stones) {
                                const sr = p.row + offset.dr;
                                const sc = p.col + offset.dc;
                                state.board[sr][sc] = MARKERS.SNOW;
                                state.snowTurnsLeft[`${sr},${sc}`] = 2;
                            }
                            break;
                        }
                    }
                }
                break;
            // sniper, hitokiri — game_over follows, no position change
        }
    }

    _tickSnow(state) {
        const toRemove = [];
        for (const key in state.snowTurnsLeft) {
            state.snowTurnsLeft[key]--;
            if (state.snowTurnsLeft[key] <= 0) toRemove.push(key);
        }
        for (const key of toRemove) {
            const [r, c] = key.split(',').map(Number);
            state.board[r][c] = MARKERS.EMPTY;
            delete state.snowTurnsLeft[key];
        }
    }

    // ─── Snapshot ─────────────────────────────────────────────

    _capture(state, actions, phaseInfo) {
        return {
            index: this.snapshots.length,
            turnNumber: phaseInfo ? phaseInfo.turnNumber : 0,
            phase: phaseInfo ? phaseInfo.phase : 'initial',
            diceRoll: phaseInfo ? (phaseInfo.diceRoll || 0) : 0,
            currentTurn: state.currentTurn,
            board: state.board.map(row => [...row]),
            bombOwners: { ...state.bombOwners },
            checkpointOwners: { ...state.checkpointOwners },
            snowTurnsLeft: { ...state.snowTurnsLeft },
            electromagnetOwners: { ...(state.electromagnetOwners || {}) },
            p1: {
                ...state.p1,
                checkpointPos: state.p1.checkpointPos ? { ...state.p1.checkpointPos } : null,
                diceQueue: state.p1.diceQueue ? [...state.p1.diceQueue] : []
            },
            p2: {
                ...state.p2,
                checkpointPos: state.p2.checkpointPos ? { ...state.p2.checkpointPos } : null,
                diceQueue: state.p2.diceQueue ? [...state.p2.diceQueue] : []
            },
            actions: [...actions],
            winner: state.winner,
            winReason: state.winReason
        };
    }

    _fmtAction(action, data) {
        const pl = data.player ? `P${data.player}` : '';
        switch (action) {
            case 'skill_select':
                return { text: `${pl}: select ${this._skillLabel(data.skill)}`, raw: { action, data } };
            case 'roll':
                return { text: `${pl}: roll dice=${data.dice}`, raw: { action, data } };
            case 'stock':
                return { text: `${pl}: stock dice=${data.storedDice}`, raw: { action, data } };
            case 'use_stock':
                return { text: `${pl}: use stock (dice=${data.dice})`, raw: { action, data } };
            case 'toggle_mode':
                return { text: `${pl}: ${data.mode} mode`, raw: { action, data } };
            case 'move': {
                const f = data.from, t = data.to;
                return { text: `${pl}: move (${f.row},${f.col})→(${t.row},${t.col})`, raw: { action, data } };
            }
            case 'fountain':
                return { text: `${pl}: fountain +${data.pts}pt`, raw: { action, data } };
            case 'place':
                return { text: `${pl}: place ${data.type} (${data.pos.row},${data.pos.col})`, raw: { action, data } };
            case 'drill':
                return { text: `${pl}: drill (${data.pos.row},${data.pos.col})`, raw: { action, data } };
            case 'warp':
                return { text: `${pl}: warp → (${data.to.row},${data.to.col})`, raw: { action, data } };
            case 'skill':
                return { text: `${pl}: ${this._skillLabel(data.skill)}`, raw: { action, data } };
            case 'end_turn':
                return { text: `Turn end (P1:${data.p1pts} P2:${data.p2pts})`, raw: { action, data } };
            case 'game_over':
                return { text: `Game Over — P${data.winner} wins (${data.reason})`, raw: { action, data } };
            default:
                return { text: `${pl}: ${action}`, raw: { action, data } };
        }
    }

    _skillLabel(skill) {
        const info = SKILL_INFO[skill];
        if (info) return info.name;
        // skill sub-types like checkpoint_place
        const map = {
            'checkpoint_place': 'Checkpoint (place)',
            'checkpoint_teleport': 'Checkpoint (teleport)',
            'domination': 'Control',
            'sniper': 'Sniper',
            'hitokiri': 'Landshark',
            'suriashi': 'Sneak',
            'meteor': 'Meteor Shower',
            'momonga': 'Momonga',
            'kamakura': 'Kamakura',
            'electromagnet': 'Electromagnet'
        };
        return map[skill] || skill;
    }

    // ─── Apply to Game Objects for Rendering ──────────────────

    applyToGame(game) {
        const snap = this.snapshots[this.currentIndex];
        if (!snap) return;

        // Board
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                game.board.tiles[r][c] = snap.board[r][c];
            }
        }
        game.board.bombOwners = { ...snap.bombOwners };
        game.board.checkpointOwners = { ...snap.checkpointOwners };
        game.board.snowTurnsLeft = { ...snap.snowTurnsLeft };
        game.board.electromagnetOwners = { ...(snap.electromagnetOwners || {}) };

        // Players
        this._applyPlayerSnap(game.player1, snap.p1);
        this._applyPlayerSnap(game.player2, snap.p2);

        // Game state
        game.currentTurn = snap.currentTurn;
        game.winner = snap.winner;
        game.winReason = snap.winReason || '';
        game.clearHighlights();

        // For 'rolled' phase, compute movable tiles so they can be displayed
        if (snap.phase === 'rolled' && snap.diceRoll) {
            game.diceRoll = snap.diceRoll;
            game.moveMode = DIRECTION_TYPE.CROSS;
            game.findMovableTiles();
        }

        // For 'moved' phase, compute stone placement tiles and set default action mode
        if (snap.phase === 'moved') {
            game.replayActionMode = 'stone';
            game.placementType = 'stone';
            game.findPlaceableTiles();
        } else {
            game.replayActionMode = null;
        }
    }

    _applyPlayerSnap(player, snap) {
        player.row = snap.row;
        player.col = snap.col;
        player.prevRow = snap.row;
        player.prevCol = snap.col;
        player.points = snap.points;
        player.specialSkill = snap.specialSkill;
        player.skillConfirmed = true;
        player.stockedDice = snap.stockedDice;
        player.dominationTurnsLeft = snap.dominationTurnsLeft;
        player.checkpointPos = snap.checkpointPos ? { ...snap.checkpointPos } : null;
        player.diceQueue = snap.diceQueue ? [...snap.diceQueue] : [];
    }

    // ─── Navigation ───────────────────────────────────────────

    next() {
        if (this.currentIndex < this.snapshots.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }

    first() { this.currentIndex = 0; }
    last()  { this.currentIndex = this.snapshots.length - 1; }

    // Turn-level navigation: jump to next turn's first snapshot
    nextTurn() {
        const currentTurn = this.snapshots[this.currentIndex].turnNumber;
        for (let i = this.currentIndex + 1; i < this.snapshots.length; i++) {
            if (this.snapshots[i].turnNumber > currentTurn) {
                this.currentIndex = i;
                return true;
            }
        }
        // No next turn found — go to last snapshot
        if (this.currentIndex < this.snapshots.length - 1) {
            this.currentIndex = this.snapshots.length - 1;
            return true;
        }
        return false;
    }

    // Turn-level navigation: jump to current turn's first snapshot, or previous turn's first
    prevTurn() {
        const currentTurn = this.snapshots[this.currentIndex].turnNumber;
        // Find the first snapshot of the current turn
        let currentTurnStart = this.currentIndex;
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if (this.snapshots[i].turnNumber < currentTurn) {
                currentTurnStart = i + 1;
                break;
            }
            if (i === 0) currentTurnStart = 0;
        }
        // If not at the start of current turn, jump there
        if (this.currentIndex > currentTurnStart) {
            this.currentIndex = currentTurnStart;
            return true;
        }
        // Already at start of current turn — jump to previous turn's first snapshot
        if (currentTurnStart > 0) {
            const prevTurnNum = this.snapshots[currentTurnStart - 1].turnNumber;
            for (let i = currentTurnStart - 1; i >= 0; i--) {
                if (this.snapshots[i].turnNumber < prevTurnNum || i === 0) {
                    this.currentIndex = (this.snapshots[i].turnNumber < prevTurnNum) ? i + 1 : i;
                    return true;
                }
            }
        }
        return false;
    }

    getCurrent()        { return this.snapshots[this.currentIndex]; }
    getActions()        { return this.snapshots[this.currentIndex]?.actions || []; }
    getTotalSnapshots() { return this.snapshots.length; }
    isFirst()           { return this.currentIndex === 0; }
    isLast()            { return this.currentIndex === this.snapshots.length - 1; }

    // ─── localStorage Management ──────────────────────────────

    static STORAGE_KEY = 'nine_nine_replays';
    static MAX_REPLAYS = 20;

    saveToStorage(gameLogObj) {
        let logData;
        if (gameLogObj && typeof gameLogObj.toJSON === 'function') {
            // GameLog instance
            logData = { setup: gameLogObj.setupData, log: gameLogObj.entries };
        } else if (typeof gameLogObj === 'string') {
            logData = JSON.parse(gameLogObj);
        } else {
            logData = gameLogObj;
        }
        if (!logData || !logData.setup) return;

        const replays = this.loadFromStorage();
        const entries = logData.log || [];
        const goEntry = entries.find(e => e.action === 'game_over');
        const lastET  = [...entries].reverse().find(e => e.action === 'end_turn');

        const record = {
            id: Date.now(),
            date: logData.setup.timestamp || new Date().toISOString(),
            mode: logData.setup.gameMode,
            difficulty: logData.setup.comDifficulty || null,
            winner: goEntry ? goEntry.data.winner : null,
            winReason: goEntry ? goEntry.data.reason : '',
            totalTurns: lastET ? lastET.turn + 1 : 0,
            p1Score: goEntry ? goEntry.data.p1pts : 0,
            p2Score: goEntry ? goEntry.data.p2pts : 0,
            p1Skill: logData.setup.player1.skill,
            p2Skill: logData.setup.player2.skill,
            log: logData
        };

        replays.unshift(record);
        while (replays.length > ReplayEngine.MAX_REPLAYS) replays.pop();

        try {
            localStorage.setItem(ReplayEngine.STORAGE_KEY, JSON.stringify(replays));
        } catch (e) {
            console.warn('Replay save failed:', e);
            // If quota exceeded, trim oldest entries and retry
            while (replays.length > 1) {
                replays.pop();
                try {
                    localStorage.setItem(ReplayEngine.STORAGE_KEY, JSON.stringify(replays));
                    break;
                } catch (_) { /* keep trimming */ }
            }
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(ReplayEngine.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    deleteFromStorage(id) {
        const replays = this.loadFromStorage().filter(r => r.id !== id);
        try {
            localStorage.setItem(ReplayEngine.STORAGE_KEY, JSON.stringify(replays));
        } catch (_) { /* ignore */ }
    }
}
