// Player Management Class
class Player {
    constructor(playerNum, startRow, startCol) {
        this.playerNum = playerNum;
        this.row = startRow;
        this.col = startCol;
        this.points = 0;
        this.specialSkill = null;
        this.color = playerNum === 1 ? COLORS.P1 : COLORS.P2;
    }

    moveTo(row, col) {
        this.row = row;
        this.col = col;
    }

    addPoints(amount) {
        this.points += amount;
    }

    deductPoints(amount) {
        if (this.points >= amount) {
            this.points -= amount;
            return true;
        }
        return false;
    }

    canAfford(cost) {
        return this.points >= cost;
    }

    getPosition() {
        return { row: this.row, col: this.col };
    }

    reset(startRow, startCol) {
        this.row = startRow;
        this.col = startCol;
        this.points = 0;
        this.specialSkill = null;
    }
}
