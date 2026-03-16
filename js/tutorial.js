// Tutorial slideshow for Nine Nine
class Tutorial {
    constructor() {
        this.currentSlide = 0;
        this.transitioning = false;
        this.transitionAlpha = 1;
        this.transitionStart = 0;
        this.TRANSITION_MS = 200;
        this.CELL = 40;

        // Color constants (from the prototype)
        this.COL_BG = '#1a1a2e';
        this.COL_CANVAS = '#0a0a1a';
        this.COL_CYAN = '#00E5FF';
        this.COL_P1 = '#00AAFF';
        this.COL_P2 = '#FF4444';
        this.COL_STONE_BODY = '#2A2A3A';
        this.COL_STONE_BORDER = '#B040FF';
        this.COL_GRID = '#2A1A4A';
        this.COL_CELL_A = '#0A0A14';
        this.COL_CELL_B = '#0D0D1A';
        this.COL_TEXT = '#ccc';
        this.COL_NEON = '#B040FF';

        this.slides = this._buildSlides();
    }

    // ── Navigation methods ──

    reset() {
        this.currentSlide = 0;
        this.transitionAlpha = 1;
        this.transitioning = false;
    }

    goToSlide(index) {
        if (index < 0 || index >= this.slides.length) return;
        this.currentSlide = index;
        this.transitionAlpha = 0;
        this.transitionStart = performance.now();
        this.transitioning = true;
    }

    nextSlide() {
        if (!this.isLastSlide()) this.goToSlide(this.currentSlide + 1);
    }

    prevSlide() {
        if (this.currentSlide > 0) this.goToSlide(this.currentSlide - 1);
    }

    isLastSlide() {
        return this.currentSlide === this.slides.length - 1;
    }

    slideCount() {
        return this.slides.length;
    }

    getCurrentSlide() {
        return this.slides[this.currentSlide];
    }

    updateTransition(now) {
        if (this.transitioning) {
            const elapsed = now - this.transitionStart;
            this.transitionAlpha = Math.min(1, elapsed / this.TRANSITION_MS);
            if (this.transitionAlpha >= 1) this.transitioning = false;
        }
    }

    // ── Drawing helpers ──

