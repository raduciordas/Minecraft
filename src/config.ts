export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

export const RENDER_DISTANCE = 6; // chunks, radius around the player
export const WORLD_SEED = 1337;

// Terrain shape
export const TERRAIN_BASE_HEIGHT = 28;
export const TERRAIN_AMP_1 = 10;
export const TERRAIN_FREQ_1 = 1 / 90;
export const TERRAIN_AMP_2 = 4;
export const TERRAIN_FREQ_2 = 1 / 30;
export const SAND_HEIGHT = 24; // columns at or below this get sand tops
export const SEA_LEVEL = 23; // water fills empty space up to this height

// Player
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const GRAVITY = -25;
export const JUMP_SPEED = 8.5;
export const WALK_SPEED = 5.5;
export const FLY_SPEED = 14;
export const GROUND_ACCEL = 60;
export const AIR_ACCEL = 15;
export const GROUND_FRICTION = 12;
export const REACH_DISTANCE = 5;

// Swimming
export const WATER_SPEED_FACTOR = 0.55;
export const WATER_GRAVITY_FACTOR = 0.35;
export const SWIM_UP_SPEED = 4.5;
export const WATER_MAX_SINK_SPEED = -3.5;

// Loop
export const PHYSICS_STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const MESH_BUDGET_MS = 7; // per-frame budget for chunk gen/meshing

// Sky
export const SKY_COLOR = 0x87ceeb;

// Persistence
export const SAVE_KEY = 'browser-minecraft-save-v1';
export const SAVE_INTERVAL_MS = 10_000;
