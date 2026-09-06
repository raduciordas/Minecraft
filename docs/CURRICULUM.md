# CUBURIA — planul curriculumului și testele manuale

Documentul de lucru pentru dezvoltarea părții educative a jocului: planul
complet pe șapte zone, ce s-a construit până acum și lista de verificat cu
mâna după fiecare fază.

Public țintă: copii de 8–11 ani, programare vizuală în blocuri.

---

## 1. Context și deciziile luate

CUBURIA avea la pornirea acestui plan 14 lecții Blockly în trei zone: Vatra
cu secvențe, Lunca cu bucle și Pădurea cu condiții, ultima construită dar
închisă. Motorul știa doar `repetă de N ori`, `cât timp` și `dacă/altfel`,
nu avea variabile, funcții, evenimente sau comparații, și nu evalua nimic la
rulare: bucla `cât timp` rula fix cinci pași, iar `dacă` juca ambele ramuri.

Cerința: un curriculum mult mai larg, care să parcurgă și să recapituleze cât
mai multe concepte de programare, iar fiecare lecție să aducă în joc un
material nou, fără de care copilul să nu se poată juca bine sau care să-l
ajute mult.

| Întrebare | Decizie |
|---|---|
| Materiale noi | Unul nou pe lecție, treizeci și șase în total |
| Progresie între zone | Deschisă, fără porți; recompensele ajută, nu blochează |
| Amploare | Șapte zone, treizeci și șase de lecții |
| Zborul pe tasta F | Devine răsplată câștigată, Aripile Zmeului, la Fierăria lui Bunicul, a patra lecție din Vatra |

---

## 2. Principiile de design

1. **Un singur interpretor, pentru animație și pentru notare.** Fișierul
   `src/vatra/Interpreter.ts` evaluează cu adevărat: variabile, aritmetică,
   comparații, logică, aleator cu sămânță fixă. Citește condițiile și
   senzorii dintr-un scenariu al lecției și produce o urmă. Același cod
   rulează lent în tablă, cu evidențierea blocului curent, și instantaneu la
   notare.
2. **Notare hibridă.** Un program trece dacă are forma soluției, indiferent
   cum și-a numit copilul cutiuțele și procedurile, SAU dacă face exact
   aceleași lucruri în toate scenariile și îndeplinește cerințele lecției.
   Cerințele opresc soluțiile desfăcute pe degete, de exemplu culesul scris
   de șase ori în loc de o buclă.
3. **Scenariile înlocuiesc convențiile vechi.** O lecție cu condiții se
   încearcă într-o noapte și într-o zi, la viitură și la secetă. Cerul se
   colorează după numele scenariului, așa că se vede de ce contează condiția.
4. **Blocuri Blockly standard** pentru variabile, proceduri, logică și
   numere, plus două proprii: pălăria „când se întâmplă" și senzorii per
   lecție. Vin gratis cu localizarea românească și cu generatorul Python.
5. **Obiectele nu blochează, dar au mecanică reală.** Categorii pe intervale
   de identificatori, ca să nu se ciocnească niciodată între ele.
6. **Zonele stau într-un tabel**, nu în cod copiat de șapte ori.

---

## 3. Curriculum, privire de ansamblu

| # | Zonă | Concept | Ghid | Lecții | Stare |
|---|---|---|---|---|---|
| 1 | Vatra | Secvențe | Bunicul Fierar | 6 | gata |
| 2 | Lunca | Bucle | Baciul Luncii | 5 | gata |
| 3 | Pădurea | Condiții, logică, decizia în buclă | Muma Pădurii | 5 | gata |
| 4 | Stâna | Variabile, numărare, comparații, senzori | Baba Dochia | 5 | gata |
| 5 | Târgul | Proceduri, parametri, compunere | Meșterul Olar | 5 | de făcut |
| 6 | Prisaca | Evenimente | Moș Ilie Prisăcarul | 5 | de făcut |
| 7 | Cetatea | Depanare, aleator, recapitulare | Pârcălabul Radu | 5 | de făcut |

Progresia: secvențe, bucle, condiții, variabile, proceduri, evenimente,
depanare și capstone. A cincea lecție din fiecare zonă nouă recapitulează
explicit ce s-a învățat înainte.

