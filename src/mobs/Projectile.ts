import * as THREE from 'three';
import { isSolid } from '../world/Block';
import type { World } from '../world/World';
import type { Body } from '../player/Physics';

const SPEED = 14;
const MAX_LIFETIME = 5;
const HIT_RADIUS = 1.0;

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

export class ProjectileManager {
  private fireballs: Fireball[] = [];

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.fireballs.length;
  }

  spawnFireball(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number, damage: number): void {
    const fb = new Fireball(x, y, z, dirX, dirY, dirZ, damage);
    this.fireballs.push(fb);
    this.scene.add(fb.mesh);
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
}
