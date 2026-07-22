import { BlockType } from './Block';

export interface StructureBlock {
  dx: number;
  dy: number; // offset above the structure's flattened ground level
  dz: number;
  block: BlockType;
}

export interface StructureTemplate {
  name: string;
  originX: number;
  originZ: number;
  surface: BlockType; // top block used when flattening the footprint
  clearAbove: number; // height cleared to air above ground, for overhead rock/canopy
  pad: number; // extra flattened margin around the block bounding box
  blocks: StructureBlock[];
}

function addHouse(blocks: StructureBlock[], hx: number, hz: number, hw: number, hd: number, wallH: number): void {
  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) {
      blocks.push({ dx: hx + x, dy: 0, dz: hz + z, block: BlockType.Plank });
    }
  }
  // Perimeter walls with a doorway on the south wall
  for (let y = 1; y <= wallH; y++) {
    for (let x = -hw; x <= hw; x++) {
      blocks.push({ dx: hx + x, dy: y, dz: hz - hd, block: BlockType.Plank });
      if (!(x === 0 && y <= 2)) blocks.push({ dx: hx + x, dy: y, dz: hz + hd, block: BlockType.Plank });
    }
    for (let z = -hd + 1; z <= hd - 1; z++) {
      blocks.push({ dx: hx - hw, dy: y, dz: hz + z, block: BlockType.Plank });
      blocks.push({ dx: hx + hw, dy: y, dz: hz + z, block: BlockType.Plank });
    }
  }
  // Corner posts
  for (const [x, z] of [[-hw, -hd], [-hw, hd], [hw, -hd], [hw, hd]] as const) {
    for (let y = 1; y <= wallH; y++) blocks.push({ dx: hx + x, dy: y, dz: hz + z, block: BlockType.Log });
  }
  // Stepped pyramid roof
  const steps = Math.min(hw, hd) + 1;
  for (let i = 0; i < steps; i++) {
    const y = wallH + 1 + i;
    const rw = hw - i;
    const rd = hd - i;
    for (let x = -rw; x <= rw; x++) {
      for (let z = -rd; z <= rd; z++) {
        const edge = rw === 0 || rd === 0 || x === -rw || x === rw || z === -rd || z === rd;
        if (edge) blocks.push({ dx: hx + x, dy: y, dz: hz + z, block: i === steps - 1 ? BlockType.Log : BlockType.Plank });
      }
    }
  }
}

function addWell(blocks: StructureBlock[], hx: number, hz: number): void {
  const r = 1;
  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) {
      if (Math.abs(x) === r || Math.abs(z) === r) {
        blocks.push({ dx: hx + x, dy: 1, dz: hz + z, block: BlockType.Cobblestone });
        blocks.push({ dx: hx + x, dy: 2, dz: hz + z, block: BlockType.Cobblestone });
      }
    }
  }
  blocks.push({ dx: hx, dy: 0, dz: hz, block: BlockType.Water });
  for (const [x, z] of [[-r, -r], [-r, r], [r, -r], [r, r]] as const) {
    for (let y = 1; y <= 4; y++) blocks.push({ dx: hx + x, dy: y, dz: hz + z, block: BlockType.Log });
  }
  for (let x = -r - 1; x <= r + 1; x++) {
    for (let z = -r - 1; z <= r + 1; z++) blocks.push({ dx: hx + x, dy: 5, dz: hz + z, block: BlockType.Plank });
  }
}

// Satul Bunicii: a handful of small huts and a well, tucked at the foot of the Carpathians
export function buildGrandmaVillage(originX: number, originZ: number): StructureTemplate {
  const blocks: StructureBlock[] = [];
  addHouse(blocks, -8, -7, 2, 2, 3);
  addHouse(blocks, 8, -6, 2, 2, 3);
  addHouse(blocks, 0, 8, 3, 2, 4); // grandma's own house, a little larger
  addWell(blocks, 0, -1);
  return {
    name: 'Satul Bunicii',
    originX,
    originZ,
    surface: BlockType.Grass,
    clearAbove: 8,
    pad: 2,
    blocks,
  };
}

