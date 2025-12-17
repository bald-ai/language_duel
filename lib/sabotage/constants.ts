// Sabotage durations and limits
export const SABOTAGE_DURATION_MS = 7000; // 7s total (2s wind-up, 3s full, 2s wind-down)
export const SABOTAGE_WIND_UP_MS = 2000;
export const SABOTAGE_WIND_DOWN_MS = 5000; // Time until wind-down starts (2s wind-up + 3s full)
export const MAX_SABOTAGES = 5;

// Animation button dimensions (for bounce/trampoline effects)
export const BUTTON_WIDTH = 200;
export const BUTTON_HEIGHT = 56;
export const TRAMPOLINE_BUTTON_WIDTH = 240;
export const TRAMPOLINE_BUTTON_HEIGHT = 80;
export const TRAMPOLINE_FLY_SCALE = 1.2;
export const BOUNCE_FLY_SCALE = 1.2;

// Reverse animation timing
export const REVERSE_HOLD_MS = 140;
export const REVERSE_SCRAMBLE_MS = 420;
export const REVERSE_TICK_MS = 50;

// Trampoline physics
export const TRAMPOLINE_SHAKE_MS = 1000;
export const TRAMPOLINE_SHAKE_FREQ_HZ = 2.25;
export const TRAMPOLINE_SHAKE_AMPLITUDE_PX = 4;
export const TRAMPOLINE_GRAVITY = 0.35;
export const TRAMPOLINE_TIME_SCALE = 0.7;
export const TRAMPOLINE_AIR_DRAG = 0.99;
export const TRAMPOLINE_WALL_BOUNCE_DAMPING = 0.9;
export const TRAMPOLINE_GRID_COLS = 2;
export const TRAMPOLINE_GRID_GAP = 12;

// Bounce physics
export const BOUNCE_INITIAL_VELOCITY_RANGE = 8;
export const BOUNCE_Y_OFFSET_MIN = 100;
export const BOUNCE_Y_OFFSET_MAX = 200;

// Sticky notes
export const STICKY_NOTE_COUNT = 20;
export const STICKY_NOTE_SIZE_MIN = 100;
export const STICKY_NOTE_SIZE_RANGE = 50;

