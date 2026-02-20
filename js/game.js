// Game State Management Class
class Game {
    constructor() {
        this.board = new Board();
        this.player1 = null;
        this.player2 = null;
        this.currentTurn = 1;
        this.phase = PHASES.START_SCREEN;
        this.gameMode = null; // 'pvp' or 'pva'
        this.diceRoll = 0;
        this.placementType = 'stone';
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.activeSkillType = null;
        this.winner = null;
        this.winReason = '';
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.sniperAnimating = false;
        this.sniperAnimStart = 0;
        this.hoveredSkill = null; // skill key hovered in selection screen
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
        this.winReason = '';
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.drillForSurvival = false;
        this.skillTargetTiles = [];
        this.activeSkillType = null;
        this.sniperAnimating = false;
        this.sniperAnimStart = 0;
        const gen = () => this.generateDiceValue();
        this.player1.initDiceQueue(gen);
        this.player2.initDiceQueue(gen);
        this.clearHighlights();
    }

    startGame(mode) {
        this.gameMode = mode;
        this.init();
        this.phase = PHASES.SKILL_SELECTION;
    }

    selectSkill(playerNum, skill) {
        const player = playerNum === 1 ? this.player1 : this.player2;
        if (!player.skillConfirmed) {
            player.setSpecialSkill(skill);
        }

        if (this.player1.skillConfirmed && this.player2.skillConfirmed) {
            this.setupInitialBoard();
            this.phase = PHASES.ROLL;
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
        this.diceRoll = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
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
        currentPlayer.deductPoints(SKILL_COSTS.stock);
        const diceValue = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
        currentPlayer.stockDice(diceValue);
        this.rollDice();
        return true;
    }

    useStockedDice() {
        this.moveMode = DIRECTION_TYPE.CROSS;
        const currentPlayer = this.getCurrentPlayer();
        // CURRENTをStock値に置き換え、ストック消費
        currentPlayer.diceQueue[0] = currentPlayer.useStock();
        // そのCURRENTでRoll（shiftしてMOVEへ）
        this.diceRoll = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
        if (!this.hasAnyMovableTile()) {
            this.gameOver(this.currentTurn === 1 ? 2 : 1, 'is blocked and cannot move!');
        } else {
            this.phase = PHASES.MOVE;
        }
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
            const visitedIce = new Set();
            let step = 1;

            while (step <= steps) {
                const nextPos = {
                    row: currentPos.row + dir.dr,
                    col: currentPos.col + dir.dc
                };

                if (!this.board.isValidPosition(nextPos.row, nextPos.col)) {
                    if (finalDest) {
                        this.fallTriggerTiles.push(finalDest);
                    }
                    break;
                }

                const tile = this.board.getTile(nextPos.row, nextPos.col);
                if (tile === MARKERS.STONE ||
                    (nextPos.row === otherPos.row && nextPos.col === otherPos.col)) {
                    if (finalDest) {
                        this.movableTiles.push(finalDest);
                    }
                    break;
                }

                finalDest = { row: nextPos.row, col: nextPos.col, directionType: dir.type };
                currentPos = nextPos;

                const iceKey = `${nextPos.row},${nextPos.col}`;
                if (tile === MARKERS.ICE && !visitedIce.has(iceKey)) {
                    steps++;
                    visitedIce.add(iceKey);
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

        currentPlayer.moveTo(row, col);

        if (this.moveMode === DIRECTION_TYPE.DIAGONAL) {
            currentPlayer.deductPoints(SKILL_COSTS.diagonal_move);
        }

        // Fountain tile bonus (one-time: consume tile)
        const landedTile = this.board.getTile(row, col);
        if (landedTile === MARKERS.FOUNTAIN) {
            currentPlayer.addPoints(GAME_SETTINGS.fountainPickup);
            this.board.setTile(row, col, MARKERS.EMPTY);
        }

        this.phase = PHASES.PLACE;
        this.placementType = 'stone';
        this.clearHighlights();
        this.findPlaceableTiles();
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
                if (tile !== MARKERS.STONE) {
                    this.placeableTiles.push({ row: r, col: c });
                }
            } else if (['bomb', 'ice'].includes(this.placementType)) {
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

        if (this.placementType === 'stone') {
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
        }
        return false;
    }

    useDomination() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.domination)) return false;
        currentPlayer.deductPoints(SKILL_COSTS.domination);
        const otherPlayer = this.getOtherPlayer();
        otherPlayer.dominationTurnsLeft = 3;
        this.endTurn();
        return true;
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
            if (this.board.getTile(r, c) === MARKERS.STONE) return false;
        }
        return true;
    }

    activateSniper() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.sniper)) return false;
        if (!this.checkSniperCondition()) return false;
        currentPlayer.deductPoints(SKILL_COSTS.sniper);
        // Start sniper animation instead of immediate game over
        this.sniperAnimating = true;
        this.sniperAnimStart = Date.now();
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
            if (this.board.getTile(r, c) === MARKERS.STONE) continue;
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
        currentPlayer.moveTo(row, col);
        this.endTurn();
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
                if (this.board.getTile(r, c) === MARKERS.STONE) continue;
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
        currentPlayer.moveTo(row, col);
        this.endTurn();
    }

    // --- Turn Management ---

    endTurn() {
        const oldPlayer = this.getCurrentPlayer();
        if (oldPlayer.dominationTurnsLeft > 0) {
            oldPlayer.dominationTurnsLeft--;
        }

        this.currentTurn = this.currentTurn === 1 ? 2 : 1;

        const newPlayer = this.getCurrentPlayer();
        newPlayer.addPoints(GAME_SETTINGS.turnBonus);

        this.phase = PHASES.ROLL;
        this.diceRoll = 0;
        this.clearHighlights();
    }

    clearHighlights() {
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.activeSkillType = null;
    }

    gameOver(winner, reason) {
        if (this.winner === null) {
            const loser = winner === 1 ? 2 : 1;
            this.winner = winner;
            this.winReason = `Player ${loser} ${reason}`;
            this.phase = PHASES.GAME_OVER;
        }
    }

    getCurrentPlayer() {
        return this.currentTurn === 1 ? this.player1 : this.player2;
    }

    getOtherPlayer() {
        return this.currentTurn === 1 ? this.player2 : this.player1;
    }

    // --- Click Handlers ---

    handleClick(x, y) {
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
            case PHASES.GAME_OVER:
                return this.handleGameOverClick(x, y);
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

        // Player 2 panel (right side)
        if (!this.player2.skillConfirmed) {
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
        // PvP button
        if (x >= SCREEN_WIDTH / 2 - 150 && x <= SCREEN_WIDTH / 2 + 150 &&
            y >= 350 && y <= 430) {
            this.startGame('pvp');
            return true;
        }
        // Developer Settings gear icon
        if (x >= SCREEN_WIDTH / 2 + 187 && x <= SCREEN_WIDTH / 2 + 223 &&
            y >= 372 && y <= 408) {
            this.phase = PHASES.SETTINGS;
            return true;
        }
        return false;
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

        for (const tile of this.fallTriggerTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'fell off the cliff!');
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
                }
                return true;
            }
        }

        return false;
    }

    handleGameOverClick(x, y) {
        if (x >= SCREEN_WIDTH / 2 - 110 && x <= SCREEN_WIDTH / 2 + 110 &&
            y >= SCREEN_HEIGHT / 2 + 50 && y <= SCREEN_HEIGHT / 2 + 120) {
            this.phase = PHASES.START_SCREEN;
            return true;
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
