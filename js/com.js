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
        // Simple: just roll the dice
        this.game.rollDice();
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
            game.movePlayer(result.bestMove.row, result.bestMove.col);
        } else {
            // No valid moves — check fall triggers
            if (game.fallTriggerTiles.length > 0) {
                const tile = game.fallTriggerTiles[0];
                this.plannedPlace = null;
                game.movePlayer(tile.row, tile.col);
            }
            // If truly no moves, game.js handles blocked player via rollDice
        }
    }

    // ===== Place Phase =====

    decidePlacePhase() {
        if (this.game.winner) return;
        const game = this.game;
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

        let bestScore = -Infinity;
        let bestMove = null;
        let bestPlace = null;

        // Get COM's movable tiles
        const comMoves = this._getMovableTiles(board, comPos, comDice, oppPos);

        // If no moves available, return null (handled by decideMovePhase fallback)
        if (comMoves.length === 0) {
            return { bestMove: null, bestPlace: null, score: -Infinity };
        }

        for (const comMove of comMoves) {
            // Get COM's placeable tiles after moving
            const comPlaces = this._getPlaceableTiles(board, comMove, oppPos);

            if (comPlaces.length === 0) {
                // Moving here means COM can't place → likely loses
                continue;
            }

            for (const comPlace of comPlaces) {
                // Simulate COM move + place
                const oldTile = board[comPlace.row][comPlace.col];
                board[comPlace.row][comPlace.col] = MARKERS.STONE;

                // Opponent's turn: try all dice values (1-3), take worst case (minimax)
                let worstScore = Infinity;

                for (let oppDice = 1; oppDice <= 3; oppDice++) {
                    const oppMoves = this._getMovableTiles(board, oppPos, oppDice, comMove);

                    if (oppMoves.length === 0) {
                        // Opponent blocked with this dice → great for COM
                        const score = this.evaluate(board, comMove, oppPos) + 50;
                        worstScore = Math.min(worstScore, score);
                        continue;
                    }

                    for (const oppMove of oppMoves) {
                        const oppPlaces = this._getPlaceableTiles(board, oppMove, comMove);

                        if (oppPlaces.length === 0) {
                            // Opponent can move but can't place → good for COM
                            const score = this.evaluate(board, comMove, oppMove) + 30;
                            worstScore = Math.min(worstScore, score);
                            continue;
                        }

                        for (const oppPlace of oppPlaces) {
                            // Simulate opponent place
                            const oldOppTile = board[oppPlace.row][oppPlace.col];
                            board[oppPlace.row][oppPlace.col] = MARKERS.STONE;

                            const score = this.evaluate(board, comMove, oppMove);
                            worstScore = Math.min(worstScore, score);

                            // Undo opponent place
                            board[oppPlace.row][oppPlace.col] = oldOppTile;
                        }
                    }
                }

                // Undo COM place
                board[comPlace.row][comPlace.col] = oldTile;

                if (worstScore > bestScore) {
                    bestScore = worstScore;
                    bestMove = comMove;
                    bestPlace = comPlace;
                }
            }
        }

        // If all moves were skipped (all had 0 placeable), fallback to first move
        if (!bestMove && comMoves.length > 0) {
            bestMove = comMoves[0];
            const fallbackPlaces = this._getPlaceableTiles(board, bestMove, oppPos);
            bestPlace = fallbackPlaces.length > 0 ? fallbackPlaces[0] : null;
        }

        return { bestMove, bestPlace, score: bestScore };
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

    _getMovableTiles(board, pos, diceValue, otherPos) {
        // Simulate movement in all 4 cross directions for the given dice value
        const results = [];
        const bombOwners = this.game.board.bombOwners || {};

        for (const dir of CROSS_DIRECTIONS) {
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
                    steps = Math.max(step, steps - 1);
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
        // Get all tiles reachable from pos with given dice (cross only for territory seeds)
        return this._getMovableTiles(board, pos, diceValue, otherPos);
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
