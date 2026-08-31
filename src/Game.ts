import * as THREE from 'three';
import {
  RENDER_DISTANCE,
  WORLD_SEED,
  CHUNK_SIZE,
  REACH_DISTANCE,
  PHYSICS_STEP,
  MAX_STEPS_PER_FRAME,
  MESH_BUDGET_MS,
  SKY_COLOR,
  SAVE_INTERVAL_MS,
  STARTER_STOCK,
  MAX_PIXEL_RATIO,
  FALL_SAFE_SPEED,
  MULTIPLAYER_SERVER_URL,
  MOVE_SEND_INTERVAL,
  MAX_HP,
} from './config';
import { World, worldToChunk, chunkKey } from './world/World';
import type { Chunk } from './world/Chunk';
import { BlockType, isWater, isSolid, isDoor, toggleDoorId, requiresPickaxe, PLACEABLE_BLOCKS, BLOCKS } from './world/Block';
import { raycastVoxels } from './world/raycast';
import { TextureAtlas } from './rendering/TextureAtlas';
import { ChunkMeshManager } from './rendering/ChunkMeshManager';
import { LightManager } from './rendering/LightManager';
import { DoorRenderer } from './rendering/DoorRenderer';
import { MeltManager } from './world/MeltManager';
import { InputController } from './player/InputController';
import { Player } from './player/Player';
import { Inventory } from './player/Inventory';
import { blockIntersectsBody } from './player/Physics';
import { Hotbar } from './ui/Hotbar';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { CraftingPanel } from './ui/CraftingPanel';
import { LessonInfoPanel } from './ui/LessonInfoPanel';
import { HelpPanel } from './ui/HelpPanel';
import { VatraModule } from './vatra/VatraModule';
import { VATRA_PUZZLES, type ProgramNode } from './vatra/VatraPuzzles';
import type { BlocklyCallbacks, BlocklyPanel } from './ui/BlocklyPanel';
import { TouchControls } from './ui/TouchControls';
import { HealthHud } from './ui/HealthHud';
import { loadSave, writeSave } from './SaveManager';
import { MobManager } from './mobs/MobManager';
import type { Mob, MobKind } from './mobs/Mob';
import { ProjectileManager } from './mobs/Projectile';
import { DayNightCycle } from './DayNightCycle';
import { Health } from './player/Health';
import { SoundManager } from './Sound';
import { WEAPONS, WeaponId, isWeapon } from './items/Weapon';
import { THROWABLES, THROWABLE_IDS, ThrowableId, isThrowable } from './items/Throwable';
import { ToolId, isTool } from './items/Tool';
import { buildHeldItem, disposeModel } from './items/HeldItem';
import { NetworkClient, resolveServerUrl } from './net/NetworkClient';
import type { BlockEditEvent, MoveEvent, RemotePlayerState } from './net/NetworkClient';
import { RemotePlayerManager } from './net/RemotePlayer';

const THROWABLE_STARTER_STOCK = 20;

// A lesson left untouched this long closes itself and frees the spot for the
// next player. Must stay at or below the server's own expiry (server/index.mjs)
// so the polite client-side close always beats the server sweeping the lock.
const LESSON_IDLE_MS = 60_000;
const LESSON_PING_INTERVAL_MS = 10_000; // throttle: activity is bursty, the lock isn't

// Materials that used to be free starter stock but are now handed out only by
// the lesson listed beside them. Marking them notStarterStock stops new grants,
// but ensureAtLeast only ever tops a count up, so a save from before the
// change would keep its old free stock forever — hence the load-time cleanup.
const LESSON_ONLY_STOCK: [BlockType, string][] = [
  [BlockType.Hay, 'grajd'],
  [ThrowableId.SocataBottle as unknown as BlockType, 'grajd'],
  [BlockType.IeBlouse, 'spalatorie'],
  [BlockType.Glass, 'spalatorie'],
];

// Bump this whenever more materials leave the free starter stock, and list
// the newly-removed ones below. A save carrying an older revision has its
// old free pile of those cleared once, so the change is real for players who
// already have a world — and only once, so a pile they later mine or earn
// back is theirs to keep.
const STOCK_REV = 1;
const STOCK_REV_1_REMOVED: BlockType[] = [
  BlockType.Leaves,
  BlockType.Crystal,
  BlockType.RiverStone,
  BlockType.Obsidian,
  BlockType.DacianGold,
  BlockType.Wool,
  BlockType.Wheat,
  BlockType.Flour,
  BlockType.Mushroom,
  WeaponId.CrystalSword as unknown as BlockType,
  WeaponId.MagmaHammer as unknown as BlockType,
  ThrowableId.HubaBuba as unknown as BlockType,
];

interface ChunkTask {
  cx: number;
  cz: number;
  kind: 'generate' | 'mesh';
}

