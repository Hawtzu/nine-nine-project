// Rendering Class
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = SCREEN_WIDTH;
        this.canvas.height = SCREEN_HEIGHT;
    }

    clear() {
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBoard(board) {
        for (let r = 0; r < board.size; r++) {
            for (let c = 0; c < board.size; c++) {
                this.drawCell(r, c, board.getTile(r, c));
            }
        }
    }

    drawCell(row, col, tileType) {
        const x = col * CELL_SIZE + BOARD_OFFSET_X;
        const y = row * CELL_SIZE + BOARD_OFFSET_Y;

        // Draw cell background
        let bgColor = COLORS.WHITE;
        switch (tileType) {
            case MARKERS.RECOVERY:
                bgColor = COLORS.RECOVERY_TILE;
                break;
            case MARKERS.BOMB:
                bgColor = COLORS.BOMB_TILE;
                break;
            case MARKERS.ICE:
                bgColor = COLORS.ICE_TILE;
                break;
        }

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Draw stone if present
        if (tileType === MARKERS.STONE) {
            this.ctx.fillStyle = COLORS.STONE;
            this.ctx.beginPath();
            this.ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw grid border
        this.ctx.strokeStyle = COLORS.GRID;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    }

    drawHighlights(tiles, color) {
        this.ctx.fillStyle = color;
        for (const tile of tiles) {
            const x = tile.col * CELL_SIZE + BOARD_OFFSET_X;
            const y = tile.row * CELL_SIZE + BOARD_OFFSET_Y;
            this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
    }

    drawPlayer(player) {
        const x = player.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
        const y = player.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 10;

        this.ctx.fillStyle = player.color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Player number
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(player.playerNum, x, y);
    }

    drawPanels(player1, player2, currentTurn, phase) {
        // Player 1 panel (left)
        this.ctx.fillStyle = COLORS.P1_PANEL_BG;
        this.ctx.fillRect(0, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Player 2 panel (right)
        this.ctx.fillStyle = COLORS.P2_PANEL_BG;
        this.ctx.fillRect(SCREEN_WIDTH - PANEL_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Draw player info
        this.drawPlayerInfo(player1, 20, currentTurn === 1, phase);
        this.drawPlayerInfo(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, currentTurn === 2, phase);
    }

    drawPlayerInfo(player, panelX, isCurrentTurn, phase) {
        const textColor = COLORS.WHITE;

        // Player name
        this.ctx.fillStyle = textColor;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `Player ${player.playerNum}${isCurrentTurn ? ' (Turn)' : ''}`,
            panelX,
            70
        );

        // Points
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Points: ${player.points}`, panelX, 130);
    }

    drawStartScreen() {
        this.clear();

        // Title
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Nine Nine', SCREEN_WIDTH / 2, 200);

        this.ctx.font = '24px Arial';
        this.ctx.fillText('Turn-Based Strategy Game', SCREEN_WIDTH / 2, 250);

        // PvP Button
        this.drawButton(SCREEN_WIDTH / 2 - 150, 350, 300, 80, '#009600', 'Player vs Player');

        // PvA Button
        this.drawButton(SCREEN_WIDTH / 2 - 150, 470, 300, 80, '#969600', 'Player vs AI');
    }

    drawButton(x, y, width, height, color, text) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        this.ctx.strokeStyle = COLORS.WHITE;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
    }

    drawGameOver(winner, reason) {
        // Overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        // Winner text
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Player ${winner} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);

        // Reason
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '24px Arial';
        this.ctx.fillText(reason, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

        // Restart button
        this.drawButton(SCREEN_WIDTH / 2 - 110, SCREEN_HEIGHT / 2 + 50, 220, 70, '#009600', 'Main Menu');
    }
}
