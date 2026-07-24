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
  anim: 'bucket' | 'coal' | 'dark' | 'splash' | 'none';
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
      'BUNICUL FIERAR: „Fântâna-i secată de-un veac, copile. Leagă frânghia de găleată, apoi coboar-o, umple-o, urc-o și varsă apa în jgheab. Hai, arată-mi!"',
    success:
      'APA CURGE! Fântâna-i vie iarăși, iar jgheabul e plin. Prima resursă a satului e a ta. (+8 chirpici)',
    palette: [
      { id: 'leaga', label: 'Leagă frânghia', copies: 1 },
      { id: 'umple', label: 'Umple găleata', copies: 1 },
      { id: 'varsa', label: 'Varsă în jgheab', copies: 1 },
      { id: 'coboara', label: 'Coboară găleata', copies: 1 },
      { id: 'urca', label: 'Urcă găleata', copies: 1 },
      { id: 'canta', label: 'Cântă un cântec', copies: 1 },
    ],
    solution: ['leaga', 'coboara', 'umple', 'urca', 'varsa'],
    fails: [
      {
        text: 'Ai coborât găleata fără s-o legi de frânghie — a căzut în fântână cu bufnitură! Cartea Boacănelor se-ngroașă.',
        anim: 'bucket',
        matches: (p) => p.includes('coboara') && p[0] !== 'leaga',
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
    success: 'COLACI CALZI! Miroase-n tot satul. (+16 mămăligă și 4 cărămidă în traistă)',
    palette: [
      { id: 'framanta', label: 'Frământă aluatul', copies: 1 },
      { id: 'scoate', label: 'Scoate din cuptor', copies: 1 },
      { id: 'aprinde', label: 'Aprinde focul', copies: 1 },
      { id: 'asteapta', label: 'Așteaptă', copies: 1 },
      { id: 'baga', label: 'Bagă în cuptor', copies: 1 },
      { id: 'dospeste', label: 'Lasă la dospit', copies: 1 },
      { id: 'presara_faina', label: 'Presară făină pe masă', copies: 1 },
      { id: 'unge_tava', label: 'Unge tava cu unt', copies: 1 },
    ],
    solution: ['aprinde', 'framanta', 'dospeste', 'baga', 'asteapta', 'scoate'],
    fails: [
      {
        text: '«Bagă în cuptor» înainte de «frământă»?! Din cuptor a ieșit un BOLOVAN DE CĂRBUNE fumegând. Boacănă de aur!',
        anim: 'coal',
        matches: (p) => before(p, 'baga', 'framanta'),
      },
      {
        text: 'Bunicul clatină din cap: pași buni, dar în plus — nu-s în rețetă! Pâinea a ieșit ciudată.',
        anim: 'none',
        matches: (p) => p.includes('presara_faina') || p.includes('unge_tava'),
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
      'BUNICUL FIERAR: „Verifică-ntâi untdelemnul din felinare, apoi aprinde-le pe toate cinci, unul câte unul. Da, e obositor. Poate-o fi vreo cale mai deșteaptă… cândva."',
    success:
      'Ulița-i luminată, paznicul îți mulțumește! „Trebuie să fie o cale mai deșteaptă…" — zice Bunicul, cu tâlc. (+4 lămpi și 6 bolovani de râu)',
    palette: [
      { id: 'verifica', label: 'Verifică untdelemnul', copies: 1 },
      { id: 'aprinde_felinar', label: 'Aprinde felinarul', copies: 5 },
      { id: 'doina', label: 'Fluieră o doină', copies: 1 },
      { id: 'canta_cocos', label: 'Strigă cucurigu', copies: 1 },
    ],
    solution: ['verifica', 'aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar', 'aprinde_felinar'],
    fails: [
      {
        text: 'Frumoasă doina… dar felinarele nu se aprind cu fluierul, dragul moșului!',
        anim: 'dark',
        matches: (p) => p.includes('doina'),
      },
      {
        text: 'Felinarele n-aveau untdelemn — s-au aprins și s-au stins imediat! Verifică untdelemnul întâi.',
        anim: 'dark',
        matches: (p) => !p.includes('verifica') && p.filter((x) => x === 'aprinde_felinar').length === 5,
      },
      {
        text: 'Mijlocul uliței a rămas BEZNĂ — paznicul s-a împiedicat de o găină! Aprinde toate cele 5 felinare.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  fierarie: {
    id: 'fierarie',
    title: 'Fierăria lui Bunicul — potcoava norocoasă',
    intro:
      'BUNICUL FIERAR: „Opt porunci, ucenice! Focul întâi, apoi fierul, apoi răbdare — să se-nroșească bine. Trei lovituri de ciocan, călire-n apă rece, și gata potcoava. Nu sări nicio treaptă!"',
    success: 'POTCOAVA-I GATA, lucie și tare! Norocul satului crește. (+târnăcop și 4 piatră)',
    palette: [
      { id: 'aprinde_forja', label: 'Aprinde forja', copies: 1 },
      { id: 'pune_fier', label: 'Pune fierul în foc', copies: 1 },
      { id: 'incalzeste', label: 'Așteaptă să se-nroșească', copies: 1 },
      { id: 'loveste', label: 'Lovește cu ciocanul', copies: 3 },
      { id: 'caleste', label: 'Călește în apă', copies: 1 },
      { id: 'scoate_potcoava', label: 'Scoate potcoava', copies: 1 },
      { id: 'canta', label: 'Cântă la nicovală', copies: 1 },
      { id: 'unge', label: 'Unge roata cu ulei', copies: 1 },
    ],
    solution: ['aprinde_forja', 'pune_fier', 'incalzeste', 'loveste', 'loveste', 'loveste', 'caleste', 'scoate_potcoava'],
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
    success: 'Calul nechează mulțumit și mănâncă în tihnă! (+8 fân și 4 sare)',
    palette: [
      { id: 'deschide_poarta', label: 'Deschide poarta', copies: 1 },
      { id: 'adu_fan', label: 'Adu balot de fân', copies: 1 },
      { id: 'pune_in_iesle', label: 'Pune fânul în iesle', copies: 1 },
      { id: 'adu_apa', label: 'Adu apă proaspătă', copies: 1 },
      { id: 'toarna_apa', label: 'Toarnă apa în adăpătoare', copies: 1 },
      { id: 'lasa_calul', label: 'Lasă calul să intre', copies: 1 },
      { id: 'mangaie', label: 'Mângâie calul', copies: 1 },
      { id: 'fluiera', label: 'Fluieră a chemare', copies: 1 },
    ],
    solution: ['deschide_poarta', 'adu_fan', 'pune_in_iesle', 'adu_apa', 'toarna_apa', 'lasa_calul'],
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
    success: 'Rufele flutură curate-n vânt, albe ca zăpada! (+4 ie tradițională și 6 bolovani de râu)',
    palette: [
      { id: 'adu_haine', label: 'Adu hainele murdare', copies: 1 },
      { id: 'inmoaie', label: 'Înmoaie în pârâu', copies: 1 },
      { id: 'freaca', label: 'Freacă cu săpun', copies: 1 },
      { id: 'clateste', label: 'Clătește în apă curată', copies: 1 },
      { id: 'stoarce', label: 'Stoarce hainele', copies: 1 },
      { id: 'intinde', label: 'Întinde pe frânghie', copies: 1 },
      { id: 'canta_la_rau', label: 'Cântă la marginea râului', copies: 1 },
      { id: 'fuga_rate', label: 'Fugi după rațe', copies: 1 },
    ],
    solution: ['adu_haine', 'inmoaie', 'freaca', 'clateste', 'stoarce', 'intinde'],
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
      'BUNICUL FIERAR: „Lunca are nevoie de 30 de stâlpi de gard, copile. Manual ar fi 30 de porunci — o zi întreagă! Dar dacă spui tăbliței «repetă de 30 de ori», ea pune singură toți stâlpii. Alege bine numărul!"',
    success: 'GARDUL S-A RIDICAT SINGUR, stâlp după stâlp! Oile pot intra în Lunca. (+10 lână)',
    palette: [
      { id: 'repeta_30', label: 'Repetă de 30 de ori', copies: 1 },
      { id: 'pune_stalp', label: 'Pune un stâlp', copies: 1 },
      { id: 'prinde_capatul', label: 'Prinde capătul gardului', copies: 1 },
      { id: 'repeta_3', label: 'Repetă de 3 ori', copies: 1 },
      { id: 'repeta_300', label: 'Repetă de 300 de ori', copies: 1 },
      { id: 'fluiera_oi', label: 'Fluieră la oi', copies: 1 },
    ],
    solution: ['repeta_30', 'pune_stalp', 'prinde_capatul'],
    fails: [
      {
        text: 'Ai zis «de 300 de ori»?! Gardul a ieșit din sat, peste deal, prin curtea vecinului — o boacănă legendară.',
        anim: 'dark',
        matches: (p) => p.includes('repeta_300'),
      },
      {
        text: 'Doar 3 stâlpi înfipți — restul gardului e o gaură cât toată Lunca! Oile ies la plimbare.',
        anim: 'dark',
        matches: (p) => p.includes('repeta_3'),
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
      'BUNICUL FIERAR: „Patru rânduri, șase spice pe rând — o buclă ÎN altă buclă. Cea dinăuntru plantează un rând întreg; cea din afară o repetă pentru toate cele patru rânduri."',
    success: 'CÂMPUL S-A ÎNVERZIT dintr-o dată, rând cu rând! (+12 grâu)',
    palette: [
      { id: 'repeta_randuri', label: 'Repetă pentru 4 rânduri', copies: 1 },
      { id: 'repeta_spice', label: 'Repetă de 6 ori (un rând)', copies: 1 },
      { id: 'planteaza_spic', label: 'Plantează spicul', copies: 1 },
      { id: 'urmatorul_rand', label: 'Treci la rândul următor', copies: 1 },
      { id: 'canta_ciocarlia', label: 'Cântă ciocârliei', copies: 1 },
    ],
    solution: ['repeta_randuri', 'repeta_spice', 'planteaza_spic', 'urmatorul_rand'],
    fails: [
      {
        text: 'Buclele-s încurcate — a ieșit UN SINGUR RÂND absurd de lung, care trece dincolo de hartă!',
        anim: 'dark',
        matches: (p) => p.indexOf('repeta_spice') >= 0 && p.indexOf('repeta_randuri') > p.indexOf('repeta_spice'),
      },
      {
        text: 'Câmpul a rămas pe jumătate gol — buclele nu s-au potrivit. Încearcă din nou ordinea!',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  moara: {
    id: 'moara',
    title: 'Moara de apă — bucla infinită',
    intro:
      'BUNICUL FIERAR: „Pornește șuvoiul, apoi spune: «Cât timp curge apa, macină». Asta-i o buclă fără capăt — moara nu se oprește niciodată singură, cât timp apa curge."',
    success: 'MOARA MACINĂ ÎNTRUNA, roata nu se mai oprește! (+14 făină)',
    palette: [
      { id: 'porneste_apa', label: 'Pornește șuvoiul de apă', copies: 1 },
      { id: 'cat_timp_curge_apa', label: 'Cât timp curge apa → macină', copies: 1 },
      { id: 'macina', label: 'Macină', copies: 1 },
      { id: 'opreste_apa', label: 'Oprește apa', copies: 1 },
      { id: 'canta_la_roata', label: 'Cântă la roată', copies: 1 },
    ],
    solution: ['porneste_apa', 'cat_timp_curge_apa', 'macina'],
    fails: [
      {
        text: 'Ai oprit apa, dar bucla ta zicea «cât timp curge apa» — morarul nu înțelege de ce te-ai oprit TU, nu bucla!',
        anim: 'none',
        matches: (p) => p.includes('opreste_apa'),
      },
      {
        text: 'Moara macină în gol — scârțâie, scoate fum, iar morarul iese afară furios! Fără apă, nu-i bucla ta.',
        anim: 'coal',
        matches: (p) => p.includes('macina') && !p.includes('porneste_apa'),
      },
      {
        text: 'Moara stă neclintită... ordinea corectă, măcar o dată!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  poteca: {
    id: 'poteca',
    title: 'Poteca Mumei Pădurii — prima decizie',
    intro:
      'MUMA PĂDURII: „Hâhâhî! Vrei să treci prin pădurea mea, copile? Arată-mi întâi că știi să gândești: DACĂ e noapte, felinarul se aprinde. ALTFEL, rămâne stins. Alege bine, ori te-ncurc în potecă!"',
    success:
      'Felinarul ascultă de noapte și de zi, cum se cuvine! Muma Pădurii chicotește mulțumită — poteca-i deschisă. (+8 ciuperci)',
    palette: [
      { id: 'daca_noapte_aprinde', label: 'DACĂ e noapte → aprinde felinarul', copies: 1 },
      { id: 'altfel_stinge', label: 'ALTFEL → stinge felinarul', copies: 1 },
      { id: 'daca_zi_aprinde', label: 'DACĂ e zi → aprinde felinarul', copies: 1 },
      { id: 'mereu_aprinde', label: 'Aprinde mereu felinarul', copies: 1 },
      { id: 'canta_mumei', label: 'Cântă Mumei Pădurii', copies: 1 },
    ],
    solution: ['daca_noapte_aprinde', 'altfel_stinge'],
    fails: [
      {
        text: 'Felinar aprins ZIUA?! Muma Pădurii râde de tine și-ți încurcă poteca — te trezești înapoi la intrare!',
        anim: 'dark',
        matches: (p) => p.includes('daca_zi_aprinde'),
      },
      {
        text: 'Felinarul arde și ziua, și noaptea — risipă mare! Nu așa se pune o condiție.',
        anim: 'none',
        matches: (p) => p.includes('mereu_aprinde'),
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
      'BUNICUL FIERAR: „Râul crește și scade fără veste, copile. Verifică semnul de nivel, apoi programează: DACĂ apa-i peste semn, ridică podul. Greșești comparația, și-i vai de cel care trece!"',
    success:
      'PODUL RĂSPUNDE LA RÂU, ca un senzor adevărat! Drum sigur peste apă, ploaie sau secetă. (+10 bolovani de râu)',
    palette: [
      { id: 'verifica_semnul', label: 'Verifică semnul de nivel', copies: 1 },
      { id: 'daca_apa_mare_ridica', label: 'DACĂ apa > semn → ridică podul', copies: 1 },
      { id: 'daca_apa_mica_ridica', label: 'DACĂ apa < semn → ridică podul', copies: 1 },
      { id: 'coboara_mereu', label: 'Lasă podul jos mereu', copies: 1 },
      { id: 'canta_la_pod', label: 'Cântă la marginea podului', copies: 1 },
    ],
    solution: ['verifica_semnul', 'daca_apa_mare_ridica'],
    fails: [
      {
        text: 'Comparația-i pe dos — podul s-a ridicat FIX când trecea boierul cu căruța. Pleosc! Fail-ul suprem.',
        anim: 'splash',
        matches: (p) => p.includes('daca_apa_mica_ridica'),
      },
      {
        text: 'Podul stă jos orice-ar fi — la prima viitură, satul rămâne fără drum.',
        anim: 'none',
        matches: (p) => p.includes('coboara_mereu'),
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
      'BUNICUL FIERAR: „Verifică urmele, apoi capcana se-nchide DOAR dacă-i lup ȘI e noapte deodată. Oile care trec ziua nu-s treaba capcanei!"',
    success: 'CAPCANA-I ISCUSITĂ — prinde lupul, cruță oile! Turma-i pe deplin ocrotită. (+10 lână și 3 comoară dacică)',
    palette: [
      { id: 'verifica_urme', label: 'Verifică urmele', copies: 1 },
      { id: 'daca_lup_si_noapte_prinde', label: 'DACĂ e lup ȘI e noapte → declanșează', copies: 1 },
      { id: 'daca_lup_prinde', label: 'DACĂ e lup → declanșează', copies: 1 },
      { id: 'daca_noapte_prinde', label: 'DACĂ e noapte → declanșează', copies: 1 },
      { id: 'canta_la_capcana', label: 'Fluieră la capcană', copies: 1 },
    ],
    solution: ['verifica_urme', 'daca_lup_si_noapte_prinde'],
    fails: [
      {
        text: 'Fără «ȘI noapte» — capcana a prins OAIA SATULUI la amiază! Behăit dramatic, sătenii nemulțumiți.',
        anim: 'dark',
        matches: (p) => p.includes('daca_lup_prinde'),
      },
      {
        text: 'Capcana s-a declanșat noaptea... dar fără lup — doar un iepuraș speriat! Lipsește condiția lupului.',
        anim: 'none',
        matches: (p) => p.includes('daca_noapte_prinde'),
      },
      {
        text: 'Capcana-i moartă — nici urmă de lup prins. Verifică urmele și pune ambele condiții!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
};