Notație pseudocod folosită mai jos: `A` acțiune, `R` repetă, `W` cât timp,
`IF` dacă, `SET` pune, `CHG` schimbă, `DEF` definește, `CALL` cheamă, `WHEN`
când, `V` valoarea cutiuței, `S` senzor, `CMP` comparație, `RND` aleator.

---

## 4. Zonele deja construite

### Zona 1 — Vatra, secvențe, Bunicul Fierar

| Lecție | Ce învață | Obiectul nou |
|---|---|---|
| Fântâna | prima secvență | Găleată |
| Cuptorul | ordinea contează | 3 cozonaci |
| Ulița | prima buclă | 8 torțe |
| Fierăria | buclă în secvență | Topor **și Aripile Zmeului**, care deschid zborul |
| Grajdul | secvență lungă | Lopată |
| Spălătoria | secvență lungă | 12 frânghii |

### Zona 2 — Lunca, bucle, Baciul Luncii

| Lecție | Ce învață | Obiectul nou |
|---|---|---|
| Gardul Luncii | alegi tu numărul | Bâta ciobanului |
| Câmpul de grâu | buclă în buclă | 2 sperietori de ciori |
| Moara de apă | bucla fără capăt | 4 plăcinte cu brânză |
| Livada de meri | corp de buclă cu mai mulți pași | 16 mere |
| Căpițele de fân | buclă în buclă, cu pași | 4 saltele de paie |

### Zona 3 — Pădurea, condiții, Muma Pădurii

Toate cinci se notează după purtare, în mai multe scenarii.

| Lecție | Ce învață | Scenarii | Obiectul nou |
|---|---|---|---|
| Poteca | dacă/altfel | Noaptea, Ziua | Amuletă de usturoi |
| Podul mișcător | dacă, fără altfel | Viitura, Seceta | Undiță |
| Capcana de lup | ȘI logic | patru vremuri | 6 capcane de lup |
| Culesul de ciuperci | decizia din buclă | Poiana, șase ciuperci | Arc cu săgeți |
| Răscrucea | SAU și NU | patru vremuri | Busolă |

Soluțiile canonice pentru cele două lecții noi:

```
ciuperci:  A(ia_cosul)
           R(6, [ A(priveste_ciuperca),
                  IF(e_otravitoare, [A(ocoleste)], [A(culege)]) ])
           A(du_cosul_acasa)

rascruce:  A(opreste_te)
           IF(OR(e_ceata, e_noapte), [A(aprinde_torta)])
           IF(NOT(poteca_e_dreapta), [A(ia_o_la_stanga)], [A(mergi_inainte)])
```

### Zona 4 — Stâna Babei Dochia, variabile

Construită peste **Satul Bunicii**, satul care stătea gol lângă castelul lui
Vlad, la x 36, z 36. Cele trei case și fântâna au rămas exact unde erau;
stâna s-a ridicat în jurul lor. Toate cinci lecțiile se notează după purtare,
cu cerințe care cer folosirea cutiuței, nu numărul scris de mână.

| Lecție | Ce învață | Obiectul nou |
|---|---|---|
| Cojoacele Dochiei | prima cutiuță, acțiune cu argument | Cojoc, scade fiecare lovitură cu o inimă |
| Numărătoarea oilor | contor care crește în buclă | 6 brânză de burduf |
| Țarcul | cât timp, cu comparație pe cutiuță | Fluier fermecat |
| Drumul oilor | senzor, cutiuța ca număr de pași | Opinci iuți |
| Socoteala stânii | două cutiuțe care se hrănesc una pe alta | Hartă, minimapă |

Soluțiile canonice:

```
cojoacele:        SET(cojoace,9), A(spune_cate, V(cojoace))
oile_la_numarat:  SET(oi,0), R(7,[A(trece_o_oaie), CHG(oi,1)]), A(spune_cate,V(oi))
tarcul:           SET(afara,5), W(CMP(V(afara),'>',0),[A(baga_o_oaie), CHG(afara,-1)]),
                  A(inchide_poarta)
drumul_oilor:     SET(pasi,S(pasi_pana_la_pasune)), R(V(pasi),[A(pas_inainte)]),
                  A(lasa_oile_sa_pasca)
socoteala_stanii: SET(lapte,0), SET(branza,0),
                  R(4,[A(mulge_o_oaie), CHG(lapte,2)]),
                  W(CMP(V(lapte),'>',0),[A(fa_un_cas), CHG(lapte,-2), CHG(branza,1)]),
                  A(spune_cate, V(branza))
```

