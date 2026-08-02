import { BLOCKS } from '../world/Block';
import { isWeapon, makeWeaponIcon, type WeaponId } from '../items/Weapon';
import { isTool, makeToolIcon, type ToolId } from '../items/Tool';
import { isThrowable, makeThrowableIcon, type ThrowableId } from '../items/Throwable';
import { buildHelpSections, type HelpItem } from './HelpData';
import type { TextureAtlas } from '../rendering/TextureAtlas';

// The Ajutor page (H): every material in the game, where it comes from and
// what it's good for. Built once on first open — the catalogue is derived
// from game data that doesn't change while the page is loaded.
export class HelpPanel {
  private root: HTMLElement;
  private built = false;
  isOpen = false;

  constructor(
    container: HTMLElement,
    private atlas: TextureAtlas,
    private onClose: () => void,
  ) {
    this.root = container;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.onClose();
    });
  }

  private icon(id: number): HTMLCanvasElement | null {
    if (isTool(id)) return makeToolIcon(id as ToolId);
    if (isWeapon(id)) return makeWeaponIcon(id as WeaponId);
    if (isThrowable(id)) return makeThrowableIcon(id as ThrowableId);
    if (BLOCKS[id]) return this.atlas.makeTileIcon(BLOCKS[id].textures.side);
    return null;
  }

  private renderItem(item: HelpItem): HTMLElement {
    const row = document.createElement('div');
    row.className = 'help-row';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'help-icon';
    const canvas = this.icon(item.id);
    if (canvas) iconWrap.appendChild(canvas);
    row.appendChild(iconWrap);

    const body = document.createElement('div');
    body.className = 'help-body';

    const name = document.createElement('div');
    name.className = 'help-name';
    name.textContent = item.name;
    body.appendChild(name);

    const use = document.createElement('div');
    use.className = 'help-use';
    use.textContent = item.use;
    body.appendChild(use);

    const sources = document.createElement('ul');
    sources.className = 'help-sources';
    for (const s of item.sources) {
      const li = document.createElement('li');
      li.textContent = s;
      sources.appendChild(li);
    }
    body.appendChild(sources);

    row.appendChild(body);
    return row;
  }

  private build(): void {
    const panel = document.createElement('div');
    panel.className = 'help-panel';

    const title = document.createElement('div');
    title.className = 'help-title';
    title.textContent = '📖 Ajutor — materialele din CUBURIA';
    const close = document.createElement('span');
    close.className = 'help-close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.onClose());
    title.appendChild(close);
    panel.appendChild(title);

    const lead = document.createElement('div');
    lead.className = 'help-lead';
    lead.textContent =
      'Click stânga sparge un cub și ți-l pune în traistă; click dreapta îl pune la loc. ' +
      'Apeși E ca să-ți vezi toată traista, iar H închide pagina asta.';
    panel.appendChild(lead);

    for (const section of buildHelpSections()) {
      const head = document.createElement('div');
      head.className = 'help-section';
      head.textContent = section.title;
      panel.appendChild(head);
      if (section.intro) {
        const intro = document.createElement('div');
        intro.className = 'help-section-intro';
        intro.textContent = section.intro;
        panel.appendChild(intro);
      }
      for (const item of section.items) panel.appendChild(this.renderItem(item));
    }

    this.root.innerHTML = '';
    this.root.appendChild(panel);
    this.built = true;
  }

  show(): void {
    if (!this.built) this.build();
    this.isOpen = true;
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }
}
