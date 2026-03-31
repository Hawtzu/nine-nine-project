// COM (Computer) Player AI — Territory-based Minimax
// Searches depth 4: COM move → COM place → Opponent move → Opponent place
// Evaluates board state using BFS territory scoring.

class ComPlayer {
    constructor(game) {
        this.game = game;
        this.pendingTimeout = null;
        this.plannedPlace = null; // Best placement from search, used in decidePlacePhase
    }

    // ===== Infrastructure =====

    reset() {
        this.cancelPending();
        this.plannedPlace = null;
    }

    executeAfterDelay(fn, delayKey) {
        this.cancelPending();
        const delay = COM_DELAYS[delayKey] || 500;
        this.pendingTimeout = setTimeout(() => {
            this.pendingTimeout = null;
            fn();
        }, delay);
    }

    cancelPending() {
        if (this.pendingTimeout) {
            clearTimeout(this.pendingTimeout);
            this.pendingTimeout = null;
        }
    }

    // ===== Entry Points =====

    startTurn() {
        if (this.game.winner) return;
        this.executeAfterDelay(() => this.decideRollPhase(), 'ROLL');
    }

    decideSkillSelection() {
        if (this.game.winner) return;
        // Fixed: always select Bomb
        this.game.selectSkill(2, SPECIAL_SKILLS.BOMB);
    }

    // ===== Roll Phase =====

    decideRollPhase() {
        if (this.game.winner) return;
        const game = this.game;
        const comPlayer = game.player2;

        // Roll the dice
        game.rollDice();

        // Consider using stocked dice if available
        if (comPlayer.stockedDice !== null && !game.stockedThisTurn) {
            const currentDice = game.diceRoll;
            const currentResult = this.search();
            const currentScore = currentResult.score;

            // Temporarily swap dice to stocked value and evaluate
            const stockedVal = comPlayer.stockedDice;
            game.diceRoll = stockedVal;
            const stockResult = this.search();
            const stockScore = stockResult.score;

            // Restore original dice
            game.diceRoll = currentDice;

            // Use stock if it's clearly better (threshold: +5 to avoid noise)
            if (stockScore > currentScore + 5) {
                game.useStockedDice();
            }
        }

        // Consider stocking current dice (save for later)
        // Heuristic: stock if current dice gives very bad moves and we can afford 20pt
        if (!game.stockedThisTurn && comPlayer.stockedDice === null &&
            comPlayer.canAfford(SKILL_COSTS.stock)) {
            const currentResult = this.search();
            if (currentResult.score < -10) {
                // Current dice is bad — stock it and get a new one
                game.stockCurrentDice();
            }
        }

        this.executeAfterDelay(() => this.decideMovePhase(), 'MOVE');
    }

    // ===== Move Phase =====

    decideMovePhase() {
        if (this.game.winner) return;
        const game = this.game;

        // Run minimax search for best (move, place) pair
        const result = this.search();

        if (result.bestMove) {
            this.plannedPlace = result.bestPlace;
            // Switch to diagonal mode if search chose a diagonal move
            if (result.bestMove.isDiagonal) {
                game.moveMode = DIRECTION_TYPE.DIAGONAL;
                game.findMovableTiles();
            }
            this._executeMove(game, result.bestMove);
        } else {
            // No valid moves from search — try game's own movable tiles
            this.plannedPlace = null;

            if (game.fallTriggerTiles.length > 0) {
                this._executeMove(game, game.fallTriggerTiles[0]);
            } else if (game.movableTiles.length > 0) {
                game.movePlayer(game.movableTiles[0].row, game.movableTiles[0].col);
            } else {
                // Cross movement blocked — try diagonal via game engine
                game.moveMode = DIRECTION_TYPE.DIAGONAL;
                game.findMovableTiles();
                if (game.movableTiles.length > 0) {
                    game.movePlayer(game.movableTiles[0].row, game.movableTiles[0].col);
                } else if (game.fallTriggerTiles.length > 0) {
                    this._executeMove(game, game.fallTriggerTiles[0]);
                } else {
                    // Truly blocked — game should have ended at rollDice
                    game.endTurn();
                }
            }
        }
    }

    // ===== Place Phase =====

