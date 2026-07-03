import { SAVE_KEY } from './config';
import type { EditsData } from './world/World';

export interface SaveData {
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  inventory: Record<number, number>;
  selectedSlot: number;
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
