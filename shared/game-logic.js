// Shared GameLogic Class (used by both server and client)
// Pure game logic only — no animation, no gameLog, no comPlayer, no onlineManager, no UI.
// Requires: shared/constants.js, shared/board.js, shared/player.js

if (typeof require !== 'undefined') {
    if (typeof BOARD_SIZE === 'undefined') {
        const c = require('./constants');
        Object.keys(c).forEach(k => { if (typeof globalThis[k] === 'undefined') globalThis[k] = c[k]; });
    }
    if (typeof globalThis.Board === 'undefined') {
        const b = require('./board');
        globalThis.Board = b.Board;
    }
    if (typeof globalThis.Player === 'undefined') {
        const p = require('./player');
        globalThis.Player = p.Player;
    }
}

class GameLogic {
    constructor(board, player1, player2) {
        this.board = board;
        this.player1 = player1;
        this.player2 = player2;
        this.currentTurn = 1;
        this.diceRoll = 0;
        this.placementType = 'stone';
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.winner = null;
        this.winReason = '';
        this.activeSkillType = null;
        this.movableTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.fallTriggerTiles = [];
        this.warpSelectTiles = [];
        this.kamakuraPatterns = [];
        this.drillForSurvival = false;
        this.stockedThisTurn = false;
    }

    // --- Player Accessors ---

    getCurrentPlayer() {
        return this.currentTurn === 1 ? this.player1 : this.player2;
    }

    getOtherPlayer() {
        return this.currentTurn === 1 ? this.player2 : this.player1;
    }

    // --- Distance Calculations ---

    manhattanDistance(pos1, pos2) {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
    }

    chebyshevDistance(pos1, pos2) {
        return Math.max(Math.abs(pos1.row - pos2.row), Math.abs(pos1.col - pos2.col));
    }

    // --- Board Initialization ---

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

    // --- Dice ---

    generateDiceValue() {
        return Math.floor(Math.random() * 3) + 1;
    }

    /**
     * Roll the dice for the current player.
     * @returns {{ diceValue: number, blocked: boolean, phase: string }}
     *   - diceValue: the rolled value
     *   - blocked: true if the player has no movable tiles (game over triggered)
     *   - phase: the phase to transition to ('move' or 'game_over')
     */
    rollDice() {
        this.moveMode = DIRECTION_TYPE.CROSS;
        const currentPlayer = this.getCurrentPlayer();
        this.diceRoll = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
        const diceValue = this.diceRoll;

        if (!this.hasAnyMovableTile()) {
            this.gameOver(this.currentTurn === 1 ? 2 : 1, 'is blocked and cannot move!');
            return { diceValue, blocked: true, phase: PHASES.GAME_OVER };
        }
        return { diceValue, blocked: false, phase: PHASES.MOVE };
    }

