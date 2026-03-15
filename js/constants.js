// Game Constants
const BOARD_SIZE = 9;
const CELL_SIZE = 80;
const PANEL_WIDTH = 280;
const BOARD_WIDTH = BOARD_SIZE * CELL_SIZE;
const SCREEN_WIDTH = BOARD_WIDTH + PANEL_WIDTH * 2;
const SCREEN_HEIGHT = 800;
const BOARD_OFFSET_X = PANEL_WIDTH;
const BOARD_OFFSET_Y = 40;

// Colors — Cyber Dark Theme
const COLORS = {
    // Core
    GRID: '#2A1A4A',
    GRID_GLOW: '#B040FF',
    BLACK: '#000000',
    WHITE: '#FFFFFF',
    CELL_BG: '#0A0A14',
    CELL_BG_ALT: '#0D0D1A',

    // Players
    P1: '#00AAFF',
    P2: '#FF4444',
    P1_PANEL_BG: '#0A0A28',
    P2_PANEL_BG: '#280A0A',

    // Stone (cyber)
    STONE: '#2A2A3A',
    STONE_BORDER: '#B040FF',
    STONE_INNER: '#1A1A2E',

    // Special tiles (dark muted)
    BOMB_TILE: '#331A00',
    ICE_TILE: '#0A1E2E',
    FOUNTAIN_TILE: '#0A2A0A',
    SWAMP_TILE: '#1A1400',
    WARP_TILE: '#1A0033',
    CHECKPOINT_TILE: '#33001A',
    SNOW_TILE: '#1A1A28',

    // Drill
    DRILL: '#DC143C',

    // Highlights
    MOVE_HIGHLIGHT: 'rgba(255, 255, 0, 0.85)',
    DIAGONAL_MOVE_HIGHLIGHT: 'rgba(0, 255, 100, 0.85)',
    FALL_HIGHLIGHT: 'rgba(255, 0, 0, 0.85)',
    DIAGONAL_FALL_HIGHLIGHT: 'rgba(200, 0, 50, 0.85)',
    PLACE_HIGHLIGHT: 'rgba(0, 255, 255, 0.85)',
    DRILL_TARGET_HIGHLIGHT: 'rgba(255, 0, 255, 0.9)',
    FIGURE_BONUS_HIGHLIGHT: 'rgba(255, 215, 0, 0.8)',
    SKILL_TARGET_HIGHLIGHT: 'rgba(255, 165, 0, 0.85)',
    WARP_SELECT_HIGHLIGHT: 'rgba(200, 0, 255, 0.85)',
    KAMAKURA_PATTERN_HIGHLIGHT: 'rgba(135, 206, 250, 0.85)'
};

// Neon Border
const NEON = {
    COLOR: '#B040FF',
    RGB: [176, 64, 255],
    DARK_OUTSIDE: '#050510',
    SPARK_COUNT: 20
};

// Tile Markers
const MARKERS = {
    EMPTY: ' ',
    STONE: 'S',
    BOMB: 'B',
    ICE: 'I',
    FOUNTAIN: 'F',
    SWAMP: 'W',
    WARP: 'P',
    CHECKPOINT: 'C',
    SNOW: 'N'
};

// Mutable Game Settings (adjustable via developer settings)
const GAME_SETTINGS = {
    turnBonus: 10,
    maxPointsDisplay: 500,
    fountainPickup: 100
};

// Game Phases
const PHASES = {
    START_SCREEN: 'start_screen',
    SETTINGS: 'settings',
    SKILL_SELECTION: 'skill_selection',
    START_ANIM: 'start_anim',
    ROLL: 'roll',
    MOVE: 'move',
    PLACE: 'place',
    WARP_SELECT: 'warp_select',
    DRILL_TARGET: 'drill_target',
    SKILL_TARGET: 'skill_target',
    GAME_OVER: 'game_over',
    REPLAY: 'replay',
    ANIMATING: 'animating'
};

// Start Animation Timing
const START_ANIM_DURATION = 5500;
const START_ANIM_CLOTH_STRIPS = 12;

// Special Skills (each player chooses 1 at game start)
const SPECIAL_SKILLS = {
    ICE: 'ice_skill',
    BOMB: 'bomb_skill',
    DOMINATION: 'domination_skill',
    SNIPER: 'sniper_skill',
    SURIASHI: 'suriashi_skill',
    HITOKIRI: 'hitokiri_skill',
    METEOR: 'meteor_skill',
    MOMONGA: 'momonga_skill',
    SWAMP: 'swamp_skill',
    WARP: 'warp_skill',
    CHECKPOINT: 'checkpoint_skill',
    KAMAKURA: 'kamakura_skill'
};

