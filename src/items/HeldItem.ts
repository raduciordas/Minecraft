import * as THREE from 'three';
import { BLOCKS, BlockType } from '../world/Block';
import { FACES, FACE_UVS } from '../rendering/ChunkMesher';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { isWeapon, buildWeaponModel, disposeModel, type WeaponId } from './Weapon';
import { isThrowable, buildThrowableModel, type ThrowableId } from './Throwable';
import { isTool, buildToolModel, type ToolId } from './Tool';
import { isConsumable, buildConsumableModel } from './Consumable';
import { isGear, buildGearModel } from './Gear';

const SKIN_COLOR = 0xe0a878;
const BLOCK_ITEM_SIZE = 0.16;

// A small skin-toned fist that the sword or block sits inside, so the
// first-person view reads as "a hand holding an item" rather than a
// disembodied weapon floating in the corner of the screen.
function buildFist(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.42),
    new THREE.MeshLambertMaterial({ color: SKIN_COLOR }),
  );
  mesh.position.set(0, -0.02, 0.14);
  return mesh;
}

// Untextured single-block cube built from the world atlas, so a held block
// looks like the block itself rather than a flat icon.
function buildBlockModel(id: BlockType, atlas: TextureAtlas): THREE.Group {
  const def = BLOCKS[id];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const face of FACES) {
    const [u0, v0, u1, v1] = atlas.getUVs(def.textures[face.texture]);
    const vertexBase = positions.length / 3;
    for (let c = 0; c < 4; c++) {
      const corner = face.corners[c];
      positions.push(
        (corner[0] - 0.5) * BLOCK_ITEM_SIZE,
        (corner[1] - 0.5) * BLOCK_ITEM_SIZE,
        (corner[2] - 0.5) * BLOCK_ITEM_SIZE,
      );
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

  const material = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, transparent: !def.opaque });
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(0, 0.08, 0.05);
  group.rotation.y = 0.5;
  return group;
}

// Builds the first-person hand model: a fist gripping whatever is selected
// (sword, tool, food, gear or block).
export function buildHeldItem(id: number, atlas: TextureAtlas): THREE.Group {
  const group = new THREE.Group();
  group.add(buildFist());
  if (isWeapon(id)) {
    group.add(buildWeaponModel(id as WeaponId));
  } else if (isThrowable(id)) {
    group.add(buildThrowableModel(id as ThrowableId));
  } else if (isTool(id)) {
    group.add(buildToolModel(id as ToolId));
  } else if (isGear(id)) {
    group.add(buildGearModel(id));
  } else if (isConsumable(id)) {
    // Food reads as food in the hand (a loaf, an apple…) rather than as a
    // textured cube — it's never placed as a world block
    group.add(buildConsumableModel(id));
  } else {
    group.add(buildBlockModel(id as BlockType, atlas));
  }
  return group;
}

export { disposeModel };
