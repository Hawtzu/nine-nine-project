// Interactive Tutorial - Guided gameplay tutorial
// Provides step-by-step guided gameplay on a fixed board layout

class InteractiveTutorial {
    constructor() {
        this.step = 0;
        this.totalSteps = 7; // Steps 0-6
        this.active = false;
        this.guideText = '';
        this.guideSubText = '';
        this.highlightTargets = []; // [{type:'button'|'cell'|'screen', x,y,w,h}]
        this.dimOverlay = true;
        this.waitingForAnimation = false;
        this.subPhase = 'intro'; // 'intro','roll','move','place','opponent','roll2','move2','place2','complete'
        this.autoTimer = null;
        this.completionButtons = []; // buttons shown at completion
    }

    start(game) {
        this.active = true;
        this.step = 0;
        this.subPhase = 'intro';
        this.waitingForAnimation = false;
        this.completionButtons = [];

        // Initialize game state for tutorial
        game.board.reset();
        game.player1 = new Player(1, 4, 0);
        game.player2 = new Player(2, 4, 8);
        game.player1.color = COLORS.P1;
        game.player2.color = COLORS.P2;

        // Fixed dice queues: P1 always gets 2, P2 always gets 1
        game.player1.initDiceQueue(() => 2);
        game.player2.initDiceQueue(() => 1);

        // Place stones and fountains
        game.board.setTile(4, 3, MARKERS.STONE);
        game.board.setTile(3, 2, MARKERS.STONE);
        game.board.setTile(5, 6, MARKERS.STONE);
        game.board.setTile(2, 1, MARKERS.FOUNTAIN);
        game.board.setTile(6, 7, MARKERS.FOUNTAIN);

        game.currentTurn = 1;
        game.diceRoll = 0;
        game.phase = PHASES.INTERACTIVE_TUTORIAL;
        game.gameMode = 'tutorial';
        game.winner = null;
        game.winReason = '';
        game.clearHighlights();
        game.moveMode = DIRECTION_TYPE.CROSS;
        game.placementType = 'stone';
        game.stockedThisTurn = false;

        // Reset animations
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.reset();
        }

