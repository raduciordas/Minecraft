import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  TERRAIN_BASE_HEIGHT,
  TERRAIN_AMP_1,
  TERRAIN_FREQ_1,
  TERRAIN_AMP_2,
  TERRAIN_FREQ_2,
  SAND_HEIGHT,
  SEA_LEVEL,
  MOUNTAIN_RING_RADIUS,
  MOUNTAIN_RING_WIDTH,
  MOUNTAIN_GAP_ANGLE,
  MOUNTAIN_GAP_CENTER,
  MOUNTAIN_FREQ,
  MOUNTAIN_BASE_HEIGHT,
  MOUNTAIN_AMP,
  SNOW_LINE,
  CRYSTAL_LINE,
  CRYSTAL_SPIRE_PROBABILITY,
  CRYSTAL_VEIN_PROBABILITY,
} from '../config';
import { BlockType } from './Block';
import { Chunk } from './Chunk';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-position hash in [0, 1), used for tree placement.
function hash2D(x: number, z: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const TREE_PROBABILITY = 0.008;

export class TerrainGenerator {
  private noise1: NoiseFunction2D;
  private noise2: NoiseFunction2D;
  private mountainNoise: NoiseFunction2D;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise1 = createNoise2D(mulberry32(seed));
    this.noise2 = createNoise2D(mulberry32(seed + 1));
    this.mountainNoise = createNoise2D(mulberry32(seed + 2));
  }

  // 0 outside the mountain band, ramping to 1 along the Carpathian-style
  // ring; a wedge is faded out on one side so the ring reads as an open arc.
  arcFactor(wx: number, wz: number): number {
    const dist = Math.hypot(wx, wz);
    const ringDelta = Math.abs(dist - MOUNTAIN_RING_RADIUS);
    let radial = 1 - ringDelta / MOUNTAIN_RING_WIDTH;
    if (radial <= 0) return 0;
    radial = Math.min(1, radial);
    radial = radial * radial * (3 - 2 * radial); // smoothstep

    const angle = Math.atan2(wz, wx);
    let angleDelta = Math.abs(angle - MOUNTAIN_GAP_CENTER);
    if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta;
    if (angleDelta < MOUNTAIN_GAP_ANGLE) {
      const gapFactor = angleDelta / MOUNTAIN_GAP_ANGLE;
      radial *= gapFactor * gapFactor;
    }
    return radial;
  }

  heightAt(wx: number, wz: number): number {
    const h =
      TERRAIN_BASE_HEIGHT +
      TERRAIN_AMP_1 * this.noise1(wx * TERRAIN_FREQ_1, wz * TERRAIN_FREQ_1) +
      TERRAIN_AMP_2 * this.noise2(wx * TERRAIN_FREQ_2, wz * TERRAIN_FREQ_2);

    let height = h;
    const arc = this.arcFactor(wx, wz);
    if (arc > 0) {
      const ridge = 1 - Math.abs(this.mountainNoise(wx * MOUNTAIN_FREQ, wz * MOUNTAIN_FREQ));
      const peak = MOUNTAIN_BASE_HEIGHT + ridge * ridge * MOUNTAIN_AMP;
      height = h + arc * (peak - h);
    }
    return Math.max(1, Math.min(CHUNK_HEIGHT - 10, Math.floor(height)));
  }

  generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const height = this.heightAt(wx, wz);
        const sandy = height <= SAND_HEIGHT;
        const snowy = height >= SNOW_LINE;
        const arc = this.arcFactor(wx, wz);

        for (let y = 0; y <= height; y++) {
          let id: BlockType;
          if (y === height) id = snowy ? BlockType.Snow : sandy ? BlockType.Sand : BlockType.Grass;
          else if (y >= height - 3) id = snowy ? BlockType.Stone : sandy ? BlockType.Sand : BlockType.Dirt;
          else {
            id = BlockType.Stone;
            // Crystal veins run through the deep rock inside the mountain band
            if (arc > 0.35 && y < height - 6 && hash2D(wx, y * 131 + wz, this.seed + 3) < CRYSTAL_VEIN_PROBABILITY) {
              id = BlockType.Crystal;
            }
          }
          chunk.setBlock(lx, y, lz, id);
        }
        for (let y = height + 1; y <= SEA_LEVEL; y++) {
          chunk.setBlock(lx, y, lz, BlockType.Water);
        }
      }
    }

    this.placeTrees(chunk);
    this.placeCrystalSpires(chunk);
  }

  // Trees are kept fully inside their own chunk (trunk at 2..13) so generation
  // never depends on neighboring chunks.
  private placeTrees(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 2; lx <= CHUNK_SIZE - 3; lx++) {
      for (let lz = 2; lz <= CHUNK_SIZE - 3; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        if (hash2D(wx, wz, this.seed) >= TREE_PROBABILITY) continue;

        const ground = this.heightAt(wx, wz);
        if (chunk.getBlock(lx, ground, lz) !== BlockType.Grass) continue;

        const trunkHeight = 4 + (hash2D(wx, wz, this.seed + 7) < 0.5 ? 0 : 1);
        const top = ground + trunkHeight;
        if (top + 2 >= CHUNK_HEIGHT) continue;

        for (let y = ground + 1; y <= top; y++) {
          chunk.setBlock(lx, y, lz, BlockType.Log);
        }
        // Leaf blob: 3x3 layers around the trunk top, plus a cap
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const y = top + dy;
              if (dy === 0 && dx === 0 && dz === 0) continue; // trunk top stays log
              if (chunk.getBlock(lx + dx, y, lz + dz) === BlockType.Air) {
                chunk.setBlock(lx + dx, y, lz + dz, BlockType.Leaves);
              }
            }
          }
        }
        chunk.setBlock(lx, top + 2, lz, BlockType.Leaves);
      }
    }
  }

  // Tapering crystal spikes on the snowy Carpathian peaks, kept fully inside
  // their own chunk like trees are.
  private placeCrystalSpires(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 2; lx <= CHUNK_SIZE - 3; lx++) {
      for (let lz = 2; lz <= CHUNK_SIZE - 3; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const ground = this.heightAt(wx, wz);
        if (ground < CRYSTAL_LINE) continue;
        if (this.arcFactor(wx, wz) < 0.5) continue;
        if (hash2D(wx, wz, this.seed + 11) >= CRYSTAL_SPIRE_PROBABILITY) continue;
        if (chunk.getBlock(lx, ground, lz) !== BlockType.Snow) continue;

        const spireHeight = 3 + Math.floor(hash2D(wx, wz, this.seed + 13) * 4);
        for (let i = 0; i < spireHeight; i++) {
          const y = ground + 1 + i;
          if (y >= CHUNK_HEIGHT) break;
          const remaining = spireHeight - i;
          const radius = remaining > spireHeight * 0.6 ? 1 : 0;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (radius === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1 && hash2D(wx + dx, wz + dz + i, this.seed + 17) < 0.4) {
                continue; // ragged edges instead of a perfect box
              }
              chunk.setBlock(lx + dx, y, lz + dz, BlockType.Crystal);
            }
          }
        }
      }
    }
  }
}