    decidePlacePhase() {
        if (this.game.winner) return;
        const game = this.game;

        // If game entered DRILL_TARGET phase (no placeable tiles, drill available)
        if (game.phase === PHASES.DRILL_TARGET) {
            this.decideDrillPhase();
            return;
        }

        const placeableTiles = game.placeableTiles;

        if (placeableTiles.length === 0) return;

        // Use planned placement from search if still valid
        if (this.plannedPlace) {
            const valid = placeableTiles.find(
                t => t.row === this.plannedPlace.row && t.col === this.plannedPlace.col
            );
            if (valid) {
                game.placeObject(this.plannedPlace.row, this.plannedPlace.col);
                this.plannedPlace = null;
                return;
            }
        }

        // Fallback: evaluate each placeable tile with territory scoring
        const comPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        const board = game.board.tiles;
        let bestScore = -Infinity;
        let bestTile = placeableTiles[0];

        for (const tile of placeableTiles) {
            // Simulate placing stone
            const oldVal = board[tile.row][tile.col];
            board[tile.row][tile.col] = MARKERS.STONE;
            const score = this.evaluate(board, comPos, oppPos);
            board[tile.row][tile.col] = oldVal;

            if (score > bestScore) {
                bestScore = score;
                bestTile = tile;
            }
        }

        game.placeObject(bestTile.row, bestTile.col);
        this.plannedPlace = null;
    }

    // ===== Move Execution =====

    _executeMove(game, tile) {
        // Check if this tile is a fall trigger (neon border / electromagnet death)
        const fallTile = game.fallTriggerTiles.find(
            t => t.row === tile.row && t.col === tile.col
        );

        if (fallTile) {
            // Use the same fall animation flow as PvP (game.js handleMovePhaseClick)
            const currentPlayer = game.getCurrentPlayer();
            const fromRow = currentPlayer.row;
            const fromCol = currentPlayer.col;
            game.pendingFallDir = { dr: fallTile.dr || 0, dc: fallTile.dc || 0 };
            game.pendingFallPlayerNum = game.currentTurn;
            game.pendingFallElectromagnet = fallTile.electromagnet || false;
            currentPlayer.moveTo(fallTile.row, fallTile.col);
            animManager.startMove(currentPlayer.playerNum, fromRow, fromCol, fallTile.row, fallTile.col, 'move');
            game.phase = PHASES.ANIMATING;
            animManager.playerAnims[currentPlayer.playerNum].onComplete = () => {
                game.fallAnimating = true;
                game.fallAnimStart = performance.now();
                game.fallAnimDir = game.pendingFallDir;
                game.fallAnimPlayerNum = game.pendingFallPlayerNum;
                game.fallAnimPlayerPos = { row: fallTile.row, col: fallTile.col };
                game.fallAnimElectromagnet = game.pendingFallElectromagnet;
                game.fallAnimInitialized = false;
                game.phase = PHASES.MOVE;
            };
        } else {
            game.movePlayer(tile.row, tile.col);
        }
    }

    // ===== Drill Phase =====

