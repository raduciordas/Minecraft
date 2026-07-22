import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { ToolId } from '../items/Tool';
import { VATRA_ORIGIN } from '../world/Structures';
import { VATRA_PUZZLES } from './VatraPuzzles';
import type { World } from '../world/World';
import type { Inventory } from '../player/Inventory';
import type { SoundManager } from '../Sound';

const SAVE_KEY = 'cuburia-vatra-v1';

// Lantern glass positions, relative to the vatra origin (dy above ground)
const LANTERNS: [number, number, number][] = [
  [4, 3, 1],
  [6, 3, 1],
  [8, 3, 1],
  [10, 3, 1],
  [12, 3, 1],
];
const TROUGH_Z = [2, 3, 4];
const OVEN_CAVITY: [number, number, number] = [-6, 2, 0];
const FORGE_CAVITY: [number, number, number] = [-7, 2, -7];
const STABLE_TROUGH: [number, number, number] = [0, 1, -6];
const LAUNDRY_SPOT: [number, number, number] = [6, 2, -7];

const BUCKET_HIGH = 3.4;
const BUCKET_LOW = 1.3;

// The persistent world change each puzzle makes on success, and what it
// reverts to when the lesson is reset — data-driven so both applying and
// undoing (and re-applying on world load) share one table.
interface PuzzleEffect {
  pos: [number, number, number];
  solved: BlockType;
  unsolved: BlockType;
}
const PUZZLE_EFFECTS: Record<string, PuzzleEffect[]> = {
  fantana: TROUGH_Z.map((z) => ({ pos: [0, 2, z], solved: BlockType.Water, unsolved: BlockType.Air })),
  cuptor: [{ pos: OVEN_CAVITY, solved: BlockType.Lamp, unsolved: BlockType.Air }],
  ulita: LANTERNS.map((pos) => ({ pos, solved: BlockType.Lamp, unsolved: BlockType.Glass })),
  fierarie: [{ pos: FORGE_CAVITY, solved: BlockType.Lamp, unsolved: BlockType.Air }],
  grajd: [{ pos: STABLE_TROUGH, solved: BlockType.Hay, unsolved: BlockType.Plank }],
  spalatorie: [{ pos: LAUNDRY_SPOT, solved: BlockType.IeBlouse, unsolved: BlockType.Air }],
};

interface Flying {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Smoke {
  mesh: THREE.Mesh;
  age: number;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Satul Codat, phase 0: six Vatra buildings as interactive coding puzzles
// (pure sequences — Zone 1 of the design doc). Owns the puzzle state (which
// are solved, persisted locally), the step-by-step 3D animations, the
// one-time rewards, and the ability to reset a solved lesson so it can be
// replayed. The Tabla de Blocuri UI drives it via beginRun/performStep/finish.
export class VatraModule {
  private readonly ox = VATRA_ORIGIN.x;
  private readonly oz = VATRA_ORIGIN.z;
  private readonly groundY: number;

  private done = new Set<string>();
  private effectsApplied = false;

  // Animation state
  private bucket: THREE.Group;
  private bucketWater: THREE.Mesh;
  private bucketTargetY: number;
  private ovenLight: THREE.PointLight;
  private forgeLight: THREE.PointLight;
  private flyings: Flying[] = [];
  private smokes: Smoke[] = [];
  private litCount = 0;
  private revertTimer = 0;

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private sound: SoundManager,
    private inventory: Inventory,
    private setBlock: (x: number, y: number, z: number, id: number) => void,
  ) {
    this.groundY = world.generator.heightAt(this.ox, this.oz);
    this.load();

    // The well bucket, hanging under the roof
    this.bucket = new THREE.Group();
    box(this.bucket, 0.3, 0.24, 0.3, 0x6b4a26, 0, 0, 0);
    this.bucketWater = box(this.bucket, 0.22, 0.06, 0.22, 0x3a78d8, 0, 0.14, 0);
    this.bucketWater.visible = false;
    this.bucketTargetY = this.groundY + BUCKET_HIGH;
    this.bucket.position.set(this.ox + 0.5, this.bucketTargetY, this.oz + 0.5);
    scene.add(this.bucket);

    // Oven fire glow (flares up on the "aprinde focul" step)
    this.ovenLight = new THREE.PointLight(0xff8a30, 0, 7, 1);
    this.ovenLight.position.set(this.ox - 6 + 0.5, this.groundY + 2.5, this.oz + 0.5);
    scene.add(this.ovenLight);

    // Forge fire glow (flares up on the "aprinde forja" step)
    this.forgeLight = new THREE.PointLight(0xff8a30, 0, 6, 1);
    this.forgeLight.position.set(this.ox - 7 + 0.5, this.groundY + 2.5, this.oz - 7 + 0.5);
    scene.add(this.forgeLight);

    this.buildBunicul();
  }

