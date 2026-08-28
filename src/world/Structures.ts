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

// Where Zona 2 (Lunca — Bucle) lives — shared between terrain generation
// and VatraModule (loop-puzzle interactions).
export const LUNCA_ORIGIN = { x: -15, z: -40 };

// Livada's four planting spots and Căpițele's three haystack spots, shared
// with VatraModule so the world layout and the puzzle mechanics can't drift.
// Spaced 3 apart so neighbouring canopies/heaps never claim the same block.
export const ORCHARD_DX = [-14, -11, -8, -5];
export const ORCHARD_DZ = 3;
export const HAYSTACK_DX = [-13, -10, -7];
export const HAYSTACK_DZ = 8;

// Lunca: the meadow zone that teaches loops — a 30-post fence with a gap
// the "repetă" block fills, an empty tilled field waiting to be planted in
// one motion, and a water mill that never stops grinding on its own.
export function buildLuncaZone(originX: number, originZ: number): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const B = (dx: number, dy: number, dz: number, block: BlockType) => blocks.push({ dx, dy, dz, block });

  // Gardul Luncii: two anchor posts bookend a 30-post gap the loop fills
  B(-15, 1, -6, BlockType.Log);
  B(-15, 2, -6, BlockType.Log);
  B(16, 1, -6, BlockType.Log);
  B(16, 2, -6, BlockType.Log);

  // Câmpul de grâu: a 6×4 tilled field, bare dirt until the nested loop plants it
  for (let x = 20; x <= 25; x++) {
    for (let z = -2; z <= 1; z++) B(x, 1, z, BlockType.Dirt);
  }

  // Moara de apă: a small plank mill house beside its water channel, with a
  // decorative log wheel — the flour pile inside stays empty until solved
  for (let x = 20; x <= 24; x++) {
    for (let z = 6; z <= 10; z++) {
      if (x === 20 || x === 24 || z === 6 || z === 10) {
        for (let y = 1; y <= 3; y++) {
          if (x === 22 && z === 10 && y <= 2) continue; // doorway, south wall
          B(x, y, z, BlockType.Plank);
        }
      }
    }
  }
  for (let x = 20; x <= 24; x++) {
    for (let z = 6; z <= 10; z++) B(x, 4, z, BlockType.Plank); // flat roof
  }
  for (let z = 6; z <= 10; z++) B(19, 0, z, BlockType.Water); // the stream
  B(19, 1, 8, BlockType.Log);
  B(19, 2, 8, BlockType.Log);
  B(19, 3, 8, BlockType.Log);
  B(19, 2, 7, BlockType.Log);
  B(19, 2, 9, BlockType.Log);

  // Livada: four dug planting mounds, bare until the loop plants a tree on
  // each — the loop body here is a whole sequence (dig, plant, water)
  for (const x of ORCHARD_DX) {
    B(x, 1, ORCHARD_DZ, BlockType.Dirt);
  }

  // Căpițele: three mown patches waiting for a haystack apiece
  for (const x of HAYSTACK_DX) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) B(x + dx, 0, HAYSTACK_DZ + dz, BlockType.Dirt);
    }
  }

  return {
    name: 'Lunca',
    originX,
    originZ,
    surface: BlockType.Grass,
    // Trees can grow up to 7 blocks above natural ground (5-tall trunk +
    // leaf cap) before this pad flattens over them — clearAbove must clear
    // past that or a stray leaf/log is left stranded in mid-air.
    clearAbove: 9,
    pad: 2,
    blocks,
  };
}

// Where Zona 3 (Pădurea — Condiții) lives — shared between terrain
// generation and VatraModule (conditional-puzzle interactions).
export const PADUREA_ORIGIN = { x: -50, z: -10 };

// Pădurea: the forest zone that teaches conditions — an unlit lantern on
// Muma Pădurii's threshold path, a plank bridge over a carved river with a
// sensor-driven railing, and a covered wolf trap that must tell a wolf from
// a stray sheep.
export function buildPadureaZone(originX: number, originZ: number): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const B = (dx: number, dy: number, dz: number, block: BlockType) => blocks.push({ dx, dy, dz, block });

  // Poteca Mumei Pădurii: a lantern post and Muma Pădurii's little log hut
  B(0, 1, -6, BlockType.Log);
  B(0, 2, -6, BlockType.Log);
  B(0, 3, -6, BlockType.Glass); // unlit until the IF/ELSE is solved
  for (let x = -7; x <= -5; x++) {
    for (let z = -7; z <= -5; z++) {
      if (x === -7 || x === -5 || z === -7 || z === -5) {
        B(x, 1, z, BlockType.Log);
        B(x, 2, z, BlockType.Log);
      }
    }
  }
  for (let x = -7; x <= -5; x++) {
    for (let z = -7; z <= -5; z++) B(x, 3, z, BlockType.Plank); // hut roof
  }

  // Podul mișcător: a plank bridge over a carved channel, with an empty
  // railing socket the sensor logic raises when solved
  for (let x = -3; x <= 3; x++) {
    for (let z = 2; z <= 4; z++) B(x, 0, z, BlockType.Water);
  }
  for (let x = -3; x <= 3; x++) B(x, 1, 3, BlockType.Plank); // bridge deck
  B(-3, 1, 2, BlockType.Log);
  B(-3, 1, 4, BlockType.Log);
  B(3, 1, 2, BlockType.Log);
  B(3, 1, 4, BlockType.Log);

  // Capcana de lup: a small covered trap, sprung marker starts as a plain lid
  for (let x = 11; x <= 15; x++) {
    for (let z = -6; z <= -3; z++) B(x, 1, z, BlockType.Plank);
  }
  for (const [x, z] of [[11, -6], [15, -6], [11, -3], [15, -3]] as const) {
    B(x, 2, z, BlockType.Log);
    B(x, 3, z, BlockType.Log);
  }

  return {
    name: 'Pădurea',
    originX,
    originZ,
    surface: BlockType.Grass,
    // Same reasoning as Lunca: clear past a full-height tree's leaf cap
    // (up to 7 above natural ground) so nothing is left floating.
    clearAbove: 9,
    pad: 2,
    blocks,
  };
}