    decideDrillPhase() {
        if (this.game.winner) return;
        const game = this.game;
        const targets = game.drillTargetTiles;

        if (targets.length === 0) return;

        // Evaluate each drill target by territory score after removing the stone
        const comPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        const board = game.board.tiles;
        let bestScore = -Infinity;
        let bestTarget = targets[0];

        for (const target of targets) {
            const oldTile = board[target.row][target.col];
            board[target.row][target.col] = MARKERS.EMPTY;
            const score = this.evaluate(board, comPos, oppPos);
            board[target.row][target.col] = oldTile;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        game.useDrill(bestTarget.row, bestTarget.col);
    }

    // ===== Warp Selection =====

    decideWarpSelect() {
        if (this.game.winner) return;
        const game = this.game;
        const warpTiles = game.warpSelectTiles;
        if (warpTiles.length === 0) return;

        const oppPos = game.player1.getPosition();
        const board = game.board.tiles;
        let bestScore = -Infinity;
        let bestTile = warpTiles[0];

        for (const tile of warpTiles) {
            const comPos = { row: tile.row, col: tile.col };
            const score = this.evaluate(board, comPos, oppPos);
            if (score > bestScore) {
                bestScore = score;
                bestTile = tile;
            }
        }

        game.completeWarp(bestTile.row, bestTile.col);
    }

    // ===== Minimax Search (Depth 4) =====

    search() {
        const game = this.game;
        const board = game.board.tiles;
        const comPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        const comDice = game.diceRoll; // Already rolled
        const comPts = game.player2.points;
        const oppPts = game.player1.points;
        const diagCost = SKILL_COSTS.diagonal_move; // 10pt
        const drillCost = SKILL_COSTS.drill; // 100pt

        let bestScore = -Infinity;
        let bestMove = null;
        let bestPlace = null;

        // Get COM's movable tiles (cross + diagonal if affordable)
        const moveMode = comPts >= diagCost ? 'both' : 'cross';
        const comMoves = this._getMovableTiles(board, comPos, comDice, oppPos, moveMode);

        // If no moves available, return null (handled by decideMovePhase fallback)
        if (comMoves.length === 0) {
            return { bestMove: null, bestPlace: null, score: -Infinity };
        }

        for (const comMove of comMoves) {
            const comDiagPenalty = comMove.isDiagonal ? diagCost : 0;
            const comPtsAfterMove = comPts - comDiagPenalty;

            // Get COM's placeable tiles after moving
            const comPlaces = this._getPlaceableTiles(board, comMove, oppPos);

            if (comPlaces.length === 0) {
                // No placeable tiles — check if COM can drill to survive
                if (comPtsAfterMove >= drillCost) {
                    const drillTargets = this._getDrillTargets(board, comMove);
                    for (const dt of drillTargets) {
                        const oldDrill = board[dt.row][dt.col];
                        board[dt.row][dt.col] = MARKERS.EMPTY;
                        // After drilling, COM ends turn (no stone placed)
                        const score = this._evaluateOpponentTurn(
                            board, comMove, oppPos, oppPts,
                            comPtsAfterMove - drillCost, diagCost, drillCost
                        ) - comDiagPenalty;
                        board[dt.row][dt.col] = oldDrill;

                        if (score > bestScore) {
                            bestScore = score;
                            bestMove = comMove;
                            bestPlace = null; // Will trigger drill in decidePlacePhase
                        }
                    }
                }
                continue;
            }

            for (const comPlace of comPlaces) {
                // Simulate COM move + place
                const oldTile = board[comPlace.row][comPlace.col];
                board[comPlace.row][comPlace.col] = MARKERS.STONE;

                const score = this._evaluateOpponentTurn(
                    board, comMove, oppPos, oppPts,
                    comPtsAfterMove, diagCost, drillCost
                ) - comDiagPenalty;

                // Undo COM place
                board[comPlace.row][comPlace.col] = oldTile;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = comMove;
                    bestPlace = comPlace;
                }
            }
        }

        // If all moves were skipped (all had 0 placeable and no drill), fallback
        if (!bestMove && comMoves.length > 0) {
            bestMove = comMoves[0];
            const fallbackPlaces = this._getPlaceableTiles(board, bestMove, oppPos);
            bestPlace = fallbackPlaces.length > 0 ? fallbackPlaces[0] : null;
        }

        return { bestMove, bestPlace, score: bestScore };
    }

