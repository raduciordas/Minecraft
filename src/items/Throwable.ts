import * as THREE from 'three';

// Throwable ids live in [200, 300), above weapons and below any future
// category, so isWeapon/isThrowable never collide.
export const enum ThrowableId {
  TuicaBottle = 200,
}

export interface ThrowableDef {
  name: string;
  blastRadius: number; // mobs within this radius of the impact point die
  colors: { glass: number; liquid: number; cork: number };
}

export const THROWABLES: Record<number, ThrowableDef> = {
  [ThrowableId.TuicaBottle]: {
    name: 'Sticlă cu Țuică',
    blastRadius: 3.5,
    colors: { glass: 0x6b8f4e, liquid: 0xd9a441, cork: 0x8a5a2e },
  },
};

export const THROWABLE_IDS: ThrowableId[] = [ThrowableId.TuicaBottle];

export function isThrowable(id: number): boolean {
  return id >= 200 && id < 300;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// 16x16 pixel-art icon for the hotbar / inventory panel
export function makeThrowableIcon(id: ThrowableId): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const { glass, liquid, cork } = THROWABLES[id].colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };

  // Cork + neck
  for (let x = 6; x <= 9; x++) px(x, 1, cork);
  for (let x = 6; x <= 9; x++) px(x, 2, cork);
  for (let x = 6; x <= 9; x++) px(x, 3, glass);
  // Bottle body
  for (let y = 4; y <= 13; y++) {
    const inset = y < 6 ? 2 : 0;
    for (let x = 4 + inset; x <= 11 - inset; x++) px(x, y, glass);
  }
  // Liquid fill
  for (let y = 7; y <= 12; y++) {
    for (let x = 5; x <= 10; x++) px(x, y, liquid);
  }
  // Glass shine
  px(5, 5, 0xdfe8d2);
  px(5, 8, 0xdfe8d2);
  return canvas;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

// Small first-person model held in the corner of the screen, matching the
// scale and build style of buildWeaponModel in Weapon.ts.
export function buildThrowableModel(id: ThrowableId): THREE.Group {
  const group = new THREE.Group();
  const { glass, liquid, cork } = THROWABLES[id].colors;
  box(group, 0.14, 0.22, 0.14, liquid, 0, 0.11, 0);
  box(group, 0.16, 0.08, 0.16, glass, 0, 0.26, 0);
  box(group, 0.07, 0.1, 0.07, glass, 0, 0.35, 0);
  box(group, 0.08, 0.05, 0.08, cork, 0, 0.42, 0);
  return group;
}

export function disposeModel(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}
