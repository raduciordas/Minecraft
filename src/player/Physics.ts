import { isSolid } from '../world/Block';
import type { World } from '../world/World';

const EPSILON = 0.001;

export interface Body {
  // Position is the feet center
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  halfWidth: number;
  height: number;
  onGround: boolean;
  hitWall: boolean; // horizontal velocity was blocked this step
}

export function makeBody(halfWidth: number, height: number): Body {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, halfWidth, height, onGround: false, hitWall: false };
}

function collidesAt(world: World, x: number, y: number, z: number, halfW: number, height: number): boolean {
  const minX = Math.floor(x - halfW);
  const maxX = Math.floor(x + halfW);
  const minY = Math.floor(y);
  const maxY = Math.floor(y + height);
  const minZ = Math.floor(z - halfW);
  const maxZ = Math.floor(z + halfW);

  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (isSolid(world.getBlock(bx, by, bz))) return true;
      }
    }
  }
  return false;
}

// Per-axis AABB-vs-voxel resolution: move one axis at a time, and on collision
// clamp flush to the block face and zero that velocity component. At 60 Hz
// fixed steps the per-step displacement is < 1 block, so no tunneling.
export function stepBody(body: Body, world: World, dt: number): void {
  const halfW = body.halfWidth;
  const height = body.height;
  body.onGround = false;
  body.hitWall = false;

  // Y axis
  let newY = body.y + body.vy * dt;
  if (collidesAt(world, body.x, newY, body.z, halfW, height)) {
    if (body.vy < 0) {
      newY = Math.floor(newY) + 1 + EPSILON;
      body.onGround = true;
    } else {
      newY = Math.floor(newY + height) - height - EPSILON;
    }
    body.vy = 0;
  }
  body.y = newY;

  // X axis
  let newX = body.x + body.vx * dt;
  if (collidesAt(world, newX, body.y, body.z, halfW, height)) {
    if (body.vx > 0) {
      newX = Math.floor(newX + halfW) - halfW - EPSILON;
    } else if (body.vx < 0) {
      newX = Math.floor(newX - halfW) + 1 + halfW + EPSILON;
    }
    body.vx = 0;
    body.hitWall = true;
  }
  body.x = newX;

  // Z axis
  let newZ = body.z + body.vz * dt;
  if (collidesAt(world, body.x, body.y, newZ, halfW, height)) {
    if (body.vz > 0) {
      newZ = Math.floor(newZ + halfW) - halfW - EPSILON;
    } else if (body.vz < 0) {
      newZ = Math.floor(newZ - halfW) + 1 + halfW + EPSILON;
    }
    body.vz = 0;
    body.hitWall = true;
  }
  body.z = newZ;
}

// True if the block at (bx, by, bz) would overlap the body's AABB.
// Used to reject placing a block inside yourself.
export function blockIntersectsBody(body: Body, bx: number, by: number, bz: number): boolean {
  return (
    bx + 1 > body.x - body.halfWidth &&
    bx < body.x + body.halfWidth &&
    by + 1 > body.y &&
    by < body.y + body.height &&
    bz + 1 > body.z - body.halfWidth &&
    bz < body.z + body.halfWidth
  );
}
