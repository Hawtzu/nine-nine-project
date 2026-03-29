// Main Entry Point
let game;
let renderer;
let settings;
let animManager;
let comPlayer;
let gameLog;
let replayEngine;
let tutorial;
let onlineManager;
let interactiveTutorial;

function init() {
    const canvas = document.getElementById('game-canvas');
    renderer = new Renderer(canvas);
    game = new Game();
    settings = new Settings();
    animManager = new AnimationManager();
    comPlayer = new ComPlayer(game);
    gameLog = new GameLog();
    replayEngine = new ReplayEngine();
    tutorial = new Tutorial();
    interactiveTutorial = new InteractiveTutorial();
    onlineManager = new OnlineManager();

    // Add event listeners
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Right-click tooltip (PC)
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        game.showBoardTooltip(x, y);
    });

    // Long-press tooltip (mobile)
    let tooltipTouchTimer = null;
    canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const { x, y } = getCanvasCoords({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
        tooltipTouchTimer = setTimeout(() => {
            game.showBoardTooltip(x, y);
        }, 500);
    });
    canvas.addEventListener('touchend', () => { if (tooltipTouchTimer) { clearTimeout(tooltipTouchTimer); tooltipTouchTimer = null; } });
    canvas.addEventListener('touchmove', () => { if (tooltipTouchTimer) { clearTimeout(tooltipTouchTimer); tooltipTouchTimer = null; } });

    // Game log copy button
    const copyBtn = document.getElementById('copy-log-btn');
    const copyFeedback = document.getElementById('copy-feedback');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (typeof gameLog === 'undefined') return;
            const json = gameLog.toJSON();
            navigator.clipboard.writeText(json).then(() => {
                copyFeedback.textContent = 'Copied!';
                copyFeedback.classList.add('show');
                setTimeout(() => copyFeedback.classList.remove('show'), 2000);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyFeedback.textContent = 'Copied!';
                copyFeedback.classList.add('show');
                setTimeout(() => copyFeedback.classList.remove('show'), 2000);
            });
        });
    }

    // Replay file import handler
    const replayFileInput = document.getElementById('replay-file-input');
    if (replayFileInput) {
        replayFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const logData = JSON.parse(evt.target.result);
                    if (!logData.setup || !logData.log) {
                        console.warn('Invalid replay file format');
                        return;
                    }
                    replayEngine.load(logData);
                    replayEngine.first();
                    // Ensure game has player objects for rendering
                    if (!game.player1) {
                        game.player1 = new Player(1, 4, 0);
                        game.player2 = new Player(2, 4, BOARD_SIZE - 1);
                    }
                    game.gameMode = logData.setup.gameMode || null;
                    replayEngine.applyToGame(game);
                    game._replayMode = 'playback';
                    game.phase = PHASES.REPLAY;
                } catch (err) {
                    console.warn('Failed to parse replay file:', err);
                }
            };
            reader.readAsText(file);
            // Reset input so the same file can be re-imported
            replayFileInput.value = '';
        });
    }

    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Convert mouse event to canvas-internal coordinates (accounts for CSS scaling)