// Skill display metadata for UI
const SKILL_INFO = {
    [SPECIAL_SKILLS.ICE]: { name: 'Ice Tile', color: '#ADD8E6', textColor: '#000000', costKey: 'ice', desc: 'Place ice to extend movement', jaDesc: '氷タイルを配置し、移動距離を延長する', image: 'assets/skills/ice tile.png' },
    [SPECIAL_SKILLS.BOMB]: { name: 'Bomb', color: '#FF8000', textColor: '#000000', costKey: 'bomb', desc: 'Place bomb to eliminate opponent', jaDesc: '爆弾を配置し、踏んだ相手を撃破する', image: 'assets/skills/bomb.png' },
    [SPECIAL_SKILLS.DOMINATION]: { name: 'Control', color: '#8B00FF', textColor: '#FFFFFF', costKey: 'domination', desc: 'Seal opponent skill & stock 3 turns', jaDesc: '相手のスキルとStockを3ターン封印する', image: 'assets/skills/control.png' },
    [SPECIAL_SKILLS.SNIPER]: { name: 'Sniper', color: '#228B22', textColor: '#FFFFFF', costKey: 'sniper', desc: 'Snipe opponent 4+ tiles away in LOS', jaDesc: '直線上4マス以上離れた相手を狙撃する', image: 'assets/skills/sniper.png' },
    [SPECIAL_SKILLS.SURIASHI]: { name: 'Sneak', color: '#DEB887', textColor: '#000000', costKey: 'suriashi', desc: 'Move 1 diagonal (no placement)', jaDesc: '斜め1マス移動する（石の配置なし）', image: 'assets/skills/sneak.png' },
    [SPECIAL_SKILLS.HITOKIRI]: { name: 'Landshark', color: '#DC143C', textColor: '#FFFFFF', costKey: 'hitokiri', desc: 'Eliminate adjacent opponent', jaDesc: '十字方向に隣接した相手を撃破する', image: 'assets/skills/landshark.png' },
    [SPECIAL_SKILLS.METEOR]: { name: 'Meteor Shower', color: '#FFD700', textColor: '#000000', costKey: 'meteor', desc: 'Place stone anywhere on board', jaDesc: '盤上のどこにでも石を配置する', image: 'assets/skills/meteor shower.png' },
    [SPECIAL_SKILLS.MOMONGA]: { name: 'Momonga', color: '#90EE90', textColor: '#000000', costKey: 'momonga', desc: 'Fly to nearest stone (cross)', jaDesc: '最も近い石（マンハッタン距離）の十字方向に飛行する', image: 'assets/skills/momonga.png' },
    [SPECIAL_SKILLS.SWAMP]: { name: 'Swamp', color: '#8B6914', textColor: '#FFFFFF', costKey: 'swamp', desc: 'Place swamp to reduce movement', jaDesc: '沼タイルを配置し、移動距離を減少させる', image: 'assets/skills/swamp.png' },
    [SPECIAL_SKILLS.WARP]: { name: 'Warp Hole', color: '#6600CC', textColor: '#FFFFFF', costKey: 'warp', desc: 'Place warp hole to teleport', jaDesc: 'ワープホールを設置し、踏んだプレイヤーを瞬間移動させる', image: 'assets/skills/Warp hole.png' },
    [SPECIAL_SKILLS.CHECKPOINT]: { name: 'Check Point', color: '#FF1493', textColor: '#FFFFFF', costKey: 'checkpoint', desc: 'Place checkpoint & destroy stones, or teleport to it', jaDesc: 'チェックポイントを設置し周囲の石を破壊、または瞬間移動する', image: 'assets/skills/Check point.png' },
    [SPECIAL_SKILLS.KAMAKURA]: { name: 'Kamakura', color: '#E8F0FE', textColor: '#000000', costKey: 'kamakura', desc: 'Convert U-shape stones to snow', jaDesc: 'コの字の石を雪に変換する', image: 'assets/skills/Kamakura.png' }
};

// Skill order for selection screen
const SKILL_ORDER = [
    SPECIAL_SKILLS.ICE, SPECIAL_SKILLS.BOMB,
    SPECIAL_SKILLS.DOMINATION, SPECIAL_SKILLS.SNIPER,
    SPECIAL_SKILLS.SURIASHI, SPECIAL_SKILLS.HITOKIRI,
    SPECIAL_SKILLS.METEOR, SPECIAL_SKILLS.MOMONGA,
    SPECIAL_SKILLS.SWAMP, SPECIAL_SKILLS.WARP,
    SPECIAL_SKILLS.CHECKPOINT, SPECIAL_SKILLS.KAMAKURA
];

// Skill Costs
const SKILL_COSTS = {
    bomb: 50,
    drill: 100,
    ice: 30,
    diagonal_move: 10,
    stock: 20,
    domination: 100,
    sniper: 100,
    suriashi: 50,
    hitokiri: 100,
    meteor: 200,
    momonga: 60,
    swamp: 20,
    warp: 60,
    checkpoint: 100,
    kamakura: 50
};

// Direction Types
const DIRECTION_TYPE = {
    CROSS: 'cross',
    DIAGONAL: 'diagonal'
};

// Direction Sets
const CROSS_DIRECTIONS = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 }
];

const DIAGONAL_DIRECTIONS = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 1 }
];

// Kamakura U-shape patterns (4 rotations)
const KAMAKURA_PATTERNS = [
    { // open bottom
        stones: [{dr:-1,dc:-1},{dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:-1},{dr:0,dc:1}],
        middle: {dr:-1,dc:0}
    },
    { // open top
        stones: [{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:-1},{dr:1,dc:0},{dr:1,dc:1}],
        middle: {dr:1,dc:0}
    },
    { // open right
        stones: [{dr:-1,dc:-1},{dr:-1,dc:0},{dr:0,dc:-1},{dr:1,dc:-1},{dr:1,dc:0}],
        middle: {dr:0,dc:-1}
    },
    { // open left
        stones: [{dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}],
        middle: {dr:0,dc:1}
    }
];

// --- COM (Computer) Battle ---
const COM_DIFFICULTY = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard'
};

const COM_DELAYS = {
    SKILL_SELECTION: 800,
    ROLL: 600,
    MOVE: 800,
    PLACE: 700,
    DRILL: 700,
    SKILL_TARGET: 800,
    WARP: 600
};
