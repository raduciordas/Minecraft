import test from 'node:test';
import assert from 'node:assert/strict';
import { Chunk, blockIndex } from '../src/world/Chunk.ts';
import { SpecialBlockIndex } from '../src/world/SpecialBlockIndex.ts';
import { BlockType } from '../src/world/Block.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../src/config.ts';

test('chunk indexing maps each voxel to a unique array slot', () => {
  const indexes = new Set();
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) indexes.add(blockIndex(x, y, z));
    }
  }
  assert.equal(indexes.size, CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  assert.equal(Math.min(...indexes), 0);
  assert.equal(Math.max(...indexes), indexes.size - 1);
});

test('chunk ignores vertical writes outside the world', () => {
  const chunk = new Chunk(0, 0);
  chunk.setBlock(1, -1, 1, BlockType.Stone);
  chunk.setBlock(1, CHUNK_HEIGHT, 1, BlockType.Stone);
  assert.equal(chunk.getBlock(1, -1, 1), BlockType.Air);
  assert.equal(chunk.getBlock(1, CHUNK_HEIGHT, 1), BlockType.Air);
});

test('special block index tracks, refreshes, and unloads positive chunks', () => {
  const index = new SpecialBlockIndex([BlockType.Scarecrow]);
  const chunk = new Chunk(2, 3);
  chunk.setBlock(4, 10, 5, BlockType.Scarecrow);
  index.syncChunk(chunk);
  assert.equal(index.anyNear(BlockType.Scarecrow, 36.5, 53.5, 0.1), true);
  chunk.setBlock(4, 10, 5, BlockType.Air);
  index.syncChunk(chunk);
  assert.equal(index.anyNear(BlockType.Scarecrow, 36.5, 53.5, 1), false);
  chunk.setBlock(1, 2, 1, BlockType.Scarecrow);
  index.syncChunk(chunk);
  index.removeChunk(2, 3);
  assert.deepEqual([...index.positionsOf(BlockType.Scarecrow)], []);
});

test('special block index handles negative chunk coordinates', () => {
  const index = new SpecialBlockIndex([BlockType.WolfTrap]);
  const chunk = new Chunk(-1, -2);
  chunk.setBlock(15, 4, 0, BlockType.WolfTrap);
  index.syncChunk(chunk);
  assert.equal(index.anyNear(BlockType.WolfTrap, -0.5, -31.5, 0.1), true);
  index.removeChunk(-1, -2);
  assert.equal(index.anyNear(BlockType.WolfTrap, -0.5, -31.5, 2), false);
});

