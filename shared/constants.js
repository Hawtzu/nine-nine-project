// Shared Game Constants (used by both server and client)
// This file must work in both Node.js (require) and browser (<script>) contexts.

const BOARD_SIZE = 9;

const MARKERS = {
    EMPTY: ' ',
    STONE: 'S',
    BOMB: 'B',
    ICE: 'I',
    FOUNTAIN: 'F',
    SWAMP: 'W',
    WARP: 'P',
    CHECKPOINT: 'C',
    SNOW: 'N',
    ELECTROMAGNET: 'E'
};

const PHASES = {
    START_SCREEN: 'start_screen',
    SETTINGS: 'settings',
    SKILL_SELECTION: 'skill_selection',
    TURN_ORDER_SELECT: 'turn_order_select',
    START_ANIM: 'start_anim',
    ROLL: 'roll',
    MOVE: 'move',
    PLACE: 'place',
    WARP_SELECT: 'warp_select',
    DRILL_TARGET: 'drill_target',
    SKILL_TARGET: 'skill_target',
    GAME_OVER: 'game_over',
    REPLAY: 'replay',
    ANIMATING: 'animating',
    TUTORIAL: 'tutorial',
    ONLINE_LOBBY: 'online_lobby',
    INTERACTIVE_TUTORIAL: 'interactive_tutorial'
};

const SPECIAL_SKILLS = {
    ICE: 'ice_skill',
    BOMB: 'bomb_skill',
    DOMINATION: 'domination_skill',
    SNIPER: 'sniper_skill',
    SNEAK: 'sneak_skill',
    LANDSHARK: 'landshark_skill',
    METEOR: 'meteor_skill',
    MOMONGA: 'momonga_skill',
    SWAMP: 'swamp_skill',
    WARP: 'warp_skill',
    CHECKPOINT: 'checkpoint_skill',
    KAMAKURA: 'kamakura_skill',
    ELECTROMAGNET: 'electromagnet_skill'
};

const SKILL_COSTS = {
    bomb: 40,
    drill: 100,
    ice: 30,
    diagonal_move: 10,
    stock: 20,
    domination: 70,
    sniper: 110,
    sneak: 50,
    landshark: 70,
    meteor: 200,
    momonga: 60,
    swamp: 30,
    warp: 60,
    checkpoint: 120,
    kamakura: 50,
    electromagnet: 50
};

const GAME_SETTINGS = {
    turnBonus: 10,
    maxPointsDisplay: 500,
    fountainPickup: 100
};

const DIRECTION_TYPE = {
    CROSS: 'cross',
    DIAGONAL: 'diagonal'
};

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

// Test mode: set all skill costs to 0
function setTestMode() {
    Object.keys(SKILL_COSTS).forEach(k => SKILL_COSTS[k] = 0);
}

// Export for Node.js, no-op in browser (constants are global via <script>)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BOARD_SIZE, MARKERS, PHASES, SPECIAL_SKILLS, SKILL_COSTS,
        GAME_SETTINGS, DIRECTION_TYPE, CROSS_DIRECTIONS, DIAGONAL_DIRECTIONS,
        KAMAKURA_PATTERNS, setTestMode
    };
}
