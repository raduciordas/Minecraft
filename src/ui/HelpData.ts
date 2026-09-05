import { BlockType, BLOCKS, requiresPickaxe } from '../world/Block';
import { WEAPONS, WEAPON_IDS, isWeapon } from '../items/Weapon';
import { TOOLS, TOOL_IDS, isTool, ToolId } from '../items/Tool';
import { THROWABLES, THROWABLE_IDS, isThrowable, ThrowableId } from '../items/Throwable';
import { CONSUMABLES, CONSUMABLE_IDS, ConsumableId, isConsumable } from '../items/Consumable';
import { GEAR, GEAR_IDS, GearId, isGear } from '../items/Gear';
import { RECIPES } from '../items/Recipes';
import { itemName } from '../items/Items';
import { VATRA_PUZZLES } from '../vatra/VatraPuzzles';

// The Ajutor page's material catalogue. Only the two things the code can't
// know are written by hand — where a material turns up in the world, and
// what it's actually good for. Everything else (free starter stock, crafting
// recipes, which lesson pays it out, whether it needs a pickaxe) is read back
// out of the game's own data, so the page can't quietly go stale when a
// recipe or a lesson reward changes.
interface HelpNote {
  found?: string; // where it occurs naturally, if it does
  use: string;
}

const NOTES: Record<number, HelpNote> = {
  [BlockType.Grass]: { found: 'Peste tot pe dealuri și în luncă — stratul de la suprafață.', use: 'Cub de construit. Pus la loc, arată ca pământul cu iarbă.' },
  [BlockType.Dirt]: { found: 'Sub iarbă, un strat sau două.', use: 'Cub de construit. Se combină cu chirpici la Masa de Cioplit.' },
  [BlockType.Stone]: { found: 'Tot ce e sub pământ, și-n miezul munților.', use: 'Cubul de bază pentru zidit. Materie primă pentru boltari și târnăcop.' },
  [BlockType.Sand]: { found: 'Pe malurile apelor și-n petice de plajă.', use: 'Cub de construit; intră în rețeta boltarului.' },
  [BlockType.Log]: { found: 'Trunchiul fiecărui copac.', use: 'Cub de construit — stâlpi, garduri, grinzi. Intră în rețeta târnăcopului. Tăiat cu Toporul în mână, un buștean dă trei.' },
  [BlockType.Leaves]: { found: 'Coroana copacilor.', use: 'Cub de construit — bun pentru garduri vii și acoperișuri verzi.' },
  [BlockType.Plank]: { use: 'Scândură cioplită — podele, pereți, acoperișuri.' },
  [BlockType.Cobblestone]: { use: 'Piatră de râu spartă — ziduri, hornuri, fundații.' },
  [BlockType.Brick]: { use: 'Cărămidă arsă, roșie — cuptoare și case de gospodar.' },
  [BlockType.Snow]: { found: 'Pe crestele înalte ale Carpaților.', use: 'Cub de construit. Se topește dacă îl pui la soare, jos în vale.' },
  [BlockType.Glass]: { use: 'Se vede prin el — ferestre, felinare, sere. Nu întunecă lumina din spate.' },
  [BlockType.StoneBrick]: { use: 'Piatră fățuită — ziduri de cetate, cum e castelul lui Vlad.' },
  [BlockType.Crystal]: { found: 'Ascuns adânc în munți și-n țurțurii de pe creste.', use: 'Cel mai frumos cub din joc — strălucește. Comoară de colecție.' },
  [BlockType.Mamaliga]: { use: 'Cub galben ca mămăliga pe fund de ceaun. Decor.' },
  [BlockType.Lamp]: { use: 'Luminează în jur noaptea, ca un felinar de uliță. Pune-l pe ulițe și prin case.' },
  [BlockType.Door]: { use: 'Ușă de două cuburi. Click dreapta pe ea o deschide și o închide.' },
  [BlockType.Chirpici]: { use: 'Chirpici de lut și paie — casa țărănească de altădată. Intră în rețetele de cărămidă și țiglă.' },
  [BlockType.Obsidian]: { use: 'Cel mai negru cub. Ziduri care se văd de departe.' },
  [BlockType.Hay]: { use: 'Balot de fân — podul șurii, ieslea din grajd, acoperiș de paie.' },
  [BlockType.Tigla]: { use: 'Țiglă de acoperiș — pusă în pantă, arată ca o casă adevărată.' },
  [BlockType.Boltar]: { use: 'Boltar de beton — ziduri drepte, moderne, ridicate repede.' },
  [BlockType.Caramida]: { use: 'Cărămidă de casă nouă — mai deschisă la culoare decât cea arsă.' },
  [BlockType.HorezuCeramic]: { use: 'Ceramică de Horezu, cu model pictat. Cub de podoabă.' },
  [BlockType.RockSalt]: { use: 'Sare de ocnă, albă. Decor de salină.' },
  [BlockType.IeBlouse]: { use: 'Ie cusută cu altiță. Agățată pe perete, ține loc de tablou.' },
  [BlockType.RiverStone]: { use: 'Bolovan rotunjit de apă — alei, maluri, temelii. (Cei de pe ulița satului sunt ai satului: pe pătratele lecțiilor nu se sapă.)' },
  [BlockType.DacianGold]: { use: 'Comoara dacică — aurul cel mai de preț. Se scoate doar cu târnăcopul.' },
  [BlockType.CraftingTable]: { use: 'Pune-o jos și dă click dreapta pe ea ca să deschizi rețetele de cioplit.' },
  [BlockType.Wool]: { use: 'Lână de oaie — pereți moi, covoare, culoare caldă.' },
  [BlockType.Wheat]: { use: 'Snop de grâu. Din el iese făina la moară.' },
  [BlockType.Flour]: { use: 'Făină măcinată. Din ea se face pâinea la cuptor.' },
  [BlockType.Mushroom]: { use: 'Ciupercă de pădure. Decor — și semn că Muma Pădurii ți-a dat voie pe potecă.' },
  [BlockType.Water]: { found: 'Râuri, iazuri și marea din jurul hărții.', use: 'Se înoată prin ea (Spațiu ca să urci). Se ia doar cu Găleata.' },
  [BlockType.Torch]: { use: 'LUMINĂ ieftină: pusă jos luminează în jur, iar ținută în mână îți luminează drumul noaptea. Fără ea, noaptea pe jos e beznă.' },
  [BlockType.Rope]: { use: 'TE CAȚERI pe ea: pune frânghii una peste alta pe un perete, intră în ele și apasă Spațiu (sau W) ca să urci, Shift ca să cobori. Fără zbor, e singurul drum în sus.' },
  [BlockType.Scarecrow]: { use: 'PAZĂ: monștrii aflați la 8 cuburi de o sperietoare nu te mai urmăresc. Pune una lângă casă și dormi liniștit.' },
  [BlockType.StrawMattress]: { use: 'ATERIZARE MOALE: dacă aterizezi pe ea nu te lovești, oricât ai căzut — și te aruncă puțin înapoi în sus.' },
  [BlockType.WolfTrap]: { use: 'CAPCANĂ: monstrul care calcă pe ea se rănește tare și rămâne încetinit. Se consumă la declanșare. Oile și porcii nu o declanșează.' },
};

