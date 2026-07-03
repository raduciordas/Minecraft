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
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise1 = createNoise2D(mulberry32(seed));
    this.noise2 = createNoise2D(mulberry32(seed + 1));
  }

  heightAt(wx: number, wz: number): number {
    const h =
      TERRAIN_BASE_HEIGHT +
      TERRAIN_AMP_1 * this.noise1(wx * TERRAIN_FREQ_1, wz * TERRAIN_FREQ_1) +
      TERRAIN_AMP_2 * this.noise2(wx * TERRAIN_FREQ_2, wz * TERRAIN_FREQ_2);
    return Math.max(1, Math.min(CHUNK_HEIGHT - 12, Math.floor(h)));
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

        for (let y = 0; y <= height; y++) {
          let id: BlockType;
          if (y === height) id = sandy ? BlockType.Sand : BlockType.Grass;
          else if (y >= height - 3) id = sandy ? BlockType.Sand : BlockType.Dirt;
          else id = BlockType.Stone;
          chunk.setBlock(lx, y, lz, id);
        }
      }
    }

    this.placeTrees(chunk);
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
}
