// Main Entry Point
let game;
let renderer;

function init() {
    const canvas = document.getElementById('game-canvas');
    renderer = new Renderer(canvas);
    game = new Game();

    // Add click event listener
    canvas.addEventListener('click', handleClick);

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function handleClick(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    game.handleClick(x, y);
}

function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    renderer.clear();

    switch (game.phase) {
        case PHASES.START_SCREEN:
            renderer.drawStartScreen();
            break;

        case PHASES.SKILL_SELECTION:
            renderer.drawSkillSelection(game.player1, game.player2);
            break;

        case PHASES.ROLL:
        case PHASES.MOVE:
        case PHASES.PLACE:
        case PHASES.DRILL_TARGET:
            // Draw panels
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase);

            // Draw board
            renderer.drawBoard(game.board);

            // Draw highlights
            if (game.phase === PHASES.MOVE) {
                if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
                    renderer.drawHighlights(game.movableTiles, COLORS.DIAGONAL_MOVE_HIGHLIGHT);
                    renderer.drawHighlights(game.fallTriggerTiles, COLORS.DIAGONAL_FALL_HIGHLIGHT);
                } else {
                    renderer.drawHighlights(game.movableTiles, COLORS.MOVE_HIGHLIGHT);
                    renderer.drawHighlights(game.fallTriggerTiles, COLORS.FALL_HIGHLIGHT);
                }
            } else if (game.phase === PHASES.PLACE) {
                renderer.drawHighlights(game.placeableTiles, COLORS.PLACE_HIGHLIGHT);
            } else if (game.phase === PHASES.DRILL_TARGET) {
                renderer.drawHighlights(game.drillTargetTiles, COLORS.DRILL_TARGET_HIGHLIGHT);
            }

            // Draw players
            renderer.drawPlayer(game.player1);
            renderer.drawPlayer(game.player2);

            // Draw roll button or dice result
            drawPhaseUI();
            break;

        case PHASES.GAME_OVER:
            // Draw the game state first
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase);
            renderer.drawBoard(game.board);
            renderer.drawPlayer(game.player1);
            renderer.drawPlayer(game.player2);

            // Draw game over overlay
            renderer.drawGameOver(game.winner, game.winReason);
            break;
    }
}

function drawOpponentDiceInfo(ctx) {
    const opponentPanelX = game.currentTurn === 1 ? SCREEN_WIDTH - PANEL_WIDTH + 40 : 40;
    const otherPlayer = game.getOtherPlayer();

    // NEXT preview
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', opponentPanelX, 150);
    drawDiceVisualSmall(ctx, opponentPanelX + 30, 185, game.diceQueue[1], false);
    drawDiceVisualSmall(ctx, opponentPanelX + 95, 187, game.diceQueue[2], true);

    // Stock display
    if (otherPlayer.hasStock()) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('STOCK', opponentPanelX, 225);
        drawDiceVisualSmall(ctx, opponentPanelX + 30, 260, otherPlayer.stockedDice, false);
    }
}

