import * as THREE from 'three';
import { GRAVITY } from '../config';
import { isWater } from '../world/Block';
import type { World } from '../world/World';
import { stepBody, makeBody, type Body } from '../player/Physics';

export type MobKind = 'pig' | 'sheep' | 'zombie';

interface MobSpec {
  halfWidth: number;
  height: number;
  speed: number;
  jumpSpeed: number;
}

const SPECS: Record<MobKind, MobSpec> = {
  pig: { halfWidth: 0.35, height: 0.85, speed: 1.7, jumpSpeed: 7.5 },
  sheep: { halfWidth: 0.35, height: 1.0, speed: 1.4, jumpSpeed: 7.5 },
  zombie: { halfWidth: 0.25, height: 1.85, speed: 1.1, jumpSpeed: 7.5 },
};

const TURN_SPEED = 3; // rad/s

function box(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  color: number,
  x: number, y: number, z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Leg with its pivot at the hip so rotation.x makes it swing
function leg(parent: THREE.Object3D, w: number, len: number, color: number, x: number, hipY: number, z: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(w, len, w);
  geometry.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, hipY, z);
  parent.add(mesh);
  return mesh;
}

function eyes(head: THREE.Mesh, headSize: number, color = 0x222222): void {
  // Two small boxes on the front (-Z) face of the head
  for (const side of [-1, 1]) {
    box(head, 0.08, 0.08, 0.02, color, side * headSize * 0.22, headSize * 0.1, -headSize / 2 - 0.01);
  }
}

// All models face -Z, matching forward = (-sin yaw, 0, -cos yaw)
function buildModel(kind: MobKind): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const legs: THREE.Mesh[] = [];

  if (kind === 'pig') {
    const pink = 0xeda3ab;
    const darkPink = 0xd18189;
    box(group, 0.65, 0.45, 0.95, pink, 0, 0.55, 0.05);
    const head = box(group, 0.45, 0.45, 0.4, pink, 0, 0.62, -0.6);
    box(head, 0.2, 0.14, 0.06, darkPink, 0, -0.05, -0.23); // snout
    eyes(head, 0.45);
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.35], [0.2, 0.35]]) {
      legs.push(leg(group, 0.18, 0.35, darkPink, x, 0.36, z));
    }
  } else if (kind === 'sheep') {
    const wool = 0xe9e9e4;
    const skin = 0xb08d6e;
    box(group, 0.7, 0.55, 1.0, wool, 0, 0.72, 0.05);
    const head = box(group, 0.35, 0.38, 0.35, skin, 0, 0.92, -0.6);
    box(head, 0.4, 0.3, 0.2, wool, 0, 0.12, 0.05); // wool cap
    eyes(head, 0.35);
    for (const [x, z] of [[-0.22, -0.3], [0.22, -0.3], [-0.22, 0.35], [0.22, 0.35]]) {
      legs.push(leg(group, 0.16, 0.48, skin, x, 0.48, z));
    }
  } else {
    const skin = 0x53a053;
    const shirt = 0x3a7ba8;
    const pants = 0x3c3c72;
    box(group, 0.5, 0.7, 0.26, shirt, 0, 1.05, 0);
    const head = box(group, 0.45, 0.45, 0.45, skin, 0, 1.63, 0);
    eyes(head, 0.45, 0x101010);
    // Arms stretched forward, classic zombie pose
    for (const side of [-1, 1]) {
      const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
      armGeo.translate(0, -0.3, 0);
      const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: skin }));
      arm.position.set(side * 0.32, 1.35, 0);
      arm.rotation.x = -Math.PI / 2;
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      legs.push(leg(group, 0.16, 0.7, pants, side * 0.13, 0.7, 0));
    }
  }
  return { group, legs };
}

export class Mob {
  readonly kind: MobKind;
  readonly body: Body;
  readonly group: THREE.Group;
  private legs: THREE.Mesh[];
  private spec: MobSpec;
  private yaw: number;
  private targetYaw: number;
  private walking = true;
  private decisionTimer = 0;
  private legPhase = 0;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.kind = kind;
    this.spec = SPECS[kind];
    this.body = makeBody(this.spec.halfWidth, this.spec.height);
    this.body.x = x;
    this.body.y = y;
    this.body.z = z;
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    const model = buildModel(kind);
    this.group = model.group;
    this.legs = model.legs;
    this.syncTransform();
  }

  update(world: World, dt: number): void {
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.walking = Math.random() < 0.75;
      this.targetYaw = Math.random() * Math.PI * 2;
      this.decisionTimer = 2 + Math.random() * 3;
    }

    // Turn smoothly toward the target heading
    let deltaYaw = this.targetYaw - this.yaw;
    deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
    this.yaw += Math.max(-TURN_SPEED * dt, Math.min(TURN_SPEED * dt, deltaYaw));

    const speed = this.walking ? this.spec.speed : 0;
    this.body.vx = -Math.sin(this.yaw) * speed;
    this.body.vz = -Math.cos(this.yaw) * speed;

    const inWater = isWater(
      world.getBlock(Math.floor(this.body.x), Math.floor(this.body.y + 0.3), Math.floor(this.body.z)),
    );
    if (inWater) {
      // Float up and paddle out
      this.body.vy += (2.5 - this.body.vy) * Math.min(1, 5 * dt);
    } else {
      this.body.vy += GRAVITY * dt;
    }

    stepBody(this.body, world, dt);

    // Hop over 1-block obstacles; if still stuck, pick a new direction
    if (this.body.hitWall) {
      if (this.body.onGround) this.body.vy = this.spec.jumpSpeed;
      else if (Math.random() < 0.1) this.targetYaw = Math.random() * Math.PI * 2;
    }

    this.legPhase += dt * (this.walking ? 7 : 0);
    this.syncTransform();
  }

  private syncTransform(): void {
    this.group.position.set(this.body.x, this.body.y, this.body.z);
    this.group.rotation.y = this.yaw;
    const swing = this.walking ? 0.55 : 0;
    this.legs.forEach((legMesh, i) => {
      legMesh.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * swing;
    });
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}
