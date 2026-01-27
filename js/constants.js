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
    RECOVERY_TILE: '#40E0D0',
    BOMB_TILE: '#FF8000',
    ICE_TILE: '#ADD8E6',
    DRILL: '#DC143C',
    MOVE_HIGHLIGHT: 'rgba(255, 255, 0, 0.5)',
    FALL_HIGHLIGHT: 'rgba(255, 0, 0, 0.5)',
    PLACE_HIGHLIGHT: 'rgba(0, 255, 255, 0.5)',
    DRILL_TARGET_HIGHLIGHT: 'rgba(255, 0, 255, 0.7)',
    FIGURE_BONUS_HIGHLIGHT: 'rgba(255, 215, 0, 0.8)'
};

// Tile Markers
const MARKERS = {
    EMPTY: ' ',
    STONE: 'S',
    RECOVERY: 'R',
    BOMB: 'B',
    ICE: 'I'
};

// Game Phases
const PHASES = {
    START_SCREEN: 'start_screen',
    SKILL_SELECTION: 'skill_selection',
    ROLL: 'roll',
    MOVE: 'move',
    PLACE: 'place',
    DRILL_TARGET: 'drill_target',
    GAME_OVER: 'game_over',
    REPLAY: 'replay'
};

// Special Skills
const SPECIAL_SKILLS = {
    ICE: 'ice_skill'
};

// Skill Costs
const SKILL_COSTS = {
    recovery: 100,
    bomb: 50,
    drill: 200,
    ice: 50
};
