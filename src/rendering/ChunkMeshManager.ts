import * as THREE from 'three';
import { chunkKey } from '../world/World';
import type { Chunk } from '../world/Chunk';
import type { World } from '../world/World';
import { meshChunk } from './ChunkMesher';
import type { TextureAtlas } from './TextureAtlas';

export class ChunkMeshManager {
  private meshes = new Map<string, THREE.Mesh>();
  private material: THREE.MeshLambertMaterial;

  constructor(
    private scene: THREE.Scene,
    private atlas: TextureAtlas,
  ) {
    this.material = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
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
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.meshes.delete(key);
    }

    const geometry = meshChunk(chunk, world, this.atlas);
    chunk.dirty = false;
    if (!geometry) return;

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.matrixAutoUpdate = false; // vertices are in world space already
    this.meshes.set(key, mesh);
    this.scene.add(mesh);
  }

  removeMesh(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const mesh = this.meshes.get(key);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    this.meshes.delete(key);
  }
}
