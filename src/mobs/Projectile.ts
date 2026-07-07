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

// A thrown bottle of țuică: lobbed like a potion, arcs under gravity, and
// shatters on the first mob or solid block it touches.
class Bottle {
  readonly mesh: THREE.Group;
  removeMe = false;
  private vx: number;
  private vy: number;
  private vz: number;
  private life = 0;

  constructor(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number) {
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    this.vx = (dirX / len) * BOTTLE_SPEED;
    this.vy = (dirY / len) * BOTTLE_SPEED;
    this.vz = (dirZ / len) * BOTTLE_SPEED;

    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a441 }),
    );
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 0.14, 8),
      new THREE.MeshLambertMaterial({ color: 0x6b8f4e }),
    );
    glass.position.y = 0.14;
    this.mesh.add(body, glass);
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

// A quick expanding, fading flash where a bottle detonated.
class Explosion {
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  private age = 0;

  constructor(x: number, y: number, z: number) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 }),
    );
    this.mesh.position.set(x, y, z);
    this.light = new THREE.PointLight(0xff9a3a, 4, 8, 1);
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
  private explosions: Explosion[] = [];

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.fireballs.length;
  }

  spawnFireball(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number): void {
    const fb = new Fireball(x, y, z, dirX, dirY, dirZ, damage);
    this.fireballs.push(fb);
    this.scene.add(fb.mesh);
  }

  spawnBottle(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number): void {
    const bottle = new Bottle(x, y, z, dirX, dirY, dirZ);
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
  updateBottles(dt: number, world: World, mobs: readonly Mob[], onExplode: (x: number, y: number, z: number) => void): void {
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
        onExplode(bottle.x, bottle.y, bottle.z);
        this.spawnExplosion(bottle.x, bottle.y, bottle.z);
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

  private spawnExplosion(x: number, y: number, z: number): void {
    const explosion = new Explosion(x, y, z);
    this.explosions.push(explosion);
    this.scene.add(explosion.mesh, explosion.light);
  }
}
