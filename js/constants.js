// Client-only Game Constants (shared constants are in shared/constants.js)
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
    ELECTROMAGNET_TILE: '#001A2A',

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

// Tooltip descriptions for board tiles (right-click / long-press)
const TOOLTIP_DESCRIPTIONS = {
    [MARKERS.BOMB]: { name: 'Bomb', tag: 'Tile', icon: '💣', desc: '相手のBombを踏むと即敗北。自分のBombを踏むと消滅する。' },
    [MARKERS.ICE]: { name: 'Ice Tile', tag: 'Tile', icon: '❄', desc: '踏むと入った方向にそのまま滑り、移動距離が1増える。' },
    [MARKERS.SWAMP]: { name: 'Swamp', tag: 'Tile', icon: '🟢', desc: '踏むと移動距離が2減る。' },
    [MARKERS.WARP]: { name: 'Warp Hole', tag: 'Tile', icon: '🌀', desc: '移動中にこのマスに触れると強制的に止まる。踏むと他のWarp Holeへのテレポート先を選べる。' },
    [MARKERS.CHECKPOINT]: { name: 'Checkpoint Tile', tag: 'Tile', icon: '✔', desc: 'スキル使用時のテレポート先になる。' },
    [MARKERS.FOUNTAIN]: { name: 'Fountain', tag: 'Tile', icon: '🟡', desc: '踏むと100ptを獲得できる。取得後消滅する。' },
    [MARKERS.SNOW]: { name: 'Snow Block', tag: 'Stone', icon: '⛄', desc: 'かまくらで生成。次の相手のターンの終了時に消滅する。' },
    [MARKERS.ELECTROMAGNET]: { name: 'Electromagnet', tag: 'Stone', icon: '⚡', desc: '相手が衝突すると感電で敗北。設置者は感電しない。' },
};

// (GAME_SETTINGS, PHASES are in shared/constants.js)

// Start Animation Timing
const START_ANIM_DURATION = 5500;
const START_ANIM_CLOTH_STRIPS = 12;

// (SPECIAL_SKILLS is in shared/constants.js)

// Skill display metadata for UI
const SKILL_INFO = {
    [SPECIAL_SKILLS.ICE]: { name: 'Ice Tile', color: '#ADD8E6', textColor: '#000000', costKey: 'ice', desc: 'Place ice to extend movement', jaDesc: '周囲4マスのいずれかにIce Tileを設置する。', image: 'assets/skills/ice tile.png' },
    [SPECIAL_SKILLS.BOMB]: { name: 'Bomb', color: '#FF8000', textColor: '#000000', costKey: 'bomb', desc: 'Place bomb to eliminate opponent', jaDesc: '周囲4マスのいずれかにBomb Tileを設置する。', image: 'assets/skills/bomb.png' },
    [SPECIAL_SKILLS.DOMINATION]: { name: 'Control', color: '#8B00FF', textColor: '#FFFFFF', costKey: 'domination', desc: 'Seal opponent skill & stock 1 turn', jaDesc: '相手のスキルとStockを1ターン封印する', image: 'assets/skills/control.png' },
    [SPECIAL_SKILLS.SNIPER]: { name: 'Sniper', color: '#228B22', textColor: '#FFFFFF', costKey: 'sniper', desc: 'Snipe opponent 4+ tiles away in LOS', jaDesc: '直線上（縦・横・斜め）で自分と相手の間に3マス以上の距離があるとき狙撃する', image: 'assets/skills/sniper.png' },
    [SPECIAL_SKILLS.SURIASHI]: { name: 'Sneak', color: '#DEB887', textColor: '#000000', costKey: 'suriashi', desc: 'Move 1 diagonal (no placement)', jaDesc: '斜め1マス移動する（石の配置なし）', image: 'assets/skills/sneak.png' },
    [SPECIAL_SKILLS.LANDSHARK]: { name: 'Landshark', color: '#DC143C', textColor: '#FFFFFF', costKey: 'landshark', desc: 'Eliminate adjacent opponent', jaDesc: '十字方向に隣接した相手を撃破する', image: 'assets/skills/landshark.png' },
    [SPECIAL_SKILLS.METEOR]: { name: 'Meteor Shower', color: '#FFD700', textColor: '#000000', costKey: 'meteor', desc: 'Place stone anywhere on board', jaDesc: 'ボード上の空きマスから1マス選択して石を配置する。石・タイル・プレイヤーがいるマスには置けない。', image: 'assets/skills/meteor shower.png' },
    [SPECIAL_SKILLS.MOMONGA]: { name: 'Momonga', color: '#90EE90', textColor: '#000000', costKey: 'momonga', desc: 'Fly to nearest stone (cross)', jaDesc: '最も近い石（マンハッタン距離）の十字方向に飛行する', image: 'assets/skills/momonga.png' },
    [SPECIAL_SKILLS.SWAMP]: { name: 'Swamp', color: '#8B6914', textColor: '#FFFFFF', costKey: 'swamp', desc: 'Place swamp to reduce movement', jaDesc: '周囲4マスのいずれかにSwamp Tileを設置する。', image: 'assets/skills/swamp.png' },
    [SPECIAL_SKILLS.WARP]: { name: 'Warp Hole', color: '#6600CC', textColor: '#FFFFFF', costKey: 'warp', desc: 'Place warp hole to teleport', jaDesc: '周囲4マスのいずれかにWarp Holeを設置する。', image: 'assets/skills/Warp hole.png' },
    [SPECIAL_SKILLS.CHECKPOINT]: { name: 'Check Point', color: '#FF1493', textColor: '#FFFFFF', costKey: 'checkpoint', desc: 'Place checkpoint & destroy adjacent stones, or teleport to it', jaDesc: '自分の位置にCheckpoint Tileを設置し周囲4方向の石を破壊。所有済みならテレポート。', image: 'assets/skills/Check point.png' },
    [SPECIAL_SKILLS.KAMAKURA]: { name: 'Kamakura', color: '#E8F0FE', textColor: '#000000', costKey: 'kamakura', desc: 'Convert U-shape stones to snow', jaDesc: '自分の周囲でコの字型に並んだ5つの石をSnow Blockに変換する。', image: 'assets/skills/Kamakura.png' },
    [SPECIAL_SKILLS.ELECTROMAGNET]: { name: 'Electromagnet', color: '#00FFFF', textColor: '#000000', costKey: 'electromagnet', desc: 'Place electric stone that shocks opponent on collision', jaDesc: '周囲4マスのいずれかにElectromagnetを設置する。', image: 'assets/skills/electromagnet.svg' }
};