function addTower(blocks: StructureBlock[], cx: number, cz: number, r: number, height: number, material: BlockType): void {
  for (let y = 1; y <= height; y++) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) === r || Math.abs(z) === r) blocks.push({ dx: cx + x, dy: y, dz: cz + z, block: material });
      }
    }
  }
  // Crenellations
  for (let x = -r; x <= r; x += 2) {
    blocks.push({ dx: cx + x, dy: height + 1, dz: cz - r, block: material });
    blocks.push({ dx: cx + x, dy: height + 1, dz: cz + r, block: material });
  }
  for (let z = -r; z <= r; z += 2) {
    blocks.push({ dx: cx - r, dy: height + 1, dz: cz + z, block: material });
    blocks.push({ dx: cx + r, dy: height + 1, dz: cz + z, block: material });
  }
  blocks.push({ dx: cx, dy: height + 2, dz: cz, block: BlockType.Crystal }); // beacon cap
}

function addCurtainWall(blocks: StructureBlock[], half: number, height: number, material: BlockType, gapHalf: number): void {
  for (let x = -half; x <= half; x++) {
    for (const z of [-half, half]) {
      if (z === half && Math.abs(x) <= gapHalf) continue; // gate opening
      for (let y = 1; y <= height; y++) blocks.push({ dx: x, dy: y, dz: z, block: material });
    }
  }
  for (let z = -half + 1; z <= half - 1; z++) {
    for (const x of [-half, half]) {
      for (let y = 1; y <= height; y++) blocks.push({ dx: x, dy: y, dz: z, block: material });
    }
  }
  for (let x = -half; x <= half; x += 2) {
    blocks.push({ dx: x, dy: height + 1, dz: -half, block: material });
    if (x < -gapHalf || x > gapHalf) blocks.push({ dx: x, dy: height + 1, dz: half, block: material });
  }
  for (let z = -half; z <= half; z += 2) {
    blocks.push({ dx: -half, dy: height + 1, dz: z, block: material });
    blocks.push({ dx: half, dy: height + 1, dz: z, block: material });
  }
  // Portcullis bars across the gate
  for (let x = -gapHalf; x <= gapHalf; x++) {
    if (x === 0) continue;
    for (let y = 1; y <= height - 2; y++) blocks.push({ dx: x, dy: y, dz: half, block: BlockType.Log });
  }
}

// Castelul lui Vlad Tepes: a curtain wall with four corner towers around a tall keep
export function buildVladCastle(originX: number, originZ: number): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const half = 10;
  addCurtainWall(blocks, half, 6, BlockType.StoneBrick, 2);
  for (const [x, z] of [[-half, -half], [-half, half], [half, -half], [half, half]] as const) {
    addTower(blocks, x, z, 2, 12, BlockType.Cobblestone);
  }
  addTower(blocks, 0, 0, 3, 16, BlockType.StoneBrick); // the keep
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      if (Math.abs(x) === 3 || Math.abs(z) === 3) blocks.push({ dx: x, dy: 8, dz: z, block: BlockType.Brick });
    }
  }
  return {
    name: 'Castelul lui Vlad Tepes',
    originX,
    originZ,
    surface: BlockType.StoneBrick,
    clearAbove: 22,
    pad: 2,
    blocks,
  };
}

// Where the Satul Codat learning module lives — shared between terrain
// generation (structure stamping) and VatraModule (puzzle interactions).
export const VATRA_ORIGIN = { x: -20, z: 16 };

