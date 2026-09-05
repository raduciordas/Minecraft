import * as THREE from 'three';
import { BlockType } from '../world/Block';

// Things you eat. Ids live in [400, 500) — above tools — so no category
// test ever collides. Pâine keeps its old BlockType id (saves already hold
// it) but is a consumable in every other way, so it's listed here too.
export const enum ConsumableId {
  Cozonac = 400,
  Placinta = 401,
  Mar = 402,
  Peste = 403,
}

export interface StatusEffectDef {
  kind: 'speed' | 'regen';
  seconds: number;
  factor: number; // speed multiplier, or regeneration-rate multiplier
}

export interface ConsumableDef {
  name: string;
  heal: number; // hp restored (2 per heart)
  effect?: StatusEffectDef;
  shape: 'loaf' | 'cozonac' | 'pie' | 'apple' | 'fish';
  colors: { main: number; accent: number };
  notStarterStock: true; // every food is earned
}

export const CONSUMABLES: Record<number, ConsumableDef> = {
  [BlockType.Paine]: { name: 'Pâine', heal: 2, shape: 'loaf', colors: { main: 0xc98d3a, accent: 0xa06a26 }, notStarterStock: true },
  [ConsumableId.Cozonac]: {
    name: 'Cozonac',
    heal: 6,
    effect: { kind: 'regen', seconds: 15, factor: 2 },
    shape: 'cozonac',
    colors: { main: 0xb8742e, accent: 0x5a3416 },
    notStarterStock: true,
  },
  [ConsumableId.Placinta]: { name: 'Plăcintă cu brânză', heal: 5, shape: 'pie', colors: { main: 0xd9a64a, accent: 0xf4ecd0 }, notStarterStock: true },
  [ConsumableId.Mar]: { name: 'Măr', heal: 2, shape: 'apple', colors: { main: 0xc8342a, accent: 0x5a8a2a }, notStarterStock: true },
  [ConsumableId.Peste]: { name: 'Pește', heal: 4, shape: 'fish', colors: { main: 0x8aa8c0, accent: 0xd8e4ec }, notStarterStock: true },
};

export const CONSUMABLE_IDS: number[] = [BlockType.Paine, ConsumableId.Cozonac, ConsumableId.Placinta, ConsumableId.Mar, ConsumableId.Peste];

// Pâine included: anything you eat rather than place
export function isConsumable(id: number): boolean {
  return id === BlockType.Paine || (id >= 400 && id < 500);
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// 16x16 pixel-art icon for the hotbar / inventory panel
export function makeConsumableIcon(id: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const def = CONSUMABLES[id];
  const { main, accent } = def.colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) px(x, y, color);
  };
  switch (def.shape) {
    case 'loaf':
      rect(2, 6, 13, 12, main);
      rect(3, 5, 12, 5, main);
      for (let i = 0; i < 3; i++) px(5 + i * 3, 7, accent);
      break;
    case 'cozonac':
      // A tall braided loaf with a dark swirl of walnut
      rect(3, 4, 12, 13, main);
      rect(4, 3, 11, 3, main);
      for (let y = 5; y <= 12; y += 2) px(4 + ((y / 2) % 3) * 3, y, accent);
      for (let y = 4; y <= 13; y += 3) rect(3, y, 12, y, 0xd9955a);
      break;
    case 'pie':
      rect(1, 7, 14, 12, main);
      rect(2, 6, 13, 6, main);
      rect(3, 8, 12, 9, accent);
      for (let x = 2; x <= 13; x += 3) px(x, 11, 0x9a6a2a);
      break;
    case 'apple':
      rect(4, 5, 11, 12, main);
      rect(3, 6, 12, 11, main);
      rect(5, 13, 10, 13, main);
      px(7, 3, 0x5a3416);
      px(7, 4, 0x5a3416);
      rect(8, 3, 10, 4, accent);
      px(5, 6, 0xf0a090);
      break;
    case 'fish':
      rect(3, 6, 10, 10, main);
      rect(2, 7, 11, 9, main);
      rect(11, 6, 13, 10, main);
      px(12, 8, accent);
      px(4, 7, 0x222222);
      for (let x = 5; x <= 9; x += 2) px(x, 8, accent);
      break;
  }
  return canvas;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

// Small first-person model, sized like a held block
export function buildConsumableModel(id: number): THREE.Group {
  const group = new THREE.Group();
  const def = CONSUMABLES[id];
  const { main, accent } = def.colors;
  switch (def.shape) {
    case 'loaf':
    case 'cozonac':
      box(group, 0.16, 0.055, 0.1, main, 0, -0.025, 0);
      box(group, 0.13, 0.04, 0.085, main, 0, 0.015, 0);
      box(group, 0.09, 0.03, 0.06, main, 0, 0.045, 0);
      box(group, 0.1, 0.006, 0.012, accent, 0, 0.058, 0);
      break;
    case 'pie':
      box(group, 0.17, 0.04, 0.17, main, 0, -0.02, 0);
      box(group, 0.13, 0.03, 0.13, accent, 0, 0.015, 0);
      break;
    case 'apple':
      box(group, 0.11, 0.1, 0.11, main, 0, 0, 0);
      box(group, 0.02, 0.04, 0.02, 0x5a3416, 0, 0.07, 0);
      box(group, 0.05, 0.01, 0.03, accent, 0.03, 0.08, 0);
      break;
    case 'fish':
      box(group, 0.16, 0.06, 0.04, main, 0, 0, 0);
      box(group, 0.05, 0.08, 0.02, accent, 0.1, 0, 0);
      break;
  }
  group.position.set(0, 0.08, 0.05);
  group.rotation.y = 0.5;
  return group;
}
