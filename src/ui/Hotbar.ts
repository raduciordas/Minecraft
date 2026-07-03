import { BLOCKS, PLACEABLE_BLOCKS, type BlockType } from '../world/Block';
import { HOTBAR_SIZE } from '../config';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// 9 assignable slots; the inventory panel (E) assigns any material to the
// currently selected slot.
export class Hotbar {
  private layout: BlockType[];
  private selected = 0;
  private slotEls: HTMLElement[] = [];
  private iconEls: HTMLCanvasElement[] = [];
  private countEls: HTMLElement[] = [];

  constructor(
    container: HTMLElement,
    private atlas: TextureAtlas,
    private inventory: Inventory,
  ) {
    this.layout = PLACEABLE_BLOCKS.slice(0, HOTBAR_SIZE);
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const icon = atlas.makeTileIcon(BLOCKS[this.layout[i]].textures.side);
      slot.appendChild(icon);
      const count = document.createElement('span');
      count.className = 'count';
      slot.appendChild(count);
      slot.title = BLOCKS[this.layout[i]].name;
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

  get selectedBlock(): BlockType {
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
      if (i < HOTBAR_SIZE && BLOCKS[id]) this.assign(i, id as BlockType);
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

  assignToSelected(id: BlockType): void {
    this.assign(this.selected, id);
  }

  private assign(index: number, id: BlockType): void {
    this.layout[index] = id;
    const icon = this.atlas.makeTileIcon(BLOCKS[id].textures.side);
    this.slotEls[index].replaceChild(icon, this.iconEls[index]);
    this.iconEls[index] = icon;
    this.slotEls[index].title = BLOCKS[id].name;
    this.refreshCounts();
  }

  private refreshCounts(): void {
    this.layout.forEach((id, i) => {
      const count = this.inventory.count(id);
      this.countEls[i].textContent = count > 0 ? String(count) : '';
      this.slotEls[i].classList.toggle('empty', count === 0);
    });
  }
}
