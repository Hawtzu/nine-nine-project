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
        this.winner = null;
        this.winReason = '';
        this.lastMoveDirectionType = DIRECTION_TYPE.CROSS;
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.diceQueue = [];
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
        this.diceQueue = [
            this.generateDiceValue(),
            this.generateDiceValue(),
            this.generateDiceValue()
        ];
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

        // 両者が選択完了したらゲーム開始
        if (this.player1.skillConfirmed && this.player2.skillConfirmed) {
            this.setupInitialBoard();
            this.phase = PHASES.ROLL;
        }
    }

    setupInitialBoard() {
        // Place recovery tiles (fountains) for each player
        const p1FountainPos = this.findValidFountainPosition(1);
        const p2FountainPos = this.findValidFountainPosition(2);

        this.board.setTile(p1FountainPos.row, p1FountainPos.col, MARKERS.RECOVERY);
        this.board.setTile(p2FountainPos.row, p2FountainPos.col, MARKERS.RECOVERY);

        // Place 3 random stones
        const bannedPositions = this.getBannedPositions(p1FountainPos, p2FountainPos);
        const stonePositions = this.getRandomPositions(3, bannedPositions);
        for (const pos of stonePositions) {
            this.board.setTile(pos.row, pos.col, MARKERS.STONE);
        }

        // Determine first player based on fountain distance
        const dist1 = this.manhattanDistance(this.player1.getPosition(), p1FountainPos);
        const dist2 = this.manhattanDistance(this.player2.getPosition(), p2FountainPos);
        this.currentTurn = dist1 > dist2 ? 1 : dist2 > dist1 ? 2 : Math.random() < 0.5 ? 1 : 2;
    }

    findValidFountainPosition(playerNum) {
        const playerPos = playerNum === 1 ? this.player1.getPosition() : this.player2.getPosition();
        const zone = [];

        if (playerNum === 1) {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < Math.floor(BOARD_SIZE / 2) - 1; c++) {
                    if (this.manhattanDistance(playerPos, { row: r, col: c }) > 3) {
                        zone.push({ row: r, col: c });
                    }
                }
            }
        } else {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = Math.floor(BOARD_SIZE / 2) + 2; c < BOARD_SIZE; c++) {
                    if (this.manhattanDistance(playerPos, { row: r, col: c }) > 3) {
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

    hasAnyMovableTile() {
        // 十字・斜め両方を確認して、どちらかで移動可能かチェック
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

        // 元のモードに戻してハイライトを再計算
        this.moveMode = savedMode;
        this.findMovableTiles();
        return true;
    }

    rollDice() {
        this.moveMode = DIRECTION_TYPE.CROSS;
        this.diceRoll = this.diceQueue.shift();
        this.diceQueue.push(this.generateDiceValue());
        if (!this.hasAnyMovableTile()) {
            this.gameOver(this.currentTurn === 1 ? 2 : 1, 'is blocked and cannot move!');
        } else {
            this.phase = PHASES.MOVE;
        }
    }

    stockCurrentDice() {
        const currentPlayer = this.getCurrentPlayer();
        const diceValue = this.diceQueue.shift();
        currentPlayer.stockDice(diceValue);
        this.diceQueue.push(this.generateDiceValue());
        // ストック後も通常通りロールして移動する
        this.rollDice();
    }

    useStockedDice() {
        this.moveMode = DIRECTION_TYPE.CROSS;
        const currentPlayer = this.getCurrentPlayer();
        this.diceRoll = currentPlayer.useStock();
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

                // Check if out of bounds
                if (!this.board.isValidPosition(nextPos.row, nextPos.col)) {
                    if (finalDest) {
                        this.fallTriggerTiles.push(finalDest);
                    }
                    break;
                }

                // Check for obstacles
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

                // Ice tile extends movement
                const iceKey = `${nextPos.row},${nextPos.col}`;
                if (tile === MARKERS.ICE && !visitedIce.has(iceKey)) {
                    steps++;
                    visitedIce.add(iceKey);
                }

                step++;
            }

            // If we completed all steps without hitting anything
            if (step > steps && finalDest) {
                this.movableTiles.push(finalDest);
            }
        }

        // Remove duplicates (first hit wins)
        this.movableTiles = this.removeDuplicatePositions(this.movableTiles);
        this.fallTriggerTiles = this.removeDuplicatePositions(this.fallTriggerTiles);
    }

    toggleMoveMode() {
        const currentPlayer = this.getCurrentPlayer();
        if (this.moveMode === DIRECTION_TYPE.CROSS) {
            // 斜めモードに切替: ポイント不足なら切替不可
            if (!currentPlayer.canAfford(SKILL_COSTS.diagonal_move)) {
                return false;
            }
            this.moveMode = DIRECTION_TYPE.DIAGONAL;
        } else {
            this.moveMode = DIRECTION_TYPE.CROSS;
        }
        this.findMovableTiles();
        // 切替後に移動先がない場合はゲームオーバーチェック不要（元に戻せるため）
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

        // Check for bomb - only kills players who didn't place it
        if (tile === MARKERS.BOMB) {
            const bombOwner = this.board.getBombOwner(row, col);
            if (bombOwner !== currentPlayer.playerNum) {
                // Stepped on opponent's bomb → lose
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'stepped on a bomb!');
                return;
            }
            // Own bomb → safe, remove the bomb
            this.board.setTile(row, col, MARKERS.EMPTY);
        }

        // Save direction type from the selected move tile
        const moveTile = this.movableTiles.find(t => t.row === row && t.col === col)
                      || this.fallTriggerTiles.find(t => t.row === row && t.col === col);
        this.lastMoveDirectionType = (moveTile && moveTile.directionType) || DIRECTION_TYPE.CROSS;

        currentPlayer.moveTo(row, col);

        // 斜め移動コスト
        if (this.moveMode === DIRECTION_TYPE.DIAGONAL) {
            currentPlayer.deductPoints(SKILL_COSTS.diagonal_move);
        }

        // Recovery tile bonus
        if (tile === MARKERS.RECOVERY) {
            currentPlayer.addPoints(20);
        }

        this.phase = PHASES.PLACE;
        this.placementType = 'stone';
        this.clearHighlights();
        this.findPlaceableTiles();
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
            } else if (['recovery', 'bomb', 'ice'].includes(this.placementType)) {
                if (tile === MARKERS.EMPTY) {
                    this.placeableTiles.push({ row: r, col: c });
                }
            }
        }

        if (this.placeableTiles.length === 0 && this.winner === null) {
            this.gameOver(this.currentTurn === 1 ? 2 : 1, 'has no place to put an object!');
        }
    }

    placeObject(row, col) {
        const currentPlayer = this.getCurrentPlayer();

        if (this.placementType === 'stone') {
            this.board.setTile(row, col, MARKERS.STONE);
            // TODO: Check figure bonus
            this.endTurn();
        } else if (this.placementType === 'bomb') {
            const cost = SKILL_COSTS.bomb;
            if (currentPlayer.deductPoints(cost)) {
                this.board.setBomb(row, col, currentPlayer.playerNum);
                this.endTurn();
            }
        } else {
            const cost = SKILL_COSTS[this.placementType];
            if (currentPlayer.deductPoints(cost)) {
                const markerMap = {
                    recovery: MARKERS.RECOVERY,
                    ice: MARKERS.ICE
                };
                this.board.setTile(row, col, markerMap[this.placementType]);
                this.endTurn();
            }
        }
    }

    setPlacementType(type) {
        const currentPlayer = this.getCurrentPlayer();
        const cost = SKILL_COSTS[type];

        // 氷スキルは持っているプレイヤーのみ使用可能
        if (type === 'ice' && !currentPlayer.hasSkill(SPECIAL_SKILLS.ICE)) {
            return false;
        }

        // 爆弾スキルは持っているプレイヤーのみ使用可能
        if (type === 'bomb' && !currentPlayer.hasSkill(SPECIAL_SKILLS.BOMB)) {
            return false;
        }

        if (cost !== undefined && !currentPlayer.canAfford(cost)) {
            return false;
        }

        this.placementType = type;

        if (type === 'drill') {
            this.phase = PHASES.DRILL_TARGET;
            this.findDrillTargets();
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
            this.endTurn();
        }
    }

    endTurn() {
        const oldTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === 1 ? 2 : 1;

        // Turn start bonus
        this.getCurrentPlayer().addPoints(10);

        this.phase = PHASES.ROLL;
        this.diceRoll = 0;
        this.clearHighlights();
    }

    clearHighlights() {
        this.movableTiles = [];
        this.fallTriggerTiles = [];
        this.placeableTiles = [];
        this.drillTargetTiles = [];
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

    handleClick(x, y) {
        switch (this.phase) {
            case PHASES.START_SCREEN:
                return this.handleStartScreenClick(x, y);
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
            case PHASES.GAME_OVER:
                return this.handleGameOverClick(x, y);
        }
    }

    handleSkillSelectionClick(x, y) {
        // Player 1 panel (left side)
        if (x >= 20 && x <= PANEL_WIDTH - 20) {
            if (!this.player1.skillConfirmed) {
                // Ice skill button (Y: 250-370)
                if (y >= 250 && y <= 370) {
                    this.selectSkill(1, SPECIAL_SKILLS.ICE);
                    return true;
                }
                // Bomb skill button (Y: 390-510)
                if (y >= 390 && y <= 510) {
                    this.selectSkill(1, SPECIAL_SKILLS.BOMB);
                    return true;
                }
            }
        }

        // Player 2 panel (right side)
        if (x >= SCREEN_WIDTH - PANEL_WIDTH + 20 && x <= SCREEN_WIDTH - 20) {
            if (!this.player2.skillConfirmed) {
                // Ice skill button (Y: 250-370)
                if (y >= 250 && y <= 370) {
                    this.selectSkill(2, SPECIAL_SKILLS.ICE);
                    return true;
                }
                // Bomb skill button (Y: 390-510)
                if (y >= 390 && y <= 510) {
                    this.selectSkill(2, SPECIAL_SKILLS.BOMB);
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
        // PvA button (disabled - Coming Soon)
        // if (x >= SCREEN_WIDTH / 2 - 150 && x <= SCREEN_WIDTH / 2 + 150 &&
        //     y >= 470 && y <= 550) {
        //     this.startGame('pva');
        //     return true;
        // }
        return false;
    }

    handleRollPhaseClick(x, y) {
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
        const currentPlayer = this.getCurrentPlayer();

        if (currentPlayer.hasStock()) {
            // Roll Dice button (Y: 320-370)
            if (x >= panelX && x <= panelX + 200 && y >= 320 && y <= 370) {
                this.rollDice();
                return true;
            }
            // Use Stock button (Y: 378-428)
            if (x >= panelX && x <= panelX + 200 && y >= 378 && y <= 428) {
                this.useStockedDice();
                return true;
            }
        } else {
            // Roll Dice button (Y: 320-370)
            if (x >= panelX && x <= panelX + 200 && y >= 320 && y <= 370) {
                this.rollDice();
                return true;
            }
            // Stock button (Y: 378-428)
            if (x >= panelX && x <= panelX + 200 && y >= 378 && y <= 428) {
                this.stockCurrentDice();
                return true;
            }
        }
        return false;
    }

    handleMovePhaseClick(x, y) {
        const clickedCell = this.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        // 自分のコマクリックで移動モード切替
        const currentPlayer = this.getCurrentPlayer();
        const playerPos = currentPlayer.getPosition();
        if (clickedCell.row === playerPos.row && clickedCell.col === playerPos.col) {
            this.toggleMoveMode();
            return true;
        }

        // Check fall trigger tiles
        for (const tile of this.fallTriggerTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.gameOver(this.currentTurn === 1 ? 2 : 1, 'fell off the cliff!');
                return true;
            }
        }

        // Check movable tiles
        for (const tile of this.movableTiles) {
            if (tile.row === clickedCell.row && tile.col === clickedCell.col) {
                this.movePlayer(clickedCell.row, clickedCell.col);
                return true;
            }
        }

        return false;
    }

    handlePlacePhaseClick(x, y) {
        // Check placement type buttons first
        const panelX = this.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
        const currentPlayer = this.getCurrentPlayer();

        // Stone button (Y: 300-350)
        if (x >= panelX && x <= panelX + 200 && y >= 300 && y <= 350) {
            this.setPlacementType('stone');
            return true;
        }
        // Recovery button (Y: 358-408)
        if (x >= panelX && x <= panelX + 200 && y >= 358 && y <= 408) {
            this.setPlacementType('recovery');
            return true;
        }

        // Dynamic skill buttons (Ice/Bomb) + Drill
        let nextY = 416;

        // Ice button (only if player has ice skill)
        if (currentPlayer.hasSkill(SPECIAL_SKILLS.ICE)) {
            if (x >= panelX && x <= panelX + 200 && y >= nextY && y <= nextY + 50) {
                this.setPlacementType('ice');
                return true;
            }
            nextY += 58;
        }

        // Bomb button (only if player has bomb skill)
        if (currentPlayer.hasSkill(SPECIAL_SKILLS.BOMB)) {
            if (x >= panelX && x <= panelX + 200 && y >= nextY && y <= nextY + 50) {
                this.setPlacementType('bomb');
                return true;
            }
            nextY += 58;
        }

        // Drill button
        if (x >= panelX && x <= panelX + 200 && y >= nextY && y <= nextY + 50) {
            this.setPlacementType('drill');
            return true;
        }

        // Check board click
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

    handleGameOverClick(x, y) {
        // Main Menu button
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