  // Bunicul Fierar: a static villager figure watching over the square
  private buildBunicul(): void {
    const npc = new THREE.Group();
    box(npc, 0.5, 0.75, 0.3, 0x6b4a2a, 0, 1.05, 0); // coat
    const head = box(npc, 0.42, 0.42, 0.42, 0xe0b088, 0, 1.66, 0);
    box(head, 0.3, 0.2, 0.06, 0xd8d8d0, 0, -0.16, -0.22); // beard
    box(head, 0.46, 0.1, 0.46, 0x3a2a1a, 0, 0.26, 0); // hat brim
    box(head, 0.3, 0.16, 0.3, 0x3a2a1a, 0, 0.36, 0); // hat top
    for (const side of [-1, 1]) {
      box(npc, 0.16, 0.7, 0.16, 0x4a3420, side * 0.14, 0.35, 0); // legs
    }
    npc.position.set(this.ox - 2 + 0.5, this.groundY + 1, this.oz + 3 + 0.5);
    npc.rotation.y = -Math.PI / 4; // facing the well
    this.scene.add(npc);
  }

  // Which puzzle (if any) the targeted block belongs to — drives right-click
  puzzleAt(bx: number, by: number, bz: number): string | null {
    const dx = bx - this.ox;
    const dy = by - this.groundY;
    const dz = bz - this.oz;
    if (dy < 0 || dy > 5) return null;
    if (dx >= -1 && dx <= 1 && dz >= -1 && dz <= 4) return 'fantana';
    if (dx >= -8 && dx <= -4 && dz >= -2 && dz <= 1) return 'cuptor';
    if (dx >= 3 && dx <= 13 && dz >= -1 && dz <= 1) return 'ulita';
    if (dx >= -9 && dx <= -5 && dz >= -8 && dz <= -6) return 'fierarie';
    if (dx >= -3 && dx <= 3 && dz >= -8 && dz <= -5) return 'grajd';
    if (dx >= 5 && dx <= 10 && dz >= -8 && dz <= -5) return 'spalatorie';
    return null;
  }

  // The whole square is protected from mining so the puzzles stay intact
  isProtected(bx: number, by: number, bz: number): boolean {
    const dx = bx - this.ox;
    const dy = by - this.groundY;
    const dz = bz - this.oz;
    return dx >= -10 && dx <= 16 && dz >= -9 && dz <= 7 && dy >= 0 && dy <= 8;
  }

  isDone(puzzleId: string): boolean {
    return this.done.has(puzzleId);
  }

  beginRun(puzzleId: string): void {
    if (puzzleId === 'fantana') {
      this.bucketTargetY = this.groundY + BUCKET_HIGH;
      this.bucketWater.visible = false;
    }
    if (puzzleId === 'ulita') this.litCount = 0;
    if (puzzleId === 'fierarie') this.forgeLight.intensity = 0;
  }