Structuri, toate în jurul caselor vechi: gardul cu nouă cojoace la vest de
fântână, poarta de numărat la nord, țarcul mai departe spre nord pe terenul
plat, poteca cu opt borne spre pășune, jgheabul de muls cu poliță de caș la
sud-vest, și **răbojul**, o tăblie care scrie în lume ce ține fiecare cutiuță,
în timp ce programul rulează.

**De ce e așezată așa.** Satul stă pe o creastă îngustă: terenul cade șase
cuburi spre vest și urcă în munte spre sud-est. Generatorul aplatizează un
singur dreptunghi în jurul tuturor blocurilor unei construcții, așa că stâna
e întinsă spre nord, unde terenul e la nivel, și nu trece de x 13 sau z 12.
Așezarea finală sapă 14 cuburi din deal, față de 13 cât săpa satul singur —
practic aceeași urmă.

---

## 5. Zonele de construit

### Zona 5 — Târgul, proceduri, Meșterul Olar

Origine propusă: x 5, z 45.

| Lecție | Concept nou | Obiectul nou |
|---|---|---|
| Ulciorul | definește și cheamă de trei ori | *de ales* |
| Hora | procedura chemată din buclă | Pat, sari peste noapte |
| Covorul | procedura cu parametru | Buzdugan |
| Căruța | proceduri care cheamă proceduri | Piatră de praștie |
| Ziua de târg | recapitulare, procedură cu dacă și contor | Ulcior cu jar |

Structuri: patru tarabe, atelier de olar cu roată care se învârte, cerc de
horă, război de țesut care țese covorul rând cu rând, căruță cu cal.

### Zona 6 — Prisaca, evenimente, Moș Ilie Prisăcarul

Origine propusă: x -85, z 15.

| Lecție | Concept nou | Obiectul nou |
|---|---|---|
| Ursul la miere | primul „când" | Miere |
| Noaptea la prisacă | două „când" distincte | Foc de tabără |
| Clopotul | dacă înăuntrul unui „când" | Clopot |
| Roiul | contor peste evenimente, cu comparație | Scară |
| Înțepătura | recapitulare, procedură plus evenimente | Mască de prisăcar |

Structuri: șase stupi cu ferestruici, pârâu, vatră de foc, clopotniță,
șopron de miere, un urs care apare la eveniment și fuge.

### Zona 7 — Cetatea, depanare și capstone, Pârcălabul Radu

Origine propusă: x 48, z -22, la poalele castelului lui Vlad.

| Lecție | Concept nou | Obiectul nou |
|---|---|---|
| Straja | repară un program stricat, cu două defecte | Scut |
| Zarul | aleator plus comparație | Cămașă de zale |
| Hrana cetății | recapitulare, senzor, cât timp, mai mic | Oglindă fermecată |
| Asediul | recapitulare, evenimente plus proceduri | Sabia lui Făt-Frumos |
| Marea Probă | totul laolaltă | Mărul de aur, plus o inimă permanent |

Structuri: fort de piatră cu patru turnuri, poartă, masă cu zar, hambar,
catarg cu steag ridicat la reușita finală, torțe care se aprind noaptea.

---

## 6. Cele treizeci și șase de obiecte

Cheia întregului plan: fiecare lecție aduce un obiect nou, cu mecanică
adevărată. Identificatorii stau pe intervale care nu se ciocnesc.

| Interval | Categorie | Fișier |
|---|---|---|
| 0–99 | cuburi | `src/world/Block.ts` |
| 100–199 | arme | `src/items/Weapon.ts` |
| 200–299 | de aruncat | `src/items/Throwable.ts` |
| 300–399 | unelte | `src/items/Tool.ts` |
| 400–499 | mâncare | `src/items/Consumable.ts` |
| 500–599 | straie și talismane | `src/items/Gear.ts` |

Obiectele deja în joc, primele șaisprezece:

