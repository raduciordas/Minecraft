import * as THREE from 'three';
import { buildPlayerAvatar } from './PlayerAvatar';
import type { RemotePlayerState } from './NetworkClient';

// Renders another connected player: a boxy humanoid with a floating name
// tag, smoothly interpolated toward the latest position received over the
// network (updates arrive at MOVE_SEND_INTERVAL, not every frame).
export class RemotePlayer {
  readonly id: string;
  readonly group: THREE.Group;
  private legs: THREE.Mesh[];
  private arms: THREE.Mesh[];
  private targetX: number;
  private targetY: number;
  private targetZ: number;
  private targetYaw: number;
  private walkPhase = 0;
  private moving = false;

  constructor(state: RemotePlayerState) {
    this.id = state.id;
    const model = buildPlayerAvatar(state.name, state.color);
    this.group = model.group;
    this.legs = model.legs;
    this.arms = model.arms;
    this.group.position.set(state.x, state.y, state.z);
    this.group.rotation.y = state.yaw;
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetZ = state.z;
    this.targetYaw = state.yaw;
  }

  applyState(x: number, y: number, z: number, yaw: number, moving: boolean): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.targetYaw = yaw;
    this.moving = moving;
  }

  update(dt: number): void {
    const t = Math.min(1, dt * 12);
    this.group.position.x += (this.targetX - this.group.position.x) * t;
    this.group.position.y += (this.targetY - this.group.position.y) * t;
    this.group.position.z += (this.targetZ - this.group.position.z) * t;

    let dyaw = this.targetYaw - this.group.rotation.y;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.group.rotation.y += dyaw * t;

    this.walkPhase += dt * (this.moving ? 7 : 0);
    const swing = this.moving ? 0.5 : 0;
    this.legs.forEach((legMesh, i) => {
      legMesh.rotation.x = Math.sin(this.walkPhase + (i % 2) * Math.PI) * swing;
    });
    this.arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(this.walkPhase + (i % 2) * Math.PI + Math.PI) * swing * 0.8;
    });
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
  }
}

export class RemotePlayerManager {
  private players = new Map<string, RemotePlayer>();

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.players.size;
  }

  add(state: RemotePlayerState): void {
    if (this.players.has(state.id)) return;
    const rp = new RemotePlayer(state);
    this.players.set(state.id, rp);
    this.scene.add(rp.group);
  }

  remove(id: string): void {
    const rp = this.players.get(id);
    if (!rp) return;
    this.scene.remove(rp.group);
    rp.dispose();
    this.players.delete(id);
  }

  applyMove(id: string, x: number, y: number, z: number, yaw: number, moving: boolean): void {
    this.players.get(id)?.applyState(x, y, z, yaw, moving);
  }

  clear(): void {
    for (const id of [...this.players.keys()]) this.remove(id);
  }

  update(dt: number): void {
    for (const p of this.players.values()) p.update(dt);
  }
}
