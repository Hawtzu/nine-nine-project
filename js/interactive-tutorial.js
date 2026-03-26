// Interactive Tutorial - Guided gameplay tutorial
// Step flow: intro → roll → move → diagonal_info → place → opponent → points_info
//          → roll_diagonal → place2 → opponent2 → stock → skill(bomb) → complete

class InteractiveTutorial {
    constructor() {
        this.step = 0;
        this.totalSteps = 16; // Steps 0-15
        this.active = false;
        this.guideText = '';
        this.guideSubText = '';
        this.highlightTargets = [];
        this.dimOverlay = true;
        this.waitingForAnimation = false;
        this.subPhase = 'intro';
        this.autoTimer = null;
        this.completionButtons = [];
        this.diceSequence = [3, 2, 1, 3, 2, 1]; // Fixed dice sequence for P1
        this.diceIndex = 0;
    }

    _nextDice() {
        const val = this.diceSequence[this.diceIndex % this.diceSequence.length];
        this.diceIndex++;
        return val;
    }

    start(game) {
        this.active = true;
        this.step = 0;
        this.subPhase = 'intro';
        this.waitingForAnimation = false;
        this.completionButtons = [];
        this.diceIndex = 0;

        // Initialize game state
        game.board.reset();
        game.player1 = new Player(1, 4, 0);
        game.player2 = new Player(2, 4, 8);
        game.player1.color = COLORS.P1;
        game.player2.color = COLORS.P2;

        // Set skills
        game.player1.setSpecialSkill(SPECIAL_SKILLS.BOMB);
        game.player2.setSpecialSkill(SPECIAL_SKILLS.ICE);

        // Starting points: 100pt for tutorial convenience
        game.player1.points = 100;
        game.player2.points = 100;

        // Fixed dice queues using sequence: 1, 2, 3
        game.player1.initDiceQueue(() => this._nextDice());
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
                this.guideText = '相手を行動不能にすれば勝ち！';
                this.guideSubText = 'ゲームの基本を学びましょう。クリックして始めます';
                this.highlightTargets = [{ type: 'screen' }];
                break;

            case 1: // Select (ROLL phase)
                this.subPhase = 'roll';
                this.guideText = 'Selectを押してCURRENTのサイコロをUSEに移そう';
                this.guideSubText = 'USEの値が移動距離になります';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 385, w: 200, h: 50
                }];
                break;

            case 2: // Normal movement
                this.subPhase = 'move';
                this.guideText = '光っているマスに移動しよう';
                this.guideSubText = 'USEの目の分だけ進めます。石があると止まります';
                this._setMovableHighlightsWithPlayer(game, true);
                break;

            case 3: // Diagonal movement info
                this.subPhase = 'diagonal_info';
                this.guideText = '💡 斜め移動もできるよ！';
                this.guideSubText = '自分の駒をクリックすると斜め方向にも移動できます（-10pt）\nこの後実際に体験しよう！';
                this.highlightTargets = [{ type: 'screen' }];
                break;

            case 4: // Place stone (ACTION phase)
                this.subPhase = 'place';
                this.guideText = '石を配置しよう（アクションフェーズ）';
                this.guideSubText = '移動後は周囲4マスに石を置くかスキルを使えます。石で相手の移動を妨害！';
                this._setPlaceableHighlights(game);
                break;

            case 5: // Opponent's turn (auto)
                this.subPhase = 'opponent';
                this.guideText = '相手のターンです';
                this.guideSubText = '自動で実行されます';
                this.highlightTargets = [];
                this.autoTimer = setTimeout(() => {
                    this._executeOpponentTurn(game);
                }, 1500);
                break;

            case 6: // Points explanation (after opponent turn)
                this.subPhase = 'points_info';
                this.guideText = '💰 ポイントについて';
                this.guideSubText = '相手のターン終了時に+10pt獲得。スキルの使用にはポイントが必要です';
                // Use cutout type so overlay is shown but panel area is transparent
                this.highlightTargets = [
                    { type: 'cutout', x: 20, y: 120, w: 210, h: 72 }
                ];
                break;

            case 7: // Diagonal movement experience
                this.subPhase = 'roll_diagonal';
                this.guideText = 'Selectを押してCURRENTをUSEに移そう';
                this.guideSubText = 'その後、自分の駒をクリックして斜め方向に移動！';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 385, w: 200, h: 50
                }];
                break;

            case 8: // Place stone (2nd time)
                this.subPhase = 'place2';
                this.guideText = '石を配置しよう';
                this.guideSubText = '隣接する空きマスに石を配置';
                this._setPlaceableHighlights(game);
                break;

            case 9: // Opponent's turn (2nd, auto)
                this.subPhase = 'opponent2';
                this.guideText = '相手のターンです';
                this.guideSubText = '自動で実行されます';
                this.highlightTargets = [];
                this.autoTimer = setTimeout(() => {
                    this._executeOpponentTurn(game);
                }, 1500);
                break;

            case 10: // Stock experience (ROLL phase)
                this.subPhase = 'stock';
                this.guideText = 'Stockでサイコロを保存しよう（-20pt）';
                this.guideSubText = 'CURRENTのサイコロを保存できます。保存したサイコロは後で使えます';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 443, w: 200, h: 50
                }];
                break;

            case 11: // After Stock: Select to continue
                this.subPhase = 'post_stock_select';
                this.guideText = 'Stockした！次はSelectを押そう';
                this.guideSubText = 'CURRENTのサイコロがUSEに移動します';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 383, w: 200, h: 50
                }];
                break;

            case 12: // Move after stock+select
                this.subPhase = 'post_stock_move';
                this.guideText = '移動先を選択';
                this.guideSubText = '光っているマスに移動しよう';
                this._setMovableHighlightsWithPlayer(game, true);
                break;

            case 13: // Bomb skill usage (PLACE phase)
                this.subPhase = 'skill_bomb';
                this.guideText = '🎯 スキルを使ってみよう！';
                this.guideSubText = 'Bombボタンを押してBombを設置しよう';
                this.highlightTargets = [{
                    type: 'button',
                    x: 40, y: 423, w: 200, h: 50
                }];
                break;

            case 14: // Bomb placement
                this.subPhase = 'skill_bomb_place';
                this.guideText = 'Bombを設置しよう';
                this.guideSubText = '光っているマスを選んでBombを置こう';
                if (game.placeableTiles) {
                    this.highlightTargets = [];
                    for (const tile of game.placeableTiles) {
                        this.highlightTargets.push({
                            type: 'cell', row: tile.row, col: tile.col,
                            x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                            y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                            w: CELL_SIZE, h: CELL_SIZE
                        });
                    }
                }
                break;

            case 15: // Completion
                this.subPhase = 'complete';
                this.guideText = '🎉 チュートリアル完了！';
                this.guideSubText = 'さっそくゲームを始めよう';
                this.highlightTargets = [];
                this._setupCompletionButtons();
                break;
        }
    }

    // Highlight movable tiles AND player piece (so piece isn't hidden by overlay)
    // excludeSelf: if true, don't include the player's own cell in movable highlights
    _setMovableHighlightsWithPlayer(game, excludeSelf = false) {
        this.highlightTargets = [];
        const p1 = game.player1;
        // Add player piece as cutout only (no yellow border) so it's visible through overlay
        this.highlightTargets.push({
            type: 'cutout', row: p1.row, col: p1.col,
            x: p1.col * CELL_SIZE + BOARD_OFFSET_X,
            y: p1.row * CELL_SIZE + BOARD_OFFSET_Y,
            w: CELL_SIZE, h: CELL_SIZE
        });
        if (game.movableTiles) {
            for (const tile of game.movableTiles) {
                // Skip player's own cell if excludeSelf
                if (excludeSelf && tile.row === p1.row && tile.col === p1.col) continue;
                this.highlightTargets.push({
                    type: 'cell', row: tile.row, col: tile.col,
                    x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                    y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                    w: CELL_SIZE, h: CELL_SIZE
                });
            }
        }
        if (game.fallTriggerTiles) {
            for (const tile of game.fallTriggerTiles) {
                if (excludeSelf && tile.row === p1.row && tile.col === p1.col) continue;
                this.highlightTargets.push({
                    type: 'cell', row: tile.row, col: tile.col,
                    x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                    y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                    w: CELL_SIZE, h: CELL_SIZE
                });
            }
        }
    }

    _setPlaceableHighlights(game) {
        this.highlightTargets = [];
        if (game.placeableTiles) {
            for (const tile of game.placeableTiles) {
                this.highlightTargets.push({
                    type: 'cell', row: tile.row, col: tile.col,
                    x: tile.col * CELL_SIZE + BOARD_OFFSET_X,
                    y: tile.row * CELL_SIZE + BOARD_OFFSET_Y,
                    w: CELL_SIZE, h: CELL_SIZE
                });
            }
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
        game.currentTurn = 2;
        game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
        game.diceRoll = 0;
        game.moveMode = DIRECTION_TYPE.CROSS;
        game.stockedThisTurn = false;
        game.clearHighlights();

        const p2 = game.player2;
        const oldQueue = [...p2.diceQueue];
        game.diceRoll = p2.shiftDiceQueue(() => 1);

        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(2, 'roll', { oldQueue, newQueue: [...p2.diceQueue] });
            animManager.startDiceReveal(2, p2.diceQueue[2]);
        }

        game.findMovableTiles();
        const moveTo = game.movableTiles[0];

        if (moveTo) {
            const fromRow = p2.row, fromCol = p2.col;
            p2.moveTo(moveTo.row, moveTo.col);
            game.pendingMoveRow = moveTo.row;
            game.pendingMoveCol = moveTo.col;

            if (typeof animManager !== 'undefined' && animManager) {
                animManager.startMove(2, fromRow, fromCol, moveTo.row, moveTo.col, 'move');
            }

            this.waitingForAnimation = true;
            setTimeout(() => {
                const landedTile = game.board.getTile(moveTo.row, moveTo.col);
                if (landedTile === MARKERS.FOUNTAIN) {
                    p2.addPoints(GAME_SETTINGS.fountainPickup);
                    game.board.setTile(moveTo.row, moveTo.col, MARKERS.EMPTY);
                }

                // Wait before placing stone so player can see the move
                setTimeout(() => {
                    game.placementType = 'stone';
                    game.clearHighlights();
                    game.findPlaceableTiles();
                    const placeTo = game.placeableTiles[0];
                    if (placeTo) {
                        game.board.setTile(placeTo.row, placeTo.col, MARKERS.STONE);
                    }

                    // Switch back to P1 and give turn bonus
                    game.currentTurn = 1;
                    game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
                    game.diceRoll = 0;
                    game.moveMode = DIRECTION_TYPE.CROSS;
                    game.stockedThisTurn = false;
                    game.clearHighlights();
                    game.board.tickSnow();

                    // Wait 1 second after stone placement before advancing
                    setTimeout(() => {
                        this.waitingForAnimation = false;
                        this.advance(game);
                    }, 1000);
                }, 1000);
            }, 600);
        } else {
            game.currentTurn = 1;
            game.getCurrentPlayer().addPoints(GAME_SETTINGS.turnBonus);
            game.diceRoll = 0;
            game.clearHighlights();
            this.advance(game);
        }
    }

    _doRoll(game) {
        game.moveMode = DIRECTION_TYPE.CROSS;
        const currentPlayer = game.getCurrentPlayer();
        const oldQueue = [...currentPlayer.diceQueue];
        game.diceRoll = currentPlayer.shiftDiceQueue(() => this._nextDice());
        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startDiceTransition(currentPlayer.playerNum, 'roll', { oldQueue, newQueue: [...currentPlayer.diceQueue] });
            animManager.startDiceReveal(currentPlayer.playerNum, currentPlayer.diceQueue[2]);
        }
        game.findMovableTiles();
    }

    _doMove(game, x, y) {
        const clickedCell = game.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        const moveTile = game.movableTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col);
        const fallTile = game.fallTriggerTiles ? game.fallTriggerTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col) : null;
        const target = moveTile || fallTile;
        if (!target) return false;

        const currentPlayer = game.getCurrentPlayer();
        const fromRow = currentPlayer.row, fromCol = currentPlayer.col;

        // Deduct diagonal cost
        if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
            currentPlayer.deductPoints(GAME_SETTINGS.diagonalMoveCost);
        }

        currentPlayer.moveTo(target.row, target.col);
        game.pendingMoveRow = target.row;
        game.pendingMoveCol = target.col;

        if (typeof animManager !== 'undefined' && animManager) {
            animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, target.row, target.col, 'move');
        }

        this.waitingForAnimation = true;
        setTimeout(() => {
            const landedTile = game.board.getTile(target.row, target.col);
            if (landedTile === MARKERS.FOUNTAIN) {
                currentPlayer.addPoints(GAME_SETTINGS.fountainPickup);
                game.board.setTile(target.row, target.col, MARKERS.EMPTY);
            }
            game.placementType = 'stone';
            game.clearHighlights();
            game.findPlaceableTiles();
            this.waitingForAnimation = false;
        }, 400);

        return true;
    }

    _doPlace(game, x, y) {
        const clickedCell = game.getCellFromCoords(x, y);
        if (!clickedCell) return false;

        const placeTile = game.placeableTiles.find(t => t.row === clickedCell.row && t.col === clickedCell.col);
        if (!placeTile) return false;

        if (game.placementType === 'bomb') {
            game.board.setBomb(placeTile.row, placeTile.col, 1);
        } else {
            game.board.setTile(placeTile.row, placeTile.col, MARKERS.STONE);
        }
        game.clearHighlights();
        game.board.tickSnow();
        return true;
    }

    handleClick(game, x, y) {
        if (this.waitingForAnimation) return false;

        switch (this.subPhase) {
            case 'intro':
            case 'diagonal_info':
            case 'points_info':
                this.advance(game);
                return true;

            case 'roll': {
                const btn = this.highlightTargets[0];
                if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    this._doRoll(game);
                    this.step = 2;
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'move': {
                if (this._doMove(game, x, y)) {
                    setTimeout(() => {
                        this.step = 3; // diagonal_info
                        this.setupStep(game);
                    }, 450);
                    return true;
                }
                return false;
            }

            case 'place': {
                if (this._doPlace(game, x, y)) {
                    this.step = 5; // opponent (was 4→5, points moved after opponent)
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'opponent':
            case 'opponent2':
                return false;

            case 'roll_diagonal': {
                const btn = this.highlightTargets[0];
                if (btn && btn.type === 'button' && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    this._doRoll(game);
                    this.subPhase = 'click_piece';
                    this.guideText = '自分の駒をクリック！';
                    this.guideSubText = '斜め方向の移動先が表示されます';
                    const p1 = game.player1;
                    this.highlightTargets = [{
                        type: 'cell', row: p1.row, col: p1.col,
                        x: p1.col * CELL_SIZE + BOARD_OFFSET_X,
                        y: p1.row * CELL_SIZE + BOARD_OFFSET_Y,
                        w: CELL_SIZE, h: CELL_SIZE
                    }];
                    return true;
                }
                return false;
            }

            case 'click_piece': {
                const clickedCell = game.getCellFromCoords(x, y);
                const p1 = game.player1;
                if (clickedCell && clickedCell.row === p1.row && clickedCell.col === p1.col) {
                    game.moveMode = DIRECTION_TYPE.DIAGONAL;
                    game.findMovableTiles();
                    this.subPhase = 'diagonal_move';
                    this.guideText = '斜め方向に移動しよう！';
                    this.guideSubText = '斜め移動には-10ptかかります';
                    this._setMovableHighlightsWithPlayer(game);
                    return true;
                }
                return false;
            }

            case 'diagonal_move': {
                if (this._doMove(game, x, y)) {
                    setTimeout(() => {
                        this.step = 8; // place2
                        this.setupStep(game);
                    }, 450);
                    return true;
                }
                return false;
            }

            case 'place2': {
                if (this._doPlace(game, x, y)) {
                    this.step = 9; // opponent2
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'stock': {
                const btn = this.highlightTargets[0];
                if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    // Use game's own stockCurrentDice() for correct behavior
                    game.stockCurrentDice();
                    // Stay in ROLL phase - next step is Select
                    this.step = 11;
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'post_stock_select': {
                const btn = this.highlightTargets[0];
                if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    this._doRoll(game);
                    this.step = 12; // post_stock_move
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'post_stock_move': {
                if (this._doMove(game, x, y)) {
                    setTimeout(() => {
                        this.step = 13; // skill_bomb
                        this.setupStep(game);
                    }, 450);
                    return true;
                }
                return false;
            }

            case 'skill_bomb': {
                const btn = this.highlightTargets[0];
                if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    game.placementType = 'bomb';
                    game.findPlaceableTiles();
                    this.step = 14; // skill_bomb_place
                    this.setupStep(game);
                    return true;
                }
                return false;
            }

            case 'skill_bomb_place': {
                if (this._doPlace(game, x, y)) {
                    // Wait 2 seconds before showing completion
                    this.guideText = '';
                    this.guideSubText = '';
                    this.highlightTargets = [{ type: 'screen' }];
                    this.subPhase = 'waiting_complete';
                    this.autoTimer = setTimeout(() => {
                        this.step = 15; // complete
                        this.setupStep(game);
                    }, 2000);
                    return true;
                }
                return false;
            }

            case 'complete': {
                for (const btn of this.completionButtons) {
                    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
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
                return true;
            }
        }
        return false;
    }

    advance(game) {
        this.step++;
        if (this.step >= this.totalSteps) {
            this.step = this.totalSteps - 1;
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
