import { VATRA_PUZZLES } from '../vatra/VatraPuzzles';

// Zona 1 (Vatra Satului) lessons, in teaching order
const ZONE1_ORDER = ['fantana', 'cuptor', 'ulita', 'fierarie', 'grajd', 'spalatorie'];

export interface LessonInfoCallbacks {
  isDone: (puzzleId: string) => boolean;
  onOpenLesson: (puzzleId: string) => void;
  onClose: () => void;
}

// Bunicul's lore popup, opened by clicking him: explains what "secvențe"
// (sequences) are and lists Zona 1's six lessons with Bunicul's own guidance
// text (reused from VATRA_PUZZLES' `intro`) and each lesson's solved status.
export class LessonInfoPanel {
  private root: HTMLElement;
  private list: HTMLElement;
  isOpen = false;

  constructor(
    container: HTMLElement,
    private callbacks: LessonInfoCallbacks,
  ) {
    this.root = container;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.callbacks.onClose();
    });

    const panel = document.createElement('div');
    panel.className = 'lore-panel';

    const title = document.createElement('div');
    title.className = 'lore-title';
    title.textContent = '🧓 Bunicul Fierar';
    const closeButton = document.createElement('span');
    closeButton.className = 'lore-close';
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', () => this.callbacks.onClose());
    title.appendChild(closeButton);
    panel.appendChild(title);

    const concept = document.createElement('div');
    concept.className = 'lore-concept';
    concept.innerHTML =
      '<b>Ce-s secvențele?</b> O secvență e o listă de porunci care se-ntâmplă una după alta, ' +
      'exact în ordinea-n care le pui pe tăbliță — ca pașii unei rețete. Schimbă ordinea și ' +
      'rezultatul se schimbă: dacă verși apa înainte s-o umpli, jgheabul rămâne uscat!';
    panel.appendChild(concept);

    this.list = document.createElement('div');
    this.list.className = 'lore-list';
    panel.appendChild(this.list);

    this.root.innerHTML = '';
    this.root.appendChild(panel);
  }

  show(): void {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.renderList();
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private renderList(): void {
    this.list.innerHTML = '';
    for (const id of ZONE1_ORDER) {
      const puzzle = VATRA_PUZZLES[id];
      if (!puzzle) continue;
      const done = this.callbacks.isDone(id);

      const row = document.createElement('div');
      row.className = done ? 'lore-row done' : 'lore-row';

      const status = document.createElement('span');
      status.className = 'lore-status';
      status.textContent = done ? '✅' : '⏳';
      row.appendChild(status);

      const body = document.createElement('div');
      body.className = 'lore-body';
      const name = document.createElement('div');
      name.className = 'lore-name';
      name.textContent = puzzle.title;
      body.appendChild(name);
      const hint = document.createElement('div');
      hint.className = 'lore-hint';
      hint.textContent = puzzle.intro;
      body.appendChild(hint);
      row.appendChild(body);

      const btn = document.createElement('button');
      btn.className = 'lore-open-btn';
      btn.textContent = done ? 'Reia lecția' : 'Deschide lecția';
      btn.addEventListener('click', () => this.callbacks.onOpenLesson(id));
      row.appendChild(btn);

      this.list.appendChild(row);
    }
  }
}
