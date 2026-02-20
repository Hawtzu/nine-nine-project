// Game Constants
const BOARD_SIZE = 9;
const CELL_SIZE = 80;
const PANEL_WIDTH = 280;
const BOARD_WIDTH = BOARD_SIZE * CELL_SIZE;
const SCREEN_WIDTH = BOARD_WIDTH + PANEL_WIDTH * 2;
const SCREEN_HEIGHT = 800;
const BOARD_OFFSET_X = PANEL_WIDTH;
const BOARD_OFFSET_Y = 40;

// Colors
const COLORS = {
    GRID: '#646464',
    BLACK: '#000000',
    WHITE: '#FFFFFF',
    P1: '#0064FF',
    P2: '#FF3232',
    P1_PANEL_BG: '#14143C',
    P2_PANEL_BG: '#3C1414',
    STONE: '#808080',
    BOMB_TILE: '#FF8000',
    ICE_TILE: '#ADD8E6',
    DRILL: '#DC143C',
    MOVE_HIGHLIGHT: 'rgba(255, 255, 0, 0.85)',
    DIAGONAL_MOVE_HIGHLIGHT: 'rgba(0, 255, 100, 0.85)',
    FALL_HIGHLIGHT: 'rgba(255, 0, 0, 0.85)',
    DIAGONAL_FALL_HIGHLIGHT: 'rgba(200, 0, 50, 0.85)',
    PLACE_HIGHLIGHT: 'rgba(0, 255, 255, 0.85)',
    DRILL_TARGET_HIGHLIGHT: 'rgba(255, 0, 255, 0.9)',
    FIGURE_BONUS_HIGHLIGHT: 'rgba(255, 215, 0, 0.8)',
    SKILL_TARGET_HIGHLIGHT: 'rgba(255, 165, 0, 0.85)',
    FOUNTAIN_TILE: '#32CD32'
};

// Tile Markers
const MARKERS = {
    EMPTY: ' ',
    STONE: 'S',
    BOMB: 'B',
    ICE: 'I',
    FOUNTAIN: 'F'
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
    ROLL: 'roll',
    MOVE: 'move',
    PLACE: 'place',
    DRILL_TARGET: 'drill_target',
    SKILL_TARGET: 'skill_target',
    GAME_OVER: 'game_over',
    REPLAY: 'replay'
};

// Special Skills (each player chooses 1 at game start)
const SPECIAL_SKILLS = {
    ICE: 'ice_skill',
    BOMB: 'bomb_skill',
    DOMINATION: 'domination_skill',
    SNIPER: 'sniper_skill',
    SURIASHI: 'suriashi_skill',
    HITOKIRI: 'hitokiri_skill',
    METEOR: 'meteor_skill',
    MOMONGA: 'momonga_skill'
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
    [SPECIAL_SKILLS.MOMONGA]: { name: 'Momonga', color: '#90EE90', textColor: '#000000', costKey: 'momonga', desc: 'Fly to nearest stone (cross)', jaDesc: '最も近い石（マンハッタン距離）の十字方向に飛行する', image: 'assets/skills/momonga.png' }
};

// Skill order for selection screen
const SKILL_ORDER = [
    SPECIAL_SKILLS.ICE, SPECIAL_SKILLS.BOMB,
    SPECIAL_SKILLS.DOMINATION, SPECIAL_SKILLS.SNIPER,
    SPECIAL_SKILLS.SURIASHI, SPECIAL_SKILLS.HITOKIRI,
    SPECIAL_SKILLS.METEOR, SPECIAL_SKILLS.MOMONGA
];

// Skill Costs
const SKILL_COSTS = {
    bomb: 50,
    drill: 100,
    ice: 20,
    diagonal_move: 10,
    stock: 20,
    domination: 100,
    sniper: 100,
    suriashi: 50,
    hitokiri: 100,
    meteor: 200,
    momonga: 50
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
