import { WEAPONS, isWeapon } from '../items/Weapon';
import { ALL_ITEM_IDS, itemName, makeItemIcon } from '../items/Items';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// Full-screen inventory overlay (toggled with E). Shows the stock of every
// item; clicking one puts it in the currently selected hotbar slot.
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

    for (const id of ALL_ITEM_IDS) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.appendChild(makeItemIcon(id, atlas));
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = itemName(id);
      cell.appendChild(name);
      const count = document.createElement('span');
      count.className = 'cnt';
      // Only the weapons still handed out free at the start of a session get
      // the "∞"; everything earned shows its real stock
      if (isWeapon(id) && !WEAPONS[id]?.notStarterStock) count.textContent = '∞';
      else this.countedCells.push({ id, el: count });
      cell.addEventListener('click', () => onPick(id));
      cell.appendChild(count);
      grid.appendChild(cell);
    }

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
      const count = this.inventory.count(id);
      el.textContent = count > 0 ? `x${count}` : '—';
    });
  }
}