        this.setupStep(game);
    }

    setupStep(game) {
        this.highlightTargets = [];
        this.completionButtons = [];

        switch (this.step) {
            case 0: // Intro
                this.subPhase = 'intro';
                this.guideText = 'ゲームの基本を学びましょう！';
                this.guideSubText = 'クリックして始めます';
                this.highlightTargets = [{ type: 'screen' }];
                break;

            case 1: // Roll phase - click Select
                this.subPhase = 'roll';
                this.guideText = 'Selectボタンを押してサイコロを振ろう';
                this.guideSubText = 'サイコロキューの先頭の値が使われます';
                // Select button for P1: panelX=40, y=385, w=200, h=50
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 385, w: 200, h: 50
                }];
                break;

            case 2: // Move phase
                this.subPhase = 'move';
                this.guideText = '光っているマスに移動できます';
                this.guideSubText = 'サイコロの目(2)の分だけ進めます。石があると止まります';
                // Highlight movable tiles (will be set after findMovableTiles)
                this._setMovableHighlights(game);
                break;

            case 3: // Place phase
                this.subPhase = 'place';
                this.guideText = '隣接するマスに石を配置しよう';
                this.guideSubText = '石で相手の移動を妨害できます';
                this._setPlaceableHighlights(game);
                break;

            case 4: // Opponent's turn (auto)
                this.subPhase = 'opponent';
                this.guideText = '相手のターンです';
                this.guideSubText = '自動で実行されます';
                this.highlightTargets = [];
                this.dimOverlay = true;
                // Auto-execute opponent's turn after 1.5s
                this.autoTimer = setTimeout(() => {
                    this._executeOpponentTurn(game);
                }, 1500);
                break;

            case 5: // Second turn - Roll
                this.subPhase = 'roll2';
                this.guideText = 'もう一度Selectを押そう';
                this.guideSubText = 'サイコロキューの仕組み: USE→CURRENT→NEXTの順に進みます';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 385, w: 200, h: 50
                }];
                break;

            case 6: // Completion
                this.subPhase = 'complete';
                this.guideText = 'チュートリアル完了！';
                this.guideSubText = 'さっそくゲームを始めよう';
                this.highlightTargets = [];
                this._setupCompletionButtons();
                break;
        }
    }

    _setMovableHighlights(game) {
        this.highlightTargets = [];
        for (const tile of game.movableTiles) {
            this.highlightTargets.push({
                type: 'cell',
                row: tile.row,
                col: tile.col,
                x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                w: CELL_SIZE,
                h: CELL_SIZE
            });
        }
        for (const tile of game.fallTriggerTiles) {
            this.highlightTargets.push({
                type: 'cell',
                row: tile.row,
                col: tile.col,
                x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                w: CELL_SIZE,
                h: CELL_SIZE
            });
        }
    }

    _setPlaceableHighlights(game) {
        this.highlightTargets = [];
        for (const tile of game.placeableTiles) {
            this.highlightTargets.push({
                type: 'cell',
                row: tile.row,
                col: tile.col,
                x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                w: CELL_SIZE,
                h: CELL_SIZE
            });
        }
    }

    _setupCompletionButtons() {
        const cx = SCREEN_WIDTH / 2;
        const btnW = 200, btnH = 50, gap = 20;
        const startY = SCREEN_HEIGHT / 2 + 40;
        this.completionButtons = [
            { label: 'VS Player', x: cx - btnW / 2, y: startY, w: btnW, h: btnH, action: 'pvp' },
            { label: 'VS COM', x: cx - btnW / 2, y: startY + btnH + gap, w: btnW, h: btnH, action: 'com' },
            { label: 'メニューに戻る', x: cx - btnW / 2, y: startY + (btnH + gap) * 2, w: btnW, h: btnH, action: 'menu' }
        ];
    }

    _executeOpponentTurn(game) {
        // Opponent (P2) turn: roll, move, place automatically
        game.currentTurn = 2;
        game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
        game.diceRoll = 0;
        game.moveMode = DIRECTION_TYPE.CROSS;
        game.stockedThisTurn = false;
        game.clearHighlights();

        // Roll for P2 (fixed dice value = 1)
        const p2 = game.player2;
        const oldQueue = [...p2.diceQueue];
        game.diceRoll = p2.shiftDiceQueue(() => 1);

        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(2, 'roll', {
                oldQueue: oldQueue,
                newQueue: [...p2.diceQueue]
            });
            animManager.startDiceReveal(2, p2.diceQueue[2]);
        }

        // Find movable tiles for P2
        game.findMovableTiles();

        // Pick first movable tile
        const moveTo = game.movableTiles[0];
        if (moveTo) {
            const fromRow = p2.row;
            const fromCol = p2.col;
            p2.moveTo(moveTo.row, moveTo.col);
            game.pendingMoveRow = moveTo.row;
            game.pendingMoveCol = moveTo.col;

            if (typeof animManager !== 'undefined' && animManager) {
                animManager.startMove(2, fromRow, fromCol, moveTo.row, moveTo.col, 'move');
            }

            // Wait for move animation, then place
            this.waitingForAnimation = true;
            setTimeout(() => {
                // Handle fountain pickup
                const landedTile = game.board.getTile(moveTo.row, moveTo.col);
                if (landedTile === MARKERS.FOUNTAIN) {
                    p2.addPoints(GAME_SETTINGS.fountainPickup);
                    game.board.setTile(moveTo.row, moveTo.col, MARKERS.EMPTY);
                }

                // Place stone
                game.placementType = 'stone';
                game.clearHighlights();
                game.findPlaceableTiles();

                const placeTo = game.placeableTiles[0];
                if (placeTo) {
                    game.board.setTile(placeTo.row, placeTo.col, MARKERS.STONE);
                }

                // End opponent turn, switch back to P1
                game.currentTurn = 1;
                game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
                game.diceRoll = 0;
                game.moveMode = DIRECTION_TYPE.CROSS;
                game.stockedThisTurn = false;
                game.clearHighlights();

                // Tick snow timers
                game.board.tickSnow();

                this.waitingForAnimation = false;
                this.advance(game);
            }, 600);
        } else {
            // No movable tiles, skip to next step
            game.currentTurn = 1;
            game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
            game.diceRoll = 0;
            game.clearHighlights();
            this.advance(game);
        }
    }

    handleClick(game, x, y) {
        if (this.waitingForAnimation) return false;

        switch (this.subPhase) {
            case 'intro':
                // Any click advances
                this.advance(game);
                return true;

            case 'roll':
            case 'roll2': {
                // Check if Select button clicked
                const btnTarget = this.highlightTargets[0];
                if (btnTarget && x >= btnTarget.x && x <= btnTarget.x + btnTarget.w &&
                    y >= btnTarget.y && y <= btnTarget.y + btnTarget.h) {
                    // Execute roll
                    game.moveMode = DIRECTION_TYPE.CROSS;
                    const currentPlayer = game.getCurrentPlayer();
                    const oldQueue = [...currentPlayer.diceQueue];
                    game.diceRoll = currentPlayer.shiftDiceQueue(() => 2);
                    if (typeof animManager !== 'undefined' && animManager) {
                        animManager.startDiceTransition(currentPlayer.playerNum, 'roll', {
                            oldQueue: oldQueue,
                            newQueue: [...currentPlayer.diceQueue]
                        });
                        animManager.startDiceReveal(currentPlayer.playerNum, currentPlayer.diceQueue[2]);
                    }
                    game.findMovableTiles();

                    // Move to move sub-phase
                    if (this.subPhase === 'roll2') {
                        this.subPhase = 'move2';
                        this.guideText = '移動先を選択しよう';
                        this.guideSubText = '光っているマスをクリック';
                    } else {
                        this.subPhase = 'move';
                        this.step = 2;
                        this.setupStep(game);
                        return true;
                    }
                    this._setMovableHighlights(game);
                    return true;
                }
                return false;
            }

            case 'move':
            case 'move2': {
                // Check if a highlighted cell is clicked
                const clickedCell = game.getCellFromCoords(x, y);
                if (!clickedCell) return false;

                // Check if it's a movable tile
                const moveTile = game.movableTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col);
                const fallTile = game.fallTriggerTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col);

                if (moveTile) {
                    // Execute move with animation
                    const currentPlayer = game.getCurrentPlayer();
                    const fromRow = currentPlayer.row;
                    const fromCol = currentPlayer.col;
                    currentPlayer.moveTo(moveTile.row, moveTile.col);
                    game.pendingMoveRow = moveTile.row;
                    game.pendingMoveCol = moveTile.col;

                    if (typeof animManager !== 'undefined' && animManager) {
                        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, moveTile.row, moveTile.col, 'move');
                    }

                    // Wait for animation then go to place
                    this.waitingForAnimation = true;
                    setTimeout(() => {
                        // Handle fountain pickup
                        const landedTile = game.board.getTile(moveTile.row, moveTile.col);
                        if (landedTile === MARKERS.FOUNTAIN) {
                            currentPlayer.addPoints(GAME_SETTINGS.fountainPickup);
                            game.board.setTile(moveTile.row, moveTile.col, MARKERS.EMPTY);
                        }

                        game.placementType = 'stone';
                        game.clearHighlights();
                        game.findPlaceableTiles();

                        this.waitingForAnimation = false;

                        if (this.subPhase === 'move2') {
                            this.subPhase = 'place2';
                            this.guideText = '石を配置しよう';
                            this.guideSubText = '隣接する空きマスに石を配置';
                        } else {
                            this.subPhase = 'place';
                            this.step = 3;
                            this.setupStep(game);
                            return;
                        }
                        this._setPlaceableHighlights(game);
                    }, 400);
                    return true;
                }

                if (fallTile) {
                    // For fall tiles, just treat as move to that tile for tutorial simplicity
                    const currentPlayer = game.getCurrentPlayer();
                    const fromRow = currentPlayer.row;
                    const fromCol = currentPlayer.col;
                    currentPlayer.moveTo(fallTile.row, fallTile.col);

                    if (typeof animManager !== 'undefined' && animManager) {
                        animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, fallTile.row, fallTile.col, 'move');
                    }

                    this.waitingForAnimation = true;
                    setTimeout(() => {
                        game.placementType = 'stone';
                        game.clearHighlights();
                        game.findPlaceableTiles();
                        this.waitingForAnimation = false;

                        if (this.subPhase === 'move2') {
                            this.subPhase = 'place2';
                            this.guideText = '石を配置しよう';
                            this.guideSubText = '隣接する空きマスに石を配置';
                        } else {
                            this.subPhase = 'place';
                            this.step = 3;
                            this.setupStep(game);
                            return;
                        }
                        this._setPlaceableHighlights(game);
                    }, 400);
                    return true;
                }

                return false;
            }

            case 'place':
            case 'place2': {
                const clickedCell = game.getCellFromCoords(x, y);
                if (!clickedCell) return false;

                const placeTile = game.placeableTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col);
                if (placeTile) {
                    game.board.setTile(placeTile.row, placeTile.col, MARKERS.STONE);
                    game.clearHighlights();

                    if (this.subPhase === 'place2') {
                        // Second turn complete, go to completion
                        this.step = 6;
                        this.setupStep(game);
                    } else {
                        // First turn complete, go to opponent turn
                        // Tick snow timers
                        game.board.tickSnow();
                        this.step = 4;
                        this.setupStep(game);
                    }
                    return true;
                }
                return false;
            }

            case 'opponent':
                // No clicks during opponent turn
                return false;

            case 'complete': {
                // Check completion buttons
                for (const btn of this.completionButtons) {
                    if (x >= btn.x && x <= btn.x + btn.w &&
                        y >= btn.y && y <= btn.y + btn.h) {
                        this.active = false;
                        if (this.autoTimer) {
                            clearTimeout(this.autoTimer);
                            this.autoTimer = null;
                        }
                        if (btn.action === 'pvp') {
                            game.showDifficultySelect = false;
                            game.startGame('pvp');
                        } else if (btn.action === 'com') {
                            game.showDifficultySelect = true;
                            game.phase = PHASES.START_SCREEN;
                        } else {
                            game.phase = PHASES.START_SCREEN;
                        }
                        return true;
                    }
                }
                return true; // consume clicks
            }
        }
        return false;
    }

    advance(game) {
        this.step++;
        if (this.step >= this.totalSteps) {
            this.step = this.totalSteps - 1; // clamp to completion
        }
        this.setupStep(game);
    }

    getGuideInfo() {
        return {
            text: this.guideText,
            subText: this.guideSubText,
            highlightTargets: this.highlightTargets,
            dimOverlay: this.dimOverlay,
            completionButtons: this.completionButtons,
            subPhase: this.subPhase,
            step: this.step,
            totalSteps: this.totalSteps,
            active: this.active
        };
    }

    cleanup() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.active = false;
    }
}
