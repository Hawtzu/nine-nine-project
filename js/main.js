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
                const crossMovable = game.movableTiles.filter(t => t.directionType === DIRECTION_TYPE.CROSS);
                const diagMovable = game.movableTiles.filter(t => t.directionType === DIRECTION_TYPE.DIAGONAL);
                renderer.drawHighlights(crossMovable, COLORS.MOVE_HIGHLIGHT);
                renderer.drawHighlights(diagMovable, COLORS.DIAGONAL_MOVE_HIGHLIGHT);
                const crossFall = game.fallTriggerTiles.filter(t => t.directionType === DIRECTION_TYPE.CROSS);
                const diagFall = game.fallTriggerTiles.filter(t => t.directionType === DIRECTION_TYPE.DIAGONAL);
                renderer.drawHighlights(crossFall, COLORS.FALL_HIGHLIGHT);
                renderer.drawHighlights(diagFall, COLORS.DIAGONAL_FALL_HIGHLIGHT);
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

function drawPhaseUI() {
    const ctx = renderer.ctx;
    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;

    if (game.phase === PHASES.ROLL) {
        // Draw roll button
        renderer.drawButton(panelX, 300, 200, 60, '#00C800', 'Roll Dice');
    } else if (game.phase === PHASES.MOVE) {
        // Draw dice result
        ctx.fillStyle = '#FFFF00';
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Dice Roll: ${game.diceRoll}`, panelX, 260);

        ctx.fillStyle = COLORS.WHITE;
        ctx.font = '18px Arial';
        ctx.fillText('Click a highlighted tile to move', panelX, 300);
    } else if (game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET) {
        const currentPlayer = game.getCurrentPlayer();

        // Draw placement buttons
        ctx.fillStyle = COLORS.STONE;
        ctx.fillRect(panelX, 300, 200, 50);
        if (game.placementType === 'stone' && game.phase === PHASES.PLACE) {
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 4;
            ctx.strokeRect(panelX, 300, 200, 50);
        }
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Place Stone', panelX + 100, 332);

        ctx.fillStyle = COLORS.RECOVERY_TILE;
        ctx.fillRect(panelX, 360, 200, 50);
        if (game.placementType === 'recovery') {
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 4;
            ctx.strokeRect(panelX, 360, 200, 50);
        }
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(`Recovery (${SKILL_COSTS.recovery}pt)`, panelX + 100, 392);

        ctx.fillStyle = COLORS.BOMB_TILE;
        ctx.fillRect(panelX, 420, 200, 50);
        if (game.placementType === 'bomb') {
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 4;
            ctx.strokeRect(panelX, 420, 200, 50);
        }
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(`Bomb (${SKILL_COSTS.bomb}pt)`, panelX + 100, 452);

        // Ice button (only if player has ice skill)
        let drillY = 480;
        if (currentPlayer.hasSkill(SPECIAL_SKILLS.ICE)) {
            ctx.fillStyle = COLORS.ICE_TILE;
            ctx.fillRect(panelX, 480, 200, 50);
            if (game.placementType === 'ice') {
                ctx.strokeStyle = COLORS.WHITE;
                ctx.lineWidth = 4;
                ctx.strokeRect(panelX, 480, 200, 50);
            }
            ctx.fillStyle = COLORS.BLACK;
            ctx.fillText(`Ice (${SKILL_COSTS.ice}pt)`, panelX + 100, 512);
            drillY = 540;
        }

        ctx.fillStyle = COLORS.DRILL;
        ctx.fillRect(panelX, drillY, 200, 50);
        if (game.phase === PHASES.DRILL_TARGET) {
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 4;
            ctx.strokeRect(panelX, drillY, 200, 50);
        }
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillText(`Drill (${SKILL_COSTS.drill}pt)`, panelX + 100, drillY + 32);
    }
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
