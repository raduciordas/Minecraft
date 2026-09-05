import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import type { Chunk } from './Chunk';

export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

// Where every block of a few special kinds stands (scarecrows, campfires,
// traps, beds…), kept in step with the chunks the same way LightManager
// tracks lamps: rescanned whenever a chunk is (re)meshed, dropped when it
// unloads. Lets the mob AI ask "is there a scarecrow within 8 blocks?"
// without scanning the world every frame.
export class SpecialBlockIndex {
  private byType = new Map<number, Map<string, BlockPos>>();

  constructor(types: number[]) {
    for (const t of types) this.byType.set(t, new Map());
  }

  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    this.removeChunk(chunk.cx, chunk.cz);
    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.getBlock(lx, ly, lz);
          const bucket = this.byType.get(id);
          if (!bucket) continue;
          const x = baseX + lx;
          const z = baseZ + lz;
          bucket.set(`${x},${ly},${z}`, { x, y: ly, z });
        }
      }
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const bucket of this.byType.values()) {
      for (const [key, pos] of bucket) {
        if (Math.floor(pos.x / CHUNK_SIZE) === cx && Math.floor(pos.z / CHUNK_SIZE) === cz) bucket.delete(key);
      }
    }
  }

  positionsOf(type: number): Iterable<BlockPos> {
    return this.byType.get(type)?.values() ?? [];
  }

  // Whether a block of this type stands within `radius` (horizontally) of a point
  anyNear(type: number, x: number, z: number, radius: number): boolean {
    const r2 = radius * radius;
    for (const p of this.positionsOf(type)) {
      const dx = p.x + 0.5 - x;
      const dz = p.z + 0.5 - z;
      if (dx * dx + dz * dz <= r2) return true;
    }
    return false;
  }
}
