// Game Log (棋譜) System
class GameLog {
    constructor() {
        this.reset();
    }

    reset() {
        this.entries = [];
        this.turnCounter = 0;
        this.setupData = null;
    }

    recordSetup(game) {
        this.setupData = {
            timestamp: new Date().toISOString(),
            gameMode: game.gameMode,
            comDifficulty: game.comDifficulty,
            firstTurn: game.currentTurn,
            skillCosts: { ...SKILL_COSTS },
            player1: {
                position: { row: game.player1.row, col: game.player1.col },
                skill: game.player1.specialSkill,
                diceQueue: [...game.player1.diceQueue]
            },
            player2: {
                position: { row: game.player2.row, col: game.player2.col },
                skill: game.player2.specialSkill,
                diceQueue: [...game.player2.diceQueue]
            },
            board: this.snapshotBoard(game.board),
            fountains: this.findMarkers(game.board, MARKERS.FOUNTAIN),
            stones: this.findMarkers(game.board, MARKERS.STONE)
        };
    }

    log(action, data) {
        this.entries.push({
            seq: this.entries.length,
            turn: this.turnCounter,
            player: data.player || null,
            action: action,
            data: data,
            t: Math.round(performance.now())
        });
    }

    incrementTurn() {
        this.turnCounter++;
    }

    snapshotBoard(board) {
        return board.tiles.map(row => [...row]);
    }

    findMarkers(board, marker) {
        const result = [];
        for (let r = 0; r < board.size; r++) {
            for (let c = 0; c < board.size; c++) {
                if (board.getTile(r, c) === marker) {
                    result.push({ row: r, col: c });
                }
            }
        }
        return result;
    }

    toJSON() {
        return JSON.stringify({
            setup: this.setupData,
            log: this.entries
        }, null, 2);
    }
}
