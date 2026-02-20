// Main Entry Point
let game;
let renderer;
let settings;

function init() {
    const canvas = document.getElementById('game-canvas');
    renderer = new Renderer(canvas);
    game = new Game();
    settings = new Settings();

    // Add event listeners
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function handleMouseDown(event) {
    if (game.phase !== PHASES.SETTINGS) return;
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    settings.handleMouseDown(x, y);
}

function handleMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (game.phase === PHASES.SETTINGS) {
        settings.handleMouseMove(x, y);
    } else if (game.phase === PHASES.SKILL_SELECTION) {
        updateSkillHover(x, y);
    }
}

function handleMouseUp(event) {
    if (game.phase !== PHASES.SETTINGS) return;
    settings.handleMouseUp();
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

        case PHASES.SETTINGS:
            renderer.drawSettingsScreen(settings);
            break;

        case PHASES.SKILL_SELECTION:
            renderer.drawSkillSelection(game.player1, game.player2);

            // Draw hover tooltip for hovered skill
            if (game.hoveredSkill) {
                const info = SKILL_INFO[game.hoveredSkill];
                if (info) {
                    renderer.drawSkillTooltip(info);
                }
            }
            break;

        case PHASES.ROLL:
        case PHASES.MOVE:
        case PHASES.PLACE:
        case PHASES.DRILL_TARGET:
        case PHASES.SKILL_TARGET:
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
            } else if (game.phase === PHASES.SKILL_TARGET) {
                renderer.drawHighlights(game.skillTargetTiles, COLORS.SKILL_TARGET_HIGHLIGHT);
            }

            // Draw players
            renderer.drawPlayer(game.player1);
            renderer.drawPlayer(game.player2);

            // Draw roll button or dice result
            drawPhaseUI();

            // Sniper animation overlay
            if (game.sniperAnimating) {
                const elapsed = Date.now() - game.sniperAnimStart;
                const otherPlayer = game.getOtherPlayer();
                renderer.drawSniperTarget(otherPlayer);

                // After 1.5 seconds, trigger game over
                if (elapsed >= 1500) {
                    game.sniperAnimating = false;
                    game.gameOver(game.currentTurn, 'sniped the opponent!');
                }
            }
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

function drawPlayerDicePanel(ctx, panelX, player) {
    // CURRENT dice
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('CURRENT', panelX, 180);
    drawDiceVisualSmall(ctx, panelX + 30, 215, player.diceQueue[0], false);

    // NEXT preview (2 dice)
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', panelX + 100, 180);
    drawDiceVisualSmall(ctx, panelX + 120, 215, player.diceQueue[1], false);
    drawDiceVisualSmall(ctx, panelX + 175, 217, player.diceQueue[2], true);

    // Stock display
    if (player.hasStock()) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('STOCK', panelX, 255);
        drawDiceVisualSmall(ctx, panelX + 30, 290, player.stockedDice, false);
    }
}

