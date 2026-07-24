import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { ToolId } from '../items/Tool';
import { VATRA_ORIGIN, LUNCA_ORIGIN, PADUREA_ORIGIN } from '../world/Structures';
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

// Gardul Luncii's 30-post gap, relative to the Lunca origin
const FENCE_DX = Array.from({ length: 30 }, (_, i) => i - 14);
// Câmpul de grâu's 6×4 tilled field
const FIELD_POS: [number, number, number][] = [];
for (let x = 20; x <= 25; x++) for (let z = -2; z <= 1; z++) FIELD_POS.push([x, 1, z]);
const MILL_FLOUR: [number, number, number] = [22, 1, 8];

// Pădurea's conditional-puzzle markers, relative to the Pădurea origin
const LANTERN_POTECA: [number, number, number] = [0, 3, -6];
const BRIDGE_RAIL: [number, number, number] = [0, 2, 3];
const TRAP_CENTER: [number, number, number] = [13, 1, -4];

const BUCKET_HIGH = 3.4;
const BUCKET_LOW = 1.3;

// Which puzzles live in Zona 2 (Lunca) or Zona 3 (Pădurea) rather than the
// Vatra square — their world positions are relative to a different origin.
const LUNCA_PUZZLES = new Set(['gard', 'camp_grau', 'moara']);
const PADUREA_PUZZLES = new Set(['poteca', 'pod', 'capcana']);

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
  gard: FENCE_DX.map((x) => ({ pos: [x, 1, -6] as [number, number, number], solved: BlockType.Log, unsolved: BlockType.Air })),
  camp_grau: FIELD_POS.map((pos) => ({ pos, solved: BlockType.Wheat, unsolved: BlockType.Dirt })),
  moara: [{ pos: MILL_FLOUR, solved: BlockType.Flour, unsolved: BlockType.Air }],
  poteca: [{ pos: LANTERN_POTECA, solved: BlockType.Lamp, unsolved: BlockType.Glass }],
  pod: [{ pos: BRIDGE_RAIL, solved: BlockType.Log, unsolved: BlockType.Air }],
  capcana: [{ pos: TRAP_CENTER, solved: BlockType.Hay, unsolved: BlockType.Plank }],
};

// A block queued to appear a beat after the previous one — the cascading
// "it builds itself" reveal for loop puzzles (fence posts, planted rows).
interface QueuedBlock {
  x: number;
  y: number;
  z: number;
  id: BlockType;
  revertTo: BlockType;
  delay: number;
}

interface Flying {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  floorY: number;
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
  private readonly lox = LUNCA_ORIGIN.x;
  private readonly loz = LUNCA_ORIGIN.z;
  private readonly lunGroundY: number;
  private readonly pox = PADUREA_ORIGIN.x;
  private readonly poz = PADUREA_ORIGIN.z;
  private readonly paduGroundY: number;

  private done = new Set<string>();
  private effectsApplied = false;
  private lunEffectsApplied = false;
  private padEffectsApplied = false;

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
  private revertPuzzleId: string | null = null;

