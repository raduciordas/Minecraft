import * as THREE from 'three';

// Passive gear: things that work just by being in your pack — no slots to
// equip, no wearing. Ids live in [500, 600). Game.passives() adds up every
// owned piece's bonus once a frame.
export const enum GearId {
  AmuletaUsturoi = 500, // monsters notice you from half as far
  Cojoc = 502, // −1 damage taken
  OpinciIuti = 503, // faster on foot, longer safe falls
  MascaPrisacar = 504, // wasps can't sting you
  CamasaZale = 505, // −2 damage taken
  AripileZmeului = 506, // unlocks flight (F)
}

export interface GearDef {
  name: string;
  shape: 'amulet' | 'coat' | 'boots' | 'mask' | 'mail' | 'wings';
  colors: { main: number; accent: number };
  notStarterStock: true; // every piece of gear is earned
}

export const GEAR: Record<number, GearDef> = {
  [GearId.AmuletaUsturoi]: { name: 'Amuletă de usturoi', shape: 'amulet', colors: { main: 0xf0ead8, accent: 0x8a6a3a }, notStarterStock: true },
  [GearId.AripileZmeului]: { name: 'Aripile Zmeului', shape: 'wings', colors: { main: 0x7a2416, accent: 0xe8b34d }, notStarterStock: true },
};

export const GEAR_IDS: GearId[] = [GearId.AmuletaUsturoi, GearId.AripileZmeului];

export function isGear(id: number): boolean {
  return id >= 500 && id < 600;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// 16x16 pixel-art icon for the hotbar / inventory panel
export function makeGearIcon(id: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const def = GEAR[id];
  const { main, accent } = def.colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) px(x, y, color);
  };
  switch (def.shape) {
    case 'amulet':
      // A string with garlic bulbs strung on it
      for (let x = 1; x < 15; x++) px(x, 4 + Math.round(Math.sin(x / 2) * 1.5), accent);
      for (const x of [3, 8, 12]) {
        rect(x - 1, 7, x + 1, 10, main);
        px(x, 6, 0x9ab86a);
        px(x, 11, main);
      }
      break;
    case 'wings':
      // Two spread dragon wings joined at a golden clasp
      for (let i = 0; i < 6; i++) {
        rect(7 - i, 3 + i, 7 - i, 8 + i, main);
        rect(8 + i, 3 + i, 8 + i, 8 + i, main);
      }
      rect(1, 9, 6, 9, main);
      rect(9, 9, 14, 9, main);
      rect(7, 7, 8, 10, accent);
      break;
    default:
      rect(3, 3, 12, 12, main);
      rect(5, 5, 10, 10, accent);
  }
  return canvas;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

// Small first-person model for when a piece of gear is selected in the hotbar
export function buildGearModel(id: number): THREE.Group {
  const group = new THREE.Group();
  const def = GEAR[id];
  const { main, accent } = def.colors;
  switch (def.shape) {
    case 'amulet':
      box(group, 0.2, 0.01, 0.01, accent, 0, 0.08, 0);
      for (const x of [-0.07, 0, 0.07]) box(group, 0.04, 0.05, 0.04, main, x, 0.04, 0);
      break;
    case 'wings':
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.08), new THREE.MeshLambertMaterial({ color: main }));
        wing.position.set(side * 0.1, 0.06, 0);
        wing.rotation.z = side * 0.5;
        group.add(wing);
      }
      box(group, 0.04, 0.05, 0.03, accent, 0, 0.05, 0);
      break;
    default:
      box(group, 0.12, 0.12, 0.05, main, 0, 0.05, 0);
  }
  group.position.set(0, 0.08, 0.05);
  group.rotation.y = 0.5;
  return group;
}
