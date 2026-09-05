import { RECIPES } from '../items/Recipes';
import { itemName, makeItemIcon as itemIcon } from '../items/Items';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import type { Inventory } from '../player/Inventory';

// Full-screen crafting overlay, opened by right-clicking a placed Masă de
// Cioplit (Crafting Table). Lists every recipe with its ingredient stock;
// crafting deducts the ingredients and adds the output to the inventory.
export class CraftingPanel {
  private root: HTMLElement;
  private rows: {
    button: HTMLButtonElement;
    ingredientEls: { id: number; count: number; el: HTMLElement }[];
  }[] = [];
  isOpen = false;

  constructor(
    container: HTMLElement,
    atlas: TextureAtlas,
    private inventory: Inventory,
    onRequestClose: () => void,
  ) {
    this.root = container;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) onRequestClose();
    });

    const panel = document.createElement('div');
    panel.className = 'inv-panel';
    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Masă de Cioplit — craftează cu materiale de pe hartă';
    const closeButton = document.createElement('span');
    closeButton.className = 'inv-close';
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', onRequestClose);
    title.appendChild(closeButton);
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'craft-list';
    panel.appendChild(list);

    for (const recipe of RECIPES) {
      const row = document.createElement('div');
      row.className = 'craft-recipe';
      row.appendChild(itemIcon(recipe.output, atlas));

      const name = document.createElement('span');
      name.className = 'craft-output-name';
      name.textContent = `${itemName(recipe.output)} x${recipe.outputCount}`;
      row.appendChild(name);

      const ingredientsEl = document.createElement('div');
      ingredientsEl.className = 'craft-ingredients';
      const ingredientEls: { id: number; count: number; el: HTMLElement }[] = [];
      for (const ing of recipe.ingredients) {
        const span = document.createElement('span');
        span.className = 'craft-ingredient';
        span.appendChild(itemIcon(ing.id, atlas));
        const label = document.createElement('span');
        span.appendChild(label);
        ingredientsEl.appendChild(span);
        ingredientEls.push({ id: ing.id, count: ing.count, el: label });
      }
      row.appendChild(ingredientsEl);

      const button = document.createElement('button');
      button.className = 'craft-btn';
      button.textContent = 'Craftează';
      button.addEventListener('click', () => this.craft(recipe));
      row.appendChild(button);

      list.appendChild(row);
      this.rows.push({ button, ingredientEls });
    }

    this.root.appendChild(panel);
    this.refresh();
    inventory.onChange(() => this.refresh());
  }

  show(): void {
    this.isOpen = true;
    this.refresh();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private craft(recipe: (typeof RECIPES)[number]): void {
    const hasAll = recipe.ingredients.every((ing) => this.inventory.count(ing.id) >= ing.count);
    if (!hasAll) return;
    for (const ing of recipe.ingredients) this.inventory.remove(ing.id, ing.count);
    this.inventory.add(recipe.output, recipe.outputCount);
  }

  private refresh(): void {
    this.rows.forEach((row) => {
      let hasAll = true;
      row.ingredientEls.forEach(({ id, count, el }) => {
        const have = this.inventory.count(id);
        const short = have < count;
        if (short) hasAll = false;
        el.textContent = `${itemName(id)} ${have}/${count}`;
        el.parentElement!.classList.toggle('short', short);
        el.parentElement!.classList.toggle('ok', !short);
      });
      row.button.disabled = !hasAll;
    });
  }
}
