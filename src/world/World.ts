import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from './Block';
import { Chunk } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocal(w: number): number {
  return w - worldToChunk(w) * CHUNK_SIZE;
}

export class World {
  readonly generator: TerrainGenerator;
  private chunks = new Map<string, Chunk>();

  constructor(seed: number) {
    this.generator = new TerrainGenerator(seed);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  allChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz));
  }

  generateChunk(cx: number, cz: number): Chunk {
    const existing = this.getChunk(cx, cz);
    if (existing) return existing;
    const chunk = new Chunk(cx, cz);
    this.generator.generate(chunk);
    this.chunks.set(chunkKey(cx, cz), chunk);
    return chunk;
  }

  removeChunk(cx: number, cz: number): void {
    this.chunks.delete(chunkKey(cx, cz));
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.Air;
    const chunk = this.getChunk(worldToChunk(wx), worldToChunk(wz));
    if (!chunk) return BlockType.Air;
    return chunk.getBlock(worldToLocal(wx), wy, worldToLocal(wz));
  }

  // Returns the chunks that need remeshing (the edited chunk plus any border
  // neighbors), or an empty array if the position is not in a loaded chunk.
  setBlock(wx: number, wy: number, wz: number, id: number): Chunk[] {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return [];
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return [];

    const lx = worldToLocal(wx);
    const lz = worldToLocal(wz);
    chunk.setBlock(lx, wy, lz, id);

    const affected: Chunk[] = [chunk];
    const addNeighbor = (ncx: number, ncz: number) => {
      const n = this.getChunk(ncx, ncz);
      if (n) affected.push(n);
    };
    if (lx === 0) addNeighbor(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) addNeighbor(cx + 1, cz);
    if (lz === 0) addNeighbor(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) addNeighbor(cx, cz + 1);
    return affected;
  }
}
