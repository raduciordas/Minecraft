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
} from './config';
import { World, worldToChunk, chunkKey } from './world/World';
import { BlockType, isWater, PLACEABLE_BLOCKS } from './world/Block';
import { raycastVoxels } from './world/raycast';
import { TextureAtlas } from './rendering/TextureAtlas';
import { ChunkMeshManager } from './rendering/ChunkMeshManager';
import { InputController } from './player/InputController';
import { Player } from './player/Player';
import { Inventory } from './player/Inventory';
import { blockIntersectsBody } from './player/Physics';
import { Hotbar } from './ui/Hotbar';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { loadSave, writeSave } from './SaveManager';
import { MobManager } from './mobs/MobManager';

interface ChunkTask {
  cx: number;
  cz: number;
  kind: 'generate' | 'mesh';
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private meshManager: ChunkMeshManager;
  private input: InputController;
  private player: Player;
  private inventory: Inventory;
  private hotbar: Hotbar;
  private hud: Hud;
  private inventoryPanel: InventoryPanel;
  private mobManager: MobManager;
  private selectionBox: THREE.LineSegments;
  private underwaterOverlay: HTMLElement;
  private lastSaveTime = 0;

  private taskQueue: ChunkTask[] = [];
  private queuedKeys = new Set<string>();
  private lastPlayerChunk = { cx: NaN, cz: NaN };
  private worldReady = false;
  private accumulator = 0;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    const atlas = new TextureAtlas(WORLD_SEED);
    this.world = new World(WORLD_SEED);
    this.meshManager = new ChunkMeshManager(this.scene, atlas);

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
    );
    this.mobManager = new MobManager(this.scene, this.world);

    this.underwaterOverlay = document.getElementById('underwater')!;

    this.input.onHotbarSelect((slot) => this.hotbar.select(slot));
    this.input.onScroll((delta) => this.hotbar.scroll(delta));
    this.input.onBreak(() => this.breakBlock());
    this.input.onPlace(() => this.placeBlock());
    this.input.onInventoryToggle(() => this.toggleInventoryPanel());

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
    } else {
      const spawnHeight = this.world.generator.heightAt(0, 0);
      this.player.spawnAt(0.5, 0.5, spawnHeight);
    }
    // Every session starts with a healthy stock of each material
    for (const id of PLACEABLE_BLOCKS) this.inventory.ensureAtLeast(id, STARTER_STOCK);

    window.addEventListener('beforeunload', () => this.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
    });

    // Debug handle for the browser console
    (window as unknown as { __game: Game }).__game = this;
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

    if (this.worldReady) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= PHYSICS_STEP && steps < MAX_STEPS_PER_FRAME) {
        this.player.update(this.world, PHYSICS_STEP);
        this.mobManager.update(PHYSICS_STEP, this.player.body);
        this.accumulator -= PHYSICS_STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    this.camera.position.set(this.player.eyeX, this.player.eyeY, this.player.eyeZ);
    this.camera.rotation.y = this.input.yaw;
    this.camera.rotation.x = this.input.pitch;

    // Blue screen tint while the camera is inside a water block
    const eyeUnderwater = isWater(
      this.world.getBlock(
        Math.floor(this.camera.position.x),
        Math.floor(this.camera.position.y),
        Math.floor(this.camera.position.z),
      ),
    );
    this.underwaterOverlay.classList.toggle('hidden', !eyeUnderwater);

    this.updateSelectionBox();
    this.hud.tick(now);

    if (this.worldReady && now - this.lastSaveTime > SAVE_INTERVAL_MS) {
      this.saveNow();
      this.lastSaveTime = now;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private saveNow(): void {
    writeSave({
      seed: WORLD_SEED,
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
      edits: this.world.serializeEdits(),
    });
  }

  private toggleInventoryPanel(): void {
    if (this.inventoryPanel.isOpen) {
      this.inventoryPanel.close();
      this.input.inventoryOpen = false;
      this.renderer.domElement.requestPointerLock();
    } else {
      this.inventoryPanel.show();
      this.input.inventoryOpen = true;
      document.exitPointerLock();
    }
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
      this.world.removeChunk(cx, cz);
    }
  }

  // --- Block interaction ---

  private raycastFromCamera() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return raycastVoxels(
      this.world,
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: dir.x, y: dir.y, z: dir.z },
      REACH_DISTANCE,
    );
  }

  private breakBlock(): void {
    const hit = this.raycastFromCamera();
    if (!hit) return;
    const { x, y, z } = hit.block;
    if (y <= 0) return; // keep the bottom layer as bedrock
    const broken = this.world.getBlock(x, y, z);
    const affected = this.world.setBlock(x, y, z, BlockType.Air);
    for (const chunk of affected) this.meshManager.remesh(chunk, this.world);
    if (affected.length > 0) this.inventory.add(broken);
  }

  private placeBlock(): void {
    const hit = this.raycastFromCamera();
    if (!hit) return;
    const { x, y, z } = hit.previous;
    const target = this.world.getBlock(x, y, z);
    if (target !== BlockType.Air && target !== BlockType.Water) return;
    if (blockIntersectsBody(this.player.body, x, y, z)) return;
    if (!this.inventory.remove(this.hotbar.selectedBlock)) return; // out of stock
    const affected = this.world.setBlock(x, y, z, this.hotbar.selectedBlock);
    for (const chunk of affected) this.meshManager.remesh(chunk, this.world);
  }

  private updateSelectionBox(): void {
    const hit = this.input.locked ? this.raycastFromCamera() : null;
    if (hit) {
      this.selectionBox.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }
}
