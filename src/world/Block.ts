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
  Tigla = 26,
  Boltar = 27,
  Caramida = 28,
  HorezuCeramic = 29,
  RockSalt = 30,
  IeBlouse = 31,
  RiverStone = 32,
  DacianGold = 33,
  CraftingTable = 34,
  Wool = 35,
  Wheat = 36,
  Flour = 37,
  Mushroom = 38,
  Paine = 39,
  Torch = 40, // lesson reward (Ulița): cheap placeable light, and lights your way when held
  Rope = 41, // lesson reward (Spălătoria): climbable
  Scarecrow = 42, // lesson reward (Câmpul de grâu): monsters nearby lose interest in you
  StrawMattress = 43, // lesson reward (Căpițele): a soft landing that bounces you back up
  WolfTrap = 44, // lesson reward (Capcana): the monster that steps on it is hurt and slowed
  MushroomViolet = 45, // the poisonous ones in Muma Pădurii's glade — decor, never in a pack
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
  Tigla = 23,
  Boltar = 24,
  Caramida = 25,
  HorezuCeramic = 26,
  RockSalt = 27,
  IeBlouse = 28,
  RiverStone = 29,
  DacianGold = 30,
  CraftingTable = 31,
  Wool = 32,
  Wheat = 33,
  Flour = 34,
  Mushroom = 35,
  Paine = 36,
  Torch = 37,
  Rope = 38,
  Scarecrow = 39,
  StrawMattress = 40,
  WolfTrap = 41,
  MushroomViolet = 42,
}

export interface BlockDef {
  name: string;
  solid: boolean; // participates in collision and can be targeted by the crosshair
  opaque: boolean; // hides its neighbors' faces during meshing
  textures: { top: Tile; side: Tile; bottom: Tile };
  requiresPickaxe?: boolean; // breakBlock() refuses without the Târnăcop tool selected
  notStarterStock?: boolean; // not handed out free at session start; must be mined, crafted or earned
  customMesh?: boolean; // drawn by LightManager as its own shape, never as a cube (lamp post, torch)
  climbable?: boolean; // not solid, but a body inside it can hold on and climb (rope, ladder)
}

const T = (top: Tile, side: Tile, bottom: Tile) => ({ top, side, bottom });
const S = (name: string, tile: Tile): BlockDef => ({ name, solid: true, opaque: true, textures: T(tile, tile, tile) });
const H = (name: string, tile: Tile): BlockDef => ({ ...S(name, tile), requiresPickaxe: true });
const C = (name: string, tile: Tile): BlockDef => ({ ...S(name, tile), notStarterStock: true });
// Mined with a pickaxe, and not part of the free starter stock
const HN = (name: string, tile: Tile): BlockDef => ({ ...H(name, tile), notStarterStock: true });
// Plain block, earned rather than handed out
const SN = (name: string, tile: Tile): BlockDef => ({ ...S(name, tile), notStarterStock: true });

