import * as THREE from 'three';
import { Tile } from '../world/Block';

const ATLAS_TILES = 16; // 16x16 grid
const TILE_PX = 16;
const ATLAS_PX = ATLAS_TILES * TILE_PX;

interface TileSpec {
  base: [number, number, number];
  variation: number; // per-pixel brightness noise amplitude (0..1)
  transparentBase?: boolean; // base pixels are fully transparent (glass); draw() marks opaque ones
  draw?: (px: (x: number, y: number, r: number, g: number, b: number) => void, rand: () => number) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRASS_GREEN: [number, number, number] = [106, 170, 64];
const DIRT_BROWN: [number, number, number] = [134, 96, 67];

const TILE_SPECS: Record<number, TileSpec> = {
  [Tile.GrassTop]: { base: GRASS_GREEN, variation: 0.12 },
  [Tile.GrassSide]: {
    base: DIRT_BROWN,
    variation: 0.12,
    draw: (px, rand) => {
      // Green strip on top with a ragged lower edge
      for (let x = 0; x < TILE_PX; x++) {
        const depth = 3 + Math.floor(rand() * 2);
        for (let y = 0; y < depth; y++) {
          const v = 1 - 0.12 + rand() * 0.24;
          px(x, y, GRASS_GREEN[0] * v, GRASS_GREEN[1] * v, GRASS_GREEN[2] * v);
        }
      }
    },
  },
  [Tile.Dirt]: { base: DIRT_BROWN, variation: 0.14 },
  [Tile.Stone]: { base: [125, 125, 125], variation: 0.1 },
  [Tile.Sand]: { base: [219, 207, 163], variation: 0.08 },
  [Tile.LogSide]: {
    base: [102, 81, 50],
    variation: 0.06,
    draw: (px, rand) => {
      // Vertical bark streaks
      for (let x = 0; x < TILE_PX; x++) {
        if (rand() < 0.35) {
          const shade = 0.6 + rand() * 0.15;
          for (let y = 0; y < TILE_PX; y++) {
            if (rand() < 0.85) px(x, y, 102 * shade, 81 * shade, 50 * shade);
          }
        }
      }
    },
  },
  [Tile.LogTop]: {
    base: [102, 81, 50],
    variation: 0.05,
    draw: (px) => {
      // Concentric rings
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          if (Math.floor(d) % 2 === 0) px(x, y, 160, 130, 85);
        }
      }
    },
  },
  [Tile.Leaves]: {
    base: [58, 122, 40],
    variation: 0.2,
    draw: (px, rand) => {
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          if (rand() < 0.25) px(x, y, 38, 90, 26);
        }
      }
    },
  },
  [Tile.Plank]: {
    base: [178, 143, 90],
    variation: 0.06,
    draw: (px) => {
      // Horizontal board seams
      for (let x = 0; x < TILE_PX; x++) {
        for (const y of [3, 7, 11, 15]) px(x, y, 120, 94, 58);
      }
    },
  },
  [Tile.Water]: {
    base: [48, 96, 200],
    variation: 0.08,
    draw: (px, rand) => {
      // Faint wave highlights
      for (let y = 0; y < TILE_PX; y += 4) {
        for (let x = 0; x < TILE_PX; x++) {
          if (rand() < 0.4) px(x, y, 90, 140, 225);
        }
      }
    },
  },
  [Tile.Cobble]: {
    base: [112, 112, 112],
    variation: 0.12,
    draw: (px, rand) => {
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          const r = rand();
          if (r < 0.14) px(x, y, 72, 72, 72);
          else if (r > 0.92) px(x, y, 150, 150, 150);
        }
      }
    },
  },
  [Tile.Brick]: {
    base: [152, 72, 60],
    variation: 0.08,
    draw: (px) => {
      // Mortar: horizontal courses + staggered vertical joints
      for (let x = 0; x < TILE_PX; x++) {
        for (const y of [3, 7, 11, 15]) px(x, y, 176, 168, 160);
      }
      for (const [x, y0] of [[7, 0], [3, 4], [11, 4], [7, 8], [3, 12], [11, 12]] as const) {
        for (let y = y0; y < y0 + 3; y++) px(x, y, 176, 168, 160);
      }
    },
  },
  [Tile.Snow]: { base: [236, 241, 246], variation: 0.04 },
  [Tile.Glass]: {
    base: [0, 0, 0],
    variation: 0,
    transparentBase: true,
    draw: (px) => {
      // Frame + a couple of diagonal shine streaks
      for (let i = 0; i < TILE_PX; i++) {
        px(i, 0, 208, 228, 240);
        px(i, 15, 208, 228, 240);
        px(0, i, 208, 228, 240);
        px(15, i, 208, 228, 240);
      }
      for (let i = 2; i < 7; i++) px(i + 4, i, 228, 242, 250);
      for (let i = 6; i < 10; i++) px(i + 3, i, 228, 242, 250);
    },
  },
  [Tile.StoneBrick]: {
    base: [122, 122, 122],
    variation: 0.08,
    draw: (px) => {
      // Two courses of large bricks with dark seams
      for (let x = 0; x < TILE_PX; x++) {
        px(x, 0, 84, 84, 84);
        px(x, 8, 84, 84, 84);
      }
      for (let y = 1; y < 8; y++) px(7, y, 84, 84, 84);
      for (let y = 9; y < 16; y++) {
        px(3, y, 84, 84, 84);
        px(11, y, 84, 84, 84);
      }
    },
  },
  [Tile.Crystal]: {
    base: [138, 92, 214],
    variation: 0.16,
    draw: (px, rand) => {
      // Faceted violet crystal: a bright diagonal shard plus scattered sparkle
      for (let i = 0; i < TILE_PX; i++) {
        px(i, (i + 3) % TILE_PX, 210, 170, 255);
        px((i + 8) % TILE_PX, (TILE_PX - 1 - i), 100, 60, 170);
      }
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          if (rand() < 0.07) px(x, y, 235, 220, 255);
        }
      }
    },
  },
  [Tile.Mamaliga]: {
    base: [235, 199, 86],
    variation: 0.1,
    draw: (px, rand) => {
      // Toasted crust speckles on a corn-yellow slab
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          if (rand() < 0.06) px(x, y, 179, 133, 46);
          else if (rand() < 0.03) px(x, y, 250, 226, 150);
        }
      }
    },
  },
  [Tile.Lamp]: {
    base: [255, 227, 150],
    variation: 0.05,
    draw: (px) => {
      // Lantern casing: a darker frame around a bright glowing pane
      for (let i = 0; i < TILE_PX; i++) {
        px(i, 0, 120, 96, 55);
        px(i, 15, 120, 96, 55);
        px(0, i, 120, 96, 55);
        px(15, i, 120, 96, 55);
      }
      for (let x = 3; x < 13; x++) {
        for (let y = 3; y < 13; y++) px(x, y, 255, 245, 200);
      }
    },
  },
  [Tile.DoorClosed]: {
    base: [150, 112, 66],
    variation: 0.05,
    draw: (px) => {
      // Two raised panels plus a knob, like a plank door
      for (let i = 0; i < TILE_PX; i++) {
        px(i, 0, 96, 70, 38);
        px(i, 15, 96, 70, 38);
        px(0, i, 96, 70, 38);
        px(15, i, 96, 70, 38);
      }
      px(7, 7, 96, 70, 38);
      px(8, 7, 96, 70, 38);
      for (const y of [5, 10]) for (let x = 2; x < 14; x++) px(x, y, 110, 82, 46);
      px(12, 8, 224, 190, 90); // knob
    },
  },
  [Tile.Chirpici]: {
    base: [196, 168, 110],
    variation: 0.1,
    draw: (px, rand) => {
      // Straw flecks through sun-dried clay
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          if (rand() < 0.05) px(x, y, 226, 202, 120);
          else if (rand() < 0.02) px(x, y, 140, 110, 70);
        }
      }
    },
  },
  [Tile.Obsidian]: {
    base: [24, 18, 36],
    variation: 0.06,
    draw: (px, rand) => {
      // Glassy volcanic sheen: scattered violet highlights
      for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
          if (rand() < 0.05) px(x, y, 90, 70, 130);
        }
      }
    },
  },
  [Tile.Hay]: {
    base: [199, 163, 58],
    variation: 0.08,
    draw: (px) => {
      // Bound straw bundle: horizontal courses plus a couple of twine wraps
      for (let x = 0; x < TILE_PX; x++) {
        for (const y of [2, 5, 8, 11, 14]) px(x, y, 160, 128, 40);
      }
      for (let y = 0; y < TILE_PX; y++) {
        px(3, y, 110, 84, 30);
        px(12, y, 110, 84, 30);
      }
    },
  },
};

