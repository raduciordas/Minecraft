import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BLOCKS, isSolid } from '../world/Block';
import type { Chunk } from '../world/Chunk';
import type { World } from '../world/World';
import type { TextureAtlas } from './TextureAtlas';

interface FaceDef {
  dir: [number, number, number];
  // 4 corners, CCW when viewed from outside the face
  corners: [number, number, number][];
  shade: number; // baked directional shading (classic Minecraft look)
  texture: 'top' | 'side' | 'bottom';
}

const FACES: FaceDef[] = [
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, texture: 'top' },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, texture: 'bottom' },
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6, texture: 'side' },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6, texture: 'side' },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8, texture: 'side' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8, texture: 'side' },
];

// UV corner order matching the vertex corner order of each face.
// Maps corner index -> (u, v) selector into the tile's UV rect.
const FACE_UVS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// Builds a culled mesh: one quad per block face whose neighbor is air.
// Neighbor lookups go through the world so chunk-border faces cull correctly.
export function meshChunk(chunk: Chunk, world: World, atlas: TextureAtlas): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.getBlock(lx, ly, lz);
        if (!isSolid(id)) continue;
        const def = BLOCKS[id];
        if (!def) continue;

        const wx = baseX + lx;
        const wz = baseZ + lz;

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = ly + face.dir[1];
          const nz = wz + face.dir[2];
          if (isSolid(world.getBlock(nx, ny, nz))) continue;

          const [u0, v0, u1, v1] = atlas.getUVs(def.textures[face.texture]);
          const vertexBase = positions.length / 3;

          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            positions.push(wx + corner[0], ly + corner[1], wz + corner[2]);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const [su, sv] = FACE_UVS[c];
            uvs.push(su === 0 ? u0 : u1, sv === 0 ? v0 : v1);
            colors.push(face.shade, face.shade, face.shade);
          }
          indices.push(
            vertexBase, vertexBase + 1, vertexBase + 2,
            vertexBase, vertexBase + 2, vertexBase + 3,
          );
        }
      }
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
