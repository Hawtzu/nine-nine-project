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

        this.electromagnetTileImage = new Image();
        this.electromagnetTileImage.src = 'assets/skills/electromagnet.svg';

        // Neon border sparks
        this.borderSparks = [];
        for (let i = 0; i < NEON.SPARK_COUNT; i++) {
            this.borderSparks.push(this._newBorderSpark());
        }

        // Fall effect particles
        this.fallLightning = [];
        this.fallSparks = [];
        // Bomb effect particles
        this.bombParticles = [];
        this.bombShockwave = null;

        // ============================================================
        // Menu Effects State
        // ============================================================
        this.menuTime = 0;
        this.menuFrameCount = 0;
        this.menuLastTime = 0;

        // Glitch effect (E)
        this.menuGlitchActive = false;
        this.menuGlitchTimer = 3 + Math.random() * 2;
        this.menuGlitchDuration = 0;

        // Hover cycling (G)
        this.menuHoveredIndex = 0;
        this.menuHoverTimer = 0;

        // Scanline phases (I)
        this.menuScanlinePhases = [0, 0.7, 1.4, 2.1];

        // Dice state (K) — 7 dice
        this.menuDice = [
            this._createMenuDie(80, 280, 40),
            this._createMenuDie(1200, 250, 38),
            this._createMenuDie(140, 480, 34),
            this._createMenuDie(1150, 450, 36),
            this._createMenuDie(60, 650, 30),
            this._createMenuDie(1220, 620, 32),
            this._createMenuDie(200, 180, 28),
        ];

        // Board background auto-play state (C)
        this.menuBoardState = new Array(81).fill(0);
        this.menuAutoPlayTimer = 0;
        this.menuAutoPlayTurn = 1;
        this.menuAutoPlayMoveCount = 0;

        // Board icon rotation (J)
        this.menuBoardIconRotation = 0;
    }

    // --- Menu Die Factory ---
    _createMenuDie(x, y, size) {
        return {
            x, y, baseX: x, baseY: y, size,
            value: Math.floor(Math.random() * 6) + 1,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 1.5,
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.5 + Math.random() * 0.5,
            bobAmp: 15 + Math.random() * 10,
            rollTimer: 3 + Math.random() * 4,
            rolling: false,
            rollDuration: 0,
        };
    }

    _updateMenuDie(die, dt) {
        die.bobPhase += die.bobSpeed * dt;
        die.y = die.baseY + Math.sin(die.bobPhase) * die.bobAmp;
        die.x = die.baseX + Math.cos(die.bobPhase * 0.7) * 5;
        die.rotation += die.rotSpeed * dt;

        if (die.rolling) {
            die.rollDuration -= dt;
            die.rotSpeed = 8 * (Math.random() > 0.5 ? 1 : -1);
            if (Math.random() < 0.3) die.value = Math.floor(Math.random() * 6) + 1;
            if (die.rollDuration <= 0) {
                die.rolling = false;
                die.rotSpeed = (Math.random() - 0.5) * 1.5;
                die.value = Math.floor(Math.random() * 6) + 1;
                die.rollTimer = 3 + Math.random() * 4;
            }
        } else {
            die.rollTimer -= dt;
            if (die.rollTimer <= 0) {
                die.rolling = true;
                die.rollDuration = 0.6 + Math.random() * 0.4;
            }
        }
    }

    _drawMenuDie(die) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(die.x, die.y);
        ctx.rotate(die.rotation);
        const s = die.size;
        const half = s / 2;

        // Die body
        ctx.fillStyle = '#0a0a2a';
        ctx.strokeStyle = '#B040FF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#B040FF';
        ctx.shadowBlur = 10;
        this._menuRoundRect(ctx, -half, -half, s, s, 6);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Pips
        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 4;
        const pip = s * 0.1;
        const o = half * 0.55;
        const pips = [];
        const v = die.value;
        if (v === 1) pips.push([0, 0]);
        if (v === 2) { pips.push([-o, -o], [o, o]); }
        if (v === 3) { pips.push([-o, -o], [0, 0], [o, o]); }
        if (v === 4) { pips.push([-o, -o], [o, -o], [-o, o], [o, o]); }
        if (v === 5) { pips.push([-o, -o], [o, -o], [0, 0], [-o, o], [o, o]); }
        if (v === 6) { pips.push([-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]); }
        for (const [px, py] of pips) {
            ctx.beginPath();
            ctx.arc(px, py, pip, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    _menuRoundRect(ctx, x, y, w, h, r) {
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
                this.drawCell(r, c, board.getTile(r, c), now || 0, board);
            }
        }
    }

    drawCell(row, col, tileType, now, board) {
        const x = col * CELL_SIZE + BOARD_OFFSET_X;
        const y = row * CELL_SIZE + BOARD_OFFSET_Y;

        // 1. Cell background: dark checkerboard
        const isAlt = (row + col) % 2 === 0;
        this.ctx.fillStyle = isAlt ? COLORS.CELL_BG : COLORS.CELL_BG_ALT;
        this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // 2. Special tile overlay (dark muted color + inner glow)
        let tileColor = null;
        switch (tileType) {
            case MARKERS.BOMB: {
                const bombO = board ? board.getBombOwner(row, col) : null;
                tileColor = bombO === 2 ? '#2A0A00' : '#1A1000';
                break;
            }
            case MARKERS.ICE:        tileColor = COLORS.ICE_TILE; break;
            case MARKERS.FOUNTAIN:   tileColor = COLORS.FOUNTAIN_TILE; break;
            case MARKERS.SWAMP:      tileColor = COLORS.SWAMP_TILE; break;
            case MARKERS.WARP:       tileColor = COLORS.WARP_TILE; break;
            case MARKERS.CHECKPOINT: tileColor = COLORS.CHECKPOINT_TILE; break;
            case MARKERS.SNOW:       tileColor = COLORS.SNOW_TILE; break;
            case MARKERS.ELECTROMAGNET: {
                const emO = board ? board.getElectromagnetOwner(row, col) : null;
                tileColor = emO === 2 ? '#2A0A0A' : '#001A2A';
                break;
            }
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

        // 3b. Draw electromagnet stone (cyber octagon with electric sparks)
        if (tileType === MARKERS.ELECTROMAGNET) {
            const emOwner = board ? board.getElectromagnetOwner(row, col) : null;
            this.drawElectromagnetStone(x, y, now, emOwner);
        }

        // 4. Draw tile images
        const imgSize = CELL_SIZE * 0.7;
        const imgX = x + (CELL_SIZE - imgSize) / 2;
        const imgY = y + (CELL_SIZE - imgSize) / 2;

        if (tileType === MARKERS.BOMB && this.bombTileImage && this.bombTileImage.complete && this.bombTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.bombTileImage, imgX, imgY, imgSize, imgSize);
            // Owner color indicator border
            const bombOwner = board ? board.getBombOwner(row, col) : null;
            if (bombOwner) {
                const ownerColor = bombOwner === 1 ? '#00AAFF' : '#FF4444';
                this.ctx.save();
                this.ctx.strokeStyle = ownerColor;
                this.ctx.lineWidth = 2;
                this.ctx.shadowColor = ownerColor;
                this.ctx.shadowBlur = 6;
                this.ctx.strokeRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
                this.ctx.shadowBlur = 0;
                this.ctx.restore();
            }
        }
        if (tileType === MARKERS.ICE && this.iceTileImage && this.iceTileImage.complete && this.iceTileImage.naturalWidth > 0) {
            this.ctx.drawImage(this.iceTileImage, imgX, imgY, imgSize, imgSize);
            this.drawIceEffect(x, y, now);
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
        // Electromagnet tile image is drawn by drawElectromagnetStone (player-colored)

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

    drawIceEffect(cellX, cellY, now) {
        const ctx = this.ctx;
        const cx = cellX + CELL_SIZE / 2;
        const cy = cellY + CELL_SIZE / 2;
        const pad = 4;

        ctx.save();

        // 1. Frost overlay — semi-transparent white gradient from edges
        const frostGrad = ctx.createRadialGradient(cx, cy, CELL_SIZE * 0.15, cx, cy, CELL_SIZE * 0.45);
        frostGrad.addColorStop(0, 'rgba(200, 230, 255, 0)');
        frostGrad.addColorStop(0.7, 'rgba(200, 230, 255, 0.05)');
        frostGrad.addColorStop(1, 'rgba(180, 220, 255, 0.15)');
        ctx.fillStyle = frostGrad;
        ctx.fillRect(cellX + pad, cellY + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);

        // 2. Sparkle/shimmer dots — 5 sparkles that twinkle at different rates
        const sparkles = [
            { ox: 0.25, oy: 0.2, speed: 1.7, phase: 0 },
            { ox: 0.7, oy: 0.35, speed: 2.3, phase: 1.5 },
            { ox: 0.4, oy: 0.7, speed: 1.9, phase: 3.0 },
            { ox: 0.8, oy: 0.75, speed: 2.7, phase: 4.5 },
            { ox: 0.15, oy: 0.55, speed: 2.1, phase: 2.2 }
        ];

        for (const sp of sparkles) {
            const alpha = 0.3 + 0.7 * Math.max(0, Math.sin((now || 0) / 400 * sp.speed + sp.phase));
            const size = 1.5 + alpha * 1.5;
            const sx = cellX + CELL_SIZE * sp.ox;
            const sy = cellY + CELL_SIZE * sp.oy;

            // Draw cross-shaped sparkle
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(sx - size, sy);
            ctx.lineTo(sx + size, sy);
            ctx.moveTo(sx, sy - size);
            ctx.lineTo(sx, sy + size);
            ctx.stroke();

            // Center dot
            ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Thin ice-crack lines (static, subtle)
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cellX + CELL_SIZE * 0.3, cellY + CELL_SIZE * 0.15);
        ctx.lineTo(cellX + CELL_SIZE * 0.5, cellY + CELL_SIZE * 0.45);
        ctx.lineTo(cellX + CELL_SIZE * 0.7, cellY + CELL_SIZE * 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cellX + CELL_SIZE * 0.5, cellY + CELL_SIZE * 0.45);
        ctx.lineTo(cellX + CELL_SIZE * 0.4, cellY + CELL_SIZE * 0.75);
        ctx.stroke();

        ctx.restore();
    }

    drawElectromagnetStone(cellX, cellY, now, owner) {
        const ctx = this.ctx;
        const cx = cellX + CELL_SIZE / 2;
        const cy = cellY + CELL_SIZE / 2;
        const r = CELL_SIZE / 3;
        const sides = 8;

        // Player-specific colors
        const glowColor = owner === 1 ? '#00AAFF' : owner === 2 ? '#FF4444' : '#00FFFF';
        const glowRGB = owner === 1 ? '0, 170, 255' : owner === 2 ? '255, 68, 68' : '0, 255, 255';
        const fillInner = owner === 1 ? '#0A1A3A' : owner === 2 ? '#3A0A0A' : '#0A2A3A';
        const fillOuter = owner === 1 ? '#051025' : owner === 2 ? '#250510' : '#051520';

        ctx.save();

        // Pulsing glow
        const pulse = 0.6 + 0.4 * Math.sin((now || 0) / 200);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8 + 8 * pulse;

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

        // Fill with dark electric gradient
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, fillInner);
        grad.addColorStop(1, fillOuter);
        ctx.fillStyle = grad;
        ctx.fill();

        // Electric border with player color
        ctx.strokeStyle = `rgba(${glowRGB}, ${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Draw lightning bolt in center
        const boltScale = r * 0.55;
        ctx.fillStyle = `rgba(${glowRGB}, ${0.7 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(cx + boltScale * 0.15, cy - boltScale * 0.7);
        ctx.lineTo(cx - boltScale * 0.25, cy + boltScale * 0.05);
        ctx.lineTo(cx + boltScale * 0.05, cy + boltScale * 0.05);
        ctx.lineTo(cx - boltScale * 0.15, cy + boltScale * 0.7);
        ctx.lineTo(cx + boltScale * 0.45, cy - boltScale * 0.15);
        ctx.lineTo(cx + boltScale * 0.05, cy - boltScale * 0.15);
        ctx.closePath();
        ctx.fill();

        // Draw electric sparks (small lightning bolts radiating from center)
        const sparkCount = 4;
        const sparkTime = (now || 0) / 150;
        ctx.strokeStyle = `rgba(${glowRGB}, ${0.4 + 0.3 * pulse})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < sparkCount; i++) {
            const baseAngle = (Math.PI * 2 * i / sparkCount) + sparkTime;
            const startR = r * 0.3;
            const endR = r * 0.85;
            const sx = cx + startR * Math.cos(baseAngle);
            const sy = cy + startR * Math.sin(baseAngle);
            const midR = (startR + endR) / 2;
            const jitter = (Math.sin(sparkTime * 3 + i * 7) * 0.3);
            const mx = cx + midR * Math.cos(baseAngle + jitter);
            const my = cy + midR * Math.sin(baseAngle + jitter);
            const ex = cx + endR * Math.cos(baseAngle);
            const ey = cy + endR * Math.sin(baseAngle);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

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

        ctx.strokeStyle = `rgba(${NEON.RGB[0]}, ${NEON.RGB[1]}, ${NEON.RGB[2]}, ${glowAlpha})`;
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

    drawPanels(player1, player2, currentTurn, phase, gameMode, skillCosts) {
        // Player 1 panel (left)
        this.ctx.fillStyle = COLORS.P1_PANEL_BG;
        this.ctx.fillRect(0, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Player 2 panel (right)
        this.ctx.fillStyle = COLORS.P2_PANEL_BG;
        this.ctx.fillRect(SCREEN_WIDTH - PANEL_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // Active turn neon glow on panel
        this._drawPanelNeonGlow(currentTurn);

        // Draw player info
        this.drawPlayerInfo(player1, 20, currentTurn === 1, phase, gameMode, skillCosts);
        this.drawPlayerInfo(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, currentTurn === 2, phase, gameMode, skillCosts);
    }

    // Neon glow overlay for the active player's panel
    _drawPanelNeonGlow(currentTurn) {
        const color = currentTurn === 1 ? COLORS.P1 : COLORS.P2;
        const isP1 = currentTurn === 1;
        const px = isP1 ? 0 : SCREEN_WIDTH - PANEL_WIDTH;
        const ctx = this.ctx;
        const r = parseInt(color.slice(1,3), 16);
        const g = parseInt(color.slice(3,5), 16);
        const b = parseInt(color.slice(5,7), 16);

        ctx.save();

        // 1. Full panel glow overlay — radial gradient from center
        const cx = px + PANEL_WIDTH / 2;
        const cy = SCREEN_HEIGHT / 2;
        const gradR = ctx.createRadialGradient(cx, cy, 0, cx, cy, PANEL_WIDTH);
        gradR.addColorStop(0, `rgba(${r},${g},${b},0.12)`);
        gradR.addColorStop(0.6, `rgba(${r},${g},${b},0.05)`);
        gradR.addColorStop(1, `rgba(${r},${g},${b},0.02)`);
        ctx.fillStyle = gradR;
        ctx.fillRect(px, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        // 2. Neon border — full rectangle around the panel
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, 1, PANEL_WIDTH - 2, SCREEN_HEIGHT - 2);

        // 3. Diffuse outer glow layer
        ctx.globalAlpha = 0.25;
        ctx.shadowBlur = 45;
        ctx.lineWidth = 3;
        ctx.strokeRect(px, 0, PANEL_WIDTH, SCREEN_HEIGHT);

        ctx.restore();
    }

    drawPlayerInfo(player, panelX, isCurrentTurn, phase, gameMode, skillCosts) {
        const playerColor = player.playerNum === 1 ? COLORS.P1 : COLORS.P2;

        // Player name — neon glow style
        const label = (gameMode === 'com' && player.playerNum === 2) ? 'COM' : `Player ${player.playerNum}`;
        this.ctx.save();
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        // Neon glow text
        this.ctx.fillStyle = playerColor;
        this.ctx.shadowColor = playerColor;
        this.ctx.shadowBlur = 15;
        this.ctx.fillText(label, panelX, 55);
        // White overlay for brightness
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillText(label, panelX, 55);
        this.ctx.globalAlpha = 1;

        // Neon underline
        const textWidth = this.ctx.measureText(label).width;
        this.ctx.strokeStyle = playerColor;
        this.ctx.shadowColor = playerColor;
        this.ctx.shadowBlur = 8;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(panelX, 72);
        this.ctx.lineTo(panelX + textWidth, 72);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // YOUR TURN indicator
        if (isCurrentTurn) {
            this.ctx.fillStyle = playerColor;
            this.ctx.font = 'bold 18px Arial';
            this.ctx.shadowColor = playerColor;
            this.ctx.shadowBlur = 10;
            this.ctx.fillText('YOUR TURN', panelX, 95);
            this.ctx.shadowBlur = 0;
        }
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.restore();

        // Points bar
        const barX = panelX;
        const barY = 125;
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

                // Show skill cost in replay mode
                if (skillCosts && info.costKey && skillCosts[info.costKey] !== undefined) {
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(`${skillCosts[info.costKey]}pt`, badgeX + badgeW - 4, skillY + badgeH / 2);
                    this.ctx.textAlign = 'left';
                }
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

    drawStartScreen(showDifficultySelect, now) {
        const ctx = this.ctx;
        const dt = this.menuLastTime ? (now - this.menuLastTime) / 1000 : 0.016;
        this.menuLastTime = now;
        this.menuTime += dt;
        this.menuFrameCount++;
        const t = this.menuTime;
        const cx = SCREEN_WIDTH / 2;

        // --- Update states ---
        // Glitch (E)
        if (this.menuGlitchActive) {
            this.menuGlitchDuration -= dt;
            if (this.menuGlitchDuration <= 0) {
                this.menuGlitchActive = false;
                this.menuGlitchTimer = 3 + Math.random() * 2;
            }
        } else {
            this.menuGlitchTimer -= dt;
            if (this.menuGlitchTimer <= 0) {
                this.menuGlitchActive = true;
                this.menuGlitchDuration = 0.1 + Math.random() * 0.05;
            }
        }

        // Hover cycling (G)
        this.menuHoverTimer += dt;
        if (this.menuHoverTimer > 3) {
            this.menuHoverTimer = 0;
            this.menuHoveredIndex = (this.menuHoveredIndex + 1) % 4;
        }

        // Dice (K)
        for (const die of this.menuDice) this._updateMenuDie(die, dt);

        // Board auto-play (C)
        this.menuAutoPlayTimer += dt;
        if (this.menuAutoPlayTimer > 1.2) {
            this.menuAutoPlayTimer = 0;
            this._menuAutoPlayStep();
        }

        // --- Clear with dark bg ---
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        // --- A: Neon Grid Background ---
        this._drawMenuNeonGrid(t);

        // --- C: Board Background ---
        this._drawMenuBoardBackground();

        // --- K: Dice ---
        for (const die of this.menuDice) this._drawMenuDie(die);

        // --- Separator line (neon gradient) ---
        ctx.save();
        const sepY = 620;
        const halfW = 200;
        const grad = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
        grad.addColorStop(0, 'rgba(176, 64, 255, 0)');
        grad.addColorStop(0.3, 'rgba(176, 64, 255, 0.4)');
        grad.addColorStop(0.5, 'rgba(176, 64, 255, 0.6)');
        grad.addColorStop(0.7, 'rgba(176, 64, 255, 0.4)');
        grad.addColorStop(1, 'rgba(176, 64, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, sepY);
        ctx.lineTo(cx + halfW, sepY);
        ctx.stroke();
        ctx.restore();

        // --- Buttons with Glow + Scanlines (G + I) ---
        const menuButtons = [
            { label: 'Player vs Player', x: cx, y: 390, w: 300, h: 80, color: '#006400', glowColor: '#00FF66', fontSize: 24, hasGear: true },
            { label: 'Player vs COM',    x: cx, y: 510, w: 300, h: 80, color: '#00224A', glowColor: '#00AAFF', fontSize: 24, hasGear: false },
            { label: '? How to Play',    x: cx - 80, y: 660, w: 145, h: 50, color: '#1a2a3a', glowColor: '#00E5FF', fontSize: 16, hasGear: false },
            { label: '\u25B6 Replay',    x: cx + 80, y: 660, w: 145, h: 50, color: '#1a2a3a', glowColor: '#B040FF', fontSize: 16, hasGear: false },
        ];

        for (let i = 0; i < menuButtons.length; i++) {
            const btn = menuButtons[i];
            const isHovered = (i === this.menuHoveredIndex);
            const bx = btn.x - btn.w / 2;
            const by = btn.y - btn.h / 2;

            ctx.save();
            const pulse = 4 + Math.sin(t * 2 + i) * 3;
            const glowStrength = isHovered ? 20 : pulse;

            // Button fill
            ctx.fillStyle = btn.color;
            ctx.strokeStyle = btn.glowColor;
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.shadowColor = btn.glowColor;
            ctx.shadowBlur = glowStrength;
            this._menuRoundRect(ctx, bx, by, btn.w, btn.h, 10);
            ctx.fill();
            ctx.stroke();

            // Extra glow on hover
            if (isHovered) {
                ctx.shadowBlur = 30;
                ctx.globalAlpha = 0.3;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.shadowBlur = 0;

            // Button label
            ctx.font = `bold ${btn.fontSize}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillText(btn.label, btn.x, btn.y);

            // Gear icon for PvP
            if (btn.hasGear) {
                this._drawMenuGearIcon(bx + btn.w + 25, btn.y, t);
            }

            // Scanline sweep (I)
            const scanCycle = 4;
            const scanPhase = (t + this.menuScanlinePhases[i]) % scanCycle;
            const scanProgress = scanPhase / scanCycle;
            if (scanProgress < 0.3) {
                const scanX = bx + btn.w * (scanProgress / 0.3);
                ctx.save();
                ctx.beginPath();
                this._menuRoundRect(ctx, bx, by, btn.w, btn.h, 10);
                ctx.clip();
                const sGrad = ctx.createLinearGradient(scanX - 30, 0, scanX + 30, 0);
                sGrad.addColorStop(0, 'rgba(255,255,255,0)');
                sGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
                sGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = sGrad;
                ctx.fillRect(bx, by, btn.w, btn.h);
                ctx.restore();
            }

            ctx.restore();
        }

        // --- Difficulty selector ---
        if (showDifficultySelect) {
            this.drawDifficultySelector();
        }

        // --- E: Glitch Title ---
        this._drawMenuTitle(t);
    }

    _menuAutoPlayStep() {
        const empty = [];
        for (let i = 0; i < 81; i++) {
            if (this.menuBoardState[i] === 0) empty.push(i);
        }
        if (empty.length === 0 || this.menuAutoPlayMoveCount > 30) {
            this.menuBoardState.fill(0);
            this.menuAutoPlayTurn = 1;
            this.menuAutoPlayMoveCount = 0;
            return;
        }
        const idx = empty[Math.floor(Math.random() * empty.length)];
        this.menuBoardState[idx] = this.menuAutoPlayTurn;
        this.menuAutoPlayTurn = this.menuAutoPlayTurn === 1 ? 2 : 1;
        this.menuAutoPlayMoveCount++;
    }

    _drawMenuNeonGrid(t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.18;
        const cx = SCREEN_WIDTH / 2;
        const horizon = 280;
        const bottom = SCREEN_HEIGHT;

        // Horizontal lines (perspective)
        const lineCount = 20;
        ctx.strokeStyle = '#B040FF';
        ctx.lineWidth = 1;
        for (let i = 0; i <= lineCount; i++) {
            const frac = i / lineCount;
            const shift = (t * 0.15) % (1 / lineCount);
            const adjFrac = frac + shift;
            if (adjFrac > 1) continue;
            const adjY = horizon + (bottom - horizon) * Math.pow(adjFrac, 1.5);
            const spread = 800 * adjFrac + 200;
            ctx.beginPath();
            ctx.moveTo(cx - spread, adjY);
            ctx.lineTo(cx + spread, adjY);
            ctx.stroke();
        }

        // Vertical lines converging to vanishing point
        const vLines = 24;
        for (let i = -vLines / 2; i <= vLines / 2; i++) {
            const xBottom = cx + i * 80;
            ctx.beginPath();
            ctx.moveTo(cx, horizon);
            ctx.lineTo(xBottom, bottom + 50);
            ctx.stroke();
        }

        // Glow at horizon
        const grd = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, 300);
        grd.addColorStop(0, 'rgba(176, 64, 255, 0.3)');
        grd.addColorStop(1, 'rgba(176, 64, 255, 0)');
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(cx - 400, horizon - 100, 800, 200);

        ctx.restore();
    }

    _drawMenuBoardBackground() {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.08;
        const cellSize = 52;
        const boardSize = 9 * cellSize;
        const ox = (SCREEN_WIDTH - boardSize) / 2;
        const oy = (SCREEN_HEIGHT - boardSize) / 2 - 10;

        // Grid
        ctx.strokeStyle = '#B040FF';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 9; i++) {
            ctx.beginPath();
            ctx.moveTo(ox + i * cellSize, oy);
            ctx.lineTo(ox + i * cellSize, oy + boardSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ox, oy + i * cellSize);
            ctx.lineTo(ox + boardSize, oy + i * cellSize);
            ctx.stroke();
        }

        // Stones as cyber octagons
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = this.menuBoardState[r * 9 + c];
                if (v === 0) continue;
                const sx = ox + c * cellSize + cellSize / 2;
                const sy = oy + r * cellSize + cellSize / 2;
                this._drawMenuCyberOctagon(sx, sy, cellSize * 0.38, 0.12);
            }
        }

        // Player pieces
        ctx.globalAlpha = 0.1;
        // P1 at col=0, row=4
        ctx.beginPath();
        ctx.arc(ox + 0 * cellSize + cellSize / 2, oy + 4 * cellSize + cellSize / 2, cellSize * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        // P2 at col=8, row=4
        ctx.beginPath();
        ctx.arc(ox + 8 * cellSize + cellSize / 2, oy + 4 * cellSize + cellSize / 2, cellSize * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#FF4444';
        ctx.shadowColor = '#FF4444';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    _drawMenuCyberOctagon(cx, cy, r, alpha) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        const sides = 8;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i) / sides - Math.PI / 8;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, '#1A1A2E');
        grad.addColorStop(1, '#2A2A3A');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#B040FF';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#B040FF';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    _drawMenuTitle(t) {
        const ctx = this.ctx;
        const cx = SCREEN_WIDTH / 2;
        const ty = 200;
        const breathe = 8 + Math.sin(t * 2) * 6;

        if (this.menuGlitchActive) {
            ctx.save();
            ctx.font = 'bold 72px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const jitterX = (Math.random() - 0.5) * 8;
            const jitterY = (Math.random() - 0.5) * 4;

            // Red channel
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#FF0000';
            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = breathe;
            ctx.fillText('Nine Nine', cx + jitterX - 3, ty + jitterY - 1);

            // Cyan channel
            ctx.fillStyle = '#00FFFF';
            ctx.shadowColor = '#00FFFF';
            ctx.fillText('Nine Nine', cx + jitterX + 3, ty + jitterY + 1);

            // Main text
            ctx.globalAlpha = 1;
            ctx.fillStyle = COLORS.WHITE;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur = breathe;
            ctx.fillText('Nine Nine', cx + jitterX, ty + jitterY);

            // Horizontal slice
            if (Math.random() < 0.5) {
                const sliceY = ty - 30 + Math.random() * 60;
                const sliceH = 3 + Math.random() * 8;
                ctx.globalAlpha = 0.6;
                ctx.drawImage(this.canvas, 0, sliceY, SCREEN_WIDTH, sliceH,
                    (Math.random() - 0.5) * 20, sliceY, SCREEN_WIDTH, sliceH);
            }
            ctx.restore();
        } else {
            ctx.save();
            ctx.font = 'bold 72px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.WHITE;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur = breathe;
            ctx.fillText('Nine Nine', cx, ty);
            // Double pass for stronger glow
            ctx.globalAlpha = 0.4;
            ctx.shadowBlur = breathe * 2;
            ctx.fillText('Nine Nine', cx, ty);
            ctx.restore();
        }

        // Subtitle
        ctx.save();
        ctx.font = '20px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#cccccc';
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 4;
        ctx.fillText('Turn-Based Strategy Game', cx, 250);
        ctx.restore();
    }

    _drawMenuGearIcon(cx, cy, t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.3);

        const r1 = 14, r2 = 10, teeth = 8;
        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
            const angle = (i * Math.PI) / teeth;
            const r = i % 2 === 0 ? r1 : r2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.stroke();

        // Center hole
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a1a';
        ctx.fill();

        ctx.restore();
    }

    drawDifficultySelector() {
        const ctx = this.ctx;
        const cx = SCREEN_WIDTH / 2;
        const btnW = 90, btnH = 50, gap = 10;
        const startX = cx - (btnW * 3 + gap * 2) / 2;
        const y = 560;
        const t = this.menuTime;

        // Difficulty buttons with neon style
        const diffButtons = [
            { label: 'Easy',   x: startX,                      color: '#0a2a0a', glowColor: '#00FF66' },
            { label: 'Normal', x: startX + btnW + gap,         color: '#2a1a00', glowColor: '#FFAA00' },
            { label: 'Hard',   x: startX + 2 * (btnW + gap),  color: '#1a1a2a', glowColor: '#666688', disabled: true },
        ];

        for (let i = 0; i < diffButtons.length; i++) {
            const btn = diffButtons[i];
            ctx.save();

            if (btn.disabled) {
                ctx.globalAlpha = 0.4;
            }

            const pulse = 3 + Math.sin(t * 2.5 + i * 1.2) * 2;

            // Button fill with rounded rect
            ctx.fillStyle = btn.color;
            ctx.strokeStyle = btn.glowColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = btn.glowColor;
            ctx.shadowBlur = btn.disabled ? 0 : pulse;
            this._menuRoundRect(ctx, btn.x, y, btnW, btnH, 8);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Label
            ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillText(btn.label, btn.x + btnW / 2, y + btnH / 2);

            ctx.restore();
        }

        // "Coming Soon" label for Hard
        ctx.save();
        ctx.fillStyle = '#666688';
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Coming Soon', startX + 2 * (btnW + gap) + btnW / 2, y + btnH + 14);
        ctx.restore();
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

    drawSmallButton(x, y, width, height, color, text) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = '#666688';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
    }

    drawTutorialScreen(tutorial, now) {
        this.clear();

        // Update transition
        tutorial.updateTransition(now);

        // Dark background panel
        const panelW = 900, panelH = 580;
        const px = (SCREEN_WIDTH - panelW) / 2;
        const py = (SCREEN_HEIGHT - panelH) / 2;

        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(px, py, panelW, panelH);
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px, py, panelW, panelH);

        // Slide canvas area
        const slideX = px + 30, slideY = py + 20;
        const slideW = 840, slideH = 420;

        // Draw current slide with clipping
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(slideX, slideY, slideW, slideH);
        this.ctx.clip();

        // Fill slide background
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(slideX, slideY, slideW, slideH);

        this.ctx.translate(slideX, slideY);
        this.ctx.globalAlpha = tutorial.transitionAlpha;
        const slide = tutorial.getCurrentSlide();
        slide.draw(this.ctx, slideW, slideH, now);
        this.ctx.restore();

        // Title
        const titleY = slideY + slideH + 25;
        this.ctx.fillStyle = '#00E5FF';
        this.ctx.font = 'bold 20px "Segoe UI", Tahoma, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(slide.title, SCREEN_WIDTH / 2, titleY);

        // Description
        this.ctx.fillStyle = '#cccccc';
        this.ctx.font = '14px "Segoe UI", Tahoma, sans-serif';
        this.ctx.fillText(slide.description, SCREEN_WIDTH / 2, titleY + 28);

        // Navigation bar
        const navY = titleY + 55;

        // Prev button
        if (tutorial.currentSlide > 0) {
            this.drawSmallButton(px + 20, navY, 80, 36, '#1a1a3e', '< Prev');
        }

        // Dots
        const dotSpacing = 18;
        const dotStartX = SCREEN_WIDTH / 2 - (tutorial.slideCount() * dotSpacing) / 2;
        for (let i = 0; i < tutorial.slideCount(); i++) {
            this.ctx.beginPath();
            this.ctx.arc(dotStartX + i * dotSpacing + dotSpacing / 2, navY + 18, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = i === tutorial.currentSlide ? '#00E5FF' : '#333355';
            this.ctx.fill();
        }

        // Next / Close button (left side)
        const nextLabel = tutorial.isLastSlide() ? 'Close' : 'Next >';
        this.drawSmallButton(px + panelW - 190, navY, 80, 36, '#1a1a3e', nextLabel);

        // Skip button (right side)
        this.drawSmallButton(px + panelW - 100, navY, 80, 36, '#3a0a0a', 'Skip \u00D7');
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

        // Two buttons side by side
        this.drawButton(SCREEN_WIDTH / 2 - 230, SCREEN_HEIGHT / 2 + 50, 220, 70, '#006400', 'Main Menu');
        this.drawButton(SCREEN_WIDTH / 2 + 10, SCREEN_HEIGHT / 2 + 50, 220, 70, '#333355', 'Watch Replay');
    }

    // --- Skill Selection ---

    drawSkillSelection(player1, player2, gameMode) {
        const ctx = this.ctx;

        // Dark neon background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        // Subtle grid background
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#B040FF';
        ctx.lineWidth = 1;
        for (let x = 0; x < SCREEN_WIDTH; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, SCREEN_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < SCREEN_HEIGHT; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(SCREEN_WIDTH, y);
            ctx.stroke();
        }
        ctx.restore();

        // Title with neon glow
        ctx.save();
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.WHITE;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.fillText('Select Special Skill', SCREEN_WIDTH / 2, 50);
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 24;
        ctx.fillText('Select Special Skill', SCREEN_WIDTH / 2, 50);
        ctx.restore();

        this.drawSkillPanel(player1, 20, COLORS.P1_PANEL_BG, gameMode);
        this.drawSkillPanel(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, COLORS.P2_PANEL_BG, gameMode);

        // Center message
        ctx.save();
        ctx.font = '20px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#B040FF';
        ctx.shadowBlur = 8;
        if (player1.skillConfirmed && player2.skillConfirmed) {
            ctx.fillStyle = '#00FF66';
            ctx.fillText('Starting game...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        } else {
            ctx.fillStyle = '#cccccc';
            ctx.fillText('Both players must select a skill', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        }
        ctx.restore();
    }

    drawSkillPanel(player, panelX, bgColor, gameMode) {
        const ctx = this.ctx;
        const isP1 = player.playerNum === 1;
        const panelGlow = isP1 ? '#00AAFF' : '#FF4444';

        // Panel background with neon border
        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.fillRect(panelX - 20, 80, PANEL_WIDTH, SCREEN_HEIGHT - 100);
        ctx.strokeStyle = panelGlow;
        ctx.lineWidth = 1;
        ctx.shadowColor = panelGlow;
        ctx.shadowBlur = 8;
        ctx.strokeRect(panelX - 20, 80, PANEL_WIDTH, SCREEN_HEIGHT - 100);
        ctx.shadowBlur = 0;
        ctx.restore();

        const label = (gameMode === 'com' && player.playerNum === 2) ? 'COM' : `Player ${player.playerNum}`;
        ctx.save();
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.shadowColor = panelGlow;
        ctx.shadowBlur = 8;
        ctx.fillText(label, panelX, 130);
        ctx.restore();

        if (player.skillConfirmed) {
            ctx.save();
            ctx.fillStyle = '#00FF66';
            ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.shadowColor = '#00FF66';
            ctx.shadowBlur = 12;
            ctx.fillText('Ready!', panelX, 200);
            ctx.restore();

            const info = SKILL_INFO[player.specialSkill];
            if (info) {
                const img = this.skillImages[player.specialSkill];
                const iconY = 215;
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, panelX, iconY, 32, 32);
                }
                ctx.fillStyle = COLORS.WHITE;
                ctx.font = '18px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(info.name, panelX + 38, iconY + 16);
                ctx.textBaseline = 'alphabetic';
            }
        } else {
            ctx.fillStyle = '#cccccc';
            ctx.font = '16px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Choose your skill:', panelX, 200);

            const btnWidth = 115;
            const btnHeight = 75;
            const gapX = 10;
            const gapY = 6;
            const startY = 210;

            for (let i = 0; i < SKILL_ORDER.length; i++) {
                const skill = SKILL_ORDER[i];
                const info = SKILL_INFO[skill];
                const row = Math.floor(i / 2);
                const col = i % 2;
                const bx = panelX + col * (btnWidth + gapX);
                const by = startY + row * (btnHeight + gapY);
                const centerX = bx + btnWidth / 2;

                // Neon skill button
                ctx.save();
                ctx.fillStyle = this._darkenColor(info.color, 0.3);
                this._menuRoundRect(ctx, bx, by, btnWidth, btnHeight, 8);
                ctx.fill();
                ctx.strokeStyle = info.color;
                ctx.lineWidth = 2;
                ctx.shadowColor = info.color;
                ctx.shadowBlur = 6;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();

                // Skill icon
                const img = this.skillImages[skill];
                const iconSize = 36;
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, centerX - iconSize / 2, by + 5, iconSize, iconSize);
                }

                // Skill name
                ctx.fillStyle = COLORS.WHITE;
                ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(info.name, centerX, by + 52);

                // Cost
                const cost = SKILL_COSTS[info.costKey];
                ctx.fillStyle = '#FFD700';
                ctx.font = '12px "Segoe UI", Arial, sans-serif';
                ctx.fillText(`${cost}pt`, centerX, by + 68);
            }
            ctx.textAlign = 'left';
        }
    }

    // Darken a hex color for neon button backgrounds
    _darkenColor(hex, factor) {
        const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
        return `rgb(${r},${g},${b})`;
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

    // ─── Replay: Selection Screen ─────────────────────────────

    drawReplaySelect(replays, scrollOffset) {
        this.clear();
        const ctx = this.ctx;

        // Title
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('REPLAY', SCREEN_WIDTH / 2, 50);

        // Back button (top-left)
        this.drawButton(30, 15, 150, 50, '#333344', 'Back');

        // Import Log button (top-right)
        this.drawButton(SCREEN_WIDTH - 220, 15, 200, 50, '#224466', 'Import Log');

        const listY = 100;
        const itemH = 70;
        const listH = SCREEN_HEIGHT - 120;
        const maxVisible = Math.floor(listH / itemH);
        const cx = SCREEN_WIDTH / 2;

        if (replays.length === 0) {
            ctx.fillStyle = '#666688';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No saved replays yet.', cx, SCREEN_HEIGHT / 2);
            ctx.font = '16px Arial';
            ctx.fillText('Play a game or import a log file.', cx, SCREEN_HEIGHT / 2 + 35);
            return;
        }

        // Scroll Up indicator
        if (scrollOffset > 0) {
            ctx.fillStyle = '#AAAACC';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('▲', cx, listY - 8);
        }

        // Replay entries
        for (let i = 0; i < maxVisible && i + scrollOffset < replays.length; i++) {
            const replay = replays[i + scrollOffset];
            const entryY = listY + i * itemH;
            const isHover = false; // no hover tracking yet

            // Entry background
            ctx.fillStyle = '#111122';
            ctx.fillRect(40, entryY, SCREEN_WIDTH - 80, itemH - 5);
            ctx.strokeStyle = '#333355';
            ctx.lineWidth = 1;
            ctx.strokeRect(40, entryY, SCREEN_WIDTH - 80, itemH - 5);

            // Date
            const d = new Date(replay.date);
            const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            ctx.fillStyle = '#888899';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(dateStr, 55, entryY + 20);

            // Mode + Difficulty
            let modeStr = replay.mode === 'com' ? `COM (${replay.difficulty || '?'})` : 'PvP';
            ctx.fillStyle = '#AAAACC';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(modeStr, 230, entryY + 20);

            // Winner
            if (replay.winner === null) {
                ctx.fillStyle = '#CCAA33';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('(途中)', 430, entryY + 20);
            } else {
                const winnerLabel = (replay.mode === 'com' && replay.winner === 2) ? 'COM' : `P${replay.winner}`;
                ctx.fillStyle = replay.winner === 1 ? COLORS.P1 : COLORS.P2;
                ctx.font = 'bold 18px Arial';
                ctx.fillText(`${winnerLabel} Win`, 430, entryY + 20);
            }

            // Win reason
            if (replay.winReason) {
                ctx.fillStyle = '#888899';
                ctx.font = '13px Arial';
                ctx.fillText(replay.winReason, 550, entryY + 20);
            }

            // Skills
            const p1Info = SKILL_INFO[replay.p1Skill];
            const p2Info = SKILL_INFO[replay.p2Skill];
            ctx.font = '13px Arial';
            ctx.fillStyle = COLORS.P1;
            ctx.fillText(`P1: ${p1Info ? p1Info.name : '?'}`, 55, entryY + 45);
            ctx.fillStyle = COLORS.P2;
            ctx.fillText(`P2: ${p2Info ? p2Info.name : '?'}`, 230, entryY + 45);

            // Score
            ctx.fillStyle = '#CCCCDD';
            ctx.font = '14px Arial';
            ctx.fillText(`${replay.p1Score} - ${replay.p2Score}`, 430, entryY + 45);

            // Turns
            ctx.fillStyle = '#888899';
            ctx.fillText(`${replay.totalTurns} turns`, 550, entryY + 45);
        }

        // Scroll Down indicator
        if (scrollOffset + maxVisible < replays.length) {
            ctx.fillStyle = '#AAAACC';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('▼', cx, listY + maxVisible * itemH + 15);
        }
    }

    // ─── Hover-reveal Menu Bar (shared by skill selection & gameplay) ───

    drawHoverMenuBar(mouseY) {
        const ctx = this.ctx;
        const showTopBar = (mouseY !== undefined && mouseY < 70);
        if (showTopBar) {
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(0, 0, SCREEN_WIDTH, 50);
            this.drawButtonSmall(20, 8, 140, 34, '#333344', '◀ Menu');
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#AAAACC';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('▲ hover for menu', 10, 16);
            ctx.restore();
        }
    }

    // ─── Confirm Dialog ─────────────────────────────────────────

    drawConfirmDialog(title, message) {
        const ctx = this.ctx;

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        // Dialog box
        const dw = 420, dh = 180;
        const dx = (SCREEN_WIDTH - dw) / 2;
        const dy = (SCREEN_HEIGHT - dh) / 2;

        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#555577';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, SCREEN_WIDTH / 2, dy + 40);

        // Message
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, SCREEN_WIDTH / 2, dy + 75);

        // Buttons: Save / Discard / Cancel
        const btnY = dy + 110;
        const btnW = 110, btnH = 40;
        const startX = (SCREEN_WIDTH - (btnW * 3 + 10 * 2)) / 2; // 465

        this.drawButton(startX, btnY, btnW, btnH, '#006400', 'Save');
        this.drawButton(startX + btnW + 10, btnY, btnW, btnH, '#661122', 'Discard');
        this.drawButton(startX + (btnW + 10) * 2, btnY, btnW, btnH, '#333344', 'Cancel');
    }

    // ─── Replay: Playback Controls ────────────────────────────

    drawReplayControls(currentIndex, totalSnapshots, actions, gameInfo, snapshot, mouseY, skillCosts) {
        const ctx = this.ctx;
        const cx = SCREEN_WIDTH / 2;

        // --- Top bar (hover-reveal: only visible when mouse near top) ---
        const showTopBar = (mouseY !== undefined && mouseY < 70);

        if (showTopBar) {
            ctx.save();
            ctx.globalAlpha = 0.9;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(0, 0, SCREEN_WIDTH, 50);

            // Back to Menu button
            this.drawButtonSmall(20, 8, 140, 34, '#333344', '◀ Menu');

            // Back to List button
            this.drawButtonSmall(170, 8, 155, 34, '#224466', '◀ Replay List');

            ctx.restore();
        } else {
            // Subtle hint when not hovering
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#AAAACC';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('▲ hover for menu', 10, 16);
            ctx.restore();
        }

        // --- Bottom control bar (hover-reveal) ---
        const showBottomBar = (mouseY !== undefined && mouseY > SCREEN_HEIGHT - 70);

        if (showBottomBar) {
            ctx.save();
            ctx.globalAlpha = 0.9;

            const barY = SCREEN_HEIGHT - 55;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(0, barY, SCREEN_WIDTH, 55);

            const btnY = barY + 8;
            const btnH = 40;
            const btnW = 55;

            const canGoBack = currentIndex > 0;
            const canGoForward = currentIndex < totalSnapshots - 1;

            // ◀◀ First
            this.drawButtonSmall(cx - 325, btnY, btnW, btnH,
                canGoBack ? '#444466' : '#222233', '◀◀');

            // ◀ Prev Turn
            this.drawButtonSmall(cx - 260, btnY, btnW, btnH,
                canGoBack ? '#444466' : '#222233', '◀');

            // ◁ Prev Phase
            this.drawButtonSmall(cx - 195, btnY, btnW, btnH,
                canGoBack ? '#3a3a55' : '#222233', '◁');

            // Phase label (centered)
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const phaseName = this._phaseDisplayName(snapshot);
            const turnNum = snapshot ? snapshot.turnNumber : 0;
            const turnLabel = turnNum === 0 ? 'Start' :
                (snapshot && snapshot.winner ? 'End' : `T${turnNum} ${phaseName}`);
            ctx.fillText(`${turnLabel}  (${currentIndex}/${totalSnapshots - 1})`,
                cx - 30, btnY + btnH / 2);
            ctx.textBaseline = 'alphabetic';

            // ▷ Next Phase
            this.drawButtonSmall(cx + 140, btnY, btnW, btnH,
                canGoForward ? '#3a3a55' : '#222233', '▷');

            // ▶ Next Turn
            this.drawButtonSmall(cx + 205, btnY, btnW, btnH,
                canGoForward ? '#444466' : '#222233', '▶');

            // ▶▶ Last
            this.drawButtonSmall(cx + 270, btnY, btnW, btnH,
                canGoForward ? '#444466' : '#222233', '▶▶');

            // Game info (bottom bar, left side)
            if (gameInfo) {
                let infoText = gameInfo.mode === 'com' ? `COM (${gameInfo.difficulty || '?'})` : 'PvP';
                ctx.fillStyle = '#AAAACC';
                ctx.font = '14px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(infoText, 30, barY + 32);
            }

            // Winner indicator (bottom bar, right side)
            if (snapshot && snapshot.winner) {
                const winLabel = (gameInfo && gameInfo.mode === 'com' && snapshot.winner === 2) ? 'COM' : `P${snapshot.winner}`;
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(`${winLabel} Wins! (${snapshot.winReason})`, SCREEN_WIDTH - 20, barY + 32);
            }

            ctx.restore();
        } else {
            // Subtle hint when not hovering
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#AAAACC';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('▼ hover for controls', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 8);
            ctx.restore();
        }

        // --- Action log panel (right side, below dice panels) ---
        if (actions && actions.length > 0) {
            const logX = SCREEN_WIDTH - PANEL_WIDTH + 10;
            const logY = 520;
            const logW = PANEL_WIDTH - 20;
            const maxActions = Math.min(actions.length, 9);

            // Title
            ctx.fillStyle = '#888899';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('ACTIONS', logX + 4, logY - 6);

            ctx.fillStyle = 'rgba(0, 0, 20, 0.8)';
            ctx.fillRect(logX, logY, logW, maxActions * 22 + 15);
            ctx.strokeStyle = '#333355';
            ctx.lineWidth = 1;
            ctx.strokeRect(logX, logY, logW, maxActions * 22 + 15);

            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            for (let i = 0; i < maxActions; i++) {
                const a = actions[i];
                // Color code by player
                if (a.raw && a.raw.data && a.raw.data.player === 1) {
                    ctx.fillStyle = COLORS.P1;
                } else if (a.raw && a.raw.data && a.raw.data.player === 2) {
                    ctx.fillStyle = COLORS.P2;
                } else {
                    ctx.fillStyle = '#AAAACC';
                }
                let displayText = a.text;
                if (skillCosts && a.raw && a.raw.action === 'skill' && a.raw.data) {
                    const costKeyMap = {
                        'checkpoint_place': 'checkpoint', 'checkpoint_teleport': 'checkpoint',
                        'domination': 'domination', 'sniper': 'sniper', 'hitokiri': 'hitokiri',
                        'suriashi': 'suriashi', 'meteor': 'meteor', 'momonga': 'momonga', 'kamakura': 'kamakura',
                        'electromagnet': 'electromagnet'
                    };
                    const costKey = costKeyMap[a.raw.data.skill];
                    if (costKey && skillCosts[costKey] !== undefined) {
                        displayText += ` (${skillCosts[costKey]}pt)`;
                    }
                }
                ctx.fillText(displayText, logX + 8, logY + 18 + i * 22);
            }
            if (actions.length > maxActions) {
                ctx.fillStyle = '#666688';
                ctx.fillText(`... +${actions.length - maxActions} more`, logX + 8, logY + 18 + maxActions * 22);
            }
        }
    }

    _phaseDisplayName(snapshot) {
        if (!snapshot || !snapshot.phase) return '';
        switch (snapshot.phase) {
            case 'initial': return '';
            case 'rolled': return 'Roll';
            case 'moved': return 'Move';
            case 'acted': return 'Act';
            case 'end': return '';
            default: return snapshot.phase;
        }
    }

    drawButtonSmall(x, y, width, height, color, text) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        this.ctx.strokeStyle = '#555577';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
        this.ctx.textBaseline = 'alphabetic';
    }

    // --- Neon Border ---

    _newBorderSpark() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        const bx = BOARD_OFFSET_X, by = BOARD_OFFSET_Y;
        const bw = BOARD_SIZE * CELL_SIZE;
        if (side === 0) { x = bx + Math.random() * bw; y = by; }
        else if (side === 1) { x = bx + Math.random() * bw; y = by + bw; }
        else if (side === 2) { x = bx; y = by + Math.random() * bw; }
        else { x = bx + bw; y = by + Math.random() * bw; }
        return { x, y, life: 0, maxLife: 200 + Math.random() * 300, alpha: 0.5 + Math.random() * 0.5 };
    }

    drawNeonBorderBackground() {
        const ctx = this.ctx;
        const bx = BOARD_OFFSET_X, by = BOARD_OFFSET_Y;
        const bw = BOARD_SIZE * CELL_SIZE;

        // Dark outside areas
        ctx.fillStyle = NEON.DARK_OUTSIDE;
        // Top
        ctx.fillRect(0, 0, this.canvas.width, by);
        // Bottom
        ctx.fillRect(0, by + bw, this.canvas.width, this.canvas.height - by - bw);
        // Left
        ctx.fillRect(0, by, bx, bw);
        // Right
        ctx.fillRect(bx + bw, by, this.canvas.width - bx - bw, bw);

        // Inner neon glow border
        ctx.save();
        ctx.strokeStyle = NEON.COLOR;
        ctx.lineWidth = 2;
        ctx.shadowColor = NEON.COLOR;
        ctx.shadowBlur = 20;
        ctx.strokeRect(bx, by, bw, bw);
        ctx.restore();

        // Outer diffuse glow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = NEON.COLOR;
        ctx.lineWidth = 3;
        ctx.shadowColor = NEON.COLOR;
        ctx.shadowBlur = 40;
        ctx.strokeRect(bx - 2, by - 2, bw + 4, bw + 4);
        ctx.restore();
    }

    // パネルの上に左右の辺のネオングローを再描画（パネルに覆われた分を補う）
    drawNeonBorderSideGlow() {
        const ctx = this.ctx;
        const bx = BOARD_OFFSET_X, by = BOARD_OFFSET_Y;
        const bw = BOARD_SIZE * CELL_SIZE;

        ctx.save();
        ctx.strokeStyle = NEON.COLOR;
        ctx.shadowColor = NEON.COLOR;

        // 左辺グロー
        ctx.lineWidth = 2;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + bw);
        ctx.stroke();

        // 右辺グロー
        ctx.beginPath();
        ctx.moveTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + bw);
        ctx.stroke();

        // 拡散レイヤー（より広いグロー）
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 45;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + bw);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + bw);
        ctx.stroke();

        ctx.restore();
    }

    drawEdgePulse(player1, player2, now) {
        const ctx = this.ctx;
        const bx = BOARD_OFFSET_X, by = BOARD_OFFSET_Y;
        const bw = BOARD_SIZE * CELL_SIZE;
        const [r, g, b] = NEON.RGB;
        const pulseAlpha = 0.1 + 0.3 * (0.5 + 0.5 * Math.sin(now / 300));

        const players = [player1, player2];
        for (const p of players) {
            const onEdge = p.row === 0 || p.row === BOARD_SIZE - 1 || p.col === 0 || p.col === BOARD_SIZE - 1;
            if (!onEdge) continue;

            ctx.save();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pulseAlpha})`;
            for (let i = 0; i < BOARD_SIZE; i++) {
                if (p.row === 0) ctx.fillRect(bx + i * CELL_SIZE, by, CELL_SIZE, CELL_SIZE);
                if (p.row === BOARD_SIZE - 1) ctx.fillRect(bx + i * CELL_SIZE, by + (BOARD_SIZE - 1) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                if (p.col === 0) ctx.fillRect(bx, by + i * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                if (p.col === BOARD_SIZE - 1) ctx.fillRect(bx + (BOARD_SIZE - 1) * CELL_SIZE, by + i * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
            ctx.restore();
        }
    }

    drawBorderSparks(now) {
        const ctx = this.ctx;
        const dt = 16;
        for (let i = 0; i < this.borderSparks.length; i++) {
            const s = this.borderSparks[i];
            s.life += dt;
            if (s.life > s.maxLife) {
                this.borderSparks[i] = this._newBorderSpark();
                continue;
            }
            const t = s.life / s.maxLife;
            const alpha = t < 0.2 ? t / 0.2 : (1 - t) / 0.8;
            ctx.save();
            ctx.globalAlpha = alpha * s.alpha;
            ctx.fillStyle = t < 0.3 ? '#FFFFFF' : NEON.COLOR;
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(s.x + (Math.random() - 0.5) * 3, s.y + (Math.random() - 0.5) * 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // --- Electrocution Fall Effect ---

    _generateLightning(x1, y1, x2, y2, depth) {
        if (depth <= 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 30;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 30;
        const left = this._generateLightning(x1, y1, mx, my, depth - 1);
        const right = this._generateLightning(mx, my, x2, y2, depth - 1);
        return [...left, ...right.slice(1)];
    }

    initFallEffect(cx, cy, dir) {
        this.fallLightning = [];
        this.fallSparks = [];

        const dirLen = Math.sqrt(dir.dr * dir.dr + dir.dc * dir.dc) || 1;
        const baseAngle = Math.atan2(dir.dr, dir.dc);

        // Sparks biased toward fall direction
        for (let i = 0; i < 35; i++) {
            const biased = Math.random() < 0.7;
            const angle = biased
                ? baseAngle + (Math.random() - 0.5) * Math.PI * 0.8
                : Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            this.fallSparks.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0, maxLife: 300 + Math.random() * 400,
                size: 1 + Math.random() * 2.5
            });
        }

        // Lightning bolts toward border
        for (let i = 0; i < 8; i++) {
            const spread = (Math.random() - 0.5) * 0.6;
            const boltAngle = baseAngle + spread;
            const dist = 100 + Math.random() * 40;
            const tx = cx + Math.cos(boltAngle) * dist;
            const ty = cy + Math.sin(boltAngle) * dist;
            this.fallLightning.push({
                cx, cy, targetX: tx, targetY: ty,
                life: i * 40,
                maxLife: 500 + Math.random() * 200,
                segments: this._generateLightning(cx, cy, tx, ty, 5)
            });
        }
    }

    drawFallEffect(now, elapsed, playerPos, dir, isElectromagnet = false) {
        const ctx = this.ctx;
        const cx = playerPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
        const cy = playerPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 10;
        const t = Math.min(1, elapsed / 800);

        // Flickering piece (being electrocuted)
        if (t < 0.7) {
            const flicker = Math.sin(elapsed * 0.05) > 0;
            ctx.save();
            ctx.globalAlpha = flicker ? 0.8 * (1 - t / 0.7) : 0.2 * (1 - t / 0.7);
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, `rgba(0, 229, 255, 0.8)`);
            grad.addColorStop(0.5, '#00AAFF');
            grad.addColorStop(1, `rgba(0, 229, 255, 0.3)`);
            ctx.beginPath();
            ctx.arc(cx, cy, radius * (1 + 0.05 * Math.sin(elapsed * 0.1)), 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }

        // Lightning bolts
        for (const bolt of this.fallLightning) {
            bolt.life += 16;
            if (bolt.life > bolt.maxLife || bolt.life < 0) continue;
            const lt = bolt.life / bolt.maxLife;
            const alpha = lt < 0.1 ? lt / 0.1 : Math.max(0, 1 - (lt - 0.1) / 0.9);
            // Re-jitter segments
            if (Math.random() < 0.3) {
                bolt.segments = this._generateLightning(bolt.cx, bolt.cy, bolt.targetX, bolt.targetY, 5);
            }
            ctx.save();
            ctx.globalAlpha = alpha * 0.9;
            ctx.strokeStyle = '#FFFFFF';
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < bolt.segments.length; i++) {
                const s = bolt.segments[i];
                if (i === 0) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
            }
            ctx.stroke();
            ctx.globalAlpha = alpha * 0.5;
            ctx.strokeStyle = NEON.COLOR;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Spark particles
        for (const p of this.fallSparks) {
            p.life += 16;
            if (p.life > p.maxLife) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.03;
            const st = p.life / p.maxLife;
            const alpha = st < 0.1 ? st / 0.1 : Math.max(0, 1 - (st - 0.1) / 0.9);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = st < 0.3 ? '#FFFFFF' : NEON.COLOR;
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 - st * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Border flash
        if (elapsed < 200) {
            const bx = BOARD_OFFSET_X, by = BOARD_OFFSET_Y;
            const bw = BOARD_SIZE * CELL_SIZE;
            ctx.save();
            ctx.globalAlpha = 0.5 * (1 - elapsed / 200);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 4;
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 30;
            ctx.strokeRect(bx, by, bw, bw);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Electrocuted text
        if (elapsed > 300) {
            const textT = Math.min(1, (elapsed - 300) / 300);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = NEON.COLOR;
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 15;
            ctx.globalAlpha = textT;
            const fallText = 'ELECTROCUTED!';
            ctx.fillText(fallText, BOARD_OFFSET_X + BOARD_SIZE * CELL_SIZE / 2, BOARD_OFFSET_Y + BOARD_SIZE * CELL_SIZE / 2);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    cleanupFallEffect() {
        this.fallLightning = [];
        this.fallSparks = [];
    }

    // ============================================================
    //  Bomb Explosion Effect
    // ============================================================

    initBombEffect(cx, cy) {
        this.bombParticles = [];
        this.bombShockwave = { cx, cy, radius: 0 };

        // Explosion debris particles (radiating outward)
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 5;
            const hue = Math.random() < 0.5 ? 30 + Math.random() * 30 : 10 + Math.random() * 20; // orange-red
            this.bombParticles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - Math.random() * 2,
                life: 0, maxLife: 400 + Math.random() * 600,
                size: 2 + Math.random() * 4,
                color: `hsl(${hue}, 100%, ${50 + Math.random() * 30}%)`
            });
        }
    }

    drawBombEffect(now, elapsed, bombPos) {
        const ctx = this.ctx;
        const cx = bombPos.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
        const cy = bombPos.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
        const t = Math.min(1, elapsed / 1500);

        // Flash (initial bright white-orange flash)
        if (elapsed < 150) {
            ctx.save();
            ctx.globalAlpha = 0.8 * (1 - elapsed / 150);
            const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL_SIZE * 2);
            flashGrad.addColorStop(0, '#FFFFFF');
            flashGrad.addColorStop(0.3, '#FFAA00');
            flashGrad.addColorStop(1, 'rgba(255, 68, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.fillRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
            ctx.restore();
        }

        // Shockwave ring
        if (elapsed < 600) {
            const swT = elapsed / 600;
            const swRadius = swT * CELL_SIZE * 3;
            ctx.save();
            ctx.globalAlpha = 0.6 * (1 - swT);
            ctx.strokeStyle = '#FF6600';
            ctx.lineWidth = 4 * (1 - swT) + 1;
            ctx.shadowColor = '#FF4400';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(cx, cy, swRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Fire ball (expanding then fading)
        if (elapsed < 800) {
            const fbT = elapsed / 800;
            const fbRadius = CELL_SIZE * 0.3 + fbT * CELL_SIZE * 0.8;
            ctx.save();
            ctx.globalAlpha = 0.9 * (1 - fbT);
            const fireGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, fbRadius);
            fireGrad.addColorStop(0, '#FFFFFF');
            fireGrad.addColorStop(0.2, '#FFCC00');
            fireGrad.addColorStop(0.5, '#FF6600');
            fireGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = fireGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, fbRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Debris particles
        for (const p of this.bombParticles) {
            p.life += 16;
            if (p.life > p.maxLife) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // gravity
            p.vx *= 0.99;
            const pt = p.life / p.maxLife;
            const alpha = pt < 0.1 ? pt / 0.1 : Math.max(0, 1 - (pt - 0.3) / 0.7);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = '#FF4400';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 - pt * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Smoke (delayed, dark particles rising)
        if (elapsed > 200 && elapsed < 1500) {
            const smokeT = (elapsed - 200) / 1300;
            for (let i = 0; i < 3; i++) {
                const smokeRadius = 5 + smokeT * 20;
                const sx = cx + (Math.random() - 0.5) * CELL_SIZE * 0.6;
                const sy = cy - smokeT * 30 + (Math.random() - 0.5) * 10;
                ctx.save();
                ctx.globalAlpha = 0.2 * (1 - smokeT);
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(sx, sy, smokeRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // "BOMB!" text
        if (elapsed > 300) {
            const textT = Math.min(1, (elapsed - 300) / 300);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#FF4400';
            ctx.shadowColor = '#FF4400';
            ctx.shadowBlur = 15;
            ctx.globalAlpha = textT;
            ctx.fillText('BOMB!', BOARD_OFFSET_X + BOARD_SIZE * CELL_SIZE / 2, BOARD_OFFSET_Y + BOARD_SIZE * CELL_SIZE / 2);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    cleanupBombEffect() {
        this.bombParticles = [];
        this.bombShockwave = null;
    }

    // ============================================================
    //  開始アニメーション (Start Animation — Grid Build B)
    // ============================================================

    // イージング関数
    _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    _easeOutBack(t) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    // タイトルフラッシュ "NINE-NINE"
    drawStartTitle(alpha, scale) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = NEON.COLOR;
        ctx.font = `bold ${Math.round(64 * scale)}px 'Segoe UI', Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = NEON.COLOR;
        ctx.shadowBlur = 30;
        ctx.fillText('NINE-NINE', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.WHITE;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillText('NINE-NINE', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.restore();
    }

    // パネルスライドイン
    drawStartPanelsSlide(progress) {
        const ctx = this.ctx;
        const eased = this._easeOutCubic(progress);
        ctx.fillStyle = COLORS.P1_PANEL_BG;
        ctx.fillRect(-PANEL_WIDTH + PANEL_WIDTH * eased, 0, PANEL_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = COLORS.P2_PANEL_BG;
        ctx.fillRect(SCREEN_WIDTH - PANEL_WIDTH * eased, 0, PANEL_WIDTH, SCREEN_HEIGHT);
    }

    // グリッド線を1本ずつ描画（アニメーション用）
    drawStartGridBuild(progress, board) {
        const ctx = this.ctx;
        const totalLines = (BOARD_SIZE + 1) * 2;
        const linesDrawn = Math.floor(progress * totalLines);
        const lineFrac = (progress * totalLines) % 1;

        // 描画済みセルのチェッカーボード背景
        const revealedCols = Math.min(Math.floor(linesDrawn / 2), BOARD_SIZE);
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < revealedCols; c++) {
                const x = BOARD_OFFSET_X + c * CELL_SIZE;
                const y = BOARD_OFFSET_Y + r * CELL_SIZE;
                const isAlt = (r + c) % 2 === 0;
                ctx.fillStyle = isAlt ? COLORS.CELL_BG : COLORS.CELL_BG_ALT;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }

        // グリッド線（最新の線は白く光る）
        for (let i = 0; i < linesDrawn && i < totalLines; i++) {
            const isVertical = i % 2 === 0;
            const idx = Math.floor(i / 2);
            const isLatest = (i === linesDrawn - 1);

            ctx.save();
            if (isLatest) {
                ctx.strokeStyle = COLORS.WHITE;
                ctx.shadowColor = NEON.COLOR;
                ctx.shadowBlur = 20;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5 + 0.5 * (1 - lineFrac);
            } else {
                ctx.strokeStyle = COLORS.GRID;
                ctx.lineWidth = 1;
            }

            if (isVertical && idx <= BOARD_SIZE) {
                const x = BOARD_OFFSET_X + idx * CELL_SIZE;
                ctx.beginPath();
                ctx.moveTo(x, BOARD_OFFSET_Y);
                ctx.lineTo(x, BOARD_OFFSET_Y + BOARD_WIDTH);
                ctx.stroke();
            } else if (!isVertical && idx <= BOARD_SIZE) {
                const y = BOARD_OFFSET_Y + idx * CELL_SIZE;
                ctx.beginPath();
                ctx.moveTo(BOARD_OFFSET_X, y);
                ctx.lineTo(BOARD_OFFSET_X + BOARD_WIDTH, y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // 静的なグリッド線のみ描画（タイルなし）
    drawStartStaticGrid() {
        const ctx = this.ctx;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const x = BOARD_OFFSET_X + c * CELL_SIZE;
                const y = BOARD_OFFSET_Y + r * CELL_SIZE;
                const isAlt = (r + c) % 2 === 0;
                ctx.fillStyle = isAlt ? COLORS.CELL_BG : COLORS.CELL_BG_ALT;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }
        ctx.save();
        ctx.strokeStyle = COLORS.GRID;
        ctx.lineWidth = 1;
        for (let i = 0; i <= BOARD_SIZE; i++) {
            const x = BOARD_OFFSET_X + i * CELL_SIZE;
            ctx.beginPath(); ctx.moveTo(x, BOARD_OFFSET_Y); ctx.lineTo(x, BOARD_OFFSET_Y + BOARD_WIDTH); ctx.stroke();
            const y = BOARD_OFFSET_Y + i * CELL_SIZE;
            ctx.beginPath(); ctx.moveTo(BOARD_OFFSET_X, y); ctx.lineTo(BOARD_OFFSET_X + BOARD_WIDTH, y); ctx.stroke();
        }
        ctx.restore();
    }

    // タイルを1つずつ光りながら出現させる
    drawStartTileReveal(board, tileOrder, progress, now) {
        const ctx = this.ctx;
        const totalTiles = tileOrder.length;
        const tilesRevealed = Math.floor(progress * (totalTiles + 2));
        const tileFrac = (progress * (totalTiles + 2)) % 1;

        // 全セル背景
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const x = BOARD_OFFSET_X + c * CELL_SIZE;
                const y = BOARD_OFFSET_Y + r * CELL_SIZE;
                const isAlt = (r + c) % 2 === 0;
                ctx.fillStyle = isAlt ? COLORS.CELL_BG : COLORS.CELL_BG_ALT;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }

        // 出現済みタイルを描画
        for (let i = 0; i < Math.min(tilesRevealed, totalTiles); i++) {
            const tile = tileOrder[i];
            this.drawCell(tile.row, tile.col, tile.type, now);

            // 最新タイルにフラッシュエフェクト
            if (i === tilesRevealed - 1 && i < totalTiles) {
                const x = BOARD_OFFSET_X + tile.col * CELL_SIZE;
                const y = BOARD_OFFSET_Y + tile.row * CELL_SIZE;
                ctx.save();
                ctx.globalAlpha = (1 - tileFrac) * 0.6;
                ctx.fillStyle = NEON.COLOR;
                ctx.shadowColor = NEON.COLOR;
                ctx.shadowBlur = 25;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                ctx.restore();
            }
        }

        // グリッド線（グロー付き）
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const x = BOARD_OFFSET_X + c * CELL_SIZE;
                const y = BOARD_OFFSET_Y + r * CELL_SIZE;
                this.drawGlowGridLine(x, y, r, c, now);
            }
        }
    }

    // "READY" テキストを画面中央に表示
    drawStartYourTurnText(alpha) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = NEON.COLOR;
        ctx.shadowBlur = 20;
        ctx.fillText('READY', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.restore();
    }

    // "YOUR TURN" 布フローエフェクト — 選ばれたプレイヤーのパネルへ流れる
    drawStartClothFlow(t, now, firstTurnPlayer, gameMode) {
        const ctx = this.ctx;
        const isP1 = firstTurnPlayer === 1;
        const color = isP1 ? COLORS.P1 : COLORS.P2;
        const targetX = isP1 ? 20 + 80 : (SCREEN_WIDTH - PANEL_WIDTH) + 20 + 80;
        const targetY = 95; // YOUR TURN の定位置 Y
        const panelEdgeX = isP1 ? PANEL_WIDTH : SCREEN_WIDTH - PANEL_WIDTH;
        const labelX = isP1 ? 20 : SCREEN_WIDTH - PANEL_WIDTH + 20;
        const startX = SCREEN_WIDTH / 2;
        const startY = SCREEN_HEIGHT / 2;

        ctx.save();

        if (t < 0.1) {
            // 中央で揺れる READY
            const wobble = Math.sin(now * 0.015) * 2;
            ctx.globalAlpha = 1;
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = NEON.COLOR;
            ctx.shadowBlur = 20;
            ctx.fillText('READY', startX + wobble, startY);
        }
        else if (t < 0.7) {
            const ft = (t - 0.1) / 0.6;

            // リボンストリップ
            const textWidth = 300;
            const textHeight = 48;
            const stripH = textHeight / START_ANIM_CLOTH_STRIPS;

            for (let i = 0; i < START_ANIM_CLOTH_STRIPS; i++) {
                const stripProgress = i / START_ANIM_CLOTH_STRIPS;
                const delay = stripProgress * 0.3;
                const st = Math.max(0, Math.min(1, (ft - delay) / (1 - delay)));
                const easedSt = this._easeOutCubic(st);

                const wave = Math.sin(now * 0.01 + i * 0.8) * (1 - st) * 15;
                const sx = startX + (targetX - startX) * easedSt + wave;
                const sy = startY - textHeight/2 + stripH * i + (targetY - startY) * easedSt;

                const scale = 1 - easedSt * 0.6;
                const a = st < 0.8 ? 1 : (1 - (st - 0.8) / 0.2);
                const skewX = (1 - st) * (i / START_ANIM_CLOTH_STRIPS) * 0.4 * (isP1 ? 1 : -1);

                ctx.save();
                ctx.translate(sx, sy + stripH / 2);
                ctx.scale(scale, 1);
                ctx.transform(1, 0, skewX, 1, 0, 0);
                ctx.globalAlpha = a * (0.7 + 0.3 * (1 - stripProgress));
                ctx.beginPath();
                ctx.rect(-textWidth, -stripH / 2, textWidth * 2, stripH);
                ctx.clip();
                ctx.fillStyle = COLORS.WHITE;
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = NEON.COLOR;
                ctx.shadowBlur = 15 * (1 - st);
                // READY → YOUR TURN へテキスト切り替え（進行度 0.4 で切り替わる）
                const stripText = st < 0.4 ? 'READY' : 'YOUR TURN';
                ctx.fillText(stripText, 0, -(stripH * i - textHeight / 2 + stripH / 2));
                ctx.restore();
            }

            // トレイルパーティクル
            const trailCount = 10;
            for (let i = 0; i < trailCount; i++) {
                const tp = (ft + i * 0.04) % 1;
                const tx = startX + (targetX - startX) * this._easeOutCubic(tp);
                const ty = startY + (targetY - startY) * this._easeOutCubic(tp);
                const ta = Math.max(0, 1 - tp) * ft * 0.6;
                ctx.globalAlpha = ta;
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(tx + (Math.random()-0.5)*10, ty + (Math.random()-0.5)*10, 2 + Math.random()*2, 0, Math.PI*2);
                ctx.fill();
            }
        }
        else {
            // パネルが光り、YOUR TURN が定位置に着地
            const gt = (t - 0.7) / 0.3;

            // パネルエッジグロー
            const panelGlowAlpha = (1 - gt) * 0.6;
            ctx.globalAlpha = panelGlowAlpha;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 30;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(panelEdgeX, 0);
            ctx.lineTo(panelEdgeX, SCREEN_HEIGHT);
            ctx.stroke();

            // 横方向グローバー
            const barWidth = PANEL_WIDTH * this._easeOutCubic(gt);
            const barAlpha = (1 - gt * 0.5) * 0.3;
            const r = parseInt(color.slice(1,3), 16);
            const g = parseInt(color.slice(3,5), 16);
            const b = parseInt(color.slice(5,7), 16);
            const barGrad = ctx.createLinearGradient(0, targetY - 25, 0, targetY + 25);
            barGrad.addColorStop(0, 'rgba(0,0,0,0)');
            barGrad.addColorStop(0.5, `rgba(${r},${g},${b},${barAlpha})`);
            barGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = barGrad;
            if (isP1) {
                ctx.fillRect(0, targetY - 25, barWidth, 50);
            } else {
                ctx.fillRect(SCREEN_WIDTH - barWidth, targetY - 25, barWidth, 50);
            }

            // YOUR TURN テキストが定位置にフェードイン
            if (gt > 0.3) {
                const subAlpha = this._easeOutCubic((gt - 0.3) / 0.7);
                ctx.globalAlpha = subAlpha;
                ctx.fillStyle = color;
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.fillText('YOUR TURN', labelX, targetY);
            }
        }

        ctx.restore();
    }

    // パネル背景のみ描画（プレイヤー情報なし、ネオングローなし）
    drawStartPanelsBg() {
        this.ctx.fillStyle = COLORS.P1_PANEL_BG;
        this.ctx.fillRect(0, 0, PANEL_WIDTH, SCREEN_HEIGHT);
        this.ctx.fillStyle = COLORS.P2_PANEL_BG;
        this.ctx.fillRect(SCREEN_WIDTH - PANEL_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT);
    }

    // パネル背景 + プレイヤーラベル（YOUR TURN なし）
    drawStartPanelsWithLabels(player1, player2, gameMode) {
        this.drawStartPanelsBg();
        this.drawPlayerInfo(player1, 20, false, PHASES.ROLL, gameMode);
        this.drawPlayerInfo(player2, SCREEN_WIDTH - PANEL_WIDTH + 20, false, PHASES.ROLL, gameMode);
    }
}
