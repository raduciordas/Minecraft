import * as THREE from 'three';

// Weapon ids live above 100 so they never collide with block ids
export const enum WeaponId {
  StormSword = 100,
  CrystalSword = 101,
  MagmaHammer = 102,
  IceSpear = 103,
  BataCiobanului = 104, // the shepherd's staff: modest bite, long reach, big shove
  Arc = 105, // bow: fires an arrow (see Projectile.ts) — the answer to the Zmeu
}

export interface WeaponDef {
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  knockback: number;
  slowSeconds?: number; // ice spear chills its target
  ranged?: boolean; // shoots an arrow instead of swinging
  notStarterStock?: boolean; // must be earned; without one in the pack you swing bare-handed
  shape?: 'sword' | 'hammer' | 'spear' | 'club' | 'bow';
  colors: { blade: number; accent: number; handle: number };
}

export const WEAPONS: Record<number, WeaponDef> = {
  [WeaponId.StormSword]: {
    name: 'Storm Sword',
    damage: 4, // zombie (8 hp) dies in exactly 2 hits
    range: 3.5,
    cooldown: 0.4,
    knockback: 8,
    colors: { blade: 0xffe14d, accent: 0x4db8ff, handle: 0x5a3d1e },
  },
  [WeaponId.CrystalSword]: {
    notStarterStock: true,
    name: 'Crystal Sword',
    damage: 6,
    range: 3.5,
    cooldown: 0.45,
    knockback: 9,
    colors: { blade: 0x7df0e8, accent: 0xc77dff, handle: 0x3a2b52 },
  },
  [WeaponId.MagmaHammer]: {
    notStarterStock: true,
    name: 'Magma Hammer',
    damage: 8,
    range: 3,
    cooldown: 0.9,
    knockback: 16,
    colors: { blade: 0xff7a2f, accent: 0x7a3010, handle: 0x6b6b6b },
  },
  [WeaponId.IceSpear]: {
    notStarterStock: true, // the Fântâna reward
    name: 'Ice Spear',
    damage: 3,
    range: 5.5,
    cooldown: 0.5,
    knockback: 6,
    slowSeconds: 2,
    colors: { blade: 0xd9d9d9, accent: 0x5aa7e8, handle: 0x8a6a48 },
  },
  [WeaponId.BataCiobanului]: {
    notStarterStock: true, // the Gardul Luncii reward
    name: 'Bâta ciobanului',
    damage: 3,
    range: 4.5,
    cooldown: 0.5,
    knockback: 14,
    shape: 'club',
    colors: { blade: 0x8a6a3a, accent: 0x5a3a1a, handle: 0x8a6a3a },
  },
  [WeaponId.Arc]: {
    notStarterStock: true, // the Culesul de ciuperci reward
    name: 'Arc cu săgeți',
    damage: 4,
    range: 30,
    cooldown: 0.7,
    knockback: 4,
    ranged: true,
    shape: 'bow',
    colors: { blade: 0xa07a48, accent: 0xe8e0d0, handle: 0x5a3a1a },
  },
};

export const WEAPON_IDS: WeaponId[] = [
  WeaponId.StormSword,
  WeaponId.CrystalSword,
  WeaponId.MagmaHammer,
  WeaponId.IceSpear,
  WeaponId.BataCiobanului,
  WeaponId.Arc,
];

// Weapon ids occupy [100, 200); throwables (see Throwable.ts) start at 200
export function isWeapon(id: number): boolean {
  return id >= 100 && id < 200;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// 16x16 pixel-art icon for the hotbar / inventory panel
export function makeWeaponIcon(id: WeaponId): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const { blade, accent, handle } = WEAPONS[id].colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };

  const shape = WEAPONS[id].shape;
  if (id === WeaponId.MagmaHammer) {
    for (let y = 6; y <= 15; y++) {
      px(7, y, handle);
      px(8, y, handle);
    }
    for (let x = 3; x <= 12; x++) {
      for (let y = 1; y <= 5; y++) px(x, y, blade);
      px(x, 1, accent);
      px(x, 5, accent);
    }
  } else if (shape === 'club') {
    // A shepherd's crook: long diagonal staff with a hooked head
    for (let i = 0; i <= 11; i++) px(2 + i, 14 - i, handle);
    px(13, 2, blade);
    px(12, 1, blade);
    px(11, 1, blade);
    px(10, 2, accent);
    px(13, 3, accent);
  } else if (shape === 'bow') {
    // A curved bow with its string, an arrow nocked across it
    for (let y = 2; y <= 13; y++) px(y < 5 || y > 10 ? 6 : 4, y, blade);
    px(5, 5, blade);
    px(5, 10, blade);
    for (let y = 2; y <= 13; y++) px(9, y, accent);
    for (let x = 4; x <= 13; x++) px(x, 8, handle);
    px(13, 7, 0x9a9a9a);
    px(13, 9, 0x9a9a9a);
  } else if (id === WeaponId.IceSpear) {
    for (let i = 0; i <= 10; i++) px(2 + i, 13 - i, handle);
    px(13, 2, blade);
    px(14, 1, blade);
    px(12, 3, blade);
    px(13, 3, accent);
    px(12, 2, accent);
  } else {
    // Swords: broad diagonal blade with an accent edge, guard and handle
    for (let i = 0; i <= 8; i++) {
      px(5 + i, 11 - i, blade);
      px(6 + i, 11 - i, blade);
      px(5 + i, 10 - i, accent);
    }
    px(14, 2, blade);
    px(4, 12, accent);
    px(5, 13, accent);
    px(3, 11, accent);
    px(3, 13, handle);
    px(2, 14, handle);
    px(1, 15, handle);
  }
  return canvas;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

// Small first-person model held in the corner of the screen, built along +Y
export function buildWeaponModel(id: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const { blade, accent, handle } = WEAPONS[id].colors;

  const shape = WEAPONS[id].shape;
  if (id === WeaponId.MagmaHammer) {
    box(group, 0.055, 0.6, 0.055, handle, 0, 0.15, 0);
    box(group, 0.3, 0.17, 0.17, blade, 0, 0.48, 0);
    box(group, 0.31, 0.04, 0.18, accent, 0, 0.55, 0);
  } else if (shape === 'club') {
    box(group, 0.045, 0.85, 0.045, handle, 0, 0.22, 0);
    box(group, 0.12, 0.045, 0.045, blade, 0.04, 0.66, 0);
    box(group, 0.045, 0.08, 0.045, accent, 0.08, 0.6, 0);
  } else if (shape === 'bow') {
    box(group, 0.035, 0.7, 0.035, blade, 0, 0.3, 0);
    box(group, 0.08, 0.035, 0.035, blade, -0.03, 0.64, 0);
    box(group, 0.08, 0.035, 0.035, blade, -0.03, -0.04, 0);
    box(group, 0.006, 0.68, 0.006, accent, -0.07, 0.3, 0);
    box(group, 0.3, 0.012, 0.012, handle, 0.06, 0.3, 0);
  } else if (id === WeaponId.IceSpear) {
    box(group, 0.04, 0.85, 0.04, handle, 0, 0.22, 0);
    box(group, 0.07, 0.16, 0.07, blade, 0, 0.7, 0);
    box(group, 0.045, 0.08, 0.045, accent, 0, 0.8, 0);
  } else {
    box(group, 0.05, 0.16, 0.05, handle, 0, 0, 0);
    box(group, 0.17, 0.035, 0.06, accent, 0, 0.09, 0);
    box(group, 0.06, 0.44, 0.025, blade, 0, 0.32, 0);
    box(group, 0.035, 0.07, 0.025, blade, 0, 0.56, 0);
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
