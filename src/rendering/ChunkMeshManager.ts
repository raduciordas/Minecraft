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
  private waterMaterial: THREE.MeshPhongMaterial;
  private waterTime = { value: 0 };

  constructor(
    private scene: THREE.Scene,
    private atlas: TextureAtlas,
  ) {
    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.5, // glass tile has fully transparent pixels
    });
    this.waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x329f9c,
      specular: 0xc6e9ed,
      shininess: 110,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide, // water surface stays visible from underneath
    });
    this.waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.waterTime = this.waterTime;
      shader.vertexShader = 'varying vec3 waterPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nwaterPosition = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = 'uniform float waterTime;\nvarying vec3 waterPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        vec2 p = waterPosition.xz;
        vec3 ripple = vec3(cos(p.x*2.1+p.y*0.8+waterTime*1.3)*0.09,0.0,
          sin(p.y*2.7-p.x*0.5+waterTime)*0.07);
        normal = normalize(normal + mat3(viewMatrix)*ripple);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float fresnel = pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
        outgoingLight = mix(outgoingLight, outgoingLight*1.25+vec3(0.035,0.055,0.07),fresnel*0.6);
        diffuseColor.a = mix(opacity,0.70,fresnel);
        #include <opaque_fragment>
      `);
    };
  }

  update(dt: number, camera: THREE.Camera): void {
    this.waterTime.value += dt;
    for (const entry of this.meshes.values()) {
      if (!entry.solid) continue;
      const sphere = entry.solid.geometry.boundingSphere;
      entry.solid.castShadow = !!sphere && sphere.center.distanceToSquared(camera.position) < 2304;
    }
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
      entry.solid.receiveShadow = true;
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

