import { SAVE_KEY } from './config';
import type { EditsData } from './world/World';

export interface SaveData {
  seed: number;
  time?: number; // day/night cycle position
  hp?: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  inventory: Record<number, number>;
  selectedSlot: number;
  hotbar?: number[]; // absent in saves from before assignable hotbar slots
  // Which round of "this material is no longer free" the save has been
  // through. Bumped in Game.ts when items leave the starter stock, so the
  // one-off cleanup runs once per save instead of wiping the player's
  // hard-won pile on every load.
  stockRev?: number;
  edits: EditsData;
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — the game keeps running unsaved
  }
}
