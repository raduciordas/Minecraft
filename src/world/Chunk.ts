import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from './Block';

// Single source of truth for the block index layout inside a chunk.
export function blockIndex(lx: number, ly: number, lz: number): number {
  return lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
}

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  dirty = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getBlock(lx: number, ly: number, lz: number): number {
    if (ly < 0 || ly >= CHUNK_HEIGHT) return BlockType.Air;
    return this.blocks[blockIndex(lx, ly, lz)];
  }

  setBlock(lx: number, ly: number, lz: number, id: number): void {
    if (ly < 0 || ly >= CHUNK_HEIGHT) return;
    this.blocks[blockIndex(lx, ly, lz)] = id;
  }
}
