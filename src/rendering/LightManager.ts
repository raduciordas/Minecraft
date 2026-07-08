import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from '../world/Block';
import type { Chunk } from '../world/Chunk';

const LAMP_LIGHT_COLOR = 0xffcf87;
const LAMP_LIGHT_INTENSITY = 1.6;
const LAMP_LIGHT_RANGE = 10;
const LAMP_LIGHT_DECAY = 1;

const LAMP_METAL = 0x6d5335; // post, base and cap — matches the lantern texture's frame
const LAMP_GLOW = 0xffe89a; // the lit glass pane
const LAMP_GLOW_EMISSIVE = 0x9a7a30;

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

// A narrow lamp post: base + pole + a glowing lantern head, instead of a
// full cube — placed with its foot on the cell floor.
function buildLampMesh(): THREE.Group {
  const group = new THREE.Group();
  const addBox = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive?: number) => {
    const material = new THREE.MeshLambertMaterial({ color });
    if (emissive !== undefined) material.emissive.setHex(emissive);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  addBox(0.3, 0.06, 0.3, LAMP_METAL, 0.5, 0.03, 0.5); // base
  addBox(0.1, 0.5, 0.1, LAMP_METAL, 0.5, 0.31, 0.5); // post
  addBox(0.32, 0.32, 0.32, LAMP_GLOW, 0.5, 0.72, 0.5, LAMP_GLOW_EMISSIVE); // lantern head
  addBox(0.34, 0.05, 0.34, LAMP_METAL, 0.5, 0.905, 0.5); // cap
  return group;
}

interface LampEntry {
  light: THREE.PointLight;
  mesh: THREE.Group;
}

// Tracks a narrow lamp-post mesh plus a real point light for every placed
// Lamp block, so a lit house actually glows at night instead of just
// showing a bright cube.
export class LightManager {
  private lamps = new Map<string, LampEntry>();

  constructor(private scene: THREE.Scene) {}

  // Called after a chunk is (re)meshed: adds/removes lamps so they match
  // whichever Lamp blocks are actually present in the chunk right now.
  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seen = new Set<string>();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.getBlock(lx, ly, lz) !== BlockType.Lamp) continue;
          const key = `${baseX + lx},${ly},${baseZ + lz}`;
          seen.add(key);
          if (this.lamps.has(key)) continue;

          const light = new THREE.PointLight(LAMP_LIGHT_COLOR, LAMP_LIGHT_INTENSITY, LAMP_LIGHT_RANGE, LAMP_LIGHT_DECAY);
          light.position.set(baseX + lx + 0.5, ly + 0.72, baseZ + lz + 0.5);
          this.scene.add(light);

          const mesh = buildLampMesh();
          mesh.position.set(baseX + lx, ly, baseZ + lz);
          this.scene.add(mesh);

          this.lamps.set(key, { light, mesh });
        }
      }
    }

    // Drop lamps whose block used to be a Lamp in this chunk but no longer is
    for (const [key, entry] of this.lamps) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.disposeLamp(entry);
      this.lamps.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const [key, entry] of this.lamps) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.disposeLamp(entry);
      this.lamps.delete(key);
    }
  }

  private disposeLamp(entry: LampEntry): void {
    this.scene.remove(entry.light, entry.mesh);
    entry.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
