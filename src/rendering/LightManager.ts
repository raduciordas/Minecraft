import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType } from '../world/Block';
import type { Chunk } from '../world/Chunk';

const LAMP_LIGHT_COLOR = 0xffcf87;
const LAMP_LIGHT_INTENSITY = 1.6;
const LAMP_LIGHT_RANGE = 10;
const LAMP_LIGHT_DECAY = 1;

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

// Tracks a real point light for every placed Lamp block, so a lit house
// actually glows at night instead of just showing a bright texture.
export class LightManager {
  private lights = new Map<string, THREE.PointLight>();

  constructor(private scene: THREE.Scene) {}

  // Called after a chunk is (re)meshed: adds/removes lights so they match
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
          if (this.lights.has(key)) continue;
          const light = new THREE.PointLight(LAMP_LIGHT_COLOR, LAMP_LIGHT_INTENSITY, LAMP_LIGHT_RANGE, LAMP_LIGHT_DECAY);
          light.position.set(baseX + lx + 0.5, ly + 0.5, baseZ + lz + 0.5);
          this.scene.add(light);
          this.lights.set(key, light);
        }
      }
    }

    // Drop lights whose block used to be a Lamp in this chunk but no longer is
    for (const [key, light] of this.lights) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.scene.remove(light);
      this.lights.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const [key, light] of this.lights) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.scene.remove(light);
      this.lights.delete(key);
    }
  }
}
