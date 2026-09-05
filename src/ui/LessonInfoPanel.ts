import { VATRA_PUZZLES, rewardWhen } from '../vatra/VatraPuzzles';

// One teaching zone: its guide NPC, the concept that zone drills, and its
// lessons in teaching order. Clicking the guide opens his own page.
interface ZoneInfo {
  guide: string;
  concept: string; // innerHTML: a <b> lead-in plus the explanation
  lessons: string[];
}

export const ZONES: Record<string, ZoneInfo> = {
  vatra: {
    guide: '🧓 Bunicul Fierar',
    concept:
      '<b>Ce-s secvențele?</b> O secvență e o listă de porunci care se-ntâmplă una după alta, ' +
      'exact în ordinea-n care le pui pe tăbliță — ca pașii unei rețete. Schimbă ordinea și ' +
      'rezultatul se schimbă: dacă verși apa înainte s-o umpli, jgheabul rămâne uscat!',
    lessons: ['fantana', 'cuptor', 'ulita', 'fierarie', 'grajd', 'spalatorie'],
  },
  lunca: {
    guide: '🐑 Baciul Luncii',
    concept:
      '<b>Ce-s buclele?</b> O buclă spune tăbliței „fă asta de atâtea ori" — o singură dată, ' +
      'în loc să pui aceeași poruncă de treizeci de ori. Tu alegi numărul, iar bucla face ' +
      'toată truda. Și, dacă pui o buclă ÎN altă buclă, cea dinăuntru se învârte de la capăt ' +
      'la fiecare rotire a celei din afară — așa plantezi un câmp întreg, rând cu rând.',
    lessons: ['gard', 'camp_grau', 'moara', 'livada', 'capite'],
  },
  padurea: {
    guide: '🌲 Muma Pădurii',
    concept:
      '<b>Ce-s condițiile?</b> Hâhâhî! În pădurea mea nimic nu-i sigur: ba-i noapte, ba-i zi, ba vine lupul, ' +
      'ba nu. O condiție e o întrebare cu răspuns DA sau NU — „e noapte?" — iar blocul «dacă / altfel» face ' +
      'una când răspunsul e DA și alta când e NU. Poți lega întrebările cu ȘI, SAU și NU. Tăblița îți ' +
      'încearcă programul în mai multe nopți și zile — să meargă în toate, altfel te-ncurc în potecă!',
    lessons: ['poteca', 'pod', 'capcana', 'ciuperci', 'rascruce'],
  },
};

export interface LessonInfoCallbacks {
  isDone: (puzzleId: string) => boolean;
  onOpenLesson: (puzzleId: string) => void;
  onClose: () => void;
}

// The guide's lore popup, opened by clicking him: explains the concept his
// zone teaches and lists that zone's lessons with his own guidance text
// (reused from VATRA_PUZZLES' `intro`), each one's reward, and whether it's
// solved yet.
export class LessonInfoPanel {
  private root: HTMLElement;
  private titleText: Text;
  private conceptEl: HTMLElement;
  private list: HTMLElement;
  private zone = 'vatra';
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
    this.titleText = document.createTextNode('');
    title.appendChild(this.titleText);
    const closeButton = document.createElement('span');
    closeButton.className = 'lore-close';
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', () => this.callbacks.onClose());
    title.appendChild(closeButton);
    panel.appendChild(title);

    this.conceptEl = document.createElement('div');
    this.conceptEl.className = 'lore-concept';
    panel.appendChild(this.conceptEl);

    this.list = document.createElement('div');
    this.list.className = 'lore-list';
    panel.appendChild(this.list);

    this.root.innerHTML = '';
    this.root.appendChild(panel);
  }

  show(zone: string): void {
    this.zone = ZONES[zone] ? zone : 'vatra';
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private render(): void {
    const info = ZONES[this.zone];
    this.titleText.data = info.guide;
    this.conceptEl.innerHTML = info.concept;

    this.list.innerHTML = '';
    for (const id of info.lessons) {
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

      const reward = document.createElement('div');
      reward.className = 'lore-reward';
      const rewardLabel = document.createElement('b');
      rewardLabel.textContent = '🎁 Răsplată: ';
      reward.appendChild(rewardLabel);
      reward.appendChild(document.createTextNode(`${puzzle.reward} `));
      const rewardWhenEl = document.createElement('span');
      rewardWhenEl.className = 'reward-when';
      rewardWhenEl.textContent = `(${rewardWhen(puzzle)})`;
      reward.appendChild(rewardWhenEl);
      body.appendChild(reward);

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