| # | Obiect | Id | Ce face | Lecția |
|---|---|---|---|---|
| 1 | Găleată | 305 și 306 | ia apă din lume și o varsă unde vrei | Fântâna |
| 2 | Cozonac | 400 | trei inimi, vindecare dublă cincisprezece secunde | Cuptorul |
| 3 | Torță | 40 | lumină ieftină, luminează și ținută în mână | Ulița |
| 4 | Topor | 301 | un buștean dă trei | Fierăria |
| 5 | Lopată | 302 | sapă trei cuburi de pământ deodată | Grajdul |
| 6 | Frânghie | 41 | te cațeri pe ea | Spălătoria |
| 7 | Bâta ciobanului | 104 | rază lungă, împinge tare | Gardul |
| 8 | Sperietoare de ciori | 42 | monștrii pe opt cuburi nu te mai urmăresc | Câmpul de grâu |
| 9 | Plăcintă cu brânză | 401 | două inimi și jumătate | Moara |
| 10 | Măr | 402 | o inimă, vin șaisprezece deodată | Livada |
| 11 | Saltea de paie | 43 | aterizare fără daune, te saltă înapoi | Căpițele |
| 12 | Amuletă de usturoi | 500 | monștrii te simt de la jumătate din distanță | Poteca |
| 13 | Undiță | 304 | pește din orice apă, după două secunde | Podul |
| 14 | Capcană de lup | 44 | monstrul care calcă pierde șase viață și se încetinește | Capcana |
| 15 | Arc cu săgeți | 105 | lovește de departe, singurul răspuns la Zmeu | Ciupercile |
| 16 | Busolă | 303 | ținută în mână, săgeată spre cea mai apropiată zonă, cu distanța | Răscrucea |
| — | Aripile Zmeului | 506 | deblochează zborul pe tasta F | Fierăria |

Obiectele Stânii, adăugate la faza 2:

| # | Obiect | Id | Ce face | Lecția |
|---|---|---|---|---|
| 17 | Cojoc | 502 | fiecare lovitură primită doare cu o inimă mai puțin | cojoacele |
| 18 | Brânză de burduf | 404 | trei inimi, plus douăzeci de secunde de mers iute | oile_la_numarat |
| 19 | Fluier fermecat | 307 | monștrii pe doisprezece cuburi înțepenesc cinci secunde | tarcul |
| 20 | Opinci iuți | 503 | viteză cu un sfert mai mare, cazi de la două cuburi mai sus | drumul_oilor |
| 21 | Hartă | 309 | ținută în mână, minimapă cu zonele și casa însemnate | socoteala_stanii |

Obiectele zonelor rămase, în ordinea lecțiilor: Pat, Buzdugan, Piatră de
praștie, Ulcior cu jar, Miere, Foc de tabără, Clopot, Scară, Mască de
prisăcar, Scut, Cămașă de zale, Oglindă fermecată, Sabia lui Făt-Frumos,
Mărul de aur. Prima lecție din Târg, Ulciorul, rămâne fără obiect ales,
fiindcă Busola i-a fost mutată la Răscruce — de ales când se construiește
zona.

Trei dintre ele sunt deja legate în cod pentru zonele viitoare, dar nu le dă
încă nicio lecție: Cămașa de zale, Masca de prisăcar și creșterea vieții
maxime de la Mărul de aur.

---

## 7. Fazarea lucrului

| Fază | Conținut | Mărime | Stare |
|---|---|---|---|
| 0a | Interpretorul, modelul de program, notarea hibridă, tabla Blockly | mare | gata |
| 0b | Zone pe tabel, infrastructura obiectelor | mare | gata |
| 1 | Pădurea deschisă, două lecții noi, obiectele 1–16 | medie | gata |
| 2 | Stâna, variabile, obiectele 17–21 | mare | gata |
| 3 | Târgul, proceduri, obiectele 22–26 | medie spre mare | de făcut |
| 4 | Prisaca, evenimente, obiectele 27–31 | medie | de făcut |
| 5 | Cetatea, capstone, obiectele 32–36 | medie | de făcut |

Ordinea 0a, 0b, 1 a fost obligatorie. Fazele 2–5 se pot lucra parțial în
paralel, fiindcă zonele și lecțiile sunt date, nu cod.

### Ce s-a construit la faza 0a

