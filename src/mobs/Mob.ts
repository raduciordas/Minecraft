import * as THREE from 'three';
import { GRAVITY, ZOMBIE_ATTACK_COOLDOWN, ZOMBIE_BURN_SECONDS } from '../config';
import { isWater, isSolid } from '../world/Block';
import type { World } from '../world/World';
import { stepBody, makeBody, type Body } from '../player/Physics';

export type MobKind = 'pig' | 'sheep' | 'zombie' | 'shadow' | 'golem' | 'wasp' | 'zmeu' | 'capcaun';

export interface MobContext {
  player: Body;
  isNight: boolean;
  playerDead: boolean;
  // How far monsters notice the player from, as a fraction of their usual
  // range (the garlic amulet halves it)
  chaseMul: number;
  // A scarecrow standing near a monster keeps it from giving chase
  isScaredAt: (x: number, z: number) => boolean;
  onMobAttack: (mob: Mob) => void;
  onRangedAttack: (mob: Mob) => void;
  onMobSound: (kind: MobKind) => void;
  onTeleport: () => void;
}

interface MobSpec {
  halfWidth: number;
  height: number;
  speed: number;
  jumpSpeed: number;
  hp: number;
  damage: number;
  attackRange: number;
  chaseRange: number;
  chaseSpeed: number;
  hostile: boolean;
  flying?: boolean;
  avoidsWater?: boolean; // farm animals keep their feet dry: they won't wade in
  teleports?: boolean;
  ranged?: boolean;
  fireCooldown?: number;
}

const SPECS: Record<MobKind, MobSpec> = {
  pig: { halfWidth: 0.35, height: 0.85, speed: 1.7, jumpSpeed: 7.5, hp: 6, damage: 0, attackRange: 0, chaseRange: 0, chaseSpeed: 0, hostile: false, avoidsWater: true },
  sheep: { halfWidth: 0.35, height: 1.0, speed: 1.4, jumpSpeed: 7.5, hp: 6, damage: 0, attackRange: 0, chaseRange: 0, chaseSpeed: 0, hostile: false, avoidsWater: true },
  zombie: { halfWidth: 0.25, height: 1.85, speed: 1.1, jumpSpeed: 7.5, hp: 8, damage: 2, attackRange: 1.4, chaseRange: 20, chaseSpeed: 2.6, hostile: true },
  // Umbra: fast, fragile wraith that blinks toward you through the dark
  shadow: { halfWidth: 0.25, height: 1.9, speed: 1.3, jumpSpeed: 7.5, hp: 6, damage: 2, attackRange: 1.3, chaseRange: 26, chaseSpeed: 3.2, hostile: true, teleports: true },
  // Stone golem: slow walking wall of rock that hits like a truck
  golem: { halfWidth: 0.55, height: 2.1, speed: 0.7, jumpSpeed: 8, hp: 20, damage: 4, attackRange: 1.9, chaseRange: 16, chaseSpeed: 1.2, hostile: true },
  // Night wasp: flying stinger, dies fast but is hard to hit
  wasp: { halfWidth: 0.3, height: 0.6, speed: 1.5, jumpSpeed: 0, hp: 4, damage: 1, attackRange: 1.3, chaseRange: 24, chaseSpeed: 3.2, hostile: true, flying: true },
  // Zmeu: fire-breathing dragon of the Carpathians, attacks from range only
  zmeu: { halfWidth: 0.5, height: 1.1, speed: 1.8, jumpSpeed: 0, hp: 14, damage: 3, attackRange: 14, chaseRange: 30, chaseSpeed: 2.4, hostile: true, flying: true, ranged: true, fireCooldown: 2.2 },
  // Capcaun: a slow, towering giant that hits devastatingly hard
  capcaun: { halfWidth: 0.7, height: 2.6, speed: 0.9, jumpSpeed: 8, hp: 30, damage: 6, attackRange: 2.3, chaseRange: 18, chaseSpeed: 1.4, hostile: true },
};

const TURN_SPEED = 3; // rad/s
const DEATH_SECONDS = 0.4;
const HIT_FLASH_SECONDS = 0.18;

