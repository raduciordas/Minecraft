import * as THREE from 'three';
import { GRAVITY } from '../config';
import { isSolid } from '../world/Block';
import type { World } from '../world/World';
import type { Body } from '../player/Physics';
import type { Mob } from './Mob';

const SPEED = 14;
const MAX_LIFETIME = 5;
const HIT_RADIUS = 1.0;

const BOTTLE_SPEED = 16;
const BOTTLE_MOB_RADIUS = 0.9;
const EXPLOSION_LIFETIME = 0.35;

// A Zmeu's fireball: a small glowing sphere that flies straight, burns
// whatever it hits, and disappears on impact with terrain or the player.
export class Fireball {
  readonly mesh: THREE.Mesh;
  readonly damage: number;
  removeMe = false;
  private vx: number;
  private vy: number;
  private vz: number;
  private life = 0;

  constructor(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number) {
    this.damage = damage;
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    this.vx = (dirX / len) * SPEED;
    this.vy = (dirY / len) * SPEED;
    this.vz = (dirZ / len) * SPEED;

    const geometry = new THREE.SphereGeometry(0.22, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
  }

  get x(): number {
    return this.mesh.position.x;
  }
  get y(): number {
    return this.mesh.position.y;
  }
  get z(): number {
    return this.mesh.position.z;
  }

  update(dt: number, world: World): void {
    this.life += dt;
    if (this.life > MAX_LIFETIME) {
      this.removeMe = true;
      return;
    }
    const nx = this.mesh.position.x + this.vx * dt;
    const ny = this.mesh.position.y + this.vy * dt;
    const nz = this.mesh.position.z + this.vz * dt;
    if (isSolid(world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
      this.removeMe = true;
      return;
    }
    this.mesh.position.set(nx, ny, nz);
    this.mesh.rotation.x += dt * 10;
    this.mesh.rotation.y += dt * 7;
  }
}

export type ThrowableShape = 'bottle' | 'gum' | 'stone' | 'jar';

// A thrown bottle (or gum piece): lobbed like a potion, arcs under gravity,
// and shatters (or pops) on the first mob or solid block it touches.
class Bottle {
  readonly mesh: THREE.Group;
  readonly shape: ThrowableShape;
  readonly blastRadius: number;
  readonly damage?: number;
  readonly burns?: boolean;
  removeMe = false;
  private vx: number;
  private vy: number;
  private vz: number;
  private life = 0;

  constructor(
    x: number, y: number, z: number,
    dirX: number, dirY: number, dirZ: number,
    shape: ThrowableShape, blastRadius: number, damage?: number, burns?: boolean,
  ) {
    this.shape = shape;
    this.blastRadius = blastRadius;
    this.damage = damage;
    this.burns = burns;
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    this.vx = (dirX / len) * BOTTLE_SPEED;
    this.vy = (dirY / len) * BOTTLE_SPEED;
    this.vz = (dirZ / len) * BOTTLE_SPEED;

    this.mesh = new THREE.Group();
    if (shape === 'gum') {
      const gum = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xff6fa8 }),
      );
      this.mesh.add(gum);
    } else if (shape === 'stone') {
      this.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), new THREE.MeshLambertMaterial({ color: 0x8a8a88 })));
    } else if (shape === 'jar') {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0xa0522d }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
      glow.position.y = 0.14;
      this.mesh.add(jar, glow);
    } else {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xe6d9a3 }),
      );
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, 0.14, 8),
        new THREE.MeshLambertMaterial({ color: 0x9fbf8a }),
      );
      glass.position.y = 0.14;
      this.mesh.add(body, glass);
    }
    this.mesh.position.set(x, y, z);
  }

  get x(): number { return this.mesh.position.x; }
  get y(): number { return this.mesh.position.y; }
  get z(): number { return this.mesh.position.z; }

  update(dt: number, world: World): void {
    this.life += dt;
    if (this.life > MAX_LIFETIME) {
      this.removeMe = true;
      return;
    }
    this.vy += GRAVITY * dt;
    const nx = this.mesh.position.x + this.vx * dt;
    const ny = this.mesh.position.y + this.vy * dt;
    const nz = this.mesh.position.z + this.vz * dt;
    if (isSolid(world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
      this.removeMe = true;
      return;
    }
    this.mesh.position.set(nx, ny, nz);
    this.mesh.rotation.x += dt * 14;
  }
}

