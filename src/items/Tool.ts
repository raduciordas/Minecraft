import * as THREE from 'three';

// Tool ids live in [300, 400) — above throwables, so isWeapon/isThrowable/isTool
// never collide. Tools are inventory-tracked (like blocks) but never placed
// or thrown; what each one does is wired in Game.ts (breakBlock/placeBlock).
export const enum ToolId {
  Tarnacop = 300, // mines stone, crystal, obsidian…
  Topor = 301, // a felled log gives three
  Lopata = 302, // digs three blocks of earth at once
  Busola = 303, // points home (later zone)
  Undita = 304, // fish from any water
  Galeata = 305, // scoops water up…
  GaleataPlina = 306, // …and pours it out again
}

export interface ToolDef {
  name: string;
  shape: 'pickaxe' | 'axe' | 'shovel' | 'compass' | 'rod' | 'bucket' | 'bucket_full';
  colors: { handle: number; head: number };
}

export const TOOLS: Record<number, ToolDef> = {
  [ToolId.Tarnacop]: { name: 'Târnăcop', shape: 'pickaxe', colors: { handle: 0x8a5a2e, head: 0x8d8d8d } },
  [ToolId.Topor]: { name: 'Topor', shape: 'axe', colors: { handle: 0x8a5a2e, head: 0x9a9a9a } },
  [ToolId.Lopata]: { name: 'Lopată', shape: 'shovel', colors: { handle: 0x8a5a2e, head: 0x7a7a7a } },
  [ToolId.Undita]: { name: 'Undiță', shape: 'rod', colors: { handle: 0xa07a48, head: 0xd8d8d8 } },
  [ToolId.Galeata]: { name: 'Găleată', shape: 'bucket', colors: { handle: 0x4a4a4a, head: 0x8a8a8a } },
  [ToolId.GaleataPlina]: { name: 'Găleată cu apă', shape: 'bucket_full', colors: { handle: 0x4a4a4a, head: 0x3a78d8 } },
};

export const TOOL_IDS: ToolId[] = [ToolId.Tarnacop, ToolId.Topor, ToolId.Lopata, ToolId.Undita, ToolId.Galeata, ToolId.GaleataPlina];

export function isTool(id: number): boolean {
  return id >= 300 && id < 400;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// 16x16 pixel-art icon for the hotbar / inventory panel
export function makeToolIcon(id: ToolId): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const { handle, head, } = TOOLS[id].colors;
  const shape = TOOLS[id].shape;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) px(x, y, color);
  };

  switch (shape) {
    case 'pickaxe':
      for (let i = 0; i <= 10; i++) px(3 + i, 13 - i, handle);
      for (let i = 0; i <= 6; i++) {
        px(2 + i, 2 + Math.floor(i / 2), head);
        px(13 - i, 2 + Math.floor(i / 2), head);
      }
      px(7, 1, head);
      px(8, 1, head);
      break;
    case 'axe':
      for (let i = 0; i <= 10; i++) px(3 + i, 13 - i, handle);
      rect(9, 1, 13, 5, head);
      px(14, 2, head);
      px(14, 4, head);
      px(8, 2, head);
      break;
    case 'shovel':
      for (let i = 0; i <= 9; i++) px(3 + i, 13 - i, handle);
      rect(10, 1, 14, 5, head);
      px(12, 6, head);
      break;
    case 'compass':
      rect(4, 2, 11, 13, head);
      rect(3, 3, 12, 12, head);
      rect(5, 4, 10, 11, 0xf4ecd0);
      px(7, 5, 0xc8342a);
      px(8, 6, 0xc8342a);
      px(7, 9, 0x222222);
      px(8, 10, 0x222222);
      break;
    case 'rod':
      for (let i = 0; i <= 11; i++) px(2 + i, 14 - i, handle);
      for (let y = 3; y <= 11; y++) px(14, y, head);
      px(13, 12, head);
      px(13, 13, 0xc8342a);
      break;
    case 'bucket':
    case 'bucket_full':
      for (let x = 4; x <= 11; x++) px(x, 3, handle);
      px(3, 4, handle);
      px(12, 4, handle);
      rect(3, 5, 12, 13, 0x8a8a8a);
      rect(4, 14, 11, 14, 0x6a6a6a);
      if (shape === 'bucket_full') rect(4, 6, 11, 8, head);
      else rect(4, 6, 11, 7, 0x6a6a6a);
      break;
  }
  return canvas;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Small first-person model held in the corner of the screen, matching the
// scale and build style of buildWeaponModel in Weapon.ts.
export function buildToolModel(id: ToolId): THREE.Group {
  const group = new THREE.Group();
  const { handle, head } = TOOLS[id].colors;
  switch (TOOLS[id].shape) {
    case 'pickaxe': {
      box(group, 0.05, 0.62, 0.05, handle, 0, 0.05, 0);
      const pick = box(group, 0.42, 0.09, 0.09, head, 0, 0.4, 0);
      pick.rotation.z = 0.5;
      break;
    }
    case 'axe':
      box(group, 0.05, 0.62, 0.05, handle, 0, 0.05, 0);
      box(group, 0.2, 0.16, 0.05, head, 0.1, 0.36, 0);
      break;
    case 'shovel':
      box(group, 0.045, 0.62, 0.045, handle, 0, 0.05, 0);
      box(group, 0.14, 0.18, 0.03, head, 0, 0.42, 0);
      break;
    case 'compass':
      box(group, 0.14, 0.03, 0.14, head, 0, 0.05, 0);
      box(group, 0.02, 0.01, 0.08, 0xc8342a, 0, 0.07, 0);
      break;
    case 'rod': {
      const rod = box(group, 0.03, 0.8, 0.03, handle, 0.05, 0.25, 0);
      rod.rotation.z = -0.35;
      box(group, 0.005, 0.4, 0.005, head, 0.28, 0.35, 0);
      break;
    }
    case 'bucket':
    case 'bucket_full':
      box(group, 0.16, 0.16, 0.16, 0x8a8a8a, 0, 0.05, 0);
      box(group, 0.18, 0.015, 0.015, handle, 0, 0.14, 0);
      if (TOOLS[id].shape === 'bucket_full') box(group, 0.13, 0.02, 0.13, head, 0, 0.12, 0);
      break;
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