Modelul de program s-a lărgit fără să strice lecțiile vechi: un număr rămâne
o expresie validă și un text rămâne o condiție validă, deci datele scrise
înainte de variabile sunt în continuare corecte.

Fișiere atinse: `src/vatra/VatraPuzzles.ts` pentru model și constructori,
`src/vatra/Interpreter.ts` nou, `src/ui/BlocklyPanel.ts` pentru blocuri,
paletă, încărcarea unui program și rularea pe scenarii, `src/vatra/VatraModule.ts`
pentru notare.

### Ce s-a construit la faza 0b

Zonele stau în tabelul `ZONE_DEFS`, regiunile de click în `CLICK_REGIONS`, iar
fiecare lecție are propria funcție de animație într-un dicționar, în loc de
un lanț de „altfel dacă" tot mai lung.

Fișiere noi: `src/items/Consumable.ts`, `src/items/Gear.ts`,
`src/items/Items.ts`, `src/player/StatusEffects.ts`,
`src/world/SpecialBlockIndex.ts`.

### Ce s-a construit la faza 2

Zona 4 peste satul gol de lângă castel. Panoul Cutiuțe din tablă și fereastra
proprie pentru numele unei cutiuțe, scrise la faza 0a, intră abia acum în
folosință, fiindcă astea sunt primele lecții cu variabile. Răbojul e o
tăblie din lume legată de același flux: tabla anunță fiecare schimbare de
cutiuță, iar tăblia o scrie pe scândură.

Mecanici noi de motor: armura și viteza care vin din traistă, iertarea la
cădere, înghețarea monștrilor, și minimapa din `src/ui/MiniMap.ts`, desenată
de patru ori pe secundă doar cât harta e în mână.

### Ce s-a construit la faza 1

Muma Pădurii a devenit ghid clicabil cu panoul ei, cele trei lecții vechi din
Pădure s-au mutat pe notarea după purtare, s-au adăugat Culesul de ciuperci
și Răscrucea, iar în lume au apărut poiana cu șase ciuperci, dintre care două
otrăvitoare, răscrucea cu trei poteci, stâlpul cu torță și copacul reper.

---

## 8. Verificarea automată

Scripturile de verificare stau în directorul de lucru al sesiunii, nu în
repo, fiindcă pornesc un browser real peste serverul de dezvoltare.

| Script | Ce verifică | Rezultat la faza 2 |
|---|---|---|
| `check_puzzles.js` | datele lecțiilor: soluția rezolvă toate scenariile, niciun mesaj de eșec nu se declanșează pe soluție, toate acțiunile și condițiile există, fiecare răsplată e un obiect cunoscut, fiecare lecție e într-o singură zonă | 21 lecții curate |
| `regress.js` | fiecare lecție rezolvată prin tablă, cu răsplata numărată în traistă, plus câte un program greșit pentru fiecare mesaj de eșec | 21 din 21, 55 mesaje din 55 |
| `alt_solutions.js` | programe cu altă formă dar aceeași purtare trebuie acceptate | 5 din 5 |
| `items.js` | câte o aserțiune pentru fiecare mecanică de obiect din faza 1 | 17 din 17 |
| `items_stana.js` | aceleași, pentru cele cinci obiecte ale Stânii | 5 din 5 |
| `requirements.js` | variantele echivalente trec, iar cele care sar peste concept sunt refuzate cu textul cerinței | 9 din 9 |
| `roundtrip.js` | un program dus în tablă și adus înapoi rămâne identic | identic |

Comanda de pornire a serverului pentru ele: `npx vite --port 5210 --strictPort`.

---

## 9. Testele manuale

### 9.1 Pregătire

Pornește cu `npm run dev` și deschide adresa locală. Consola browserului, pe
tasta F12, are aceste scurtături. Sunt necesare, fiindcă zborul e blocat la
început și drumul pe jos durează.

```js
// sari lângă o lecție anume
const [x, y, z] = __game.vatra.originFor('rascruce');
__game.player.body.x = x + 10.5; __game.player.body.z = z + 6.5; __game.player.body.y = y + 3;

__game.inventory.add(506, 1);         // Aripile Zmeului, ca să poți zbura
__game.dayNight.time = 0;             // noapte
__game.dayNight.time = 0.5;           // zi
await __game.solveLesson('ciuperci'); // rezolvă instant o lecție
localStorage.removeItem('cuburia-vatra-v1'); location.reload();  // reia toate lecțiile
localStorage.clear(); location.reload();                          // lume nouă de tot
```

