// Player Management Class
class Player {
    constructor(playerNum, startRow, startCol) {
        this.playerNum = playerNum;
        this.row = startRow;
        this.col = startCol;
        this.prevRow = startRow;
        this.prevCol = startCol;
        this.points = 0;
        this.specialSkill = null;
        this.skillConfirmed = false;
        this.stockedDice = null;
        this.dominationTurnsLeft = 0;
        this.diceQueue = [];
        this.checkpointPos = null; // { row, col } or null
        this.color = playerNum === 1 ? COLORS.P1 : COLORS.P2;
    }

    moveTo(row, col) {
        this.prevRow = this.row;
        this.prevCol = this.col;
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
        this.prevRow = startRow;
        this.prevCol = startCol;
        this.points = 0;
        this.specialSkill = null;
        this.skillConfirmed = false;
        this.stockedDice = null;
        this.dominationTurnsLeft = 0;
        this.diceQueue = [];
        this.checkpointPos = null;
    }

    initDiceQueue(generateFn) {
        this.diceQueue = [generateFn(), generateFn(), generateFn()];
    }

    shiftDiceQueue(generateFn) {
        const value = this.diceQueue.shift();
        this.diceQueue.push(generateFn());
        return value;
    }

    stockDice(value) {
        this.stockedDice = value;
    }

    useStock() {
        const value = this.stockedDice;
        this.stockedDice = null;
        return value;
    }

    hasStock() {
        return this.stockedDice !== null;
    }

    setSpecialSkill(skill) {
        this.specialSkill = skill;
        this.skillConfirmed = true;
    }

    hasSkill(skill) {
        return this.specialSkill === skill;
    }

    isDominated() {
        return this.dominationTurnsLeft > 0;
    }

    setCheckpoint(row, col) {
        this.checkpointPos = { row, col };
    }

    getCheckpoint() {
        return this.checkpointPos;
    }

    hasCheckpoint() {
        return this.checkpointPos !== null;
    }
}