    // Evaluate opponent's best response (minimizing layer of minimax)
    _evaluateOpponentTurn(board, comPos, oppPos, oppPts, comPtsRemaining, diagCost, drillCost) {
        let worstScore = Infinity;

        for (let oppDice = 1; oppDice <= 3; oppDice++) {
            const oppMode = oppPts >= diagCost ? 'both' : 'cross';
            const oppMoves = this._getMovableTiles(board, oppPos, oppDice, comPos, oppMode);

            if (oppMoves.length === 0) {
                // Opponent blocked with this dice → great for COM
                const score = this.evaluate(board, comPos, oppPos) + 50;
                worstScore = Math.min(worstScore, score);
                continue;
            }

            for (const oppMove of oppMoves) {
                const oppDiagCost = oppMove.isDiagonal ? diagCost : 0;
                const oppPtsAfterMove = oppPts - oppDiagCost;
                const oppPlaces = this._getPlaceableTiles(board, oppMove, comPos);

                if (oppPlaces.length === 0) {
                    // Opponent has no placeable tiles — check drill
                    if (oppPtsAfterMove >= drillCost) {
                        // Opponent can drill to survive — evaluate after drill
                        const drillTargets = this._getDrillTargets(board, oppMove);
                        for (const dt of drillTargets) {
                            const oldDrill = board[dt.row][dt.col];
                            board[dt.row][dt.col] = MARKERS.EMPTY;
                            const score = this.evaluate(board, comPos, oppMove) + oppDiagCost;
                            board[dt.row][dt.col] = oldDrill;
                            worstScore = Math.min(worstScore, score);
                        }
                    } else {
                        // Opponent stuck and can't drill → very good for COM
                        const score = this.evaluate(board, comPos, oppMove) + 80 + oppDiagCost;
                        worstScore = Math.min(worstScore, score);
                    }
                    continue;
                }

                for (const oppPlace of oppPlaces) {
                    // Simulate opponent place
                    const oldOppTile = board[oppPlace.row][oppPlace.col];
                    board[oppPlace.row][oppPlace.col] = MARKERS.STONE;

                    const score = this.evaluate(board, comPos, oppMove) + oppDiagCost;
                    worstScore = Math.min(worstScore, score);

                    // Undo opponent place
                    board[oppPlace.row][oppPlace.col] = oldOppTile;
                }
            }
        }

        return worstScore;
    }

    // ===== Territory Evaluation =====

