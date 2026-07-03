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

| Tastă / acțiune | Efect |
| --- | --- |
| Click | intră în joc (pointer lock) |
| WASD | mișcare |
| Mouse | privire |
| Space | săritură / înot în sus (în zbor: urcă) |
| Shift stânga | în zbor: coboară |
| Click stânga | sparge blocul țintit (îl colectezi în inventar) |
| Click dreapta | plasează blocul selectat (consumă din inventar) |
| 1–7 / scroll | selectează blocul din hotbar |
| E | deschide/închide inventarul |
| F | comută modul zbor |
| Esc | pauză (eliberează mouse-ul) |

## Funcționalități

- Teren infinit generat procedural (simplex noise, seed determinist) cu dealuri, plaje de nisip și copaci
- Apă la nivelul mării: lacuri și mări semi-transparente, înot (Space te ridică), tentă albastră când ești sub apă
- Inventar în stil survival: spargi blocuri ca să le colectezi, plasarea consumă din stoc; contoare pe hotbar și panou de inventar pe tasta E
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
