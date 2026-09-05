import { PLACEABLE_BLOCKS } from '../world/Block';
import { WEAPONS, WeaponId, isWeapon } from '../items/Weapon';
import { ThrowableId } from '../items/Throwable';
import { isKnownItem, itemName, makeItemIcon } from '../items/Items';
import { HOTBAR_SIZE } from '../config';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// 9 assignable slots holding any item; the inventory panel (E) assigns any
// item to the currently selected slot.
export class Hotbar {
  private layout: number[];
  private selected = 0;
  private slotEls: HTMLElement[] = [];
  private iconEls: HTMLCanvasElement[] = [];
  private countEls: HTMLElement[] = [];

  constructor(
    container: HTMLElement,
    private atlas: TextureAtlas,
    private inventory: Inventory,
  ) {
    // The Storm Sword and a bottle of socată start in slots 1-2; blocks fill the rest
    this.layout = [WeaponId.StormSword, ThrowableId.SocataBottle, ...PLACEABLE_BLOCKS.slice(0, HOTBAR_SIZE - 2)];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const icon = makeItemIcon(this.layout[i], this.atlas);
      slot.appendChild(icon);
      const count = document.createElement('span');
      count.className = 'count';
      slot.appendChild(count);
      slot.title = itemName(this.layout[i]);
      slot.addEventListener('click', () => this.select(i)); // tap-to-select on touch
      container.appendChild(slot);
      this.slotEls.push(slot);
      this.iconEls.push(icon);
      this.countEls.push(count);
    }
    this.select(0);
    this.refreshCounts();
    inventory.onChange(() => this.refreshCounts());
  }

  get selectedItem(): number {
    return this.layout[this.selected];
  }

  get selectedIndex(): number {
    return this.selected;
  }

  getLayout(): number[] {
    return [...this.layout];
  }

  setLayout(layout: number[]): void {
    layout.forEach((id, i) => {
      if (i < HOTBAR_SIZE && isKnownItem(id)) this.assign(i, id);
    });
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.slotEls[this.selected]?.classList.remove('selected');
    this.selected = index;
    this.slotEls[this.selected].classList.add('selected');
  }

  scroll(delta: number): void {
    this.select((this.selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE);
  }

  assignToSelected(id: number): void {
    this.assign(this.selected, id);
  }

  private assign(index: number, id: number): void {
    this.layout[index] = id;
    const icon = makeItemIcon(id, this.atlas);
    this.slotEls[index].replaceChild(icon, this.iconEls[index]);
    this.iconEls[index] = icon;
    this.slotEls[index].title = itemName(id);
    this.refreshCounts();
  }

  private refreshCounts(): void {
    this.layout.forEach((id, i) => {
      if (isWeapon(id) && !WEAPONS[id]?.notStarterStock) {
        // Free weapons are never consumed
        this.countEls[i].textContent = '';
        this.slotEls[i].classList.remove('empty');
        return;
      }
      const count = this.inventory.count(id);
      this.countEls[i].textContent = count > 0 ? String(count) : '';
      this.slotEls[i].classList.toggle('empty', count === 0);
    });
  }
}
