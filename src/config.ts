export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 96;

// Touch devices get a smaller world radius and render scale to keep 60 fps
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)')?.matches || 'ontouchstart' in window);

export const RENDER_DISTANCE = IS_TOUCH ? 5 : 6; // chunks, radius around the player
export const MAX_PIXEL_RATIO = IS_TOUCH ? 1.5 : 2;
export const WORLD_SEED = 1337;

// Terrain shape
export const TERRAIN_BASE_HEIGHT = 28;
export const TERRAIN_AMP_1 = 10;
export const TERRAIN_FREQ_1 = 1 / 90;
export const TERRAIN_AMP_2 = 4;
export const TERRAIN_FREQ_2 = 1 / 30;
export const SAND_HEIGHT = 24; // columns at or below this get sand tops
export const SEA_LEVEL = 23; // water fills empty space up to this height

// "Carpații de Cristal" biome: a curved mountain ridge like the real
// Carpathian arc, with an opening on one side, snow caps, and crystal spires
export const MOUNTAIN_RING_RADIUS = 80;
export const MOUNTAIN_RING_WIDTH = 24;
export const MOUNTAIN_GAP_ANGLE = (40 * Math.PI) / 180; // half-width of the open side
export const MOUNTAIN_GAP_CENTER = Math.PI; // the arc opens toward -X
export const MOUNTAIN_FREQ = 1 / 50;
export const MOUNTAIN_BASE_HEIGHT = 34;
export const MOUNTAIN_AMP = 42;
export const SNOW_LINE = 56;
export const CRYSTAL_LINE = 62;
export const CRYSTAL_SPIRE_PROBABILITY = 0.02;
export const CRYSTAL_VEIN_PROBABILITY = 0.015;

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

// Day/night cycle
export const FULL_DAY_SECONDS = 240; // one full day+night
export const DAY_START_TIME = 0.35; // fresh worlds start mid-morning

// Survival
export const MAX_HP = 20; // half-hearts
export const MAX_OXYGEN_SECONDS = 10;
export const DROWN_DAMAGE_INTERVAL = 1.2;
export const REGEN_DELAY_SECONDS = 8;
export const REGEN_INTERVAL_SECONDS = 3;
export const FALL_SAFE_SPEED = 12; // impact speed with no damage (~3 blocks)
export const ZOMBIE_DAMAGE = 2;
export const ZOMBIE_CHASE_RANGE = 20;
export const ZOMBIE_CHASE_SPEED = 2.6;
export const ZOMBIE_ATTACK_RANGE = 1.4;
export const ZOMBIE_ATTACK_COOLDOWN = 1.0;
export const ZOMBIE_BURN_SECONDS = 4;

// Inventory
export const HOTBAR_SIZE = 9;
export const STARTER_STOCK = 64; // every session starts with at least this much of each material

// Multiplayer. Override at runtime with ?server=wss://your-host without a
// rebuild. If unreachable, the game falls back to solo/offline play.
export const MULTIPLAYER_SERVER_URL = 'ws://localhost:8787';
export const MOVE_SEND_INTERVAL = 0.1; // seconds between position broadcasts
export const CONNECT_TIMEOUT_MS = 6000;

// Persistence
export const SAVE_KEY = 'cuburia-save-v1';
export const SAVE_INTERVAL_MS = 10_000;