export class TextureAtlas {
  readonly texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;

  constructor(seed: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_PX;
    this.canvas.height = ATLAS_PX;
    const ctx = this.canvas.getContext('2d')!;

    for (const [tileStr, spec] of Object.entries(TILE_SPECS)) {
      const tile = Number(tileStr);
      const ox = (tile % ATLAS_TILES) * TILE_PX;
      const oy = Math.floor(tile / ATLAS_TILES) * TILE_PX;
      const rand = mulberry32(seed + tile * 101);
      const img = ctx.createImageData(TILE_PX, TILE_PX);

      for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          const v = 1 - spec.variation + rand() * spec.variation * 2;
          const i = (y * TILE_PX + x) * 4;
          img.data[i] = Math.min(255, spec.base[0] * v);
          img.data[i + 1] = Math.min(255, spec.base[1] * v);
          img.data[i + 2] = Math.min(255, spec.base[2] * v);
          img.data[i + 3] = spec.transparentBase ? 0 : 255;
        }
      }
      spec.draw?.((x, y, r, g, b) => {
        const i = (y * TILE_PX + x) * 4;
        img.data[i] = Math.min(255, r);
        img.data[i + 1] = Math.min(255, g);
        img.data[i + 2] = Math.min(255, b);
        img.data[i + 3] = 255;
      }, mulberry32(seed + tile * 211));
      ctx.putImageData(img, ox, oy);
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter; // no mipmaps: avoids atlas bleeding
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  // UV rect for a tile: [u0, v0, u1, v1] with v flipped (canvas y-down -> UV y-up)
  getUVs(tile: number): [number, number, number, number] {
    const col = tile % ATLAS_TILES;
    const row = Math.floor(tile / ATLAS_TILES);
    const u0 = col / ATLAS_TILES;
    const v1 = 1 - row / ATLAS_TILES;
    const v0 = 1 - (row + 1) / ATLAS_TILES;
    return [u0, v0, u0 + 1 / ATLAS_TILES, v1];
  }

  // Small canvas copy of one tile, for hotbar icons.
  makeTileIcon(tile: number): HTMLCanvasElement {
    const icon = document.createElement('canvas');
    icon.width = TILE_PX;
    icon.height = TILE_PX;
    const ctx = icon.getContext('2d')!;
    const ox = (tile % ATLAS_TILES) * TILE_PX;
    const oy = Math.floor(tile / ATLAS_TILES) * TILE_PX;
    ctx.drawImage(this.canvas, ox, oy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
    return icon;
  }
}
