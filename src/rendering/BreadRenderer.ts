import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from '../world/Block';
import type { Chunk } from '../world/Chunk';

const CRUST = 0xc98d3a;
const CRUST_DARK = 0xa06a26;

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

// A small rounded loaf sitting on the cell floor, instead of a full cube —
// three stacked boxes narrowing toward the top, plus a scored seam line.
function buildBreadMesh(): THREE.Group {
  const group = new THREE.Group();
  const addBox = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  addBox(0.62, 0.2, 0.36, CRUST, 0.5, 0.1, 0.5); // base
  addBox(0.5, 0.14, 0.3, CRUST, 0.5, 0.25, 0.5); // middle
  addBox(0.34, 0.09, 0.2, CRUST, 0.5, 0.36, 0.5); // top hump
  addBox(0.4, 0.02, 0.03, CRUST_DARK, 0.5, 0.4, 0.5); // scored seam
  return group;
}

// Tracks a small bread-loaf mesh for every placed Pâine block, so it reads
// as a loaf sitting on the floor rather than a full textured cube.
export class BreadRenderer {
  private loaves = new Map<string, THREE.Group>();

  constructor(private scene: THREE.Scene) {}

  // Called after a chunk is (re)meshed: adds/removes loaves so they match
  // whichever Pâine blocks are actually present in the chunk right now.
  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seen = new Set<string>();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.getBlock(lx, ly, lz) !== BlockType.Paine) continue;
          const key = `${baseX + lx},${ly},${baseZ + lz}`;
          seen.add(key);
          if (this.loaves.has(key)) continue;

          const mesh = buildBreadMesh();
          mesh.position.set(baseX + lx, ly, baseZ + lz);
          this.scene.add(mesh);
          this.loaves.set(key, mesh);
        }
      }
    }

    // Drop loaves whose block used to be Pâine in this chunk but no longer is
    for (const [key, mesh] of this.loaves) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.disposeLoaf(mesh);
      this.loaves.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const [key, mesh] of this.loaves) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.disposeLoaf(mesh);
      this.loaves.delete(key);
    }
  }

  private disposeLoaf(mesh: THREE.Group): void {
    this.scene.remove(mesh);
    mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
