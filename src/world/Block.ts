export const enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Log = 5,
  Leaves = 6,
  Plank = 7,
  Water = 8,
  Cobblestone = 9,
  Brick = 10,
  Snow = 11,
  Glass = 12,
  StoneBrick = 13,
  Crystal = 14,
  Mamaliga = 15,
  Lamp = 16,
  Door = 17, // hotbar/inventory item only; placing it writes one of the DoorClosed* ids below
  Chirpici = 19,
  Obsidian = 20,
  Hay = 21,
  // A door is rendered as a thin swinging panel (see DoorRenderer), not a
  // cube, so its world-grid id also carries which wall it fills (X-running
  // or Z-running) and whether it's open or closed.
  DoorClosedX = 22,
  DoorClosedZ = 23,
  DoorOpenX = 24,
  DoorOpenZ = 25,
}

// Atlas tile indices (see TextureAtlas.ts for what gets drawn where)
export const enum Tile {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  LogSide = 5,
  LogTop = 6,
  Leaves = 7,
  Plank = 8,
  Water = 9,
  Cobble = 10,
  Brick = 11,
  Snow = 12,
  Glass = 13,
  StoneBrick = 14,
  Crystal = 15,
  Mamaliga = 16,
  Lamp = 17,
  DoorClosed = 18, // the door panel's front/back texture; reused for open and closed alike
  Chirpici = 20,
  Obsidian = 21,
  Hay = 22,
}

export interface BlockDef {
  name: string;
  solid: boolean; // participates in collision and can be targeted by the crosshair
  opaque: boolean; // hides its neighbors' faces during meshing
  textures: { top: Tile; side: Tile; bottom: Tile };
}

const T = (top: Tile, side: Tile, bottom: Tile) => ({ top, side, bottom });
const S = (name: string, tile: Tile): BlockDef => ({ name, solid: true, opaque: true, textures: T(tile, tile, tile) });

export const BLOCKS: Record<number, BlockDef> = {
  [BlockType.Grass]: { name: 'Grass', solid: true, opaque: true, textures: T(Tile.GrassTop, Tile.GrassSide, Tile.Dirt) },
  [BlockType.Dirt]: S('Dirt', Tile.Dirt),
  [BlockType.Stone]: S('Stone', Tile.Stone),
  [BlockType.Sand]: S('Sand', Tile.Sand),
  [BlockType.Log]: { name: 'Log', solid: true, opaque: true, textures: T(Tile.LogTop, Tile.LogSide, Tile.LogTop) },
  [BlockType.Leaves]: S('Leaves', Tile.Leaves),
  [BlockType.Plank]: S('Plank', Tile.Plank),
  [BlockType.Water]: { name: 'Water', solid: false, opaque: false, textures: T(Tile.Water, Tile.Water, Tile.Water) },
  [BlockType.Cobblestone]: S('Cobble', Tile.Cobble),
  [BlockType.Brick]: S('Brick', Tile.Brick),
  [BlockType.Snow]: S('Snow', Tile.Snow),
  [BlockType.Glass]: { name: 'Glass', solid: true, opaque: false, textures: T(Tile.Glass, Tile.Glass, Tile.Glass) },
  [BlockType.StoneBrick]: S('Stone Brick', Tile.StoneBrick),
  [BlockType.Crystal]: S('Crystal', Tile.Crystal),
  [BlockType.Mamaliga]: S('Mămăligă', Tile.Mamaliga),
  [BlockType.Lamp]: S('Lampă', Tile.Lamp),
  // The hotbar/inventory item; placeBlock() converts it to an oriented
  // DoorClosedX/Z below and never writes BlockType.Door into the world.
  [BlockType.Door]: { name: 'Ușă', solid: true, opaque: true, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.Chirpici]: S('Chirpici', Tile.Chirpici),
  [BlockType.Obsidian]: S('Obsidian', Tile.Obsidian),
  [BlockType.Hay]: S('Balot de Fân', Tile.Hay),
  // Not opaque: these render as a thin custom panel (DoorRenderer), not a
  // cube, so neighboring block faces must still draw right up against them.
  [BlockType.DoorClosedX]: { name: 'Ușă', solid: true, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorClosedZ]: { name: 'Ușă', solid: true, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorOpenX]: { name: 'Ușă (deschisă)', solid: false, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorOpenZ]: { name: 'Ușă (deschisă)', solid: false, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
};

export const PLACEABLE_BLOCKS: BlockType[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Log,
  BlockType.Leaves,
  BlockType.Plank,
  BlockType.Cobblestone,
  BlockType.Brick,
  BlockType.Snow,
  BlockType.Glass,
  BlockType.StoneBrick,
  BlockType.Crystal,
  BlockType.Mamaliga,
  BlockType.Lamp,
  BlockType.Door,
  BlockType.Chirpici,
  BlockType.Obsidian,
  BlockType.Hay,
];

// Collision / crosshair targeting: water and air are pass-through
export function isSolid(id: number): boolean {
  return BLOCKS[id]?.solid ?? false;
}

// Face culling: only opaque blocks hide their neighbors' faces
export function isOpaque(id: number): boolean {
  return BLOCKS[id]?.opaque ?? false;
}

export function isWater(id: number): boolean {
  return id === BlockType.Water;
}

// Either half of a placed door, any orientation or open state — always 2 blocks tall
export function isDoor(id: number): boolean {
  return (
    id === BlockType.DoorClosedX ||
    id === BlockType.DoorClosedZ ||
    id === BlockType.DoorOpenX ||
    id === BlockType.DoorOpenZ
  );
}

const DOOR_TOGGLE: Partial<Record<BlockType, BlockType>> = {
  [BlockType.DoorClosedX]: BlockType.DoorOpenX,
  [BlockType.DoorOpenX]: BlockType.DoorClosedX,
  [BlockType.DoorClosedZ]: BlockType.DoorOpenZ,
  [BlockType.DoorOpenZ]: BlockType.DoorClosedZ,
};

// The id a door swings to when toggled; returns the same id if it isn't a door.
export function toggleDoorId(id: number): number {
  return DOOR_TOGGLE[id as BlockType] ?? id;
}
