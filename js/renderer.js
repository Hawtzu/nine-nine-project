// Rendering Class — Cyber Dark Theme
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

        this.swampTileImage = new Image();
        this.swampTileImage.src = 'assets/skills/swamp.png';

        this.warpHoleImage = new Image();
        this.warpHoleImage.src = 'assets/skills/Warp hole.png';

        this.checkpointImage = new Image();
        this.checkpointImage.src = 'assets/skills/Check point.png';

        this.snowTileImage = new Image();
        this.snowTileImage.src = 'assets/skills/Snow.png';
    }

    // --- Utility Methods ---

    withAlpha(hexColor, alpha) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    brighten(hexColor, alpha) {
        const r = Math.min(255, parseInt(hexColor.slice(1, 3), 16) + 80);
        const g = Math.min(255, parseInt(hexColor.slice(3, 5), 16) + 80);
        const b = Math.min(255, parseInt(hexColor.slice(5, 7), 16) + 80);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // --- Core Drawing ---

    clear() {
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBoard(board, now) {
        for (let r = 0; r < board.size; r++) {
            for (let c = 0; c < board.size; c++) {
                this.drawCell(r, c, board.getTile(r, c), now || 0);
            }
        }
    }

    drawCell(row, col, tileType, now) {
        const x = col * CELL_SIZE + BOARD_OFFSET_X;
        const y = row * CELL_SIZE + BOARD_OFFSET_Y;

        // 1. Cell background: dark checkerboard
        const isAlt = (row + col) % 2 === 0;
        this.ctx.fillStyle = isAlt ? COLORS.CELL_BG : COLORS.CELL_BG_ALT;
        this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // 2. Special tile overlay (dark muted color + inner glow)
        let tileColor = null;
        switch (tileType) {
            case MARKERS.BOMB:       tileColor = COLORS.BOMB_TILE; break;
            case MARKERS.ICE:        tileColor = COLORS.ICE_TILE; break;
            case MARKERS.FOUNTAIN:   tileColor = COLORS.FOUNTAIN_TILE; break;
            case MARKERS.SWAMP:      tileColor = COLORS.SWAMP_TILE; break;
            case MARKERS.WARP:       tileColor = COLORS.WARP_TILE; break;
            case MARKERS.CHECKPOINT: tileColor = COLORS.CHECKPOINT_TILE; break;
            case MARKERS.SNOW:       tileColor = COLORS.SNOW_TILE; break;
        }

        if (tileColor) {
            this.ctx.fillStyle = tileColor;
            this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

            // Inner glow: radial gradient from center
            const cx = x + CELL_SIZE / 2;
            const cy = y + CELL_SIZE / 2;
            const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL_SIZE / 2);
            grad.addColorStop(0, this.brighten(tileColor, 0.25));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        // 3. Draw stone (cyber octagon)
        if (tileType === MARKERS.STONE) {
            this.drawCyberStone(x, y);
        }

        // 4. Draw tile images
        const imgSize = CELL_SIZE * 0.7;
        const imgX = x + (CELL_SIZE - imgSize) / 2;
        const imgY = y + (CELL_SIZE - imgSize) / 2;

        if (tileType === MARKERS.BOMB && this.bombTileImage && this.bombTileImage.complete && this.bombTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.bombTileImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.ICE && this.iceTileImage && this.iceTileImage.complete && this.iceTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.iceTileImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.SWAMP && this.swampTileImage && this.swampTileImage.complete && this.swampTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.swampTileImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.WARP && this.warpHoleImage && this.warpHoleImage.complete && this.warpHoleImage.naturalWidth > 0) {
            this.ctx.drawImage(this.warpHoleImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.CHECKPOINT && this.checkpointImage && this.checkpointImage.complete && this.checkpointImage.naturalWidth > 0) {
            this.ctx.drawImage(this.checkpointImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.SNOW && this.snowTileImage && this.snowTileImage.complete && this.snowTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.snowTileImage, imgX, imgY, imgSize, imgSize);
        }
        if (tileType === MARKERS.FOUNTAIN && this.fountainImage && this.fountainImage.complete && this.fountainImage.naturalWidth > 0) {
            this.ctx.drawImage(this.fountainImage, imgX, imgY, imgSize, imgSize);
        }

        // 5. Draw grid lines with glow
        this.drawGlowGridLine(x, y, row, col, now);
    }

    drawCyberStone(cellX, cellY) {
        const ctx = this.ctx;
        const cx = cellX + CELL_SIZE / 2;
        const cy = cellY + CELL_SIZE / 2;
        const r = CELL_SIZE / 3;
        const sides = 8;

        ctx.save();

        // Outer glow
        ctx.shadowColor = COLORS.STONE_BORDER;
        ctx.shadowBlur = 10;

        // Draw octagon path
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i / sides) - Math.PI / sides;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Fill with dark gradient
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, COLORS.STONE_INNER);
        grad.addColorStop(1, COLORS.STONE);
        ctx.fillStyle = grad;
        ctx.fill();

        // Neon border
        ctx.strokeStyle = COLORS.STONE_BORDER;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawGlowGridLine(x, y, row, col, now) {
        const ctx = this.ctx;

        // Base grid line
        ctx.strokeStyle = COLORS.GRID;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

        // Glow overlay: faint cyan stroke with traveling shimmer
        const phase = ((row + col) * 0.15 + (now || 0) / ANIM.GRID_PULSE_SPEED) % 1.0;
        const glowAlpha = 0.06 + 0.10 * Math.sin(phase * Math.PI * 2);

        ctx.strokeStyle = `rgba(0, 229, 255, ${glowAlpha})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
    }

    // --- Checkpoint Owners ---

    drawCheckpointOwners(board, player1, player2) {
        for (let r = 0; r < board.size; r++) {
            for (let c = 0; c < board.size; c++) {
                if (board.getTile(r, c) !== MARKERS.CHECKPOINT) continue;
                const owner = board.getCheckpointOwner(r, c);
                if (!owner) continue;
                const color = owner === 1 ? player1.color : player2.color;
                const x = BOARD_OFFSET_X + c * CELL_SIZE;
                const y = BOARD_OFFSET_Y + r * CELL_SIZE;
                this.ctx.save();
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 6;
                this.ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                this.ctx.shadowBlur = 0;
                this.ctx.restore();
            }
        }
    }

    // --- Kamakura Highlights ---

    drawKamakuraHighlights(kamakuraPatterns, hoveredIndex, candidateColor, patternColor) {
        if (hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < kamakuraPatterns.length) {
            this.drawHighlights(kamakuraPatterns[hoveredIndex].stones, patternColor);
        } else {
            const middles = kamakuraPatterns.map(p => p.middle);
            this.drawHighlights(middles, candidateColor);
        }
    }

    // --- Highlights with Glow ---

    drawHighlights(tiles, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        for (const tile of tiles) {
            const x = tile.col * CELL_SIZE + BOARD_OFFSET_X;
            const y = tile.row * CELL_SIZE + BOARD_OFFSET_Y;
            ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // --- Player Drawing (Cyber Glowing Piece) ---

    drawPlayer(player, displayPos, globalTime) {
        const x = displayPos ? displayPos.x
            : player.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
        const y = displayPos ? displayPos.y
            : player.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
        const alpha = displayPos ? displayPos.alpha : 1.0;
        const now = globalTime || 0;
        const radius = CELL_SIZE / 2 - 10;

        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;

        const baseColor = player.color;
        const darkColor = player.playerNum === 1 ? '#001833' : '#330000';

        // 1. Outer glow ring (pulsing)
        const pulseT = (now % ANIM.PULSE_SPEED) / ANIM.PULSE_SPEED;
        const pulseAlpha = 0.15 + 0.15 * Math.sin(pulseT * Math.PI * 2);
        const glowRadius = radius + 6 + 3 * Math.sin(pulseT * Math.PI * 2);

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.withAlpha(baseColor, pulseAlpha);
        ctx.fill();

        // 2. Main body with radial gradient
        const bodyGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        bodyGrad.addColorStop(0, darkColor);
        bodyGrad.addColorStop(0.7, baseColor);
        bodyGrad.addColorStop(1, baseColor);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // 3. Bright ring border with glow
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 4. Inner accent ring
        ctx.beginPath();
        ctx.arc(x, y, radius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = this.withAlpha(COLORS.WHITE, 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();

        // 5. Player number with glow
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 8;
        ctx.fillText(player.playerNum, x, y);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // --- Ripple Effect (Water Surface) ---

    drawRipples(ripples, currentTime) {
        const ctx = this.ctx;
        ctx.save();
        for (const ripple of ripples) {
            const elapsed = currentTime - ripple.startTime;
            const t = elapsed / ANIM.RIPPLE_LIFETIME;
            if (t >= 1) continue;

            const radius = ANIM.RIPPLE_MAX_RADIUS * t;
            const fadeAlpha = 0.5 * (1 - t);

            // Main ripple ring
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = this.withAlpha(ripple.color, fadeAlpha);
            ctx.lineWidth = 2 * (1 - t);
            ctx.stroke();

            // Second concentric ring (slightly delayed)
            if (t > 0.15) {
                const t2 = t - 0.15;
                const radius2 = ANIM.RIPPLE_MAX_RADIUS * t2 * 0.7;
                const alpha2 = 0.3 * (1 - t2 / 0.85);
                if (alpha2 > 0) {
                    ctx.beginPath();
                    ctx.arc(ripple.x, ripple.y, radius2, 0, Math.PI * 2);
                    ctx.strokeStyle = this.withAlpha(ripple.color, Math.max(0, alpha2));
                    ctx.lineWidth = 1.5 * (1 - t2 / 0.85);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    // --- Trail Effect ---

    drawTrails(trails, currentTime) {
        const ctx = this.ctx;
        ctx.save();
        for (const trail of trails) {
            const elapsed = currentTime - trail.startTime;
            const t = elapsed / ANIM.TRAIL_LIFETIME;
            if (t >= 1) continue;

            const trailAlpha = 0.4 * (1 - t);
            const r = trail.radius * (1 - t * 0.5);

            ctx.beginPath();
            ctx.arc(trail.x, trail.y, r, 0, Math.PI * 2);
            ctx.fillStyle = this.withAlpha(trail.color, trailAlpha);
            ctx.fill();
        }
        ctx.restore();
    }

    // --- Sniper Target ---

    drawSniperTarget(player) {
        const tx = player.col * CELL_SIZE + BOARD_OFFSET_X;
        const ty = player.row * CELL_SIZE + BOARD_OFFSET_Y;
        if (this.targetImage && this.targetImage.complete && this.targetImage.naturalWidth > 0) {
            this.ctx.drawImage(this.targetImage, tx, ty, CELL_SIZE, CELL_SIZE);
        }
    }

    // --- Panels ---

    drawPanels(player1, player2, currentTurn, phase, gameMode) {
        // Player 1 panel (left)
        this.ctx.fillStyle = COLORS.P1_PANEL_BG;
        this.ctx.fillRect(0, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Player 2 panel (right)
        this.ctx.fillStyle = COLORS.P2_PANEL_BG;
        this.ctx.fillRect(SCREEN_WIDTH - PANEL_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Draw player info
        this.drawPlayerInfo(player1, 20, currentTurn === 1, phase, gameMode);
        this.drawPlayerInfo(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, currentTurn === 2, phase, gameMode);
    }

    drawPlayerInfo(player, panelX, isCurrentTurn, phase, gameMode) {
        const textColor = COLORS.WHITE;

        // Player name (show "COM" for P2 in COM mode)
        const label = (gameMode === 'com' && player.playerNum === 2) ? 'COM' : `Player ${player.playerNum}`;
        this.ctx.fillStyle = textColor;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `${label}${isCurrentTurn ? ' \u2605' : ''}`,
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
        this.ctx.fillStyle = '#1A1A2E';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Bar fill with gradient
        if (fillRatio > 0) {
            const gradient = this.ctx.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
            if (player.playerNum === 1) {
                gradient.addColorStop(0, '#003388');
                gradient.addColorStop(1, '#00AAFF');
            } else {
                gradient.addColorStop(0, '#881111');
                gradient.addColorStop(1, '#FF4444');
            }
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
        }

        // Bar border
        this.ctx.strokeStyle = '#444466';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Points text on bar
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${player.points} pt`, barX + barWidth / 2, barY + barHeight / 2);
        this.ctx.textBaseline = 'alphabetic';

        // Skill badge with image
        if (player.specialSkill) {
            const info = SKILL_INFO[player.specialSkill];
            if (info) {
                const skillY = barY + barHeight + 6;
                const badgeX = panelX;
                const badgeW = barWidth;
                const badgeH = 28;
                const iconSize = 24;

                this.ctx.fillStyle = info.color;
                this.ctx.fillRect(badgeX, skillY, badgeW, badgeH);

                const img = this.skillImages[player.specialSkill];
                const iconPadding = 2;
                const iconX = badgeX + iconPadding;
                const iconY = skillY + (badgeH - iconSize) / 2;
                if (img && img.complete && img.naturalWidth > 0) {
                    this.ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
                }

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

    // --- Start Screen ---

    drawStartScreen(showDifficultySelect) {
        this.clear();

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Nine Nine', SCREEN_WIDTH / 2, 200);

        this.ctx.font = '24px Arial';
        this.ctx.fillText('Turn-Based Strategy Game', SCREEN_WIDTH / 2, 250);

        // PvP Button
        this.drawButton(SCREEN_WIDTH / 2 - 150, 350, 300, 80, '#006400', 'Player vs Player');

        // COM Button (active)
        this.drawButton(SCREEN_WIDTH / 2 - 150, 470, 300, 80, '#00224A', 'Player vs COM');

        // Difficulty selector (shown when COM button clicked)
        if (showDifficultySelect) {
            this.drawDifficultySelector();
        }

        // Developer Settings gear icon
        this.drawGearIcon(SCREEN_WIDTH / 2 + 205, 390, 18);
    }

    drawDifficultySelector() {
        const cx = SCREEN_WIDTH / 2;
        const btnW = 90, btnH = 50, gap = 10;
        const startX = cx - (btnW * 3 + gap * 2) / 2;
        const y = 560;

        // Label
        this.ctx.fillStyle = '#AAAACC';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Select Difficulty', cx, y - 8);

        // Easy
        this.drawButton(startX, y, btnW, btnH, '#1A4A1A', 'Easy');
        // Normal
        this.drawButton(startX + btnW + gap, y, btnW, btnH, '#4A3A0A', 'Normal');
        // Hard
        this.drawButton(startX + 2 * (btnW + gap), y, btnW, btnH, '#4A0A0A', 'Hard');
    }

    drawComThinking(now) {
        const ctx = this.ctx;
        // Pulsing dots animation
        const dots = '.'.repeat(Math.floor((now / 500) % 4));
        const panelCenterX = SCREEN_WIDTH - PANEL_WIDTH / 2;

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`COM thinking${dots}`, panelCenterX, SCREEN_HEIGHT - 30);
    }

    drawButton(x, y, width, height, color, text) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        this.ctx.strokeStyle = '#666688';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
    }

    // --- Game Over ---

    drawGameOver(winner, reason, gameMode) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        const winnerLabel = (gameMode === 'com' && winner === 2) ? 'COM' : `Player ${winner}`;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${winnerLabel} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '24px Arial';
        this.ctx.fillText(reason, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

        this.drawButton(SCREEN_WIDTH / 2 - 110, SCREEN_HEIGHT / 2 + 50, 220, 70, '#006400', 'Main Menu');
    }

    // --- Skill Selection ---

    drawSkillSelection(player1, player2, gameMode) {
        this.clear();

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Select Special Skill', SCREEN_WIDTH / 2, 50);

        this.drawSkillPanel(player1, 20, COLORS.P1_PANEL_BG, gameMode);
        this.drawSkillPanel(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, COLORS.P2_PANEL_BG, gameMode);

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        if (player1.skillConfirmed && player2.skillConfirmed) {
            this.ctx.fillText('Starting game...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        } else {
            this.ctx.fillText('Both players must select a skill', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        }
    }

    drawSkillPanel(player, panelX, bgColor, gameMode) {
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(panelX - 20, 80, PANEL_WIDTH, SCREEN_HEIGHT - 100);

        const label = (gameMode === 'com' && player.playerNum === 2) ? 'COM' : `Player ${player.playerNum}`;
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 28px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(label, panelX, 130);

        if (player.skillConfirmed) {
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillText('Ready!', panelX, 200);

            const info = SKILL_INFO[player.specialSkill];
            if (info) {
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

                this.ctx.fillStyle = info.color;
                this.ctx.fillRect(bx, by, btnWidth, btnHeight);
                this.ctx.strokeStyle = '#444466';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(bx, by, btnWidth, btnHeight);

                const img = this.skillImages[skill];
                const iconSize = 36;
                if (img && img.complete && img.naturalWidth > 0) {
                    this.ctx.drawImage(img, centerX - iconSize / 2, by + 5, iconSize, iconSize);
                }

                this.ctx.fillStyle = info.textColor;
                this.ctx.font = 'bold 13px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(info.name, centerX, by + 52);

                const cost = SKILL_COSTS[info.costKey];
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`${cost}pt`, centerX, by + 68);
            }
            this.ctx.textAlign = 'left';
        }
    }

    // --- Tooltip ---

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

        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);

        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

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

        ctx.fillStyle = COLORS.WHITE;
        ctx.font = '15px Arial';
        ctx.fillText(text, tooltipX + padding, tooltipY + 50);

        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    // --- Gear Icon ---

    drawGearIcon(cx, cy, radius) {
        const ctx = this.ctx;
        ctx.save();

        const teethCount = 8;
        const outerR = radius;
        const toothSize = 5;

        ctx.fillStyle = '#666688';
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

        ctx.fillStyle = COLORS.BLACK;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.7 * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // --- Settings Screen ---

    drawSettingsScreen(settingsObj) {
        this.clear();

        const ctx = this.ctx;

        // Header background
        ctx.fillStyle = '#0A0A28';
        ctx.fillRect(0, 0, SCREEN_WIDTH, 80);

        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Developer Settings', SCREEN_WIDTH / 2, 55);

        this.drawButton(30, 15, 150, 50, '#333344', 'Back');
        this.drawButton(SCREEN_WIDTH - 220, 15, 190, 50, '#661122', 'Reset All');

        // Sliders
        const startY = 110;
        const sliderHeight = 50;
        const sliderTrackWidth = 400;
        const iconSize = 30;
        const iconGap = 8;
        const labelWidth = 240;
        const totalLabelArea = iconSize + iconGap + labelWidth;
        const leftMargin = (SCREEN_WIDTH - totalLabelArea - sliderTrackWidth - 120) / 2;

        for (let i = 0; i < settingsObj.sliders.length; i++) {
            const s = settingsObj.sliders[i];
            const y = startY + i * sliderHeight;

            if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.fillRect(0, y, SCREEN_WIDTH, sliderHeight);
            }

            // Find skill image
            let skillImg = null;
            for (const key of Object.keys(SKILL_INFO)) {
                if (SKILL_INFO[key].costKey === s.prop) {
                    skillImg = this.skillImages[key];
                    break;
                }
            }
            if (s.key === 'fountain_pickup') {
                skillImg = this.fountainImage;
            }

            // Draw icon
            const iconX = leftMargin;
            const iconY = y + (sliderHeight - iconSize) / 2;
            if (skillImg && skillImg.complete && skillImg.naturalWidth > 0) {
                ctx.drawImage(skillImg, iconX, iconY, iconSize, iconSize);
            }

            // Label
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = '18px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.label, leftMargin + iconSize + iconGap, y + sliderHeight / 2);

            // Slider track
            const trackX = leftMargin + totalLabelArea;
            const trackY = y + sliderHeight / 2 - 4;
            const trackH = 8;

            s.trackX = trackX;
            s.trackY = trackY;
            s.trackWidth = sliderTrackWidth;
            s.trackHeight = trackH;

            // Track background
            ctx.fillStyle = '#1A1A2E';
            ctx.fillRect(trackX, trackY, sliderTrackWidth, trackH);

            // Filled portion
            const ratio = (s.value - s.min) / (s.max - s.min);
            ctx.fillStyle = '#0066AA';
            ctx.fillRect(trackX, trackY, sliderTrackWidth * ratio, trackH);

            // Thumb
            const thumbX = trackX + sliderTrackWidth * ratio;
            const thumbCY = trackY + trackH / 2;
            const thumbRadius = 12;

            ctx.fillStyle = settingsObj.activeSlider === i ? '#FFD700' : '#CCCCDD';
            ctx.beginPath();
            ctx.arc(thumbX, thumbCY, thumbRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0066AA';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Value display
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${s.value}`, trackX + sliderTrackWidth + 20, y + sliderHeight / 2);

            if (s.value !== s.defaultValue) {
                ctx.fillStyle = '#FF6666';
                ctx.font = '12px Arial';
                ctx.fillText(`(default: ${s.defaultValue})`, trackX + sliderTrackWidth + 20, y + sliderHeight / 2 + 18);
            }
        }

        ctx.textBaseline = 'alphabetic';
    }
}