// The player's arrow (Arc cu săgeți): flies straight and fast, drops a
// little, and hurts the first mob it meets
const ARROW_SPEED = 30;
const ARROW_GRAVITY = -6;
const ARROW_MOB_RADIUS = 0.9;

class Arrow {
  readonly mesh: THREE.Group;
  readonly damage: number;
  removeMe = false;
  private vx: number;
  private vy: number;
  private vz: number;
  private life = 0;

  constructor(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number) {
    this.damage = damage;
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    this.vx = (dirX / len) * ARROW_SPEED;
    this.vy = (dirY / len) * ARROW_SPEED;
    this.vz = (dirZ / len) * ARROW_SPEED;
    this.mesh = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.6), new THREE.MeshLambertMaterial({ color: 0xa07a48 }));
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
    tip.position.z = -0.32;
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.1), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    fletch.position.z = 0.26;
    this.mesh.add(shaft, tip, fletch);
    this.mesh.position.set(x, y, z);
    this.orient();
  }

  get x(): number { return this.mesh.position.x; }
  get y(): number { return this.mesh.position.y; }
  get z(): number { return this.mesh.position.z; }

  private orient(): void {
    const target = new THREE.Vector3(this.x + this.vx, this.y + this.vy, this.z + this.vz);
    this.mesh.lookAt(target);
    this.mesh.rotateY(Math.PI); // the model's tip points down -Z
  }

  update(dt: number, world: World): void {
    this.life += dt;
    if (this.life > 3) {
      this.removeMe = true;
      return;
    }
    this.vy += ARROW_GRAVITY * dt;
    const nx = this.mesh.position.x + this.vx * dt;
    const ny = this.mesh.position.y + this.vy * dt;
    const nz = this.mesh.position.z + this.vz * dt;
    if (isSolid(world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
      this.removeMe = true;
      return;
    }
    this.mesh.position.set(nx, ny, nz);
    this.orient();
  }
}

// A quick expanding, fading flash where a bottle detonated (or a bubble
// where a gum piece popped).
class Explosion {
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  private age = 0;

  constructor(x: number, y: number, z: number, shape: ThrowableShape) {
    const color = shape === 'gum' ? 0xff8fc0 : 0xff8a2a;
    const lightColor = shape === 'gum' ? 0xff9fd0 : 0xff9a3a;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    this.mesh.position.set(x, y, z);
    this.light = new THREE.PointLight(lightColor, 4, 8, 1);
    this.light.position.set(x, y, z);
  }

  get done(): boolean {
    return this.age >= EXPLOSION_LIFETIME;
  }

  update(dt: number): void {
    this.age += dt;
    const p = Math.min(1, this.age / EXPLOSION_LIFETIME);
    const scale = 1 + p * 7;
    this.mesh.scale.setScalar(scale);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p);
    this.light.intensity = 4 * (1 - p);
  }
}

