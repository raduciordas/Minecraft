import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config';
import { BlockType, Tile, isDoor } from '../world/Block';
import { FACES, FACE_UVS } from './ChunkMesher';
import type { TextureAtlas } from './TextureAtlas';
import type { Chunk } from '../world/Chunk';

const THICKNESS = 0.1875;

// Each state's rotation about the hinge edge (the door's own world corner).
// Closed-X spans +X (fills an X-running wall); opening it swings +90° to
// span +Z. Closed-Z spans +Z (perpendicular wall); opening it swings another
// 90° the same way, ending up spanning -X.
const ROTATION: Partial<Record<number, number>> = {
  [BlockType.DoorClosedX]: 0,
  [BlockType.DoorOpenX]: Math.PI / 2,
  [BlockType.DoorClosedZ]: -Math.PI / 2,
  [BlockType.DoorOpenZ]: Math.PI,
};

function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

// A thin 1x2xTHICKNESS panel: the two broad faces show the door texture,
// the four edge faces (top/bottom/hinge/handle side) show plank.
function buildPanelMesh(atlas: TextureAtlas): THREE.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const face of FACES) {
    const isBroadFace = face.dir[2] !== 0;
    const [u0, v0, u1, v1] = atlas.getUVs(isBroadFace ? Tile.DoorClosed : Tile.Plank);
    const vertexBase = positions.length / 3;
    for (let c = 0; c < 4; c++) {
      const corner = face.corners[c];
      positions.push(corner[0], corner[1] * 2, corner[2] * THICKNESS);
      normals.push(face.dir[0], face.dir[1], face.dir[2]);
      const [su, sv] = FACE_UVS[c];
      uvs.push(su === 0 ? u0 : u1, sv === 0 ? v0 : v1);
      colors.push(face.shade, face.shade, face.shade);
    }
    indices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true }));
}

// Renders every placed door as a flat swinging panel — like Minecraft,
// instead of a solid cube — so it visibly turns to face sideways when open.
export class DoorRenderer {
  private doors = new Map<string, THREE.Group>();

  constructor(
    private scene: THREE.Scene,
    private atlas: TextureAtlas,
  ) {}

  // Called after a chunk is (re)meshed: adds/updates/removes door panels so
  // they match whichever door blocks are actually present right now.
  syncChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seen = new Set<string>();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.getBlock(lx, ly, lz);
          if (!isDoor(id)) continue;
          if (chunk.getBlock(lx, ly - 1, lz) === id) continue; // this cell is the top half

          const key = `${baseX + lx},${ly},${baseZ + lz}`;
          seen.add(key);
          let group = this.doors.get(key);
          if (!group) {
            group = new THREE.Group();
            group.add(buildPanelMesh(this.atlas));
            this.scene.add(group);
            this.doors.set(key, group);
          }
          group.position.set(baseX + lx, ly, baseZ + lz);
          group.rotation.y = ROTATION[id] ?? 0;
        }
      }
    }

    for (const [key, group] of this.doors) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== chunk.cx || worldToChunkCoord(z) !== chunk.cz) continue;
      if (seen.has(key)) continue;
      this.disposeDoor(group);
      this.doors.delete(key);
    }
  }

  removeChunk(cx: number, cz: number): void {
    for (const [key, group] of this.doors) {
      const [x, , z] = key.split(',').map(Number);
      if (worldToChunkCoord(x) !== cx || worldToChunkCoord(z) !== cz) continue;
      this.disposeDoor(group);
      this.doors.delete(key);
    }
  }

  private disposeDoor(group: THREE.Group): void {
    this.scene.remove(group);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
