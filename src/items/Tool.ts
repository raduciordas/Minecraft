import * as THREE from 'three';

// Tool ids live in [300, 400) — above throwables, so isWeapon/isThrowable/isTool
// never collide. Tools are inventory-tracked (like blocks) but never placed
// or thrown; the only one so far is the mining pickaxe.
export const enum ToolId {
  Tarnacop = 300,
}

export interface ToolDef {
  name: string;
  colors: { handle: number; head: number };
}

export const TOOLS: Record<number, ToolDef> = {
  [ToolId.Tarnacop]: {
    name: 'Târnăcop',
    colors: { handle: 0x8a5a2e, head: 0x8d8d8d },
  },
};

export const TOOL_IDS: ToolId[] = [ToolId.Tarnacop];

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
  const { handle, head } = TOOLS[id].colors;
  const px = (x: number, y: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, 1, 1);
  };

  // Diagonal handle
  for (let i = 0; i <= 10; i++) px(3 + i, 13 - i, handle);
  // Angled pickaxe head across the top
  for (let i = 0; i <= 6; i++) {
    px(2 + i, 2 + Math.floor(i / 2), head);
    px(13 - i, 2 + Math.floor(i / 2), head);
  }
  px(7, 1, head);
  px(8, 1, head);
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
  box(group, 0.05, 0.62, 0.05, handle, 0, 0.05, 0);
  const pick = box(group, 0.42, 0.09, 0.09, head, 0, 0.4, 0);
  pick.rotation.z = 0.5;
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
