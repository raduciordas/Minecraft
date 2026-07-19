// Satul Codat — phase 0 puzzle data. Per the design doc, content is data,
// not code: each puzzle defines its palette, solution, and scripted comic
// fails; the Tabla de Blocuri and VatraModule interpret this.

export interface VatraBlock {
  id: string;
  label: string;
  copies: number; // how many times this block may appear in one program
}

export interface VatraFail {
  text: string; // Bunicul Fierar's comic verdict
  anim: 'bucket' | 'coal' | 'dark' | 'none';
  matches: (program: string[]) => boolean;
}

export interface VatraPuzzle {
  id: string;
  title: string;
  intro: string; // Bunicul Fierar's guidance shown when the tabla opens
  success: string;
  palette: VatraBlock[];
  solution: string[];
  fails: VatraFail[]; // checked in order; first match wins
}

const before = (program: string[], a: string, b: string): boolean => {
  const ia = program.indexOf(a);
  const ib = program.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
};

export const VATRA_PUZZLES: Record<string, VatraPuzzle> = {
  fantana: {
    id: 'fantana',
    title: 'Fântâna — prima secvență',
    intro:
      'BUNICUL FIERAR: „Fântâna-i secată de-un veac, copile. Pune poruncile pe tăbliță în ordinea bună: găleata coboară, se umple, urcă și varsă apa în jgheab. Hai, arată-mi!"',
    success: 'APA CURGE! Fântâna-i vie iarăși, iar jgheabul e plin. Prima resursă a satului e a ta.',
    palette: [
      { id: 'umple', label: 'Umple găleata', copies: 1 },
      { id: 'varsa', label: 'Varsă în jgheab', copies: 1 },
      { id: 'coboara', label: 'Coboară găleata', copies: 1 },
      { id: 'urca', label: 'Urcă găleata', copies: 1 },
    ],
    solution: ['coboara', 'umple', 'urca', 'varsa'],
    fails: [
      {
        text: 'Găleata a urcat GOALĂ și Bunicul a băut… aer! Prima boacănă din Cartea Boacănelor.',
        anim: 'bucket',
        matches: (p) => before(p, 'urca', 'umple') || before(p, 'varsa', 'umple'),
      },
      {
        text: 'Hmm, nu-i ordinea bună — apa n-a ajuns în jgheab. Mai încearcă!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  cuptor: {
    id: 'cuptor',
    title: 'Cuptorul de pâine — ordinea contează',
    intro:
      'BUNICUL FIERAR: „Șase porunci pentru un colac ca lumea. Da\' bagă de seamă: aluatul necopt nu-i pâine, iar pâinea nefrământată-i… cărbune!"',
    success: 'COLACI CALZI! Miroase-n tot satul. (+10 mămăligă în traistă)',
    palette: [
      { id: 'framanta', label: 'Frământă aluatul', copies: 1 },
      { id: 'scoate', label: 'Scoate din cuptor', copies: 1 },
      { id: 'aprinde', label: 'Aprinde focul', copies: 1 },
      { id: 'asteapta', label: 'Așteaptă', copies: 1 },
      { id: 'baga', label: 'Bagă în cuptor', copies: 1 },
      { id: 'dospeste', label: 'Lasă la dospit', copies: 1 },
    ],
    solution: ['aprinde', 'framanta', 'dospeste', 'baga', 'asteapta', 'scoate'],
    fails: [
      {
        text: '«Bagă în cuptor» înainte de «frământă»?! Din cuptor a ieșit un BOLOVAN DE CĂRBUNE fumegând. Boacănă de aur!',
        anim: 'coal',
        matches: (p) => before(p, 'baga', 'framanta'),
      },
      {
        text: 'Din cuptor n-a ieșit nimic bun — nici colac, nici cărbune. Ordinea, dragul moșului, ordinea!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  ulita: {
    id: 'ulita',
    title: 'Ulița cu felinare — durerea repetiției',
    intro:
      'BUNICUL FIERAR: „Cinci felinare pe uliță. Aprinde-le pe toate, unul câte unul. Da, e obositor. Poate-o fi vreo cale mai deșteaptă… cândva."',
    success:
      'Ulița-i luminată, paznicul îți mulțumește! „Trebuie să fie o cale mai deșteaptă…" — zice Bunicul, cu tâlc. (+2 lămpi)',
    palette: [
      { id: 'aprinde_felinar', label: 'Aprinde felinarul', copies: 5 },
      { id: 'doina', label: 'Fluieră o doină', copies: 1 },
    ],
    solution: ['aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar'],
    fails: [
      {
        text: 'Frumoasă doina… dar felinarele nu se aprind cu fluierul, dragul moșului!',
        anim: 'dark',
        matches: (p) => p.includes('doina'),
      },
      {
        text: 'Mijlocul uliței a rămas BEZNĂ — paznicul s-a împiedicat de o găină! Aprinde toate cele 5 felinare.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
};
