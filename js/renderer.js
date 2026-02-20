// Rendering Class
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = SCREEN_WIDTH;
        this.canvas.height = SCREEN_HEIGHT;

        // Preload skill images
        this.skillImages = {};
        for (const key of Object.keys(SKILL_INFO)) {
            const info = SKILL_INFO[key];
            if (info.image) {
                const img = new Image();
                img.src = info.image;
                this.skillImages[key] = img;
            }
        }

        // Preload special images
        this.fountainImage = new Image();
        this.fountainImage.src = 'assets/skills/coin.png';

        this.targetImage = new Image();
        this.targetImage.src = 'assets/skills/target.png';

        this.bombTileImage = new Image();
        this.bombTileImage.src = 'assets/skills/bomb.png';

        this.iceTileImage = new Image();
        this.iceTileImage.src = 'assets/skills/ice tile.png';
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
            case MARKERS.BOMB:
                bgColor = COLORS.BOMB_TILE;
                break;
            case MARKERS.ICE:
                bgColor = COLORS.ICE_TILE;
                break;
            case MARKERS.FOUNTAIN:
                bgColor = COLORS.FOUNTAIN_TILE;
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

        // Draw bomb image
        if (tileType === MARKERS.BOMB && this.bombTileImage && this.bombTileImage.complete && this.bombTileImage.naturalWidth > 0) {
            const imgSize = CELL_SIZE * 0.7;
            const imgX = x + (CELL_SIZE - imgSize) / 2;
            const imgY = y + (CELL_SIZE - imgSize) / 2;
            this.ctx.drawImage(this.bombTileImage, imgX, imgY, imgSize, imgSize);
        }

        // Draw ice tile image
        if (tileType === MARKERS.ICE && this.iceTileImage && this.iceTileImage.complete && this.iceTileImage.naturalWidth > 0) {
            const imgSize = CELL_SIZE * 0.7;
            const imgX = x + (CELL_SIZE - imgSize) / 2;
            const imgY = y + (CELL_SIZE - imgSize) / 2;
            this.ctx.drawImage(this.iceTileImage, imgX, imgY, imgSize, imgSize);
        }

        // Draw fountain coin image
        if (tileType === MARKERS.FOUNTAIN && this.fountainImage && this.fountainImage.complete && this.fountainImage.naturalWidth > 0) {
            const imgSize = CELL_SIZE * 0.7;
            const imgX = x + (CELL_SIZE - imgSize) / 2;
            const imgY = y + (CELL_SIZE - imgSize) / 2;
            this.ctx.drawImage(this.fountainImage, imgX, imgY, imgSize, imgSize);
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

    drawSniperTarget(player) {
        const tx = player.col * CELL_SIZE + BOARD_OFFSET_X;
        const ty = player.row * CELL_SIZE + BOARD_OFFSET_Y;
        if (this.targetImage && this.targetImage.complete && this.targetImage.naturalWidth > 0) {
            this.ctx.drawImage(this.targetImage, tx, ty, CELL_SIZE, CELL_SIZE);
        }
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
        const maxPoints = GAME_SETTINGS.maxPointsDisplay;
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

        // Skill badge with image (below points bar)
        if (player.specialSkill) {
            const info = SKILL_INFO[player.specialSkill];
            if (info) {
                const skillY = barY + barHeight + 6;
                const badgeX = panelX;
                const badgeW = barWidth;
                const badgeH = 28;
                const iconSize = 24;

                // Badge background (skill color)
                this.ctx.fillStyle = info.color;
                this.ctx.fillRect(badgeX, skillY, badgeW, badgeH);

                // Skill icon image
                const img = this.skillImages[player.specialSkill];
                const iconPadding = 2;
                const iconX = badgeX + iconPadding;
                const iconY = skillY + (badgeH - iconSize) / 2;
                if (img && img.complete && img.naturalWidth > 0) {
                    this.ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
                }

                // Skill name text (English, left-aligned after icon)
                this.ctx.fillStyle = info.textColor;
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(info.name, iconX + iconSize + 4, skillY + badgeH / 2);
                this.ctx.textBaseline = 'alphabetic';
            }
        }

        // Control (Domination) remaining turns indicator
        if (player.isDominated()) {
            const domY = barY + barHeight + (player.specialSkill ? 40 : 6);
            const controlImg = this.skillImages[SPECIAL_SKILLS.DOMINATION];
            const iconSize = 16;

            if (controlImg && controlImg.complete && controlImg.naturalWidth > 0) {
                this.ctx.drawImage(controlImg, panelX, domY, iconSize, iconSize);
            }
            this.ctx.fillStyle = '#FF6666';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                `Controlled ${player.dominationTurnsLeft}T`,
                panelX + iconSize + 4,
                domY + iconSize / 2
            );
            this.ctx.textBaseline = 'alphabetic';
        }
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

        // Developer Settings gear icon (right of PvP button)
        this.drawGearIcon(SCREEN_WIDTH / 2 + 205, 390, 18);
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

            const info = SKILL_INFO[player.specialSkill];
            if (info) {
                // Show skill icon + name
                const img = this.skillImages[player.specialSkill];
                const iconY = 215;
                if (img && img.complete && img.naturalWidth > 0) {
                    this.ctx.drawImage(img, panelX, iconY, 32, 32);
                }
                this.ctx.fillStyle = COLORS.WHITE;
                this.ctx.font = '18px Arial';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(info.name, panelX + 38, iconY + 16);
                this.ctx.textBaseline = 'alphabetic';
            }
        } else {
            // Show skill selection grid (2x4)
            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Choose your skill:', panelX, 200);

            const btnWidth = 115;
            const btnHeight = 90;
            const gapX = 10;
            const gapY = 8;
            const startY = 210;

            for (let i = 0; i < SKILL_ORDER.length; i++) {
                const skill = SKILL_ORDER[i];
                const info = SKILL_INFO[skill];
                const row = Math.floor(i / 2);
                const col = i % 2;
                const bx = panelX + col * (btnWidth + gapX);
                const by = startY + row * (btnHeight + gapY);
                const centerX = bx + btnWidth / 2;

                // Button background
                this.ctx.fillStyle = info.color;
                this.ctx.fillRect(bx, by, btnWidth, btnHeight);
                this.ctx.strokeStyle = COLORS.WHITE;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(bx, by, btnWidth, btnHeight);

                // Skill icon (centered, top portion)
                const img = this.skillImages[skill];
                const iconSize = 36;
                if (img && img.complete && img.naturalWidth > 0) {
                    this.ctx.drawImage(img, centerX - iconSize / 2, by + 5, iconSize, iconSize);
                }

                // English name (below icon)
                this.ctx.fillStyle = info.textColor;
                this.ctx.font = 'bold 13px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(info.name, centerX, by + 52);

                // Cost
                const cost = SKILL_COSTS[info.costKey];
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`${cost}pt`, centerX, by + 68);
            }
            this.ctx.textAlign = 'left';
        }
    }

    drawSkillTooltip(info) {
        const ctx = this.ctx;
        const text = info.jaDesc || info.desc;
        const cost = SKILL_COSTS[info.costKey];

        ctx.save();
        ctx.font = 'bold 16px Arial';
        const textWidth = ctx.measureText(text).width;
        const costText = `${cost}pt`;
        ctx.font = '14px Arial';
        const costWidth = ctx.measureText(costText).width;
        const nameText = info.name;
        ctx.font = 'bold 18px Arial';
        const nameWidth = ctx.measureText(nameText).width;

        const padding = 16;
        const tooltipW = Math.max(textWidth, nameWidth + costWidth + 20) + padding * 2;
        const tooltipH = 70;
        const tooltipX = (SCREEN_WIDTH - tooltipW) / 2;
        const tooltipY = SCREEN_HEIGHT - tooltipH - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);

        // Border (skill color)
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

        // Skill icon + name + cost (top line)
        const img = this.skillImages[Object.keys(SKILL_INFO).find(k => SKILL_INFO[k] === info)];
        let textStartX = tooltipX + padding;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, textStartX, tooltipY + 8, 22, 22);
            textStartX += 28;
        }

        ctx.fillStyle = info.color;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameText, textStartX, tooltipY + 20);

        ctx.fillStyle = '#FFD700';
        ctx.font = '14px Arial';
        ctx.fillText(costText, textStartX + nameWidth + 12, tooltipY + 20);

        // Japanese description (bottom line)
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = '15px Arial';
        ctx.fillText(text, tooltipX + padding, tooltipY + 50);

        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    drawGearIcon(cx, cy, radius) {
        const ctx = this.ctx;
        ctx.save();

        // Outer circle with teeth
        const teethCount = 8;
        const outerR = radius;
        const innerR = radius * 0.7;
        const toothSize = 5;

        ctx.fillStyle = '#888888';
        ctx.beginPath();
        for (let i = 0; i < teethCount; i++) {
            const angle = (i / teethCount) * Math.PI * 2;
            const nextAngle = ((i + 0.5) / teethCount) * Math.PI * 2;
            const midAngle = ((i + 0.25) / teethCount) * Math.PI * 2;
            const midAngle2 = ((i + 0.75) / teethCount) * Math.PI * 2;

            if (i === 0) {
                ctx.moveTo(cx + Math.cos(angle) * (outerR + toothSize), cy + Math.sin(angle) * (outerR + toothSize));
            }
            ctx.lineTo(cx + Math.cos(midAngle) * (outerR + toothSize), cy + Math.sin(midAngle) * (outerR + toothSize));
            ctx.lineTo(cx + Math.cos(nextAngle) * outerR, cy + Math.sin(nextAngle) * outerR);
            ctx.lineTo(cx + Math.cos(midAngle2) * outerR, cy + Math.sin(midAngle2) * outerR);
            const nextStart = ((i + 1) / teethCount) * Math.PI * 2;
            ctx.lineTo(cx + Math.cos(nextStart) * (outerR + toothSize), cy + Math.sin(nextStart) * (outerR + toothSize));
        }
        ctx.closePath();
        ctx.fill();

        // Inner circle (hole)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawSettingsScreen(settingsObj) {
        this.clear();

        const ctx = this.ctx;

        // Header background
        ctx.fillStyle = '#1a1a3e';
        ctx.fillRect(0, 0, SCREEN_WIDTH, 80);

        // Title
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Developer Settings', SCREEN_WIDTH / 2, 55);

        // Back button
        this.drawButton(30, 15, 150, 50, '#555555', 'Back');

        // Reset button
        this.drawButton(SCREEN_WIDTH - 220, 15, 190, 50, '#993333', 'Reset All');

        // Sliders
        const startY = 110;
        const sliderHeight = 50;
        const sliderTrackWidth = 400;
        const labelWidth = 240;
        const leftMargin = (SCREEN_WIDTH - labelWidth - sliderTrackWidth - 120) / 2;

        for (let i = 0; i < settingsObj.sliders.length; i++) {
            const s = settingsObj.sliders[i];
            const y = startY + i * sliderHeight;

            // Alternating row background
            if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(0, y, SCREEN_WIDTH, sliderHeight);
            }

            // Label
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = '18px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.label, leftMargin, y + sliderHeight / 2);

            // Slider track
            const trackX = leftMargin + labelWidth;
            const trackY = y + sliderHeight / 2 - 4;
            const trackH = 8;

            // Store track geometry for hit testing
            s.trackX = trackX;
            s.trackY = trackY;
            s.trackWidth = sliderTrackWidth;
            s.trackHeight = trackH;

            // Track background
            ctx.fillStyle = '#333333';
            ctx.fillRect(trackX, trackY, sliderTrackWidth, trackH);

            // Filled portion
            const ratio = (s.value - s.min) / (s.max - s.min);
            ctx.fillStyle = '#0064FF';
            ctx.fillRect(trackX, trackY, sliderTrackWidth * ratio, trackH);

            // Thumb
            const thumbX = trackX + sliderTrackWidth * ratio;
            const thumbCY = trackY + trackH / 2;
            const thumbRadius = 12;

            ctx.fillStyle = settingsObj.activeSlider === i ? '#FFD700' : '#FFFFFF';
            ctx.beginPath();
            ctx.arc(thumbX, thumbCY, thumbRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0064FF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Value display
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${s.value}`, trackX + sliderTrackWidth + 20, y + sliderHeight / 2);

            // Default indicator (if changed)
            if (s.value !== s.defaultValue) {
                ctx.fillStyle = '#FF6666';
                ctx.font = '12px Arial';
                ctx.fillText(`(default: ${s.defaultValue})`, trackX + sliderTrackWidth + 20, y + sliderHeight / 2 + 18);
            }
        }

        ctx.textBaseline = 'alphabetic';
    }
}
