import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from '../world/Block';
import type { Chunk } from '../world/Chunk';

const LAMP_METAL = 0x6d5335; // post, base and cap — matches the lantern texture's frame
const LAMP_GLOW = 0xffe89a; // the lit glass pane
const LAMP_GLOW_EMISSIVE = 0x9a7a30;

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

interface LightSpec {
  color: number;
  intensity: number;
  range: number;
  lightY: number; // where the point light sits above the cell floor
  buildMesh: () => THREE.Group;
}

function addBox(group: THREE.Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive?: number): void {
  const material = new THREE.MeshLambertMaterial({ color });
  if (emissive !== undefined) material.emissive.setHex(emissive);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
}

// A narrow lamp post: base + pole + a glowing lantern head, instead of a
// full cube — placed with its foot on the cell floor.
function buildLampMesh(): THREE.Group {
  const group = new THREE.Group();
  addBox(group, 0.3, 0.06, 0.3, LAMP_METAL, 0.5, 0.03, 0.5); // base
  addBox(group, 0.1, 0.5, 0.1, LAMP_METAL, 0.5, 0.31, 0.5); // post
  addBox(group, 0.32, 0.32, 0.32, LAMP_GLOW, 0.5, 0.72, 0.5, LAMP_GLOW_EMISSIVE); // lantern head
  addBox(group, 0.34, 0.05, 0.34, LAMP_METAL, 0.5, 0.905, 0.5); // cap
  return group;
}

// A torch: a short stick with a flame on top
function buildTorchMesh(): THREE.Group {
  const group = new THREE.Group();
  addBox(group, 0.12, 0.55, 0.12, 0x6b4a26, 0.5, 0.275, 0.5); // stick
  addBox(group, 0.18, 0.2, 0.18, 0xff9a2a, 0.5, 0.64, 0.5, 0xc85a10); // flame
  addBox(group, 0.1, 0.12, 0.1, 0xffe08a, 0.5, 0.78, 0.5, 0xd8a030); // flame tip
  return group;
}

// Every block that glows, and how: the mesh drawn in the cube's place and
// the point light attached to it
const LIGHT_BLOCKS: Record<number, LightSpec> = {
  [BlockType.Lamp]: { color: 0xffcf87, intensity: 1.6, range: 10, lightY: 0.72, buildMesh: buildLampMesh },
  [BlockType.Torch]: { color: 0xffb060, intensity: 1.1, range: 7, lightY: 0.7, buildMesh: buildTorchMesh },
};

interface LightEntry {
  light: THREE.PointLight;
  mesh: THREE.Group;
}

// Tracks a custom mesh plus a real point light for every placed light
// block, so a lit house actually glows at night instead of just showing a
// bright cube.
export class LightManager {
  private lights = new Map<string, LightEntry>();

  constructor(private scene: THREE.Scene) {}

  // Called after a chunk is (re)meshed: adds/removes lights so they match
  // whichever light blocks are actually present in the chunk right now.
  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seen = new Set<string>();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const spec = LIGHT_BLOCKS[chunk.getBlock(lx, ly, lz)];
          if (!spec) continue;
          const key = `${baseX + lx},${ly},${baseZ + lz}`;
          seen.add(key);
          if (this.lights.has(key)) continue;

          const light = new THREE.PointLight(spec.color, spec.intensity, spec.range, 1);
          light.position.set(baseX + lx + 0.5, ly + spec.lightY, baseZ + lz + 0.5);
          this.scene.add(light);

          const mesh = spec.buildMesh();
          mesh.position.set(baseX + lx, ly, baseZ + lz);
          this.scene.add(mesh);

          this.lights.set(key, { light, mesh });
        }
      }
    }

    // Drop lights whose block used to glow in this chunk but no longer does
    for (const [key, entry] of this.lights) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.disposeLight(entry);
      this.lights.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const [key, entry] of this.lights) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.disposeLight(entry);
      this.lights.delete(key);
    }
  }

  // How many light blocks are currently tracked (tests)
  get count(): number {
    return this.lights.size;
  }

  private disposeLight(entry: LightEntry): void {
    this.scene.remove(entry.light, entry.mesh);
    entry.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