const TOOL_NOTES: Record<number, string> = {
  [ToolId.Tarnacop]: 'Ține-l în mână ca să poți sparge piatra, cristalul, obsidianul, bolovanii de râu și comoara dacică — fără el, nu cedează.',
  [ToolId.Topor]: 'Ține-l în mână când spargi un buștean și primești TREI în loc de unul. Lemnul pentru construit vine de trei ori mai repede.',
  [ToolId.Lopata]: 'Ține-o în mână când spargi pământ, iarbă sau nisip și sapă trei cuburi în jos dintr-o lovitură. Fântâni și pivnițe într-o clipă.',
  [ToolId.Undita]: 'Ține-o în mână, uită-te la apă și dă click dreapta: după două secunde tragi un Pește (mâncare). Singura mâncare care nu vine din lecții.',
  [ToolId.Galeata]: 'Ține-o în mână, uită-te la un cub de apă și dă click dreapta: se umple. Singurul fel de a lua apă din lume.',
  [ToolId.GaleataPlina]: 'Click dreapta pe un loc liber varsă apa acolo. Fă-ți iaz, adăpătoare sau râu în curte.',
};

const THROWABLE_NOTES: Record<number, string> = {
  [ThrowableId.SocataBottle]: 'Se aruncă cu click stânga. Explodează la impact și doboară monștrii pe o rază bunicică.',
  [ThrowableId.HubaBuba]: 'Gumă lipicioasă, se aruncă cu click stânga. Rază de explozie mai mică decât socata.',
};