function drawPhaseUI() {
    const ctx = renderer.ctx;
    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
    const opponentPanelX = game.currentTurn === 1 ? SCREEN_WIDTH - PANEL_WIDTH + 40 : 40;

    // Show both players' dice panels in all active phases
    if (game.phase === PHASES.ROLL || game.phase === PHASES.MOVE ||
        game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET ||
        game.phase === PHASES.SKILL_TARGET) {
        drawPlayerDicePanel(ctx, panelX, game.getCurrentPlayer());
        drawPlayerDicePanel(ctx, opponentPanelX, game.getOtherPlayer());
    }

    if (game.phase === PHASES.ROLL) {
        const currentPlayer = game.getCurrentPlayer();
        const isDominated = currentPlayer.isDominated();

        // Buttons
        if (isDominated) {
            // Domination: only Roll Dice available, stock locked
            renderer.drawButton(panelX, 350, 200, 50, '#00C800', 'Roll Dice');
            ctx.globalAlpha = 0.35;
            renderer.drawButton(panelX, 408, 200, 50, '#555555', 'Locked');
            ctx.globalAlpha = 1.0;
        } else if (currentPlayer.hasStock()) {
            renderer.drawButton(panelX, 350, 200, 50, '#00C800', 'Roll Dice');
            renderer.drawButton(panelX, 408, 200, 50, '#DAA520', 'Use Stock');
        } else {
            renderer.drawButton(panelX, 350, 200, 50, '#00C800', 'Roll Dice');
            const canStock = currentPlayer.canAfford(SKILL_COSTS.stock);
            if (canStock) {
                renderer.drawButton(panelX, 408, 200, 50, '#B8860B', `Stock (-${SKILL_COSTS.stock}pt)`);
            } else {
                ctx.globalAlpha = 0.35;
                renderer.drawButton(panelX, 408, 200, 50, '#555555', `Stock (-${SKILL_COSTS.stock}pt)`);
                ctx.globalAlpha = 1.0;
            }
        }
    } else if (game.phase === PHASES.MOVE) {
        // Draw dice result
        drawDiceVisual(ctx, panelX + 100, 340, game.diceRoll);

        // Move mode indicator
        const currentPlayer = game.getCurrentPlayer();
        ctx.textAlign = 'center';
        if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
            ctx.fillStyle = COLORS.DIAGONAL_MOVE_HIGHLIGHT;
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Diagonal Mode (-10pt)', panelX + 100, 410);
            ctx.fillStyle = '#AAAAAA';
            ctx.font = '12px Arial';
            ctx.fillText('Click piece to switch back', panelX + 100, 430);
        } else {
            ctx.fillStyle = '#AAAAAA';
            ctx.font = '12px Arial';
            if (currentPlayer.canAfford(SKILL_COSTS.diagonal_move)) {
                ctx.fillText('Click piece for diagonal (-10pt)', panelX + 100, 410);
            } else {
                ctx.fillStyle = '#666666';
                ctx.fillText('Not enough pts for diagonal', panelX + 100, 410);
            }
        }
        ctx.textAlign = 'left';
    } else if (game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET || game.phase === PHASES.SKILL_TARGET) {

        const currentPlayer = game.getCurrentPlayer();
        const points = currentPlayer.points;
        const isDominated = currentPlayer.isDominated();

        // Label
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('ACTIONS', panelX, 320);

        // Stone button (Y: 330-380) — always available
        drawSkillButton(ctx, panelX, 330, 200, 50, {
            name: 'Stone',
            color: COLORS.STONE,
            textColor: COLORS.WHITE,
            cost: 0,
            isSelected: game.placementType === 'stone' && game.phase === PHASES.PLACE,
            isAffordable: true
        });

        // Skill button (Y: 388-438) — player's selected skill
        const skillInfo = SKILL_INFO[currentPlayer.specialSkill];
        if (skillInfo) {
            const skillCost = SKILL_COSTS[skillInfo.costKey];
            drawSkillButton(ctx, panelX, 388, 200, 50, {
                name: skillInfo.name,
                color: isDominated ? '#555555' : skillInfo.color,
                textColor: isDominated ? '#999999' : skillInfo.textColor,
                cost: skillCost,
                isSelected: game.phase === PHASES.SKILL_TARGET ||
                            ['ice', 'bomb'].includes(game.placementType),
                isAffordable: !isDominated && points >= skillCost
            });
        }

        // Drill button (Y: 446-496)
        drawSkillButton(ctx, panelX, 446, 200, 50, {
            name: 'Drill',
            color: isDominated ? '#555555' : COLORS.DRILL,
            textColor: isDominated ? '#999999' : COLORS.WHITE,
            cost: SKILL_COSTS.drill,
            isSelected: game.phase === PHASES.DRILL_TARGET,
            isAffordable: !isDominated && points >= SKILL_COSTS.drill
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

function updateSkillHover(x, y) {
    const btnWidth = 115, btnHeight = 90, gapX = 10, gapY = 8, startY = 210;
    game.hoveredSkill = null;

    // Check P1 panel (left)
    if (!game.player1.skillConfirmed) {
        const panelX = 20;
        for (let i = 0; i < SKILL_ORDER.length; i++) {
            const row = Math.floor(i / 2), col = i % 2;
            const bx = panelX + col * (btnWidth + gapX);
            const by = startY + row * (btnHeight + gapY);
            if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                game.hoveredSkill = SKILL_ORDER[i];
                return;
            }
        }
    }

    // Check P2 panel (right)
    if (!game.player2.skillConfirmed) {
        const panelX = SCREEN_WIDTH - PANEL_WIDTH + 20;
        for (let i = 0; i < SKILL_ORDER.length; i++) {
            const row = Math.floor(i / 2), col = i % 2;
            const bx = panelX + col * (btnWidth + gapX);
            const by = startY + row * (btnHeight + gapY);
            if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                game.hoveredSkill = SKILL_ORDER[i];
                return;
            }
        }
    }
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
