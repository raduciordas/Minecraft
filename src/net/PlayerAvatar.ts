import * as THREE from 'three';
import type { PlayerColor } from './NetworkClient';

function hsl(h: number, s: number, l: number): number {
  const c = new THREE.Color();
  c.setHSL(h / 360, s, l);
  return c.getHex();
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function leg(parent: THREE.Object3D, w: number, len: number, color: number, x: number, hipY: number, z: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(w, len, w);
  geometry.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, hipY, z);
  parent.add(mesh);
  return mesh;
}

function makeNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 12, 256, 40);
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.renderOrder = 999;
  return sprite;
}

export interface PlayerAvatarModel {
  group: THREE.Group;
  legs: THREE.Mesh[];
  arms: THREE.Mesh[];
}

// Every player's shirt/pants hue and head accessory are derived from a hash
// of their name (computed server-side), so each explorer has a distinct,
// consistent look without needing a real skin system.
export function buildPlayerAvatar(name: string, color: PlayerColor): PlayerAvatarModel {
  const group = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const arms: THREE.Mesh[] = [];

  const shirt = hsl(color.hue, 0.55, 0.5);
  const pants = hsl((color.hue + 40) % 360, 0.35, 0.28);
  const skin = 0xe0ac7a;

  box(group, 0.5, 0.7, 0.28, shirt, 0, 1.05, 0);
  const head = box(group, 0.45, 0.45, 0.45, skin, 0, 1.62, 0);
  for (const side of [-1, 1]) box(head, 0.08, 0.08, 0.02, 0x1c1c1c, side * 0.11, 0.03, -0.24);

  if (color.accessory === 1) {
    box(head, 0.5, 0.12, 0.5, 0x2b2b2b, 0, 0.29, 0); // cap
  } else if (color.accessory === 2) {
    box(head, 0.15, 0.15, 0.15, 0xffd54d, 0, 0.34, 0); // golden topper
  } else if (color.accessory === 3) {
    box(head, 0.52, 0.06, 0.52, 0xf2f2f2, 0, 0.27, 0); // headband
  }

  for (const side of [-1, 1]) {
    const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
    armGeo.translate(0, -0.31, 0);
    const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: shirt }));
    arm.position.set(side * 0.33, 1.38, 0);
    group.add(arm);
    arms.push(arm);
  }
  for (const side of [-1, 1]) legs.push(leg(group, 0.18, 0.7, pants, side * 0.14, 0.7, 0));

  const nameSprite = makeNameSprite(name);
  nameSprite.position.set(0, 2.15, 0);
  group.add(nameSprite);

  return { group, legs, arms };
}
