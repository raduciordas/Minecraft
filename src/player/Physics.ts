import { isSolid } from '../world/Block';
import type { World } from '../world/World';
import { PLAYER_WIDTH, PLAYER_HEIGHT } from '../config';

const HALF_W = PLAYER_WIDTH / 2;
const EPSILON = 0.001;

export interface Body {
  // Position is the feet center
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
}

function collidesAt(world: World, x: number, y: number, z: number): boolean {
  const minX = Math.floor(x - HALF_W);
  const maxX = Math.floor(x + HALF_W);
  const minY = Math.floor(y);
  const maxY = Math.floor(y + PLAYER_HEIGHT);
  const minZ = Math.floor(z - HALF_W);
  const maxZ = Math.floor(z + HALF_W);

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
  body.onGround = false;

  // Y axis
  let newY = body.y + body.vy * dt;
  if (collidesAt(world, body.x, newY, body.z)) {
    if (body.vy < 0) {
      newY = Math.floor(newY) + 1 + EPSILON;
      body.onGround = true;
    } else {
      newY = Math.floor(newY + PLAYER_HEIGHT) - PLAYER_HEIGHT - EPSILON;
    }
    body.vy = 0;
  }
  body.y = newY;

  // X axis
  let newX = body.x + body.vx * dt;
  if (collidesAt(world, newX, body.y, body.z)) {
    if (body.vx > 0) {
      newX = Math.floor(newX + HALF_W) - HALF_W - EPSILON;
    } else if (body.vx < 0) {
      newX = Math.floor(newX - HALF_W) + 1 + HALF_W + EPSILON;
    }
    body.vx = 0;
  }
  body.x = newX;

  // Z axis
  let newZ = body.z + body.vz * dt;
  if (collidesAt(world, body.x, body.y, newZ)) {
    if (body.vz > 0) {
      newZ = Math.floor(newZ + HALF_W) - HALF_W - EPSILON;
    } else if (body.vz < 0) {
      newZ = Math.floor(newZ - HALF_W) + 1 + HALF_W + EPSILON;
    }
    body.vz = 0;
  }
  body.z = newZ;
}

// True if the block at (bx, by, bz) would overlap the player's AABB.
// Used to reject placing a block inside yourself.
export function blockIntersectsBody(body: Body, bx: number, by: number, bz: number): boolean {
  return (
    bx + 1 > body.x - HALF_W &&
    bx < body.x + HALF_W &&
    by + 1 > body.y &&
    by < body.y + PLAYER_HEIGHT &&
    bz + 1 > body.z - HALF_W &&
    bz < body.z + HALF_W
  );
}
