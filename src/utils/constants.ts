// Grid Configuration
export const GRID_COLS = 6; // 6 columns (width)
export const GRID_ROWS = 8; // 8 rows (height)
export const CELL_SIZE = 50;
export const GRID_SIZE = GRID_ROWS * GRID_COLS; // 48 cells
export const GRID_WIDTH = GRID_COLS * CELL_SIZE; // 300px
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE; // 400px
export const GRID_OFFSET_X = 50; // Grid starts 50px from left edge of viewport

// Viewport
export const VIEWPORT_WIDTH = 400;
export const VIEWPORT_HEIGHT = 700; // 200 (falling) + 400 (carpet) + 100 (bottom)
export const FALLING_ZONE_HEIGHT = 200;
export const CARPET_ZONE_HEIGHT = GRID_HEIGHT; // 400px
export const CARPET_ZONE_TOP = 200; // Where grid starts
export const CARPET_ZONE_BOTTOM = FALLING_ZONE_HEIGHT + GRID_HEIGHT; // 600px (grid bottom collision point)
export const BOTTOM_MARGIN_HEIGHT = 100;

// Colors (Vibrant Palette)
export const COLORS = {
  coral: '#FF6B6B',
  teal: '#4ECDC4',
  mustard: '#F7DC6F',
  magenta: '#E91E63',
  lime: '#A8E10C',
  tangerine: '#FF8C42',
  violet: '#9B59B6',
  cyan: '#00BCD4',
};

export const COLOR_ARRAY = Object.values(COLORS);

// Fall Mechanics (Phase 2+)
export const FALL_SPEED = 30; // px per second
export const MAX_FALLING_PATCHES = 3;
export const PATCH_GENERATION_DELAY = 500; // ms after placement

// Animation Timing
export const ROTATION_DURATION = 200; // ms
export const SNAP_DURATION = 300; // ms
export const WIGGLE_CYCLE = 1500; // ms for passive wiggle
export const COMPLETION_PULSE_DURATION = 400; // ms

// Snap Mechanics (Phase 4+)
export const SNAP_RANGE = 15; // px activation range
export const SNAP_STIFFNESS = 300;
export const SNAP_DAMPING = 25;

// Patch Visual
export const PATCH_BORDER = 3; // px

export const PATCH_SHAPES = {
  SQUARE: 'square',
  RECTANGLE: 'rectangle',
};

// Stitch Patterns (Phase 2)
export const STITCH_PATTERNS = ['crossstitch', 'horizontal', 'diagonal', 'dots', 'vertical', 'chunky'] as const;