// Slab-method ray vs axis-aligned box; returns entry distance or null
function rayAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): number | null {
  let tMin = 0;
  let tMax = Infinity;
  const axes: [number, number, number, number][] = [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
    [oz, dz, minZ, maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private meshManager: ChunkMeshManager;
  private lightManager: LightManager;
  private doorRenderer: DoorRenderer;
  private meltManager = new MeltManager();
  private input: InputController;
  private player: Player;
  private inventory: Inventory;
  private hotbar: Hotbar;
  private hud: Hud;
  private inventoryPanel: InventoryPanel;
  private craftingPanel: CraftingPanel;
  private lessonInfoPanel: LessonInfoPanel;
  private helpPanel: HelpPanel;
  private vatra: VatraModule;
  private tabla: BlocklyPanel | null = null;
  private tablaCallbacks!: BlocklyCallbacks;
  private tablaLoading = false;
  private mobManager: MobManager;
  private projectiles: ProjectileManager;
  private dayNight: DayNightCycle;
  private health: Health;
  private healthHud: HealthHud;
  private sound: SoundManager;
  private selectionBox: THREE.LineSegments;
  private underwaterOverlay: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSaveTime = 0;
  private stepDistance = 0;
  private wasFeetInWater = false;
  private attackCooldown = 0;
  private atlas!: TextureAtlas;
  private hand: THREE.Group | null = null;
  private handItemId: number | null = null;
  private handSwing = 0;
  private playerName: string;
  private network = new NetworkClient();
  private remotePlayers: RemotePlayerManager;
  private multiplayer = false;
  private heldLesson: string | null = null;
  private lessonIdleTimer: number | null = null;
  private lessonPingAt = 0;
  private moveSendTimer = 0;
  private mpStatusEl: HTMLElement;

  private taskQueue: ChunkTask[] = [];
  private queuedKeys = new Set<string>();
  private lastPlayerChunk = { cx: NaN, cz: NaN };
  private worldReady = false;
  private accumulator = 0;
  private lastTime = 0;

  constructor(container: HTMLElement, playerName: string) {
    this.playerName = playerName;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    const fogNear = (RENDER_DISTANCE - 2) * CHUNK_SIZE;
    const fogFar = RENDER_DISTANCE * CHUNK_SIZE;
    this.scene.fog = new THREE.Fog(SKY_COLOR, fogNear, fogFar);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      RENDER_DISTANCE * CHUNK_SIZE * 2,
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // so the first-person weapon renders

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);
    this.dayNight = new DayNightCycle(this.scene, ambient, sun);

    const atlas = new TextureAtlas(WORLD_SEED);
    this.atlas = atlas;
    this.world = new World(WORLD_SEED);
    this.meshManager = new ChunkMeshManager(this.scene, atlas);
    this.lightManager = new LightManager(this.scene);
    this.doorRenderer = new DoorRenderer(this.scene, atlas);

    const overlay = document.getElementById('overlay')!;
    this.input = new InputController(this.renderer.domElement, overlay);
    this.player = new Player(this.input);
    this.inventory = new Inventory();
    this.hotbar = new Hotbar(document.getElementById('hotbar')!, atlas, this.inventory);
    this.hud = new Hud(document.getElementById('fps')!);
    this.inventoryPanel = new InventoryPanel(
      document.getElementById('inventory')!,
      atlas,
      this.inventory,
      (id) => {
        this.hotbar.assignToSelected(id);
        this.toggleInventoryPanel();
      },
      () => {
        if (this.inventoryPanel.isOpen) this.toggleInventoryPanel();
      },
    );
    this.craftingPanel = new CraftingPanel(
      document.getElementById('crafting')!,
      atlas,
      this.inventory,
      () => {
        if (this.craftingPanel.isOpen) this.toggleCraftingPanel();
      },
    );
    this.lessonInfoPanel = new LessonInfoPanel(document.getElementById('lore')!, {
      isDone: (pz) => this.vatra.isDone(pz),
      onOpenLesson: (pz) => {
        this.closeLessonInfo();
        void this.openTabla(pz);
      },
      onClose: () => this.closeLessonInfo(),
    });
    this.helpPanel = new HelpPanel(document.getElementById('help')!, atlas, () => this.toggleHelpPanel());
    this.mobManager = new MobManager(this.scene, this.world);
    this.projectiles = new ProjectileManager(this.scene);
    this.remotePlayers = new RemotePlayerManager(this.scene);
    this.mpStatusEl = document.getElementById('mp-status')!;
    new TouchControls(this.input);

    this.sound = new SoundManager();
    window.addEventListener('pointerdown', () => this.sound.unlock());

    // Satul Codat: the Vatra learning module + its Tabla de Blocuri editor
    this.vatra = new VatraModule(this.scene, this.world, this.sound, this.inventory, (x, y, z, id) => {
      this.applyBlockChange(x, y, z, id);
      this.sendEdit(x, y, z, id);
    });
    // The Tabla de Blocuri (Blockly) is loaded on first use — it is a large
    // chunk and nobody needs it until they open their first lesson.
    this.tablaCallbacks = {
      onRunStart: (pz: string) => this.vatra.beginRun(pz),
      onStep: (pz: string, block: string) => {
        this.noteLessonActivity(); // a long run is still the lesson being used
        this.vatra.performStep(pz, block);
      },
      onFinish: (pz: string, program: ProgramNode[]) => this.vatra.finish(pz, program),
      onRequestClose: () => this.closeTabla(),
      isDone: (pz: string) => this.vatra.isDone(pz),
      onResetLesson: (pz: string) => this.vatra.resetPuzzle(pz),
      onActivity: () => this.noteLessonActivity(),
    };

    this.health = new Health();
    this.healthHud = new HealthHud(this.health, () => this.respawn());
    this.health.onDamage(() => this.sound.hurt());
    this.health.onDeath(() => {
      this.sound.death();
      this.healthHud.showDeath();
      this.input.setDeathShown(true);
      if (!this.input.isTouchDevice) document.exitPointerLock();
    });
    this.player.onLand = (impactSpeed) => {
      this.sound.land(impactSpeed > FALL_SAFE_SPEED);
      if (!this.player.flying) {
        // ~ (fall height in blocks) - 3, derived from v² = 2·g·h
        const damage = Math.floor((impactSpeed * impactSpeed) / (2 * 25) - 3);
        if (damage > 0) this.health.damage(damage);
      }
    };

    this.underwaterOverlay = document.getElementById('underwater')!;
    this.toastEl = document.getElementById('toast')!;

    this.input.onHotbarSelect((slot) => this.hotbar.select(slot));
    this.input.onScroll((delta) => this.hotbar.scroll(delta));
    this.input.onBreak(() => this.attack());
    this.input.onPlace(() => this.placeBlock());
    this.input.onInventoryToggle(() => this.toggleInventoryPanel());
    this.input.onHelpToggle(() => this.toggleHelpPanel());

    // Selection outline: slightly inflated unit cube wireframe
    const boxGeo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    this.selectionBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
    boxGeo.dispose();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Restore a saved session if one exists; otherwise spawn fresh at origin
    const save = loadSave();
    if (save && save.seed === WORLD_SEED) {
      this.world.loadEdits(save.edits);
      this.inventory.load(save.inventory);
      if (save.hotbar) this.hotbar.setLayout(save.hotbar);
      this.hotbar.select(save.selectedSlot);
      this.player.body.x = save.player.x;
      this.player.body.y = save.player.y;
      this.player.body.z = save.player.z;
      this.input.yaw = save.player.yaw;
      this.input.pitch = save.player.pitch;
      if (save.time !== undefined) this.dayNight.time = save.time;
      if (save.hp !== undefined) this.health.setHp(save.hp);
    } else {
      const spawnHeight = this.world.generator.heightAt(0, 0);
      this.player.spawnAt(0.5, 0.5, spawnHeight);
    }
    // Every session starts with a healthy stock of each material — except
    // blocks that must be crafted at a Crafting Table (Țiglă, Boltar, Cărămidă)
    for (const id of PLACEABLE_BLOCKS) {
      if (BLOCKS[id].notStarterStock) continue;
      this.inventory.ensureAtLeast(id, STARTER_STOCK);
    }
    for (const id of THROWABLE_IDS) {
      if (THROWABLES[id].notStarterStock) continue;
      this.inventory.ensureAtLeast(id as unknown as BlockType, THROWABLE_STARTER_STOCK);
    }
    for (const [id, lesson] of LESSON_ONLY_STOCK) {
      if (!this.vatra.isDone(lesson)) this.inventory.remove(id, this.inventory.count(id));
    }
    // One-off: clear the free pile a pre-existing save still holds of the
    // materials that have since stopped being handed out
    if ((save?.stockRev ?? 0) < STOCK_REV) {
      for (const id of STOCK_REV_1_REMOVED) this.inventory.remove(id, this.inventory.count(id));
    }

    window.addEventListener('beforeunload', () => this.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
    });

    // Debug handles for the browser console
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __puzzles: typeof VATRA_PUZZLES }).__puzzles = VATRA_PUZZLES;

    void this.connectMultiplayer();
  }

  // Attempts to join the shared multiplayer world; on success, block edits
  // and the day/night clock become server-authoritative and other players
  // become visible. If the server is unreachable, play continues solo with
  // the existing localStorage save.
  private async connectMultiplayer(): Promise<void> {
    const url = resolveServerUrl(MULTIPLAYER_SERVER_URL);
    if (!url) return;

    this.network.on('join', (p: RemotePlayerState) => {
      this.remotePlayers.add(p);
      this.updateMpStatus();
    });
    this.network.on('leave', (id: string) => {
      this.remotePlayers.remove(id);
      this.updateMpStatus();
    });
    this.network.on('move', (e: MoveEvent) => {
      this.remotePlayers.applyMove(e.id, e.x, e.y, e.z, e.yaw, e.moving);
    });
    this.network.on('blockEdit', (e: BlockEditEvent) => this.applyRemoteBlockEdit(e));
    this.network.onDisconnect(() => {
      this.multiplayer = false;
      this.remotePlayers.clear();
      this.updateMpStatus();
      console.warn('[CUBURIA] Lost connection to the multiplayer server — continuing solo.');
    });

    const init = await this.network.connect(url, this.playerName);
    if (!init) {
      console.warn('[CUBURIA] Multiplayer server unreachable — playing solo.');
      this.updateMpStatus();
      return;
    }

    this.multiplayer = true;
    this.world.loadEdits(init.edits);
    this.world.applyStoredEditsToAllLoadedChunks();
    for (const chunk of this.world.allChunks()) {
      this.meshManager.remesh(chunk, this.world);
      this.lightManager.syncChunk(chunk);
      this.doorRenderer.syncChunk(chunk);
      this.meltManager.syncChunk(chunk);
    }
    this.dayNight.setNetworkEpoch(init.epoch);
    for (const p of init.players) this.remotePlayers.add(p);
    this.updateMpStatus();
  }

  private applyRemoteBlockEdit(e: BlockEditEvent): void {
    this.applyBlockChange(e.x, e.y, e.z, e.blockId);
  }

  // Writes a block, remeshes whichever chunks it touched, and keeps lamp
  // lighting, door panels, and melt tracking in sync. Returns the affected
  // chunks (empty if unloaded).
  private applyBlockChange(x: number, y: number, z: number, id: number): Chunk[] {
    const affected = this.world.setBlock(x, y, z, id);
    for (const chunk of affected) {
      this.meshManager.remesh(chunk, this.world);
      this.lightManager.syncChunk(chunk);
      this.doorRenderer.syncChunk(chunk);
      this.meltManager.syncChunk(chunk);
    }
    return affected;
  }

  private updateMpStatus(): void {
    if (this.multiplayer) {
      const total = this.remotePlayers.count + 1;
      const word = total === 1 ? 'explorator' : 'exploratori';
      this.mpStatusEl.textContent = `● Online — ${total} ${word}`;
      this.mpStatusEl.className = 'online';
    } else {
      this.mpStatusEl.textContent = '● Solo (offline)';
      this.mpStatusEl.className = 'offline';
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  private frame(now: number): void {
    const dt = Math.min(0.25, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.updateChunkQueue();
    this.processTasks();

    if (this.worldReady && !this.health.dead) {
      const mobContext = {
        player: this.player.body,
        isNight: this.dayNight.isNight,
        playerDead: this.health.dead,
        onMobAttack: (mob: Mob) => this.mobHit(mob),
        onRangedAttack: (mob: Mob) => this.zmeuFire(mob),
        onMobSound: (kind: MobKind) => this.sound.mob(kind),
        onTeleport: () => this.sound.teleport(),
      };
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= PHYSICS_STEP && steps < MAX_STEPS_PER_FRAME) {
        this.player.update(this.world, PHYSICS_STEP);
        this.mobManager.update(PHYSICS_STEP, mobContext);
        this.projectiles.update(
          PHYSICS_STEP,
          this.world,
          this.player.body,
          (damage) => this.health.damage(damage),
          () => this.sound.fireballImpact(),
        );
        this.projectiles.updateBottles(PHYSICS_STEP, this.world, this.mobManager.all(), (x, y, z, radius) => this.explodeAt(x, y, z, radius));
        this.accumulator -= PHYSICS_STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

      // Mămăligă blocks sitting against water dissolve away after a couple of seconds
      for (const { x, y, z } of this.meltManager.update(dt, this.world)) {
        this.applyBlockChange(x, y, z, BlockType.Air);
        this.sendEdit(x, y, z, BlockType.Air);
        this.sound.melt();
      }

      // Footsteps while walking on the ground
      const body = this.player.body;
      const horizontalSpeed = Math.hypot(body.vx, body.vz);
      if (body.onGround && !this.player.flying && horizontalSpeed > 0.5) {
        this.stepDistance += horizontalSpeed * dt;
        if (this.stepDistance > 2.2) {
          this.stepDistance = 0;
          this.sound.step();
        }
      }
      // Splash when the feet enter water
      const feetInWater = isWater(
        this.world.getBlock(Math.floor(body.x), Math.floor(body.y + 0.3), Math.floor(body.z)),
      );
      if (feetInWater && !this.wasFeetInWater) this.sound.splash();
      this.wasFeetInWater = feetInWater;

      if (this.multiplayer) {
        this.moveSendTimer += dt;
        if (this.moveSendTimer >= MOVE_SEND_INTERVAL) {
          this.moveSendTimer = 0;
          this.network.sendMove(body.x, body.y, body.z, this.input.yaw, horizontalSpeed > 0.5, feetInWater);
        }
      }
    }

    this.remotePlayers.update(dt);
    this.vatra.update(dt);

    this.camera.position.set(this.player.eyeX, this.player.eyeY, this.player.eyeZ);
    this.camera.rotation.y = this.input.yaw;
    this.camera.rotation.x = this.input.pitch;

    this.dayNight.update(dt, this.camera);

    // Blue screen tint while the camera is inside a water block
    const eyeUnderwater = isWater(
      this.world.getBlock(
        Math.floor(this.camera.position.x),
        Math.floor(this.camera.position.y),
        Math.floor(this.camera.position.z),
      ),
    );
    this.underwaterOverlay.classList.toggle('hidden', !eyeUnderwater);
    if (this.worldReady) {
      this.health.update(dt, eyeUnderwater && !this.player.flying);
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.updateHand(dt);
    this.updateSelectionBox();
    this.hud.tick(now);

    if (this.worldReady && now - this.lastSaveTime > SAVE_INTERVAL_MS) {
      this.saveNow();
      this.lastSaveTime = now;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private mobHit(mob: Mob): void {
    this.health.damage(mob.damage);
    // Knock the player away; heavier hitters push harder
    const dx = this.player.body.x - mob.body.x;
    const dz = this.player.body.z - mob.body.z;
    const len = Math.hypot(dx, dz) || 1;
    const push = 4 + mob.damage * 1.5;
    this.player.body.vx += (dx / len) * push;
    this.player.body.vz += (dz / len) * push;
    this.player.body.vy = Math.max(this.player.body.vy, 4);
  }

  // Left click: throw the bottle if one's selected, strike a mob in reach,
  // or otherwise break the targeted block
  // Free-stock weapons are always usable; the earned ones need one in the pack
  private ownsWeapon(id: number): boolean {
    return !WEAPONS[id]?.notStarterStock || this.inventory.count(id as BlockType) > 0;
  }

  private attack(): void {
    if (this.health.dead || this.attackCooldown > 0) return;
    const selected = this.hotbar.selectedItem;
    if (isThrowable(selected)) {
      this.throwBottle(selected);
      return;
    }
    // An earned weapon you don't actually have swings like a bare hand —
    // same convention as a block you're out of, which simply won't place.
    const weapon = isWeapon(selected) && this.ownsWeapon(selected) ? WEAPONS[selected] : null;
    const range = weapon ? weapon.range : 3;

    const mob = this.raycastMob(range);
    if (mob) {
      const dx = mob.body.x - this.player.body.x;
      const dz = mob.body.z - this.player.body.z;
      const len = Math.hypot(dx, dz) || 1;
      const knockback = weapon ? weapon.knockback : 5;
      mob.hit(
        weapon ? weapon.damage : 2,
        (dx / len) * knockback,
        (dz / len) * knockback,
        weapon?.slowSeconds ?? 0,
      );
      if (mob.dying) this.sound.mobDeath();
      else this.sound.hitMob();
      this.attackCooldown = weapon ? weapon.cooldown : 0.3;
    } else {
      this.sound.swing();
      this.breakBlock();
      this.attackCooldown = 0.25;
    }
    this.handSwing = 0.25;
  }

  // Nearest mob whose AABB the camera ray hits within range (terrain blocks the swing)
  private raycastMob(range: number): Mob | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const o = this.camera.position;

    let best: Mob | null = null;
    let bestT = Infinity;
    for (const mob of this.mobManager.all()) {
      if (mob.dying) continue;
      const b = mob.body;
      const t = rayAABB(
        o.x, o.y, o.z, dir.x, dir.y, dir.z,
        b.x - b.halfWidth, b.y, b.z - b.halfWidth,
        b.x + b.halfWidth, b.y + b.height, b.z + b.halfWidth,
      );
      if (t !== null && t <= range && t < bestT) {
        best = mob;
        bestT = t;
      }
    }
    if (!best) return null;
    // Blocked by terrain? A solid block closer than the mob stops the hit
    const blockHit = raycastVoxels(this.world, { x: o.x, y: o.y, z: o.z }, dir, bestT);
    if (blockHit) return null;
    return best;
  }

  // Throws whichever bottle/gum is selected from the camera; it arcs under
  // gravity and detonates on the first mob or block it touches (see explodeAt).
  private throwBottle(id: number): void {
    if (!this.inventory.remove(id as BlockType)) return;
    const def = THROWABLES[id];
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const o = this.camera.position;
    this.projectiles.spawnBottle(o.x, o.y, o.z, dir.x, dir.y, dir.z, def.shape, def.blastRadius);
    this.sound.throwBottle();
    this.attackCooldown = 0.5;
    this.handSwing = 0.25;
  }

  // A thrown bottle/gum's impact: every mob caught in the blast radius dies outright
  private explodeAt(x: number, y: number, z: number, radius: number): void {
    for (const mob of this.mobManager.all()) {
      if (mob.dying) continue;
      const dx = mob.body.x - x;
      const dz = mob.body.z - z;
      const dist = Math.hypot(dx, dz, mob.body.y - y);
      if (dist > radius) continue;
      const len = Math.hypot(dx, dz) || 1;
      mob.hit(9999, (dx / len) * 10, (dz / len) * 10);
      this.sound.mobDeath();
    }
    this.sound.explosion();
  }

  // Rebuilds the first-person hand model when the selection changes (a fist
  // gripping the sword, or the currently held block once the player actually
  // has some in stock), and plays the swing animation
  private updateHand(dt: number): void {
    const selected = this.hotbar.selectedItem;
    const held = isWeapon(selected) || this.inventory.count(selected as BlockType) > 0 ? selected : null;
    if (held !== this.handItemId) {
      if (this.hand) {
        this.camera.remove(this.hand);
        disposeModel(this.hand);
        this.hand = null;
      }
      if (held !== null) {
        this.hand = buildHeldItem(held, this.atlas);
        this.hand.position.set(0.42, -0.42, -0.7);
        this.hand.rotation.set(0.25, -0.35, -0.25);
        this.camera.add(this.hand);
      }
      this.handItemId = held;
    }
    if (this.hand) {
      this.handSwing = Math.max(0, this.handSwing - dt);
      const p = this.handSwing / 0.25;
      this.hand.rotation.x = 0.25 - Math.sin(p * Math.PI) * 1.1;
    }
  }

  private zmeuFire(mob: Mob): void {
    const originY = mob.body.y + mob.body.height * 0.5;
    const dx = this.player.body.x - mob.body.x;
    const dy = this.player.body.y + 0.9 - originY;
    const dz = this.player.body.z - mob.body.z;
    this.projectiles.spawnFireball(mob.body.x, originY, mob.body.z, dx, dy, dz, mob.damage);
    this.sound.fireballCast();
  }

  private respawn(): void {
    const spawnHeight = this.world.generator.heightAt(0, 0);
    this.player.spawnAt(0.5, 0.5, spawnHeight);
    this.player.flying = false;
    this.health.respawn();
    this.healthHud.hideDeath();
    // Back through the start overlay (click/tap to resume)
    this.input.setDeathShown(false);
    if (this.input.isTouchDevice) this.input.setTouchActive(false);
  }

  private saveNow(): void {
    // The multiplayer world is authoritative on the server; local edits are
    // already sent there as they happen, so skip the redundant local save.
    if (this.multiplayer) return;
    writeSave({
      seed: WORLD_SEED,
      time: this.dayNight.time,
      hp: this.health.hp,
      player: {
        x: this.player.body.x,
        y: this.player.body.y,
        z: this.player.body.z,
        yaw: this.input.yaw,
        pitch: this.input.pitch,
      },
      inventory: this.inventory.serialize(),
      selectedSlot: this.hotbar.selectedIndex,
      hotbar: this.hotbar.getLayout(),
      stockRev: STOCK_REV,
      edits: this.world.serializeEdits(),
    });
  }

  private toggleInventoryPanel(): void {
    if (this.inventoryPanel.isOpen) {
      this.inventoryPanel.close();
      this.input.setInventoryOpen(false);
      if (!this.input.isTouchDevice) this.renderer.domElement.requestPointerLock();
    } else {
      this.inventoryPanel.show();
      this.input.setInventoryOpen(true);
      if (!this.input.isTouchDevice) document.exitPointerLock();
    }
  }

  // Ajutor (H): the material catalogue. Like the inventory, it pauses the
  // game and releases the mouse while it's up.
  private toggleHelpPanel(): void {
    if (this.helpPanel.isOpen) {
      this.helpPanel.close();
      this.input.setInventoryOpen(false);
      if (!this.input.isTouchDevice) this.renderer.domElement.requestPointerLock();
    } else {
      this.helpPanel.show();
      this.input.setInventoryOpen(true);
      if (!this.input.isTouchDevice) document.exitPointerLock();
    }
  }

  private toggleCraftingPanel(): void {
    if (this.craftingPanel.isOpen) {
      this.craftingPanel.close();
      this.input.setInventoryOpen(false);
      if (!this.input.isTouchDevice) this.renderer.domElement.requestPointerLock();
    } else {
      this.craftingPanel.show();
      this.input.setInventoryOpen(true);
      if (!this.input.isTouchDevice) document.exitPointerLock();
    }
  }

  private openLessonInfo(zone: string): void {
    if (this.lessonInfoPanel.isOpen) return;
    this.lessonInfoPanel.show(zone);
    this.input.setInventoryOpen(true);
    if (!this.input.isTouchDevice) document.exitPointerLock();
  }

  private closeLessonInfo(): void {
    if (!this.lessonInfoPanel.isOpen) return;
    this.lessonInfoPanel.close();
    this.input.setInventoryOpen(false);
    if (!this.input.isTouchDevice) this.renderer.domElement.requestPointerLock();
  }

  // A brief non-blocking banner (e.g. "coming soon") — unlike the tabla/lore
  // panels, it doesn't pause the game or grab pointer lock.
  private showToast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2400);
  }

  private async openTabla(puzzleId: string): Promise<void> {
    if (this.tablaLoading) return;
    if (this.heldLesson && this.heldLesson !== puzzleId) this.releaseLesson();
    // One tabla per lesson across the whole server: ask before opening, so
    // two children can't drag blocks into the same lesson at once.
    if (this.multiplayer) {
      const claim = await this.network.claimLesson(puzzleId);
      if (!claim.ok) {
        this.showToast(`${claim.byName ?? 'Alt jucător'} lucrează acum la lecția asta — așteaptă să termine.`);
        this.sound.clink();
        return;
      }
    }
    this.heldLesson = puzzleId;
    this.noteLessonActivity();
    const host = document.getElementById('tabla')!;
    this.input.setInventoryOpen(true);
    if (!this.input.isTouchDevice) document.exitPointerLock();
    if (!this.tabla) {
      this.tablaLoading = true;
      host.classList.remove('hidden');
      host.innerHTML = '<div class="tabla-panel tabla-loading">Se cioplește tăblița…</div>';
      try {
        const { BlocklyPanel } = await import('./ui/BlocklyPanel');
        this.tabla = new BlocklyPanel(host, this.tablaCallbacks);
      } finally {
        this.tablaLoading = false;
      }
    }
    this.tabla.open(VATRA_PUZZLES[puzzleId]);
  }

  private closeTabla(): void {
    if (!this.tabla?.isOpen) return;
    this.tabla.close();
    this.releaseLesson();
    this.input.setInventoryOpen(false);
    if (!this.input.isTouchDevice) this.renderer.domElement.requestPointerLock();
  }

  // Hands the lesson back so the next player can open it
  private releaseLesson(): void {
    if (this.lessonIdleTimer !== null) {
      clearTimeout(this.lessonIdleTimer);
      this.lessonIdleTimer = null;
    }
    if (!this.heldLesson) return;
    if (this.multiplayer) this.network.releaseLesson(this.heldLesson);
    this.heldLesson = null;
  }

  // Any real interaction with the open tabla restarts the idle countdown. A
  // lesson left untouched for a minute closes itself and frees the spot —
  // solo play has nobody waiting, so it's left alone there.
  private noteLessonActivity(): void {
    if (!this.heldLesson || !this.multiplayer) return;
    const now = performance.now();
    if (now - this.lessonPingAt > LESSON_PING_INTERVAL_MS) {
      this.lessonPingAt = now;
      this.network.pingLesson(this.heldLesson);
    }
    if (this.lessonIdleTimer !== null) clearTimeout(this.lessonIdleTimer);
    this.lessonIdleTimer = window.setTimeout(() => {
      this.lessonIdleTimer = null;
      this.closeTabla();
      this.releaseLesson(); // in case the panel hadn't finished opening yet
      this.showToast('Lecția s-a închis singură — n-ai atins nimic un minut, ca s-o poată lua altul.');
    }, LESSON_IDLE_MS);
  }

  // --- Chunk streaming ---

  private updateChunkQueue(): void {
    const pcx = worldToChunk(Math.floor(this.player.body.x));
    const pcz = worldToChunk(Math.floor(this.player.body.z));
    if (pcx === this.lastPlayerChunk.cx && pcz === this.lastPlayerChunk.cz) return;
    this.lastPlayerChunk = { cx: pcx, cz: pcz };

    const tasks: ChunkTask[] = [];
    const dataRadius = RENDER_DISTANCE + 1;

    for (let dx = -dataRadius; dx <= dataRadius; dx++) {
      for (let dz = -dataRadius; dz <= dataRadius; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const dist = Math.max(Math.abs(dx), Math.abs(dz));

        if (!this.world.hasChunk(cx, cz)) {
          tasks.push({ cx, cz, kind: 'generate' });
        }
        if (dist <= RENDER_DISTANCE && !this.meshManager.hasMesh(cx, cz)) {
          tasks.push({ cx, cz, kind: 'mesh' });
        }
      }
    }

    tasks.sort((a, b) => {
      // Generation before meshing at equal distance; closest first
      const da = Math.max(Math.abs(a.cx - pcx), Math.abs(a.cz - pcz));
      const db = Math.max(Math.abs(b.cx - pcx), Math.abs(b.cz - pcz));
      if (da !== db) return da - db;
      return a.kind === b.kind ? 0 : a.kind === 'generate' ? -1 : 1;
    });

    this.taskQueue = tasks.filter((t) => {
      const k = `${t.kind}:${chunkKey(t.cx, t.cz)}`;
      if (this.queuedKeys.has(k)) return false;
      this.queuedKeys.add(k);
      return true;
    });
    this.queuedKeys = new Set(this.taskQueue.map((t) => `${t.kind}:${chunkKey(t.cx, t.cz)}`));

    this.unloadFarChunks(pcx, pcz);
  }

  private processTasks(): void {
    const deadline = performance.now() + MESH_BUDGET_MS;
    while (this.taskQueue.length > 0 && performance.now() < deadline) {
      const task = this.taskQueue[0];

      if (task.kind === 'generate') {
        this.taskQueue.shift();
        this.queuedKeys.delete(`generate:${chunkKey(task.cx, task.cz)}`);
        this.world.generateChunk(task.cx, task.cz);
        continue;
      }

      // Meshing requires the chunk and its 4 neighbors to have data
      const ready =
        this.world.hasChunk(task.cx, task.cz) &&
        this.world.hasChunk(task.cx - 1, task.cz) &&
        this.world.hasChunk(task.cx + 1, task.cz) &&
        this.world.hasChunk(task.cx, task.cz - 1) &&
        this.world.hasChunk(task.cx, task.cz + 1);
      if (!ready) {
        // Neighbors still queued ahead of us? They shouldn't be (generation
        // sorts first), but if data was unloaded, regenerate it now.
        this.world.generateChunk(task.cx - 1, task.cz);
        this.world.generateChunk(task.cx + 1, task.cz);
        this.world.generateChunk(task.cx, task.cz - 1);
        this.world.generateChunk(task.cx, task.cz + 1);
        this.world.generateChunk(task.cx, task.cz);
      }

      this.taskQueue.shift();
      this.queuedKeys.delete(`mesh:${chunkKey(task.cx, task.cz)}`);
      const chunk = this.world.getChunk(task.cx, task.cz)!;
      this.meshManager.remesh(chunk, this.world);
      this.lightManager.syncChunk(chunk);
      this.doorRenderer.syncChunk(chunk);
      this.meltManager.syncChunk(chunk);
    }

    if (!this.worldReady) {
      // Physics starts once the spawn chunk is meshed (its data then exists too)
      const pcx = worldToChunk(Math.floor(this.player.body.x));
      const pcz = worldToChunk(Math.floor(this.player.body.z));
      if (this.meshManager.hasMesh(pcx, pcz)) this.worldReady = true;
    }
  }

  private unloadFarChunks(pcx: number, pcz: number): void {
    const dataRadius = RENDER_DISTANCE + 2;
    const toRemove: { cx: number; cz: number }[] = [];
    for (const chunk of this.world.allChunks()) {
      const dist = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (dist > dataRadius) toRemove.push({ cx: chunk.cx, cz: chunk.cz });
    }
    for (const { cx, cz } of toRemove) {
      this.meshManager.removeMesh(cx, cz);
      this.lightManager.removeChunk(cx, cz);
      this.doorRenderer.removeChunk(cx, cz);
      this.meltManager.removeChunk(cx, cz);
      this.world.removeChunk(cx, cz);
    }
  }

  // --- Block interaction ---

  // Doors aren't solid once open, but should still be targetable so a right
  // click can swing them shut again — so the reach raycast also stops on them.
  private raycastFromCamera() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return raycastVoxels(
      this.world,
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: dir.x, y: dir.y, z: dir.z },
      REACH_DISTANCE,
      (id) => isSolid(id) || isDoor(id),
    );
  }

  // A door is always 2 blocks tall; given either half, returns [bottomY, topY].
  private doorSpan(x: number, y: number, z: number): [number, number] {
    const id = this.world.getBlock(x, y, z);
    return this.world.getBlock(x, y + 1, z) === id ? [y, y + 1] : [y - 1, y];
  }

  private sendEdit(x: number, y: number, z: number, id: number): void {
    if (this.multiplayer) this.network.sendBlockEdit(x, y, z, id);
  }

  private breakBlock(): void {
    if (this.health.dead) return;
    const hit = this.raycastFromCamera();
    if (!hit) return;
    const { x, y, z } = hit.block;
    if (y <= 0) return; // keep the bottom layer as bedrock
    if (this.vatra.isProtected(x, y, z)) {
      this.sound.clink(); // the Vatra square can't be mined — its puzzles stay intact
      return;
    }
    const broken = this.world.getBlock(x, y, z);

    if (isDoor(broken)) {
      const [y0, y1] = this.doorSpan(x, y, z);
      if (this.applyBlockChange(x, y0, z, BlockType.Air).length === 0) return;
      this.applyBlockChange(x, y1, z, BlockType.Air);
      this.sendEdit(x, y0, z, BlockType.Air);
      this.sendEdit(x, y1, z, BlockType.Air);
      this.inventory.add(BlockType.Door);
      this.sound.breakBlock();
      return;
    }

    if (requiresPickaxe(broken) && this.hotbar.selectedItem !== ToolId.Tarnacop) {
      this.sound.clink(); // too hard to break by hand — needs the Târnăcop
      return;
    }

    if (this.applyBlockChange(x, y, z, BlockType.Air).length > 0) {
      this.inventory.add(broken);
      this.sound.breakBlock();
      this.sendEdit(x, y, z, BlockType.Air);
    }
  }

  // Which zone guide (Bunicul in the Vatra, Baciul in the Luncă) is being
  // looked at, if any. They're decorative NPCs, not voxel blocks, so the
  // usual block-grid raycast can't find them — this is a ray-sphere test.
  private guideHit(): string | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.vatra.guideAt(
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: dir.x, y: dir.y, z: dir.z },
      REACH_DISTANCE,
    );
  }

  // Right-click with Pâine selected eats it — it can't be placed as a
  // block — heals one full heart (2 hp) if not already at max, earned from
  // the Cuptor lesson
  private eatBread(): void {
    if (this.health.hp >= MAX_HP) return; // don't waste it at full health
    if (!this.inventory.remove(BlockType.Paine)) return;
    this.health.heal(2);
    this.sound.eat();
  }

  private placeBlock(): void {
    if (this.health.dead) return;
    const guideZone = this.guideHit();
    if (guideZone) {
      this.openLessonInfo(guideZone);
      return;
    }
    const hit = this.raycastFromCamera();

    // Doors, the crafting table, and lessons always take priority over
    // eating when they're what's actually being targeted.
    if (hit) {
      const targetedId = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
      if (isDoor(targetedId)) {
        const { x, y, z } = hit.block;
        const [y0, y1] = this.doorSpan(x, y, z);
        const next = toggleDoorId(this.world.getBlock(x, y0, z));
        this.applyBlockChange(x, y0, z, next);
        this.applyBlockChange(x, y1, z, next);
        this.sendEdit(x, y0, z, next);
        this.sendEdit(x, y1, z, next);
        this.sound.doorToggle();
        return;
      }
      if (targetedId === BlockType.CraftingTable) {
        this.toggleCraftingPanel();
        return;
      }
      const vatraPuzzle = this.vatra.puzzleAt(hit.block.x, hit.block.y, hit.block.z);
      if (vatraPuzzle) {
        if (this.vatra.isComingSoon(vatraPuzzle)) {
          this.showToast('În construcție, disponibil în curând.');
        } else {
          void this.openTabla(vatraPuzzle);
        }
        return;
      }
    }
    // Bread eats regardless of whether anything's in reach — it's never
    // placed as a block.
    if (this.hotbar.selectedItem === BlockType.Paine) {
      this.eatBread();
      return;
    }
    if (!hit) return;

    const selected = this.hotbar.selectedItem;
    if (isWeapon(selected) || isThrowable(selected) || isTool(selected)) return; // can't be placed

    const { x, y, z } = hit.previous;
    if (this.vatra.isProtected(x, y, z)) {
      this.sound.clink(); // the lesson squares take no blocks either, same as they can't be mined
      return;
    }
    const target = this.world.getBlock(x, y, z);
    if (target !== BlockType.Air && target !== BlockType.Water) return;
    if (blockIntersectsBody(this.player.body, x, y, z)) return;

    if (selected === BlockType.Door) {
      if (this.world.getBlock(x, y + 1, z) !== BlockType.Air) return; // no room for the top half
      if (!this.inventory.remove(BlockType.Door)) return;
      // Orient the panel to fill whichever wall it's set into: if there's
      // solid rock beside it along X, the wall runs along X (panel spans X);
      // otherwise assume a Z-running wall (panel spans Z).
      const wallRunsAlongX = isSolid(this.world.getBlock(x - 1, y, z)) || isSolid(this.world.getBlock(x + 1, y, z));
      const doorId = wallRunsAlongX ? BlockType.DoorClosedX : BlockType.DoorClosedZ;
      this.applyBlockChange(x, y, z, doorId);
      this.applyBlockChange(x, y + 1, z, doorId);
      this.sendEdit(x, y, z, doorId);
      this.sendEdit(x, y + 1, z, doorId);
      this.sound.place();
      return;
    }

    if (!this.inventory.remove(selected as BlockType)) return; // out of stock
    this.applyBlockChange(x, y, z, selected);
    this.sound.place();
    this.sendEdit(x, y, z, selected);
  }

  private updateSelectionBox(): void {
    const hit = this.input.active ? this.raycastFromCamera() : null;
    if (hit) {
      this.selectionBox.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }
}