function getCanvasCoords(event) {
    const rect = event.target.getBoundingClientRect();
    const scaleX = event.target.width / rect.width;
    const scaleY = event.target.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function handleMouseDown(event) {
    if (game.phase !== PHASES.SETTINGS) return;
    const { x, y } = getCanvasCoords(event);
    settings.handleMouseDown(x, y);
}

function handleMouseMove(event) {
    const { x, y } = getCanvasCoords(event);

    // Track mouse position for hover-reveal UI
    game._mouseX = x;
    game._mouseY = y;

    if (game.phase === PHASES.SETTINGS) {
        settings.handleMouseMove(x, y);
    } else if (game.phase === PHASES.SKILL_SELECTION) {
        updateSkillHover(x, y);
    } else if (game.phase === PHASES.SKILL_TARGET && game.activeSkillType === SPECIAL_SKILLS.KAMAKURA) {
        const cell = game.getCellFromCoords(x, y);
        if (cell) {
            game.updateKamakuraHover(cell.row, cell.col);
        } else {
            game.hoveredKamakuraIndex = null;
        }
    }
}

function handleMouseUp(event) {
    if (game.phase !== PHASES.SETTINGS) return;
    settings.handleMouseUp();
}

function handleClick(event) {
    // クリックで開始アニメーションをスキップ
    if (game.phase === PHASES.START_ANIM) {
        game.finishStartAnim();
        return;
    }
    const { x, y } = getCanvasCoords(event);
    game.handleClick(x, y);
}

function handleWheel(event) {
    if (game.phase === PHASES.REPLAY && game._replayMode === 'select') {
        event.preventDefault();
        const listH = SCREEN_HEIGHT - 120;
        const itemH = 70;
        const maxVisible = Math.floor(listH / itemH);
        const maxOffset = Math.max(0, game.replaySelectReplays.length - maxVisible);

        if (event.deltaY > 0) {
            game.replaySelectScrollOffset = Math.min(game.replaySelectScrollOffset + 1, maxOffset);
        } else if (event.deltaY < 0) {
            game.replaySelectScrollOffset = Math.max(game.replaySelectScrollOffset - 1, 0);
        }
    }
}

function handleKeyDown(event) {
    // Online lobby keyboard input (room code)
    if (game.phase === PHASES.ONLINE_LOBBY && game.onlineLobbyMode === 'join') {
        if (event.key === 'Backspace') {
            game.onlineRoomInput = game.onlineRoomInput.slice(0, -1);
        } else if (event.key === 'Enter' && game.onlineRoomInput.length > 0) {
            game._onlineConnect('join');
        } else if (event.key === 'Escape') {
            game.onlineLobbyMode = 'menu';
        } else if (/^[A-Za-z0-9]$/.test(event.key) && game.onlineRoomInput.length < 6) {
            game.onlineRoomInput += event.key.toUpperCase();
        }
        event.preventDefault();
        return;
    }

    // Online lobby escape
    if (game.phase === PHASES.ONLINE_LOBBY && event.key === 'Escape') {
        if (typeof onlineManager !== 'undefined') onlineManager.disconnect();
        game.onlineLobbyMode = 'menu';
        game.phase = PHASES.START_SCREEN;
        event.preventDefault();
        return;
    }

    // Tutorial keyboard navigation
    if (game.phase === PHASES.TUTORIAL) {
        if (event.key === 'ArrowRight') tutorial.nextSlide();
        else if (event.key === 'ArrowLeft') tutorial.prevSlide();
        else if (event.key === 'Escape') game.phase = PHASES.START_SCREEN;
        event.preventDefault();
        return;
    }

    // Escape: confirm dialog cancel
    if (event.key === 'Escape' && game.showConfirmDialog) {
        game.showConfirmDialog = null;
        event.preventDefault();
        return;
    }

    // Escape: gameplay → show confirm dialog
    const gameplayPhases = [PHASES.ROLL, PHASES.MOVE, PHASES.PLACE,
        PHASES.DRILL_TARGET, PHASES.SKILL_TARGET, PHASES.WARP_SELECT];
    if (event.key === 'Escape' && gameplayPhases.includes(game.phase)) {
        game.showConfirmDialog = 'save_log';
        event.preventDefault();
        return;
    }

    // Escape or any key: skip start animation
    if (game.phase === PHASES.START_ANIM) {
        game.finishStartAnim();
        event.preventDefault();
        return;
    }

    // Escape: skill selection → back to menu (no dialog)
    if (event.key === 'Escape' && game.phase === PHASES.SKILL_SELECTION) {
        game.phase = PHASES.START_SCREEN;
        event.preventDefault();
        return;
    }

    // Replay keyboard controls
    if (game.phase !== PHASES.REPLAY || game._replayMode !== 'playback') return;
    if (!replayEngine) return;

    switch (event.key) {
        case 'ArrowLeft':
            if (replayEngine.prev()) replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'ArrowRight':
            if (replayEngine.next()) replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'PageUp':
            if (replayEngine.prevTurn()) replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'PageDown':
            if (replayEngine.nextTurn()) replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'Home':
            replayEngine.first();
            replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'End':
            replayEngine.last();
            replayEngine.applyToGame(game);
            event.preventDefault();
            break;
        case 'Escape':
            game.phase = PHASES.START_SCREEN;
            game._replayMode = null;
            event.preventDefault();
            break;
    }
}

function gameLoop(timestamp) {
    const now = timestamp || performance.now();
    animManager.update(now);
    render(now);
    requestAnimationFrame(gameLoop);
}

// ============================================================
//  開始アニメーション描画 (Grid Build B)
//  Phase 1 (0-0.15): タイトルフラッシュ "NINE-NINE"
//  Phase 2 (0.15-0.35): タイトルフェード + パネルスライドイン
//  Phase 3 (0.35-0.5):  グリッド線を1本ずつ描画
//  Phase 4 (0.5-0.6):   ネオンボーダー点灯
//  Phase 5 (0.6-0.7):   プレイヤー出現 + "READY" テキスト
//  Phase 6 (0.7-0.85):  タイル（石・ファウンテン）が光りながら出現
//  Phase 7 (0.85-1.0):  "READY" → "YOUR TURN" 布フロー → 選ばれたプレイヤーのパネルへ
// ============================================================
function renderStartAnimation(now) {
    const elapsed = now - game.startAnimStart;
    const t = Math.min(elapsed / START_ANIM_DURATION, 1);

    // アニメーション完了 → ゲーム開始
    if (t >= 1) {
        game.finishStartAnim();
        return;
    }

    const firstTurn = game.currentTurn;

    // Phase 1 (0-0.15): タイトルフラッシュ
    if (t < 0.15) {
        const tt = t / 0.15;
        renderer.drawStartTitle(tt, 1 + (1 - tt) * 0.3);
        return;
    }

    // Phase 2 (0.15-0.35): タイトルフェード + パネルスライドイン
    if (t < 0.35) {
        const tt = (t - 0.15) / 0.2;
        renderer.drawStartTitle(1 - tt, 1);
        renderer.drawStartPanelsSlide(tt);
        return;
    }

    // Phase 3 (0.35-0.5): グリッド線を1本ずつ描画
    if (t < 0.5) {
        const tt = (t - 0.35) / 0.15;
        renderer.drawStartPanelsBg();
        renderer.drawStartGridBuild(tt, game.board);
        return;
    }

    // Phase 4 (0.5-0.6): ネオンボーダー点灯
    if (t < 0.6) {
        const tt = (t - 0.5) / 0.1;
        const eased = renderer._easeOutCubic(tt);
        renderer.clear();
        renderer.drawNeonBorderBackground();
        renderer.drawStartPanelsWithLabels(game.player1, game.player2, game.gameMode);
        renderer.drawNeonBorderSideGlow();
        renderer.drawStartStaticGrid();
        renderer.drawBorderSparks(now);
        return;
    }

    // Phase 5 (0.6-0.7): プレイヤー出現 + YOUR TURN テキスト
    if (t < 0.7) {
        const tt = (t - 0.6) / 0.1;
        renderer.clear();
        renderer.drawNeonBorderBackground();
        renderer.drawStartPanelsWithLabels(game.player1, game.player2, game.gameMode);
        renderer.drawNeonBorderSideGlow();
        renderer.drawStartStaticGrid();
        renderer.drawBorderSparks(now);
        // プレイヤーをポップイン
        const pa = renderer._easeOutBack(Math.min(tt / 0.6, 1));
        if (pa > 0) {
            renderer.ctx.save();
            renderer.ctx.globalAlpha = pa;
            renderer.drawPlayer(game.player1, null, now);
            renderer.drawPlayer(game.player2, null, now);
            renderer.ctx.restore();
        }
        // READY テキスト（中央）
        if (tt > 0.3) {
            renderer.drawStartYourTurnText(Math.min((tt - 0.3) / 0.4, 1));
        }
        return;
    }

    // Phase 6 (0.7-0.85): タイルが光りながら出現
    if (t < 0.85) {
        const tt = (t - 0.7) / 0.15;
        renderer.clear();
        renderer.drawNeonBorderBackground();
        renderer.drawStartPanelsWithLabels(game.player1, game.player2, game.gameMode);
        renderer.drawNeonBorderSideGlow();
        renderer.drawStartTileReveal(game.board, game.startAnimTileRevealOrder, tt, now);
        renderer.drawBorderSparks(now);
        renderer.drawPlayer(game.player1, null, now);
        renderer.drawPlayer(game.player2, null, now);
        // READY テキストフェードアウト
        if (tt < 0.3) {
            renderer.drawStartYourTurnText(1 - tt / 0.3);
        }
        return;
    }

    // Phase 7 (0.85-1.0): READY → YOUR TURN 布フロー
    const ct = (t - 0.85) / 0.15;
    renderer.clear();
    renderer.drawNeonBorderBackground();
    renderer.drawStartPanelsBg();
    // 布フロー最終段階でパネルグローを追加
    if (ct >= 0.7) {
        renderer._drawPanelNeonGlow(firstTurn);
    }
    renderer.drawPlayerInfo(game.player1, 20, false, PHASES.ROLL, game.gameMode);
    renderer.drawPlayerInfo(game.player2, SCREEN_WIDTH - PANEL_WIDTH + 20, false, PHASES.ROLL, game.gameMode);
    renderer.drawNeonBorderSideGlow();
    renderer.drawBoard(game.board, now);
    renderer.drawBorderSparks(now);
    renderer.drawPlayer(game.player1, null, now);
    renderer.drawPlayer(game.player2, null, now);
    renderer.drawStartClothFlow(ct, now, firstTurn, game.gameMode);
}

function render(now) {
    renderer.clear();

    switch (game.phase) {
        case PHASES.START_SCREEN:
            renderer.drawStartScreen(game.showDifficultySelect, now);
            break;

        case PHASES.TUTORIAL:
            renderer.drawTutorialScreen(tutorial, now);
            break;

        case PHASES.INTERACTIVE_TUTORIAL:
            // Draw the normal game board underneath
            renderer.drawNeonBorderBackground();
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase, game.gameMode);
            renderer.drawNeonBorderSideGlow();
            renderer.drawBoard(game.board, now);
            renderer.drawBorderSparks(now);

            // Draw highlights based on tutorial sub-phase
            if (interactiveTutorial && interactiveTutorial.active) {
                const sp = interactiveTutorial.subPhase;
                if (sp === 'move' || sp === 'move2' || sp === 'diagonal_move' || sp === 'skill_move' || sp === 'post_stock_move') {
                    // Exclude player's own position from move highlights (that's for diagonal toggle, not actual move)
                    const p1 = game.player1;
                    const filteredMovable = game.movableTiles.filter(t => !(t.row === p1.row && t.col === p1.col));
                    renderer.drawHighlights(filteredMovable, COLORS.MOVE_HIGHLIGHT);
                    if (game.fallTriggerTiles) renderer.drawHighlights(game.fallTriggerTiles, COLORS.FALL_HIGHLIGHT);
                } else if (sp === 'place' || sp === 'place2' || sp === 'skill_place' || sp === 'skill_bomb_place') {
                    renderer.drawHighlights(game.placeableTiles, COLORS.PLACE_HIGHLIGHT);
                }
            }

            // Draw trails and ripples
            renderer.drawTrails(animManager.trails, now);
            renderer.drawRipples(animManager.ripples, now);

            // Draw players (with animation positions)
            {
                const p1Anim = animManager.getDisplayPosition(1, game.player1);
                const p2Anim = animManager.getDisplayPosition(2, game.player2);
                renderer.drawPlayer(game.player1, p1Anim, now);
                renderer.drawPlayer(game.player2, p2Anim, now);
            }

            // Draw dice panels for both players
            if (interactiveTutorial && interactiveTutorial.active) {
                const sp = interactiveTutorial.subPhase;
                if (sp !== 'intro' && sp !== 'complete') {
                    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
                    const opPanelX = game.currentTurn === 1 ? SCREEN_WIDTH - PANEL_WIDTH + 40 : 40;
                    drawPlayerDicePanel(renderer.ctx, panelX, game.getCurrentPlayer());
                    drawPlayerDicePanel(renderer.ctx, opPanelX, game.getOtherPlayer());

                    // Draw buttons using actual game UI functions
                    drawTutorialPhaseButtons(renderer.ctx, panelX, sp);
                }
            }

            // Hover-reveal menu bar
            renderer.drawHoverMenuBar(game._mouseY);

            // Draw the tutorial overlay on top
            if (interactiveTutorial && interactiveTutorial.active) {
                renderer.drawInteractiveTutorialOverlay(interactiveTutorial.getGuideInfo());

                // Re-draw players ON TOP of the overlay so they're visible in spotlights
                // Skip during complete/waiting_complete to avoid covering buttons
                if (interactiveTutorial.subPhase !== 'complete' && interactiveTutorial.subPhase !== 'waiting_complete') {
                    const p1Anim2 = animManager.getDisplayPosition(1, game.player1);
                    const p2Anim2 = animManager.getDisplayPosition(2, game.player2);
                    renderer.drawPlayer(game.player1, p1Anim2, now);
                    renderer.drawPlayer(game.player2, p2Anim2, now);
                }

                // Re-draw highlighted buttons ON TOP of the overlay so they're visible
                const sp2 = interactiveTutorial.subPhase;

                // For points_info step, redraw the P1 panel on top so it's visible
                if (sp2 === 'points_info') {
                    renderer.drawPlayerInfo(game.player1, 20, true, PHASES.ROLL, game.gameMode);
                }

                if (sp2 !== 'intro' && sp2 !== 'complete' && sp2 !== 'diagonal_info' && sp2 !== 'points_info') {
                    const panelX2 = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
                    drawTutorialPhaseButtons(renderer.ctx, panelX2, sp2);
                }
            }
            break;

        case PHASES.ONLINE_LOBBY:
            renderer.drawOnlineLobby(game, now);
            break;

        case PHASES.SETTINGS:
            renderer.drawSettingsScreen(settings);
            break;

        case PHASES.SKILL_SELECTION:
            renderer.drawSkillSelection(game.player1, game.player2, game.gameMode);

            // Draw hover tooltip for hovered skill
            if (game.hoveredSkill) {
                const info = SKILL_INFO[game.hoveredSkill];
                if (info) {
                    renderer.drawSkillTooltip(info);
                }
            }

            // Hover-reveal menu bar
            renderer.drawHoverMenuBar(game._mouseY);
            break;

        case PHASES.TURN_ORDER_SELECT:
            renderer.drawTurnOrderSelect(
                game.turnOrderP1, game.turnOrderP2,
                game._turnOrderConflict, game._turnOrderConflictStart,
                game.gameMode
            );
            renderer.drawHoverMenuBar(game._mouseY);
            break;

        case PHASES.START_ANIM:
            renderStartAnimation(now);
            break;

        case PHASES.ANIMATING:
            // Draw neon border background first, then panels on top
            renderer.drawNeonBorderBackground();
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase, game.gameMode);
            renderer.drawNeonBorderSideGlow();
            renderer.drawBoard(game.board, now);
            renderer.drawBorderSparks(now);
            renderer.drawCheckpointOwners(game.board, game.player1, game.player2);

            // Draw trails and ripples UNDER players
            renderer.drawTrails(animManager.trails, now);
            renderer.drawRipples(animManager.ripples, now);

            // Draw players at animated positions
            const p1AnimPos = animManager.getDisplayPosition(1, game.player1);
            const p2AnimPos = animManager.getDisplayPosition(2, game.player2);
            renderer.drawPlayer(game.player1, p1AnimPos, now);
            renderer.drawPlayer(game.player2, p2AnimPos, now);

            // Meteor shower animation
            if (game.meteorAnimating) {
                const elapsed = now - game.meteorAnimStart;
                if (!game.meteorAnimInitialized) {
                    game.meteorAnimInitialized = true;
                    const cx = game.meteorAnimPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
                    const cy = game.meteorAnimPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
                    renderer.initMeteorEffect(cx, cy);
                }
                renderer.drawMeteorEffect(now, elapsed, game.meteorAnimPos);

                // Place stone at impact (800ms) — hidden under molten glow, revealed as it cools
                if (elapsed >= 800 && !game.meteorStonePlaced) {
                    game.meteorStonePlaced = true;
                    game.board.setTile(game.meteorAnimPos.row, game.meteorAnimPos.col, MARKERS.STONE);
                }
                if (elapsed >= 2500) {
                    game.meteorAnimating = false;
                    game.meteorAnimInitialized = false;
                    game.meteorStonePlaced = false;
                    renderer.cleanupMeteorEffect();
                    game.endTurn();
                }
            }
            break;

        case PHASES.ROLL:
        case PHASES.MOVE:
        case PHASES.PLACE:
        case PHASES.DRILL_TARGET:
        case PHASES.SKILL_TARGET:
        case PHASES.WARP_SELECT:
            // Draw neon border background first, then panels on top
            renderer.drawNeonBorderBackground();
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase, game.gameMode);
            renderer.drawNeonBorderSideGlow();
            renderer.drawBoard(game.board, now);
            renderer.drawBorderSparks(now);
            renderer.drawCheckpointOwners(game.board, game.player1, game.player2);

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
                if (game.activeSkillType === SPECIAL_SKILLS.KAMAKURA) {
                    renderer.drawKamakuraHighlights(
                        game.kamakuraPatterns,
                        game.hoveredKamakuraIndex,
                        COLORS.SKILL_TARGET_HIGHLIGHT,
                        COLORS.KAMAKURA_PATTERN_HIGHLIGHT
                    );
                } else {
                    renderer.drawHighlights(game.skillTargetTiles, COLORS.SKILL_TARGET_HIGHLIGHT);
                }
            } else if (game.phase === PHASES.WARP_SELECT) {
                renderer.drawHighlights(game.warpSelectTiles, COLORS.WARP_SELECT_HIGHLIGHT);
            }

            // Draw remaining ripples/trails from recent animations
            renderer.drawTrails(animManager.trails, now);
            renderer.drawRipples(animManager.ripples, now);

            // Draw players with pulse animation (skip falling player during electrocution)
            if (!(game.fallAnimating && game.fallAnimPlayerNum === 1)) {
                renderer.drawPlayer(game.player1, null, now);
            }
            if (!(game.fallAnimating && game.fallAnimPlayerNum === 2)) {
                renderer.drawPlayer(game.player2, null, now);
            }

            // Draw roll button or dice result
            drawPhaseUI();

            // Hover-reveal menu bar
            renderer.drawHoverMenuBar(game._mouseY);

            // Sniper bullet trail animation
            if (game.sniperAnimating) {
                const elapsed = now - game.sniperAnimStart;
                renderer.drawSniperEffect(elapsed, game.sniperAnimFromPos, game.sniperAnimToPos);

                // After 2.5 seconds (2s anim + 0.5s buffer), trigger game over
                if (elapsed >= 2500) {
                    game.sniperAnimating = false;
                    game.gameOver(game.currentTurn, 'sniped the opponent!');
                }
            }

            // Control (domination) chain animation
            if (game.controlAnimating) {
                const elapsed = now - game.controlAnimStart;
                if (!game.controlAnimInitialized) {
                    game.controlAnimInitialized = true;
                    const cx = game.controlAnimTargetPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
                    const cy = game.controlAnimTargetPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
                    renderer.initControlEffect(cx, cy);
                }
                renderer.drawControlEffect(now, elapsed, game.controlAnimTargetPos);

                if (elapsed >= 1500) {
                    game.controlAnimating = false;
                    game.controlAnimInitialized = false;
                    renderer.cleanupControlEffect();
                    game.endTurn();
                }
            }

            // Bomb explosion animation
            if (game.bombAnimating) {
                const elapsed = now - game.bombAnimStart;
                if (!game.bombAnimInitialized) {
                    game.bombAnimInitialized = true;
                    const cx = game.bombAnimPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
                    const cy = game.bombAnimPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
                    renderer.initBombEffect(cx, cy);
                }
                renderer.drawBombEffect(now, elapsed, game.bombAnimPos);

                if (elapsed >= 2000) {
                    game.bombAnimating = false;
                    game.bombAnimInitialized = false;
                    renderer.cleanupBombEffect();
                    game.gameOver(game.bombAnimPlayerNum === 1 ? 2 : 1, 'stepped on a bomb!');
                }
            }

            // Fall-off electrocution animation
            if (game.fallAnimating) {
                const elapsed = now - game.fallAnimStart;
                if (!game.fallAnimInitialized) {
                    game.fallAnimInitialized = true;
                    const cx = game.fallAnimPlayerPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
                    const cy = game.fallAnimPlayerPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
                    renderer.initFallEffect(cx, cy, game.fallAnimDir);
                }
                renderer.drawFallEffect(now, elapsed, game.fallAnimPlayerPos, game.fallAnimDir, game.fallAnimElectromagnet);

                if (elapsed >= 2000) {
                    game.fallAnimating = false;
                    game.fallAnimInitialized = false;
                    renderer.cleanupFallEffect();
                    const fallMsg = 'was electrocuted!';
                    game.gameOver(game.fallAnimPlayerNum === 1 ? 2 : 1, fallMsg);
                }
            }
            break;

        case PHASES.GAME_OVER:
            // Draw neon border background first, then panels on top
            renderer.drawNeonBorderBackground();
            renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase, game.gameMode);
            renderer.drawNeonBorderSideGlow();
            renderer.drawBoard(game.board, now);
            renderer.drawBorderSparks(now);
            renderer.drawCheckpointOwners(game.board, game.player1, game.player2);
            renderer.drawPlayer(game.player1, null, now);
            renderer.drawPlayer(game.player2, null, now);

            // Draw game over overlay
            renderer.drawGameOver(game.winner, game.winReason, game.gameMode, game.rematchState);
            break;

        case PHASES.REPLAY:
            if (game._replayMode === 'select') {
                renderer.drawReplaySelect(game.replaySelectReplays, game.replaySelectScrollOffset);
            } else if (game._replayMode === 'playback') {
                // Draw the board with current snapshot state
                const replaySkillCosts = (replayEngine && replayEngine.skillCosts) ? replayEngine.skillCosts : null;
                renderer.drawNeonBorderBackground();
                renderer.drawPanels(game.player1, game.player2, game.currentTurn, game.phase, game.gameMode, replaySkillCosts);
                renderer.drawNeonBorderSideGlow();
                renderer.drawBoard(game.board, now);
                renderer.drawBorderSparks(now);
                renderer.drawCheckpointOwners(game.board, game.player1, game.player2);

                // Draw movement highlights during 'rolled' phase
                const replaySnap = replayEngine.getCurrent();
                if (replaySnap && replaySnap.phase === 'rolled' && replaySnap.diceRoll) {
                    if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
                        renderer.drawHighlights(game.movableTiles, COLORS.DIAGONAL_MOVE_HIGHLIGHT);
                        renderer.drawHighlights(game.fallTriggerTiles, COLORS.DIAGONAL_FALL_HIGHLIGHT);
                    } else {
                        renderer.drawHighlights(game.movableTiles, COLORS.MOVE_HIGHLIGHT);
                        renderer.drawHighlights(game.fallTriggerTiles, COLORS.FALL_HIGHLIGHT);
                    }
                }

                // Draw action highlights during 'moved' phase
                if (replaySnap && replaySnap.phase === 'moved' && game.replayActionMode) {
                    if (game.replayActionMode === 'stone') {
                        renderer.drawHighlights(game.placeableTiles, COLORS.PLACE_HIGHLIGHT);
                    } else if (game.replayActionMode === 'skill') {
                        if (game.activeSkillType === SPECIAL_SKILLS.KAMAKURA) {
                            renderer.drawKamakuraHighlights(
                                game.kamakuraPatterns,
                                game.hoveredKamakuraIndex,
                                COLORS.SKILL_TARGET_HIGHLIGHT,
                                COLORS.KAMAKURA_PATTERN_HIGHLIGHT
                            );
                        } else if (game.placeableTiles.length > 0) {
                            // Placement-type skills (ice/bomb/swamp/warp) use placeableTiles
                            renderer.drawHighlights(game.placeableTiles, COLORS.PLACE_HIGHLIGHT);
                        } else {
                            renderer.drawHighlights(game.skillTargetTiles, COLORS.SKILL_TARGET_HIGHLIGHT);
                        }
                    } else if (game.replayActionMode === 'drill') {
                        renderer.drawHighlights(game.drillTargetTiles, COLORS.DRILL_TARGET_HIGHLIGHT);
                    }
                }

                renderer.drawPlayer(game.player1, null, now);
                renderer.drawPlayer(game.player2, null, now);

                // Draw dice panels for both players during replay
                if (game.player1.diceQueue && game.player1.diceQueue.length >= 3) {
                    drawPlayerDicePanel(renderer.ctx, 40, game.player1);
                }
                if (game.player2.diceQueue && game.player2.diceQueue.length >= 3) {
                    drawPlayerDicePanel(renderer.ctx, SCREEN_WIDTH - PANEL_WIDTH + 40, game.player2);
                }

                // Draw dice result and mode indicator during 'rolled' phase
                if (replaySnap && replaySnap.phase === 'rolled' && replaySnap.diceRoll) {
                    const rctx = renderer.ctx;
                    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
                    // Large dice visual (same as MOVE phase in gameplay)
                    drawDiceVisual(rctx, panelX + 100, 340, game.diceRoll);
                    // Mode indicator
                    rctx.textAlign = 'center';
                    if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
                        rctx.fillStyle = COLORS.DIAGONAL_MOVE_HIGHLIGHT;
                        rctx.font = 'bold 16px Arial';
                        rctx.fillText('Diagonal Mode', panelX + 100, 410);
                    }
                    rctx.fillStyle = '#888899';
                    rctx.font = '12px Arial';
                    rctx.fillText('Click piece to toggle mode', panelX + 100, 430);
                    rctx.textAlign = 'left';
                }

                // Draw action buttons during 'moved' phase
                if (replaySnap && replaySnap.phase === 'moved') {
                    const rctx = renderer.ctx;
                    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
                    const currentPlayer = game.getCurrentPlayer();
                    const points = currentPlayer.points;
                    const isDominated = currentPlayer.isDominated();
                    const rsc = replaySkillCosts || SKILL_COSTS;

                    // Label
                    rctx.fillStyle = '#888899';
                    rctx.font = '14px Arial';
                    rctx.textAlign = 'left';
                    rctx.fillText('ACTIONS', panelX, 355);

                    // Stone button (Y: 365-415)
                    drawSkillButton(rctx, panelX, 365, 200, 50, {
                        name: 'Stone',
                        color: COLORS.STONE,
                        textColor: COLORS.WHITE,
                        cost: 0,
                        isSelected: game.replayActionMode === 'stone',
                        isAffordable: true
                    });

                    // Skill button (Y: 423-473)
                    const skillInfo = SKILL_INFO[currentPlayer.specialSkill];
                    if (skillInfo) {
                        const skillCost = rsc[skillInfo.costKey] !== undefined
                            ? rsc[skillInfo.costKey] : SKILL_COSTS[skillInfo.costKey];
                        drawSkillButton(rctx, panelX, 423, 200, 50, {
                            name: skillInfo.name,
                            color: isDominated ? '#333344' : skillInfo.color,
                            textColor: isDominated ? '#666677' : skillInfo.textColor,
                            cost: skillCost,
                            isSelected: game.replayActionMode === 'skill',
                            isAffordable: !isDominated && points >= skillCost
                        });
                    }

                    // Drill button (Y: 481-531)
                    const drillCost = rsc.drill !== undefined ? rsc.drill : SKILL_COSTS.drill;
                    drawSkillButton(rctx, panelX, 481, 200, 50, {
                        name: 'Drill',
                        color: isDominated ? '#333344' : COLORS.DRILL,
                        textColor: isDominated ? '#666677' : COLORS.WHITE,
                        cost: drillCost,
                        isSelected: game.replayActionMode === 'drill',
                        isAffordable: !isDominated && points >= drillCost
                    });
                }

                // Draw replay controls overlay
                const snap = replaySnap;
                renderer.drawReplayControls(
                    replayEngine.currentIndex,
                    replayEngine.getTotalSnapshots(),
                    replayEngine.getActions(),
                    replayEngine.gameInfo,
                    snap,
                    game._mouseY,
                    replaySkillCosts
                );
            }
            break;
    }

    // Draw "COM thinking..." indicator during COM's turn
    if (game.gameMode === 'com' && game.currentTurn === 2 &&
        game.phase !== PHASES.START_SCREEN &&
        game.phase !== PHASES.GAME_OVER &&
        game.phase !== PHASES.SETTINGS &&
        game.phase !== PHASES.SKILL_SELECTION &&
        game.phase !== PHASES.REPLAY) {
        renderer.drawComThinking(now);
    }

    // Draw online connection indicator
    if (game.gameMode === 'online' && game.phase !== PHASES.START_SCREEN &&
        game.phase !== PHASES.ONLINE_LOBBY) {
        renderer.drawOnlineIndicator(onlineManager.connected);

        // Draw turn change banner
        if (game.turnBannerStart > 0) {
            const bannerElapsed = now - game.turnBannerStart;
            if (bannerElapsed < 300) {
                renderer.drawTurnBanner(game.turnBannerText, bannerElapsed);
            }
        }

        // Draw reconnection overlay
        if (game._opponentReconnecting) {
            renderer.drawReconnectingOverlay('Opponent reconnecting...');
        } else if (onlineManager.reconnecting) {
            renderer.drawReconnectingOverlay('Reconnecting...');
        }
    }

    // Draw board tooltip (right-click / long-press)
    if (game.activeTooltip) {
        renderer.drawBoardTooltip(game.activeTooltip);
    }

    // Draw confirm dialog overlay (on top of everything)
    if (game.showConfirmDialog === 'save_log') {
        renderer.drawConfirmDialog('Return to Menu', 'Save the game log?');
    } else if (game.showConfirmDialog === 'online_disconnect') {
        renderer.drawOnlineDisconnectDialog();
    } else if (game.showConfirmDialog === 'opponent_disconnected') {
        renderer.drawOpponentDisconnectedDialog();
    } else if (game.showConfirmDialog === 'self_disconnected') {
        renderer.drawSelfDisconnectedDialog();
    } else if (game.showConfirmDialog === 'rematch_request') {
        renderer.drawRematchRequestDialog();
    }

    // Show/hide game log toolbar
    const logToolbar = document.getElementById('log-toolbar');
    if (logToolbar) {
        const gameActive = game.phase !== PHASES.START_SCREEN &&
            game.phase !== PHASES.SKILL_SELECTION &&
            game.phase !== PHASES.TURN_ORDER_SELECT &&
            game.phase !== PHASES.SETTINGS &&
            game.phase !== PHASES.REPLAY;
        logToolbar.style.display = gameActive ? 'flex' : 'none';
    }
}

