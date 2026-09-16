import * as THREE from 'three';
import { GRAVITY } from '../config';
import { BLOCKS } from '../world/Block';
import { FACES, FACE_UVS } from '../rendering/ChunkMesher';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { stepBody, makeBody, type Body } from '../player/Physics';
import { isWeapon, buildWeaponModel, type WeaponId } from './Weapon';
import { isThrowable, buildThrowableModel, type ThrowableId } from './Throwable';
import { isTool, buildToolModel, type ToolId } from './Tool';
import { isConsumable, buildConsumableModel } from './Consumable';
import { isGear, buildGearModel } from './Gear';

const DROPPED_BLOCK_SIZE = 0.3;

export function buildItemModel(id: number, atlas: TextureAtlas): THREE.Group {
  const group = new THREE.Group();
  if (isWeapon(id)) {
    group.add(buildWeaponModel(id as WeaponId));
  } else if (isThrowable(id)) {
    group.add(buildThrowableModel(id as ThrowableId));
  } else if (isTool(id)) {
    group.add(buildToolModel(id as ToolId));
  } else if (isGear(id)) {
    group.add(buildGearModel(id));
  } else if (isConsumable(id)) {
    group.add(buildConsumableModel(id));
  } else if (BLOCKS[id]) {
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
          (corner[0] - 0.5) * DROPPED_BLOCK_SIZE,
          (corner[1] - 0.5) * DROPPED_BLOCK_SIZE,
          (corner[2] - 0.5) * DROPPED_BLOCK_SIZE,
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

    const material = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: !def.opaque,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
  }
  return group;
}

export interface DroppedItemData {
  id: string;
  itemId: number;
  count: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export class DroppedItem {
  readonly id: string;
  readonly itemId: number;
  readonly count: number;
  readonly body: Body;
  readonly group: THREE.Group;
  pickupDelay: number;
  timeAlive = 0;

  constructor(
    data: DroppedItemData,
    atlas: TextureAtlas,
    pickupDelay = 0.8,
  ) {
    this.id = data.id;
    this.itemId = data.itemId;
    this.count = data.count;
    this.pickupDelay = pickupDelay;

    this.body = makeBody(0.2, 0.4);
    this.body.x = data.x;
    this.body.y = data.y;
    this.body.z = data.z;
    this.body.vx = data.vx;
    this.body.vy = data.vy;
    this.body.vz = data.vz;

    this.group = buildItemModel(this.itemId, atlas);
    this.group.position.set(data.x, data.y, data.z);
  }

  update(world: any, dt: number): void {
    this.timeAlive += dt;
    if (this.pickupDelay > 0) {
      this.pickupDelay = Math.max(0, this.pickupDelay - dt);
    }

    if (this.body.onGround) {
      this.body.vx *= Math.max(0, 1 - 5 * dt);
      this.body.vz *= Math.max(0, 1 - 5 * dt);
    }
    this.body.vy += GRAVITY * dt;

    stepBody(this.body, world, dt);

    const bob = Math.sin(this.timeAlive * 3) * 0.05 + 0.1;
    this.group.position.set(this.body.x, this.body.y + bob, this.body.z);
    this.group.rotation.y += dt * 1.5;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export class DroppedItemManager {
  private items = new Map<string, DroppedItem>();

  constructor(
    private scene: THREE.Scene,
    private atlas: TextureAtlas,
  ) {}

  addDroppedItem(data: DroppedItemData, pickupDelay = 0.8): DroppedItem {
    if (this.items.has(data.id)) {
      this.removeDroppedItem(data.id);
    }
    const item = new DroppedItem(data, this.atlas, pickupDelay);
    this.items.set(data.id, item);
    this.scene.add(item.group);
    return item;
  }

  removeDroppedItem(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    this.scene.remove(item.group);
    item.dispose();
    this.items.delete(id);
  }

  getItem(id: string): DroppedItem | undefined {
    return this.items.get(id);
  }

  allItems(): IterableIterator<DroppedItem> {
    return this.items.values();
  }

  update(
    dt: number,
    world: any,
    playerBody: Body,
    onPickup: (item: DroppedItem) => void,
  ): void {
    const toRemove: string[] = [];

    for (const item of this.items.values()) {
      item.update(world, dt);

      // Despawn if fallen into void
      if (item.body.y < -20) {
        toRemove.push(item.id);
        continue;
      }

      if (item.pickupDelay <= 0) {
        const dx = item.body.x - playerBody.x;
        const dy = item.body.y - (playerBody.y + 0.5);
        const dz = item.body.z - playerBody.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 1.3) {
          onPickup(item);
          toRemove.push(item.id);
        }
      }
    }

    for (const id of toRemove) {
      this.removeDroppedItem(id);
    }
  }

  clear(): void {
    for (const id of Array.from(this.items.keys())) {
      this.removeDroppedItem(id);
    }
  }
}