    drawMiniBoard(ctx, ox, oy, rows, cols) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = ox + c * this.CELL;
                const y = oy + r * this.CELL;
                ctx.fillStyle = (r + c) % 2 === 0 ? this.COL_CELL_A : this.COL_CELL_B;
                ctx.fillRect(x, y, this.CELL, this.CELL);
            }
        }
        ctx.strokeStyle = this.COL_GRID;
        ctx.lineWidth = 1;
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy + r * this.CELL);
            ctx.lineTo(ox + cols * this.CELL, oy + r * this.CELL);
            ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(ox + c * this.CELL, oy);
            ctx.lineTo(ox + c * this.CELL, oy + rows * this.CELL);
            ctx.stroke();
        }
        ctx.save();
        ctx.shadowColor = this.COL_NEON;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = this.COL_NEON;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox, oy, cols * this.CELL, rows * this.CELL);
        ctx.restore();
    }

    drawPiece(ctx, cx, cy, color, radius) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, 0, cx, cy, radius);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }

    drawStone(ctx, cx, cy, size) {
        const s = size / 2;
        const cut = s * 0.38;
        ctx.save();
        ctx.shadowColor = this.COL_STONE_BORDER;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cx - s + cut, cy - s);
        ctx.lineTo(cx + s - cut, cy - s);
        ctx.lineTo(cx + s, cy - s + cut);
        ctx.lineTo(cx + s, cy + s - cut);
        ctx.lineTo(cx + s - cut, cy + s);
        ctx.lineTo(cx - s + cut, cy + s);
        ctx.lineTo(cx - s, cy + s - cut);
        ctx.lineTo(cx - s, cy - s + cut);
        ctx.closePath();
        ctx.fillStyle = this.COL_STONE_BODY;
        ctx.fill();
        ctx.strokeStyle = this.COL_STONE_BORDER;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    drawDice(ctx, cx, cy, value, size) {
        const half = size / 2;
        ctx.save();
        ctx.fillStyle = '#1a1a3e';
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        this.roundRect(ctx, cx - half, cy - half, size, size, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        const dotR = size * 0.08;
        const off = size * 0.25;
        const positions = {
            1: [[0, 0]],
            2: [[-off, -off], [off, off]],
            3: [[-off, -off], [0, 0], [off, off]],
            4: [[-off, -off], [off, -off], [-off, off], [off, off]],
            5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
            6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]]
        };
        (positions[value] || positions[1]).forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(cx + dx, cy + dy, dotR, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    drawArrow(ctx, fromX, fromY, toX, toY, color, lineWidth) {
        lineWidth = lineWidth || 2;
        const headLen = 10;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - 0.4), toY - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(toX - headLen * Math.cos(angle + 0.4), toY - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    drawText(ctx, text, x, y, color, size, align, bold) {
        ctx.save();
        ctx.fillStyle = color || this.COL_TEXT;
        ctx.font = (bold ? 'bold ' : '') + (size || 14) + 'px "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    highlightCell(ctx, ox, oy, r, c, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha || 0.3;
        ctx.fillStyle = color;
        ctx.fillRect(ox + c * this.CELL + 1, oy + r * this.CELL + 1, this.CELL - 2, this.CELL - 2);
        ctx.restore();
    }

    drawCurvedArrow(ctx, x1, y1, x2, y2, curve, color) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 + curve;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        const t = 0.95;
        const ax = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
        const ay = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
        const angle = Math.atan2(y2 - ay, x2 - ax);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 8 * Math.cos(angle - 0.4), y2 - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(x2 - 8 * Math.cos(angle + 0.4), y2 - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawSparkle(ctx, x, y, size, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.moveTo(x - size * 0.5, y - size * 0.5); ctx.lineTo(x + size * 0.5, y + size * 0.5);
        ctx.moveTo(x + size * 0.5, y - size * 0.5); ctx.lineTo(x - size * 0.5, y + size * 0.5);
        ctx.stroke();
        ctx.restore();
    }

    drawEmptySlot(ctx, cx, cy, size) {
        ctx.save();
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        this.roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawStockSlot(ctx, cx, cy, size, filled) {
        ctx.save();
        ctx.strokeStyle = filled ? '#FFD700' : '#333355';
        ctx.lineWidth = filled ? 1.5 : 1;
        ctx.setLineDash(filled ? [] : [3, 3]);
        if (filled) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 4;
        }
        this.roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawDiceQuestion(ctx, cx, cy, size) {
        ctx.save();
        ctx.fillStyle = '#1a1a3e';
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        this.roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#555';
        ctx.font = 'bold ' + (size * 0.5) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
        ctx.restore();
    }

    drawPhaseBox(ctx, x, y, w, h, label, color, isActive, now) {
        ctx.save();
        if (isActive) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 12 + 4 * Math.sin(now / 400);
        }
        this.roundRect(ctx, x, y, w, h, 8);
        ctx.fillStyle = isActive ? '#0D0D1A' : '#080810';
        ctx.fill();
        ctx.strokeStyle = isActive ? color : '#333355';
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        this.roundRect(ctx, x, y, w, h, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        this.drawText(ctx, label, x + w / 2, y + h / 2, isActive ? color : '#555566', 18, 'center', true);
    }

    drawFallIcon(ctx, x, y, now) {
        ctx.save();
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 20, y - 15, 40, 30);
        const t = (now % 2000) / 2000;
        const pieceY = y - 8 - t * 25;
        const alpha = Math.max(0, 1 - t * 1.5);
        ctx.globalAlpha = alpha;
        this.drawPiece(ctx, x, pieceY, this.COL_P2, 8);
        ctx.globalAlpha = 1;
        if (t > 0.5) {
            ctx.globalAlpha = (t - 0.5) * 2;
            ctx.strokeStyle = '#FF4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - 8, y - 40); ctx.lineTo(x + 8, y - 26);
            ctx.moveTo(x + 8, y - 40); ctx.lineTo(x - 8, y - 26);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawTrappedIcon(ctx, x, y, now) {
        this.drawPiece(ctx, x, y, this.COL_P2, 8);
        const offsets = [[-18, 0], [18, 0], [0, -18], [0, 18]];
        offsets.forEach(([dx, dy]) => {
            this.drawStone(ctx, x + dx, y + dy, 14);
        });
        const pulse = 0.3 + 0.2 * Math.sin(now / 400);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawExplosionIcon(ctx, x, y, now) {
        const t = (now % 1500) / 1500;
        const rays = 8;
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200);
        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + t * 0.5;
            const len = 12 + 6 * Math.sin(now / 300 + i);
            ctx.strokeStyle = '#FF8000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FF8000';
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.restore();
    }

    // ── Slides definition ──

    _buildSlides() {
        return [
            // Slide 1: Welcome
            {
                title: 'Nine Nine へようこそ',
                description: '9x9のボードで戦うターン制ストラテジーゲーム',
                draw: (ctx, w, h, now) => {
                    const ox = (w - 9 * this.CELL) / 2;
                    const oy = (h - 9 * this.CELL) / 2;
                    this.drawMiniBoard(ctx, ox, oy, 9, 9);

                    const stonePositions = [[1,2],[2,5],[3,7],[5,1],[6,4],[7,6],[0,8],[8,0],[4,4]];
                    stonePositions.forEach(([r,c]) => {
                        this.drawStone(ctx, ox + c * this.CELL + this.CELL/2, oy + r * this.CELL + this.CELL/2, this.CELL * 0.7);
                    });

                    const pulse = Math.sin(now / 500) * 2;
                    this.drawPiece(ctx, ox + 0 * this.CELL + this.CELL/2, oy + 4 * this.CELL + this.CELL/2, this.COL_P1, 14 + pulse);
                    this.drawPiece(ctx, ox + 8 * this.CELL + this.CELL/2, oy + 4 * this.CELL + this.CELL/2, this.COL_P2, 14 + pulse);

                    this.drawText(ctx, 'P1', ox + 0 * this.CELL + this.CELL/2, oy + 4 * this.CELL - 8, this.COL_P1, 11, 'center', true);
                    this.drawText(ctx, 'P2', ox + 8 * this.CELL + this.CELL/2, oy + 4 * this.CELL - 8, this.COL_P2, 11, 'center', true);
                }
            },

            // Slide 2: Turn Structure
            {
                title: 'ターンの流れ',
                description: '各ターンは「Move Phase」と「Action Phase」の2つのフェーズで構成。これを交互に繰り返します',
                draw: (ctx, w, h, now) => {
                    const cycle = (now % 4000) / 4000;
                    const isMovePhase = cycle < 0.5;

                    const centerY = h / 2 - 30;
                    const boxW = 220, boxH = 80;
                    const gap = 100;

                    // Move Phase box
                    const moveX = w / 2 - boxW - gap / 2;
                    this.drawPhaseBox(ctx, moveX, centerY - boxH / 2, boxW, boxH, 'Move Phase', '#FFD700', isMovePhase, now);

                    // Arrow between phases
                    const arrowY = centerY;
                    this.drawArrow(ctx, moveX + boxW + 10, arrowY, moveX + boxW + gap - 10, arrowY, isMovePhase ? '#FFD700' : this.COL_CYAN, 2);

                    // Action Phase box
                    const actX = w / 2 + gap / 2;
                    this.drawPhaseBox(ctx, actX, centerY - boxH / 2, boxW, boxH, 'Action Phase', this.COL_CYAN, !isMovePhase, now);

                    // Sub descriptions
                    this.drawText(ctx, 'サイコロを振って移動', moveX + boxW / 2, centerY + boxH / 2 + 24, isMovePhase ? '#FFD700' : '#555', 13, 'center');
                    this.drawText(ctx, 'Stone or Skill を選択', actX + boxW / 2, centerY + boxH / 2 + 24, !isMovePhase ? this.COL_CYAN : '#555', 13, 'center');

                    // Player turn indicator at top
                    const turnCycle = Math.floor(now / 4000) % 2;
                    const turnColor = turnCycle === 0 ? this.COL_P1 : this.COL_P2;
                    const turnLabel = turnCycle === 0 ? 'Player 1 のターン' : 'Player 2 のターン';
                    ctx.save();
                    ctx.shadowColor = turnColor;
                    ctx.shadowBlur = 8;
                    this.drawText(ctx, turnLabel, w / 2, 40, turnColor, 16, 'center', true);
                    ctx.restore();

                    // Repeat arrow at bottom
                    const repeatY = centerY + boxH / 2 + 60;
                    ctx.save();
                    ctx.strokeStyle = '#555566';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(actX + boxW / 2, repeatY - 10);
                    ctx.lineTo(actX + boxW / 2, repeatY + 8);
                    ctx.lineTo(moveX + boxW / 2, repeatY + 8);
                    ctx.lineTo(moveX + boxW / 2, repeatY - 10);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                    // Arrowhead on left end
                    ctx.save();
                    ctx.fillStyle = '#555566';
                    ctx.beginPath();
                    ctx.moveTo(moveX + boxW / 2, repeatY - 14);
                    ctx.lineTo(moveX + boxW / 2 - 5, repeatY - 6);
                    ctx.lineTo(moveX + boxW / 2 + 5, repeatY - 6);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    this.drawText(ctx, '相手のターンへ → 繰り返し', w / 2, repeatY + 24, '#555566', 12, 'center');
                }
            },

            // Slide 3: Move Phase Overview (2 steps)
            {
                title: 'Move Phase の流れ',
                description: 'Move Phaseは2つのステップで構成：①サイコロの目を決定 → ②決定した目で移動',
                draw: (ctx, w, h, now) => {
                    const centerY = h / 2 - 20;
                    const boxW = 260, boxH = 90;
                    const gap = 80;

                    // Step indicator at top
                    this.drawText(ctx, '▼ Move Phase', w / 2, 30, '#FFD700', 14, 'center', true);

                    // Step 1: Dice determination
                    const step1X = w / 2 - boxW - gap / 2;
                    const cycle = (now % 4000) / 4000;
                    const isStep1 = cycle < 0.5;

                    ctx.save();
                    if (isStep1) {
                        ctx.shadowColor = '#FFD700';
                        ctx.shadowBlur = 10 + 4 * Math.sin(now / 400);
                    }
                    this.roundRect(ctx, step1X, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.fillStyle = isStep1 ? '#0D0D1A' : '#080810';
                    ctx.fill();
                    ctx.strokeStyle = isStep1 ? '#FFD700' : '#333355';
                    ctx.lineWidth = isStep1 ? 2.5 : 1.5;
                    this.roundRect(ctx, step1X, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.stroke();
                    ctx.restore();

                    // Step 1 number badge
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(step1X + 30, centerY - boxH / 2 + 30, 14, 0, Math.PI * 2);
                    ctx.fillStyle = isStep1 ? '#FFD700' : '#333355';
                    ctx.fill();
                    ctx.restore();
                    this.drawText(ctx, '1', step1X + 30, centerY - boxH / 2 + 30, '#0a0a1a', 14, 'center', true);

                    this.drawText(ctx, 'サイコロの目を決定', step1X + boxW / 2 + 10, centerY - 8, isStep1 ? '#fff' : '#666', 16, 'center', true);
                    this.drawText(ctx, 'Select / Stock / Use Stock', step1X + boxW / 2 + 10, centerY + 18, isStep1 ? '#FFD700' : '#444', 12, 'center');

                    // Dice icon in step 1
                    if (isStep1) {
                        const dVal = 1 + Math.floor(now / 800) % 3;
                        this.drawDice(ctx, step1X + 30, centerY + 16, dVal, 24);
                    }

                    // Arrow between steps
                    const arrowAlpha = 0.4 + 0.3 * Math.sin(now / 500);
                    ctx.save();
                    ctx.globalAlpha = arrowAlpha;
                    this.drawArrow(ctx, step1X + boxW + 10, centerY, step1X + boxW + gap - 10, centerY, '#FFD700', 2.5);
                    ctx.restore();

                    // Step 2: Movement
                    const step2X = w / 2 + gap / 2;
                    const isStep2 = !isStep1;

                    ctx.save();
                    if (isStep2) {
                        ctx.shadowColor = this.COL_CYAN;
                        ctx.shadowBlur = 10 + 4 * Math.sin(now / 400);
                    }
                    this.roundRect(ctx, step2X, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.fillStyle = isStep2 ? '#0D0D1A' : '#080810';
                    ctx.fill();
                    ctx.strokeStyle = isStep2 ? this.COL_CYAN : '#333355';
                    ctx.lineWidth = isStep2 ? 2.5 : 1.5;
                    this.roundRect(ctx, step2X, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.stroke();
                    ctx.restore();

                    // Step 2 number badge
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(step2X + 30, centerY - boxH / 2 + 30, 14, 0, Math.PI * 2);
                    ctx.fillStyle = isStep2 ? this.COL_CYAN : '#333355';
                    ctx.fill();
                    ctx.restore();
                    this.drawText(ctx, '2', step2X + 30, centerY - boxH / 2 + 30, '#0a0a1a', 14, 'center', true);

                    this.drawText(ctx, 'サイコロの目で移動', step2X + boxW / 2 + 10, centerY - 8, isStep2 ? '#fff' : '#666', 16, 'center', true);
                    this.drawText(ctx, '上下左右 or 斜め（-10pt）', step2X + boxW / 2 + 10, centerY + 18, isStep2 ? this.COL_CYAN : '#444', 12, 'center');

                    // Mini board icon in step 2
                    if (isStep2) {
                        const miniOx = step2X + 14, miniOy = centerY + 2;
                        const ms = 10;
                        for (let r = 0; r < 3; r++) {
                            for (let c = 0; c < 3; c++) {
                                ctx.fillStyle = (r + c) % 2 === 0 ? '#1a1a2e' : '#0D0D1A';
                                ctx.fillRect(miniOx + c * ms, miniOy + r * ms, ms, ms);
                            }
                        }
                        ctx.strokeStyle = this.COL_CYAN;
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(miniOx, miniOy, 3 * ms, 3 * ms);
                        this.drawPiece(ctx, miniOx + 1.5 * ms, miniOy + 1.5 * ms, this.COL_P1, 4);
                    }

                    // Bottom hint
                    this.drawText(ctx, '次のスライドで各ステップを詳しく説明します', w / 2, centerY + boxH / 2 + 50, '#555566', 12, 'center');
                }
            },

            // Slide 4: Dice Queue intro
            {
                title: 'サイコロキュー',
                description: 'サイコロの目は3つ先まで見えています。ストック機能で目を保存できます',
                draw: (ctx, w, h, now) => {
                    // Queue visualization: CURRENT + NEXT1 + NEXT2
                    const DS = 40;
                    const gap = 16;
                    const queueY = 95;
                    const queueValues = [3, 5, 1];
                    const labels = ['現在', '次', 'その次'];
                    const totalQW = 3 * DS + 2 * gap;
                    const qStartX = w / 2 - totalQW / 2;

                    this.drawText(ctx, '3つ先まで見える！', w / 2, queueY - 30, this.COL_CYAN, 15, 'center', true);

                    queueValues.forEach((val, i) => {
                        const dx = qStartX + i * (DS + gap) + DS / 2;
                        const dy = queueY + DS / 2;
                        // Highlight current
                        if (i === 0) {
                            const pulse = 0.4 + 0.2 * Math.sin(now / 400);
                            ctx.save();
                            ctx.shadowColor = this.COL_CYAN;
                            ctx.shadowBlur = 10 + pulse * 5;
                            this.drawDice(ctx, dx, dy, val, DS);
                            ctx.restore();
                        } else {
                            ctx.save();
                            ctx.globalAlpha = 0.6 - i * 0.15;
                            this.drawDice(ctx, dx, dy, val, DS);
                            ctx.restore();
                        }
                        this.drawText(ctx, labels[i], dx, dy + DS / 2 + 16, i === 0 ? this.COL_CYAN : '#777', 11, 'center', i === 0);
                    });

                    // Arrow showing queue flow
                    ctx.save();
                    ctx.globalAlpha = 0.3;
                    this.drawArrow(ctx, qStartX + 2 * (DS + gap) + DS + 10, queueY + DS / 2, qStartX - 10, queueY + DS / 2, '#888', 1);
                    ctx.restore();

                    // Stock section
                    const stockY = queueY + DS + 65;
                    this.drawText(ctx, 'ストック機能', w / 2, stockY, this.COL_CYAN, 15, 'center', true);

                    // Stock box
                    const stockBoxW = 50, stockBoxH = 44;
                    const stockBoxX = w / 2 - 120;
                    const stockBoxY = stockY + 18;
                    ctx.save();
                    ctx.strokeStyle = '#44AAFF';
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, stockBoxX, stockBoxY, stockBoxW, stockBoxH, 6);
                    ctx.stroke();
                    ctx.restore();
                    this.drawText(ctx, 'STOCK', stockBoxX + stockBoxW / 2, stockBoxY - 8, '#44AAFF', 10, 'center', true);

                    // Dice going into stock animation
                    const t = (now % 3000) / 3000;
                    if (t < 0.5) {
                        // Dice sliding into stock
                        const mt = t / 0.5;
                        const diceStartX = stockBoxX + stockBoxW + 40;
                        const diceX = diceStartX - mt * (diceStartX - stockBoxX - stockBoxW / 2);
                        const diceAlpha = mt < 0.8 ? 1 : 1 - (mt - 0.8) / 0.2;
                        ctx.save();
                        ctx.globalAlpha = diceAlpha;
                        this.drawDice(ctx, diceX, stockBoxY + stockBoxH / 2, 4, 30);
                        ctx.restore();
                        // Arrow
                        ctx.save();
                        ctx.globalAlpha = 0.4 * (1 - mt);
                        this.drawArrow(ctx, diceStartX + 10, stockBoxY + stockBoxH / 2, stockBoxX + stockBoxW + 5, stockBoxY + stockBoxH / 2, '#44AAFF', 1.5);
                        ctx.restore();
                    } else {
                        // Dice stored in stock
                        const st = (t - 0.5) / 0.5;
                        const pulse = 0.6 + 0.3 * Math.sin(now / 300);
                        ctx.save();
                        ctx.globalAlpha = pulse;
                        this.drawDice(ctx, stockBoxX + stockBoxW / 2, stockBoxY + stockBoxH / 2, 4, 28);
                        ctx.restore();
                    }

                    // Description text
                    this.drawText(ctx, '今の目を保存して、好きなタイミングで使える', w / 2 + 30, stockBoxY + stockBoxH + 20, '#aaa', 12, 'center');

                    this.drawText(ctx, '次のスライドで詳しく説明します', w / 2, h - 15, '#555566', 11, 'center');
                }
            },

            // Slide 5: Dice Queue & Stock details
            {
                title: 'サイコロキュー＆ストック',
                description: '3つのパターン: Select（通常）、Stock（保存 -20pt）、Use Stock（使用・無料）',
                draw: (ctx, w, h, now) => {
                    // Draw 3 panels side by side matching actual game layout
                    const DS = 32;
                    const gap = 8;
                    const slotW = DS + gap;
                    const panelInnerW = 4 * slotW;
                    const panelPad = 12;
                    const panelW = panelInnerW + panelPad * 2;
                    const panelH = 180;
                    const totalGap = 30;
                    const totalW = panelW * 3 + totalGap * 2;
                    const startX = (w - totalW) / 2;
                    const panelY = (h - panelH) / 2 - 10;

                    const panels = [
                        { label: 'Select（通常）', color: this.COL_NEON, type: 'select' },
                        { label: 'Stock（保存）', color: '#FFD700', type: 'stock' },
                        { label: 'Use Stock（使用）', color: '#00FF88', type: 'useStock' }
                    ];

                    panels.forEach((panel, pi) => {
                        const px = startX + pi * (panelW + totalGap);
                        const py = panelY;

                        // Panel background
                        ctx.save();
                        ctx.shadowColor = panel.color;
                        ctx.shadowBlur = 6;
                        this.roundRect(ctx, px, py, panelW, panelH, 8);
                        ctx.fillStyle = '#080810';
                        ctx.fill();
                        ctx.strokeStyle = panel.color;
                        ctx.lineWidth = 1.5;
                        this.roundRect(ctx, px, py, panelW, panelH, 8);
                        ctx.stroke();
                        ctx.restore();

                        // Panel title
                        this.drawText(ctx, panel.label, px + panelW / 2, py - 14, panel.color, 13, 'center', true);

                        // Slot positions
                        const slotY = py + 50;
                        const useX   = px + panelPad + slotW * 0 + DS / 2;
                        const curX   = px + panelPad + slotW * 1 + DS / 2;
                        const n1X    = px + panelPad + slotW * 2 + DS / 2;
                        const n2X    = px + panelPad + slotW * 3 + DS / 2;
                        const stockX = curX;
                        const stockY = slotY + DS + 30;

                        // Labels
                        ctx.fillStyle = '#888899';
                        ctx.font = '9px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('USE', useX, slotY - DS / 2 - 6);
                        ctx.fillText('CURRENT', curX, slotY - DS / 2 - 6);
                        ctx.fillText('NEXT', (n1X + n2X) / 2, slotY - DS / 2 - 6);

                        // Queue values
                        const queueVals = panel.type === 'useStock' ? [3, 1, 2] : [2, 1, 3];

                        if (panel.type === 'select') {
                            // USE slot: filled with current dice (selected)
                            ctx.save();
                            ctx.shadowColor = panel.color;
                            ctx.shadowBlur = 6;
                            ctx.strokeStyle = panel.color;
                            ctx.lineWidth = 2;
                            this.roundRect(ctx, useX - DS/2, slotY - DS/2, DS, DS, 4);
                            ctx.stroke();
                            ctx.restore();
                            this.drawDice(ctx, useX, slotY, queueVals[0], DS);

                            // CURRENT: next value slid in
                            this.drawDice(ctx, curX, slotY, queueVals[1], DS);
                            // NEXT1, NEXT2
                            this.drawDice(ctx, n1X, slotY, queueVals[2], DS);
                            this.drawDiceQuestion(ctx, n2X, slotY, DS);

                            // STOCK: empty
                            this.drawStockSlot(ctx, stockX, stockY, DS, false);
                            ctx.fillStyle = '#888899';
                            ctx.font = '9px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('STOCK', stockX, stockY + DS / 2 + 12);

                            // Arrow: CURRENT -> USE
                            this.drawArrow(ctx, curX - DS/2 - 2, slotY, useX + DS/2 + 2, slotY, panel.color, 1.5);

                            // Description
                            this.drawText(ctx, 'CURRENTを選択して移動', px + panelW / 2, py + panelH - 16, '#aaa', 10, 'center');

                        } else if (panel.type === 'stock') {
                            // USE: empty dashed
                            this.drawEmptySlot(ctx, useX, slotY, DS);

                            // CURRENT
                            this.drawDice(ctx, curX, slotY, queueVals[1], DS);
                            // NEXT1, NEXT2
                            this.drawDice(ctx, n1X, slotY, queueVals[2], DS);
                            this.drawDiceQuestion(ctx, n2X, slotY, DS);

                            // STOCK: dice stocked
                            this.drawStockSlot(ctx, stockX, stockY, DS, true);
                            this.drawDice(ctx, stockX, stockY, queueVals[0], DS);
                            ctx.fillStyle = '#FFD700';
                            ctx.font = '9px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('STOCK', stockX, stockY + DS / 2 + 12);

                            // Arrow: old CURRENT -> STOCK (curved down)
                            const pulse = 0.6 + 0.4 * Math.sin(now / 400);
                            ctx.save();
                            ctx.globalAlpha = pulse;
                            this.drawCurvedArrow(ctx, curX + DS/2 + 2, slotY + DS/2, stockX + DS/2 + 2, stockY - DS/2, 20, '#FFD700');
                            ctx.restore();

                            // Cost label
                            this.drawText(ctx, '-20pt', px + panelW / 2 + DS, slotY + DS / 2 + 18, '#FFD700', 11, 'center', true);

                            // Description
                            this.drawText(ctx, 'CURRENTをストックに保存', px + panelW / 2, py + panelH - 16, '#aaa', 10, 'center');

                        } else {
                            // useStock
                            // USE: empty dashed
                            this.drawEmptySlot(ctx, useX, slotY, DS);

                            // CURRENT: stock value replaced in
                            ctx.save();
                            ctx.shadowColor = '#00FF88';
                            ctx.shadowBlur = 6;
                            ctx.strokeStyle = '#00FF88';
                            ctx.lineWidth = 2;
                            this.roundRect(ctx, curX - DS/2, slotY - DS/2, DS, DS, 4);
                            ctx.stroke();
                            ctx.restore();
                            this.drawDice(ctx, curX, slotY, queueVals[0], DS);

                            // NEXT1, NEXT2 (unchanged)
                            this.drawDice(ctx, n1X, slotY, queueVals[1], DS);
                            this.drawDice(ctx, n2X, slotY, queueVals[2], DS);

                            // STOCK: now empty
                            this.drawStockSlot(ctx, stockX, stockY, DS, false);
                            ctx.fillStyle = '#888899';
                            ctx.font = '9px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('STOCK', stockX, stockY + DS / 2 + 12);

                            // Arrow: STOCK -> CURRENT (curved up)
                            const pulse = 0.6 + 0.4 * Math.sin(now / 400);
                            ctx.save();
                            ctx.globalAlpha = pulse;
                            this.drawCurvedArrow(ctx, stockX - DS/2 - 2, stockY - DS/2, curX - DS/2 - 2, slotY + DS/2, -20, '#00FF88');
                            ctx.restore();

                            // Free label
                            this.drawText(ctx, 'FREE', px + panelW / 2 - DS, slotY + DS / 2 + 18, '#00FF88', 11, 'center', true);

                            // Description
                            this.drawText(ctx, 'ストックからCURRENTへ', px + panelW / 2, py + panelH - 16, '#aaa', 10, 'center');
                        }
                    });
                }
            },

            // Slide 6: Move Phase - Dice & Movement
            {
                title: 'Move Phase — サイコロと移動',
                description: '1〜3の目が出るサイコロを振って移動。上下左右は無料、斜め移動は10pt消費',
                draw: (ctx, w, h, now) => {
                    const boardSize = 5;
                    const bx = w / 2 - (boardSize * this.CELL) / 2 + 80;
                    const by = (h - boardSize * this.CELL) / 2;
                    this.drawMiniBoard(ctx, bx, by, boardSize, boardSize);

                    // Piece at center
                    const pc = 2, pr = 2;
                    this.drawPiece(ctx, bx + pc * this.CELL + this.CELL/2, by + pr * this.CELL + this.CELL/2, this.COL_P1, 14);

                    // Alternate between orthogonal and diagonal every 2.5 seconds
                    const showOrtho = Math.floor(now / 2500) % 2 === 0;

                    if (showOrtho) {
                        // Orthogonal highlights (yellow - free)
                        const orthogonal = [[0,2],[1,2],[3,2],[4,2],[2,0],[2,1],[2,3],[2,4]];
                        orthogonal.forEach(([r,c]) => {
                            this.highlightCell(ctx, bx, by, r, c, '#FFD700', 0.25);
                        });
                    } else {
                        // Diagonal highlights (green - 10pt)
                        const diagonal = [[1,1],[1,3],[3,1],[3,3],[0,0],[0,4],[4,0],[4,4]];
                        diagonal.forEach(([r,c]) => {
                            this.highlightCell(ctx, bx, by, r, c, '#00FF66', 0.2);
                        });
                    }

                    // Dice on the left
                    const diceX = bx - 100;
                    const diceY = h / 2 - 30;
                    this.drawDice(ctx, diceX, diceY, 2, 50);
                    this.drawText(ctx, 'Dice: 1〜3', diceX, diceY - 40, this.COL_TEXT, 12, 'center');

                    // Arrow from dice to board
                    const t = (now % 2000) / 2000;
                    const arrowEnd = diceX + 30 + t * (bx + pc * this.CELL + this.CELL/2 - diceX - 50);
                    ctx.save();
                    ctx.globalAlpha = 1 - t * 0.5;
                    this.drawArrow(ctx, diceX + 30, diceY, arrowEnd, by + pr * this.CELL + this.CELL/2, '#FFD700', 2);
                    ctx.restore();

                    // Legend (static, highlight active mode)
                    const legX = bx - 110;
                    const legY = h / 2 + 40;

                    ctx.save();
                    ctx.fillStyle = '#FFD700';
                    ctx.globalAlpha = showOrtho ? 0.5 : 0.15;
                    ctx.fillRect(legX, legY, 16, 16);
                    ctx.globalAlpha = 1;
                    ctx.restore();
                    this.drawText(ctx, '上下左右 (Free)', legX + 24, legY + 8, showOrtho ? '#FFD700' : '#555', 12, 'left');

                    ctx.save();
                    ctx.fillStyle = '#00FF66';
                    ctx.globalAlpha = !showOrtho ? 0.4 : 0.1;
                    ctx.fillRect(legX, legY + 26, 16, 16);
                    ctx.globalAlpha = 1;
                    ctx.restore();
                    this.drawText(ctx, '斜め (-10pt)', legX + 24, legY + 34, !showOrtho ? '#00FF66' : '#555', 12, 'left');

                    // Direction label (changes with mode)
                    if (showOrtho) {
                        this.drawText(ctx, '↑↓←→ Free', bx + boardSize * this.CELL / 2, by + boardSize * this.CELL + 25, '#FFD700', 14, 'center', true);
                    } else {
                        this.drawText(ctx, '↗↘↙↖ -10pt', bx + boardSize * this.CELL / 2, by + boardSize * this.CELL + 25, '#00FF66', 14, 'center', true);
                    }
                }
            },

            // Slide 7: Movement & Obstacles
            {
                title: '移動と障害物',
                description: '石があると、その手前で止まります（サイコロ3の例）。盤外に出ると感電！',
                draw: (ctx, w, h, now) => {
                    const cycle = (now % 3000) / 3000;
                    const moving = cycle >= 0.3 && cycle < 0.7;
                    const stopped = cycle >= 0.7;
                    const moveT = moving ? (cycle - 0.3) / 0.4 : (stopped ? 1 : 0);

                    // Left example: horizontal blocked by stone
                    const lRows = 3, lCols = 5;
                    const lx = w / 2 - lCols * this.CELL - 30, ly = (h - lRows * this.CELL) / 2 + 10;
                    this.drawMiniBoard(ctx, lx, ly, lRows, lCols);
                    this.drawText(ctx, '横移動（石で停止）', lx + lCols * this.CELL / 2, ly - 22, '#FFD700', 13, 'center', true);

                    // Stone at (1, 3)
                    this.drawStone(ctx, lx + 3 * this.CELL + this.CELL/2, ly + 1 * this.CELL + this.CELL/2, this.CELL * 0.7);

                    // Player starts at (1, 0), dice=3, should stop at (1, 2)
                    const lPlayerX = lx + (0 + moveT * 2) * this.CELL + this.CELL/2;
                    const lPlayerY = ly + 1 * this.CELL + this.CELL/2;
                    this.drawPiece(ctx, lPlayerX, lPlayerY, this.COL_P1, 14);

                    // Highlight path cells
                    if (!stopped) {
                        for (let c = 1; c <= 2; c++) {
                            this.highlightCell(ctx, lx, ly, 1, c, '#FFD700', 0.15);
                        }
                    }

                    // Blocked cell X mark on (1,3)
                    if (stopped) {
                        ctx.save();
                        ctx.globalAlpha = 0.6;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 3;
                        const bx2 = lx + 3 * this.CELL + this.CELL/2;
                        const by2 = ly + 1 * this.CELL + this.CELL/2;
                        ctx.beginPath();
                        ctx.moveTo(bx2 - 8, by2 - 8); ctx.lineTo(bx2 + 8, by2 + 8);
                        ctx.moveTo(bx2 + 8, by2 - 8); ctx.lineTo(bx2 - 8, by2 + 8);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Label: dice=3, moved=2
                    this.drawText(ctx, 'Dice: 3', lx + lCols * this.CELL / 2, ly + lRows * this.CELL + 20, this.COL_TEXT, 12, 'center');
                    if (stopped) {
                        this.drawText(ctx, '→ 石の手前で停止（2マス移動）', lx + lCols * this.CELL / 2, ly + lRows * this.CELL + 40, '#FFD700', 12, 'center', true);
                    }

                    // Right example: diagonal blocked by stone
                    const rRows = 5, rCols = 5;
                    const rx = w / 2 + 30, ry = (h - rRows * this.CELL) / 2 + 10;
                    this.drawMiniBoard(ctx, rx, ry, rRows, rCols);
                    this.drawText(ctx, '斜め移動（石で停止）', rx + rCols * this.CELL / 2, ry - 22, '#00FF66', 13, 'center', true);

                    // Stone at (1, 3) - diagonal blocker
                    this.drawStone(ctx, rx + 3 * this.CELL + this.CELL/2, ry + 1 * this.CELL + this.CELL/2, this.CELL * 0.7);

                    // Player starts at (4, 0), moves diagonally up-right, dice=3
                    const diagPath = [[4,0],[3,1],[2,2]];
                    const diagIdx = Math.min(Math.floor(moveT * 3), 2);
                    const diagFrac = (moveT * 3) - diagIdx;
                    let rPlayerX, rPlayerY;
                    if (diagIdx < 2 && moving) {
                        const from = diagPath[diagIdx];
                        const to = diagPath[diagIdx + 1];
                        rPlayerX = rx + (from[1] + (to[1] - from[1]) * diagFrac) * this.CELL + this.CELL/2;
                        rPlayerY = ry + (from[0] + (to[0] - from[0]) * diagFrac) * this.CELL + this.CELL/2;
                    } else {
                        const pos = diagPath[stopped ? 2 : 0];
                        rPlayerX = rx + pos[1] * this.CELL + this.CELL/2;
                        rPlayerY = ry + pos[0] * this.CELL + this.CELL/2;
                    }
                    this.drawPiece(ctx, rPlayerX, rPlayerY, this.COL_P1, 14);

                    // Highlight diagonal path
                    if (!stopped) {
                        for (let i = 1; i <= 2; i++) {
                            const [r, c] = diagPath[i];
                            this.highlightCell(ctx, rx, ry, r, c, '#00FF66', 0.15);
                        }
                    }

                    // Blocked cell X mark on (1,3)
                    if (stopped) {
                        ctx.save();
                        ctx.globalAlpha = 0.6;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 3;
                        const bx3 = rx + 3 * this.CELL + this.CELL/2;
                        const by3 = ry + 1 * this.CELL + this.CELL/2;
                        ctx.beginPath();
                        ctx.moveTo(bx3 - 8, by3 - 8); ctx.lineTo(bx3 + 8, by3 + 8);
                        ctx.moveTo(bx3 + 8, by3 - 8); ctx.lineTo(bx3 - 8, by3 + 8);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Label
                    this.drawText(ctx, 'Dice: 3', rx + rCols * this.CELL / 2, ry + rRows * this.CELL + 20, this.COL_TEXT, 12, 'center');
                    if (stopped) {
                        this.drawText(ctx, '→ 石の手前で停止（2マス移動）', rx + rCols * this.CELL / 2, ry + rRows * this.CELL + 40, '#00FF66', 12, 'center', true);
                    }
                }
            },

            // Slide 8: Edge Danger
            {
                title: '端に注意！',
                description: 'ボードの外に出ると感電して即負け！',
                draw: (ctx, w, h, now) => {
                    const rows = 4, cols = 5;
                    const ox = (w - cols * this.CELL) / 2;
                    const oy = (h - rows * this.CELL) / 2 + 10;
                    this.drawMiniBoard(ctx, ox, oy, rows, cols);

                    const edgePulse = 0.3 + 0.2 * Math.sin(now / 300);
                    for (let c = 0; c < cols; c++) {
                        this.highlightCell(ctx, ox, oy, 0, c, '#FF4444', edgePulse);
                    }

                    ctx.save();
                    ctx.shadowColor = '#FF4444';
                    ctx.shadowBlur = 15 + 5 * Math.sin(now / 300);
                    ctx.strokeStyle = '#FF4444';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(ox, oy);
                    ctx.lineTo(ox + cols * this.CELL, oy);
                    ctx.stroke();
                    ctx.restore();

                    const cycle = (now % 3000) / 3000;
                    const pieceCol = 2;
                    let pieceRow, pieceAlpha;
                    if (cycle < 0.5) {
                        pieceRow = 0;
                        pieceAlpha = 1;
                    } else if (cycle < 0.75) {
                        const t = (cycle - 0.5) / 0.25;
                        pieceRow = -t * 1.5;
                        pieceAlpha = 1 - t;
                    } else {
                        const t = (cycle - 0.75) / 0.25;
                        pieceRow = 1;
                        pieceAlpha = t;
                    }

                    ctx.save();
                    ctx.globalAlpha = pieceAlpha;
                    this.drawPiece(ctx, ox + pieceCol * this.CELL + this.CELL/2, oy + pieceRow * this.CELL + this.CELL/2, this.COL_P1, 14);
                    ctx.restore();

                    if (cycle >= 0.5 && cycle < 0.75) {
                        const t = (cycle - 0.5) / 0.25;
                        ctx.save();
                        ctx.globalAlpha = t;
                        const xPos = ox + pieceCol * this.CELL + this.CELL/2;
                        const yPos = oy - 30;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(xPos - 12, yPos - 12);
                        ctx.lineTo(xPos + 12, yPos + 12);
                        ctx.moveTo(xPos + 12, yPos - 12);
                        ctx.lineTo(xPos - 12, yPos + 12);
                        ctx.stroke();
                        ctx.restore();
                    }

                    this.drawText(ctx, 'SHOCK = LOSE', w / 2, oy + rows * this.CELL + 30, '#FF4444', 18, 'center', true);
                    this.drawArrow(ctx, ox + pieceCol * this.CELL + this.CELL/2 + 40, oy + this.CELL/2, ox + pieceCol * this.CELL + this.CELL/2 + 40, oy - 25, '#FF4444', 2);
                }
            },

            // Slide 9: Action Phase
            {
                title: 'Action Phase — Stone or Skill',
                description: '移動後、Stone（石を置く）か Skill（特殊スキルを使う）を選びます',
                draw: (ctx, w, h, now) => {
                    const cycle = (now % 4000) / 4000;
                    const isStone = cycle < 0.5;

                    const centerY = h / 2 - 20;
                    const boxW = 240, boxH = 100;
                    const gap = 80;

                    // Stone box
                    const stoneX = w / 2 - boxW - gap / 2;
                    const stoneActive = isStone;
                    ctx.save();
                    if (stoneActive) {
                        ctx.shadowColor = this.COL_NEON;
                        ctx.shadowBlur = 12 + 4 * Math.sin(now / 400);
                    }
                    this.roundRect(ctx, stoneX, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.fillStyle = stoneActive ? '#0D0D1A' : '#080810';
                    ctx.fill();
                    ctx.strokeStyle = stoneActive ? this.COL_NEON : '#333355';
                    ctx.lineWidth = stoneActive ? 2.5 : 1.5;
                    this.roundRect(ctx, stoneX, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.stroke();
                    ctx.restore();

                    // Stone icon
                    this.drawStone(ctx, stoneX + 50, centerY, this.CELL * 0.7);
                    this.drawText(ctx, 'Stone', stoneX + boxW / 2 + 20, centerY - 10, stoneActive ? '#fff' : '#666', 20, 'center', true);
                    this.drawText(ctx, '石を配置する', stoneX + boxW / 2 + 20, centerY + 16, stoneActive ? this.COL_NEON : '#444', 13, 'center');

                    // "OR" label
                    this.drawText(ctx, 'OR', w / 2, centerY, '#555566', 20, 'center', true);

                    // Skill box
                    const skillX = w / 2 + gap / 2;
                    const skillActive = !isStone;
                    ctx.save();
                    if (skillActive) {
                        ctx.shadowColor = '#FF8000';
                        ctx.shadowBlur = 12 + 4 * Math.sin(now / 400);
                    }
                    this.roundRect(ctx, skillX, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.fillStyle = skillActive ? '#0D0D1A' : '#080810';
                    ctx.fill();
                    ctx.strokeStyle = skillActive ? '#FF8000' : '#333355';
                    ctx.lineWidth = skillActive ? 2.5 : 1.5;
                    this.roundRect(ctx, skillX, centerY - boxH / 2, boxW, boxH, 10);
                    ctx.stroke();
                    ctx.restore();

                    // Skill icon (star burst)
                    const skillIconX = skillX + 50;
                    ctx.save();
                    const burstColor = skillActive ? '#FF8000' : '#444';
                    ctx.strokeStyle = burstColor;
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2 + now / 800;
                        const len = 12 + (skillActive ? 3 * Math.sin(now / 300 + i) : 0);
                        ctx.beginPath();
                        ctx.moveTo(skillIconX + Math.cos(angle) * 4, centerY + Math.sin(angle) * 4);
                        ctx.lineTo(skillIconX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
                        ctx.stroke();
                    }
                    ctx.beginPath();
                    ctx.arc(skillIconX, centerY, 6, 0, Math.PI * 2);
                    ctx.fillStyle = burstColor;
                    ctx.globalAlpha = 0.5;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.restore();

                    this.drawText(ctx, 'Skill', skillX + boxW / 2 + 20, centerY - 10, skillActive ? '#fff' : '#666', 20, 'center', true);
                    this.drawText(ctx, '特殊スキルを使う', skillX + boxW / 2 + 20, centerY + 16, skillActive ? '#FF8000' : '#444', 13, 'center');

                    // Cost labels
                    this.drawText(ctx, 'Cost: 0pt', stoneX + boxW / 2, centerY + boxH / 2 + 20, stoneActive ? '#aaa' : '#444', 12, 'center');
                    this.drawText(ctx, 'Cost: スキルによる', skillX + boxW / 2, centerY + boxH / 2 + 20, skillActive ? '#aaa' : '#444', 12, 'center');

                    // Phase indicator
                    this.drawText(ctx, '▼ Action Phase', w / 2, 30, this.COL_CYAN, 14, 'center', true);
                }
            },

            // Slide 10: Stone Placement
            {
                title: 'Stone — 石の配置',
                description: '上下左右の隣接する空きマスに石を1つ配置できます（コスト0pt）。石は障害物になり、相手の移動を制限します',
                draw: (ctx, w, h, now) => {
                    const boardSize = 5;
                    const bx = (w - boardSize * this.CELL) / 2;
                    const by = (h - boardSize * this.CELL) / 2 - 10;
                    this.drawMiniBoard(ctx, bx, by, boardSize, boardSize);

                    // Player at (2,2)
                    this.drawPiece(ctx, bx + 2 * this.CELL + this.CELL/2, by + 2 * this.CELL + this.CELL/2, this.COL_P1, 14);

                    // Existing stones
                    this.drawStone(ctx, bx + 3 * this.CELL + this.CELL/2, by + 3 * this.CELL + this.CELL/2, this.CELL * 0.7);
                    this.drawStone(ctx, bx + 0 * this.CELL + this.CELL/2, by + 1 * this.CELL + this.CELL/2, this.CELL * 0.7);

                    // Highlight adjacent placeable cells (orthogonal only)
                    const adjacent = [[1,2],[3,2],[2,1],[2,3]];
                    const cycle = (now % 3000) / 3000;
                    const selectedIdx = Math.floor(cycle * adjacent.length) % adjacent.length;

                    adjacent.forEach(([r,c], i) => {
                        const isSelected = i === selectedIdx;
                        const pulse = isSelected ? 0.4 + 0.15 * Math.sin(now / 200) : 0.1 + 0.05 * Math.sin(now / 600 + i);
                        this.highlightCell(ctx, bx, by, r, c, this.COL_NEON, pulse);
                    });

                    // Show stone being placed at selected cell
                    const sel = adjacent[selectedIdx];
                    ctx.save();
                    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200);
                    this.drawStone(ctx, bx + sel[1] * this.CELL + this.CELL/2, by + sel[0] * this.CELL + this.CELL/2, this.CELL * 0.6);
                    ctx.restore();

                    // Labels
                    this.drawText(ctx, '上下左右の隣接マスに石を配置', w / 2, by + boardSize * this.CELL + 28, this.COL_NEON, 14, 'center', true);
                    this.drawText(ctx, '石は通行不可の障害物になる', w / 2, by + boardSize * this.CELL + 48, '#888', 12, 'center');
                }
            },

            // Slide 11: Stone placement rules
            {
                title: '石の配置ルール',
                description: '置けない場所と上書きできるタイル',
                draw: (ctx, w, h, now) => {
                    const S = 3;
                    const cs = this.CELL;

                    // Left side: can't place
                    const leftCx = w / 3;
                    this.drawText(ctx, '置けない', leftCx, 112, '#FF4444', 15, 'center', true);

                    const lbx = leftCx - S * cs / 2;
                    const lby = 130;
                    this.drawMiniBoard(ctx, lbx, lby, S, S);

                    // Player 1 at center (1,1)
                    this.drawPiece(ctx, lbx + 1 * cs + cs/2, lby + 1 * cs + cs/2, this.COL_P1, 12);

                    // 4 adjacent cells all blocked
                    this.drawStone(ctx, lbx + 1 * cs + cs/2, lby + 0 * cs + cs/2, cs * 0.65);
                    this.drawStone(ctx, lbx + 0 * cs + cs/2, lby + 1 * cs + cs/2, cs * 0.65);
                    this.drawPiece(ctx, lbx + 2 * cs + cs/2, lby + 1 * cs + cs/2, this.COL_P2, 12);
                    this.drawStone(ctx, lbx + 1 * cs + cs/2, lby + 2 * cs + cs/2, cs * 0.65);

                    // X marks on all 4 adjacent cells
                    const ngCells = [[0,1],[1,0],[1,2],[2,1]];
                    ngCells.forEach(([r, c]) => {
                        const pulse = 0.2 + 0.1 * Math.sin(now / 500);
                        this.highlightCell(ctx, lbx, lby, r, c, '#FF4444', pulse);
                        const cx = lbx + c * cs + cs/2;
                        const cy = lby + r * cs + cs/2 + 8;
                        ctx.save();
                        ctx.globalAlpha = 0.8;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
                        ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6);
                        ctx.stroke();
                        ctx.restore();
                    });

                    // Labels under left board
                    const lLabelY = lby + S * cs + 16;
                    this.drawText(ctx, '石がある → NG', leftCx, lLabelY, '#FF6666', 12, 'center');
                    this.drawText(ctx, 'プレイヤーがいる → NG', leftCx, lLabelY + 20, '#FF6666', 12, 'center');

                    // Right side: overwritable
                    const rightCx = w * 2 / 3;
                    this.drawText(ctx, '上書きできる', rightCx, 112, '#00FF88', 15, 'center', true);

                    const rbx = rightCx - S * cs / 2;
                    const rby = 130;
                    this.drawMiniBoard(ctx, rbx, rby, S, S);

                    // Player 1 at center (1,1)
                    this.drawPiece(ctx, rbx + 1 * cs + cs/2, rby + 1 * cs + cs/2, this.COL_P1, 12);

                    // Fountain tile at up (0,1)
                    {
                        const fx = rbx + 1 * cs + cs/2, fy = rby + 0 * cs + cs/2;
                        ctx.save();
                        ctx.shadowColor = '#00FF88';
                        ctx.shadowBlur = 6;
                        ctx.beginPath();
                        ctx.arc(fx, fy, 12, 0, Math.PI * 2);
                        ctx.fillStyle = '#003322';
                        ctx.fill();
                        ctx.strokeStyle = '#00FF88';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.restore();
                        this.drawText(ctx, 'F', fx, fy, '#00FF88', 10, 'center', true);
                    }

                    // Bomb tile at right (1,2)
                    {
                        const bxx = rbx + 2 * cs + cs/2, byy = rby + 1 * cs + cs/2;
                        ctx.save();
                        ctx.shadowColor = '#FF8800';
                        ctx.shadowBlur = 6;
                        ctx.beginPath();
                        ctx.arc(bxx, byy, 12, 0, Math.PI * 2);
                        ctx.fillStyle = '#331100';
                        ctx.fill();
                        ctx.strokeStyle = '#FF8800';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.restore();
                        this.drawText(ctx, '\uD83D\uDCA3', bxx, byy + 1, '#FF8800', 11, 'center');
                    }

                    // Ice tile at down (2,1)
                    {
                        const ix = rbx + 1 * cs + cs/2, iy = rby + 2 * cs + cs/2;
                        ctx.save();
                        ctx.shadowColor = '#88DDFF';
                        ctx.shadowBlur = 6;
                        ctx.beginPath();
                        ctx.arc(ix, iy, 12, 0, Math.PI * 2);
                        ctx.fillStyle = '#001833';
                        ctx.fill();
                        ctx.strokeStyle = '#88DDFF';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.restore();
                        this.drawText(ctx, '\u2744', ix, iy + 1, '#88DDFF', 11, 'center');
                    }

                    // Highlight all 4 adjacent as OK
                    const okCells = [[0,1],[1,0],[1,2],[2,1]];
                    okCells.forEach(([r, c]) => {
                        const pulse = 0.15 + 0.1 * Math.sin(now / 600);
                        this.highlightCell(ctx, rbx, rby, r, c, '#00FF88', pulse);
                    });

                    // Animated stone placement cycling through the tiles
                    const cycle = (now % 4000) / 4000;
                    const selIdx = Math.floor(cycle * 4) % 4;
                    const selCell = okCells[selIdx];
                    const scx = rbx + selCell[1] * cs + cs/2;
                    const scy = rby + selCell[0] * cs + cs/2;

                    // Pulsing stone being placed
                    ctx.save();
                    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200);
                    this.drawStone(ctx, scx, scy, cs * 0.55);
                    ctx.restore();

                    // Check mark on selected
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.strokeStyle = '#00FF88';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(scx - 6, scy + 10); ctx.lineTo(scx - 1, scy + 15); ctx.lineTo(scx + 7, scy + 5);
                    ctx.stroke();
                    ctx.restore();

                    // Labels under right board
                    const rLabelY = rby + S * cs + 16;
                    this.drawText(ctx, 'Fountain → 上書きOK', rightCx, rLabelY, '#00FF88', 12, 'center');
                    this.drawText(ctx, 'スキルタイル（爆弾・氷等）→ 上書きOK', rightCx, rLabelY + 20, '#00FF88', 12, 'center');

                    // Center divider
                    ctx.save();
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(w / 2, 90);
                    ctx.lineTo(w / 2, lby + S * cs + 50);
                    ctx.stroke();
                    ctx.restore();
                }
            },

            // Slide 12: Skills
            {
                title: '特殊スキル',
                description: 'ゲーム開始前に1つスキルを選択。戦略の幅が広がります',
                draw: (ctx, w, h, now) => {
                    const skills = [
                        { name: 'Ice Tile',   color: '#ADD8E6', effect: '移動距離+1' },
                        { name: 'Bomb',       color: '#FF8000', effect: '踏んだら撃破' },
                        { name: 'Sniper',     color: '#228B22', effect: '遠距離狙撃' },
                        { name: 'Landshark',  color: '#DC143C', effect: '隣接撃破' },
                        { name: 'Warp Hole',  color: '#6600CC', effect: '瞬間移動' },
                        { name: 'Meteor',     color: '#FFD700', effect: 'どこでも石配置' }
                    ];

                    const cardW = 120, cardH = 140, gap = 20;
                    const cols = 3, rows = 2;
                    const totalW = cols * cardW + (cols - 1) * gap;
                    const totalH = rows * cardH + (rows - 1) * gap;
                    const startX = (w - totalW) / 2;
                    const startY = (h - totalH) / 2;

                    skills.forEach((skill, i) => {
                        const col = i % cols;
                        const row = Math.floor(i / cols);
                        const x = startX + col * (cardW + gap);
                        const y = startY + row * (cardH + gap);

                        ctx.save();
                        ctx.shadowColor = skill.color;
                        ctx.shadowBlur = 4 + 3 * Math.sin(now / 600 + i);
                        this.roundRect(ctx, x, y, cardW, cardH, 6);
                        ctx.fillStyle = '#0D0D1A';
                        ctx.fill();
                        ctx.strokeStyle = skill.color;
                        ctx.lineWidth = 1.5;
                        this.roundRect(ctx, x, y, cardW, cardH, 6);
                        ctx.stroke();
                        ctx.restore();

                        ctx.fillStyle = skill.color;
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(x + 1, y + 1, cardW - 2, 30);
                        ctx.globalAlpha = 1;

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(x + cardW / 2, y + 65, 18, 0, Math.PI * 2);
                        ctx.fillStyle = skill.color;
                        ctx.globalAlpha = 0.2;
                        ctx.fill();
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = skill.color;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.restore();

                        this.drawText(ctx, skill.name, x + cardW / 2, y + 16, '#fff', 13, 'center', true);
                        this.drawText(ctx, skill.name[0], x + cardW / 2, y + 65, skill.color, 18, 'center', true);
                        this.drawText(ctx, skill.effect, x + cardW / 2, y + cardH - 22, '#aaa', 12, 'center');
                    });
                }
            },

            // Slide 13: Score & Win Conditions
            {
                title: 'ポイント',
                description: '毎ターン10ポイント獲得。泉（+100pt）を取ると有利に',
                draw: (ctx, w, h, now) => {
                    // Point earning explanation
                    const earnY = 45;
                    this.drawText(ctx, 'ポイントの獲得', w / 2, earnY, this.COL_CYAN, 16, 'center', true);

                    // Every turn +10pt
                    const turnY = earnY + 40;
                    ctx.save();
                    ctx.strokeStyle = '#555';
                    ctx.lineWidth = 1;
                    this.roundRect(ctx, w / 2 - 140, turnY - 16, 280, 36, 6);
                    ctx.stroke();
                    ctx.restore();
                    this.drawText(ctx, '毎ターン +10 pt', w / 2, turnY, '#CCCCEE', 14, 'center', true);

                    // Fountain +100pt
                    const fY = turnY + 55;
                    const fPulse = 4 + 2 * Math.sin(now / 400);
                    ctx.save();
                    ctx.shadowColor = '#00FF88';
                    ctx.shadowBlur = fPulse + 8;
                    ctx.beginPath();
                    ctx.arc(w / 2 - 60, fY, 18, 0, Math.PI * 2);
                    ctx.fillStyle = '#003322';
                    ctx.fill();
                    ctx.strokeStyle = '#00FF88';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                    this.drawText(ctx, '+100', w / 2 - 60, fY, '#00FF88', 11, 'center', true);
                    this.drawText(ctx, '泉マスに止まると +100 pt', w / 2 + 40, fY, '#00FF88', 13, 'center');

                    // How to spend points
                    const useY = fY + 65;
                    this.drawText(ctx, 'ポイントの使い道', w / 2, useY, this.COL_CYAN, 16, 'center', true);

                    const boxW = 120, boxH = 105, gap = 16;
                    const totalW = 4 * boxW + 3 * gap;
                    const startX = (w - totalW) / 2;
                    const itemY = useY + 25;
                    const colors = ['#FFAA44', '#44AAFF', '#FF44AA', '#AAFF44'];
                    const labels = ['斜め移動', 'ストック', 'スキル', 'ドリル'];
                    const costs = ['10 pt', '20 pt', '※', '100 pt'];

                    // Draw boxes
                    for (let i = 0; i < 4; i++) {
                        const bx = startX + i * (boxW + gap);
                        const pulse = 0.6 + 0.15 * Math.sin(now / 600 + i * 1.2);
                        ctx.save();
                        ctx.globalAlpha = pulse;
                        ctx.strokeStyle = colors[i];
                        ctx.lineWidth = 2;
                        this.roundRect(ctx, bx, itemY, boxW, boxH, 8);
                        ctx.stroke();
                        ctx.restore();
                        this.drawText(ctx, labels[i], bx + boxW / 2, itemY + 18, colors[i], 13, 'center', true);
                        this.drawText(ctx, costs[i], bx + boxW / 2, itemY + boxH - 10, '#fff', 11, 'center', true);
                    }

                    // Diagonal movement: 3x3 grid with piece moving diagonally
                    {
                        const bx = startX, cx = bx + boxW / 2, cy = itemY + 58;
                        const cs = 16;
                        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                            ctx.strokeStyle = '#444';
                            ctx.lineWidth = 0.5;
                            ctx.strokeRect(cx - 1.5 * cs + c * cs, cy - 1.5 * cs + r * cs, cs, cs);
                        }
                        const t = (now % 2000) / 2000;
                        const fromR = 2, fromC = 0, toR = 0, toC = 2;
                        const pr = fromR + (toR - fromR) * Math.min(t * 1.5, 1);
                        const pc = fromC + (toC - fromC) * Math.min(t * 1.5, 1);
                        this.drawPiece(ctx, cx - 1.5 * cs + pc * cs + cs / 2, cy - 1.5 * cs + pr * cs + cs / 2, '#FFAA44', 5);
                        // Diagonal arrow hint
                        ctx.save();
                        ctx.globalAlpha = 0.3;
                        ctx.strokeStyle = '#FFAA44';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([3, 3]);
                        ctx.beginPath();
                        ctx.moveTo(cx - 1.5 * cs + cs / 2, cy - 1.5 * cs + 2 * cs + cs / 2);
                        ctx.lineTo(cx - 1.5 * cs + 2 * cs + cs / 2, cy - 1.5 * cs + cs / 2);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Stock: dice going into a box
                    {
                        const bx = startX + (boxW + gap), cx = bx + boxW / 2, cy = itemY + 58;
                        const t = (now % 2500) / 2500;
                        // Stock box
                        ctx.save();
                        ctx.strokeStyle = '#44AAFF';
                        ctx.lineWidth = 1.5;
                        this.roundRect(ctx, cx + 8, cy - 12, 28, 24, 4);
                        ctx.stroke();
                        this.drawText(ctx, 'ST', cx + 22, cy, '#44AAFF', 9, 'center', true);
                        ctx.restore();
                        // Dice sliding in
                        const diceX = cx - 25 + Math.min(t * 2, 1) * 33;
                        const diceAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
                        ctx.save();
                        ctx.globalAlpha = diceAlpha;
                        this.drawDice(ctx, diceX, cy, 4, 20);
                        ctx.restore();
                    }

                    // Skill: explosion effect
                    {
                        const bx = startX + 2 * (boxW + gap), cx = bx + boxW / 2, cy = itemY + 58;
                        const t = (now % 2000) / 2000;
                        // Target piece
                        this.drawPiece(ctx, cx, cy, this.COL_P2, 7);
                        // Explosion rays
                        if (t > 0.3) {
                            const et = (t - 0.3) / 0.7;
                            ctx.save();
                            ctx.globalAlpha = 1 - et;
                            ctx.strokeStyle = '#FF44AA';
                            ctx.lineWidth = 2;
                            for (let a = 0; a < 6; a++) {
                                const angle = a * Math.PI / 3 + now / 800;
                                const r1 = 10 + et * 8;
                                const r2 = 16 + et * 12;
                                ctx.beginPath();
                                ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
                                ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
                                ctx.stroke();
                            }
                            ctx.restore();
                        }
                    }

                    // Drill: piece passing through a stone
                    {
                        const bx = startX + 3 * (boxW + gap), cx = bx + boxW / 2, cy = itemY + 58;
                        const t = (now % 2500) / 2500;
                        // Stone in the middle
                        this.drawStone(ctx, cx, cy, 18);
                        // Piece drilling through
                        const pieceX = cx - 30 + t * 60;
                        const nearStone = Math.abs(pieceX - cx) < 12;
                        ctx.save();
                        if (nearStone) {
                            ctx.globalAlpha = 0.5 + 0.5 * Math.abs(pieceX - cx) / 12;
                        }
                        this.drawPiece(ctx, pieceX, cy, '#AAFF44', 6);
                        ctx.restore();
                        // Drill lines when passing through
                        if (nearStone) {
                            ctx.save();
                            ctx.globalAlpha = 0.6;
                            ctx.strokeStyle = '#AAFF44';
                            ctx.lineWidth = 1;
                            for (let i = -2; i <= 2; i++) {
                                ctx.beginPath();
                                ctx.moveTo(pieceX - 8, cy + i * 4);
                                ctx.lineTo(pieceX + 8, cy + i * 4);
                                ctx.stroke();
                            }
                            ctx.restore();
                        }
                    }

                    this.drawText(ctx, '※ 選択したスキルによる', w / 2, h - 8, '#999', 10, 'center');
                }
            },

            // Slide 14: Lose conditions
            {
                title: '敗北条件',
                description: 'これらに当てはまると負け！生き残れ！',
                draw: (ctx, w, h, now) => {
                    this.drawText(ctx, 'こうなったら負け！', w / 2, 75, '#FF4444', 16, 'center', true);
                    this.drawText(ctx, '生き残るサバイバルゲーム', w / 2, 98, '#FF8888', 12, 'center');

                    const boxW = 170, boxH = 155, gap = 20;
                    const totalW = 3 * boxW + 2 * gap;
                    const startX = (w - totalW) / 2;
                    const boxY = 118;

                    // Danger box frames
                    for (let i = 0; i < 3; i++) {
                        const bx = startX + i * (boxW + gap);
                        const pulse = 0.4 + 0.15 * Math.sin(now / 500 + i);
                        ctx.save();
                        ctx.globalAlpha = pulse;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 1.5;
                        this.roundRect(ctx, bx, boxY, boxW, boxH, 8);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // (1) Can't move - piece surrounded by stones
                    {
                        const bx = startX, cx = bx + boxW / 2, cy = boxY + 70;
                        this.drawText(ctx, '移動できない', bx + boxW / 2, boxY + 18, '#FF6666', 13, 'center', true);
                        // 3x3 mini grid
                        const cs = 22;
                        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                            ctx.strokeStyle = '#333';
                            ctx.lineWidth = 0.5;
                            ctx.strokeRect(cx - 1.5 * cs + c * cs, cy - 1.5 * cs + r * cs, cs, cs);
                        }
                        // Center piece
                        this.drawPiece(ctx, cx, cy, this.COL_P1, 7);
                        // Surrounding stones (4 directions)
                        this.drawStone(ctx, cx, cy - cs, 16);
                        this.drawStone(ctx, cx, cy + cs, 16);
                        this.drawStone(ctx, cx - cs, cy, 16);
                        this.drawStone(ctx, cx + cs, cy, 16);
                        // Pulsing danger ring
                        const ringPulse = 0.3 + 0.25 * Math.sin(now / 400);
                        ctx.save();
                        ctx.globalAlpha = ringPulse;
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                        // X marks on blocked directions
                        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                        ctx.save();
                        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300);
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 2;
                        dirs.forEach(([dc, dr]) => {
                            const mx = cx + dc * cs, my = cy + dr * cs;
                            ctx.beginPath();
                            ctx.moveTo(mx - 4, my - 4); ctx.lineTo(mx + 4, my + 4);
                            ctx.moveTo(mx + 4, my - 4); ctx.lineTo(mx - 4, my + 4);
                            ctx.stroke();
                        });
                        ctx.restore();
                        this.drawText(ctx, 'LOSE', cx, cy + 55, '#FF4444', 12, 'center', true);
                    }

                    // (2) Can't act - can't place stone or use skill
                    {
                        const bx = startX + (boxW + gap), cx = bx + boxW / 2, cy = boxY + 70;
                        this.drawText(ctx, 'アクションできない', bx + boxW / 2, boxY + 18, '#FF6666', 13, 'center', true);
                        const cs = 22;
                        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                            ctx.strokeStyle = '#333';
                            ctx.lineWidth = 0.5;
                            ctx.strokeRect(cx - 1.5 * cs + c * cs, cy - 1.5 * cs + r * cs, cs, cs);
                        }
                        this.drawPiece(ctx, cx, cy, this.COL_P1, 7);
                        // All adjacent cells have stones
                        this.drawStone(ctx, cx - cs, cy - cs, 14);
                        this.drawStone(ctx, cx, cy - cs, 14);
                        this.drawStone(ctx, cx + cs, cy - cs, 14);
                        this.drawStone(ctx, cx - cs, cy, 14);
                        this.drawStone(ctx, cx + cs, cy, 14);
                        this.drawStone(ctx, cx - cs, cy + cs, 14);
                        this.drawStone(ctx, cx, cy + cs, 14);
                        this.drawStone(ctx, cx + cs, cy + cs, 14);
                        // "No stone" and "No skill" indicators
                        const t = (now % 2000) / 2000;
                        const showStone = t < 0.5;
                        ctx.save();
                        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 300);
                        if (showStone) {
                            this.drawText(ctx, '石を置けない', cx - 30, cy + 52, '#FF8888', 10, 'center');
                        } else {
                            this.drawText(ctx, 'スキルも使えない', cx + 30, cy + 52, '#FF8888', 10, 'center');
                        }
                        ctx.restore();
                        // Big prohibition sign
                        ctx.save();
                        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 400);
                        ctx.strokeStyle = '#FF4444';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(cx, cy, 32, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(cx - 22, cy + 22);
                        ctx.lineTo(cx + 22, cy - 22);
                        ctx.stroke();
                        ctx.restore();
                        this.drawText(ctx, 'LOSE', cx, cy + 55, '#FF4444', 12, 'center', true);
                    }

                    // (3) Electrocution - piece hits neon border
                    {
                        const bx = startX + 2 * (boxW + gap), cx = bx + boxW / 2, cy = boxY + 65;
                        this.drawText(ctx, 'ネオンボーダーに感電', bx + boxW / 2, boxY + 18, '#FF6666', 13, 'center', true);
                        // Board edge with neon glow
                        const boardW = 100, boardH = 70;
                        const bleft = cx - boardW / 2, btop = cy - boardH / 2;
                        // Neon border glow
                        const neonPulse = 8 + 4 * Math.sin(now / 300);
                        ctx.save();
                        ctx.shadowColor = '#00FFFF';
                        ctx.shadowBlur = neonPulse;
                        ctx.strokeStyle = '#00FFFF';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(bleft, btop, boardW, boardH);
                        ctx.restore();
                        // Grid inside
                        const gcs = 20;
                        const gcols = 5, grows = 3;
                        for (let r = 0; r < grows; r++) for (let c = 0; c < gcols; c++) {
                            ctx.strokeStyle = '#222';
                            ctx.lineWidth = 0.5;
                            ctx.strokeRect(bleft + c * gcs, btop + r * gcs + (boardH - grows * gcs) / 2, gcs, gcs);
                        }
                        // Piece moving out and hitting border
                        const t = (now % 3000) / 3000;
                        let pieceX, pieceY, pieceAlpha = 1;
                        if (t < 0.4) {
                            // Piece on edge
                            pieceX = bleft + gcs * 4 + gcs / 2;
                            pieceY = cy;
                        } else if (t < 0.65) {
                            // Moving out
                            const mt = (t - 0.4) / 0.25;
                            pieceX = bleft + gcs * 4 + gcs / 2 + mt * gcs;
                            pieceY = cy;
                        } else if (t < 0.8) {
                            // Hit border - shock effect
                            const st = (t - 0.65) / 0.15;
                            pieceX = bleft + boardW;
                            pieceY = cy;
                            pieceAlpha = 1 - st * 0.5;
                            // Lightning bolts
                            ctx.save();
                            ctx.globalAlpha = 1 - st;
                            ctx.strokeStyle = '#FFFF00';
                            ctx.lineWidth = 2;
                            for (let i = 0; i < 5; i++) {
                                const angle = (i / 5) * Math.PI * 2 + now / 100;
                                const r1 = 8 + st * 5;
                                const r2 = 16 + st * 10;
                                ctx.beginPath();
                                ctx.moveTo(pieceX + Math.cos(angle) * r1, pieceY + Math.sin(angle) * r1);
                                ctx.lineTo(pieceX + Math.cos(angle) * r2, pieceY + Math.sin(angle) * r2);
                                ctx.stroke();
                            }
                            ctx.restore();
                        } else {
                            // Fade out
                            const ft = (t - 0.8) / 0.2;
                            pieceX = bleft + boardW;
                            pieceY = cy;
                            pieceAlpha = 0.5 * (1 - ft);
                        }
                        ctx.save();
                        ctx.globalAlpha = pieceAlpha;
                        this.drawPiece(ctx, pieceX, pieceY, this.COL_P1, 7);
                        ctx.restore();
                        // Arrow showing movement direction
                        if (t < 0.4) {
                            ctx.save();
                            ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 300);
                            this.drawArrow(ctx, pieceX + 10, pieceY, bleft + boardW - 3, pieceY, '#FF4444', 1.5);
                            ctx.restore();
                        }
                        this.drawText(ctx, 'LOSE', cx, cy + 60, '#FF4444', 12, 'center', true);
                    }

                    this.drawText(ctx, 'これらを避けて生き残れ！', w / 2, h - 15, '#FFAA44', 13, 'center', true);
                }
            },

            // Slide 15: Ready!
            {
                title: '準備完了！',
                description: 'Player vs Player か Player vs COM を選んでゲームスタート！',
                draw: (ctx, w, h, now) => {
                    const btnW = 260, btnH = 80;
                    const pvpX = w / 2 - btnW - 30, pvpY = h / 2 - btnH / 2 - 20;
                    const comX = w / 2 + 30, comY = pvpY;

                    const pvpPulse = 2 + Math.sin(now / 500) * 2;
                    ctx.save();
                    ctx.shadowColor = this.COL_P1;
                    ctx.shadowBlur = 10 + pvpPulse;
                    this.roundRect(ctx, pvpX, pvpY, btnW, btnH, 10);
                    ctx.fillStyle = '#0A1828';
                    ctx.fill();
                    ctx.strokeStyle = this.COL_P1;
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, pvpX, pvpY, btnW, btnH, 10);
                    ctx.stroke();
                    ctx.restore();
                    this.drawText(ctx, 'VS Player', pvpX + btnW / 2, pvpY + btnH / 2 - 8, this.COL_P1, 22, 'center', true);
                    this.drawText(ctx, '2人で対戦', pvpX + btnW / 2, pvpY + btnH / 2 + 16, '#888', 12, 'center');
                    this.drawPiece(ctx, pvpX + 40, pvpY + btnH / 2, this.COL_P1, 10);
                    this.drawPiece(ctx, pvpX + btnW - 40, pvpY + btnH / 2, this.COL_P1, 10);

                    const comPulse = 2 + Math.sin(now / 500 + 1) * 2;
                    ctx.save();
                    ctx.shadowColor = this.COL_P2;
                    ctx.shadowBlur = 10 + comPulse;
                    this.roundRect(ctx, comX, comY, btnW, btnH, 10);
                    ctx.fillStyle = '#1A0808';
                    ctx.fill();
                    ctx.strokeStyle = this.COL_P2;
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, comX, comY, btnW, btnH, 10);
                    ctx.stroke();
                    ctx.restore();
                    this.drawText(ctx, 'VS COM', comX + btnW / 2, comY + btnH / 2 - 8, this.COL_P2, 22, 'center', true);
                    this.drawText(ctx, 'CPUと対戦', comX + btnW / 2, comY + btnH / 2 + 16, '#888', 12, 'center');
                    this.drawPiece(ctx, comX + 40, comY + btnH / 2, this.COL_P1, 10);
                    this.drawPiece(ctx, comX + btnW - 40, comY + btnH / 2, this.COL_P2, 10);

                    const sparkleAlpha = 0.5 + 0.5 * Math.sin(now / 300);
                    ctx.save();
                    ctx.globalAlpha = sparkleAlpha;
                    this.drawText(ctx, 'Good luck!', w / 2, h - 40, '#FFD700', 18, 'center', true);
                    ctx.restore();

                    const sparkles = [[80, 60], [w - 80, 60], [80, h - 60], [w - 80, h - 60]];
                    sparkles.forEach(([sx, sy], i) => {
                        const sa = 0.3 + 0.3 * Math.sin(now / 400 + i * 1.5);
                        ctx.save();
                        ctx.globalAlpha = sa;
                        this.drawSparkle(ctx, sx, sy, 8 + Math.sin(now / 300 + i) * 3, this.COL_NEON);
                        ctx.restore();
                    });
                }
            }
        ];
    }
}