export const BLOCKS: Record<number, BlockDef> = {
  [BlockType.Grass]: { name: 'Grass', solid: true, opaque: true, textures: T(Tile.GrassTop, Tile.GrassSide, Tile.Dirt) },
  [BlockType.Dirt]: S('Dirt', Tile.Dirt),
  [BlockType.Stone]: H('Stone', Tile.Stone),
  [BlockType.Sand]: S('Sand', Tile.Sand),
  [BlockType.Log]: { name: 'Log', solid: true, opaque: true, textures: T(Tile.LogTop, Tile.LogSide, Tile.LogTop) },
  [BlockType.Leaves]: SN('Leaves', Tile.Leaves),
  [BlockType.Plank]: S('Plank', Tile.Plank),
  [BlockType.Water]: { name: 'Water', solid: false, opaque: false, textures: T(Tile.Water, Tile.Water, Tile.Water) },
  [BlockType.Cobblestone]: S('Cobble', Tile.Cobble),
  [BlockType.Brick]: S('Brick', Tile.Brick),
  [BlockType.Snow]: S('Snow', Tile.Snow),
  // notStarterStock: not part of the starter stock — earned only via Spălătoria.
  [BlockType.Glass]: { name: 'Glass', solid: true, opaque: false, textures: T(Tile.Glass, Tile.Glass, Tile.Glass), notStarterStock: true },
  [BlockType.StoneBrick]: H('Stone Brick', Tile.StoneBrick),
  [BlockType.Crystal]: HN('Crystal', Tile.Crystal),
  [BlockType.Mamaliga]: S('Mămăligă', Tile.Mamaliga),
  // Not opaque: rendered as a narrow lamp-post shape (LightManager), not a
  // cube, so neighboring block faces must still draw right up against it.
  // notStarterStock: not part of the starter stock — earned only via Ulița.
  [BlockType.Lamp]: { name: 'Lampă', solid: true, opaque: false, textures: T(Tile.Lamp, Tile.Lamp, Tile.Lamp), notStarterStock: true, customMesh: true },
  // The hotbar/inventory item; placeBlock() converts it to an oriented
  // DoorClosedX/Z below and never writes BlockType.Door into the world.
  [BlockType.Door]: { name: 'Ușă', solid: true, opaque: true, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.Chirpici]: S('Chirpici', Tile.Chirpici),
  [BlockType.Obsidian]: HN('Obsidian', Tile.Obsidian),
  // notStarterStock: not part of the starter stock — earned only via Grajd.
  [BlockType.Hay]: C('Balot de Fân', Tile.Hay),
  // Not opaque: these render as a thin custom panel (DoorRenderer), not a
  // cube, so neighboring block faces must still draw right up against them.
  [BlockType.DoorClosedX]: { name: 'Ușă', solid: true, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorClosedZ]: { name: 'Ușă', solid: true, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorOpenX]: { name: 'Ușă (deschisă)', solid: false, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.DoorOpenZ]: { name: 'Ușă (deschisă)', solid: false, opaque: false, textures: T(Tile.Plank, Tile.DoorClosed, Tile.Plank) },
  [BlockType.Tigla]: C('Țiglă', Tile.Tigla),
  [BlockType.Boltar]: C('Boltar', Tile.Boltar),
  [BlockType.Caramida]: C('Cărămidă', Tile.Caramida),
  [BlockType.HorezuCeramic]: S('Ceramică de Horezu', Tile.HorezuCeramic),
  [BlockType.RockSalt]: S('Sare', Tile.RockSalt),
  // notStarterStock: not part of the starter stock — earned only via Spălătoria.
  [BlockType.IeBlouse]: C('Ie Tradițională', Tile.IeBlouse),
  [BlockType.RiverStone]: HN('Bolovan de Râu', Tile.RiverStone),
  [BlockType.DacianGold]: HN('Comoara Dacică', Tile.DacianGold),
  [BlockType.CraftingTable]: S('Masă de Cioplit', Tile.CraftingTable),
  [BlockType.Wool]: SN('Lână', Tile.Wool),
  [BlockType.Wheat]: SN('Grâu', Tile.Wheat),
  [BlockType.Flour]: SN('Făină', Tile.Flour),
  [BlockType.Mushroom]: SN('Ciupercă', Tile.Mushroom),
  // A consumable, not a placeable block — Game.ts's placeBlock() intercepts
  // it and eats it instead. It only lives in PLACEABLE_BLOCKS so the
  // inventory/hotbar can show its icon and stock like any other item.
  // notStarterStock: not part of the starter stock — earned only via Cuptor.
  [BlockType.Paine]: C('Pâine', Tile.Paine),
  // Drawn as a stick with a flame (LightManager), not a cube — earned at Ulița
  [BlockType.Torch]: { name: 'Torță', solid: true, opaque: false, textures: T(Tile.Torch, Tile.Torch, Tile.Torch), notStarterStock: true, customMesh: true },
  // Pass-through, but you can hang on to it and climb — earned at Spălătoria
  [BlockType.Rope]: { name: 'Frânghie', solid: false, opaque: false, textures: T(Tile.Rope, Tile.Rope, Tile.Rope), notStarterStock: true, climbable: true },
  [BlockType.Scarecrow]: { name: 'Sperietoare de ciori', solid: true, opaque: false, textures: T(Tile.Scarecrow, Tile.Scarecrow, Tile.Scarecrow), notStarterStock: true },
  [BlockType.StrawMattress]: C('Saltea de paie', Tile.StrawMattress),
  [BlockType.WolfTrap]: C('Capcană de lup', Tile.WolfTrap),
  // Decor only (the poisonous mushrooms of the glade); lives in a protected
  // zone, so it can never be mined into a pack
  [BlockType.MushroomViolet]: SN('Ciupercă otrăvitoare', Tile.MushroomViolet),
};

// Blocks a body can climb when inside them (see Player.update)
export function isClimbable(id: number): boolean {
  return BLOCKS[id]?.climbable ?? false;
}

// Blocks drawn as their own shape by LightManager rather than as a cube
export function hasCustomMesh(id: number): boolean {
  return BLOCKS[id]?.customMesh ?? false;
}

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
  BlockType.Tigla,
  BlockType.Boltar,
  BlockType.Caramida,
  BlockType.HorezuCeramic,
  BlockType.RockSalt,
  BlockType.IeBlouse,
  BlockType.RiverStone,
  BlockType.DacianGold,
  BlockType.CraftingTable,
  BlockType.Wool,
  BlockType.Wheat,
  BlockType.Flour,
  BlockType.Mushroom,
  BlockType.Paine,
  BlockType.Torch,
  BlockType.Rope,
  BlockType.Scarecrow,
  BlockType.StrawMattress,
  BlockType.WolfTrap,
];

// Collision / crosshair targeting: water and air are pass-through
export function isSolid(id: number): boolean {
  return BLOCKS[id]?.solid ?? false;
}

// Face culling: only opaque blocks hide their neighbors' faces
export function isOpaque(id: number): boolean {
  return BLOCKS[id]?.opaque ?? false;
}

// Hard/valuable blocks that breakBlock() refuses to mine without a Târnăcop
export function requiresPickaxe(id: number): boolean {
  return BLOCKS[id]?.requiresPickaxe ?? false;
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