  // One program block executes: animate the matching mechanism
  performStep(puzzleId: string, blockId: string): void {
    if (puzzleId === 'fantana') {
      if (blockId === 'coboara') {
        this.bucketTargetY = this.groundY + BUCKET_LOW;
        this.sound.stepTick();
      } else if (blockId === 'umple') {
        // Only actually fills if the bucket is down the (dry-ish) well
        if (this.bucket.position.y < this.groundY + BUCKET_LOW + 0.4) {
          this.bucketWater.visible = true;
          this.sound.splash();
        } else {
          this.sound.stepTick();
        }
      } else if (blockId === 'urca') {
        this.bucketTargetY = this.groundY + BUCKET_HIGH;
        this.sound.stepTick();
      } else if (blockId === 'varsa') {
        this.bucketWater.visible = false;
        this.sound.stepTick();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'cuptor') {
      if (blockId === 'aprinde') {
        this.ovenLight.intensity = 3;
        this.sound.fireballCast();
      } else {
        this.spawnSmoke(this.ox - 6 + 0.5, this.groundY + 4.6, this.oz - 1 + 0.5, 0x9a9a9a, 0.18);
        this.sound.stepTick();
      }
    } else if (puzzleId === 'ulita') {
      if (blockId === 'aprinde_felinar' && this.litCount < LANTERNS.length) {
        const [lx, dy, lz] = LANTERNS[this.litCount];
        if (this.world.getBlock(this.ox + lx, this.groundY + dy, this.oz + lz) === BlockType.Glass) {
          this.setBlock(this.ox + lx, this.groundY + dy, this.oz + lz, BlockType.Lamp);
        }
        this.litCount++;
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'fierarie') {
      if (blockId === 'aprinde_forja') {
        this.forgeLight.intensity = 3;
        this.sound.fireballCast();
      } else if (blockId === 'loveste') {
        this.spawnSmoke(this.ox - 5 + 0.5, this.groundY + 2.3, this.oz - 5 + 0.5, 0xffb04a, 0.14);
        this.sound.clink();
      } else if (blockId === 'caleste') {
        this.sound.splash();
      } else if (blockId === 'pune_fier') {
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'grajd') {
      if (blockId === 'toarna_apa' || blockId === 'adu_apa') {
        this.sound.splash();
      } else if (blockId === 'deschide_poarta') {
        this.sound.doorToggle();
      } else if (blockId === 'pune_in_iesle') {
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'spalatorie') {
      if (blockId === 'inmoaie' || blockId === 'clateste') {
        this.sound.splash();
      } else if (blockId === 'intinde') {
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    }
  }

  // Program ended: evaluate, play the success/fail act, grant one-time rewards
  finish(puzzleId: string, program: string[]): { success: boolean; text: string } {
    const puzzle = VATRA_PUZZLES[puzzleId];
    const solved = program.length === puzzle.solution.length && program.every((b, i) => b === puzzle.solution[i]);

    if (solved) {
      this.applySuccess(puzzleId);
      this.sound.success();
      return { success: true, text: puzzle.success };
    }

    const fail = puzzle.fails.find((f) => f.matches(program)) ?? puzzle.fails[puzzle.fails.length - 1];
    if (fail.anim === 'coal') this.coalFail(puzzleId);
    if (fail.anim === 'bucket') this.bucketWater.visible = false;
    if (fail.anim === 'dark') this.revertTimer = 1.2; // the lit lanterns flicker back out
    this.sound.failTrombone();
    return { success: false, text: fail.text };
  }

  private applySuccess(puzzleId: string): void {
    const firstTime = !this.done.has(puzzleId);
    this.applyEffects(puzzleId);
    if (puzzleId === 'cuptor') this.spawnFlyingBits(this.ox - 6 + 0.5, this.groundY + 2.3, this.oz + 1.2, 0xc98d3a, 3);
    if (puzzleId === 'fierarie') this.spawnFlyingBits(this.ox - 7 + 0.5, this.groundY + 2.3, this.oz - 6 + 0.5, 0xb0b0b0, 1);
    if (puzzleId === 'grajd') this.spawnFlyingBits(this.ox + 0.5, this.groundY + 1.3, this.oz - 6 + 0.5, 0xd9c27a, 2);
    if (puzzleId === 'spalatorie') this.spawnFlyingBits(this.ox + 6 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, 0xe8e8e8, 2);
    if (firstTime) {
      this.grantReward(puzzleId);
      this.done.add(puzzleId);
      this.save();
    }
  }

  private grantReward(puzzleId: string): void {
    switch (puzzleId) {
      case 'fantana':
        this.inventory.add(BlockType.Chirpici, 8);
        break;
      case 'cuptor':
        this.inventory.add(BlockType.Mamaliga, 16);
        this.inventory.add(BlockType.Caramida, 4);
        break;
      case 'ulita':
        this.inventory.add(BlockType.Lamp, 4);
        this.inventory.add(BlockType.RiverStone, 6);
        break;
      case 'fierarie':
        this.inventory.add(ToolId.Tarnacop as unknown as BlockType, 1);
        this.inventory.add(BlockType.Stone, 4);
        break;
      case 'grajd':
        this.inventory.add(BlockType.Hay, 8);
        this.inventory.add(BlockType.RockSalt, 4);
        break;
      case 'spalatorie':
        this.inventory.add(BlockType.IeBlouse, 4);
        this.inventory.add(BlockType.RiverStone, 6);
        break;
    }
  }

  // Revert a solved lesson back to its unsolved state (world blocks +
  // completion flag) so it can be replayed from scratch, rewards and all.
  resetPuzzle(puzzleId: string): void {
    if (!this.done.has(puzzleId)) return;
    this.revertEffects(puzzleId);
    this.done.delete(puzzleId);
    this.save();
  }

  private applyEffects(puzzleId: string): void {
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(this.ox + e.pos[0], this.groundY + e.pos[1], this.oz + e.pos[2], e.solved);
    }
  }

  private revertEffects(puzzleId: string): void {
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(this.ox + e.pos[0], this.groundY + e.pos[1], this.oz + e.pos[2], e.unsolved);
    }
  }

  // Reusable flying-prop flourish (colaci, a horseshoe, hay, laundry…)
  private spawnFlyingBits(x: number, y: number, z: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.22),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.flyings.push({ mesh, vx: (Math.random() - 0.5) * 2, vy: 3.5 + i, vz: 2.5 + Math.random(), life: 2.2 });
    }
  }

  // The flagship comic fail: a smoking coal boulder shoots out of the oven/forge
  private coalFail(puzzleId: string): void {
    const [ox, oz] = puzzleId === 'fierarie' ? [this.ox - 7 + 0.5, this.oz - 7 + 0.5] : [this.ox - 6 + 0.5, this.oz + 1.2];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c }),
    );
    mesh.position.set(ox, this.groundY + 2.3, oz);
    this.scene.add(mesh);
    this.flyings.push({ mesh, vx: 0, vy: 5, vz: 4, life: 2.5 });
    for (let i = 0; i < 4; i++) {
      this.spawnSmoke(ox, this.groundY + 2.4 + i * 0.2, oz, 0x333333, 0.3);
    }
  }

  private spawnSmoke(x: number, y: number, z: number, color: number, size: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.smokes.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    // Bucket glides toward its target height
    const dy = this.bucketTargetY - this.bucket.position.y;
    if (Math.abs(dy) > 0.01) this.bucket.position.y += Math.sign(dy) * Math.min(Math.abs(dy), 2.5 * dt);

    // Oven / forge fire glow fades
    if (this.ovenLight.intensity > 0) this.ovenLight.intensity = Math.max(0, this.ovenLight.intensity - 2.2 * dt);
    if (this.forgeLight.intensity > 0) this.forgeLight.intensity = Math.max(0, this.forgeLight.intensity - 2.2 * dt);

    for (let i = this.flyings.length - 1; i >= 0; i--) {
      const f = this.flyings[i];
      f.vy -= 18 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      if (f.mesh.position.y < this.groundY + 1.1 && f.vy < 0) f.vy = -f.vy * 0.35; // bounce
      f.mesh.rotation.x += dt * 6;
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.flyings.splice(i, 1);
      }
    }

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.age += dt;
      s.mesh.position.y += dt * 1.2;
      s.mesh.scale.setScalar(1 + s.age * 2);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - s.age / 0.9));
      if (s.age >= 0.9) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.smokes.splice(i, 1);
      }
    }

    // Failed lane run: the lit lanterns flicker back out after a beat
    if (this.revertTimer > 0) {
      this.revertTimer -= dt;
      if (this.revertTimer <= 0 && !this.done.has('ulita')) {
        for (let i = 0; i < this.litCount && i < LANTERNS.length; i++) {
          const [lx, ldy, lz] = LANTERNS[i];
          if (this.world.getBlock(this.ox + lx, this.groundY + ldy, this.oz + lz) === BlockType.Lamp) {
            this.setBlock(this.ox + lx, this.groundY + ldy, this.oz + lz, BlockType.Glass);
          }
        }
        this.litCount = 0;
      }
    }

    // Once the vatra chunk is loaded, re-apply the persistent state of any
    // already-solved puzzles (water in the trough, lit lanterns, embers…)
    if (!this.effectsApplied && this.world.getBlock(this.ox, this.groundY, this.oz) !== BlockType.Air) {
      this.effectsApplied = true;
      for (const puzzleId of Object.keys(PUZZLE_EFFECTS)) {
        if (this.done.has(puzzleId)) this.applyEffects(puzzleId);
      }
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.done = new Set(JSON.parse(raw) as string[]);
    } catch {
      // corrupted or unavailable storage — start fresh
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify([...this.done]));
    } catch {
      // storage full/unavailable — progress lives only in this session
    }
  }
}