Unde dai click dreapta pentru lecțiile din Pădure:

| Lecție | Pe ce dai click | x | z |
|---|---|---|---|
| Poteca | stâlpul cu felinar | -50 | -16 |
| Podul | scândura podului | -50 | -7 |
| Capcana | platforma de scânduri | -37 | -14 |
| Ciupercile | o ciupercă din poiană | -56 | -10 |
| Răscrucea | poteca de piatră | -40 | -6 |
| Muma Pădurii | direct pe ea, deschide panoul | -53 | -14 |

### 9.2 Pădurea și tabla de blocuri, faza 1

- [ ] **Muma Pădurii e ghid.** Click dreapta pe ea deschide panoul cu
      explicația despre condiții și cu toate cele cinci lecții, fiecare cu
      răsplata ei și cu buton de deschidere.
- [ ] **Nu mai apare „în construcție".** Click dreapta pe felinarul de la
      Potecă deschide tabla, nu mesajul vechi.
- [ ] **Scenariile se văd la rulare.** La Potecă, sub tablă apare pe rând
      „Încercarea 1/2: Noaptea…" și „Încercarea 2/2: Ziua…", iar cerul din
      spate se întunecă și se luminează odată cu ele.
- [ ] **Cerul urmează doar scenariile cu nume de vreme.** La Capcană și la
      Răscruce cerul se schimbă. La Pod și la Ciuperci rămâne neschimbat,
      fiindcă scenariile se cheamă Viitura, Seceta și Poiana.
- [ ] **Notarea după purtare.** La Potecă, varianta pe dos, „dacă e zi →
      Stinge, altfel → Aprinde", trebuie ACCEPTATĂ. Înainte era respinsă.
- [ ] **Culesul de ciuperci.** La reușită, cele patru ciuperci bune dispar
      din poiană, cele două violete rămân, iar la marginea poienii apare
      coșul.
- [ ] **Greșeli la ciuperci.** „Gustă ciuperca" în buclă dă mesajul cu Muma
      Pădurii care te găsește verde la față. Blocul „dacă" scos afară din
      buclă spune că doar o ciupercă a fost verificată.
- [ ] **Răscrucea.** Blocurile „sau" și „nu" se iau din categoria Condiții.
- [ ] **Greșeala clasică de la Răscruce.** „Și" în loc de „sau" dă mesajul cu
      ceața fără noapte și capul în copac.
- [ ] **Paleta pe categorii.** La Capcană și la Răscruce paleta are butoane
      de categorii. La celelalte paisprezece rămâne lista simplă, deschisă.
- [ ] **Schimbarea între palete.** Deschide Fântâna, închide, deschide imediat
      Răscrucea. Tabla se reconstruiește fără eroare. Aici a fost o problemă
      reparată.
- [ ] **Codul Python.** La Răscruce, secțiunea „Vezi codul adevărat" arată
      `if` cu `and`, `or` și `not` scrise corect.

### 9.3 Obiectele fazei 1

- [ ] **Găleata.** Click dreapta pe apă o umple, click dreapta pe loc liber o
      varsă. Pe pătratele lecțiilor nu merge, se aude doar un clinchet.
- [ ] **Toporul.** Un trunchi spart cu toporul selectat dă trei bușteni.
- [ ] **Lopata.** Pământ, iarbă sau nisip: trei cuburi în adâncime dintr-o
      lovitură, toate trei în traistă.
- [ ] **Torța.** Pusă jos noaptea luminează în jur. Ținută în mână, lumina te
      urmează prin întuneric.
- [ ] **Frânghia.** Patru sau cinci puse una peste alta pe un perete: intri în
      ele, ții Spațiu sau W ca să urci, Shift ca să cobori. Fără nimic apăsat,
      aluneci încet în jos.
- [ ] **Salteaua de paie.** Săritură de zece cuburi pe ea: nicio inimă
      pierdută și te aruncă puțin înapoi în sus.
- [ ] **Cozonacul.** Sub jumătate de viață: trei inimi și vindecare vizibil
      mai rapidă cincisprezece secunde.
