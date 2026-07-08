import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType, isWater } from './Block';
import type { Chunk } from './Chunk';
import type { World } from './World';

const MELT_SECONDS = 2; // continuous water contact needed before it dissolves

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

function touchesWater(world: World, x: number, y: number, z: number): boolean {
  return (
    isWater(world.getBlock(x + 1, y, z)) ||
    isWater(world.getBlock(x - 1, y, z)) ||
    isWater(world.getBlock(x, y + 1, z)) ||
    isWater(world.getBlock(x, y - 1, z)) ||
    isWater(world.getBlock(x, y, z + 1)) ||
    isWater(world.getBlock(x, y, z - 1))
  );
}

// Tracks every placed Mămăligă block; one that sits against water for a
// couple of seconds dissolves away, same as the real thing would.
export class MeltManager {
  private timers = new Map<string, number>();

  // Called after a chunk is (re)meshed: starts tracking new Mămăligă blocks
  // and stops tracking ones that are no longer Mămăligă (broken, or already melted).
  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seen = new Set<string>();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.getBlock(lx, ly, lz) !== BlockType.Mamaliga) continue;
          const key = `${baseX + lx},${ly},${baseZ + lz}`;
          seen.add(key);
          if (!this.timers.has(key)) this.timers.set(key, MELT_SECONDS);
        }
      }
    }

    for (const key of this.timers.keys()) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.timers.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const key of this.timers.keys()) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.timers.delete(key);
    }
  }

  // Advances every tracked block's melt timer; returns the positions that
  // finished dissolving this tick (the caller turns them to Air).
  update(dt: number, world: World): { x: number; y: number; z: number }[] {
    const melted: { x: number; y: number; z: number }[] = [];
    for (const [key, remaining] of this.timers) {
      const [x, y, z] = key.split(',').map(Number);
      if (!touchesWater(world, x, y, z)) {
        this.timers.set(key, MELT_SECONDS); // only counts continuous contact
        continue;
      }
      const next = remaining - dt;
      if (next <= 0) {
        melted.push({ x, y, z });
        this.timers.delete(key);
      } else {
        this.timers.set(key, next);
      }
    }
    return melted;
  }
}