// Vatra Satului Codat: the phase-0 prototype square of the coding village —
// a dry well with a trough, a bread oven, and a lane with 5 unlit lanterns.
// Every mechanism starts broken/dark; the Tabla de Blocuri puzzles bring
// them to life (see src/vatra/).
export function buildVatraSatului(originX: number, originZ: number): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const B = (dx: number, dy: number, dz: number, block: BlockType) => blocks.push({ dx, dy, dz, block });

  // Fântâna: cobble ring, corner posts, plank roof — the center hole is dry
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x !== 0 || z !== 0) B(x, 1, z, BlockType.Cobblestone);
    }
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    B(x, 2, z, BlockType.Log);
    B(x, 3, z, BlockType.Log);
  }
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) B(x, 4, z, BlockType.Plank);
  }
  // Jgheabul: plank run the water flows into on success
  for (let z = 2; z <= 4; z++) B(0, 1, z, BlockType.Plank);

  // Cuptorul de pâine: brick box with a cavity and a mouth facing +Z
  for (let x = -7; x <= -5; x++) {
    for (let z = -1; z <= 1; z++) B(x, 1, z, BlockType.Brick);
  }
  for (let x = -7; x <= -5; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x === -6 && (z === 0 || z === 1)) continue; // cavity + mouth
      B(x, 2, z, BlockType.Brick);
    }
  }
  for (let x = -7; x <= -5; x++) {
    for (let z = -1; z <= 1; z++) B(x, 3, z, BlockType.Brick);
  }
  B(-6, 4, -1, BlockType.Cobblestone); // chimney
  B(-6, 5, -1, BlockType.Cobblestone);

  // Ulița: river-stone path with 5 lantern posts (glass = unlit; puzzle 3 lights them)
  for (let x = 3; x <= 13; x++) {
    for (let z = -1; z <= 0; z++) B(x, 0, z, BlockType.RiverStone);
  }
  for (const lx of [4, 6, 8, 10, 12]) {
    B(lx, 1, 1, BlockType.Log);
    B(lx, 2, 1, BlockType.Log);
    B(lx, 3, 1, BlockType.Glass);
  }

  // Fierăria lui Bunicul: a stone-brick forge, north-west of the oven —
  // cavity + mouth left hollow until the smithing puzzle lights it
  for (let x = -9; x <= -5; x++) {
    for (let z = -8; z <= -6; z++) B(x, 1, z, BlockType.StoneBrick);
  }
  for (let x = -9; x <= -5; x++) {
    for (let z = -8; z <= -6; z++) {
      if (x === -7 && (z === -7 || z === -6)) continue; // cavity + mouth
      B(x, 2, z, BlockType.StoneBrick);
    }
  }
  for (let x = -9; x <= -5; x++) {
    for (let z = -8; z <= -6; z++) B(x, 3, z, BlockType.StoneBrick);
  }
  B(-7, 4, -8, BlockType.Cobblestone); // chimney
  B(-7, 5, -8, BlockType.Cobblestone);
  B(-5, 1, -5, BlockType.Cobblestone); // anvil
  B(-5, 2, -5, BlockType.Cobblestone);

  // Grajdul: a small wooden stable, north of the well — an empty feed
  // trough (plank) that fills with hay once the feeding puzzle is solved
  for (let x = -3; x <= 3; x++) {
    for (let z = -8; z <= -5; z++) B(x, 0, z, BlockType.Plank);
  }
  for (const [x, z] of [[-3, -8], [3, -8], [-3, -5], [3, -5]] as const) {
    for (let y = 1; y <= 3; y++) B(x, y, z, BlockType.Log);
  }
  for (let x = -3; x <= 3; x++) {
    B(x, 1, -8, BlockType.Plank);
    B(x, 1, -5, BlockType.Plank);
  }
  for (let z = -8; z <= -5; z++) {
    B(-3, 1, z, BlockType.Plank);
    B(3, 1, z, BlockType.Plank);
  }
  for (let x = -3; x <= 3; x++) {
    for (let z = -8; z <= -5; z++) B(x, 4, z, BlockType.Hay); // thatched roof
  }
  for (let x = -1; x <= 1; x++) B(x, 1, -6, BlockType.Plank); // empty trough

  // Spălătoria la pârâu: a river-stone platform beside a still pond, with
  // an empty clothesline — the laundry puzzle hangs an ie on it when solved
  for (let x = 5; x <= 10; x++) {
    for (let z = -8; z <= -5; z++) B(x, 0, z, BlockType.RiverStone);
  }
  for (let x = 8; x <= 10; x++) {
    for (let z = -7; z <= -6; z++) B(x, 0, z, BlockType.Water);
  }
  B(6, 1, -8, BlockType.Log);
  B(6, 2, -8, BlockType.Log);
  B(6, 1, -5, BlockType.Log);
  B(6, 2, -5, BlockType.Log);
  for (let z = -8; z <= -5; z++) B(6, 3, z, BlockType.Plank); // clothesline bar

  return {
    name: 'Vatra Satului Codat',
    originX,
    originZ,
    surface: BlockType.Grass,
    clearAbove: 8,
    pad: 2,
    blocks,
  };
}