// Skill order for selection screen
const SKILL_ORDER = [
    SPECIAL_SKILLS.ICE, SPECIAL_SKILLS.BOMB,
    SPECIAL_SKILLS.DOMINATION, SPECIAL_SKILLS.SNIPER,
    SPECIAL_SKILLS.SURIASHI, SPECIAL_SKILLS.LANDSHARK,
    SPECIAL_SKILLS.METEOR, SPECIAL_SKILLS.MOMONGA,
    SPECIAL_SKILLS.SWAMP, SPECIAL_SKILLS.WARP,
    SPECIAL_SKILLS.CHECKPOINT, SPECIAL_SKILLS.KAMAKURA,
    SPECIAL_SKILLS.ELECTROMAGNET
];

// Skill categories for selection screen
const SKILL_CATEGORIES = [
    { name: 'Tile', icon: 'tile', skills: [SPECIAL_SKILLS.ICE, SPECIAL_SKILLS.SWAMP, SPECIAL_SKILLS.BOMB, SPECIAL_SKILLS.WARP, SPECIAL_SKILLS.CHECKPOINT] },
    { name: 'Move', icon: 'move', skills: [SPECIAL_SKILLS.MOMONGA, SPECIAL_SKILLS.SURIASHI] },
    { name: 'Assassin', icon: 'assassin', skills: [SPECIAL_SKILLS.SNIPER, SPECIAL_SKILLS.LANDSHARK] },
    { name: 'Mind', icon: 'mind', skills: [SPECIAL_SKILLS.DOMINATION] },
    { name: 'Stone', icon: 'stone', skills: [SPECIAL_SKILLS.KAMAKURA, SPECIAL_SKILLS.ELECTROMAGNET, SPECIAL_SKILLS.METEOR] },
];

// (SKILL_COSTS, DIRECTION_TYPE, CROSS_DIRECTIONS, DIAGONAL_DIRECTIONS are in shared/constants.js)

// (KAMAKURA_PATTERNS is in shared/constants.js)

// --- COM (Computer) Battle ---
const COM_DELAYS = {
    SKILL_SELECTION: 800,
    ROLL: 600,
    MOVE: 800,
    PLACE: 700,
    DRILL: 700,
    SKILL_TARGET: 800,
    WARP: 600
};
