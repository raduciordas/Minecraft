export const enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Log = 5,
  Leaves = 6,
  Plank = 7,
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
}

export interface BlockDef {
  name: string;
  solid: boolean;
  textures: { top: Tile; side: Tile; bottom: Tile };
}

const T = (top: Tile, side: Tile, bottom: Tile) => ({ top, side, bottom });

export const BLOCKS: Record<number, BlockDef> = {
  [BlockType.Grass]: { name: 'Grass', solid: true, textures: T(Tile.GrassTop, Tile.GrassSide, Tile.Dirt) },
  [BlockType.Dirt]: { name: 'Dirt', solid: true, textures: T(Tile.Dirt, Tile.Dirt, Tile.Dirt) },
  [BlockType.Stone]: { name: 'Stone', solid: true, textures: T(Tile.Stone, Tile.Stone, Tile.Stone) },
  [BlockType.Sand]: { name: 'Sand', solid: true, textures: T(Tile.Sand, Tile.Sand, Tile.Sand) },
  [BlockType.Log]: { name: 'Log', solid: true, textures: T(Tile.LogTop, Tile.LogSide, Tile.LogTop) },
  [BlockType.Leaves]: { name: 'Leaves', solid: true, textures: T(Tile.Leaves, Tile.Leaves, Tile.Leaves) },
  [BlockType.Plank]: { name: 'Plank', solid: true, textures: T(Tile.Plank, Tile.Plank, Tile.Plank) },
};

export const PLACEABLE_BLOCKS: BlockType[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Log,
  BlockType.Leaves,
  BlockType.Plank,
];

export function isSolid(id: number): boolean {
  return id !== BlockType.Air;
}
