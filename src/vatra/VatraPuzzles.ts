// Satul Codat puzzle data. Content is data, not code: each puzzle defines
// its available action/condition blocks, its canonical solution tree, and
// scripted comic fails; the Tabla de Blocuri and VatraModule interpret this.
//
// Programs are trees, not flat lists — 'repeat'/'while'/'if' are generic,
// reusable containers (like Scratch) that hold other nodes, including other
// loops. This is what actually teaches the concept: a loop that repeats a
// single action is the same block as a loop that repeats five actions or
// another loop.

export type ProgramNode =
  | { kind: 'action'; id: string }
  | { kind: 'repeat'; count: number; body: ProgramNode[] }
  | { kind: 'while'; cond: string; body: ProgramNode[] }
  | { kind: 'if'; cond: string; body: ProgramNode[]; elseBody: ProgramNode[] };

export interface VatraAction {
  id: string;
  label: string;
}

export interface VatraCondition {
  id: string;
  label: string;
}

export interface VatraFail {
  text: string; // Bunicul Fierar's comic verdict
  anim: 'bucket' | 'coal' | 'dark' | 'splash' | 'none';
  matches: (program: ProgramNode[]) => boolean;
}

export interface VatraPuzzle {
  id: string;
  title: string;
  intro: string; // Bunicul Fierar's guidance shown when the tabla opens
  success: string;
  reward: string; // what solving it hands over, shown under the intro
  rewardRepeats?: boolean; // paid out on every solve, not just the first
  actions: VatraAction[]; // atomic action blocks available in the palette
  conditions?: VatraCondition[]; // available for while/if, when allowed
  allowRepeat?: boolean; // shows the generic "repetă de N ori" container
  allowWhile?: boolean; // shows the generic "cât timp <condiție>" container
  allowIf?: boolean; // shows the generic "dacă <condiție> / altfel" container
  solution: ProgramNode[];
  fails: VatraFail[]; // checked in order; first match wins
}

// How often a lesson pays out, spelled out for the reward line the tabla and
// Bunicul's lesson list both show under the brief
export function rewardWhen(puzzle: VatraPuzzle): string {
  return puzzle.rewardRepeats ? 'la fiecare rezolvare' : 'o singură dată, la prima rezolvare';
}

const A = (id: string): ProgramNode => ({ kind: 'action', id });
const REPEAT = (count: number, body: ProgramNode[]): ProgramNode => ({ kind: 'repeat', count, body });
const WHILE = (cond: string, body: ProgramNode[]): ProgramNode => ({ kind: 'while', cond, body });
const IF = (cond: string, body: ProgramNode[], elseBody: ProgramNode[] = []): ProgramNode => ({
  kind: 'if',
  cond,
  body,
  elseBody,
});

export function programEquals(a: ProgramNode[], b: ProgramNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => nodeEquals(n, b[i]));
}

function nodeEquals(a: ProgramNode, b: ProgramNode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'action' && b.kind === 'action') return a.id === b.id;
  if (a.kind === 'repeat' && b.kind === 'repeat') return a.count === b.count && programEquals(a.body, b.body);
  if (a.kind === 'while' && b.kind === 'while') return a.cond === b.cond && programEquals(a.body, b.body);
  if (a.kind === 'if' && b.kind === 'if') {
    return a.cond === b.cond && programEquals(a.body, b.body) && programEquals(a.elseBody, b.elseBody);
  }
  return false;
}

// The linear order actions would visually execute in — repeats fully
// unrolled (capped, so a mistyped huge count can't hang this), while capped
// to a small demo count, if running both branches in sequence. Used by fail
// predicates that only care about relative order, not tree shape.
export function flattenActions(nodes: ProgramNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: ProgramNode[]) => {
    for (const n of ns) {
      if (n.kind === 'action') out.push(n.id);
      else if (n.kind === 'repeat') for (let i = 0; i < Math.min(Math.max(n.count, 0), 400); i++) walk(n.body);
      else if (n.kind === 'while') for (let i = 0; i < 5; i++) walk(n.body);
      else if (n.kind === 'if') {
        walk(n.body);
        walk(n.elseBody);
      }
    }
  };
  walk(nodes);
  return out;
}