  // Loop-puzzle build animation: blocks reveal one at a time (buildQueue),
  // and every block placed mid-run is tracked (tempBlocks) so a failed
  // attempt can be wiped clean before the next one.
  private buildQueue: QueuedBlock[] = [];
  private tempBlocks: { x: number; y: number; z: number; revertTo: BlockType }[] = [];

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private sound: SoundManager,
    private inventory: Inventory,
    private setBlock: (x: number, y: number, z: number, id: number) => void,
  ) {
    this.groundY = world.generator.heightAt(this.ox, this.oz);
    this.lunGroundY = world.generator.heightAt(this.lox, this.loz);
    this.paduGroundY = world.generator.heightAt(this.pox, this.poz);
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
    this.buildMumaPadurii();
  }

  // Muma Pădurii: a gaunt forest-witch figure watching over her threshold
  private buildMumaPadurii(): void {
    const npc = new THREE.Group();
    box(npc, 0.46, 0.85, 0.34, 0x2e3a24, 0, 1.1, 0); // dark mossy robe
    const head = box(npc, 0.34, 0.34, 0.34, 0xb8a888, 0, 1.86, 0);
    box(head, 0.4, 0.12, 0.4, 0x3a2e1a, 0, 0.2, 0); // twiggy hood band
    for (const side of [-1, 1]) {
      box(npc, 0.1, 0.5, 0.1, 0x4a3a24, side * 0.3, 0.6, -0.1); // gnarled arms
    }
    npc.position.set(this.pox - 6 + 0.5, this.paduGroundY + 1, this.poz - 6 + 0.5);
    npc.rotation.y = Math.PI / 3; // facing the lantern
    this.scene.add(npc);
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
    if (dy >= 0 && dy <= 5) {
      if (dx >= -1 && dx <= 1 && dz >= -1 && dz <= 4) return 'fantana';
      if (dx >= -8 && dx <= -4 && dz >= -2 && dz <= 1) return 'cuptor';
      if (dx >= 3 && dx <= 13 && dz >= -1 && dz <= 1) return 'ulita';
      if (dx >= -9 && dx <= -5 && dz >= -8 && dz <= -6) return 'fierarie';
      if (dx >= -3 && dx <= 3 && dz >= -8 && dz <= -5) return 'grajd';
      if (dx >= 5 && dx <= 10 && dz >= -8 && dz <= -5) return 'spalatorie';
    }

    const lx = bx - this.lox;
    const ly = by - this.lunGroundY;
    const lz = bz - this.loz;
    if (ly >= 0 && ly <= 5) {
      if (lx >= -15 && lx <= 16 && lz >= -6 && lz <= -6) return 'gard';
      if (lx >= 20 && lx <= 25 && lz >= -2 && lz <= 1) return 'camp_grau';
      if (lx >= 19 && lx <= 24 && lz >= 6 && lz <= 10) return 'moara';
    }

    const px = bx - this.pox;
    const py = by - this.paduGroundY;
    const pz = bz - this.poz;
    if (py >= 0 && py <= 5) {
      if (px >= -8 && px <= 8 && pz >= -8 && pz <= -5) return 'poteca';
      if (px >= -3 && px <= 3 && pz >= 0 && pz <= 6) return 'pod';
      if (px >= 10 && px <= 16 && pz >= -8 && pz <= -2) return 'capcana';
    }
    return null;
  }

  // The whole square is protected from mining so the puzzles stay intact
  isProtected(bx: number, by: number, bz: number): boolean {
    const dx = bx - this.ox;
    const dy = by - this.groundY;
    const dz = bz - this.oz;
    if (dx >= -10 && dx <= 16 && dz >= -9 && dz <= 7 && dy >= 0 && dy <= 8) return true;

    const lx = bx - this.lox;
    const ly = by - this.lunGroundY;
    const lz = bz - this.loz;
    if (lx >= -16 && lx <= 26 && lz >= -7 && lz <= 11 && ly >= 0 && ly <= 6) return true;

    const px = bx - this.pox;
    const py = by - this.paduGroundY;
    const pz = bz - this.poz;
    return px >= -9 && px <= 17 && pz >= -9 && pz <= 7 && py >= 0 && py <= 6;
  }

  isDone(puzzleId: string): boolean {
    return this.done.has(puzzleId);
  }

  beginRun(puzzleId: string): void {
    // Wipe any half-built leftovers from a previous failed loop-puzzle run
    this.buildQueue = [];
    this.clearTempBlocks();

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
    } else if (puzzleId === 'gard') {
      if (blockId === 'repeta_30') {
        this.queueBuild(this.lox, this.loz, FENCE_DX.map((x) => [x, 1, -6]), BlockType.Log, BlockType.Air);
        this.sound.place();
      } else if (blockId === 'repeta_3') {
        this.queueBuild(this.lox, this.loz, FENCE_DX.slice(0, 3).map((x) => [x, 1, -6]), BlockType.Log, BlockType.Air);
        this.sound.place();
      } else if (blockId === 'repeta_300') {
        const overshoot: [number, number, number][] = FENCE_DX.map((x) => [x, 1, -6]);
        for (let x = 17; x <= 31; x++) overshoot.push([x, 1, -6]); // "peste deal, prin curtea vecinului"
        this.queueBuild(this.lox, this.loz, overshoot, BlockType.Log, BlockType.Air);
        this.sound.place();
      } else if (blockId === 'prinde_capatul') {
        this.spawnFlyingBits(this.lox + 16 + 0.5, this.lunGroundY + 2, this.loz - 6 + 0.5, 0x8a6a3a, 2, this.lunGroundY);
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'camp_grau') {
      if (blockId === 'planteaza_spic') {
        this.queueBuild(this.lox, this.loz, FIELD_POS, BlockType.Wheat, BlockType.Dirt, 0.03);
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'moara') {
      if (blockId === 'porneste_apa') {
        this.sound.splash();
      } else if (blockId === 'macina') {
        this.queueBuild(this.lox, this.loz, [MILL_FLOUR], BlockType.Flour, BlockType.Air);
        this.spawnSmoke(this.lox + 22 + 0.5, this.lunGroundY + 2, this.loz + 8 + 0.5, 0xe8e0d0, 0.2);
        this.sound.place();
      } else if (blockId === 'opreste_apa') {
        this.sound.splash();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'poteca') {
      if (blockId.includes('aprinde')) {
        this.queueBuild(this.pox, this.poz, [LANTERN_POTECA], BlockType.Lamp, BlockType.Glass, 0);
        this.sound.place();
      } else if (blockId === 'altfel_stinge') {
        this.queueBuild(this.pox, this.poz, [LANTERN_POTECA], BlockType.Glass, BlockType.Glass, 0);
        this.sound.stepTick();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'pod') {
      if (blockId.includes('ridica')) {
        this.queueBuild(this.pox, this.poz, [BRIDGE_RAIL], BlockType.Log, BlockType.Air);
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'capcana') {
      if (blockId.includes('prinde')) {
        this.queueBuild(this.pox, this.poz, [TRAP_CENTER], BlockType.Hay, BlockType.Plank);
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    }
  }

  // Schedule a cascading block reveal (fence posts, planted rows…) — a beat
  // apart so the loop's repetition is visible, not instantaneous.
  private queueBuild(
    originX: number,
    originZ: number,
    positions: [number, number, number][],
    id: BlockType,
    revertTo: BlockType,
    stagger = 0.05,
  ): void {
    let groundY = this.groundY;
    if (originX === this.lox && originZ === this.loz) groundY = this.lunGroundY;
    else if (originX === this.pox && originZ === this.poz) groundY = this.paduGroundY;
    positions.forEach(([dx, dy, dz], i) => {
      this.buildQueue.push({
        x: originX + dx,
        y: groundY + dy,
        z: originZ + dz,
        id,
        revertTo,
        delay: i * stagger,
      });
    });
  }

  // Places every still-pending queued block immediately — called before
  // evaluating the program so nothing is left mid-cascade.
  private flushBuildQueue(): void {
    for (const q of this.buildQueue) {
      this.setBlock(q.x, q.y, q.z, q.id);
      this.tempBlocks.push({ x: q.x, y: q.y, z: q.z, revertTo: q.revertTo });
    }
    this.buildQueue = [];
  }

  // Wipes every block placed during the current/last loop-puzzle attempt
  // back to its pre-attempt state (Air for a fence gap, Dirt for a field…).
  private clearTempBlocks(): void {
    for (const t of this.tempBlocks) this.setBlock(t.x, t.y, t.z, t.revertTo);
    this.tempBlocks = [];
  }

  // Program ended: evaluate, play the success/fail act, grant one-time rewards
  finish(puzzleId: string, program: string[]): { success: boolean; text: string } {
    this.flushBuildQueue(); // land any still-cascading blocks before judging
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
    if (fail.anim === 'splash') this.splashFail();
    if (fail.anim === 'dark') {
      this.revertTimer = 1.2; // the lit lanterns (or a loop puzzle's build) flicker back out
      this.revertPuzzleId = puzzleId;
    }
    this.sound.failTrombone();
    return { success: false, text: fail.text };
  }

  private applySuccess(puzzleId: string): void {
    const firstTime = !this.done.has(puzzleId);
    this.applyEffects(puzzleId);
    this.tempBlocks = []; // whatever the loop just built is now permanent — stop tracking it for revert
    if (puzzleId === 'cuptor') this.spawnFlyingBits(this.ox - 6 + 0.5, this.groundY + 2.3, this.oz + 1.2, 0xc98d3a, 3);
    if (puzzleId === 'fierarie') this.spawnFlyingBits(this.ox - 7 + 0.5, this.groundY + 2.3, this.oz - 6 + 0.5, 0xb0b0b0, 1);
    if (puzzleId === 'grajd') this.spawnFlyingBits(this.ox + 0.5, this.groundY + 1.3, this.oz - 6 + 0.5, 0xd9c27a, 2);
    if (puzzleId === 'spalatorie') this.spawnFlyingBits(this.ox + 6 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, 0xe8e8e8, 2);
    if (puzzleId === 'gard') this.spawnFlyingBits(this.lox + 0.5, this.lunGroundY + 1.3, this.loz - 6 + 0.5, 0xf0ece0, 3, this.lunGroundY);
    if (puzzleId === 'camp_grau') this.spawnFlyingBits(this.lox + 22 + 0.5, this.lunGroundY + 1.3, this.loz - 0.5, 0xd8b840, 3, this.lunGroundY);
    if (puzzleId === 'moara') this.spawnFlyingBits(this.lox + 22 + 0.5, this.lunGroundY + 2, this.loz + 8 + 0.5, 0xe8e0d0, 2, this.lunGroundY);
    if (puzzleId === 'poteca') this.spawnFlyingBits(this.pox + 0.5, this.paduGroundY + 2.2, this.poz - 6 + 0.5, 0xffe14d, 2, this.paduGroundY);
    if (puzzleId === 'pod') this.spawnFlyingBits(this.pox + 0.5, this.paduGroundY + 2, this.poz + 3 + 0.5, 0x8a6a3a, 2, this.paduGroundY);
    if (puzzleId === 'capcana') this.spawnFlyingBits(this.pox + 13 + 0.5, this.paduGroundY + 1.3, this.poz - 4 + 0.5, 0xd9c27a, 2, this.paduGroundY);
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
      case 'gard':
        this.inventory.add(BlockType.Wool, 10);
        break;
      case 'camp_grau':
        this.inventory.add(BlockType.Wheat, 12);
        break;
      case 'moara':
        this.inventory.add(BlockType.Flour, 14);
        break;
      case 'poteca':
        this.inventory.add(BlockType.Mushroom, 8);
        break;
      case 'pod':
        this.inventory.add(BlockType.RiverStone, 10);
        break;
      case 'capcana':
        this.inventory.add(BlockType.Wool, 10);
        this.inventory.add(BlockType.DacianGold, 3);
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

  // Zona 1 (Vatra), Zona 2 (Lunca) and Zona 3 (Pădurea) puzzles each use a
  // different world origin
  private originFor(puzzleId: string): [number, number, number] {
    if (LUNCA_PUZZLES.has(puzzleId)) return [this.lox, this.lunGroundY, this.loz];
    if (PADUREA_PUZZLES.has(puzzleId)) return [this.pox, this.paduGroundY, this.poz];
    return [this.ox, this.groundY, this.oz];
  }

  private applyEffects(puzzleId: string): void {
    const [ox, gy, oz] = this.originFor(puzzleId);
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(ox + e.pos[0], gy + e.pos[1], oz + e.pos[2], e.solved);
    }
  }

  private revertEffects(puzzleId: string): void {
    const [ox, gy, oz] = this.originFor(puzzleId);
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(ox + e.pos[0], gy + e.pos[1], oz + e.pos[2], e.unsolved);
    }
  }

  // Reusable flying-prop flourish (colaci, a horseshoe, hay, laundry…)
  private spawnFlyingBits(x: number, y: number, z: number, color: number, count: number, floorY = this.groundY): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.22),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.flyings.push({ mesh, vx: (Math.random() - 0.5) * 2, vy: 3.5 + i, vz: 2.5 + Math.random(), life: 2.2, floorY });
    }
  }

  // The flagship comic fail: a smoking coal boulder (or a puff of dry flour
  // dust for the mill) shoots out of the mechanism that ran without fuel
  private coalFail(puzzleId: string): void {
    let x: number, y: number, z: number, floorY: number;
    if (puzzleId === 'fierarie') [x, y, z, floorY] = [this.ox - 7 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, this.groundY];
    else if (puzzleId === 'moara') [x, y, z, floorY] = [this.lox + 22 + 0.5, this.lunGroundY + 2.3, this.loz + 8 + 0.5, this.lunGroundY];
    else [x, y, z, floorY] = [this.ox - 6 + 0.5, this.groundY + 2.3, this.oz + 1.2, this.groundY];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.flyings.push({ mesh, vx: 0, vy: 5, vz: 4, life: 2.5, floorY });
    for (let i = 0; i < 4; i++) {
      this.spawnSmoke(x, y + 0.1 + i * 0.2, z, 0x333333, 0.3);
    }
  }

  // The bridge's comic fail: a cart tumbles into the river with a splash
  private splashFail(): void {
    const x = this.pox + 0.5;
    const y = this.paduGroundY + 1.6;
    const z = this.poz + 3 + 0.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x6b4a26 }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.flyings.push({ mesh, vx: 0.5, vy: 3, vz: 0, life: 1.8, floorY: this.paduGroundY });
    for (let i = 0; i < 3; i++) {
      this.spawnSmoke(x, this.paduGroundY + 0.5, z, 0x3a78d8, 0.22);
    }
    this.sound.splash();
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
      if (f.mesh.position.y < f.floorY + 1.1 && f.vy < 0) f.vy = -f.vy * 0.35; // bounce
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

    // Cascading loop-puzzle build: reveal each queued block a beat apart
    for (let i = this.buildQueue.length - 1; i >= 0; i--) {
      const q = this.buildQueue[i];
      q.delay -= dt;
      if (q.delay <= 0) {
        this.setBlock(q.x, q.y, q.z, q.id);
        this.tempBlocks.push({ x: q.x, y: q.y, z: q.z, revertTo: q.revertTo });
        this.buildQueue.splice(i, 1);
      }
    }

    // Failed run: the lit lanterns (or a loop puzzle's fresh build) revert after a beat
    if (this.revertTimer > 0) {
      this.revertTimer -= dt;
      if (this.revertTimer <= 0) {
        if (this.revertPuzzleId === 'ulita' && !this.done.has('ulita')) {
          for (let i = 0; i < this.litCount && i < LANTERNS.length; i++) {
            const [lx, ldy, lz] = LANTERNS[i];
            if (this.world.getBlock(this.ox + lx, this.groundY + ldy, this.oz + lz) === BlockType.Lamp) {
              this.setBlock(this.ox + lx, this.groundY + ldy, this.oz + lz, BlockType.Glass);
            }
          }
          this.litCount = 0;
        } else {
          this.clearTempBlocks();
        }
        this.revertPuzzleId = null;
      }
    }

    // Once the vatra chunk is loaded, re-apply the persistent state of any
    // already-solved puzzles (water in the trough, lit lanterns, embers…)
    if (!this.effectsApplied && this.world.getBlock(this.ox, this.groundY, this.oz) !== BlockType.Air) {
      this.effectsApplied = true;
      for (const puzzleId of Object.keys(PUZZLE_EFFECTS)) {
        if (!LUNCA_PUZZLES.has(puzzleId) && !PADUREA_PUZZLES.has(puzzleId) && this.done.has(puzzleId)) {
          this.applyEffects(puzzleId);
        }
      }
    }
    // Same, once the Lunca chunk is loaded, for its own puzzles
    if (!this.lunEffectsApplied && this.world.getBlock(this.lox, this.lunGroundY, this.loz) !== BlockType.Air) {
      this.lunEffectsApplied = true;
      for (const puzzleId of LUNCA_PUZZLES) {
        if (this.done.has(puzzleId)) this.applyEffects(puzzleId);
      }
    }
    // Same, once the Pădurea chunk is loaded, for its own puzzles
    if (!this.padEffectsApplied && this.world.getBlock(this.pox, this.paduGroundY, this.poz) !== BlockType.Air) {
      this.padEffectsApplied = true;
      for (const puzzleId of PADUREA_PUZZLES) {
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