function box(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  color: number,
  x: number, y: number, z: number,
  opacity = 1,
): THREE.Mesh {
  const material = new THREE.MeshLambertMaterial({ color });
  if (opacity < 1) {
    material.transparent = true;
    material.opacity = opacity;
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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
  for (const side of [-1, 1]) {
    box(head, 0.08, 0.08, 0.02, color, side * headSize * 0.22, headSize * 0.1, -headSize / 2 - 0.01);
  }
}

interface MobModel {
  group: THREE.Group;
  legs: THREE.Mesh[];
  wings: THREE.Mesh[];
}

// All models face -Z, matching forward = (-sin yaw, 0, -cos yaw)
function buildModel(kind: MobKind): MobModel {
  const group = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const wings: THREE.Mesh[] = [];

  if (kind === 'pig') {
    const pink = 0xeda3ab;
    const darkPink = 0xd18189;
    box(group, 0.65, 0.45, 0.95, pink, 0, 0.55, 0.05);
    const head = box(group, 0.45, 0.45, 0.4, pink, 0, 0.62, -0.6);
    box(head, 0.2, 0.14, 0.06, darkPink, 0, -0.05, -0.23);
    eyes(head, 0.45);
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.35], [0.2, 0.35]]) {
      legs.push(leg(group, 0.18, 0.35, darkPink, x, 0.36, z));
    }
  } else if (kind === 'sheep') {
    const wool = 0xe9e9e4;
    const skin = 0xb08d6e;
    box(group, 0.7, 0.55, 1.0, wool, 0, 0.72, 0.05);
    const head = box(group, 0.35, 0.38, 0.35, skin, 0, 0.92, -0.6);
    box(head, 0.4, 0.3, 0.2, wool, 0, 0.12, 0.05);
    eyes(head, 0.35);
    for (const [x, z] of [[-0.22, -0.3], [0.22, -0.3], [-0.22, 0.35], [0.22, 0.35]]) {
      legs.push(leg(group, 0.16, 0.48, skin, x, 0.48, z));
    }
  } else if (kind === 'zombie') {
    const skin = 0x53a053;
    const shirt = 0x3a7ba8;
    const pants = 0x3c3c72;
    box(group, 0.5, 0.7, 0.26, shirt, 0, 1.05, 0);
    const head = box(group, 0.45, 0.45, 0.45, skin, 0, 1.63, 0);
    eyes(head, 0.45, 0x101010);
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
  } else if (kind === 'shadow') {
    // Umbra: tall translucent wraith with glowing violet eyes
    const dark = 0x14141d;
    const darker = 0x0c0c13;
    box(group, 0.44, 0.85, 0.24, dark, 0, 1.1, 0, 0.75);
    const head = box(group, 0.4, 0.4, 0.4, darker, 0, 1.7, 0, 0.85);
    for (const side of [-1, 1]) {
      const eye = box(head, 0.09, 0.09, 0.02, 0xc9a7ff, side * 0.1, 0.03, -0.21);
      (eye.material as THREE.MeshLambertMaterial).emissive.setHex(0x9a6cff);
    }
    // Ragged floating cloak instead of feet
    for (const side of [-1, 1]) {
      legs.push(leg(group, 0.16, 0.55, darker, side * 0.11, 0.68, 0));
    }
  } else if (kind === 'golem') {
    const rock = 0x8d8d8d;
    const moss = 0x6f7a64;
    const dark = 0x5f5f5f;
    box(group, 1.0, 0.85, 0.55, rock, 0, 1.25, 0);
    box(group, 1.02, 0.12, 0.57, moss, 0, 1.0, 0);
    const head = box(group, 0.5, 0.45, 0.5, dark, 0, 1.9, 0);
    for (const side of [-1, 1]) {
      const eye = box(head, 0.1, 0.06, 0.02, 0xffc14d, side * 0.11, 0.02, -0.26);
      (eye.material as THREE.MeshLambertMaterial).emissive.setHex(0xcc7a00);
    }
    for (const side of [-1, 1]) {
      const armGeo = new THREE.BoxGeometry(0.28, 0.95, 0.28);
      armGeo.translate(0, -0.45, 0);
      const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: rock }));
      arm.position.set(side * 0.66, 1.6, 0);
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      legs.push(leg(group, 0.3, 0.8, dark, side * 0.25, 0.8, 0));
    }
  } else if (kind === 'wasp') {
    // Night wasp: striped flying stinger with buzzing wings
    const body = 0xd8b93a;
    const stripe = 0x2b2b20;
    box(group, 0.42, 0.34, 0.62, body, 0, 0.3, 0.05);
    box(group, 0.44, 0.36, 0.1, stripe, 0, 0.3, 0.06);
    box(group, 0.44, 0.36, 0.1, stripe, 0, 0.3, 0.28);
    const head = box(group, 0.3, 0.3, 0.24, stripe, 0, 0.32, -0.4);
    for (const side of [-1, 1]) {
      const eye = box(head, 0.07, 0.07, 0.02, 0xff5555, side * 0.07, 0.02, -0.13);
      (eye.material as THREE.MeshLambertMaterial).emissive.setHex(0xaa2222);
    }
    box(group, 0.06, 0.06, 0.2, stripe, 0, 0.26, 0.45); // stinger
    for (const side of [-1, 1]) {
      const wingGeo = new THREE.BoxGeometry(0.4, 0.02, 0.28);
      wingGeo.translate(side * 0.2, 0, 0);
      const wingMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 0.18, 0.5, 0.05);
      group.add(wing);
      wings.push(wing);
    }
  } else if (kind === 'zmeu') {
    // Zmeu: fire-breathing dragon with a tapering tail and angled wings
    const scale = 0xb23a1f;
    const belly = 0xe8b34d;
    const darkScale = 0x7a2416;
    box(group, 0.55, 0.5, 1.1, scale, 0, 0.6, 0.1);
    box(group, 0.4, 0.22, 1.0, belly, 0, 0.42, 0.1);
    box(group, 0.32, 0.28, 0.6, scale, 0, 0.58, 0.75);
    box(group, 0.22, 0.2, 0.5, darkScale, 0, 0.55, 1.15);
    box(group, 0.12, 0.12, 0.4, darkScale, 0, 0.52, 1.5);
    const head = box(group, 0.42, 0.36, 0.5, scale, 0, 0.75, -0.65);
    box(head, 0.08, 0.22, 0.08, darkScale, -0.14, 0.25, 0.05);
    box(head, 0.08, 0.22, 0.08, darkScale, 0.14, 0.25, 0.05);
    for (const side of [-1, 1]) {
      const eye = box(head, 0.08, 0.08, 0.02, 0xffcc33, side * 0.13, 0.05, -0.24);
      (eye.material as THREE.MeshLambertMaterial).emissive.setHex(0xff8800);
    }
    for (const side of [-1, 1]) {
      const wingGeo = new THREE.BoxGeometry(1.3, 0.04, 0.7);
      wingGeo.translate(side * 0.65, 0, 0);
      const wingMat = new THREE.MeshLambertMaterial({ color: darkScale, transparent: true, opacity: 0.85 });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 0.28, 0.72, 0.05);
      wing.rotation.z = side * 0.35;
      wing.userData.baseZ = side * 0.35;
      group.add(wing);
      wings.push(wing);
    }
    for (const [x, z] of [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.35], [0.22, 0.35]]) {
      legs.push(leg(group, 0.14, 0.28, darkScale, x, 0.42, z));
    }
  } else {
    // Capcaun: a hulking, slow giant in ragged clothing
    const skin = 0x6b7d4f;
    const skinDark = 0x51603c;
    const cloth = 0x5a3a2a;
    box(group, 1.1, 1.0, 0.6, cloth, 0, 1.3, 0);
    const head = box(group, 0.55, 0.55, 0.55, skin, 0, 2.15, 0);
    for (const side of [-1, 1]) {
      const eye = box(head, 0.08, 0.08, 0.02, 0xffe066, side * 0.13, 0.05, -0.28);
      (eye.material as THREE.MeshLambertMaterial).emissive.setHex(0xccaa33);
    }
    for (const side of [-1, 1]) {
      box(head, 0.06, 0.14, 0.06, 0xf2eee0, side * 0.16, -0.2, -0.24);
    }
    for (const side of [-1, 1]) {
      const armGeo = new THREE.BoxGeometry(0.32, 1.0, 0.32);
      armGeo.translate(0, -0.5, 0);
      const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: skin }));
      arm.position.set(side * 0.68, 1.75, 0);
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      legs.push(leg(group, 0.34, 0.9, skinDark, side * 0.26, 0.9, 0));
    }
  }
  return { group, legs, wings };
}

