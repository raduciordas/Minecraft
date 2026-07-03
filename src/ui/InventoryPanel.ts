import { BLOCKS, PLACEABLE_BLOCKS } from '../world/Block';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// Full-screen inventory overlay (toggled with E). Shows the stock of every
// material; clicking one puts it in the currently selected hotbar slot.
export class InventoryPanel {
  private root: HTMLElement;
  private countLabels: HTMLElement[] = [];
  isOpen = false;

  constructor(
    container: HTMLElement,
    atlas: TextureAtlas,
    private inventory: Inventory,
    onPick: (id: (typeof PLACEABLE_BLOCKS)[number]) => void,
  ) {
    this.root = container;
    const panel = document.createElement('div');
    panel.className = 'inv-panel';
    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Inventory — click a material to put it in the selected hotbar slot';
    panel.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    panel.appendChild(grid);

    PLACEABLE_BLOCKS.forEach((id) => {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.appendChild(atlas.makeTileIcon(BLOCKS[id].textures.side));
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = BLOCKS[id].name;
      cell.appendChild(name);
      const count = document.createElement('span');
      count.className = 'cnt';
      cell.appendChild(count);
      cell.addEventListener('click', () => onPick(id));
      grid.appendChild(cell);
      this.countLabels.push(count);
    });

    this.root.appendChild(panel);
    this.refreshCounts();
    inventory.onChange(() => this.refreshCounts());
  }

  show(): void {
    this.isOpen = true;
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private refreshCounts(): void {
    PLACEABLE_BLOCKS.forEach((id, i) => {
      const count = this.inventory.count(id);
      this.countLabels[i].textContent = count > 0 ? `x${count}` : '—';
    });
  }
}
