// Shared Board Class (used by both server and client)
// Requires: shared/constants.js (BOARD_SIZE, MARKERS)

// In Node.js, load constants; in browser, they're already global via <script>
if (typeof require !== 'undefined' && typeof BOARD_SIZE === 'undefined') {
    const c = require('./constants');
    Object.keys(c).forEach(k => { if (typeof globalThis[k] === 'undefined') globalThis[k] = c[k]; });
}

class Board {
    constructor(size = BOARD_SIZE) {
        this.size = size;
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {};
        this.checkpointOwners = {};
        this.snowTurnsLeft = {};
        this.electromagnetOwners = {};
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

    setElectromagnet(row, col, playerNum) {
        if (this.isValidPosition(row, col)) {
            this.tiles[row][col] = MARKERS.ELECTROMAGNET;
            this.electromagnetOwners[`${row},${col}`] = playerNum;
            return true;
        }
        return false;
    }

    getElectromagnetOwner(row, col) {
        return this.electromagnetOwners[`${row},${col}`] || null;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    reset() {
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {};
        this.checkpointOwners = {};
        this.snowTurnsLeft = {};
        this.electromagnetOwners = {};
    }

    // Serialize for network transfer
    serialize() {
        return {
            tiles: this.tiles,
            bombOwners: this.bombOwners,
            checkpointOwners: this.checkpointOwners,
            snowTurnsLeft: this.snowTurnsLeft,
            electromagnetOwners: this.electromagnetOwners
        };
    }

    // Restore from serialized data
    deserialize(data) {
        this.tiles = data.tiles;
        this.bombOwners = data.bombOwners || {};
        this.checkpointOwners = data.checkpointOwners || {};
        this.snowTurnsLeft = data.snowTurnsLeft || {};
        this.electromagnetOwners = data.electromagnetOwners || {};
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Board };
}