    /**
     * Stock the current dice for later use.
     * @returns {{ success: boolean, storedDice: number|null }}
     */
    stockCurrentDice() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.stock)) {
            return { success: false, storedDice: null };
        }
        currentPlayer.deductPoints(SKILL_COSTS.stock);
        const diceValue = currentPlayer.shiftDiceQueue(() => this.generateDiceValue());
        currentPlayer.stockDice(diceValue);
        this.stockedThisTurn = true;
        return { success: true, storedDice: diceValue };
    }

    /**
     * Use the stocked dice, replacing the current queue head.
     * @returns {{ success: boolean, stockVal: number|null }}
     */
    useStockedDice() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.hasStock()) {
            return { success: false, stockVal: null };
        }
        const stockVal = currentPlayer.useStock();
        currentPlayer.diceQueue[0] = stockVal;
        this.stockedThisTurn = true;
        return { success: true, stockVal };
    }

    // --- Movement ---

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

                // Electromagnet collision
                if (tile === MARKERS.ELECTROMAGNET) {
                    const emOwner = this.board.getElectromagnetOwner(nextPos.row, nextPos.col);
                    if (emOwner !== currentPlayer.playerNum) {
                        if (finalDest) {
                            this.fallTriggerTiles.push({ ...finalDest, dr: dir.dr, dc: dir.dc, electromagnet: true });
                        }
                    } else {
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

                // Warp hole: stop movement here
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

    removeDuplicatePositions(positions) {
        const seen = new Set();
        return positions.filter(pos => {
            const key = `${pos.row},${pos.col}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
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

    /**
     * Toggle between cross and diagonal move mode.
     * @returns {boolean} true if toggled successfully
     */
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

    /**
     * Move the current player to (row, col). Pure logic only — no animation.
     * @returns {{ bombHit: boolean, bombOwner: number|null, fromRow: number, fromCol: number,
     *             directionType: string, diagonalCost: boolean }}
     *   - bombHit: true if player stepped on opponent's bomb (bomb removed, player NOT moved)
     *   - fromRow/fromCol: original position before move
     *   - directionType: which direction type was used
     *   - diagonalCost: true if points were deducted for diagonal move
     */
    movePlayerLogic(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        const tile = this.board.getTile(row, col);
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;

        // Bomb check
        if (tile === MARKERS.BOMB) {
            const bombOwner = this.board.getBombOwner(row, col);
            if (bombOwner !== currentPlayer.playerNum) {
                // Opponent's bomb: remove it, player does NOT move
                this.board.setTile(row, col, MARKERS.EMPTY);
                return {
                    bombHit: true,
                    bombOwner: bombOwner,
                    fromRow, fromCol,
                    directionType: DIRECTION_TYPE.CROSS,
                    diagonalCost: false
                };
            }
            // Own bomb: just remove it and continue
            this.board.setTile(row, col, MARKERS.EMPTY);
        }

        // Determine direction type from the movable/fallTrigger tile data
        const moveTile = this.movableTiles.find(t => t.row === row && t.col === col)
                      || this.fallTriggerTiles.find(t => t.row === row && t.col === col);
        this.lastMoveDirectionType = (moveTile && moveTile.directionType) || DIRECTION_TYPE.CROSS;

        currentPlayer.moveTo(row, col);

        let diagonalCost = false;
        if (this.moveMode === DIRECTION_TYPE.DIAGONAL) {
            currentPlayer.deductPoints(SKILL_COSTS.diagonal_move);
            diagonalCost = true;
        }

        return {
            bombHit: false,
            bombOwner: null,
            fromRow, fromCol,
            directionType: this.lastMoveDirectionType,
            diagonalCost
        };
    }

    /**
     * Complete the move after animation. Handles fountain pickup and warp detection.
     * @param {number} row
     * @param {number} col
     * @returns {{ fountainPickup: boolean, fountainPoints: number, warpLanded: boolean,
     *             warpTargets: Array, phase: string, placeableTiles: Array,
     *             noActions: boolean, drillSurvival: boolean }}
     */
    completeMoveLogic(row, col) {
        const currentPlayer = this.getCurrentPlayer();

        const result = {
            fountainPickup: false,
            fountainPoints: 0,
            warpLanded: false,
            warpTargets: [],
            phase: PHASES.PLACE,
            placeableTiles: [],
            noActions: false,
            drillSurvival: false
        };

        // Fountain tile bonus
        const landedTile = this.board.getTile(row, col);
        if (landedTile === MARKERS.FOUNTAIN) {
            currentPlayer.addPoints(GAME_SETTINGS.fountainPickup);
            this.board.setTile(row, col, MARKERS.EMPTY);
            result.fountainPickup = true;
            result.fountainPoints = GAME_SETTINGS.fountainPickup;
        }

        // Warp hole effect
        if (landedTile === MARKERS.WARP) {
            const otherWarps = this.getOtherWarpHoles(row, col);
            if (otherWarps.length > 0) {
                this.warpSelectTiles = otherWarps;
                result.warpLanded = true;
                result.warpTargets = otherWarps;
                result.phase = PHASES.WARP_SELECT;
                return result;
            }
        }

        // Normal placement phase
        this.placementType = 'stone';
        this.findPlaceableTiles();
        result.placeableTiles = this.placeableTiles;

        // Check if placement phase triggered game over or drill survival
        if (this.winner !== null) {
            result.phase = PHASES.GAME_OVER;
            result.noActions = true;
        } else if (this.drillForSurvival) {
            result.phase = PHASES.DRILL_TARGET;
            result.drillSurvival = true;
        } else {
            result.phase = PHASES.PLACE;
        }

        return result;
    }

    // --- Placement ---

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
                if (tile !== MARKERS.STONE && tile !== MARKERS.SNOW && tile !== MARKERS.ELECTROMAGNET) {
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
                this.findDrillTargets();
            } else if (this.canUseSkillAsAction()) {
                // No placeable tiles but skill is available — stay in place phase
            } else {
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'has no actions available!');
            }
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

    canUseSkillAsAction() {
        const p = this.getCurrentPlayer();
        if (p.isDominated()) return false;
        const skill = p.specialSkill;
        const skillCostMap = {
            [SPECIAL_SKILLS.DOMINATION]: SKILL_COSTS.domination,
            [SPECIAL_SKILLS.SNIPER]: SKILL_COSTS.sniper,
            [SPECIAL_SKILLS.LANDSHARK]: SKILL_COSTS.landshark,
            [SPECIAL_SKILLS.CHECKPOINT]: SKILL_COSTS.checkpoint,
            [SPECIAL_SKILLS.SNEAK]: SKILL_COSTS.sneak,
            [SPECIAL_SKILLS.MOMONGA]: SKILL_COSTS.momonga,
            [SPECIAL_SKILLS.METEOR]: SKILL_COSTS.meteor,
            [SPECIAL_SKILLS.KAMAKURA]: SKILL_COSTS.kamakura,
        };
        if (!(skill in skillCostMap)) return false;
        return p.canAfford(skillCostMap[skill]);
    }

    /**
     * Place an object at (row, col). Calls endTurn() on success.
     */
    placeObject(row, col) {
        const currentPlayer = this.getCurrentPlayer();

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
        } else if (this.placementType === 'electromagnet') {
            if (currentPlayer.deductPoints(SKILL_COSTS.electromagnet)) {
                this.board.setElectromagnet(row, col, currentPlayer.playerNum);
                this.endTurn();
            }
        }
    }

    /**
     * Set the placement type and compute targets.
     * @returns {{ success: boolean, phase: string }}
     */
    setPlacementType(type) {
        const currentPlayer = this.getCurrentPlayer();
        const cost = SKILL_COSTS[type];

        if (cost !== undefined && !currentPlayer.canAfford(cost)) {
            return { success: false, phase: null };
        }

        this.placementType = type;

        if (type === 'drill') {
            this.findDrillTargets();
            if (this.drillTargetTiles.length === 0) {
                this.placementType = 'stone';
                this.findPlaceableTiles();
                return { success: false, phase: PHASES.PLACE };
            }
            return { success: true, phase: PHASES.DRILL_TARGET };
        } else {
            this.findPlaceableTiles();
            return { success: true, phase: PHASES.PLACE };
        }
    }

    // --- Drill ---

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
                if (t === MARKERS.STONE || t === MARKERS.ELECTROMAGNET || t === MARKERS.SNOW) {
                    this.drillTargetTiles.push({ row: r, col: c });
                }
            }
        }
    }

    /**
     * Use drill on (row, col). Calls endTurn() on success.
     */
    useDrill(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer.deductPoints(SKILL_COSTS.drill)) {
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

    // --- Skills ---

    /**
     * Activate the current player's special skill. Dispatcher.
     * @returns {boolean|object} false if cannot activate, true or result object if activated
     */
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
            case SPECIAL_SKILLS.LANDSHARK:
                return this.activateLandshark();
            case SPECIAL_SKILLS.SNEAK:
                return this.activateSneak();
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

    /**
     * Use domination skill. No animation — just applies the effect.
     * @returns {{ success: boolean, targetPlayerNum: number|null }}
     */
    useDomination() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.domination)) return { success: false, targetPlayerNum: null };
        currentPlayer.deductPoints(SKILL_COSTS.domination);
        const otherPlayer = this.getOtherPlayer();
        otherPlayer.dominationTurnsLeft = 1;
        return {
            success: true,
            targetPlayerNum: otherPlayer.playerNum,
            targetPos: { row: otherPlayer.row, col: otherPlayer.col }
        };
    }

    /**
     * Use checkpoint skill (place or teleport). No animation.
     * @returns {{ success: boolean, mode: string|null, fromRow: number, fromCol: number,
     *             toRow: number, toCol: number, destroyedStones: Array }}
     */
    useCheckpoint() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.checkpoint)) {
            return { success: false, mode: null };
        }

        if (currentPlayer.hasCheckpoint()) {
            // Teleport mode
            const cp = currentPlayer.getCheckpoint();
            const otherPos = this.getOtherPlayer().getPosition();
            if (cp.row === otherPos.row && cp.col === otherPos.col) {
                return { success: false, mode: null };
            }
            currentPlayer.deductPoints(SKILL_COSTS.checkpoint);
            const fromRow = currentPlayer.row;
            const fromCol = currentPlayer.col;
            currentPlayer.moveTo(cp.row, cp.col);
            // Destroy surrounding 4-direction stones at checkpoint on teleport
            const destroyedStones = [];
            for (const dir of CROSS_DIRECTIONS) {
                const r = cp.row + dir.dr;
                const c = cp.col + dir.dc;
                if (this.board.isValidPosition(r, c) &&
                    this.board.getTile(r, c) === MARKERS.STONE) {
                    this.board.setTile(r, c, MARKERS.EMPTY);
                    destroyedStones.push({ row: r, col: c });
                }
            }
            this.endTurn();
            return {
                success: true,
                mode: 'teleport',
                fromRow, fromCol,
                toRow: cp.row, toCol: cp.col,
                destroyedStones
            };
        } else {
            // Place mode
            const pos = currentPlayer.getPosition();
            currentPlayer.deductPoints(SKILL_COSTS.checkpoint);
            this.board.setCheckpoint(pos.row, pos.col, currentPlayer.playerNum);
            currentPlayer.setCheckpoint(pos.row, pos.col);
            // Destroy surrounding 4-direction stones
            const destroyedStones = [];
            for (const dir of CROSS_DIRECTIONS) {
                const r = pos.row + dir.dr;
                const c = pos.col + dir.dc;
                if (this.board.isValidPosition(r, c) &&
                    this.board.getTile(r, c) === MARKERS.STONE) {
                    this.board.setTile(r, c, MARKERS.EMPTY);
                    destroyedStones.push({ row: r, col: c });
                }
            }
            this.endTurn();
            return {
                success: true,
                mode: 'place',
                fromRow: pos.row, fromCol: pos.col,
                toRow: pos.row, toCol: pos.col,
                destroyedStones
            };
        }
    }

    /**
     * Activate sniper skill. Condition check and point deduction only.
     * @returns {{ success: boolean, fromPos: object|null, toPos: object|null }}
     */
    activateSniper() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.sniper)) return { success: false };
        if (!this.checkSniperCondition()) return { success: false };
        currentPlayer.deductPoints(SKILL_COSTS.sniper);
        const pPos = currentPlayer.getPosition();
        const oPos = this.getOtherPlayer().getPosition();
        // Game over is triggered after animation in the client
        // For server, trigger it immediately
        this.gameOver(this.currentTurn, 'was sniped!');
        return {
            success: true,
            fromPos: { row: pPos.row, col: pPos.col },
            toPos: { row: oPos.row, col: oPos.col }
        };
    }

    /**
     * Activate landshark skill.
     * @returns {boolean}
     */
    activateLandshark() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.landshark)) return false;
        if (!this.checkLandsharkCondition()) return false;
        currentPlayer.deductPoints(SKILL_COSTS.landshark);
        this.gameOver(this.currentTurn, 'slashed the opponent!');
        return true;
    }

    /**
     * Activate sneak skill. Sets up skill target tiles.
     * @returns {{ success: boolean, phase: string|null, targets: Array }}
     */
    activateSneak() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.sneak)) return { success: false, phase: null, targets: [] };

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
        if (this.skillTargetTiles.length === 0) return { success: false, phase: null, targets: [] };
        this.activeSkillType = SPECIAL_SKILLS.SNEAK;
        return { success: true, phase: PHASES.SKILL_TARGET, targets: this.skillTargetTiles };
    }

    /**
     * Execute sneak move. Moves player, deducts points, calls endTurn.
     */
    executeSneak(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.sneak);
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        this.endTurn();
    }

    /**
     * Activate meteor skill. Sets up skill target tiles.
     * @returns {{ success: boolean, phase: string|null, targets: Array }}
     */
    activateMeteor() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.meteor)) return { success: false, phase: null, targets: [] };

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
        if (this.skillTargetTiles.length === 0) return { success: false, phase: null, targets: [] };
        this.activeSkillType = SPECIAL_SKILLS.METEOR;
        return { success: true, phase: PHASES.SKILL_TARGET, targets: this.skillTargetTiles };
    }

    /**
     * Execute meteor. Places stone at target, deducts points.
     * Does NOT call endTurn — the client handles it after animation.
     * @returns {{ row: number, col: number }}
     */
    executeMeteor(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.meteor);
        // The actual stone placement happens after animation in client.
        // For server logic, place immediately.
        this.board.setTile(row, col, MARKERS.STONE);
        this.endTurn();
        return { row, col };
    }

    /**
     * Activate momonga skill. Sets up skill target tiles.
     * @returns {{ success: boolean, phase: string|null, targets: Array }}
     */
    activateMomonga() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.momonga)) return { success: false, phase: null, targets: [] };

        const nearestStones = this.findNearestStones();
        if (nearestStones.length === 0) return { success: false, phase: null, targets: [] };

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
        if (this.skillTargetTiles.length === 0) return { success: false, phase: null, targets: [] };
        this.activeSkillType = SPECIAL_SKILLS.MOMONGA;
        return { success: true, phase: PHASES.SKILL_TARGET, targets: this.skillTargetTiles };
    }

    /**
     * Execute momonga move. Moves player, deducts points, calls endTurn.
     */
    executeMomonga(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.momonga);
        const fromRow = currentPlayer.row;
        const fromCol = currentPlayer.col;
        currentPlayer.moveTo(row, col);
        this.endTurn();
    }

    /**
     * Activate kamakura skill. Sets up patterns and skill target tiles.
     * @returns {{ success: boolean, phase: string|null, patterns: Array, targets: Array }}
     */
    activateKamakura() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.canAfford(SKILL_COSTS.kamakura)) return { success: false, phase: null, patterns: [], targets: [] };
        const patterns = this.findKamakuraPatterns();
        if (patterns.length === 0) return { success: false, phase: null, patterns: [], targets: [] };
        this.kamakuraPatterns = patterns;
        this.skillTargetTiles = patterns.map(p => ({ row: p.middle.row, col: p.middle.col }));
        this.activeSkillType = SPECIAL_SKILLS.KAMAKURA;
        return { success: true, phase: PHASES.SKILL_TARGET, patterns, targets: this.skillTargetTiles };
    }

    /**
     * Execute kamakura. Converts stones to snow, deducts points, calls endTurn.
     */
    executeKamakura(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.deductPoints(SKILL_COSTS.kamakura);
        const pattern = this.kamakuraPatterns.find(
            p => p.middle.row === row && p.middle.col === col
        );
        if (pattern) {
            for (const s of pattern.stones) {
                this.board.setSnow(s.row, s.col, 2);
            }
        }
        this.kamakuraPatterns = [];
        this.endTurn();
    }

    /**
     * Dispatch skill target execution.
     */
    executeSkillTarget(row, col) {
        switch (this.activeSkillType) {
            case SPECIAL_SKILLS.MOMONGA:
                this.executeMomonga(row, col);
                break;
            case SPECIAL_SKILLS.SNEAK:
                this.executeSneak(row, col);
                break;
            case SPECIAL_SKILLS.KAMAKURA:
                this.executeKamakura(row, col);
                break;
            case SPECIAL_SKILLS.METEOR:
                this.executeMeteor(row, col);
                break;
        }
    }

    // --- Skill Condition Checks (pure) ---

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

    checkLandsharkCondition() {
        const currentPlayer = this.getCurrentPlayer();
        const otherPlayer = this.getOtherPlayer();
        const pPos = currentPlayer.getPosition();
        const oPos = otherPlayer.getPosition();

        for (const dir of CROSS_DIRECTIONS) {
            if (pPos.row + dir.dr === oPos.row && pPos.col + dir.dc === oPos.col) return true;
        }
        return false;
    }

    // --- Turn Management ---

    /**
     * End the current turn. Pure logic only:
     * - Decrease domination timer
     * - Tick snow
     * - Switch turn
     * - Award turn bonus points
     * - Reset phase to ROLL
     */
    endTurn() {
        const oldPlayer = this.getCurrentPlayer();
        if (oldPlayer.dominationTurnsLeft > 0) {
            oldPlayer.dominationTurnsLeft--;
        }

        // Tick snow timers
        this.board.tickSnow();

        this.currentTurn = this.currentTurn === 1 ? 2 : 1;

        const newPlayer = this.getCurrentPlayer();
        newPlayer.addPoints(GAME_SETTINGS.turnBonus);

        this.diceRoll = 0;
        this.stockedThisTurn = false;
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
        this.skillTargetTiles = [];
        this.warpSelectTiles = [];
        this.activeSkillType = null;
        this.kamakuraPatterns = [];
    }

    /**
     * Set game over state.
     * @param {number} winner - Player number who won (1 or 2)
     * @param {string} reason - Reason for game over
     */
    gameOver(winner, reason) {
        if (this.winner === null) {
            this.winner = winner;
            this.winReason = reason;
        }
    }

    // --- Warp ---

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

    /**
     * Complete warp teleportation. Moves player, no animation.
     */
    completeWarpLogic(row, col) {
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.moveTo(row, col);
    }
}

// Export for Node.js, no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
}
