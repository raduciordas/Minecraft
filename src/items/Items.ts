import { BLOCKS, PLACEABLE_BLOCKS, type BlockType } from '../world/Block';
import { WEAPONS, WEAPON_IDS, isWeapon, makeWeaponIcon, type WeaponId } from './Weapon';
import { THROWABLES, THROWABLE_IDS, isThrowable, makeThrowableIcon, type ThrowableId } from './Throwable';
import { TOOLS, TOOL_IDS, isTool, makeToolIcon, type ToolId } from './Tool';
import { CONSUMABLES, CONSUMABLE_IDS, isConsumable, makeConsumableIcon } from './Consumable';
import { GEAR, GEAR_IDS, isGear, makeGearIcon } from './Gear';
import type { TextureAtlas } from '../rendering/TextureAtlas';

// One place that knows every item category, so the hotbar, inventory,
// crafting and help panels don't each carry their own chain of
// isWeapon/isThrowable/isTool/... branches.

export function isKnownItem(id: number): boolean {
  return !!(BLOCKS[id] || WEAPONS[id] || THROWABLES[id] || TOOLS[id] || CONSUMABLES[id] || GEAR[id]);
}

export function itemName(id: number): string {
  if (isWeapon(id)) return WEAPONS[id]?.name ?? String(id);
  if (isThrowable(id)) return THROWABLES[id]?.name ?? String(id);
  if (isTool(id)) return TOOLS[id]?.name ?? String(id);
  if (isGear(id)) return GEAR[id]?.name ?? String(id);
  if (isConsumable(id)) return CONSUMABLES[id]?.name ?? String(id);
  return BLOCKS[id]?.name ?? String(id);
}

export function makeItemIcon(id: number, atlas: TextureAtlas): HTMLCanvasElement {
  if (isWeapon(id)) return makeWeaponIcon(id as WeaponId);
  if (isThrowable(id)) return makeThrowableIcon(id as ThrowableId);
  if (isTool(id)) return makeToolIcon(id as ToolId);
  if (isGear(id)) return makeGearIcon(id);
  if (isConsumable(id)) return makeConsumableIcon(id);
  return atlas.makeTileIcon(BLOCKS[id].textures.side);
}

// Whether right-clicking with it in hand puts a block in the world
export function isPlaceable(id: number): boolean {
  return !!BLOCKS[id] && !isConsumable(id);
}

// Not handed out free at the start of a session
export function isEarned(id: number): boolean {
  if (isWeapon(id)) return !!WEAPONS[id]?.notStarterStock;
  if (isThrowable(id)) return !!THROWABLES[id]?.notStarterStock;
  if (isTool(id) || isGear(id) || isConsumable(id)) return true;
  return !!BLOCKS[id]?.notStarterStock;
}

// Every item the inventory panel lists, in display order
export const ALL_ITEM_IDS: number[] = [
  ...WEAPON_IDS,
  ...THROWABLE_IDS,
  ...TOOL_IDS,
  ...GEAR_IDS,
  ...CONSUMABLE_IDS.filter((id) => !PLACEABLE_BLOCKS.includes(id as BlockType)),
  ...PLACEABLE_BLOCKS,
];