- [ ] **Plăcinta, mărul, peștele.** Două inimi și jumătate, o inimă, două
      inimi.
- [ ] **Undița.** Click dreapta pe apă: apare mesajul, iar după două secunde
      un pește intră în traistă.
- [ ] **Bâta ciobanului.** Atinge de mai departe decât sabia și azvârle
      monstrul mult mai tare.
- [ ] **Sperietoarea de ciori.** Noaptea, zombiul ajuns la mai puțin de opt
      cuburi de ea se oprește din urmărit.
- [ ] **Capcana de lup.** Primul monstru care calcă pierde șase viață, rămâne
      încetinit, iar capcana dispare. Un porc sau o oaie nu o declanșează.
- [ ] **Arcul cu săgeți.** Click stânga trimite o săgeată care zboară drept și
      cade puțin. De încercat pe un Zmeu, care altfel nu poate fi atins.
- [ ] **Amuleta de usturoi.** Lucrează din traistă. Noaptea, monștrii te
      observă de la jumătate din distanța obișnuită.

### 9.4 Zborul și interfața

- [ ] **Zborul blocat.** Într-o lume nouă, tasta F nu face nimic, apare doar
      mesajul că ai nevoie de Aripile Zmeului. La fel butonul cu avion pe
      telefon.
- [ ] **Zborul deblochat.** După Răscruce, F zboară. Ecranul de pornire spune
      corect că F cere aripile.
- [ ] **Ajutorul pe H.** Există secțiunile noi „De mâncat" și „Straie și
      talismane", iar la Unelte sunt șase unelte. Niciun material nu scrie că
      nu are nicio sursă.
- [ ] **Inventarul pe E.** Toate obiectele noi apar cu iconiță proprie și cu
      numărul lor, și pot fi puse în bara de jos.

### 9.5 Regresie

- [ ] **Cele unsprezece lecții vechi.** Câte una din Vatra și din Luncă merg
      exact ca înainte, cu efectele lor: apa în jgheab, calul în grajd, rufele
      pe frânghie, oile în luncă, roata morii care se învârte.
- [ ] **Pătratele protejate.** Nu se poate săpa și nu se poate pune niciun cub
      pe niciun pătrat de lecție, inclusiv în poiana cu ciuperci și pe
      răscruce.

### 9.6 Stâna Babei Dochia, faza 2

Satul e la x 36, z 36, lângă castel. Unde dai click dreapta:

| Lecție | Pe ce dai click | x | z |
|---|---|---|---|
| Cojoacele | un stâlp din gardul de cojoace | 25 | 38 |
| Numărătoarea oilor | pământul bătut de sub poartă | 36 | 25 |
| Țarcul | un buștean din gardul țarcului | 41 | 21 |
| Drumul oilor | o bornă de pe potecă | 33 | 21 |
| Socoteala stânii | jgheabul de muls | 28 | 43 |
| Baba Dochia | direct pe ea, deschide panoul | 36 | 39 |

- [ ] **Satul a rămas sat.** Cele trei case și fântâna sunt exact unde erau,
      cu stâna ridicată în jurul lor, iar marginile pad-ului plat nu fac
      faleze mai mari decât înainte.
- [ ] **Baba Dochia e ghid.** Click dreapta pe ea deschide panoul cu
      explicația despre cutiuțe și cele cinci lecții.
- [ ] **Panoul Cutiuțe.** La orice lecție din Stână, sub tablă apare rândul
      „🧮 Cutiuțe" și valorile se schimbă în timp real cât rulează programul.
      Aici se vede prima dată, fiindcă sunt primele lecții cu variabile.
- [ ] **Răbojul.** Tăblia de lângă Dochia scrie aceleași valori, în lume, în
      timp ce programul rulează, și se golește la fiecare rulare nouă.
- [ ] **Creezi o cutiuță.** În categoria Cutiuțe, apasă „Creează o variabilă".
      Trebuie să apară fereastra de lemn a jocului, nu cea a browserului.
- [ ] **Numele nu contează.** La Numărătoarea oilor, botează cutiuța „mieluțe"
      în loc de „oi". Programul trebuie să treacă la fel.