function drawDiceSlotReel(ctx, centerX, centerY, revealState) {
    const size = DICE_SIZE;
    const half = size / 2;
    const radius = 6;
    const dotRadius = 4;
    const values = [1, 2, 3];
    const t = revealState.t;

    ctx.save();
    ctx.globalAlpha = 0.6;

    // Draw dice body and use as clip region
    ctx.beginPath();
    ctx.moveTo(centerX - half + radius, centerY - half);
    ctx.lineTo(centerX + half - radius, centerY - half);
    ctx.arcTo(centerX + half, centerY - half, centerX + half, centerY - half + radius, radius);
    ctx.lineTo(centerX + half, centerY + half - radius);
    ctx.arcTo(centerX + half, centerY + half, centerX + half - radius, centerY + half, radius);
    ctx.lineTo(centerX - half + radius, centerY + half);
    ctx.arcTo(centerX - half, centerY + half, centerX - half, centerY + half - radius, radius);
    ctx.lineTo(centerX - half, centerY - half + radius);
    ctx.arcTo(centerX - half, centerY - half, centerX - half + radius, centerY - half, radius);
    ctx.closePath();
    ctx.fillStyle = '#1A1A2E';
    ctx.fill();
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();

    // Scroll: decelerate from fast to stop
    const totalScroll = 6; // scroll through 6 dice heights
    const decelT = 1 - Math.pow(1 - t, 3); // ease out cubic
    const scrollPos = totalScroll * (1 - decelT);

    const finalIdx = revealState.finalValue - 1;
    const centerIdx = finalIdx + scrollPos * 3;

    // Draw stacked dice dots visible through clip
    ctx.fillStyle = '#CCCCDD';
    const offset = size * 0.26;
    for (let off = -1; off <= 1; off++) {
        const rawIdx = Math.floor(centerIdx) + off;
        const val = values[((rawIdx % 3) + 3) % 3];
        const fracOffset = centerIdx - Math.floor(centerIdx);
        const yOff = (off - fracOffset) * size;
        const dotCy = centerY + yOff;

        if (val === 1) {
            drawDot(ctx, centerX, dotCy, dotRadius);
        } else if (val === 2) {
            drawDot(ctx, centerX - offset, dotCy - offset, dotRadius);
            drawDot(ctx, centerX + offset, dotCy + offset, dotRadius);
        } else if (val === 3) {
            drawDot(ctx, centerX - offset, dotCy - offset, dotRadius);
            drawDot(ctx, centerX, dotCy, dotRadius);
            drawDot(ctx, centerX + offset, dotCy + offset, dotRadius);
        }
    }

    ctx.restore();

    // Settled glow at end
    if (t > 0.85) {
        ctx.save();
        ctx.globalAlpha = 0.3 * (1 - (t - 0.85) / 0.15);
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - half + radius, centerY - half);
        ctx.lineTo(centerX + half - radius, centerY - half);
        ctx.arcTo(centerX + half, centerY - half, centerX + half, centerY - half + radius, radius);
        ctx.lineTo(centerX + half, centerY + half - radius);
        ctx.arcTo(centerX + half, centerY + half, centerX + half - radius, centerY + half, radius);
        ctx.lineTo(centerX - half + radius, centerY + half);
        ctx.arcTo(centerX - half, centerY + half, centerX - half, centerY + half - radius, radius);
        ctx.lineTo(centerX - half, centerY - half + radius);
        ctx.arcTo(centerX - half, centerY - half, centerX - half + radius, centerY - half, radius);
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// Dice panel slot positions (relative to panelX)
const DICE_SIZE = 44;
const DICE_GAP = 8;
const DICE_POS = {
    SELECTED: { dx: 22, dy: 250, size: DICE_SIZE },
    CURRENT:  { dx: 74, dy: 250, size: DICE_SIZE },
    NEXT1:    { dx: 126, dy: 250, size: DICE_SIZE },
    NEXT2:    { dx: 178, dy: 250, size: DICE_SIZE },
    STOCK:    { dx: 74, dy: 325, size: DICE_SIZE },
    SPAWN:    { dx: 230, dy: 250, size: DICE_SIZE }
};

function lerp(a, b, t) { return a + (b - a) * t; }

function drawPlayerDicePanel(ctx, panelX, player) {
    const isCurrentPlayer = player.playerNum === game.currentTurn;
    const dy = DICE_POS.SELECTED.dy;

    // Labels
    ctx.fillStyle = '#888899';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('USE', panelX + DICE_POS.SELECTED.dx, 215);
    ctx.fillText('CURRENT', panelX + DICE_POS.CURRENT.dx, 215);
    ctx.fillText('NEXT', panelX + (DICE_POS.NEXT1.dx + DICE_POS.NEXT2.dx) / 2, 215);

    const trans = animManager.getDiceTransitionState(player.playerNum);
    const revealState = animManager.getDiceRevealState(player.playerNum);

    if (trans && trans.active) {
        const et = easeInOutCubic(trans.t);

        if (trans.type === 'roll') {
            // CURRENT → SELECTED slide
            const selX = lerp(panelX + DICE_POS.CURRENT.dx, panelX + DICE_POS.SELECTED.dx, et);
            drawDiceVisualSmall(ctx, selX, dy, trans.oldQueue[0], false);

            // NEXT1 → CURRENT slide
            const n1x = lerp(panelX + DICE_POS.NEXT1.dx, panelX + DICE_POS.CURRENT.dx, et);
            drawDiceVisualSmall(ctx, n1x, dy, trans.oldQueue[1], false);

            // NEXT2 → NEXT1 slide
            const n2x = lerp(panelX + DICE_POS.NEXT2.dx, panelX + DICE_POS.NEXT1.dx, et);
            drawDiceVisualSmall(ctx, n2x, dy, trans.oldQueue[2], false);

            // New dice slides in from right → NEXT2 (as "?")
            const spawnX = lerp(panelX + DICE_POS.SPAWN.dx, panelX + DICE_POS.NEXT2.dx, et);
            ctx.save();
            ctx.globalAlpha = 0.6 * et;
            drawDiceQuestion(ctx, spawnX, dy, DICE_POS.NEXT2.size);
            ctx.restore();

        } else if (trans.type === 'stock') {
            // oldQueue[0] → STOCK arc (CURRENT goes to stock)
            const fromX = panelX + DICE_POS.CURRENT.dx;
            const fromY = dy;
            const toX = panelX + DICE_POS.STOCK.dx;
            const toY = DICE_POS.STOCK.dy;
            const cpX = (fromX + toX) / 2;
            const cpY = fromY + 50;
            const t1 = 1 - et;
            const arcX = t1*t1*fromX + 2*t1*et*cpX + et*et*toX;
            const arcY = t1*t1*fromY + 2*t1*et*cpY + et*et*toY;
            drawDiceVisualSmall(ctx, arcX, arcY, trans.stockValue, false);

            // oldQueue[1] → CURRENT (slide from NEXT1)
            const n1x = lerp(panelX + DICE_POS.NEXT1.dx, panelX + DICE_POS.CURRENT.dx, et);
            drawDiceVisualSmall(ctx, n1x, dy, trans.oldQueue[1], false);

            // oldQueue[2] → NEXT1 (slide from NEXT2)
            const n2x = lerp(panelX + DICE_POS.NEXT2.dx, panelX + DICE_POS.NEXT1.dx, et);
            drawDiceVisualSmall(ctx, n2x, dy, trans.oldQueue[2], false);

            // New dice slides in → NEXT2
            const spawnX = lerp(panelX + DICE_POS.SPAWN.dx, panelX + DICE_POS.NEXT2.dx, et);
            ctx.save();
            ctx.globalAlpha = 0.6 * et;
            drawDiceQuestion(ctx, spawnX, dy, DICE_POS.NEXT2.size);
            ctx.restore();

            // STOCK label during animation
            ctx.fillStyle = '#FFD700';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('STOCK', panelX + DICE_POS.STOCK.dx, 290);

        } else if (trans.type === 'useStock') {
            // Old CURRENT fades out (replaced by stock value)
            ctx.save();
            ctx.globalAlpha = 1 - et;
            drawDiceVisualSmall(ctx, panelX + DICE_POS.CURRENT.dx, dy, trans.oldQueue[0], false);
            ctx.restore();

            // STOCK → CURRENT arc (stocked value replaces CURRENT)
            const fromX = panelX + DICE_POS.STOCK.dx;
            const fromY = DICE_POS.STOCK.dy;
            const toX = panelX + DICE_POS.CURRENT.dx;
            const toY = dy;
            const cpX = (fromX + toX) / 2 - 20;
            const cpY = (fromY + toY) / 2 - 30;
            const t1 = 1 - et;
            const arcX = t1*t1*fromX + 2*t1*et*cpX + et*et*toX;
            const arcY = t1*t1*fromY + 2*t1*et*cpY + et*et*toY;
            drawDiceVisualSmall(ctx, arcX, arcY, trans.oldStock, false);

            // Queue stays in place (no shift)
            drawDiceVisualSmall(ctx, panelX + DICE_POS.NEXT1.dx, dy, trans.oldQueue[1], false);
            drawDiceVisualSmall(ctx, panelX + DICE_POS.NEXT2.dx, dy, trans.oldQueue[2], false);

            // STOCK label fading out
            ctx.save();
            ctx.globalAlpha = 1 - et;
            ctx.fillStyle = '#FFD700';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('STOCK', panelX + DICE_POS.STOCK.dx, 290);
            ctx.restore();
        }
    } else {
        // Static dice display (no transition)

        // SELECTED slot: show diceRoll for current player in non-ROLL phases
        if (isCurrentPlayer && game.phase !== PHASES.ROLL && game.phase !== PHASES.SKILL_SELECTION && game.diceRoll) {
            drawDiceVisualSmall(ctx, panelX + DICE_POS.SELECTED.dx, dy, game.diceRoll, false);
        } else {
            // Draw empty selected slot (dashed border)
            ctx.save();
            ctx.strokeStyle = '#333355';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const s = DICE_SIZE, half = s / 2, r = 6;
            const sx = panelX + DICE_POS.SELECTED.dx - half, sy = dy - half;
            ctx.beginPath();
            ctx.moveTo(sx + r, sy); ctx.lineTo(sx + s - r, sy);
            ctx.arcTo(sx + s, sy, sx + s, sy + r, r);
            ctx.lineTo(sx + s, sy + s - r);
            ctx.arcTo(sx + s, sy + s, sx + s - r, sy + s, r);
            ctx.lineTo(sx + r, sy + s);
            ctx.arcTo(sx, sy + s, sx, sy + s - r, r);
            ctx.lineTo(sx, sy + r);
            ctx.arcTo(sx, sy, sx + r, sy, r);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // CURRENT, NEXT1, NEXT2
        drawDiceVisualSmall(ctx, panelX + DICE_POS.CURRENT.dx, dy, player.diceQueue[0], false);
        drawDiceVisualSmall(ctx, panelX + DICE_POS.NEXT1.dx, dy, player.diceQueue[1], false);

        // NEXT2: check for slot reel reveal
        if (revealState && revealState.active) {
            drawDiceSlotReel(ctx, panelX + DICE_POS.NEXT2.dx, dy, revealState);
        } else {
            drawDiceVisualSmall(ctx, panelX + DICE_POS.NEXT2.dx, dy, player.diceQueue[2], false);
        }

        // Stock display
        if (player.hasStock()) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('STOCK', panelX + DICE_POS.STOCK.dx, 290);
            drawDiceVisualSmall(ctx, panelX + DICE_POS.STOCK.dx, DICE_POS.STOCK.dy, player.stockedDice, false);
        }
    }
}

// Draw a "?" dice (unknown value)
function drawDiceQuestion(ctx, cx, cy, size) {
    const half = size / 2;
    const r = 6;
    ctx.save();
    ctx.fillStyle = '#1A1A2E';
    ctx.beginPath();
    ctx.moveTo(cx - half + r, cy - half);
    ctx.lineTo(cx + half - r, cy - half);
    ctx.arcTo(cx + half, cy - half, cx + half, cy - half + r, r);
    ctx.lineTo(cx + half, cy + half - r);
    ctx.arcTo(cx + half, cy + half, cx + half - r, cy + half, r);
    ctx.lineTo(cx - half + r, cy + half);
    ctx.arcTo(cx - half, cy + half, cx - half, cy + half - r, r);
    ctx.lineTo(cx - half, cy - half + r);
    ctx.arcTo(cx - half, cy - half, cx - half + r, cy - half, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#666688';
    ctx.font = `bold ${size * 0.55}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + 1);
    ctx.restore();
}

// Draw conveyor chevrons in horizontal gaps between dice
function drawConveyorGaps(ctx, gaps, lineY, color) {
    const now = performance.now();
    const speed = now / 250;
    for (const gap of gaps) {
        const gapWidth = gap.toX - gap.fromX;
        if (gapWidth < 4) continue;
        const chevronSpacing = 12;
        const chevronCount = Math.ceil(gapWidth / chevronSpacing) + 1;
        const offset = (speed * chevronSpacing) % chevronSpacing;
        ctx.save();
        ctx.beginPath();
        ctx.rect(gap.fromX, lineY - 15, gapWidth, 30);
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = -1; i < chevronCount; i++) {
            const cx = gap.toX - i * chevronSpacing + offset;
            ctx.globalAlpha = 0.3 + 0.25 * Math.sin(i * 0.8 + speed * 0.5);
            ctx.beginPath();
            ctx.moveTo(cx + 4, lineY - 6);
            ctx.lineTo(cx - 4, lineY);
            ctx.lineTo(cx + 4, lineY + 6);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Draw vertical conveyor chevrons
function drawVerticalConveyor(ctx, vx, fromY, toY, color, dirDown) {
    const now = performance.now();
    const gapH = toY - fromY;
    if (gapH < 4) return;
    const chevronSpacing = 12;
    const chevronCount = Math.ceil(gapH / chevronSpacing) + 1;
    const offset = (now / 250 * chevronSpacing) % chevronSpacing;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx - 15, fromY, 30, gapH);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -1; i < chevronCount; i++) {
        const cy = dirDown ? fromY + i * chevronSpacing + offset : toY - i * chevronSpacing - offset;
        ctx.globalAlpha = 0.3 + 0.25 * Math.sin(i * 0.8 + now / 250 * 0.5);
        ctx.beginPath();
        if (dirDown) {
            ctx.moveTo(vx - 6, cy - 4); ctx.lineTo(vx, cy + 4); ctx.lineTo(vx + 6, cy - 4);
        } else {
            ctx.moveTo(vx - 6, cy + 4); ctx.lineTo(vx, cy - 4); ctx.lineTo(vx + 6, cy + 4);
        }
        ctx.stroke();
    }
    ctx.restore();
}

// Draw conveyor line hover preview between dice slots
function drawDiceHoverPreview(ctx, panelX, hoverType) {
    const sel = DICE_POS.SELECTED, c = DICE_POS.CURRENT, n1 = DICE_POS.NEXT1, n2 = DICE_POS.NEXT2, s = DICE_POS.STOCK;
    const dh = DICE_SIZE / 2;
    const lineY = c.dy;

    if (hoverType === 'roll') {
        // Full conveyor: SPAWN → NEXT2 → NEXT1 → CURRENT → SELECTED
        const gaps = [
            { fromX: panelX + n2.dx + dh, toX: panelX + DICE_POS.SPAWN.dx - dh },
            { fromX: panelX + n1.dx + dh, toX: panelX + n2.dx - dh },
            { fromX: panelX + c.dx + dh, toX: panelX + n1.dx - dh },
            { fromX: panelX + sel.dx + dh, toX: panelX + c.dx - dh }
        ];
        drawConveyorGaps(ctx, gaps, lineY, '#00E5FF');

    } else if (hoverType === 'stock') {
        // Horizontal: queue shifts left (NEXT→CURRENT, no SELECTED involved)
        const gaps = [
            { fromX: panelX + n2.dx + dh, toX: panelX + DICE_POS.SPAWN.dx - dh },
            { fromX: panelX + n1.dx + dh, toX: panelX + n2.dx - dh },
            { fromX: panelX + c.dx + dh, toX: panelX + n1.dx - dh }
        ];
        drawConveyorGaps(ctx, gaps, lineY, '#00E5FF');

        // Vertical: CURRENT → STOCK
        drawVerticalConveyor(ctx, panelX + c.dx, c.dy + dh, s.dy - dh, '#FFD700', true);

    } else if (hoverType === 'useStock') {
        // Vertical: STOCK → CURRENT (upward, replaces CURRENT)
        drawVerticalConveyor(ctx, panelX + c.dx, c.dy + dh, s.dy - dh, '#FF8C00', false);
    }
}

function drawTutorialPhaseButtons(ctx, panelX, sp) {
    const currentPlayer = game.getCurrentPlayer();
    const points = currentPlayer ? currentPlayer.points : 0;

    if (sp === 'roll' || sp === 'roll2' || sp === 'roll_diagonal' || sp === 'stock' || sp === 'post_stock_select') {
        // Select button (same as real game)
        renderer.drawButton(panelX, 385, 200, 50, '#006400', 'Select');
        // Stock button
        const canStock = currentPlayer && currentPlayer.canAfford(GAME_SETTINGS.stockCost || 20);
        if (canStock) {
            renderer.drawButton(panelX, 443, 200, 50, '#665500', `Stock (-${GAME_SETTINGS.stockCost || 20}pt)`);
        } else {
            ctx.globalAlpha = 0.35;
            renderer.drawButton(panelX, 443, 200, 50, '#333344', `Stock (-${GAME_SETTINGS.stockCost || 20}pt)`);
            ctx.globalAlpha = 1.0;
        }
    } else if (sp === 'move' || sp === 'move2' || sp === 'diagonal_move' || sp === 'click_piece' || sp === 'post_stock_move') {
        // Move mode indicator (same as real game)
        ctx.textAlign = 'center';
        if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
            ctx.fillStyle = COLORS.DIAGONAL_MOVE_HIGHLIGHT;
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Diagonal Mode (-10pt)', panelX + 100, 405);
        } else {
            ctx.fillStyle = '#888899';
            ctx.font = '12px Arial';
            ctx.fillText('Click piece for diagonal (-10pt)', panelX + 100, 405);
        }
        ctx.textAlign = 'left';
    } else if (sp === 'place' || sp === 'place2' || sp === 'skill_bomb' || sp === 'skill_bomb_place') {
        // ACTIONS label
        ctx.fillStyle = '#888899';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('ACTIONS', panelX, 355);

        // Stone button (same as real game)
        drawSkillButton(ctx, panelX, 365, 200, 50, {
            name: 'Stone',
            color: COLORS.STONE,
            textColor: COLORS.WHITE,
            cost: 0,
            isSelected: game.placementType === 'stone',
            isAffordable: true
        });

        // Skill button (same as real game)
        if (currentPlayer && currentPlayer.specialSkill) {
            const skillInfo = SKILL_INFO[currentPlayer.specialSkill];
            if (skillInfo) {
                const skillCost = SKILL_COSTS[skillInfo.costKey];
                drawSkillButton(ctx, panelX, 423, 200, 50, {
                    name: skillInfo.name,
                    color: skillInfo.color,
                    textColor: skillInfo.textColor,
                    cost: skillCost,
                    isSelected: game.placementType === 'bomb' || sp === 'skill_place',
                    isAffordable: points >= skillCost
                });
            }
        }

        // Drill button (same as real game)
        drawSkillButton(ctx, panelX, 481, 200, 50, {
            name: 'Drill',
            color: COLORS.DRILL,
            textColor: COLORS.WHITE,
            cost: SKILL_COSTS.drill,
            isSelected: false,
            isAffordable: points >= SKILL_COSTS.drill
        });
    }
}

function drawPhaseUI() {
    const ctx = renderer.ctx;
    const panelX = game.currentTurn === 1 ? 40 : SCREEN_WIDTH - PANEL_WIDTH + 40;
    const opponentPanelX = game.currentTurn === 1 ? SCREEN_WIDTH - PANEL_WIDTH + 40 : 40;

    // Show both players' dice panels in all active phases
    if (game.phase === PHASES.ROLL || game.phase === PHASES.MOVE ||
        game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET ||
        game.phase === PHASES.SKILL_TARGET || game.phase === PHASES.WARP_SELECT) {
        drawPlayerDicePanel(ctx, panelX, game.getCurrentPlayer());
        drawPlayerDicePanel(ctx, opponentPanelX, game.getOtherPlayer());
    }

    if (game.phase === PHASES.ROLL) {
        const currentPlayer = game.getCurrentPlayer();
        const isDominated = currentPlayer.isDominated();

        // Detect hover on buttons
        const mx = game._mouseX || 0, my = game._mouseY || 0;
        const rollHover = mx >= panelX && mx <= panelX + 200 && my >= 385 && my <= 435;
        const stockBtnHover = mx >= panelX && mx <= panelX + 200 && my >= 443 && my <= 493;

        // Draw hover preview arrows
        if (rollHover && !isDominated) {
            drawDiceHoverPreview(ctx, panelX, 'roll');
        } else if (stockBtnHover && !isDominated && !game.stockedThisTurn) {
            if (currentPlayer.hasStock()) {
                drawDiceHoverPreview(ctx, panelX, 'useStock');
            } else if (currentPlayer.canAfford(SKILL_COSTS.stock)) {
                drawDiceHoverPreview(ctx, panelX, 'stock');
            }
        }

        // Buttons
        if (isDominated) {
            renderer.drawButton(panelX, 385, 200, 50, '#006400', 'Select');
            ctx.globalAlpha = 0.35;
            renderer.drawButton(panelX, 443, 200, 50, '#333344', 'Locked');
            ctx.globalAlpha = 1.0;
        } else if (game.stockedThisTurn) {
            // Stock直後はSelectのみ表示
            renderer.drawButton(panelX, 385, 200, 50, rollHover ? '#007700' : '#006400', 'Select');
        } else if (currentPlayer.hasStock()) {
            renderer.drawButton(panelX, 385, 200, 50, rollHover ? '#007700' : '#006400', 'Select');
            renderer.drawButton(panelX, 443, 200, 50, stockBtnHover ? '#A07B18' : '#8B6914', 'Use Stock');
        } else {
            renderer.drawButton(panelX, 385, 200, 50, rollHover ? '#007700' : '#006400', 'Select');
            const canStock = currentPlayer.canAfford(SKILL_COSTS.stock);
            if (canStock) {
                renderer.drawButton(panelX, 443, 200, 50, stockBtnHover ? '#776600' : '#665500', `Stock (-${SKILL_COSTS.stock}pt)`);
            } else {
                ctx.globalAlpha = 0.35;
                renderer.drawButton(panelX, 443, 200, 50, '#333344', `Stock (-${SKILL_COSTS.stock}pt)`);
                ctx.globalAlpha = 1.0;
            }
        }
    } else if (game.phase === PHASES.MOVE) {
        // Move mode indicator
        const currentPlayer = game.getCurrentPlayer();
        ctx.textAlign = 'center';
        if (game.moveMode === DIRECTION_TYPE.DIAGONAL) {
            ctx.fillStyle = COLORS.DIAGONAL_MOVE_HIGHLIGHT;
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Diagonal Mode (-10pt)', panelX + 100, 405);
            ctx.fillStyle = '#888899';
            ctx.font = '12px Arial';
            ctx.fillText('Click piece to switch back', panelX + 100, 425);
        } else {
            ctx.fillStyle = '#888899';
            ctx.font = '12px Arial';
            if (currentPlayer.canAfford(SKILL_COSTS.diagonal_move)) {
                ctx.fillText('Click piece for diagonal (-10pt)', panelX + 100, 405);
            } else {
                ctx.fillStyle = '#555566';
                ctx.fillText('Not enough pts for diagonal', panelX + 100, 405);
            }
        }
        ctx.textAlign = 'left';
    } else if (game.phase === PHASES.WARP_SELECT) {
        ctx.fillStyle = COLORS.WARP_SELECT_HIGHLIGHT;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Select Warp Destination', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
    } else if (game.phase === PHASES.PLACE || game.phase === PHASES.DRILL_TARGET || game.phase === PHASES.SKILL_TARGET) {

        const currentPlayer = game.getCurrentPlayer();
        const points = currentPlayer.points;
        const isDominated = currentPlayer.isDominated();

        // Label
        ctx.fillStyle = '#888899';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('ACTIONS', panelX, 355);

        // Stone button (Y: 365-415) — always available
        drawSkillButton(ctx, panelX, 365, 200, 50, {
            name: 'Stone',
            color: COLORS.STONE,
            textColor: COLORS.WHITE,
            cost: 0,
            isSelected: game.placementType === 'stone' && game.phase === PHASES.PLACE,
            isAffordable: true
        });

        // Skill button (Y: 423-473) — player's selected skill
        const skillInfo = SKILL_INFO[currentPlayer.specialSkill];
        if (skillInfo) {
            const skillCost = SKILL_COSTS[skillInfo.costKey];
            drawSkillButton(ctx, panelX, 423, 200, 50, {
                name: skillInfo.name,
                color: isDominated ? '#333344' : skillInfo.color,
                textColor: isDominated ? '#666677' : skillInfo.textColor,
                cost: skillCost,
                isSelected: game.phase === PHASES.SKILL_TARGET ||
                            ['ice', 'bomb', 'swamp', 'warp'].includes(game.placementType),
                isAffordable: !isDominated && points >= skillCost
            });
        }

        // Drill button (Y: 481-531)
        drawSkillButton(ctx, panelX, 481, 200, 50, {
            name: 'Drill',
            color: isDominated ? '#333344' : COLORS.DRILL,
            textColor: isDominated ? '#666677' : COLORS.WHITE,
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

    // Dice body with rounded corners (dark theme)
    ctx.fillStyle = '#1A1A2E';
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

    // Dice border
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dots (bright on dark)
    ctx.fillStyle = '#CCCCDD';
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
    const size = isSmaller ? 36 : DICE_SIZE;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    const radius = 6;
    const dotRadius = isSmaller ? 3 : 4;

    ctx.save();
    ctx.globalAlpha = isSmaller ? 0.6 : 0.8;

    ctx.fillStyle = '#1A1A2E';
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

    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#CCCCDD';
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
    const btnWidth = 115, btnHeight = 90, gapX = 10, gapY = 8, startY = 200;
    const tabH = 28, tabGap = 4, tabY = 160;
    const totalTabW = PANEL_WIDTH - 40;
    const tabCount = SKILL_CATEGORIES.length;
    const tabW = (totalTabW - tabGap * (tabCount - 1)) / tabCount;

    game.hoveredSkill = null;
    game.hoveredTab = -1;

    const checkPanel = (player, panelX, tabProp, playerNum) => {
        if (player.skillConfirmed) return false;

        // Check tab hover
        for (let t = 0; t < tabCount; t++) {
            const tx = panelX + t * (tabW + tabGap);
            if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
                game.hoveredTab = t;
                game.hoveredTabPanel = playerNum;
                return true;
            }
        }

        // Check skill hover
        const cat = SKILL_CATEGORIES[game[tabProp]];
        if (!cat) return false;
        for (let i = 0; i < cat.skills.length; i++) {
            const row = Math.floor(i / 2), col = i % 2;
            const bx = panelX + col * (btnWidth + gapX);
            const by = startY + row * (btnHeight + gapY);
            if (x >= bx && x <= bx + btnWidth && y >= by && y <= by + btnHeight) {
                game.hoveredSkill = cat.skills[i];
                return true;
            }
        }
        return false;
    };

    if (checkPanel(game.player1, 20, 'skillTabP1', 1)) return;
    checkPanel(game.player2, SCREEN_WIDTH - PANEL_WIDTH + 20, 'skillTabP2', 2);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + 25, y + height / 2, 15, 0, Math.PI * 2);
    ctx.fill();

    // Icon inner dot
    ctx.fillStyle = color === COLORS.STONE ? '#555566' : 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x + 25, y + height / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // Skill name
    ctx.fillStyle = !isAffordable && cost > 0 ? '#555566' : textColor;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 48, y + height / 2 - (cost > 0 ? 6 : 0));

    // Cost text (small, below name)
    if (cost > 0) {
        ctx.fillStyle = !isAffordable ? '#662222' : '#FFD700';
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
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.fillRect(x, y, width, height);

        // Strikethrough line
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
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
