// COM (Computer) Player AI — Territory Control Strategy
class ComPlayer {
    constructor(game) {
        this.game = game;
        this.difficulty = COM_DIFFICULTY.NORMAL;
        this.pendingTimeout = null;
    }

    // ===== Entry Points & Infrastructure =====

    startTurn() {
        if (this.game.winner) return;
        this.executeAfterDelay(() => this.decideRollPhase(), 'ROLL');
    }

    executeAfterDelay(fn, delayKey) {
        if (this.game.winner) return;
        const delay = COM_DELAYS[delayKey] || 600;
        this.pendingTimeout = setTimeout(() => {
            this.pendingTimeout = null;
            if (!this.game.winner) fn();
        }, delay);
    }

    cancelPending() {
        if (this.pendingTimeout) {
            clearTimeout(this.pendingTimeout);
            this.pendingTimeout = null;
        }
    }

    reset() {
        this.cancelPending();
    }

    // ===== Difficulty Helpers =====

    isEasy() { return this.difficulty === COM_DIFFICULTY.EASY; }
    isAdvanced() { return this.difficulty !== COM_DIFFICULTY.EASY; }

    // ===== Core Utility: Territory Evaluation =====

    // BFS flood fill using CROSS directions only (models effective space partition)
    // Walls: STONE, SNOW. Passable: everything else including BOMB, ICE, SWAMP, etc.
    floodFillTerritory(startRow, startCol, board, otherPlayerPos) {
        const visited = new Set();
        visited.add(`${startRow},${startCol}`);
        const queue = [{ row: startRow, col: startCol }];
        let count = 1;
        let head = 0;

        while (head < queue.length) {
            const { row, col } = queue[head++];
            for (const dir of CROSS_DIRECTIONS) {
                const nr = row + dir.dr;
                const nc = col + dir.dc;
                const key = `${nr},${nc}`;
                if (visited.has(key)) continue;
                if (!board.isValidPosition(nr, nc)) continue;
                if (otherPlayerPos && nr === otherPlayerPos.row && nc === otherPlayerPos.col) continue;
                const tile = board.getTile(nr, nc);
                if (tile === MARKERS.STONE || tile === MARKERS.SNOW) continue;
                visited.add(key);
                queue.push({ row: nr, col: nc });
                count++;
            }
        }
        return { count, visited };
    }

    // Count how many adjacent tiles can accept a stone placement
    countPlacementOptions(row, col, board, otherPlayerPos) {
        let count = 0;
        for (const dir of CROSS_DIRECTIONS) {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            if (!board.isValidPosition(nr, nc)) continue;
            if (otherPlayerPos && nr === otherPlayerPos.row && nc === otherPlayerPos.col) continue;
            const tile = board.getTile(nr, nc);
            if (tile !== MARKERS.STONE && tile !== MARKERS.SNOW) count++;
        }
        return count;
    }

