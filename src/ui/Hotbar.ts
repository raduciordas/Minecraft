import { BLOCKS, PLACEABLE_BLOCKS, type BlockType } from '../world/Block';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

export class Hotbar {
  private selected = 0;
  private slots: HTMLElement[] = [];
  private countLabels: HTMLElement[] = [];

  constructor(
    container: HTMLElement,
    atlas: TextureAtlas,
    private inventory: Inventory,
  ) {
    PLACEABLE_BLOCKS.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      slot.appendChild(key);
      slot.appendChild(atlas.makeTileIcon(BLOCKS[id].textures.side));
      const count = document.createElement('span');
      count.className = 'count';
      slot.appendChild(count);
      slot.title = BLOCKS[id].name;
      container.appendChild(slot);
      this.slots.push(slot);
      this.countLabels.push(count);
    });
    this.select(0);
    this.refreshCounts();
    inventory.onChange(() => this.refreshCounts());
  }

  get selectedBlock(): BlockType {
    return PLACEABLE_BLOCKS[this.selected];
  }

  get selectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    if (index < 0 || index >= this.slots.length) return;
    this.slots[this.selected]?.classList.remove('selected');
    this.selected = index;
    this.slots[this.selected].classList.add('selected');
  }

  scroll(delta: number): void {
    const n = this.slots.length;
    this.select((this.selected + delta + n) % n);
  }

  private refreshCounts(): void {
    PLACEABLE_BLOCKS.forEach((id, i) => {
      const count = this.inventory.count(id);
      this.countLabels[i].textContent = count > 0 ? String(count) : '';
      this.slots[i].classList.toggle('empty', count === 0);
    });
  }
}
