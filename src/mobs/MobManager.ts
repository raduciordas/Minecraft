import * as THREE from 'three';
import { CHUNK_HEIGHT } from '../config';
import { BlockType, isSolid } from '../world/Block';
import { worldToChunk } from '../world/World';
import type { World } from '../world/World';
import { Mob, type MobKind, type MobContext } from './Mob';

const DAY_CAP = 10;
const NIGHT_CAP = 14;
const SPAWN_INTERVAL = 1.5; // seconds between spawn attempts
const SPAWN_MIN_DIST = 14;
const SPAWN_MAX_DIST = 45;
const DESPAWN_DIST = 80;
const PASSIVE_KINDS: MobKind[] = ['pig', 'sheep'];

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

  update(dt: number, ctx: MobContext): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      const cap = ctx.isNight ? NIGHT_CAP : DAY_CAP;
      if (this.mobs.length < cap) this.trySpawn(ctx);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      // Sunrise sets the surviving zombies on fire
      if (mob.kind === 'zombie' && !ctx.isNight && !mob.burning) mob.burning = true;
      mob.update(this.world, dt, ctx);
      const dist = Math.hypot(mob.body.x - ctx.player.x, mob.body.z - ctx.player.z);
      if (mob.burnedOut || dist > DESPAWN_DIST || mob.body.y < -10) {
        this.remove(i);
      }
    }
  }

  // Also used by tests/debugging via the window.__game handle
  spawnMobAt(kind: MobKind, x: number, y: number, z: number): Mob {
    const mob = new Mob(kind, x, y, z);
    this.mobs.push(mob);
    this.scene.add(mob.group);
    return mob;
  }

  private remove(index: number): void {
    const mob = this.mobs[index];
    this.scene.remove(mob.group);
    mob.dispose();
    this.mobs.splice(index, 1);
  }

  private trySpawn(ctx: MobContext): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
    const wx = Math.floor(ctx.player.x + Math.cos(angle) * dist);
    const wz = Math.floor(ctx.player.z + Math.sin(angle) * dist);
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

    // Zombies rise at night; passive animals prefer daylight
    let kind: MobKind;
    if (ctx.isNight) {
      kind = Math.random() < 0.75 ? 'zombie' : PASSIVE_KINDS[Math.floor(Math.random() * 2)];
    } else {
      kind = PASSIVE_KINDS[Math.floor(Math.random() * 2)];
    }
    this.spawnMobAt(kind, wx + 0.5, groundY + 1.01, wz + 0.5);
  }
}