export class Mob {
  readonly kind: MobKind;
  readonly body: Body;
  readonly group: THREE.Group;
  hp: number;
  dying = false;
  removeMe = false;
  burning = false;
  private burnTimer = 0;
  private dieTimer = 0;
  private hitFlashTimer = 0;
  private slowTimer = 0;
  private teleportTimer = 2;
  private emissiveDirty = false;
  private attackCooldown = 0;
  private soundTimer = 4 + Math.random() * 8;
  private legs: THREE.Mesh[];
  private wings: THREE.Mesh[];
  private spec: MobSpec;
  private yaw: number;
  private targetYaw: number;
  private walking = true;
  private decisionTimer = 0;
  private legPhase = 0;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.kind = kind;
    this.spec = SPECS[kind];
    this.hp = this.spec.hp;
    this.body = makeBody(this.spec.halfWidth, this.spec.height);
    this.body.x = x;
    this.body.y = y;
    this.body.z = z;
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    const model = buildModel(kind);
    this.group = model.group;
    this.legs = model.legs;
    this.wings = model.wings;
    this.syncTransform();
  }

  get hostile(): boolean {
    return this.spec.hostile;
  }

  get damage(): number {
    return this.spec.damage;
  }

  // A weapon (or fist) strike: damage, knockback impulse, optional chill
  hit(damage: number, knockX: number, knockZ: number, slowSeconds = 0): void {
    if (this.dying) return;
    this.hp -= damage;
    this.hitFlashTimer = HIT_FLASH_SECONDS;
    this.body.vx += knockX;
    this.body.vz += knockZ;
    if (!this.spec.flying) this.body.vy = Math.max(this.body.vy, 4.5);
    if (slowSeconds > 0) this.slowTimer = Math.max(this.slowTimer, slowSeconds);
    if (this.hp <= 0) {
      this.dying = true;
      this.dieTimer = DEATH_SECONDS;
    }
  }

  update(world: World, dt: number, ctx?: MobContext): void {
    if (this.dying) {
      this.dieTimer -= dt;
      const p = 1 - Math.max(0, this.dieTimer) / DEATH_SECONDS;
      this.group.rotation.z = (p * Math.PI) / 2;
      this.group.scale.setScalar(Math.max(0.05, 1 - p * 0.6));
      if (this.dieTimer <= 0) this.removeMe = true;
      return;
    }

    // Hostiles caught in daylight burn out
    if (this.burning) {
      this.burnTimer += dt;
      if (this.burnTimer >= ZOMBIE_BURN_SECONDS) {
        this.removeMe = true;
        return;
      }
    }
    this.updateEmissive();

    this.attackCooldown -= dt;
    this.hitFlashTimer -= dt;
    this.slowTimer -= dt;

    // Ambient sounds when the player is close enough to hear
    if (ctx) {
      this.soundTimer -= dt;
      if (this.soundTimer <= 0) {
        this.soundTimer = 5 + Math.random() * 9;
        const d = Math.hypot(ctx.player.x - this.body.x, ctx.player.z - this.body.z);
        if (d < 18) ctx.onMobSound(this.kind);
      }
    }

    // Hostile mobs hunt the player at night; everyone else wanders
    let chasing = false;
    let distToPlayer = Infinity;
    if (this.spec.hostile && ctx && ctx.isNight && !ctx.playerDead && !this.burning) {
      const dx = ctx.player.x - this.body.x;
      const dz = ctx.player.z - this.body.z;
      distToPlayer = Math.hypot(dx, dz);
      if (distToPlayer < this.spec.chaseRange * ctx.chaseMul && !ctx.isScaredAt(this.body.x, this.body.z)) {
        chasing = true;
        this.walking = true;
        this.targetYaw = Math.atan2(-dx, -dz);
        if (this.spec.ranged) {
          if (distToPlayer < this.spec.attackRange && this.attackCooldown <= 0) {
            this.attackCooldown = this.spec.fireCooldown ?? 2.5;
            ctx.onRangedAttack(this);
          }
        } else {
          const verticalOverlap =
            ctx.player.y < this.body.y + this.spec.height + 0.3 && ctx.player.y + 1.8 > this.body.y - 0.3;
          if (distToPlayer < this.spec.attackRange && verticalOverlap && this.attackCooldown <= 0) {
            this.attackCooldown = ZOMBIE_ATTACK_COOLDOWN;
            ctx.onMobAttack(this);
          }
        }
      }
    }

    // Umbra blinks a few blocks closer every couple of seconds
    if (this.spec.teleports && ctx && chasing && distToPlayer > 6) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 2.5 + Math.random() * 2;
        this.tryTeleportToward(ctx.player, world) && ctx.onTeleport();
      }
    }

    if (!chasing) {
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0) {
        this.walking = Math.random() < 0.75;
        this.targetYaw = Math.random() * Math.PI * 2;
        this.decisionTimer = 2 + Math.random() * 3;
      }
    }

    // Turn smoothly toward the target heading
    let deltaYaw = this.targetYaw - this.yaw;
    deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
    const turnSpeed = chasing ? TURN_SPEED * 2 : TURN_SPEED;
    this.yaw += Math.max(-turnSpeed * dt, Math.min(turnSpeed * dt, deltaYaw));

    if (this.spec.avoidsWater && !this.spec.flying) this.keepOutOfWater(world);

    let speed = this.walking ? (chasing ? this.spec.chaseSpeed : this.spec.speed) : 0;
    if (this.slowTimer > 0) speed *= 0.45;

    if (this.spec.flying) {
      this.updateFlying(world, dt, ctx, chasing, speed);
    } else {
      this.body.vx = -Math.sin(this.yaw) * speed;
      this.body.vz = -Math.cos(this.yaw) * speed;
      const inWater = isWater(
        world.getBlock(Math.floor(this.body.x), Math.floor(this.body.y + 0.3), Math.floor(this.body.z)),
      );
      if (inWater) {
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
    }

    this.legPhase += dt * (this.walking ? (chasing ? 10 : 7) : 0);
    this.syncTransform();
  }

  // Farm animals stay on dry land: they stop rather than walk into water, and
  // if they somehow end up in it they strike out for the nearest bank. Forward
  // is (-sin yaw, -cos yaw), same as the velocity below.
  private keepOutOfWater(world: World): void {
    // Probe from the body's own base, not from head height: a mob afloat in a
    // channel that has something solid over it (the mill's wheel logs sit
    // right above its stream) would otherwise sample the block above and
    // decide it was standing on dry land.
    const baseY = Math.floor(this.body.y);
    // A column counts as water when it's water at that level, or when the
    // footing one step down is — a stream cut below the bank reads as plain
    // air ahead, and they'd walk straight off into it.
    const columnIsWet = (x: number, z: number) => {
      const bx = Math.floor(x);
      const bz = Math.floor(z);
      const at = world.getBlock(bx, baseY, bz);
      if (isWater(at)) return true;
      return !isSolid(at) && isWater(world.getBlock(bx, baseY - 1, bz));
    };
    const ahead = (yaw: number, dist: number) =>
      columnIsWet(this.body.x - Math.sin(yaw) * dist, this.body.z - Math.cos(yaw) * dist);
    // A bank worth swimming to: solid footing at the swimmer's own level to
    // climb onto, with room above it. Testing for "dry" instead would accept
    // the mill's plank wall, and they'd paddle into it forever; testing for
    // "empty at my level" would reject the bank itself, since from down in
    // the water the bank block sits at exactly that height.
    const canLandAt = (yaw: number, dist: number) => {
      const bx = Math.floor(this.body.x - Math.sin(yaw) * dist);
      const bz = Math.floor(this.body.z - Math.cos(yaw) * dist);
      const footing = world.getBlock(bx, baseY, bz);
      const room = world.getBlock(bx, baseY + 1, bz);
      return isSolid(footing) && !isSolid(room) && !isWater(room);
    };

    if (columnIsWet(this.body.x, this.body.z)) {
      // Already wet: turn to the nearest bank we could climb out onto
      for (let i = 1; i <= 8; i++) {
        const yaw = this.yaw + (i * Math.PI) / 4;
        if (canLandAt(yaw, 1.3)) {
          this.yaw = yaw;
          this.targetYaw = yaw;
          this.walking = true;
          // Scramble up the bank. Bobbing at the surface never counts as
          // onGround, so the usual hop-over-an-obstacle jump can never fire
          // and the animal would paddle against the bank forever.
          this.body.vy = Math.max(this.body.vy, this.spec.jumpSpeed * 0.7);
          return;
        }
      }
      return; // no bank within reach — keep swimming and try again next tick
    }

    // Dry, but water right ahead: pull up short and turn away
    if (ahead(this.yaw, 0.9)) {
      this.targetYaw = this.yaw + Math.PI + (Math.random() - 0.5);
      this.walking = false;
    }
  }

  private updateFlying(world: World, dt: number, ctx: MobContext | undefined, chasing: boolean, speed: number): void {
    if (chasing && ctx) {
      // Fly straight at the player's head
      const dx = ctx.player.x - this.body.x;
      const dy = ctx.player.y + 1.5 - (this.body.y + 0.3);
      const dz = ctx.player.z - this.body.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      this.body.vx = (dx / len) * speed;
      this.body.vy = (dy / len) * speed;
      this.body.vz = (dz / len) * speed;
    } else {
      this.body.vx = -Math.sin(this.yaw) * speed;
      this.body.vz = -Math.cos(this.yaw) * speed;
      // Hover 2-4 blocks above the ground with a gentle bob
      let drop = 0;
      const bx = Math.floor(this.body.x);
      const bz = Math.floor(this.body.z);
      const by = Math.floor(this.body.y);
      while (drop < 5 && !isSolid(world.getBlock(bx, by - 1 - drop, bz))) drop++;
      if (drop >= 5) this.body.vy = -2;
      else if (drop <= 1) this.body.vy = 1.5;
      else this.body.vy = Math.sin(this.legPhase * 1.5) * 0.6;
    }
    stepBody(this.body, world, dt);
    if (this.body.hitWall) {
      this.body.vy = Math.max(this.body.vy, 2); // climb over obstacles
      if (!chasing) this.targetYaw = Math.random() * Math.PI * 2;
    }
    this.legPhase += dt * 6; // wings always beat
  }

  private tryTeleportToward(player: Body, world: World): boolean {
    const dx = this.body.x - player.x;
    const dz = this.body.z - player.z;
    const len = Math.hypot(dx, dz) || 1;
    // Land 3 blocks from the player, on our side
    const tx = player.x + (dx / len) * 3;
    const tz = player.z + (dz / len) * 3;
    const bx = Math.floor(tx);
    const bz = Math.floor(tz);
    for (let by = Math.floor(player.y) + 3; by >= Math.floor(player.y) - 4; by--) {
      if (
        isSolid(world.getBlock(bx, by - 1, bz)) &&
        !isSolid(world.getBlock(bx, by, bz)) &&
        !isSolid(world.getBlock(bx, by + 1, bz))
      ) {
        this.body.x = bx + 0.5;
        this.body.y = by + 0.01;
        this.body.z = bz + 0.5;
        this.body.vx = 0;
        this.body.vy = 0;
        this.body.vz = 0;
        return true;
      }
    }
    return false;
  }

  private updateEmissive(): void {
    const active = this.burning || this.hitFlashTimer > 0;
    if (!active && !this.emissiveDirty) return;
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material as THREE.MeshLambertMaterial;
      if (this.burning) {
        const flicker = 0.35 + 0.35 * Math.sin(this.burnTimer * 25);
        material.emissive.setRGB(flicker, flicker * 0.35, 0);
      } else if (this.hitFlashTimer > 0) {
        material.emissive.setRGB(0.8, 0.05, 0.05);
      } else {
        material.emissive.setRGB(0, 0, 0);
      }
    });
    this.emissiveDirty = active;
  }

  private syncTransform(): void {
    this.group.position.set(this.body.x, this.body.y, this.body.z);
    this.group.rotation.y = this.yaw;
    const swing = this.walking ? 0.55 : 0;
    this.legs.forEach((legMesh, i) => {
      legMesh.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * swing;
    });
    this.wings.forEach((wing, i) => {
      const base = (wing.userData.baseZ as number | undefined) ?? 0;
      wing.rotation.z = base + (i % 2 === 0 ? 1 : -1) * Math.sin(this.legPhase * 6) * 0.7;
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
