# Minecraft în browser

Un joc voxel gen Minecraft care rulează complet în browser — fără server, fără asset-uri externe (texturile sunt generate procedural la pornire). Construit cu Three.js + TypeScript + Vite.

## Rulare

```bash
npm install
npm run dev      # server de dezvoltare, deschide http://localhost:5173
npm run build    # build de producție în dist/
npm run preview  # servește build-ul de producție
```

## Controale

### Pe telefon / tabletă

Jocul detectează automat ecranele tactile și afișează controale dedicate: joystick virtual în stânga pentru mișcare, tragi cu degetul oriunde pe ecran ca să privești în jur, butoane pentru săritură (⤒), coborâre în zbor (⤓), spart (⛏, ține apăsat pentru spargere continuă), plasat (⬜), zbor (✈), inventar (🎒) și pauză (❚❚). Atingi un slot din hotbar ca să-l selectezi. Pe mobil raza de randare și rezoluția sunt reduse automat pentru fluiditate.

### Pe desktop

| Tastă / acțiune | Efect |
| --- | --- |
| Click | intră în joc (pointer lock) |
| WASD | mișcare |
| Mouse | privire |
| Space | săritură / înot în sus (în zbor: urcă) |
| Shift stânga | în zbor: coboară |
| Click stânga | sparge blocul țintit (îl colectezi în inventar) |
| Click dreapta | plasează blocul selectat (consumă din inventar) |
| 1–9 / scroll | selectează slotul din hotbar |
| E | deschide inventarul — click pe un material îl pune în slotul selectat |
| F | comută modul zbor |
| Esc | pauză (eliberează mouse-ul) |

## Funcționalități

- Teren infinit generat procedural (simplex noise, seed determinist) cu dealuri, plaje de nisip și copaci
- Apă la nivelul mării: lacuri și mări semi-transparente, înot (Space te ridică), tentă albastră când ești sub apă
- 12 materiale de construcție: iarbă, pământ, piatră, nisip, buștean, frunze, scânduri, cobblestone, cărămidă, zăpadă, sticlă (transparentă) și piatră cioplită
- Inventar: fiecare sesiune pornește cu un stoc de 64 din fiecare material; spargerea blocurilor adaugă la stoc, plasarea consumă; hotbar cu 9 sloturi configurabile din panoul de inventar (tasta E)
- Mobi care se plimbă prin lume: porci, oi și zombi cu AI de hoinărit, sar peste obstacole, plutesc în apă și animație de mers
- **Ciclu zi/noapte** (~4 minute): soarele și luna traversează cerul, apusuri portocalii, stele noaptea, lumina scenei se schimbă gradual
- **Supraviețuire**: 10 inimi, daune de cădere, înec cu bară de oxigen (bule), regenerare lentă, ecran de moarte cu respawn
- **Zombi ostili noaptea**: te vânează de la 20 de blocuri, te lovesc cu knockback, iar la răsărit ard și dispar; noaptea spawn-ul e dominat de monștri
- **4 arme inventate** (nelimitate, în inventar): Sabia Furtunii (4 daune — omoară zombiul din 2 lovituri), Sabia de Cristal (6), Ciocanul de Magmă (8, lent, knockback uriaș) și Sulița de Gheață (3, rază lungă, îngheață ținta 2s); armele apar în mâna jucătorului cu animație de lovire, iar mobii au viață, flash roșu la lovitură și animație de moarte
- **3 monștri de noapte inventați**: **Umbra** (spectru translucid cu ochi violet care se teleportează spre tine), **Golemul de Piatră** (tanc lent cu 20 viață și lovituri de 2 inimi) și **Viespea Nopții** (zboară spre capul tău, fragilă dar rapidă)
- **Sunete procedurale** (Web Audio, fără fișiere): pași, spart/plasat, pleoscăit, aterizare, rănire, moarte și vocile mobilor (grohăit, behăit, geamăt de zombi)
- Salvare automată în localStorage (la ~10 secunde și la închiderea paginii): modificările lumii, poziția jucătorului, inventarul și slotul selectat se păstrează la reîncărcare
- Streaming de chunk-uri 16×64×16 în jurul jucătorului, cu buget de timp per frame
- Meshing eficient: doar fețele vizibile, o singură geometrie per chunk, umbrire direcțională coaptă în vertex colors
- Fizică first-person: gravitație, săritură, coliziune AABB pe voxeli rezolvată pe axe, la 60 Hz timestep fix
- Selecție de blocuri prin raycast voxel (Amanatides & Woo) cu contur pe blocul țintit
- 7 tipuri de blocuri cu texturi pixel-art generate pe canvas (atlas 16×16, fără mipmaps ca să nu apară bleeding)
- Hotbar, crosshair, contor FPS, ceață care ascunde încărcarea chunk-urilor

## Structură

```
src/
├── main.ts / Game.ts        # bootstrap + bucla de joc, streaming de chunk-uri
├── config.ts                # toate constantele reglabile
├── world/                   # date voxel: blocuri, chunk-uri, generare teren, raycast
├── rendering/               # atlas de texturi, meshing, management mesh-uri
├── player/                  # input (pointer lock), fizică, jucător
└── ui/                      # hotbar + HUD
```