const CONSUMABLE_NOTES: Record<number, string> = {
  [BlockType.Paine]: 'MÂNCARE. Click dreapta cu ea în mână îți dă înapoi o inimă. Nu se pune ca un cub.',
  [ConsumableId.Cozonac]: 'MÂNCARE de sărbătoare: trei inimi înapoi, și 15 secunde te vindeci de două ori mai repede.',
  [ConsumableId.Placinta]: 'MÂNCARE: două inimi și jumătate înapoi, dintr-o singură plăcintă.',
  [ConsumableId.Mar]: 'MÂNCARE: o inimă înapoi. Vin mulți deodată, numai buni de luat la drum.',
  [ConsumableId.Peste]: 'MÂNCARE: două inimi înapoi. Se pescuiește cu Undița din orice apă.',
};

const GEAR_NOTES: Record<number, string> = {
  [GearId.AmuletaUsturoi]: 'TALISMAN: cât o ai în traistă, monștrii te observă doar de la jumătate din distanța obișnuită. Nu trebuie pusă nicăieri — lucrează din traistă.',
  [GearId.AripileZmeului]: 'ZBOR: fără ele, tasta F (și butonul ✈) nu fac nimic. Cu ele în traistă, zbori cât vrei. Le dă Muma Pădurii la ultima ei lecție, Răscrucea.',
};

export interface HelpItem {
  id: number;
  name: string;
  sources: string[]; // every way of getting your hands on it
  use: string;
}

export interface HelpSection {
  title: string;
  intro?: string;
  items: HelpItem[];
}

const pieces = (n: number) => (n === 1 ? '1 bucată' : `${n} bucăți`);

// Which lessons pay this item out, read straight from the puzzle data
function lessonSources(id: number): string[] {
  const out: string[] = [];
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    const item = puzzle.rewardItems.find((r) => r.id === id);
    if (!item) continue;
    const when = puzzle.rewardRepeats ? 'la fiecare rezolvare' : 'o singură dată';
    out.push(`Răsplată la lecția „${puzzle.title.split('—')[0].trim()}" — ${pieces(item.count)}, ${when}.`);
  }
  return out;
}

// Which crafting-table recipes produce it, read straight from RECIPES
function recipeSources(id: number): string[] {
  return RECIPES.filter((r) => r.output === id).map((r) => {
    const parts = r.ingredients.map((i) => `${i.count} ${itemName(i.id)}`).join(' + ');
    return `La Masa de Cioplit: ${parts} → ${pieces(r.outputCount)}.`;
  });
}

// Whether an item is still part of the free stock handed out at session start
function isFreeAtStart(id: number): boolean {
  if (isWeapon(id)) return !WEAPONS[id].notStarterStock;
  if (isThrowable(id)) return !THROWABLES[id].notStarterStock;
  if (isTool(id) || isGear(id) || isConsumable(id)) return false; // always crafted or earned
  if (id === BlockType.Water) return false; // you can't carry water
  return !!BLOCKS[id] && !BLOCKS[id].notStarterStock;
}

function startAmount(id: number): string {
  if (isThrowable(id)) return 'Primești 20 la începutul fiecărei sesiuni.';
  if (isWeapon(id)) return 'O ai din start, nelimitat, în inventar (E).';
  return 'Primești 64 la începutul fiecărei sesiuni.';
}

// Ways of getting an item that the tables above can't express
const OTHER_SOURCES: Record<number, string[]> = {
  [ToolId.GaleataPlina]: ['Ia o Găleată goală, uită-te la apă și dă click dreapta.'],
  [ConsumableId.Peste]: ['Cu Undița în mână, click dreapta pe apă — după două secunde, un pește.'],
};