function drawPhaseUI() {
    const ctx = renderer.ctx;
    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

    // 相手パネルにダイス情報を常に表示
    if (game.phase === PHASES.ROLL || game.phase === PHASES.MOVE ||
        game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET) {
        drawOpponentDiceInfo(ctx);
    }

    if (game.phase === PHASES.ROLL) {
        const currentPlayer = game.getCurrentPlayer();

        // NEXT preview
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('NEXT', panelX, 150);
        drawDiceVisualSmall(ctx, panelX + 30, 185, game.diceQueue[1], false);
        drawDiceVisualSmall(ctx, panelX + 95, 187, game.diceQueue[2], true);

        // Current dice
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('CURRENT', panelX, 225);
        drawDiceVisual(ctx, panelX + 50, 270, game.diceQueue[0]);

        // Stock display
        if (currentPlayer.hasStock()) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('STOCK', panelX + 130, 225);
            drawDiceVisualSmall(ctx, panelX + 155, 270, currentPlayer.stockedDice, false);
        }

        // Buttons
        if (currentPlayer.hasStock()) {
            renderer.drawButton(panelX, 320, 200, 50, '#00C800', 'Roll Dice');
            renderer.drawButton(panelX, 378, 200, 50, '#DAA520', 'Use Stock');
        } else {
            renderer.drawButton(panelX, 320, 200, 50, '#00C800', 'Roll Dice');
            renderer.drawButton(panelX, 378, 200, 50, '#B8860B', 'Stock');
        }
    } else if (game.phase === PHASES.MOVE) {
        // Draw dice visual
        drawDiceVisual(ctx, panelX + 100, 310, game.diceRoll);

        // Move mode indicator
        const currentPlayer = game.getCurrentPlayer();
        ctx.textAlign = 'center';
        if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
            ctx.fillStyle = COLORS.DIAGONAL_MOVE_HIGHLIGHT;
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Diagonal Mode (-10pt)', panelX + 100, 380);
            ctx.fillStyle = '#AAAAAA';
            ctx.font = '12px Arial';
            ctx.fillText('Click piece to switch back', panelX + 100, 400);
        } else {
            ctx.fillStyle = '#AAAAAA';
            ctx.font = '12px Arial';
            if (currentPlayer.canAfford(SKILL_COSTS.diagonal_move)) {
                ctx.fillText('Click piece for diagonal (-10pt)', panelX + 100, 380);
            } else {
                ctx.fillStyle = '#666666';
                ctx.fillText('Not enough pts for diagonal', panelX + 100, 380);
            }
        }
        ctx.textAlign = 'left';
    } else if (game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET) {
        const currentPlayer = game.getCurrentPlayer();
        const points = currentPlayer.points;

        // Label
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('ACTIONS', panelX, 290);

        // Stone button (always available, free)
        drawSkillButton(ctx, panelX, 300, 200, 50, {
            name: 'Stone',
            color: COLORS.STONE,
            textColor: COLORS.WHITE,
            cost: 0,
            isSelected: game.placementType === 'stone' && game.phase === PHASES.PLACE,
            isAffordable: true
        });

        // Recovery button
        drawSkillButton(ctx, panelX, 358, 200, 50, {
            name: 'Recovery',
            color: COLORS.RECOVERY_TILE,
            textColor: COLORS.BLACK,
            cost: SKILL_COSTS.recovery,
            isSelected: game.placementType === 'recovery',
            isAffordable: points >= SKILL_COSTS.recovery
        });

        // Dynamic skill buttons (Ice/Bomb based on selected skill)
        let nextY = 416;

        // Ice button (only if player has ice skill)
        if (currentPlayer.hasSkill(SPECIAL_SKILLS.ICE)) {
            drawSkillButton(ctx, panelX, nextY, 200, 50, {
                name: 'Ice',
                color: COLORS.ICE_TILE,
                textColor: COLORS.BLACK,
                cost: SKILL_COSTS.ice,
                isSelected: game.placementType === 'ice',
                isAffordable: points >= SKILL_COSTS.ice
            });
            nextY += 58;
        }

        // Bomb button (only if player has bomb skill)
        if (currentPlayer.hasSkill(SPECIAL_SKILLS.BOMB)) {
            drawSkillButton(ctx, panelX, nextY, 200, 50, {
                name: 'Bomb',
                color: COLORS.BOMB_TILE,
                textColor: COLORS.BLACK,
                cost: SKILL_COSTS.bomb,
                isSelected: game.placementType === 'bomb',
                isAffordable: points >= SKILL_COSTS.bomb
            });
            nextY += 58;
        }

        // Drill button
        drawSkillButton(ctx, panelX, nextY, 200, 50, {
            name: 'Drill',
            color: COLORS.DRILL,
            textColor: COLORS.WHITE,
            cost: SKILL_COSTS.drill,
            isSelected: game.phase === PHASES.DRILL_TARGET,
            isAffordable: points >= SKILL_COSTS.drill
        });
    }
}

