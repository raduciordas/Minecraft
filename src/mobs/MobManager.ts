import * as THREE from 'three';
import { CHUNK_HEIGHT } from '../config';
import { BlockType, isSolid } from '../world/Block';
import { worldToChunk } from '../world/World';
import type { World } from '../world/World';
import type { Body } from '../player/Physics';
import { Mob, type MobKind } from './Mob';

const MOB_CAP = 12;
const SPAWN_INTERVAL = 1.5; // seconds between spawn attempts
const SPAWN_MIN_DIST = 14;
const SPAWN_MAX_DIST = 45;
const DESPAWN_DIST = 80;
const KINDS: MobKind[] = ['pig', 'sheep', 'zombie'];

export class MobManager {
  private mobs: Mob[] = [];
  private spawnTimer = 0;

  constructor(
    private scene: THREE.Scene,
    private world: World,
  ) {}

  get count(): number {
    return this.mobs.length;
  }

  update(dt: number, player: Body): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      if (this.mobs.length < MOB_CAP) this.trySpawn(player);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update(this.world, dt);
      const dist = Math.hypot(mob.body.x - player.x, mob.body.z - player.z);
      if (dist > DESPAWN_DIST || mob.body.y < -10) {
        this.scene.remove(mob.group);
        mob.dispose();
        this.mobs.splice(i, 1);
      }
    }
  }

  private trySpawn(player: Body): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
    const wx = Math.floor(player.x + Math.cos(angle) * dist);
    const wz = Math.floor(player.z + Math.sin(angle) * dist);
    if (!this.world.hasChunk(worldToChunk(wx), worldToChunk(wz))) return;

    // Topmost solid block of the column
    let groundY = -1;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.world.getBlock(wx, y, wz))) {
        groundY = y;
        break;
      }
    }
    if (groundY < 0) return;
    // Grass only (keeps mobs on dry land) with 2 blocks of air above
    if (this.world.getBlock(wx, groundY, wz) !== BlockType.Grass) return;
    if (this.world.getBlock(wx, groundY + 1, wz) !== BlockType.Air) return;
    if (this.world.getBlock(wx, groundY + 2, wz) !== BlockType.Air) return;

    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const mob = new Mob(kind, wx + 0.5, groundY + 1.01, wz + 0.5);
    this.mobs.push(mob);
    this.scene.add(mob.group);
  }
}
