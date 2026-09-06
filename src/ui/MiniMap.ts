import { BLOCKS, BlockType, isSolid } from '../world/Block';
import { CHUNK_HEIGHT } from '../config';
import type { World } from '../world/World';

const SPAN = 96; // blocks across, centred on the player
const PIXELS = 192; // canvas size; two screen pixels per block
const SCALE = PIXELS / SPAN;
const REDRAW_MS = 250; // the terrain hardly moves; no need to redraw every frame

// The colour each block reads as from above. Anything not listed borrows its
// texture's rough tone via FALLBACK.
const COLORS: Record<number, string> = {
  [BlockType.Grass]: '#5a8f3c',
  [BlockType.Dirt]: '#7a5a3a',
  [BlockType.Stone]: '#8a8a8a',
  [BlockType.Sand]: '#ddd2a0',
  [BlockType.Water]: '#3a78d8',
  [BlockType.Snow]: '#f0f4f8',
  [BlockType.Log]: '#6b4a26',
  [BlockType.Leaves]: '#3f7d2c',
  [BlockType.Plank]: '#b08249',
  [BlockType.Cobblestone]: '#9a9a9a',
  [BlockType.Brick]: '#a44a34',
  [BlockType.StoneBrick]: '#a0a0a8',
  [BlockType.Crystal]: '#7df0e8',
  [BlockType.RiverStone]: '#9a9a92',
  [BlockType.Hay]: '#d9c27a',
  [BlockType.Wheat]: '#d6b24a',
  [BlockType.Wool]: '#e8e2d4',
  [BlockType.Glass]: '#cfe4f0',
  [BlockType.Lamp]: '#ffe14d',
  [BlockType.Torch]: '#ffb060',
  [BlockType.Obsidian]: '#241a2e',
};
const FALLBACK = '#8a7a5a';

// The landmarks worth naming on the map, in world coordinates
export interface MapMark {
  x: number;
  z: number;
  label: string;
}

// A parchment minimap, drawn only while the Hartă is the held item. Samples
// the topmost visible block of each column around the player.
export class MiniMap {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastDraw = 0;
  visible = false;

  constructor(
    container: HTMLElement,
    private marks: MapMark[],
  ) {
    this.root = container;
    this.root.classList.add('hidden');
    this.canvas = document.createElement('canvas');
    this.canvas.width = PIXELS;
    this.canvas.height = PIXELS;
    this.canvas.className = 'minimap-canvas';
    this.root.appendChild(this.canvas);
    const caption = document.createElement('div');
    caption.className = 'minimap-caption';
    caption.textContent = '🗺 Harta';
    this.root.appendChild(caption);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.root.classList.toggle('hidden', !visible);
  }

  // Called every frame; redraws only a few times a second
  update(now: number, world: World, px: number, pz: number, yaw: number): void {
    if (!this.visible) return;
    if (now - this.lastDraw < REDRAW_MS) {
      this.drawPlayer(yaw); // the arrow still turns smoothly
      return;
    }
    this.lastDraw = now;
    this.drawTerrain(world, px, pz);
    this.drawMarks(px, pz);
    this.drawPlayer(yaw);
  }

  private topColorAt(world: World, x: number, z: number): string | null {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const id = world.getBlock(x, y, z);
      if (id === BlockType.Air) continue;
      if (!isSolid(id) && id !== BlockType.Water) continue;
      return COLORS[id] ?? (BLOCKS[id] ? FALLBACK : null);
    }
    return null;
  }

  private drawTerrain(world: World, px: number, pz: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#e8d8b0'; // parchment showing through where nothing is loaded
    ctx.fillRect(0, 0, PIXELS, PIXELS);
    const half = SPAN / 2;
    const x0 = Math.floor(px - half);
    const z0 = Math.floor(pz - half);
    // One canvas rect per block would be 9216 fills; sample every 2 blocks and
    // draw a slightly larger square, which at this scale looks the same
    for (let dz = 0; dz < SPAN; dz += 2) {
      for (let dx = 0; dx < SPAN; dx += 2) {
        const color = this.topColorAt(world, x0 + dx, z0 + dz);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(dx * SCALE, dz * SCALE, SCALE * 2, SCALE * 2);
      }
    }
  }

  private drawMarks(px: number, pz: number): void {
    const ctx = this.ctx;
    const half = SPAN / 2;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    for (const mark of this.marks) {
      const mx = (mark.x - (px - half)) * SCALE;
      const mz = (mark.z - (pz - half)) * SCALE;
      if (mx < 0 || mx > PIXELS || mz < 0 || mz > PIXELS) continue;
      ctx.fillStyle = '#2b1808';
      ctx.beginPath();
      ctx.arc(mx, mz, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4ecd0';
      ctx.strokeStyle = '#2b1808';
      ctx.lineWidth = 3;
      ctx.strokeText(mark.label, mx, mz - 6);
      ctx.fillText(mark.label, mx, mz - 6);
    }
  }

  // The player's arrow, always at the centre, pointing where the camera looks.
  // Drawn straight over the terrain, so it needs the terrain redrawn under it
  // only when the map itself is refreshed.
  private drawPlayer(yaw: number): void {
    const ctx = this.ctx;
    const c = PIXELS / 2;
    ctx.save();
    ctx.translate(c, c);
    // Forward on screen is -z, and the world's forward is (-sin yaw, -cos yaw)
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#c8342a';
    ctx.fill();
    ctx.strokeStyle = '#f4ecd0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
