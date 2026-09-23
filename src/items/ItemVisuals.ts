import * as THREE from 'three';

export type VoxelFinish = 'matte' | 'polished' | 'glossy';

export function tintColor(color: number, amount = 0.3): number {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), amount).getHex();
}

export function shadeColor(color: number, factor = 0.65): number {
  return new THREE.Color(color).multiplyScalar(factor).getHex();
}

export function voxelMaterial(color: number, finish: VoxelFinish = 'matte'): THREE.MeshStandardMaterial {
  const base = new THREE.Color(color);
  const emissive = base.clone().multiplyScalar(0.008);
  const settings = finish === 'polished'
    ? { roughness: 0.42, metalness: 0.2 }
    : finish === 'glossy'
      ? { roughness: 0.22, metalness: 0.12 }
      : { roughness: 0.86, metalness: 0.0 };
  return new THREE.MeshStandardMaterial({ color: base, emissive, ...settings });
}

export function voxelBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  finish: VoxelFinish = 'matte',
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), voxelMaterial(color, finish));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Adds a dark pixel outline, saturated colours and directional edge lighting
// to every non-block inventory icon while preserving its original silhouette.
export function polishItemIcon(source: HTMLCanvasElement): HTMLCanvasElement {
  const src = source.getContext('2d')!.getImageData(0, 0, source.width, source.height);
  const out = document.createElement('canvas');
  out.width = source.width + 4;
  out.height = source.height + 4;
  const ctx = out.getContext('2d')!;
  const data = ctx.createImageData(out.width, out.height);
  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return 0;
    return src.data[(y * source.width + x) * 4 + 3];
  };
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    const i = (y * out.width + x) * 4;
    data.data[i] = r;
    data.data[i + 1] = g;
    data.data[i + 2] = b;
    data.data[i + 3] = a;
  };

  // Silhouette and a one-pixel cast shadow.
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!alphaAt(x, y)) continue;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox || oy) put(x + ox + 2, y + oy + 2, 24, 27, 38, 235);
        }
      }
      put(x + 3, y + 4, 10, 12, 20, 150);
    }
  }

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      const alpha = src.data[i + 3];
      if (!alpha) continue;
      const r = src.data[i];
      const g = src.data[i + 1];
      const b = src.data[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const topEdge = !alphaAt(x, y - 1) || !alphaAt(x - 1, y);
      const bottomEdge = !alphaAt(x, y + 1) || !alphaAt(x + 1, y);
      const light = topEdge ? 1.2 : bottomEdge ? 0.78 : 1.04;
      const boost = (channel: number) => Math.max(0, Math.min(255, (luma + (channel - luma) * 1.28) * light));
      put(x + 2, y + 2, boost(r), boost(g), boost(b), alpha);
    }
  }
  ctx.putImageData(data, 0, 0);
  return out;
}