function sourcesFor(id: number, note?: HelpNote): string[] {
  const sources: string[] = [];
  const free = isFreeAtStart(id);
  if (!free) sources.push('🚫 NU se primește la începutul sesiunii — trebuie câștigat.');
  if (note?.found) sources.push(`Se găsește în lume: ${note.found}`);
  if (free) sources.push(startAmount(id));
  const ways = [...recipeSources(id), ...lessonSources(id), ...(OTHER_SOURCES[id] ?? [])];
  sources.push(...ways);
  // Nothing found it, nothing crafts it, no lesson pays it out, and it isn't
  // free — say so plainly rather than inventing a way to get it
  if (!free && !note?.found && ways.length === 0) {
    sources.push('⚠ Deocamdată nu are nicio sursă în joc — nu se poate obține.');
  }
  if (requiresPickaxe(id)) sources.push('⛏ Ai nevoie de târnăcop în mână ca să-l spargi.');
  return sources;
}

// The whole catalogue, grouped the way a child would look for it
export function buildHelpSections(): HelpSection[] {
  const blockIds = Object.keys(NOTES).map(Number).filter((id) => BLOCKS[id]);
  const natural = blockIds.filter((id) => NOTES[id].found);
  const rest = blockIds.filter((id) => !NOTES[id].found);
  const earned = rest.filter((id) => BLOCKS[id].notStarterStock);
  const plain = rest.filter((id) => !BLOCKS[id].notStarterStock);

  const toItems = (ids: number[]): HelpItem[] =>
    ids.map((id) => ({ id, name: itemName(id), sources: sourcesFor(id, NOTES[id]), use: NOTES[id].use }));

  return [
    {
      title: '⛰ Materiale din lume',
      intro: 'Astea chiar cresc pe hartă — le sapi cu click stânga și-ți intră în traistă. Unele nu se mai primesc gratuit la început, deci chiar trebuie săpate.',
      items: toItems(natural),
    },
    {
      title: '🧱 Materiale de construit',
      intro: 'Le ai din start, câte 64 din fiecare. Le pui cu click dreapta.',
      items: toItems(plain),
    },
    {
      title: '🎁 Materiale de câștigat',
      intro: 'Astea încep de la 0 — le câștigi din lecții, le ciopleșți la Masa de Cioplit sau le sapi din lume. Fiecare lecție îți dă și ceva NOU, care te ajută în joc.',
      items: toItems(earned),
    },
    {
      title: '🍯 De mâncat',
      intro: 'Click dreapta cu mâncarea în mână o mănâncă și-ți dă inimi înapoi. Nu se pune ca un cub.',
      items: CONSUMABLE_IDS.map((id) => ({
        id,
        name: CONSUMABLES[id].name,
        sources: sourcesFor(id),
        use: CONSUMABLE_NOTES[id],
      })),
    },
    {
      title: '🧥 Straie și talismane',
      intro: 'Lucrează singure, doar stând în traistă — nu trebuie să le îmbraci sau să le pui undeva.',
      items: GEAR_IDS.map((id) => ({
        id,
        name: GEAR[id].name,
        sources: sourcesFor(id),
        use: GEAR_NOTES[id],
      })),
    },
    {
      title: '⚔ Arme',
      intro: 'Se lovește cu click stânga. Le găsești în inventar (E) — dar nu toate se mai dau gratuit.',
      items: WEAPON_IDS.map((id) => ({
        id,
        name: WEAPONS[id].name,
        sources: sourcesFor(id),
        use: WEAPONS[id].ranged
          ? `Trage o SĂGEATĂ cu click stânga: ${WEAPONS[id].damage} damage, oricât de departe vezi. Singurul fel de a lovi Zmeul care zboară.`
          : `${WEAPONS[id].damage} damage, rază ${WEAPONS[id].range} cuburi${WEAPONS[id].slowSeconds ? `, și îngheață dușmanul ${WEAPONS[id].slowSeconds} secunde` : ''}${WEAPONS[id].knockback >= 12 ? ', și îl împinge departe' : ''}. Fără una în traistă, lovești cu mâna goală.`,
      })),
    },
    {
      title: '💣 De aruncat',
      items: THROWABLE_IDS.map((id) => ({
        id,
        name: THROWABLES[id].name,
        sources: sourcesFor(id),
        use: THROWABLE_NOTES[id],
      })),
    },
    {
      title: '⛏ Unelte',
      intro: 'Le ții în mână (selectate în bara de jos) ca să lucreze.',
      items: TOOL_IDS.map((id) => ({
        id: id as number,
        name: TOOLS[id].name,
        sources: sourcesFor(id),
        use: TOOL_NOTES[id],
      })),
    },
  ];
}