- [ ] **Cerințele.** La Numărătoarea oilor, scrie cele șapte oi pe rând, fără
      buclă. Trebuie să fii refuzat cu mesajul care-ți cere bucla, nu cu un
      eșec obișnuit. La fel, la Cojoacele, scrie numărul 9 direct în bloc: te
      refuză și-ți cere să-l citești din cutiuță.
- [ ] **Bucla fără capăt.** La Țarc, scoate „schimbă afara cu -1" din buclă.
      Trebuie să primești mesajul cu Dochia care a albit la poartă, nu o
      pagină înghețată.
- [ ] **Trei drumuri.** La Drumul oilor, pune un număr fix în buclă, de
      exemplu 4. Trece primul scenariu dar pică la al doilea, cu mesajul
      despre râpă. Cu senzorul în cutiuță, trec toate trei.
- [ ] **Efectele în lume.** După fiecare rezolvare: cojoacele atârnă pe gard,
      oile numărate se aliniază dincolo de poartă, țarcul se închide și apar
      cinci oi înăuntru, poteca se înverzește, iar polița se umple cu cașuri.

### 9.7 Obiectele Stânii

- [ ] **Cojoc.** Lasă un monstru să te lovească fără el, apoi cu el în
      traistă. A doua lovitură trebuie să doară cu o inimă mai puțin.
- [ ] **Brânză de burduf.** Sub jumătate de viață: trei inimi înapoi și
      douăzeci de secunde vizibil mai iute.
- [ ] **Fluier fermecat.** Noaptea, cu monștri aproape, click dreapta. Cei pe
      doisprezece cuburi înțepenesc cinci secunde, sclipind albăstrui, iar
      fluierul intră în răgaz douăzeci de secunde.
- [ ] **Opinci iuți.** Mergi cu ele și fără ele: diferența se simte. Sari de
      la vreo șapte cuburi: fără ele doare, cu ele nu.
- [ ] **Hartă.** Selectează-o: apare harta în colțul din dreapta sus, cu
      terenul, numele zonelor și săgeata ta roșie care se rotește. Schimbă
      obiectul din mână: harta dispare.

### 9.8 Ce nu se poate testa încă

Programul stricat care se repară singur, cămașa de zale, masca de prisăcar și
creșterea vieții maxime sunt legate în cod pentru zonele următoare, dar nu le
dă încă nicio lecție. Blocarea unei lecții pentru un singur jucător în
multiplayer funcționează doar după redeploy-ul serverului de pe Render.

---

## 10. Riscuri de urmărit

- **Zborul câștigat** e cea mai mare schimbare de simțire a jocului. Copilul
  fără aripi merge pe jos și înfruntă noaptea. Ordinea răsplăților timpurii,
  torța la Uliță, cozonacul la Cuptor, bâta la Gard, sperietoarea la Câmp,
  e gândită exact ca primele două zone să fie jucabile pe jos. De verificat
  cu un copil înainte de deploy.
- **Notarea după purtare schimbă ce trece.** În Pădure, variante respinse
  înainte sunt acum corecte. Este intenționat.
- **Coordonatele zonelor viitoare** sunt propuneri. Se validează pe teren
  înainte de a fixa, altfel un teren în pantă face faleze în jurul zonei.
- **Paleta pe categorii** schimbă aspectul tablei la lecțiile cu logică,
  variabile sau proceduri. Acceptat, dar de privit pe tabletă.

---

## 11. Fișierele critice

| Fișier | Rol |
|---|---|
| `src/vatra/VatraPuzzles.ts` | modelul de program, constructorii, toate lecțiile ca date |
| `src/vatra/Interpreter.ts` | evaluatorul unic, folosit și la animație și la notare |
| `src/ui/BlocklyPanel.ts` | blocurile, paleta, încărcarea unui program, rularea pe scenarii |
| `src/vatra/VatraModule.ts` | zonele, regiunile de click, animațiile, ghizii, notarea |
| `src/Game.ts` | mâncare, echipament pasiv, unelte, zbor gatat, cârlige de test |
| `src/world/Structures.ts` | construcțiile fiecărei zone |
| `src/items/Items.ts` | numele și iconițele tuturor categoriilor, într-un singur loc |
| `src/ui/HelpData.ts` | catalogul din Ajutor, derivat din datele jocului |
