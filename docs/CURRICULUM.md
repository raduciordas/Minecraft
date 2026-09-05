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
| Zborul pe tasta F | Devine răsplată câștigată, Aripile Zmeului, la ultima lecție din Pădure |

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
| 4 | Stâna | Variabile, numărare, comparații, senzori | Baba Dochia | 5 | de făcut |
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
| Fierăria | buclă în secvență | Topor |
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
| Răscrucea | SAU și NU | patru vremuri | Aripile Zmeului |

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

---

## 5. Zonele de construit

### Zona 4 — Stâna, variabile, Baba Dochia

Origine propusă în lume: x 30, z -30. De validat pe teren înainte de a fixa.

| Lecție | Concept nou | Program canonic | Obiectul nou |
|---|---|---|---|
| Cojoacele Dochiei | prima cutiuță, acțiune cu argument | `SET(cojoace,9), A(spune_cate, V(cojoace))` | Cojoc, scade daunele cu 1 |
| Numărătoarea oilor | contor în buclă | `SET(oi,0), R(7,[A(trece_o_oaie), CHG(oi,1)]), A(spune_cate,V(oi))` | Brânză de burduf |
| Țarcul | cât timp, cu comparație | `SET(afara,5), W(CMP(V(afara),'>',0),[A(baga_o_oaie), CHG(afara,-1)]), A(inchide_poarta)` | Fluier fermecat |
| Drumul oilor | senzor, variabila ca număr de pași | `SET(pasi,S(pasi_pana_la_pasune)), R(V(pasi),[A(pas_inainte)]), A(lasa_oile_sa_pasca)` | Opinci iuți |
| Socoteala stânii | două cutiuțe care se influențează | mulge de patru ori, apoi cât timp mai e lapte fă caș | Hartă, minimapă |

Structuri: țarc cu poartă, colibă, gard cu nouă cojoace care cad unul câte
unul, jgheab de muls, potecă cu opt borne spre pășune, un răboj care arată
valorile cutiuțelor pe măsură ce se schimbă.

### Zona 5 — Târgul, proceduri, Meșterul Olar

Origine propusă: x 5, z 45.

| Lecție | Concept nou | Obiectul nou |
|---|---|---|
| Ulciorul | definește și cheamă de trei ori | Busolă |
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
| 16 | Aripile Zmeului | 506 | deblochează zborul pe tasta F | Răscrucea |

Obiectele următoarelor zone, în ordinea lecțiilor: Cojoc, Brânză de burduf,
Fluier fermecat, Opinci iuți, Hartă, Busolă, Pat, Buzdugan, Piatră de
praștie, Ulcior cu jar, Miere, Foc de tabără, Clopot, Scară, Mască de
prisăcar, Scut, Cămașă de zale, Oglindă fermecată, Sabia lui Făt-Frumos,
Mărul de aur.

Patru dintre ele sunt deja legate în cod pentru zonele viitoare, dar nu le dă
încă nicio lecție: Cojocul, Cămașa de zale, Masca de prisăcar și creșterea
vieții maxime de la Mărul de aur.

---

## 7. Fazarea lucrului

| Fază | Conținut | Mărime | Stare |
|---|---|---|---|
| 0a | Interpretorul, modelul de program, notarea hibridă, tabla Blockly | mare | gata |
| 0b | Zone pe tabel, infrastructura obiectelor | mare | gata |
| 1 | Pădurea deschisă, două lecții noi, obiectele 1–16 | medie | gata |
| 2 | Stâna, variabile, obiectele 17–21 | mare | de făcut |
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

### Ce s-a construit la faza 1

Muma Pădurii a devenit ghid clicabil cu panoul ei, cele trei lecții vechi din
Pădure s-au mutat pe notarea după purtare, s-au adăugat Culesul de ciuperci
și Răscrucea, iar în lume au apărut poiana cu șase ciuperci, dintre care două
otrăvitoare, răscrucea cu trei poteci, stâlpul cu torță și copacul reper.

---

## 8. Verificarea automată

Scripturile de verificare stau în directorul de lucru al sesiunii, nu în
repo, fiindcă pornesc un browser real peste serverul de dezvoltare.

| Script | Ce verifică | Rezultat la faza 1 |
|---|---|---|
| `check_puzzles.js` | datele lecțiilor: soluția rezolvă toate scenariile, niciun mesaj de eșec nu se declanșează pe soluție, toate acțiunile și condițiile există, fiecare răsplată e un obiect cunoscut, fiecare lecție e într-o singură zonă | 16 lecții curate |
| `regress.js` | fiecare lecție rezolvată prin tablă, cu răsplata numărată în traistă, plus câte un program greșit pentru fiecare mesaj de eșec | 16 din 16, 33 mesaje din 33 |
| `alt_solutions.js` | programe cu altă formă dar aceeași purtare trebuie acceptate | 5 din 5 |
| `items.js` | câte o aserțiune pentru fiecare mecanică nouă de obiect | 17 din 17 |
| `roundtrip.js` | un program dus în tablă și adus înapoi rămâne identic | identic |

Comanda de pornire a serverului pentru ele: `npx vite --port 5210 --strictPort`.

---

## 9. Testul manual după faza 1

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

### 9.2 Lecțiile și tabla de blocuri

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

### 9.3 Obiectele

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

### 9.6 Ce nu se poate testa încă

Panoul Cutiuțe și fereastra pentru numele unei cutiuțe sunt scrise, dar nicio
lecție din faza asta nu folosește variabile, deci apar abia la Stână. La fel,
programul stricat care se repară singur, cojocul, cămașa de zale, masca de
prisăcar și creșterea vieții maxime sunt legate în cod pentru zonele
următoare, dar nu le dă încă nicio lecție. Blocarea unei lecții pentru un
singur jucător în multiplayer funcționează doar după redeploy-ul serverului
de pe Render.

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
