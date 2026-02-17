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
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        for (const tile of tiles) {
            const x = tile.col * CELL_SIZE + BOARD_OFFSET_X;
            const y = tile.row * CELL_SIZE + BOARD_OFFSET_Y;
            this.ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
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
            `Player ${player.playerNum}${isCurrentTurn ? ' ★' : ''}`,
            panelX,
            70
        );

        // Points bar
        const barX = panelX;
        const barY = 90;
        const barWidth = PANEL_WIDTH - 40;
        const barHeight = 28;
        const maxPoints = 500;
        const fillRatio = Math.min(player.points / maxPoints, 1.0);

        // Bar background
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Bar fill with gradient
        if (fillRatio > 0) {
            const gradient = this.ctx.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
            if (player.playerNum === 1) {
                gradient.addColorStop(0, '#0050CC');
                gradient.addColorStop(1, '#3399FF');
            } else {
                gradient.addColorStop(0, '#CC2020');
                gradient.addColorStop(1, '#FF6666');
            }
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
        }

        // Bar border
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Points text on bar
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${player.points} pt`, barX + barWidth / 2, barY + barHeight / 2);
        this.ctx.textBaseline = 'alphabetic';
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

        // PvA Button (Coming Soon)
        this.drawButton(SCREEN_WIDTH / 2 - 150, 470, 300, 80, '#666666', 'Player vs AI');
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Coming Soon', SCREEN_WIDTH / 2, 530);
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

    drawSkillSelection(player1, player2) {
        this.clear();

        // Title
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Select Special Skill', SCREEN_WIDTH / 2, 50);

        // Player 1 panel (left)
        this.drawSkillPanel(player1, 20, COLORS.P1_PANEL_BG);

        // Player 2 panel (right)
        this.drawSkillPanel(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, COLORS.P2_PANEL_BG);

        // Center info
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        if (player1.skillConfirmed && player2.skillConfirmed) {
            this.ctx.fillText('Starting game...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        } else {
            this.ctx.fillText('Both players must select a skill', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        }
    }

    drawSkillPanel(player, panelX, bgColor) {
        // Panel background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(panelX - 20, 80, PANEL_WIDTH, SCREEN_HEIGHT - 100);

        // Player name
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 28px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Player ${player.playerNum}`, panelX, 130);

        if (player.skillConfirmed) {
            // Show "Ready!" if skill selected
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillText('Ready!', panelX, 200);

            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.font = '18px Arial';
            const skillName = player.specialSkill === SPECIAL_SKILLS.ICE ? 'Ice' : 'Bomb';
            this.ctx.fillText(`Skill: ${skillName}`, panelX, 240);
        } else {
            // Show skill selection
            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.font = '18px Arial';
            this.ctx.fillText('Choose your special skill:', panelX, 200);

            const btnWidth = PANEL_WIDTH - 40;
            const centerX = panelX + btnWidth / 2;

            // Ice skill button (Y: 250-370)
            this.ctx.fillStyle = COLORS.ICE_TILE;
            this.ctx.fillRect(panelX, 250, btnWidth, 120);
            this.ctx.strokeStyle = COLORS.WHITE;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(panelX, 250, btnWidth, 120);

            this.ctx.fillStyle = COLORS.BLACK;
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Ice Skill', centerX, 295);

            this.ctx.font = '14px Arial';
            this.ctx.fillText('Place ice tiles that', centerX, 325);
            this.ctx.fillText('extend movement', centerX, 345);

            // Bomb skill button (Y: 390-510)
            this.ctx.fillStyle = COLORS.BOMB_TILE;
            this.ctx.fillRect(panelX, 390, btnWidth, 120);
            this.ctx.strokeStyle = COLORS.WHITE;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(panelX, 390, btnWidth, 120);

            this.ctx.fillStyle = COLORS.BLACK;
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Bomb Skill', centerX, 435);

            this.ctx.font = '14px Arial';
            this.ctx.fillText('Place bombs that defeat', centerX, 465);
            this.ctx.fillText('opponents who step on them', centerX, 485);
        }
    }
}