export class ProjectileManager {
  private fireballs: Fireball[] = [];
  private bottles: Bottle[] = [];
  private arrows: Arrow[] = [];
  private explosions: Explosion[] = [];

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.fireballs.length;
  }

  get arrowCount(): number {
    return this.arrows.length;
  }

  spawnArrow(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number): void {
    const arrow = new Arrow(x, y, z, dirX, dirY, dirZ, damage);
    this.arrows.push(arrow);
    this.scene.add(arrow.mesh);
  }

  // Flies every arrow, striking the first mob in its way
  updateArrows(dt: number, world: World, mobs: readonly Mob[], onHit: (mob: Mob, damage: number, dirX: number, dirZ: number) => void): void {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      const px = arrow.x;
      const pz = arrow.z;
      arrow.update(dt, world);
      if (!arrow.removeMe) {
        for (const mob of mobs) {
          if (mob.dying) continue;
          const d = Math.hypot(arrow.x - mob.body.x, arrow.y - (mob.body.y + mob.body.height * 0.5), arrow.z - mob.body.z);
          if (d < ARROW_MOB_RADIUS + mob.body.halfWidth * 0.5) {
            onHit(mob, arrow.damage, arrow.x - px, arrow.z - pz);
            arrow.removeMe = true;
            break;
          }
        }
      }
      if (arrow.removeMe) {
        this.scene.remove(arrow.mesh);
        arrow.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        this.arrows.splice(i, 1);
      }
    }
  }

  spawnFireball(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number): void {
    const fb = new Fireball(x, y, z, dirX, dirY, dirZ, damage);
    this.fireballs.push(fb);
    this.scene.add(fb.mesh);
  }

  spawnBottle(
    x: number, y: number, z: number,
    dirX: number, dirY: number, dirZ: number,
    shape: ThrowableShape, blastRadius: number, damage?: number, burns?: boolean,
  ): void {
    const bottle = new Bottle(x, y, z, dirX, dirY, dirZ, shape, blastRadius, damage, burns);
    this.bottles.push(bottle);
    this.scene.add(bottle.mesh);
  }

  update(dt: number, world: World, player: Body, onHitPlayer: (damage: number) => void, onImpact: () => void): void {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.update(dt, world);
      if (!fb.removeMe) {
        const d = Math.hypot(fb.x - player.x, fb.y - (player.y + 0.9), fb.z - player.z);
        if (d < HIT_RADIUS) {
          onHitPlayer(fb.damage);
          fb.removeMe = true;
        }
      }
      if (fb.removeMe) {
        onImpact();
        this.scene.remove(fb.mesh);
        fb.mesh.geometry.dispose();
        (fb.mesh.material as THREE.Material).dispose();
        this.fireballs.splice(i, 1);
      }
    }
  }

  // Flies every thrown bottle forward, shattering (and calling onExplode) on
  // the first mob or solid block it touches.
  updateBottles(
    dt: number,
    world: World,
    mobs: readonly Mob[],
    onExplode: (x: number, y: number, z: number, blastRadius: number, damage?: number, burns?: boolean) => void,
  ): void {
    for (let i = this.bottles.length - 1; i >= 0; i--) {
      const bottle = this.bottles[i];
      bottle.update(dt, world);
      if (!bottle.removeMe) {
        for (const mob of mobs) {
          if (mob.dying) continue;
          const d = Math.hypot(bottle.x - mob.body.x, bottle.y - (mob.body.y + mob.body.height * 0.5), bottle.z - mob.body.z);
          if (d < BOTTLE_MOB_RADIUS) {
            bottle.removeMe = true;
            break;
          }
        }
      }
      if (bottle.removeMe) {
        onExplode(bottle.x, bottle.y, bottle.z, bottle.blastRadius, bottle.damage, bottle.burns);
        this.spawnExplosion(bottle.x, bottle.y, bottle.z, bottle.shape);
        this.scene.remove(bottle.mesh);
        bottle.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        this.bottles.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(dt);
      if (explosion.done) {
        this.scene.remove(explosion.mesh, explosion.light);
        explosion.mesh.geometry.dispose();
        (explosion.mesh.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      }
    }
  }

  private spawnExplosion(x: number, y: number, z: number, shape: ThrowableShape): void {
    const explosion = new Explosion(x, y, z, shape);
    this.explosions.push(explosion);
    this.scene.add(explosion.mesh, explosion.light);
  }
}
