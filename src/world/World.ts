import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from './Block';
import { Chunk, blockIndex } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';

// Serialized world edits: chunk key -> [blockIndex, blockId] pairs
export type EditsData = Record<string, [number, number][]>;

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
  // Player edits survive chunk unloading and are persisted to localStorage
  private edits = new Map<string, Map<number, number>>();

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
    const chunkEdits = this.edits.get(chunkKey(cx, cz));
    if (chunkEdits) {
      for (const [index, id] of chunkEdits) chunk.blocks[index] = id;
    }
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

    const key = chunkKey(cx, cz);
    let chunkEdits = this.edits.get(key);
    if (!chunkEdits) {
      chunkEdits = new Map();
      this.edits.set(key, chunkEdits);
    }
    chunkEdits.set(blockIndex(lx, wy, lz), id);

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

  serializeEdits(): EditsData {
    const out: EditsData = {};
    for (const [key, chunkEdits] of this.edits) {
      out[key] = [...chunkEdits.entries()];
    }
    return out;
  }

  loadEdits(data: EditsData): void {
    this.edits.clear();
    for (const [key, entries] of Object.entries(data)) {
      this.edits.set(key, new Map(entries));
    }
  }

  // Chunks generated in the brief window before a multiplayer connection's
  // initial edits arrive miss those edits (generateChunk only applies them
  // once, at generation time) — patch already-loaded chunks back in.
  applyStoredEditsToAllLoadedChunks(): void {
    for (const chunk of this.chunks.values()) {
      const chunkEdits = this.edits.get(chunkKey(chunk.cx, chunk.cz));
      if (!chunkEdits) continue;
      for (const [index, id] of chunkEdits) chunk.blocks[index] = id;
    }
  }

  get hasEdits(): boolean {
    return this.edits.size > 0;
  }
}