// Recursively searches the whole tree (including inside loops/branches)
export function hasNode(nodes: ProgramNode[], pred: (n: ProgramNode) => boolean): boolean {
  for (const n of nodes) {
    if (pred(n)) return true;
    if (n.kind === 'repeat' || n.kind === 'while') {
      if (hasNode(n.body, pred)) return true;
    } else if (n.kind === 'if') {
      if (hasNode(n.body, pred) || hasNode(n.elseBody, pred)) return true;
    }
  }
  return false;
}

// True if an action with this id sits directly in `nodes` — not nested
// inside any container. Used to catch "did it unconditionally", bypassing
// the loop/condition the puzzle expects it to live inside.
export function hasTopLevelAction(nodes: ProgramNode[], id: string): boolean {
  return nodes.some((n) => n.kind === 'action' && n.id === id);
}

const before = (program: ProgramNode[], a: string, b: string): boolean => {
  const flat = flattenActions(program);
  const ia = flat.indexOf(a);
  const ib = flat.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
};

export const VATRA_PUZZLES: Record<string, VatraPuzzle> = {
  fantana: {
    id: 'fantana',
    title: 'Fântâna — prima secvență',
    intro:
      'BUNICUL FIERAR: „Fântâna-i secată de-un veac, copile. Leagă frânghia de găleată, apoi coboar-o, umple-o, urc-o și varsă apa în jgheab. Hai, arată-mi!"',
    success: 'APA CURGE! Fântâna-i vie iarăși, iar jgheabul e plin. Bunicul îți dă o Suliță de Gheață, uneltită din chiar gheața fântânii. (+1 Ice Spear)',
    reward: '1 suliță de gheață (Ice Spear)',
    rewardRepeats: true,
    actions: [
      { id: 'leaga', label: 'Leagă frânghia' },
      { id: 'umple', label: 'Umple găleata' },
      { id: 'varsa', label: 'Varsă în jgheab' },
      { id: 'coboara', label: 'Coboară găleata' },
      { id: 'urca', label: 'Urcă găleata' },
      { id: 'canta', label: 'Cântă un cântec' },
    ],
    solution: [A('leaga'), A('coboara'), A('umple'), A('urca'), A('varsa')],
    fails: [
      {
        text: 'Ai coborât găleata fără s-o legi de frânghie — a căzut în fântână cu bufnitură! Cartea Boacănelor se-ngroașă.',
        anim: 'bucket',
        matches: (p) => {
          const flat = flattenActions(p);
          return flat.includes('coboara') && flat[0] !== 'leaga';
        },
      },
      {
        text: 'Găleata a urcat GOALĂ și Bunicul a băut… aer! A doua boacănă din Cartea Boacănelor.',
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
    success: 'COLACI CALZI! Miroase-n tot satul. (+10 pâini în traistă)',
    reward: '10 pâini',
    rewardRepeats: true,
    actions: [
      { id: 'dospeste', label: 'Lasă la dospit' },
      { id: 'baga', label: 'Bagă în cuptor' },
      { id: 'presara_faina', label: 'Presară făină pe masă' },
      { id: 'aprinde', label: 'Aprinde focul' },
      { id: 'scoate', label: 'Scoate din cuptor' },
      { id: 'unge_tava', label: 'Unge tava cu unt' },
      { id: 'framanta', label: 'Frământă aluatul' },
      { id: 'asteapta', label: 'Așteaptă' },
    ],
    solution: [A('aprinde'), A('framanta'), A('dospeste'), A('baga'), A('asteapta'), A('scoate')],
    fails: [
      {
        text: '«Bagă în cuptor» înainte de «frământă»?! Din cuptor a ieșit un BOLOVAN DE CĂRBUNE fumegând. Boacănă de aur!',
        anim: 'coal',
        matches: (p) => before(p, 'baga', 'framanta'),
      },
      {
        text: 'Bunicul clatină din cap: pași buni, dar în plus — nu-s în rețetă! Pâinea a ieșit ciudată.',
        anim: 'none',
        matches: (p) => flattenActions(p).some((a) => a === 'presara_faina' || a === 'unge_tava'),
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
    title: 'Ulița cu felinare — bucla te scapă de repetiție',
    intro:
      'BUNICUL FIERAR: „Verifică-ntâi untdelemnul, apoi spune tăbliței «repetă de atâtea ori» și pune înăuntru «aprinde felinarul». N-ai nevoie să-l apeși de cinci ori — bucla face treaba, tu doar alegi numărul."',
    success:
      'Ulița-i luminată dintr-o mișcare — bucla a aprins toate felinarele! Bunicul zâmbește: „Vezi? Nu mai trebuia s-o faci de cinci ori tu însuți." (+10 lămpi)',
    reward: '10 lămpi',
    rewardRepeats: true,
    actions: [
      { id: 'verifica', label: 'Verifică untdelemnul' },
      { id: 'aprinde_felinar', label: 'Aprinde felinarul' },
      { id: 'doina', label: 'Fluieră o doină' },
    ],
    allowRepeat: true,
    solution: [A('verifica'), REPEAT(5, [A('aprinde_felinar')])],
    fails: [
      {
        text: 'Frumoasă doina… dar felinarele nu se aprind cu fluierul, dragul moșului!',
        anim: 'dark',
        matches: (p) => flattenActions(p).includes('doina'),
      },
      {
        text: 'Bucla nu-i pusă cum trebuie — nu toate cele 5 felinare s-au aprins. Numără din nou!',
        anim: 'dark',
        matches: (p) => flattenActions(p).filter((a) => a === 'aprinde_felinar').length !== 5,
      },
      {
        text: 'Felinarele n-aveau untdelemn — s-au aprins și s-au stins imediat! Verifică untdelemnul întâi.',
        anim: 'dark',
        matches: (p) => !flattenActions(p).includes('verifica'),
      },
      {
        text: 'Mijlocul uliței a rămas BEZNĂ — paznicul s-a împiedicat de o găină! Ordinea corectă, cu bucla la locul ei.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  fierarie: {
    id: 'fierarie',
    title: 'Fierăria lui Bunicul — potcoava norocoasă',
    intro:
      'BUNICUL FIERAR: „Focul întâi, apoi fierul, apoi răbdare — să se-nroșească bine. Pune o buclă cu trei lovituri de ciocan, apoi călire-n apă rece, și gata potcoava. Nu sări nicio treaptă!"',
    success: 'POTCOAVA-I GATA, lucie și tare! Norocul satului crește. (+1 târnăcop)',
    reward: '1 târnăcop',
    rewardRepeats: true,
    actions: [
      { id: 'aprinde_forja', label: 'Aprinde forja' },
      { id: 'pune_fier', label: 'Pune fierul în foc' },
      { id: 'incalzeste', label: 'Așteaptă să se-nroșească' },
      { id: 'loveste', label: 'Lovește cu ciocanul' },
      { id: 'caleste', label: 'Călește în apă' },
      { id: 'scoate_potcoava', label: 'Scoate potcoava' },
      { id: 'canta', label: 'Cântă la nicovală' },
    ],
    allowRepeat: true,
    solution: [
      A('aprinde_forja'),
      A('pune_fier'),
      A('incalzeste'),
      REPEAT(3, [A('loveste')]),
      A('caleste'),
      A('scoate_potcoava'),
    ],
    fails: [
      {
        text: 'Ciocanul a lovit nicovala GOALĂ — doar zgomot și un ecou trist. Pune fierul întâi!',
        anim: 'none',
        matches: (p) => before(p, 'loveste', 'pune_fier'),
      },
      {
        text: 'Ai călit fierul RECE — a crăpat un ciob negru din el, ca vai de mama lui. Boacănă de fierar!',
        anim: 'coal',
        matches: (p) => before(p, 'caleste', 'incalzeste'),
      },
      {
        text: 'Bucla de ciocănit nu-i pusă bine — nici trei lovituri exacte. Potcoava-i strâmbă!',
        anim: 'none',
        matches: (p) => flattenActions(p).filter((a) => a === 'loveste').length !== 3,
      },
      {
        text: 'Din forjă n-a ieșit nicio potcoavă — doar fum și ciocănituri fără rost. Ordinea, ucenice!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  grajd: {
    id: 'grajd',
    title: 'Grajdul — calul flămând',
    intro:
      'BUNICUL FIERAR: „Calul așteaptă la poartă, flămând și însetat. Deschide poarta, adu-i fân și apă — pe rând, cum se cuvine — și abia apoi lasă-l să intre."',
    success: 'Calul nechează mulțumit și intră în grajd! (+10 fân și 10 socată fermentată)',
    reward: '10 baloturi de fân și 10 sticle de socată fermentată',
    rewardRepeats: true,
    actions: [
      { id: 'deschide_poarta', label: 'Deschide poarta' },
      { id: 'adu_fan', label: 'Adu balot de fân' },
      { id: 'pune_in_iesle', label: 'Pune fânul în iesle' },
      { id: 'adu_apa', label: 'Adu apă proaspătă' },
      { id: 'toarna_apa', label: 'Toarnă apa în adăpătoare' },
      { id: 'lasa_calul', label: 'Lasă calul să intre' },
      { id: 'mangaie', label: 'Mângâie calul' },
    ],
    solution: [
      A('deschide_poarta'),
      A('adu_fan'),
      A('pune_in_iesle'),
      A('adu_apa'),
      A('toarna_apa'),
      A('lasa_calul'),
    ],
    fails: [
      {
        text: 'Calul s-a lovit de poarta ÎNCHISĂ și a nechezat supărat! Deschide poarta întâi.',
        anim: 'none',
        matches: (p) => before(p, 'lasa_calul', 'deschide_poarta'),
      },
      {
        text: 'Ai turnat apă în adăpătoarea goală — de unde n-a adus-o nimeni! Doar o baltă pe jos.',
        anim: 'bucket',
        matches: (p) => before(p, 'toarna_apa', 'adu_apa'),
      },
      {
        text: 'Calul a rămas nemulțumit — nici mâncare, nici apă la vreme. Ordinea, flăcăule!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  spalatorie: {
    id: 'spalatorie',
    title: 'Spălătoria la pârâu — rufele curate',
    intro:
      'BUNICUL FIERAR: „Rufele nu se spală oricum, copile. Adu-le, înmoaie-le-n pârâu, freacă-le cu săpun, clătește-le-n apă curată, stoarce-le bine și abia apoi întinde-le pe frânghie."',
    success: 'Rufele flutură curate-n vânt, albe ca zăpada! (+10 ii tradiționale și 10 sticlă)',
    // Deliberately shuffled: listed in solution order the puzzle solves
    // itself just by dragging the palette down in the order it's given
    reward: '10 ii tradiționale și 10 blocuri de sticlă (Glass)',
    rewardRepeats: true,
    actions: [
      { id: 'stoarce', label: 'Stoarce hainele' },
      { id: 'adu_haine', label: 'Adu hainele murdare' },
      { id: 'freaca', label: 'Freacă cu săpun' },
      { id: 'canta_la_rau', label: 'Cântă la marginea râului' },
      { id: 'intinde', label: 'Întinde pe frânghie' },
      { id: 'clateste', label: 'Clătește în apă curată' },
      { id: 'inmoaie', label: 'Înmoaie în pârâu' },
    ],
    solution: [A('adu_haine'), A('inmoaie'), A('freaca'), A('clateste'), A('stoarce'), A('intinde')],
    fails: [
      {
        text: 'Ai întins hainele UDE LEOARCĂ — apa curge pe toată ulița! Stoarce-le întâi.',
        anim: 'bucket',
        matches: (p) => before(p, 'intinde', 'stoarce'),
      },
      {
        text: 'Ai frecat haine USCATE, nici măcar înmuiate — praf peste tot, nicio pată n-a ieșit!',
        anim: 'none',
        matches: (p) => before(p, 'freaca', 'inmoaie'),
      },
      {
        text: 'Hainele au rămas murdare pe frânghie... Bunica ar avea ceva de spus despre asta!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  gard: {
    id: 'gard',
    title: 'Gardul Luncii — momentul AHA',
    intro:
      'BUNICUL FIERAR: „Lunca are nevoie de exact 30 de stâlpi de gard, copile. Pune o buclă «repetă de N ori» cu «pune un stâlp» înăuntru și scrie tu numărul potrivit — nu-l aleg eu pentru tine!"',
    success: 'GARDUL S-A RIDICAT SINGUR, stâlp după stâlp! Oile pot intra în Lunca. (+10 lână)',
    reward: '10 lână',
    actions: [
      { id: 'pune_stalp', label: 'Pune un stâlp' },
      { id: 'prinde_capatul', label: 'Prinde capătul gardului' },
      { id: 'fluiera_oi', label: 'Fluieră la oi' },
    ],
    allowRepeat: true,
    solution: [REPEAT(30, [A('pune_stalp')]), A('prinde_capatul')],
    fails: [
      {
        text: 'Ai pus prea mulți! Gardul a ieșit din sat, peste deal, prin curtea vecinului — o boacănă legendară.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'repeat' && n.count > 30),
      },
      {
        text: 'Prea puțini stâlpi înfipți — restul gardului e o gaură cât toată Lunca! Oile ies la plimbare.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'repeat' && n.count > 0 && n.count < 30),
      },
      {
        text: 'Gardul stă pe jumătate, dar capătul flutură-n vânt — nu-i priponit! Ordinea corectă, cu tot ce trebuie.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  camp_grau: {
    id: 'camp_grau',
    title: 'Câmpul de grâu — bucle în bucle',
    intro:
      'BUNICUL FIERAR: „Patru rânduri, șase spice pe rând — o buclă ÎN altă buclă, ca niște cutii una-n alta. Cea dinăuntru plantează un rând întreg; cea din afară o repetă pentru toate cele patru rânduri."',
    success: 'CÂMPUL S-A ÎNVERZIT dintr-o dată, rând cu rând! (+12 grâu)',
    reward: '12 grâu',
    actions: [
      { id: 'planteaza_spic', label: 'Plantează spicul' },
      { id: 'canta_ciocarlia', label: 'Cântă ciocârliei' },
    ],
    allowRepeat: true,
    solution: [REPEAT(4, [REPEAT(6, [A('planteaza_spic')])])],
    fails: [
      {
        text: 'Buclele-s inversate — a ieșit UN SINGUR RÂND absurd de lung, care trece dincolo de hartă!',
        anim: 'dark',
        matches: (p) =>
          hasNode(
            p,
            (n) => n.kind === 'repeat' && n.count === 6 && hasNode(n.body, (m) => m.kind === 'repeat' && m.count === 4),
          ),
      },
      {
        text: 'Câmpul a rămas pe jumătate gol — numerele buclelor nu se potrivesc cu 4 rânduri și 6 spice. Încearcă din nou!',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  moara: {
    id: 'moara',
    title: 'Moara de apă — bucla infinită',
    intro:
      'BUNICUL FIERAR: „Pornește șuvoiul, apoi pune o buclă «cât timp curge apa» cu «macină» înăuntru. Asta-i o buclă fără capăt — moara nu se oprește niciodată singură, cât timp apa curge."',
    success: 'MOARA MACINĂ ÎNTRUNA, roata nu se mai oprește! (+14 făină)',
    reward: '14 făină',
    actions: [
      { id: 'porneste_apa', label: 'Pornește șuvoiul de apă' },
      { id: 'macina', label: 'Macină' },
      { id: 'opreste_apa', label: 'Oprește apa' },
    ],
    conditions: [{ id: 'apa_curge', label: 'curge apa' }],
    allowWhile: true,
    solution: [A('porneste_apa'), WHILE('apa_curge', [A('macina')])],
    fails: [
      {
        text: 'Ai oprit apa, dar bucla ta zicea «cât timp curge apa» — morarul nu înțelege de ce te-ai oprit TU, nu bucla!',
        anim: 'none',
        matches: (p) => flattenActions(p).includes('opreste_apa'),
      },
      {
        text: 'Moara macină în gol — scârțâie, scoate fum, iar morarul iese afară furios! Fără apă, nu-i bucla ta.',
        anim: 'coal',
        matches: (p) => !flattenActions(p).includes('porneste_apa') && flattenActions(p).includes('macina'),
      },
      {
        text: 'Moara stă neclintită... pune macinatul ÎN bucla care curge, măcar o dată!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  poteca: {
    id: 'poteca',
    title: 'Poteca Mumei Pădurii — prima decizie',
    intro:
      'MUMA PĂDURII: „Hâhâhî! Vrei să treci prin pădurea mea, copile? Pune un bloc «dacă / altfel»: DACĂ e noapte, aprinde felinarul; ALTFEL, stinge-l. Alege bine condiția, ori te-ncurc în potecă!"',
    success:
      'Felinarul ascultă de noapte și de zi, cum se cuvine! Muma Pădurii chicotește mulțumită — poteca-i deschisă. (+8 ciuperci)',
    reward: '8 ciuperci',
    actions: [
      { id: 'aprinde', label: 'Aprinde felinarul' },
      { id: 'stinge', label: 'Stinge felinarul' },
    ],
    conditions: [
      { id: 'e_noapte', label: 'e noapte' },
      { id: 'e_zi', label: 'e zi' },
    ],
    allowIf: true,
    solution: [IF('e_noapte', [A('aprinde')], [A('stinge')])],
    fails: [
      {
        text: 'Felinar aprins ZIUA?! Muma Pădurii râde de tine și-ți încurcă poteca — te trezești înapoi la intrare!',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'e_zi'),
      },
      {
        text: 'Felinarul arde și ziua, și noaptea — l-ai aprins în afara oricărei condiții! Risipă mare.',
        anim: 'none',
        matches: (p) => hasTopLevelAction(p, 'aprinde'),
      },
      {
        text: 'Condiția-i pe jumătate — lipsește ori DACĂ, ori ALTFEL. Muma Pădurii așteaptă, răbdătoare.',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  pod: {
    id: 'pod',
    title: 'Podul mișcător — senzori',
    intro:
      'BUNICUL FIERAR: „Râul crește și scade fără veste, copile. Verifică semnul de nivel, apoi pune: DACĂ apa-i peste semn, ridică podul. Greșești comparația, și-i vai de cel care trece!"',
    success:
      'PODUL RĂSPUNDE LA RÂU, ca un senzor adevărat! Drum sigur peste apă, ploaie sau secetă. (+10 bolovani de râu)',
    reward: '10 bolovani de râu',
    actions: [
      { id: 'verifica_semnul', label: 'Verifică semnul de nivel' },
      { id: 'ridica', label: 'Ridică podul' },
      { id: 'coboara_mereu', label: 'Lasă podul jos mereu' },
    ],
    conditions: [
      { id: 'apa_peste_semn', label: 'apa > semn' },
      { id: 'apa_sub_semn', label: 'apa < semn' },
    ],
    allowIf: true,
    solution: [A('verifica_semnul'), IF('apa_peste_semn', [A('ridica')])],
    fails: [
      {
        text: 'Comparația-i pe dos — podul s-a ridicat FIX când trecea boierul cu căruța. Pleosc! Fail-ul suprem.',
        anim: 'splash',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'apa_sub_semn'),
      },
      {
        text: 'Podul stă jos orice-ar fi — la prima viitură, satul rămâne fără drum.',
        anim: 'none',
        matches: (p) => hasTopLevelAction(p, 'coboara_mereu'),
      },
      {
        text: 'Fără semnul verificat întâi, podul reacționează aiurea. Ordinea, copile!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  capcana: {
    id: 'capcana',
    title: 'Capcana de lup — ȘI logic',
    intro:
      'BUNICUL FIERAR: „Verifică urmele, apoi pune: DACĂ e lup ȘI e noapte, declanșează capcana. Alege bine condiția din listă — oile care trec ziua nu-s treaba capcanei!"',
    success: 'CAPCANA-I ISCUSITĂ — prinde lupul, cruță oile! Turma-i pe deplin ocrotită. (+10 lână și 3 comori dacice)',
    reward: '10 lână și 3 comori dacice',
    actions: [
      { id: 'verifica_urme', label: 'Verifică urmele' },
      { id: 'declanseaza', label: 'Declanșează capcana' },
    ],
    conditions: [
      { id: 'lup_si_noapte', label: 'e lup ȘI e noapte' },
      { id: 'lup', label: 'e lup' },
      { id: 'noapte', label: 'e noapte' },
    ],
    allowIf: true,
    solution: [A('verifica_urme'), IF('lup_si_noapte', [A('declanseaza')])],
    fails: [
      {
        text: 'Fără «ȘI noapte» — capcana a prins OAIA SATULUI la amiază! Behăit dramatic, sătenii nemulțumiți.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'lup'),
      },
      {
        text: 'Capcana s-a declanșat noaptea... dar fără lup — doar un iepuraș speriat! Lipsește condiția lupului.',
        anim: 'none',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'noapte'),
      },
      {
        text: 'Capcana-i moartă — nici urmă de lup prins. Verifică urmele și pune condiția întreagă!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
};
