// Board Management Class
class Board {
    constructor(size = BOARD_SIZE) {
        this.size = size;
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {}; // key: "row,col" -> playerNum
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

    isValidPosition(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    reset() {
        this.tiles = this.createEmptyBoard();
        this.bombOwners = {};
    }
}
