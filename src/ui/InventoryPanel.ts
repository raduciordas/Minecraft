import { BLOCKS, PLACEABLE_BLOCKS, type BlockType } from '../world/Block';
import { WEAPONS, WEAPON_IDS, makeWeaponIcon } from '../items/Weapon';
import { THROWABLES, THROWABLE_IDS, makeThrowableIcon } from '../items/Throwable';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// Full-screen inventory overlay (toggled with E). Shows the stock of every
// material; clicking one puts it in the currently selected hotbar slot.
export class InventoryPanel {
  private root: HTMLElement;
  private countedCells: { id: number; el: HTMLElement }[] = [];
  isOpen = false;

  constructor(
    container: HTMLElement,
    atlas: TextureAtlas,
    private inventory: Inventory,
    onPick: (id: number) => void,
    onRequestClose: () => void,
  ) {
    this.root = container;
    // Tapping the backdrop (outside the panel) closes the inventory
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) onRequestClose();
    });
    const panel = document.createElement('div');
    panel.className = 'inv-panel';
    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Inventory — click a material to put it in the selected hotbar slot';
    const closeButton = document.createElement('span');
    closeButton.className = 'inv-close';
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', onRequestClose);
    title.appendChild(closeButton);
    panel.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    panel.appendChild(grid);

    const addCell = (id: number, icon: HTMLCanvasElement, label: string, isWeaponCell: boolean) => {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.appendChild(icon);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = label;
      cell.appendChild(name);
      const count = document.createElement('span');
      count.className = 'cnt';
      if (isWeaponCell) count.textContent = '∞';
      cell.addEventListener('click', () => onPick(id));
      cell.appendChild(count);
      grid.appendChild(cell);
      return count;
    };

    for (const id of WEAPON_IDS) {
      addCell(id, makeWeaponIcon(id), WEAPONS[id].name, true);
    }
    THROWABLE_IDS.forEach((id) => {
      const count = addCell(id, makeThrowableIcon(id), THROWABLES[id].name, false);
      this.countedCells.push({ id, el: count });
    });
    PLACEABLE_BLOCKS.forEach((id) => {
      const count = addCell(id, atlas.makeTileIcon(BLOCKS[id].textures.side), BLOCKS[id].name, false);
      this.countedCells.push({ id, el: count });
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
    this.countedCells.forEach(({ id, el }) => {
      const count = this.inventory.count(id as BlockType);
      el.textContent = count > 0 ? `x${count}` : '—';
    });
  }
}
