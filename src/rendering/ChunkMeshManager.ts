import * as THREE from 'three';
import { chunkKey } from '../world/World';
import type { Chunk } from '../world/Chunk';
import type { World } from '../world/World';
import { meshChunk } from './ChunkMesher';
import type { TextureAtlas } from './TextureAtlas';

interface ChunkMeshes {
  solid?: THREE.Mesh;
  water?: THREE.Mesh;
}

export class ChunkMeshManager {
  private meshes = new Map<string, ChunkMeshes>();
  private solidMaterial: THREE.MeshLambertMaterial;
  private waterMaterial: THREE.MeshLambertMaterial;

  constructor(
    private scene: THREE.Scene,
    private atlas: TextureAtlas,
  ) {
    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.5, // glass tile has fully transparent pixels
    });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide, // water surface stays visible from underneath
    });
  }

  get meshCount(): number {
    return this.meshes.size;
  }

  hasMesh(cx: number, cz: number): boolean {
    return this.meshes.has(chunkKey(cx, cz));
  }

  remesh(chunk: Chunk, world: World): void {
    const key = chunkKey(chunk.cx, chunk.cz);
    this.disposeEntry(this.meshes.get(key));
    this.meshes.delete(key);

    const { solid, water } = meshChunk(chunk, world, this.atlas);
    chunk.dirty = false;

    const entry: ChunkMeshes = {};
    if (solid) {
      entry.solid = new THREE.Mesh(solid, this.solidMaterial);
      entry.solid.matrixAutoUpdate = false; // vertices are in world space already
      this.scene.add(entry.solid);
    }
    if (water) {
      entry.water = new THREE.Mesh(water, this.waterMaterial);
      entry.water.matrixAutoUpdate = false;
      this.scene.add(entry.water);
    }
    this.meshes.set(key, entry);
  }

  removeMesh(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const entry = this.meshes.get(key);
    if (!entry) return;
    this.disposeEntry(entry);
    this.meshes.delete(key);
  }

  private disposeEntry(entry: ChunkMeshes | undefined): void {
    if (!entry) return;
    for (const mesh of [entry.solid, entry.water]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
  }
}