    // Temporarily place stone and measure both players' territory
    simulatePlaceTerritory(stoneRow, stoneCol, myPos, oppPos, board) {
        const original = board.getTile(stoneRow, stoneCol);
        board.setTile(stoneRow, stoneCol, MARKERS.STONE);
        const my = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos);
        const opp = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos);
        board.setTile(stoneRow, stoneCol, original);
        return { myTerritory: my.count, oppTerritory: opp.count, myVisited: my.visited };
    }

    // Replicate game.js findMovableTiles logic for simulation (no game state mutation)
    simulateMovableTiles(pos, diceValue, board, otherPos, diagonal) {
        const directions = diagonal ? DIAGONAL_DIRECTIONS : CROSS_DIRECTIONS;
        const results = [];

        for (const dir of directions) {
            let steps = diceValue;
            let currentPos = { row: pos.row, col: pos.col };
            let finalDest = null;
            const visitedTiles = new Set();
            let step = 1;
            let isFallTrigger = false;

            while (step <= steps) {
                const nr = currentPos.row + dir.dr;
                const nc = currentPos.col + dir.dc;

                if (!board.isValidPosition(nr, nc)) {
                    isFallTrigger = true;
                    break;
                }

                const tile = board.getTile(nr, nc);
                if (tile === MARKERS.STONE || tile === MARKERS.SNOW ||
                    (nr === otherPos.row && nc === otherPos.col)) {
                    break;
                }

                finalDest = { row: nr, col: nc };
                currentPos = { row: nr, col: nc };

                if (tile === MARKERS.WARP) break;

                const tileKey = `${nr},${nc}`;
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

            if (finalDest) {
                finalDest.isFallTrigger = isFallTrigger;
                finalDest.isDiagonal = diagonal;
                results.push(finalDest);
            }
        }

        // Deduplicate
        const seen = new Set();
        return results.filter(t => {
            const key = `${t.row},${t.col}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    manhattanDistance(a, b) {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    }

    chebyshevDistance(a, b) {
        return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    }

    // ===== Phase Detection =====

    detectPhase() {
        const board = this.game.board;
        let fountainExists = false;
        let stoneCount = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const tile = board.getTile(r, c);
                if (tile === MARKERS.FOUNTAIN) fountainExists = true;
                if (tile === MARKERS.STONE) stoneCount++;
            }
        }
        if (fountainExists) return 'fountain_rush';
        if (stoneCount < 20) return 'mid_game';
        return 'late_game';
    }

    findTargetFountain() {
        const board = this.game.board;
        const comPos = this.game.player2.getPosition();
        let closest = null;
        let minDist = Infinity;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board.getTile(r, c) === MARKERS.FOUNTAIN) {
                    const d = this.chebyshevDistance(comPos, { row: r, col: c });
                    if (d < minDist) {
                        minDist = d;
                        closest = { row: r, col: c };
                    }
                }
            }
        }
        return closest;
    }

    // ===== Fountain Rush: 3-Dice Planning =====

    // Returns the best current-turn move that leads to fountain within 2 future turns, or null
    // NOTE: By the time decideMovePhase runs, rollDice has already shifted the diceQueue.
    //   - game.diceRoll = current turn's dice (already used for movableTiles)
    //   - diceQueue[0] = NEXT turn's dice
    //   - diceQueue[1] = turn after next
    // So we use game.movableTiles as turn-0 candidates, then simulate future turns.
    planFountainRush() {
        const game = this.game;
        const player = game.player2;
        const oppPos = game.player1.getPosition();
        const board = game.board;
        const fountain = this.findTargetFountain();
        if (!fountain) return null;

        const dq = player.diceQueue; // [next_turn_dice, turn_after_dice, ...]
        const pts = player.points;
        let bestMove = null;
        let bestTurns = 4;
        let bestDist = Infinity;

        const isFountain = (t) => t.row === fountain.row && t.col === fountain.col;

        // Turn 0: use actual game.movableTiles (already computed from game.diceRoll)
        const fallSet = new Set(game.fallTriggerTiles.map(t => `${t.row},${t.col}`));
        const t0 = game.movableTiles.filter(t => !fallSet.has(`${t.row},${t.col}`));

        for (const m0 of t0) {
            const d0 = this.chebyshevDistance(m0, fountain);
            if (isFountain(m0)) {
                bestTurns = 1; bestMove = m0; bestDist = 0;
                return bestMove; // Can reach this turn, no need to search further
            }

            // Turn 1: simulate with diceQueue[0] (next turn's dice)
            if (bestTurns <= 1) continue;
            const diagCost = (game.moveMode === DIRECTION_TYPE.DIAGONAL) ? SKILL_COSTS.diagonal_move : 0;
            const pts1 = pts - diagCost + 10; // +10 turn bonus
            const t1 = this.simulateMovableTiles(m0, dq[0], board, oppPos, false)
                .concat(pts1 >= SKILL_COSTS.diagonal_move ?
                    this.simulateMovableTiles(m0, dq[0], board, oppPos, true) : [])
                .filter(t => !t.isFallTrigger);

            for (const m1 of t1) {
                if (isFountain(m1)) {
                    if (bestTurns > 2) { bestTurns = 2; bestMove = m0; bestDist = d0; }
                    continue;
                }

                // Turn 2: simulate with diceQueue[1]
                if (bestTurns <= 2) continue;
                const pts2 = pts1 - (m1.isDiagonal ? SKILL_COSTS.diagonal_move : 0) + 10;
                const t2 = this.simulateMovableTiles(m1, dq[1], board, oppPos, false)
                    .concat(pts2 >= SKILL_COSTS.diagonal_move ?
                        this.simulateMovableTiles(m1, dq[1], board, oppPos, true) : [])
                    .filter(t => !t.isFallTrigger);

                for (const m2 of t2) {
                    if (isFountain(m2)) {
                        if (bestTurns > 3) { bestTurns = 3; bestMove = m0; bestDist = d0; }
                    }
                }
            }

            // Track closest approach if no fountain path found yet
            if (!bestMove || (bestTurns >= 4 && d0 < bestDist)) {
                bestDist = d0;
                bestMove = m0;
            }
        }

        return bestMove;
    }

    // ===== Skill Selection =====

    decideSkillSelection() {
        if (this.game.winner) return;
        const skillScores = {
            'bomb_skill': 80, 'sniper_skill': 75, 'landshark_skill': 70,
            'domination_skill': 65, 'meteor_skill': 60, 'checkpoint_skill': 55,
            'kamakura_skill': 50, 'momonga_skill': 50, 'warp_skill': 45,
            'electromagnet_skill': 55, 'ice_skill': 40, 'swamp_skill': 35, 'suriashi_skill': 30
        };
        const skills = SKILL_ORDER;
        let chosen;
        if (this.isEasy()) {
            chosen = this.weightedPick(skills.map(s => ({ item: s, score: skillScores[s] || 50 })));
        } else {
            let best = skills[0], bestScore = 0;
            for (const s of skills) {
                const sc = skillScores[s] || 50;
                if (sc > bestScore) { bestScore = sc; best = s; }
            }
            chosen = best;
        }
        this.game.selectSkill(2, chosen);
    }

    // ===== Roll Phase =====

    decideRollPhase() {
        if (this.game.winner) return;
        const player = this.game.player2;

        if (player.isDominated()) {
            this.game.rollDice();
            this.scheduleMoveDirect();
            return;
        }

        const currentDice = player.diceQueue[0];
        const hasStock = player.stockedDice !== null;

        // Easy: simple stock logic (old Normal)
        if (this.isEasy()) {
            if (hasStock && player.stockedDice >= currentDice) {
                this.game.useStockedDice();
            } else if (!hasStock && currentDice === 1 &&
                player.canAfford(SKILL_COSTS.stock) &&
                player.diceQueue.length > 1 && player.diceQueue[1] >= 2) {
                this.game.stockCurrentDice();
            } else {
                this.game.rollDice();
            }
            this.scheduleMoveDirect();
            return;
        }

        // Advanced: compare stock vs current dice by move scoring
        if (hasStock) {
            const stockVal = player.stockedDice;
            const currentVal = currentDice;
            const myPos = player.getPosition();
            const oppPos = game.player1.getPosition();
            const board = game.board;

            const stockMoves = this.simulateMovableTiles(myPos, stockVal, board, oppPos, false)
                .filter(t => !t.isFallTrigger);
            const currentMoves = this.simulateMovableTiles(myPos, currentVal, board, oppPos, false)
                .filter(t => !t.isFallTrigger);

            const stockBest = stockMoves.length > 0
                ? Math.max(...stockMoves.map(t => this.scoreMoveTile(t))) : -Infinity;
            const currentBest = currentMoves.length > 0
                ? Math.max(...currentMoves.map(t => this.scoreMoveTile(t))) : -Infinity;

            // Use stock if it gives better moves, or if current dice has no safe moves
            if (stockBest >= currentBest || currentMoves.length === 0) {
                this.game.useStockedDice();
            } else {
                this.game.rollDice();
            }
            this.scheduleMoveDirect();
            return;
        }

        if (!hasStock && currentDice === 1 &&
            player.canAfford(SKILL_COSTS.stock) &&
            player.diceQueue.length > 1 && player.diceQueue[1] >= 2) {
            // Verify the next dice (after stocking) has safe moves before committing
            const nextDice = player.diceQueue[1];
            const myPos = player.getPosition();
            const oppPos = game.player1.getPosition();
            const board = game.board;
            const nextCross = this.simulateMovableTiles(myPos, nextDice, board, oppPos, false)
                .filter(t => !t.isFallTrigger);
            const nextDiag = this.simulateMovableTiles(myPos, nextDice, board, oppPos, true)
                .filter(t => !t.isFallTrigger);

            if (nextCross.length > 0 || nextDiag.length > 0) {
                this.game.stockCurrentDice();
            } else {
                // Next dice has no safe moves — don't stock, use current dice instead
                this.game.rollDice();
            }
            this.scheduleMoveDirect();
            return;
        }

        this.game.rollDice();
        this.scheduleMoveDirect();
    }

    scheduleMoveDirect() {
        if (this.game.winner) return;
        if (this.game.phase === PHASES.MOVE) {
            this.executeAfterDelay(() => this.decideMovePhase(), 'MOVE');
        }
    }

    // ===== Move Phase =====

    decideMovePhase() {
        if (this.game.winner) return;
        const game = this.game;
        const player = game.player2;

        // Diagonal toggle logic (shared across difficulties)
        if (game.moveMode === DIRECTION_TYPE.CROSS &&
            player.canAfford(SKILL_COSTS.diagonal_move)) {

            const crossTiles = [...game.movableTiles];
            const fallSet = new Set(game.fallTriggerTiles.map(t => `${t.row},${t.col}`));
            const crossSafe = crossTiles.filter(t => !fallSet.has(`${t.row},${t.col}`));

            if (crossSafe.length === 0) {
                const toggled = game.toggleMoveMode();
                // If toggle failed (can't afford), stay in cross mode with fall triggers
                if (!toggled) {
                    // Will use fall triggers as candidates below
                }
            } else if (this.isAdvanced()) {
                const crossBest = this.scoreMoves(crossTiles);
                const toggled = game.toggleMoveMode();
                if (toggled) {
                    const diagTiles = [...game.movableTiles];
                    const diagBest = this.scoreMoves(diagTiles);
                    // Diagonal needs to be significantly better to justify 10pt cost
                    if (diagBest <= crossBest + 25) {
                        game.toggleMoveMode(); // switch back to cross
                    }
                }
            }
        }

        // Filter fall triggers
        const fallSet = new Set(game.fallTriggerTiles.map(t => `${t.row},${t.col}`));
        const safeTiles = game.movableTiles.filter(t => !fallSet.has(`${t.row},${t.col}`));
        let candidates = safeTiles.length > 0 ? safeTiles : game.movableTiles;

        // Freeze prevention: if candidates is empty, recover
        if (candidates.length === 0) {
            // Check current mode's tiles (including fall triggers) BEFORE toggling
            let fallbacks = game.movableTiles.concat(game.fallTriggerTiles);

            if (fallbacks.length === 0) {
                // Current mode truly empty — try the other mode
                game.toggleMoveMode();
                fallbacks = game.movableTiles.concat(game.fallTriggerTiles);
            }

            if (fallbacks.length > 0) {
                // Check if any safe (non-fall-trigger) tiles exist
                const ftSet = new Set(game.fallTriggerTiles.map(f => `${f.row},${f.col}`));
                const hasSafe = fallbacks.some(t => !ftSet.has(`${t.row},${t.col}`));
                if (hasSafe) {
                    candidates = fallbacks;
                } else {
                    // Only fall trigger tiles — COM falls off the cliff (same as human player)
                    game.gameOver(game.currentTurn === 1 ? 2 : 1, 'was electrocuted!');
                    return;
                }
            } else {
                // Both modes empty (shouldn't happen after rollDice hasAnyMovableTile check)
                return;
            }
        }

        // Advanced: use fountain plan if in fountain rush
        if (this.isAdvanced()) {
            const phase = this.detectPhase();
            if (phase === 'fountain_rush') {
                const planned = this.planFountainRush();
                if (planned) {
                    const match = candidates.find(c => c.row === planned.row && c.col === planned.col);
                    if (match) {
                        game.movePlayer(match.row, match.col);
                        return;
                    }
                }
            }
        }

        const chosen = this.pickBestTile(candidates, t => this.scoreMoveTile(t));
        game.movePlayer(chosen.row, chosen.col);
    }

    // ===== Move Scoring Dispatcher =====

    scoreMoveTile(tile) {
        if (this.isEasy()) return this.scoreMoveTileLegacy(tile);
        const phase = this.detectPhase();
        switch (phase) {
            case 'fountain_rush': return this.scoreMoveFountainRush(tile);
            case 'mid_game': return this.scoreMoveMidGame(tile);
            case 'late_game': return this.scoreMoveLateGame(tile);
            default: return this.scoreMoveMidGame(tile);
        }
    }

    scoreMoves(tiles) {
        if (tiles.length === 0) return -Infinity;
        const fallSet = new Set(this.game.fallTriggerTiles.map(t => `${t.row},${t.col}`));
        let best = -Infinity;
        for (const t of tiles) {
            if (fallSet.has(`${t.row},${t.col}`)) continue;
            const s = this.scoreMoveTile(t);
            if (s > best) best = s;
        }
        return best === -Infinity ? -9999 : best;
    }

    // --- Fountain Rush Move Scoring ---
    scoreMoveFountainRush(tile) {
        const game = this.game;
        const board = game.board;
        const oppPos = game.player1.getPosition();
        const fountain = this.findTargetFountain();
        let score = 0;

        const tileType = board.getTile(tile.row, tile.col);

        // Death avoidance
        if (tileType === MARKERS.BOMB && board.getBombOwner(tile.row, tile.col) === 1) return -99999;

        // Landing on fountain = massive bonus
        if (tileType === MARKERS.FOUNTAIN) score += 500;

        // Distance to fountain
        if (fountain) {
            score += (14 - this.chebyshevDistance(tile, fountain)) * 25;
        }

        // Placement options (survival)
        const placement = this.countPlacementOptions(tile.row, tile.col, board, oppPos);
        if (placement === 0) score -= 200;
        score += placement * 5;

        // Safety
        if (tileType === MARKERS.ICE) score += 15;
        if (tileType === MARKERS.SWAMP) score -= 15;
        const dist = this.manhattanDistance(tile, oppPos);
        if (dist === 1) score -= 30;

        return score;
    }

    // --- Mid Game Move Scoring ---
    scoreMoveMidGame(tile) {
        const game = this.game;
        const board = game.board;
        const oppPos = game.player1.getPosition();
        let score = 0;

        const tileType = board.getTile(tile.row, tile.col);
        if (tileType === MARKERS.BOMB && board.getBombOwner(tile.row, tile.col) === 1) return -99999;

        // Territory evaluation from this position
        const myTerritory = this.floodFillTerritory(tile.row, tile.col, board, oppPos).count;
        const oppTerritory = this.floodFillTerritory(oppPos.row, oppPos.col, board,
            { row: tile.row, col: tile.col }).count;
        score += (myTerritory - oppTerritory) * 10;

        // Placement options
        const placement = this.countPlacementOptions(tile.row, tile.col, board, oppPos);
        if (placement === 0) score -= 500;
        score += placement * 15;

        // Tile bonuses
        if (tileType === MARKERS.FOUNTAIN) score += 200;
        if (tileType === MARKERS.ICE) score += 10;
        if (tileType === MARKERS.SWAMP) score -= 10;
        if (tileType === MARKERS.WARP) score -= 5;

        // Safety
        const dist = this.manhattanDistance(tile, oppPos);
        if (dist === 1) score -= 25;

        // Centrality (more options in the center)
        const centerDist = this.chebyshevDistance(tile, { row: 4, col: 4 });
        score += (4 - centerDist) * 3;

        return score;
    }

    // --- Late Game Move Scoring ---
    scoreMoveLateGame(tile) {
        const game = this.game;
        const board = game.board;
        const oppPos = game.player1.getPosition();
        let score = 0;

        const tileType = board.getTile(tile.row, tile.col);
        if (tileType === MARKERS.BOMB && board.getBombOwner(tile.row, tile.col) === 1) return -99999;

        // Territory is critical
        const myTerritory = this.floodFillTerritory(tile.row, tile.col, board, oppPos).count;
        const oppTerritory = this.floodFillTerritory(oppPos.row, oppPos.col, board,
            { row: tile.row, col: tile.col }).count;
        score += (myTerritory - oppTerritory) * 20;
        score += myTerritory * 5;

        // Survival is paramount
        const placement = this.countPlacementOptions(tile.row, tile.col, board, oppPos);
        if (placement === 0) score -= 1000;
        if (placement === 1) score -= 100;
        score += placement * 25;

        // Safety
        if (tileType === MARKERS.FOUNTAIN) score += 200;
        const dist = this.manhattanDistance(tile, oppPos);
        if (dist === 1) score -= 30;

        return score;
    }

    // --- Legacy Move Scoring (for Easy) ---
    scoreMoveTileLegacy(tile) {
        const game = this.game;
        const oPos = game.player1.getPosition();
        let score = 0;
        score += (BOARD_SIZE - 1 - tile.col) * 15;
        const tileType = game.board.getTile(tile.row, tile.col);
        if (tileType === MARKERS.FOUNTAIN) score += 200;
        if (tileType === MARKERS.ICE) score += 10;
        if (tileType === MARKERS.WARP) score -= 10;
        const dist = Math.abs(tile.row - oPos.row) + Math.abs(tile.col - oPos.col);
        if (dist === 1) score -= 25;
        if (tileType === MARKERS.BOMB && game.board.getBombOwner(tile.row, tile.col) === 1) score -= 9999;
        if (tileType === MARKERS.SWAMP) score -= 10;
        return score;
    }

    // ===== Place Phase =====

    decidePlacePhase() {
        if (this.game.winner) return;
        const game = this.game;
        const player = game.player2;

        // Forced drill
        if (game.phase === PHASES.DRILL_TARGET) {
            this.executeAfterDelay(() => this.decideDrillTarget(), 'DRILL');
            return;
        }

        if (this.isAdvanced() && !player.isDominated()) {
            // Step 1: Strategic BOMB decision
            if (player.specialSkill === SPECIAL_SKILLS.BOMB && this.shouldUseBomb()) {
                const result = game.activateSkill();
                if (result && game.phase === PHASES.PLACE) {
                    this.executeAfterDelay(() => this.decideBombPlacement(), 'SKILL_TARGET');
                    return;
                }
            }

            // Step 2: Other skills (non-BOMB)
            if (this.tryUseSkill(true)) return;

            // Step 3: Drill (territory-aware)
            if (player.canAfford(SKILL_COSTS.drill)) {
                if (this.evaluateDrillAdvanced() > 0) {
                    game.setPlacementType('drill');
                    if (game.phase === PHASES.DRILL_TARGET) {
                        this.executeAfterDelay(() => this.decideDrillTarget(), 'DRILL');
                        return;
                    }
                }
            }
        } else if (!player.isDominated()) {
            // Easy: existing skill logic
            if (this.tryUseSkill(false)) return;
            if (player.canAfford(SKILL_COSTS.drill)) {
                if (this.evaluateDrillLegacy() > 50) {
                    game.setPlacementType('drill');
                    if (game.phase === PHASES.DRILL_TARGET) {
                        this.executeAfterDelay(() => this.decideDrillTarget(), 'DRILL');
                        return;
                    }
                }
            }
        }

        // Step 4: Place stone
        game.placementType = 'stone';
        game.findPlaceableTiles();

        if (game.placeableTiles.length === 0) {
            if (game.phase === PHASES.DRILL_TARGET) {
                this.executeAfterDelay(() => this.decideDrillTarget(), 'DRILL');
                return;
            }
            // No placeable tiles — try drill as last resort
            if (!player.isDominated() && player.canAfford(SKILL_COSTS.drill)) {
                game.setPlacementType('drill');
                if (game.phase === PHASES.DRILL_TARGET) {
                    this.executeAfterDelay(() => this.decideDrillTarget(), 'DRILL');
                    return;
                }
            }
            // Game should have triggered game over via canUseDrillToSurvive already
            return;
        }

        const chosen = this.pickBestTile(game.placeableTiles, t => this.scorePlaceTile(t));
        game.placeObject(chosen.row, chosen.col);
    }

    // ===== Place Scoring Dispatcher =====

    scorePlaceTile(tile) {
        if (this.isEasy()) return this.scorePlaceTileLegacy(tile);
        const phase = this.detectPhase();
        switch (phase) {
            case 'fountain_rush': return this.scorePlaceFountainRush(tile);
            case 'mid_game': return this.scorePlaceMidGame(tile);
            case 'late_game': return this.scorePlaceLateGame(tile);
            default: return this.scorePlaceMidGame(tile);
        }
    }

    // --- Fountain Rush Place Scoring ---
    scorePlaceFountainRush(tile) {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        const fountain = this.findTargetFountain();
        let score = 0;

        // Territory impact
        const before = {
            my: this.floodFillTerritory(myPos.row, myPos.col, board, oppPos),
            opp: this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos)
        };
        const after = this.simulatePlaceTerritory(tile.row, tile.col, myPos, oppPos, board);

        const oppDelta = after.oppTerritory - before.opp.count;
        const myDelta = after.myTerritory - before.my.count;

        score += (-oppDelta) * 8;
        score += myDelta * 3;

        // CRITICAL: Don't block path to fountain
        if (fountain && after.myVisited && !after.myVisited.has(`${fountain.row},${fountain.col}`)) {
            score -= 100;
        }

        // Survival safety
        const placementAfter = this.countPlacementOptionsAfterStone(tile, myPos, board, oppPos);
        if (placementAfter <= 1) score -= 200;

        return score;
    }

    // --- Mid Game Place Scoring ---
    scorePlaceMidGame(tile) {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        let score = 0;

        const beforeMy = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos).count;
        const beforeOpp = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos).count;
        const after = this.simulatePlaceTerritory(tile.row, tile.col, myPos, oppPos, board);

        const myDelta = after.myTerritory - beforeMy;
        const oppDelta = after.oppTerritory - beforeOpp;
        const netDelta = (after.myTerritory - after.oppTerritory) - (beforeMy - beforeOpp);

        score += netDelta * 15;
        score += (-oppDelta) * 10;
        score += myDelta * 5;

        // Wall formation bonus
        if (after.oppTerritory < beforeOpp * 0.7) score += 30;

        // Opponent squeeze
        const oppPlacement = this.countPlacementOptions(oppPos.row, oppPos.col, board, myPos);
        // Recount after placement
        const original = board.getTile(tile.row, tile.col);
        board.setTile(tile.row, tile.col, MARKERS.STONE);
        const oppPlacementAfter = this.countPlacementOptions(oppPos.row, oppPos.col, board, myPos);
        board.setTile(tile.row, tile.col, original);
        if (oppPlacementAfter <= 1) score += 40;

        // Survival safety
        const myPlacementAfter = this.countPlacementOptionsAfterStone(tile, myPos, board, oppPos);
        if (myPlacementAfter <= 1) score -= 2000;

        return score;
    }

    // --- Late Game Place Scoring ---
    scorePlaceLateGame(tile) {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        let score = 0;

        const beforeOpp = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos).count;
        const beforeMy = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos).count;
        const after = this.simulatePlaceTerritory(tile.row, tile.col, myPos, oppPos, board);

        const oppDelta = after.oppTerritory - beforeOpp;
        const myDelta = after.myTerritory - beforeMy;

        score += (-oppDelta) * 20;
        score += (after.myTerritory - after.oppTerritory) * 15;
        score += myDelta * 8;

        if (after.oppTerritory <= 1) score += 200;
        if (after.myTerritory <= 2) score -= 500;

        // Survival safety (highest priority in late game)
        const myPlacementAfter = this.countPlacementOptionsAfterStone(tile, myPos, board, oppPos);
        if (myPlacementAfter <= 1) score -= 2000;

        return score;
    }

    // --- Legacy Place Scoring (for Easy) ---
    scorePlaceTileLegacy(tile) {
        const oPos = this.game.player1.getPosition();
        const pPos = this.game.player2.getPosition();
        let score = 0;
        if (tile.col > oPos.col) score += 15;
        if (tile.row === oPos.row && tile.col === oPos.col + 1) score += 30;
        const dist = Math.abs(tile.row - oPos.row) + Math.abs(tile.col - oPos.col);
        if (dist <= 2) score += 10;
        if (tile.col < pPos.col) score -= 15;
        if (tile.row === pPos.row && tile.col === pPos.col - 1) score -= 25;
        return score;
    }

    // Helper: count placement options after placing a stone
    countPlacementOptionsAfterStone(stoneTile, myPos, board, oppPos) {
        const original = board.getTile(stoneTile.row, stoneTile.col);
        board.setTile(stoneTile.row, stoneTile.col, MARKERS.STONE);
        const count = this.countPlacementOptions(myPos.row, myPos.col, board, oppPos);
        board.setTile(stoneTile.row, stoneTile.col, original);
        return count;
    }

    // ===== BOMB Strategy =====

    shouldUseBomb() {
        const game = this.game;
        const player = game.player2;
        const board = game.board;
        const myPos = player.getPosition();
        const oppPos = game.player1.getPosition();

        if (player.specialSkill !== SPECIAL_SKILLS.BOMB) return false;
        if (!player.canAfford(SKILL_COSTS.bomb)) return false;

        const phase = this.detectPhase();
        if (phase === 'fountain_rush') return false; // Save points early

        // Check if there are valid bomb placement tiles (empty adjacent)
        let hasEmptyAdjacent = false;
        for (const dir of CROSS_DIRECTIONS) {
            const nr = myPos.row + dir.dr;
            const nc = myPos.col + dir.dc;
            if (board.isValidPosition(nr, nc) &&
                board.getTile(nr, nc) === MARKERS.EMPTY &&
                !(nr === oppPos.row && nc === oppPos.col)) {
                hasEmptyAdjacent = true;
                break;
            }
        }
        if (!hasEmptyAdjacent) return false;

        const bestBombScore = this.getBestBombScore();
        const bestStoneScore = this.getBestStoneScore();
        const points = player.points;
        const oppTerritory = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos).count;

        // Condition 1: Bomb significantly reduces opponent territory (choke point)
        if (bestBombScore >= 60) return true;

        // Condition 2: Bomb is better than stone placement
        if (bestBombScore > bestStoneScore * 0.8 && bestBombScore >= 30) return true;

        // Condition 3: High points with nothing better to do
        if (points >= 200 && bestBombScore >= 40) return true;

        // Condition 4: Opponent is constrained
        if (oppTerritory <= 6 && this.manhattanDistance(myPos, oppPos) <= 4 && bestBombScore >= 30) return true;

        // Condition 5: All stone placements hurt own territory
        if (bestStoneScore < -50 && bestBombScore >= 20) return true;

        return false;
    }

    getBestBombScore() {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        let best = -Infinity;

        for (const dir of CROSS_DIRECTIONS) {
            const nr = myPos.row + dir.dr;
            const nc = myPos.col + dir.dc;
            if (!board.isValidPosition(nr, nc)) continue;
            if (board.getTile(nr, nc) !== MARKERS.EMPTY) continue;
            if (nr === oppPos.row && nc === oppPos.col) continue;
            const s = this.scoreBombPlacement({ row: nr, col: nc });
            if (s > best) best = s;
        }
        return best === -Infinity ? -999 : best;
    }

    getBestStoneScore() {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        let best = -Infinity;

        for (const dir of CROSS_DIRECTIONS) {
            const nr = myPos.row + dir.dr;
            const nc = myPos.col + dir.dc;
            if (!board.isValidPosition(nr, nc)) continue;
            if (nr === oppPos.row && nc === oppPos.col) continue;
            const tile = board.getTile(nr, nc);
            if (tile === MARKERS.STONE || tile === MARKERS.SNOW) continue;
            const s = this.scorePlaceTile({ row: nr, col: nc });
            if (s > best) best = s;
        }
        return best === -Infinity ? -999 : best;
    }

    scoreBombPlacement(tile) {
        const game = this.game;
        const board = game.board;
        const myPos = game.player2.getPosition();
        const oppPos = game.player1.getPosition();
        let score = 0;

        // Opponent territory BEFORE bomb
        const oppBefore = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos).count;

        // Treat bomb as wall for opponent (they won't step on it voluntarily)
        const original = board.getTile(tile.row, tile.col);
        board.setTile(tile.row, tile.col, MARKERS.STONE);
        const oppAfter = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos).count;
        board.setTile(tile.row, tile.col, original);

        const reduction = oppBefore - oppAfter;
        const reductionRatio = oppBefore > 0 ? reduction / oppBefore : 0;
        score += reductionRatio * 100;

        // Proximity to opponent
        const dist = this.manhattanDistance(tile, oppPos);
        if (dist <= 2) score += 20;
        if (dist === 1) score += 40;
        if (dist > 5) score -= 20;

        // Opponent constraint bonus
        const oppPlacement = this.countPlacementOptions(oppPos.row, oppPos.col, board, myPos);
        if (oppPlacement <= 2) score += 30;

        // Ensure bomb is in opponent's territory (not ours)
        const oppTerritory = this.floodFillTerritory(oppPos.row, oppPos.col, board, myPos);
        if (!oppTerritory.visited.has(`${tile.row},${tile.col}`)) score -= 100;
        const myTerritory = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos);
        if (myTerritory.visited.has(`${tile.row},${tile.col}`)) score -= 50;

        return score;
    }

    decideBombPlacement() {
        if (this.game.winner) return;
        const game = this.game;
        if (game.placeableTiles.length === 0) return;
        const chosen = this.pickBestTile(game.placeableTiles, t => this.scoreBombPlacement(t));
        game.placeObject(chosen.row, chosen.col);
    }

    // ===== Drill =====

    evaluateDrillAdvanced() {
        const game = this.game;
        const player = game.player2;
        const board = game.board;
        const myPos = player.getPosition();
        const oppPos = game.player1.getPosition();

        if (!player.canAfford(SKILL_COSTS.drill) || player.isDominated()) return -999;

        const currentTerritory = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos).count;
        let bestGain = -Infinity;

        for (const dir of CROSS_DIRECTIONS) {
            const r = myPos.row + dir.dr;
            const c = myPos.col + dir.dc;
            if (!board.isValidPosition(r, c) || board.getTile(r, c) !== MARKERS.STONE) continue;

            // Simulate drilling this stone
            board.setTile(r, c, MARKERS.EMPTY);
            const newTerritory = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos).count;
            board.setTile(r, c, MARKERS.STONE);

            const gain = newTerritory - currentTerritory;
            if (gain > bestGain) bestGain = gain;
        }

        // Return positive if drilling opens significant territory (worth 100pt cost)
        // Need to gain at least 5 territory to justify 100pt
        return bestGain >= 5 ? bestGain * 10 : -999;
    }

    evaluateDrillLegacy() {
        const pPos = this.game.player2.getPosition();
        let bestValue = 0;
        for (const dir of CROSS_DIRECTIONS) {
            const r = pPos.row + dir.dr;
            const c = pPos.col + dir.dc;
            if (this.game.board.isValidPosition(r, c) &&
                this.game.board.getTile(r, c) === MARKERS.STONE) {
                if (c < pPos.col) bestValue = Math.max(bestValue, 60);
                else bestValue = Math.max(bestValue, 20);
            }
        }
        return bestValue;
    }

    decideDrillTarget() {
        if (this.game.winner) return;
        const game = this.game;
        if (game.drillTargetTiles.length === 0) return;

        let chosen;
        if (this.isAdvanced()) {
            const myPos = game.player2.getPosition();
            const oppPos = game.player1.getPosition();
            const board = game.board;

            chosen = this.pickBestTile(game.drillTargetTiles, t => {
                board.setTile(t.row, t.col, MARKERS.EMPTY);
                const territory = this.floodFillTerritory(myPos.row, myPos.col, board, oppPos).count;
                board.setTile(t.row, t.col, MARKERS.STONE);
                return territory;
            });
        } else {
            chosen = this.pickBestTile(game.drillTargetTiles, t => {
                const pPos = game.player2.getPosition();
                let score = 0;
                if (t.col < pPos.col) score += 30;
                if (t.row === pPos.row) score += 10;
                return score;
            });
        }

        game.useDrill(chosen.row, chosen.col);
    }

    // ===== Skill Usage =====

    tryUseSkill(skipBomb = false) {
        const game = this.game;
        const player = game.player2;
        const skill = player.specialSkill;

        if (!skill || player.isDominated()) return false;
        const costKey = game.getSkillKey(skill);
        if (!costKey || !player.canAfford(SKILL_COSTS[costKey])) return false;

        switch (skill) {
            case SPECIAL_SKILLS.BOMB:
                if (skipBomb) return false;
                // fallthrough for Easy mode
                /* falls through */
            case SPECIAL_SKILLS.ICE:
            case SPECIAL_SKILLS.SWAMP:
            case SPECIAL_SKILLS.WARP:
            case SPECIAL_SKILLS.ELECTROMAGNET: {
                const result = game.activateSkill();
                if (result && game.phase === PHASES.PLACE) {
                    this.executeAfterDelay(() => this.decideSkillPlacement(), 'SKILL_TARGET');
                    return true;
                }
                return result;
            }

            case SPECIAL_SKILLS.LANDSHARK:
                if (game.checkLandsharkCondition()) {
                    game.activateLandshark();
                    return true;
                }
                return false;

            case SPECIAL_SKILLS.SNIPER:
                if (game.checkSniperCondition()) {
                    game.activateSniper();
                    return true;
                }
                return false;

            case SPECIAL_SKILLS.DOMINATION:
                game.useDomination();
                return true;

            case SPECIAL_SKILLS.CHECKPOINT:
                return this.tryUseCheckpoint();

            case SPECIAL_SKILLS.SURIASHI:
            case SPECIAL_SKILLS.MOMONGA: {
                const result = game.activateSkill();
                if (result && game.phase === PHASES.SKILL_TARGET) {
                    this.executeAfterDelay(() => this.decideSkillTarget(), 'SKILL_TARGET');
                    return true;
                }
                return result;
            }

            case SPECIAL_SKILLS.METEOR: {
                const result = game.activateMeteor();
                if (result) {
                    this.executeAfterDelay(() => this.decideSkillTarget(), 'SKILL_TARGET');
                    return true;
                }
                return false;
            }

            case SPECIAL_SKILLS.KAMAKURA: {
                const patterns = game.findKamakuraPatterns();
                if (patterns.length > 0) {
                    const result = game.activateKamakura();
                    if (result) {
                        this.executeAfterDelay(() => this.decideSkillTarget(), 'SKILL_TARGET');
                        return true;
                    }
                }
                return false;
            }
        }
        return false;
    }

    tryUseCheckpoint() {
        const game = this.game;
        const player = game.player2;
        if (player.hasCheckpoint()) {
            const cp = player.getCheckpoint();
            const pPos = player.getPosition();
            // Teleport if checkpoint has better territory
            if (this.isAdvanced()) {
                const board = game.board;
                const oppPos = game.player1.getPosition();
                const currentTerritory = this.floodFillTerritory(pPos.row, pPos.col, board, oppPos).count;
                const cpTerritory = this.floodFillTerritory(cp.row, cp.col, board, oppPos).count;
                if (cpTerritory > currentTerritory) {
                    game.useCheckpoint();
                    return true;
                }
            } else if (cp.col < pPos.col) {
                game.useCheckpoint();
                return true;
            }
        } else {
            game.useCheckpoint();
            return true;
        }
        return false;
    }

    decideSkillPlacement() {
        if (this.game.winner) return;
        const game = this.game;
        if (game.placeableTiles.length === 0) return;
        const chosen = this.pickBestTile(game.placeableTiles, t => this.scorePlaceTile(t));
        game.placeObject(chosen.row, chosen.col);
    }

    decideSkillTarget() {
        if (this.game.winner) return;
        const game = this.game;
        if (game.skillTargetTiles.length === 0) return;

        const skillType = game.activeSkillType;
        let chosen;

        switch (skillType) {
            case SPECIAL_SKILLS.SURIASHI:
            case SPECIAL_SKILLS.MOMONGA:
                if (this.isAdvanced()) {
                    const board = game.board;
                    const oppPos = game.player1.getPosition();
                    chosen = this.pickBestTile(game.skillTargetTiles, t => {
                        const territory = this.floodFillTerritory(t.row, t.col, board, oppPos).count;
                        const placement = this.countPlacementOptions(t.row, t.col, board, oppPos);
                        let score = territory * 5 + placement * 15;
                        if (placement === 0) score -= 500;
                        const dist = this.manhattanDistance(t, oppPos);
                        if (dist === 1) score -= 30;
                        return score;
                    });
                } else {
                    chosen = this.pickBestTile(game.skillTargetTiles, t => {
                        let score = (BOARD_SIZE - 1 - t.col) * 15;
                        const oPos = game.player1.getPosition();
                        const dist = Math.abs(t.row - oPos.row) + Math.abs(t.col - oPos.col);
                        if (dist === 1) score -= 20;
                        return score;
                    });
                }
                if (skillType === SPECIAL_SKILLS.SURIASHI) {
                    game.executeSuriashi(chosen.row, chosen.col);
                } else {
                    game.executeMomonga(chosen.row, chosen.col);
                }
                break;

            case SPECIAL_SKILLS.METEOR:
                if (this.isAdvanced()) {
                    const board = game.board;
                    const myPos = game.player2.getPosition();
                    const oppPos = game.player1.getPosition();
                    chosen = this.pickBestTile(game.skillTargetTiles, t => {
                        return this.scorePlaceTile(t);
                    });
                } else {
                    chosen = this.pickBestTile(game.skillTargetTiles, t => {
                        const oPos = game.player1.getPosition();
                        let score = 0;
                        if (t.col > oPos.col && Math.abs(t.row - oPos.row) <= 1) score += 40;
                        if (t.row === oPos.row && t.col === oPos.col + 1) score += 30;
                        const pPos = game.player2.getPosition();
                        if (t.col < pPos.col && Math.abs(t.row - pPos.row) <= 1) score -= 30;
                        return score;
                    });
                }
                game.executeMeteor(chosen.row, chosen.col);
                break;

            case SPECIAL_SKILLS.KAMAKURA:
                chosen = game.skillTargetTiles[0];
                game.executeKamakura(chosen.row, chosen.col);
                break;

            default:
                chosen = game.skillTargetTiles[0];
                break;
        }
    }

    // ===== Warp Select =====

    decideWarpSelect() {
        if (this.game.winner) return;
        const game = this.game;
        if (game.warpSelectTiles.length === 0) return;

        let chosen;
        if (this.isAdvanced()) {
            const board = game.board;
            const oppPos = game.player1.getPosition();
            chosen = this.pickBestTile(game.warpSelectTiles, t => {
                const territory = this.floodFillTerritory(t.row, t.col, board, oppPos).count;
                const placement = this.countPlacementOptions(t.row, t.col, board, oppPos);
                let score = territory * 5 + placement * 15;
                if (placement === 0) score -= 500;
                const dist = this.manhattanDistance(t, oppPos);
                if (dist === 1) score -= 30;
                return score;
            });
        } else {
            chosen = this.pickBestTile(game.warpSelectTiles, t => {
                let score = (BOARD_SIZE - 1 - t.col) * 20;
                const oPos = game.player1.getPosition();
                const dist = Math.abs(t.row - oPos.row) + Math.abs(t.col - oPos.col);
                if (dist === 1) score -= 30;
                return score;
            });
        }

        game.completeWarp(chosen.row, chosen.col);
    }

    // ===== Utility Functions =====

    pickBestTile(tiles, scoreFn) {
        if (tiles.length === 0) return null;
        if (tiles.length === 1) return tiles[0];
        const scored = tiles.map(t => ({ tile: t, score: scoreFn(t) }));
        scored.sort((a, b) => b.score - a.score);
        return scored[0].tile;
    }

    weightedPick(items) {
        if (items.length === 0) return null;
        if (items.length === 1) return items[0].item;
        const minScore = Math.min(...items.map(i => i.score));
        const adjusted = items.map(i => ({ item: i.item, weight: i.score - minScore + 1 }));
        const totalWeight = adjusted.reduce((sum, i) => sum + i.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const entry of adjusted) {
            rand -= entry.weight;
            if (rand <= 0) return entry.item;
        }
        return items[items.length - 1].item;
    }
}
