// Animation Constants
const ANIM = {
    MOVE_DURATION: 350,
    TELEPORT_DURATION: 500,
    RIPPLE_LIFETIME: 600,
    RIPPLE_SPAWN_INTERVAL: 80,
    RIPPLE_MAX_RADIUS: 35,
    TRAIL_LIFETIME: 400,
    TRAIL_SPAWN_INTERVAL: 40,
    PULSE_SPEED: 2000,
    GRID_PULSE_SPEED: 4000
};

// Easing function: smooth acceleration/deceleration
function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Animation Manager
class AnimationManager {
    constructor() {
        this.playerAnims = {};
        this.ripples = [];
        this.trails = [];
        this.globalTime = 0;
    }

    isAnimating() {
        for (const key in this.playerAnims) {
            if (this.playerAnims[key].active) return true;
        }
        return false;
    }

    startMove(playerNum, fromRow, fromCol, toRow, toCol, type = 'move') {
        const duration = type === 'teleport'
            ? ANIM.TELEPORT_DURATION
            : ANIM.MOVE_DURATION;
        this.playerAnims[playerNum] = {
            active: true,
            type: type,
            fromRow, fromCol, toRow, toCol,
            startTime: performance.now(),
            duration: duration,
            lastRippleTime: 0,
            lastTrailTime: 0,
            onComplete: null
        };
    }

    update(currentTime) {
        this.globalTime = currentTime;

        // Update player animations
        for (const key in this.playerAnims) {
            const anim = this.playerAnims[key];
            if (!anim.active) continue;
            const elapsed = currentTime - anim.startTime;
            if (elapsed >= anim.duration) {
                anim.active = false;
                if (anim.onComplete) {
                    anim.onComplete();
                }
            }
        }

        // Prune expired ripples
        this.ripples = this.ripples.filter(r =>
            currentTime - r.startTime < ANIM.RIPPLE_LIFETIME);

        // Prune expired trails
        this.trails = this.trails.filter(t =>
            currentTime - t.startTime < ANIM.TRAIL_LIFETIME);
    }

    getDisplayPosition(playerNum, player) {
        const anim = this.playerAnims[playerNum];
        if (!anim || !anim.active) {
            return {
                x: player.col * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2,
                y: player.row * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2,
                alpha: 1.0
            };
        }

        const elapsed = this.globalTime - anim.startTime;
        const t = Math.min(elapsed / anim.duration, 1.0);

        if (anim.type === 'teleport') {
            // Teleport: fade out at source, fade in at destination
            const fadePoint = 0.45;
            if (t < fadePoint) {
                const alpha = 1.0 - (t / fadePoint);
                return {
                    x: anim.fromCol * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2,
                    y: anim.fromRow * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2,
                    alpha: alpha
                };
            } else {
                const alpha = Math.min((t - fadePoint) / (1.0 - fadePoint), 1.0);
                return {
                    x: anim.toCol * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2,
                    y: anim.toRow * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2,
                    alpha: alpha
                };
            }
        } else {
            // Move: smooth interpolation with easing
            const eased = easeInOutCubic(t);
            const fromX = anim.fromCol * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
            const fromY = anim.fromRow * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
            const toX = anim.toCol * CELL_SIZE + BOARD_OFFSET_X + CELL_SIZE / 2;
            const toY = anim.toRow * CELL_SIZE + BOARD_OFFSET_Y + CELL_SIZE / 2;
            const x = fromX + (toX - fromX) * eased;
            const y = fromY + (toY - fromY) * eased;

            // Spawn ripples during movement
            if (elapsed - anim.lastRippleTime > ANIM.RIPPLE_SPAWN_INTERVAL) {
                const color = parseInt(playerNum) === 1 ? COLORS.P1 : COLORS.P2;
                this.ripples.push({
                    x, y,
                    startTime: this.globalTime,
                    color: color
                });
                anim.lastRippleTime = elapsed;
            }

            // Spawn trail dots during movement
            if (elapsed - anim.lastTrailTime > ANIM.TRAIL_SPAWN_INTERVAL) {
                const color = parseInt(playerNum) === 1 ? COLORS.P1 : COLORS.P2;
                this.trails.push({
                    x, y,
                    startTime: this.globalTime,
                    color: color,
                    radius: 6 + Math.random() * 5
                });
                anim.lastTrailTime = elapsed;
            }

            return { x, y, alpha: 1.0 };
        }
    }

    reset() {
        this.playerAnims = {};
        this.ripples = [];
        this.trails = [];
    }
}