function drawDiceVisual(ctx, centerX, centerY, value) {
    const size = 70;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    const radius = 10;
    const dotRadius = 7;

    ctx.save();

    // Dice body with rounded corners
    ctx.fillStyle = '#EEEEEE';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.arcTo(x + size, y, x + size, y + radius, radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.arcTo(x + size, y + size, x + size - radius, y + size, radius);
    ctx.lineTo(x + radius, y + size);
    ctx.arcTo(x, y + size, x, y + size - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();

    // Dice border shadow
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dots based on value
    ctx.fillStyle = '#222222';
    const cx = centerX;
    const cy = centerY;
    const offset = 18;

    if (value === 1) {
        drawDot(ctx, cx, cy, dotRadius);
    } else if (value === 2) {
        drawDot(ctx, cx - offset, cy - offset, dotRadius);
        drawDot(ctx, cx + offset, cy + offset, dotRadius);
    } else if (value === 3) {
        drawDot(ctx, cx - offset, cy - offset, dotRadius);
        drawDot(ctx, cx, cy, dotRadius);
        drawDot(ctx, cx + offset, cy + offset, dotRadius);
    }

    ctx.restore();
}

function drawDiceVisualSmall(ctx, centerX, centerY, value, isSmaller) {
    const size = isSmaller ? 40 : 50;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    const radius = 6;
    const dotRadius = isSmaller ? 4 : 5;

    ctx.save();
    ctx.globalAlpha = isSmaller ? 0.6 : 0.8;

    ctx.fillStyle = '#DDDDDD';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.arcTo(x + size, y, x + size, y + radius, radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.arcTo(x + size, y + size, x + size - radius, y + size, radius);
    ctx.lineTo(x + radius, y + size);
    ctx.arcTo(x, y + size, x, y + size - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#222222';
    const offset = size * 0.26;
    if (value === 1) {
        drawDot(ctx, centerX, centerY, dotRadius);
    } else if (value === 2) {
        drawDot(ctx, centerX - offset, centerY - offset, dotRadius);
        drawDot(ctx, centerX + offset, centerY + offset, dotRadius);
    } else if (value === 3) {
        drawDot(ctx, centerX - offset, centerY - offset, dotRadius);
        drawDot(ctx, centerX, centerY, dotRadius);
        drawDot(ctx, centerX + offset, centerY + offset, dotRadius);
    }

    ctx.restore();
}

function drawDot(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawSkillButton(ctx, x, y, width, height, opts) {
    const { name, color, textColor, cost, isSelected, isAffordable } = opts;

    ctx.save();

    // Dim if not affordable
    if (!isAffordable && cost > 0) {
        ctx.globalAlpha = 0.35;
    }

    // Button background
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    // Icon circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(x + 25, y + height / 2, 15, 0, Math.PI * 2);
    ctx.fill();

    // Icon inner dot
    ctx.fillStyle = color === COLORS.STONE ? '#B0B0B0' : 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(x + 25, y + height / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // Skill name
    ctx.fillStyle = !isAffordable && cost > 0 ? '#666666' : textColor;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 48, y + height / 2 - (cost > 0 ? 6 : 0));

    // Cost text (small, below name)
    if (cost > 0) {
        ctx.fillStyle = !isAffordable ? '#993333' : '#FFD700';
        ctx.font = '13px Arial';
        ctx.fillText(`${cost} pt`, x + 48, y + height / 2 + 12);
    }

    // Selected highlight (glow border)
    if (isSelected) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, width, height);
        ctx.shadowBlur = 0;
    }

    // "Not enough" indicator
    if (!isAffordable && cost > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.fillRect(x, y, width, height);

        // Strikethrough line
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + height / 2);
        ctx.lineTo(x + width - 5, y + height / 2);
        ctx.stroke();
    }

    ctx.restore();
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