    evaluate(board, comPos, oppPos) {
        // BFS territory scoring: count tiles closer to each player
        // Seeds: tiles reachable with dice values 1-3 (covers all possible dice)
        const comSeeds = new Set();
        const oppSeeds = new Set();

        for (let dv = 1; dv <= 3; dv++) {
            for (const t of this._getReachableTiles(board, comPos, dv, oppPos)) {
                comSeeds.add(`${t.row},${t.col}`);
            }
            for (const t of this._getReachableTiles(board, oppPos, dv, comPos)) {
                oppSeeds.add(`${t.row},${t.col}`);
            }
        }

        const comDist = this._bfsFromSeeds(board, comSeeds);
        const oppDist = this._bfsFromSeeds(board, oppSeeds);

        let comCount = 0, oppCount = 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const tile = board[r][c];
                if (tile === MARKERS.STONE || tile === MARKERS.SNOW || tile === MARKERS.ELECTROMAGNET) continue;
                if (r === comPos.row && c === comPos.col) continue;
                if (r === oppPos.row && c === oppPos.col) continue;

                const key = `${r},${c}`;
                const cd = comDist.get(key);
                const od = oppDist.get(key);

                if (cd === undefined && od === undefined) continue;
                if (cd !== undefined && od !== undefined) {
                    if (cd < od) comCount++;
                    else if (od < cd) oppCount++;
                    // tied → contested, not counted for either
                } else if (cd !== undefined) {
                    comCount++;
                } else {
                    oppCount++;
                }
            }
        }

        return comCount - oppCount;
    }

    // ===== Movement Simulation =====

    _getMovableTiles(board, pos, diceValue, otherPos, mode = 'cross') {
        // Simulate movement in cross/diagonal/both directions for the given dice value
        const dirs = mode === 'diagonal'
            ? DIAGONAL_DIRECTIONS.map(d => ({ ...d, isDiag: true }))
            : mode === 'both'
            ? [...CROSS_DIRECTIONS.map(d => ({ ...d, isDiag: false })),
               ...DIAGONAL_DIRECTIONS.map(d => ({ ...d, isDiag: true }))]
            : CROSS_DIRECTIONS.map(d => ({ ...d, isDiag: false }));
        const results = [];
        const bombOwners = this.game.board.bombOwners || {};

        for (const dir of dirs) {
            let steps = diceValue;
            let cur = { row: pos.row, col: pos.col };
            let finalDest = null;
            const visited = new Set();
            let step = 1;
            let isFallTrigger = false;

            while (step <= steps) {
                const nr = cur.row + dir.dr;
                const nc = cur.col + dir.dc;

                if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
                    isFallTrigger = true;
                    break;
                }

                const tile = board[nr][nc];

                // Electromagnet: treat as wall (owner's = safe block, opponent's = lethal)
                if (tile === MARKERS.ELECTROMAGNET) {
                    const emOwners = this.game.board.electromagnetOwners || {};
                    const emOwner = emOwners[`${nr},${nc}`];
                    if (emOwner !== 2) {
                        // Opponent's electromagnet → collision = death, skip this direction
                        isFallTrigger = true;
                    }
                    // Either way, stop here (don't move onto the electromagnet)
                    break;
                }

                if (tile === MARKERS.STONE || tile === MARKERS.SNOW ||
                    (nr === otherPos.row && nc === otherPos.col)) break;

                finalDest = { row: nr, col: nc };
                cur = { row: nr, col: nc };

                if (tile === MARKERS.WARP) break;

                const key = `${nr},${nc}`;
                if (tile === MARKERS.ICE && !visited.has(key)) {
                    steps++;
                    visited.add(key);
                }
                if (tile === MARKERS.SWAMP && !visited.has(key)) {
                    steps = Math.max(step, steps - 2);
                    visited.add(key);
                }
                step++;
            }

            if (finalDest && !isFallTrigger) {
                // Skip opponent's bombs (COM is player 2, avoid player 1's bombs)
                const destKey = `${finalDest.row},${finalDest.col}`;
                if (board[finalDest.row][finalDest.col] === MARKERS.BOMB &&
                    bombOwners[destKey] !== 2) {
                    continue; // Skip — stepping on opponent's bomb = death
                }
                finalDest.isDiagonal = dir.isDiag;
                results.push(finalDest);
            }
        }

        // Deduplicate
        const seen = new Set();
        return results.filter(t => {
            const k = `${t.row},${t.col}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    _getReachableTiles(board, pos, diceValue, otherPos) {
        // Get all tiles reachable from pos with given dice (cross + diagonal for territory seeds)
        return this._getMovableTiles(board, pos, diceValue, otherPos, 'both');
    }

    _getPlaceableTiles(board, pos, otherPos) {
        // Adjacent cross-direction tiles that are empty (can place stone)
        const results = [];
        for (const dir of CROSS_DIRECTIONS) {
            const nr = pos.row + dir.dr;
            const nc = pos.col + dir.dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            if (nr === otherPos.row && nc === otherPos.col) continue;
            const tile = board[nr][nc];
            if (tile === MARKERS.EMPTY || tile === MARKERS.FOUNTAIN ||
                tile === MARKERS.ICE || tile === MARKERS.SWAMP ||
                tile === MARKERS.WARP || tile === MARKERS.CHECKPOINT ||
                tile === MARKERS.BOMB || tile === MARKERS.ELECTROMAGNET) {
                results.push({ row: nr, col: nc });
            }
        }
        return results;
    }

    // ===== Drill Helpers =====

    _getDrillTargets(board, pos) {
        // Adjacent cross-direction tiles that are drillable (stone, snow, electromagnet)
        const results = [];
        for (const dir of CROSS_DIRECTIONS) {
            const nr = pos.row + dir.dr;
            const nc = pos.col + dir.dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            const tile = board[nr][nc];
            if (tile === MARKERS.STONE || tile === MARKERS.SNOW || tile === MARKERS.ELECTROMAGNET) {
                results.push({ row: nr, col: nc });
            }
        }
        return results;
    }

    // ===== BFS Helpers =====

    _bfsFromSeeds(board, seeds) {
        const dist = new Map();
        const queue = [];

        for (const key of seeds) {
            dist.set(key, 0);
            const [r, c] = key.split(',').map(Number);
            queue.push({ row: r, col: c, d: 0 });
        }

        let head = 0;
        while (head < queue.length) {
            const { row, col, d } = queue[head++];
            for (const dir of CROSS_DIRECTIONS) {
                const nr = row + dir.dr;
                const nc = col + dir.dc;
                if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
                const key = `${nr},${nc}`;
                if (dist.has(key)) continue;
                const t = board[nr][nc];
                if (t === MARKERS.STONE || t === MARKERS.SNOW || t === MARKERS.ELECTROMAGNET) continue;
                dist.set(key, d + 1);
                queue.push({ row: nr, col: nc, d: d + 1 });
            }
        }

        return dist;
    }
}
