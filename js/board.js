// Board Management Class
class Board {
    constructor(size = BOARD_SIZE) {
        this.size = size;
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {}; // key: "row,col" -> playerNum
        this.checkpointOwners = {}; // key: "row,col" -> playerNum
        this.snowTurnsLeft = {}; // key: "row,col" -> turns remaining
    }

    createEmptyBoard() {
        const board = [];
        for (let r = 0; r < this.size; r++) {
            board[r] = [];
            for (let c = 0; c < this.size; c++) {
                board[r][c] = MARKERS.EMPTY;
            }
        }
        return board;
    }

    getTile(row, col) {
        if (this.isValidPosition(row, col)) {
            return this.tiles[row][col];
        }
        return null;
    }

    setTile(row, col, marker) {
        if (this.isValidPosition(row, col)) {
            this.tiles[row][col] = marker;
            return true;
        }
        return false;
    }

    setBomb(row, col, playerNum) {
        if (this.isValidPosition(row, col)) {
            this.tiles[row][col] = MARKERS.BOMB;
            this.bombOwners[`${row},${col}`] = playerNum;
            return true;
        }
        return false;
    }

    getBombOwner(row, col) {
        return this.bombOwners[`${row},${col}`] || null;
    }

    setCheckpoint(row, col, playerNum) {
        if (this.isValidPosition(row, col)) {
            this.tiles[row][col] = MARKERS.CHECKPOINT;
            this.checkpointOwners[`${row},${col}`] = playerNum;
            return true;
        }
        return false;
    }

    getCheckpointOwner(row, col) {
        return this.checkpointOwners[`${row},${col}`] || null;
    }

    setSnow(row, col, turns) {
        if (this.isValidPosition(row, col)) {
            this.tiles[row][col] = MARKERS.SNOW;
            this.snowTurnsLeft[`${row},${col}`] = turns;
            return true;
        }
        return false;
    }

    getSnowTurns(row, col) {
        return this.snowTurnsLeft[`${row},${col}`] || 0;
    }

    tickSnow() {
        const toRemove = [];
        for (const key in this.snowTurnsLeft) {
            this.snowTurnsLeft[key]--;
            if (this.snowTurnsLeft[key] <= 0) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) {
            const [r, c] = key.split(',').map(Number);
            this.tiles[r][c] = MARKERS.EMPTY;
            delete this.snowTurnsLeft[key];
        }
    }

    removeCheckpoint(row, col) {
        const key = `${row},${col}`;
        if (this.checkpointOwners[key]) {
            delete this.checkpointOwners[key];
            this.tiles[row][col] = MARKERS.EMPTY;
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    reset() {
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {};
        this.checkpointOwners = {};
        this.snowTurnsLeft = {};
    }
}
