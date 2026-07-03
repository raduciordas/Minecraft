import {
  GRAVITY,
  JUMP_SPEED,
  WALK_SPEED,
  FLY_SPEED,
  GROUND_ACCEL,
  AIR_ACCEL,
  GROUND_FRICTION,
  PLAYER_EYE_HEIGHT,
  WATER_SPEED_FACTOR,
  WATER_GRAVITY_FACTOR,
  SWIM_UP_SPEED,
  WATER_MAX_SINK_SPEED,
} from '../config';
import { isWater } from '../world/Block';
import type { World } from '../world/World';
import type { InputController } from './InputController';
import { stepBody, type Body } from './Physics';

export class Player {
  body: Body = { x: 0.5, y: 40, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
  flying = false;

  constructor(private input: InputController) {
    input.onFlyToggle(() => {
      this.flying = !this.flying;
      this.body.vy = 0;
    });
  }

  get eyeX(): number {
    return this.body.x;
  }
  get eyeY(): number {
    return this.body.y + PLAYER_EYE_HEIGHT;
  }
  get eyeZ(): number {
    return this.body.z;
  }

  spawnAt(x: number, z: number, groundHeight: number): void {
    this.body.x = x;
    this.body.y = groundHeight + 1;
    this.body.z = z;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.vz = 0;
  }

  update(world: World, dt: number): void {
    const move = this.input.getMoveInput();
    const yaw = this.input.yaw;

    // Wish direction in world space from camera yaw (pitch ignored for walking)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wishX = move.x * cos - move.z * sin;
    const wishZ = -move.x * sin - move.z * cos;

    if (this.flying) {
      this.body.vx = wishX * FLY_SPEED;
      this.body.vz = wishZ * FLY_SPEED;
      this.body.vy = (move.jump ? 1 : 0) * FLY_SPEED + (move.down ? -1 : 0) * FLY_SPEED;
      stepBody(this.body, world, dt);
      return;
    }

    const bx = Math.floor(this.body.x);
    const bz = Math.floor(this.body.z);
    const inWater =
      isWater(world.getBlock(bx, Math.floor(this.body.y + 0.3), bz)) ||
      isWater(world.getBlock(bx, Math.floor(this.body.y + 1.4), bz));

    // Horizontal: accelerate toward wish velocity, friction on ground
    const accel = this.body.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const speed = inWater ? WALK_SPEED * WATER_SPEED_FACTOR : WALK_SPEED;
    const targetVx = wishX * speed;
    const targetVz = wishZ * speed;
    this.body.vx += (targetVx - this.body.vx) * Math.min(1, accel * dt / WALK_SPEED);
    this.body.vz += (targetVz - this.body.vz) * Math.min(1, accel * dt / WALK_SPEED);
    if (this.body.onGround && move.x === 0 && move.z === 0) {
      const damp = Math.max(0, 1 - GROUND_FRICTION * dt);
      this.body.vx *= damp;
      this.body.vz *= damp;
    }

    if (inWater) {
      if (move.jump) {
        this.body.vy += (SWIM_UP_SPEED - this.body.vy) * Math.min(1, 8 * dt);
      }
      this.body.vy += GRAVITY * WATER_GRAVITY_FACTOR * dt;
      if (this.body.vy < WATER_MAX_SINK_SPEED) this.body.vy = WATER_MAX_SINK_SPEED;
    } else {
      if (move.jump && this.body.onGround) {
        this.body.vy = JUMP_SPEED;
      }
      this.body.vy += GRAVITY * dt;
    }

    stepBody(this.body, world, dt);

    // Safety net: fell out of the world (e.g. dug straight down to bedrockless void)
    if (this.body.y < -20) {
      const h = world.generator.heightAt(Math.floor(this.body.x), Math.floor(this.body.z));
      this.spawnAt(this.body.x, this.body.z, h);
    }
  }
}
