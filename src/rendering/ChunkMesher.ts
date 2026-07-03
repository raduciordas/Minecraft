import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BLOCKS, BlockType, isOpaque, isWater } from '../world/Block';
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

class GeometryBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  addFace(face: FaceDef, wx: number, wy: number, wz: number, uvRect: [number, number, number, number]): void {
    const [u0, v0, u1, v1] = uvRect;
    const vertexBase = this.positions.length / 3;
    for (let c = 0; c < 4; c++) {
      const corner = face.corners[c];
      this.positions.push(wx + corner[0], wy + corner[1], wz + corner[2]);
      this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      const [su, sv] = FACE_UVS[c];
      this.uvs.push(su === 0 ? u0 : u1, sv === 0 ? v0 : v1);
      this.colors.push(face.shade, face.shade, face.shade);
    }
    this.indices.push(
      vertexBase, vertexBase + 1, vertexBase + 2,
      vertexBase, vertexBase + 2, vertexBase + 3,
    );
  }

  build(): THREE.BufferGeometry | null {
    if (this.indices.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export interface ChunkGeometry {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
}

// Builds culled meshes: one quad per visible block face. Opaque faces are
// hidden by opaque neighbors; water faces render only against air, so lakes
// have a single visible surface. Neighbor lookups go through the world so
// chunk-border faces cull correctly.
export function meshChunk(chunk: Chunk, world: World, atlas: TextureAtlas): ChunkGeometry {
  const solid = new GeometryBuilder();
  const water = new GeometryBuilder();

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.getBlock(lx, ly, lz);
        if (id === BlockType.Air) continue;
        const def = BLOCKS[id];
        if (!def) continue;

        const wx = baseX + lx;
        const wz = baseZ + lz;
        const blockIsWater = isWater(id);
        const builder = blockIsWater ? water : solid;

        for (const face of FACES) {
          const neighbor = world.getBlock(wx + face.dir[0], ly + face.dir[1], wz + face.dir[2]);
          if (blockIsWater) {
            if (neighbor !== BlockType.Air) continue;
          } else if (isOpaque(neighbor)) {
            continue;
          }
          builder.addFace(face, wx, ly, wz, atlas.getUVs(def.textures[face.texture]));
        }
      }
    }
  }

  return { solid: solid.build(), water: water.build() };
}
