// Developer Settings Configuration
const SETTINGS_CONFIG = [
    {
        key: 'bomb',
        label: 'Bomb Cost',
        target: 'SKILL_COSTS',
        prop: 'bomb',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 50
    },
    {
        key: 'drill',
        label: 'Drill Cost',
        target: 'SKILL_COSTS',
        prop: 'drill',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 100
    },
    {
        key: 'ice',
        label: 'Ice Tile Cost',
        target: 'SKILL_COSTS',
        prop: 'ice',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 20
    },
    {
        key: 'diagonal_move',
        label: 'Diagonal Move Cost',
        target: 'SKILL_COSTS',
        prop: 'diagonal_move',
        min: 0,
        max: 100,
        step: 10,
        defaultValue: 10
    },
    {
        key: 'stock',
        label: 'Stock Cost',
        target: 'SKILL_COSTS',
        prop: 'stock',
        min: 0,
        max: 200,
        step: 10,
        defaultValue: 20
    },
    {
        key: 'domination',
        label: 'Control Cost',
        target: 'SKILL_COSTS',
        prop: 'domination',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 100
    },
    {
        key: 'sniper',
        label: 'Sniper Cost',
        target: 'SKILL_COSTS',
        prop: 'sniper',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 100
    },
    {
        key: 'suriashi',
        label: 'Sneak Cost',
        target: 'SKILL_COSTS',
        prop: 'suriashi',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 50
    },
    {
        key: 'hitokiri',
        label: 'Landshark Cost',
        target: 'SKILL_COSTS',
        prop: 'hitokiri',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 100
    },
    {
        key: 'meteor',
        label: 'Meteor Shower Cost',
        target: 'SKILL_COSTS',
        prop: 'meteor',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 200
    },
    {
        key: 'momonga',
        label: 'Momonga Cost',
        target: 'SKILL_COSTS',
        prop: 'momonga',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 50
    },
    {
        key: 'fountain_pickup',
        label: 'Fountain Pickup',
        target: 'GAME_SETTINGS',
        prop: 'fountainPickup',
        min: 0,
        max: 500,
        step: 10,
        defaultValue: 100
    },
    {
        key: 'turn_bonus',
        label: 'Turn Start Bonus',
        target: 'GAME_SETTINGS',
        prop: 'turnBonus',
        min: 0,
        max: 100,
        step: 10,
        defaultValue: 10
    },
    {
        key: 'max_points_display',
        label: 'Points Bar Max',
        target: 'GAME_SETTINGS',
        prop: 'maxPointsDisplay',
        min: 100,
        max: 2000,
        step: 100,
        defaultValue: 500
    }
];

class Settings {
    constructor() {
        this.sliders = [];
        this.activeSlider = null;
        this.initSliders();
    }

    initSliders() {
        this.sliders = SETTINGS_CONFIG.map(config => ({
            ...config,
            value: config.defaultValue,
            // Track geometry (set during rendering)
            trackX: 0,
            trackY: 0,
            trackWidth: 0,
            trackHeight: 0
        }));
    }

    // Apply all current values to game constants
    applyAll() {
        for (const slider of this.sliders) {
            this.applySingle(slider);
        }
    }

    // Apply a single slider value
    applySingle(slider) {
        if (slider.target === 'SKILL_COSTS') {
            SKILL_COSTS[slider.prop] = slider.value;
        } else if (slider.target === 'GAME_SETTINGS') {
            GAME_SETTINGS[slider.prop] = slider.value;
        }
    }

    // Reset all to defaults
    resetAll() {
        this.sliders.forEach(s => {
            s.value = s.defaultValue;
        });
        this.applyAll();
    }

    // Handle mouse down - check if on slider track
    handleMouseDown(x, y) {
        for (let i = 0; i < this.sliders.length; i++) {
            const s = this.sliders[i];
            const thumbRadius = 14;
            const trackCenterY = s.trackY + s.trackHeight / 2;

            if (x >= s.trackX - thumbRadius && x <= s.trackX + s.trackWidth + thumbRadius &&
                y >= trackCenterY - thumbRadius && y <= trackCenterY + thumbRadius) {
                this.activeSlider = i;
                this.updateSliderValue(i, x);
                return true;
            }
        }
        return false;
    }

    // Handle mouse move - drag slider thumb
    handleMouseMove(x, y) {
        if (this.activeSlider !== null) {
            this.updateSliderValue(this.activeSlider, x);
        }
    }

    // Handle mouse up - release slider
    handleMouseUp() {
        this.activeSlider = null;
    }

    // Update slider value based on mouse X position
    updateSliderValue(index, mouseX) {
        const s = this.sliders[index];
        const clampedX = Math.max(s.trackX, Math.min(mouseX, s.trackX + s.trackWidth));
        const ratio = (clampedX - s.trackX) / s.trackWidth;
        const rawValue = s.min + ratio * (s.max - s.min);
        // Snap to step
        s.value = Math.round(rawValue / s.step) * s.step;
        s.value = Math.max(s.min, Math.min(s.max, s.value));
        // Apply immediately
        this.applySingle(s);
    }
}
