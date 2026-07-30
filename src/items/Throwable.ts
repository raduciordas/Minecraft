import * as THREE from 'three';

// Throwable ids live in [200, 300), above weapons and below any future
// category, so isWeapon/isThrowable never collide.
export const enum ThrowableId {
  SocataBottle = 200,
  HubaBuba = 201,
}

export interface ThrowableDef {
  name: string;
  blastRadius: number; // mobs within this radius of the impact point die
  shape: 'bottle' | 'gum';
  colors: { primary: number; secondary: number; accent: number };
  craftedOnly?: boolean; // excluded from the automatic starter-stock grant; must be earned
}

export const THROWABLES: Record<number, ThrowableDef> = {
  // craftedOnly: not part of the starter stock — earned only via Grajd.
  [ThrowableId.SocataBottle]: {
    name: 'Socată Fermentată',
    blastRadius: 3.5,
    shape: 'bottle',
    colors: { primary: 0x9fbf8a, secondary: 0xe6d9a3, accent: 0x8a5a2e },
    craftedOnly: true,
  },
  [ThrowableId.HubaBuba]: {
    name: 'Huba Bubă',
    blastRadius: 2.5,
    shape: 'gum',
    colors: { primary: 0xff6fa8, secondary: 0xff9dc4, accent: 0xffffff },
  },
};

export const THROWABLE_IDS: ThrowableId[] = [ThrowableId.SocataBottle, ThrowableId.HubaBuba];

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
  const def = THROWABLES[id];
  const { primary, secondary, accent } = def.colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };

  if (def.shape === 'gum') {
    // Wrapped chewing-gum piece: pink square with a paper-twist wrapper
    for (let x = 4; x <= 11; x++) {
      for (let y = 5; y <= 10; y++) px(x, y, primary);
    }
    for (let x = 4; x <= 11; x++) {
      px(x, 5, secondary);
      px(x, 10, secondary);
    }
    px(2, 6, accent);
    px(1, 5, accent);
    px(2, 9, accent);
    px(13, 6, accent);
    px(14, 5, accent);
    px(13, 9, accent);
  } else {
    // Cork + neck
    for (let x = 6; x <= 9; x++) px(x, 1, accent);
    for (let x = 6; x <= 9; x++) px(x, 2, accent);
    for (let x = 6; x <= 9; x++) px(x, 3, primary);
    // Bottle body
    for (let y = 4; y <= 13; y++) {
      const inset = y < 6 ? 2 : 0;
      for (let x = 4 + inset; x <= 11 - inset; x++) px(x, y, primary);
    }
    // Liquid fill
    for (let y = 7; y <= 12; y++) {
      for (let x = 5; x <= 10; x++) px(x, y, secondary);
    }
    // Glass shine
    px(5, 5, 0xdfe8d2);
    px(5, 8, 0xdfe8d2);
  }
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
  const def = THROWABLES[id];
  const { primary, secondary, accent } = def.colors;
  if (def.shape === 'gum') {
    box(group, 0.2, 0.14, 0.06, primary, 0, 0.2, 0);
    box(group, 0.22, 0.02, 0.08, accent, 0, 0.27, 0);
    box(group, 0.22, 0.02, 0.08, accent, 0, 0.13, 0);
  } else {
    box(group, 0.14, 0.22, 0.14, secondary, 0, 0.11, 0);
    box(group, 0.16, 0.08, 0.16, primary, 0, 0.26, 0);
    box(group, 0.07, 0.1, 0.07, primary, 0, 0.35, 0);
    box(group, 0.08, 0.05, 0.08, accent, 0, 0.42, 0);
  }
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
