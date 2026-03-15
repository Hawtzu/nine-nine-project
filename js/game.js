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
        this.hoveredSkill = null; // skill key hovered in selection screen
        this.kamakuraPatterns = [];       // [{middle:{row,col}, stones:[{row,col},...]}]
        this.hoveredKamakuraIndex = null; // index of hovered pattern
        this.pendingMoveRow = -1;
        this.pendingMoveCol = -1;

        // Replay state
        this.replaySelectScrollOffset = 0;
        this.replaySelectReplays = [];
        this.replayActionMode = null; // 'stone' | 'skill' | 'drill' — replay moved phase only
        this.showConfirmDialog = null; // null or 'save_log' — menu confirm dialog

        // Mouse tracking (for hover-reveal UI)
        this._mouseX = 0;
        this._mouseY = 0;
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
        }

        if (this.player1.skillConfirmed && this.player2.skillConfirmed) {
            this.setupInitialBoard();
            this.phase = PHASES.ROLL;
            // If COM goes first, trigger COM turn
            if (this.gameMode === 'com' && this.currentTurn === 2) {
                comPlayer.startTurn();
            }
        }
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
        this.currentTurn = Math.random() < 0.5 ? 1 : 2;
        if (typeof gameLog !== 'undefined') gameLog.recordSetup(this);
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
        this.diceRoll = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
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
        const diceValue = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
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
                    steps = Math.max(step, steps - 1);
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
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'stepped on a bomb!');
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
            if (this.board.isValidPosition(r, c) && this.board.getTile(r, c) === MARKERS.STONE) {
                return true;
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
            } else if (['bomb', 'ice', 'swamp', 'warp'].includes(this.placementType)) {
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

            if (this.board.isValidPosition(r, c) &&
                this.board.getTile(r, c) === MARKERS.STONE) {
                this.drillTargetTiles.push({ row: r, col: c });
            }
        }
    }

    useDrill(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer.deductPoints(SKILL_COSTS.drill)) {
            if (typeof gameLog !== 'undefined') gameLog.log('drill', { player: this.currentTurn, pos: { row, col } });
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
        }
        return false;
    }

    useDomination() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.domination)) return false;
        currentPlayer.deductPoints(SKILL_COSTS.domination);
        const otherPlayer = this.getOtherPlayer();
        otherPlayer.dominationTurnsLeft = 3;
        if (typeof gameLog !== 'undefined') gameLog.log('skill', { player: this.currentTurn, skill: 'domination' });
        this.endTurn();
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
            // Destroy surrounding 8-direction stones
            const allDirs = [...CROSS_DIRECTIONS, ...DIAGONAL_DIRECTIONS];
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
        // Block input during animation
        if (this.phase === PHASES.ANIMATING) return false;

        // Confirm dialog takes priority over everything
        if (this.showConfirmDialog) {
            return this.handleConfirmDialogClick(x, y);
        }

        // Hover-menu: skill selection → direct return to menu (no dialog)
        if (this.phase === PHASES.SKILL_SELECTION && y < 50) {
            if (x >= 20 && x <= 160 && y >= 8 && y <= 42) {
                this.phase = PHASES.START_SCREEN;
                return true;
            }
        }

        // Hover-menu: gameplay → show confirm dialog
        const gameplayPhases = [PHASES.ROLL, PHASES.MOVE, PHASES.PLACE,
            PHASES.DRILL_TARGET, PHASES.SKILL_TARGET, PHASES.WARP_SELECT];
        if (gameplayPhases.includes(this.phase) && y < 50) {
            if (x >= 20 && x <= 160 && y >= 8 && y <= 42) {
                this.showConfirmDialog = 'save_log';
                return true;
            }
        }

        // Block clicks during COM's turn (except menus and replay)
        if (this.gameMode === 'com' && this.currentTurn === 2 &&
            this.phase !== PHASES.START_SCREEN &&
            this.phase !== PHASES.GAME_OVER &&
            this.phase !== PHASES.SETTINGS &&
            this.phase !== PHASES.SKILL_SELECTION &&
            this.phase !== PHASES.REPLAY) {
            return false;
        }

        switch (this.phase) {
            case PHASES.START_SCREEN:
                return this.handleStartScreenClick(x, y);
            case PHASES.SETTINGS:
                return this.handleSettingsClick(x, y);
            case PHASES.SKILL_SELECTION:
                return this.handleSkillSelectionClick(x, y);
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
        const btnWidth = 115, btnHeight = 90, gapX = 10, gapY = 8, startY = 210;

        // Player 1 panel (left side)
        if (!this.player1.skillConfirmed) {
            const panelX = 20;
            for (let i = 0; i < SKILL_ORDER.length; i++) {
                const row = Math.floor(i / 2), col = i % 2;
                const bx = panelX + col * (btnWidth + gapX);
                const by = startY + row * (btnHeight + gapY);
                if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                    this.selectSkill(1, SKILL_ORDER[i]);
                    return true;
                }
            }
        }

        // Player 2 panel (right side) — skip in COM mode
        if (!this.player2.skillConfirmed && this.gameMode !== 'com') {
            const panelX = SCREEN_WIDTH - PANEL_WIDTH + 20;
            for (let i = 0; i < SKILL_ORDER.length; i++) {
                const row = Math.floor(i / 2), col = i % 2;
                const bx = panelX + col * (btnWidth + gapX);
                const by = startY + row * (btnHeight + gapY);
                if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                    this.selectSkill(2, SKILL_ORDER[i]);
                    return true;
                }
            }
        }

        return false;
    }

    handleStartScreenClick(x, y) {
        const cx = SCREEN_WIDTH / 2;

        // PvP button
        if (x >= cx - 150 && x <= cx + 150 && y >= 350 && y <= 430) {
            this.showDifficultySelect = false;
            this.startGame('pvp');
            return true;
        }

        // COM button
        if (x >= cx - 150 && x <= cx + 150 && y >= 470 && y <= 550) {
            this.showDifficultySelect = true;
            return true;
        }

        // Difficulty buttons (shown when showDifficultySelect is true)
        if (this.showDifficultySelect) {
            const btnW = 90, btnH = 50, gap = 10;
            const startX = cx - (btnW * 3 + gap * 2) / 2;
            const btnY = 560;

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

        // Replay button (below COM/difficulty area)
        if (x >= cx - 150 && x <= cx + 150 && y >= 640 && y <= 700) {
            this.enterReplaySelect();
            return true;
        }

        // Developer Settings gear icon
        if (x >= cx + 187 && x <= cx + 223 && y >= 372 && y <= 408) {
            this.phase = PHASES.SETTINGS;
            return true;
        }
        return false;
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

    handleRollPhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
        const currentPlayer = this.getCurrentPlayer();
        const isDominated = currentPlayer.isDominated();

        if (isDominated) {
            // Domination: only Roll Dice is available
            if (x >= panelX && x <= panelX + 200 && y >= 350 && y <= 400) {
                this.rollDice();
                return true;
            }
        } else if (this.stockedThisTurn) {
            // Stock直後はSelectのみ
            if (x >= panelX && x <= panelX + 200 && y >= 350 && y <= 400) {
                this.rollDice();
                return true;
            }
        } else if (currentPlayer.hasStock()) {
            // Roll Dice button (Y: 350-400)
            if (x >= panelX && x <= panelX + 200 && y >= 350 && y <= 400) {
                this.rollDice();
                return true;
            }
            // Use Stock button (Y: 408-458)
            if (x >= panelX && x <= panelX + 200 && y >= 408 && y <= 458) {
                this.useStockedDice();
                return true;
            }
        } else {
            // Roll Dice button (Y: 350-400)
            if (x >= panelX && x <= panelX + 200 && y >= 350 && y <= 400) {
                this.rollDice();
                return true;
            }
            // Stock button (Y: 408-458)
            if (x >= panelX && x <= panelX + 200 && y >= 408 && y <= 458) {
                if (!currentPlayer.canAfford(SKILL_COSTS.stock)) return false;
                this.stockCurrentDice();
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
            return true;
        }

        if (this.fallAnimating) return false;

        for (const tile of this.fallTriggerTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                // First, move the piece to the edge tile, then start electrocution
                const currentPlayer = this.getCurrentPlayer();
                const fromRow = currentPlayer.row;
                const fromCol = currentPlayer.col;
                // Store fall info for after animation
                this.pendingFallDir = { dr: tile.dr || 0, dc: tile.dc || 0 };
                this.pendingFallPlayerNum = this.currentTurn;
                // Move piece to the edge tile
                currentPlayer.moveTo(tile.row, tile.col);
                animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, tile.row, tile.col, 'move');
                this.phase = PHASES.ANIMATING;
                animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
                    // After arriving at edge, start electrocution effect
                    this.fallAnimating = true;
                    this.fallAnimStart = performance.now();
                    this.fallAnimDir = this.pendingFallDir;
                    this.fallAnimPlayerNum = this.pendingFallPlayerNum;
                    this.fallAnimPlayerPos = { row: tile.row, col: tile.col };
                    this.fallAnimInitialized = false;
                    this.phase = PHASES.MOVE; // Return to MOVE so fall effect renders
                };
                return true;
            }
        }

        for (const tile of this.movableTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.movePlayer(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handlePlacePhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 330-380)
        if (x >= panelX && x <= panelX + 200 && y >= 330 && y <= 380) {
            this.setPlacementType('stone');
            return true;
        }
        // Skill button (Y: 388-438)
        if (x >= panelX && x <= panelX + 200 && y >= 388 && y <= 438) {
            this.activateSkill();
            return true;
        }
        // Drill button (Y: 446-496)
        if (x >= panelX && x <= panelX + 200 && y >= 446 && y <= 496) {
            if (this.getCurrentPlayer().isDominated()) return false;
            this.setPlacementType('drill');
            return true;
        }

        // Board click
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.placeableTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.placeObject(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handleDrillPhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 330-380)
        if (x >= panelX && x <= panelX + 200 && y >= 330 && y <= 380) {
            this.drillForSurvival = false;
            this.setPlacementType('stone');
            return true;
        }
        // Skill button (Y: 388-438)
        if (x >= panelX && x <= panelX + 200 && y >= 388 && y <= 438) {
            this.drillForSurvival = false;
            this.activateSkill();
            return true;
        }
        // Drill button (Y: 446-496) — already in drill mode
        if (x >= panelX && x <= panelX + 200 && y >= 446 && y <= 496) {
            return true;
        }

        // Board click for drill targets
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.drillTargetTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.useDrill(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handleSkillTargetClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

        // Stone button (Y: 330-380) — cancel skill target
        if (x >= panelX && x <= panelX + 200 && y >= 330 && y <= 380) {
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.placementType = 'stone';
            this.findPlaceableTiles();
            return true;
        }
        // Skill button (Y: 388-438) — cancel skill target, re-activate skill
        if (x >= panelX && x <= panelX + 200 && y >= 388 && y <= 438) {
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.placementType = 'stone';
            this.findPlaceableTiles();
            this.activateSkill();
            return true;
        }
        // Drill button (Y: 446-496) — cancel skill target, switch to drill
        if (x >= panelX && x <= panelX + 200 && y >= 446 && y <= 496) {
            if (this.getCurrentPlayer().isDominated()) return false;
            this.activeSkillType = null;
            this.skillTargetTiles = [];
            this.phase = PHASES.PLACE;
            this.setPlacementType('drill');
            return true;
        }

        // Board click
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        for (const tile of this.skillTargetTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
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

            // Stone button (Y: 330-380)
            if (x >= panelX && x <= panelX + 200 && y >= 330 && y <= 380) {
                this.replayActionMode = 'stone';
                this.clearHighlights();
                this.placementType = 'stone';
                this.findPlaceableTiles();
                return true;
            }
            // Skill button (Y: 388-438)
            if (x >= panelX && x <= panelX + 200 && y >= 388 && y <= 438) {
                this.replayActionMode = 'skill';
                this.computeSkillPreview();
                return true;
            }
            // Drill button (Y: 446-496)
            if (x >= panelX && x <= panelX + 200 && y >= 446 && y <= 496) {
                this.replayActionMode = 'drill';
                this.clearHighlights();
                this.findDrillTargets();
                return true;
            }
        }

        // Control bar at bottom
        const barY = SCREEN_HEIGHT - 55;
        const btnY = barY + 8;
        const btnH = 40;
        const btnW = 55;
        const cx = SCREEN_WIDTH / 2;

        if (y >= btnY && y <= btnY + btnH) {
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
