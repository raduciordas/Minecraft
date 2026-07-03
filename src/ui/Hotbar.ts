import { BLOCKS, PLACEABLE_BLOCKS, type BlockType } from '../world/Block';
import type { TextureAtlas } from '../rendering/TextureAtlas';

export class Hotbar {
  private selected = 0;
  private slots: HTMLElement[] = [];

  constructor(container: HTMLElement, atlas: TextureAtlas) {
    PLACEABLE_BLOCKS.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      slot.appendChild(key);
      slot.appendChild(atlas.makeTileIcon(BLOCKS[id].textures.side));
      slot.title = BLOCKS[id].name;
      container.appendChild(slot);
      this.slots.push(slot);
    });
    this.select(0);
  }

  get selectedBlock(): BlockType {
    return PLACEABLE_BLOCKS[this.selected];
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
}
