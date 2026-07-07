import type { World } from './World';
import { isSolid } from './Block';

export interface RaycastHit {
  // The solid block that was hit (break target)
  block: { x: number; y: number; z: number };
  // The empty cell the ray came from (place target)
  previous: { x: number; y: number; z: number };
}

// Voxel traversal (Amanatides & Woo). Steps the ray cell-by-cell up to
// maxDistance and returns the first solid block plus the cell before it.
export function raycastVoxels(
  world: World,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance: number,
  isTarget: (id: number) => boolean = isSolid,
): RaycastHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

  const distToBoundary = (o: number, cell: number, step: number) =>
    step > 0 ? cell + 1 - o : o - cell;

  let tMaxX = stepX !== 0 ? tDeltaX * distToBoundary(origin.x, x, stepX) : Infinity;
  let tMaxY = stepY !== 0 ? tDeltaY * distToBoundary(origin.y, y, stepY) : Infinity;
  let tMaxZ = stepZ !== 0 ? tDeltaZ * distToBoundary(origin.z, z, stepZ) : Infinity;

  let prevX = x;
  let prevY = y;
  let prevZ = z;
  let t = 0;

  while (t <= maxDistance) {
    if (isTarget(world.getBlock(x, y, z))) {
      return { block: { x, y, z }, previous: { x: prevX, y: prevY, z: prevZ } };
    }
    prevX = x;
    prevY = y;
    prevZ = z;

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
