import { BlockType, BLOCKS, requiresPickaxe } from '../world/Block';
import { WEAPONS, WEAPON_IDS, isWeapon } from '../items/Weapon';
import { TOOLS, isTool, ToolId } from '../items/Tool';
import { THROWABLES, THROWABLE_IDS, isThrowable, ThrowableId } from '../items/Throwable';
import { RECIPES } from '../items/Recipes';
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
  [BlockType.Log]: { found: 'Trunchiul fiecărui copac.', use: 'Cub de construit — stâlpi, garduri, grinzi. Intră în rețeta târnăcopului.' },
  [BlockType.Leaves]: { found: 'Coroana copacilor.', use: 'Cub de construit — bun pentru garduri vii și acoperișuri verzi.' },
  [BlockType.Plank]: { use: 'Scândură cioplită — podele, pereți, acoperișuri.' },
  [BlockType.Cobblestone]: { use: 'Piatră de râu spartă — ziduri, hornuri, fundații.' },
  [BlockType.Brick]: { use: 'Cărămidă arsă, roșie — cuptoare și case de gospodar.' },
  [BlockType.Snow]: { found: 'Pe crestele înalte ale Carpaților.', use: 'Cub de construit. Se topește dacă îl pui la soare, jos în vale.' },
  [BlockType.Glass]: { use: 'Se vede prin el — ferestre, felinare, sere. Nu întunecă lumina din spate.' },
  [BlockType.StoneBrick]: { use: 'Piatră fățuită — ziduri de cetate, cum e castelul lui Vlad.' },
  [BlockType.Crystal]: { found: 'Ascuns adânc în munți și-n țurțurii de pe creste.', use: 'Cel mai frumos cub din joc — strălucește. Comoară de colecție.' },
  [BlockType.Mamaliga]: { use: 'Cub galben ca mămăliga pe fund de ceaun. Decor.' },
  [BlockType.Lamp]: { use: 'Luminează în jur noaptea — singurul cub care dă lumină. Pune-l pe ulițe și prin case.' },
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
  [BlockType.RiverStone]: { found: 'Pe fundul râurilor și pe potecile satului.', use: 'Bolovan rotunjit de apă — alei, maluri, temelii.' },
  [BlockType.DacianGold]: { use: 'Comoara dacică — aurul cel mai de preț. Se scoate doar cu târnăcopul.' },
  [BlockType.CraftingTable]: { use: 'Pune-o jos și dă click dreapta pe ea ca să deschizi rețetele de cioplit.' },
  [BlockType.Wool]: { use: 'Lână de oaie — pereți moi, covoare, culoare caldă.' },
  [BlockType.Wheat]: { use: 'Snop de grâu. Din el iese făina la moară.' },
  [BlockType.Flour]: { use: 'Făină măcinată. Din ea se face pâinea la cuptor.' },
  [BlockType.Mushroom]: { use: 'Ciupercă de pădure. Decor — și semn că Muma Pădurii ți-a dat voie pe potecă.' },
  [BlockType.Paine]: { use: 'MÂNCARE. Click dreapta cu ea în mână îți dă înapoi o inimă. Nu se pune ca un cub.' },
  [BlockType.Water]: { found: 'Râuri, iazuri și marea din jurul hărții.', use: 'Se înoată prin ea (Spațiu ca să urci). Nu se ia în traistă.' },
};

const TOOL_NOTES: Record<number, string> = {
  [ToolId.Tarnacop]: 'Ține-l în mână ca să poți sparge piatra, cristalul, obsidianul, bolovanii de râu și comoara dacică — fără el, nu cedează.',
};

const THROWABLE_NOTES: Record<number, string> = {
  [ThrowableId.SocataBottle]: 'Se aruncă cu click stânga. Explodează la impact și doboară monștrii pe o rază bunicică.',
  [ThrowableId.HubaBuba]: 'Gumă lipicioasă, se aruncă cu click stânga. Rază de explozie mai mică decât socata.',
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

function itemName(id: number): string {
  if (isTool(id)) return TOOLS[id].name;
  if (isWeapon(id)) return WEAPONS[id].name;
  if (isThrowable(id)) return THROWABLES[id].name;
  return BLOCKS[id]?.name ?? String(id);
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

function sourcesFor(id: number, note: HelpNote | undefined): string[] {
  const sources: string[] = [];
  if (note?.found) sources.push(`Se găsește în lume: ${note.found}`);
  if (BLOCKS[id] && !BLOCKS[id].craftedOnly && id !== BlockType.Water) {
    sources.push('Primești 64 la începutul fiecărei sesiuni.');
  }
  sources.push(...recipeSources(id));
  sources.push(...lessonSources(id));
  if (requiresPickaxe(id)) sources.push('⛏ Ai nevoie de târnăcop în mână ca să-l spargi.');
  if (sources.length === 0) sources.push('Se ia spărgând unul deja pus în lume.');
  return sources;
}

// The whole catalogue, grouped the way a child would look for it
export function buildHelpSections(): HelpSection[] {
  const blockIds = Object.keys(NOTES).map(Number).filter((id) => BLOCKS[id]);
  const natural = blockIds.filter((id) => NOTES[id].found);
  const rest = blockIds.filter((id) => !NOTES[id].found);
  const earned = rest.filter((id) => BLOCKS[id].craftedOnly);
  const plain = rest.filter((id) => !BLOCKS[id].craftedOnly);

  const toItems = (ids: number[]): HelpItem[] =>
    ids.map((id) => ({ id, name: itemName(id), sources: sourcesFor(id, NOTES[id]), use: NOTES[id].use }));

  return [
    {
      title: '⛰ Materiale din lume',
      intro: 'Astea chiar cresc pe hartă — le sapi cu click stânga și-ți intră în traistă.',
      items: toItems(natural),
    },
    {
      title: '🧱 Materiale de construit',
      intro: 'Le ai din start, câte 64 din fiecare. Le pui cu click dreapta.',
      items: toItems(plain),
    },
    {
      title: '🎁 Materiale de câștigat',
      intro: 'Astea încep de la 0 — le scoți doar din lecțiile Bunicului sau de la Masa de Cioplit.',
      items: toItems(earned),
    },
    {
      title: '⚔ Arme',
      intro: 'Se lovește cu click stânga. Le găsești în inventar (E).',
      items: WEAPON_IDS.map((id) => ({
        id,
        name: WEAPONS[id].name,
        sources: lessonSources(id).length ? lessonSources(id) : ['Le ai din start, nelimitat, în inventar (E).'],
        use: `${WEAPONS[id].damage} damage, rază ${WEAPONS[id].range} cuburi${WEAPONS[id].slowSeconds ? `, și îngheață dușmanul ${WEAPONS[id].slowSeconds} secunde` : ''}.`,
      })),
    },
    {
      title: '💣 De aruncat',
      items: THROWABLE_IDS.map((id) => ({
        id,
        name: THROWABLES[id].name,
        sources: THROWABLES[id].craftedOnly
          ? lessonSources(id)
          : ['Primești 20 la începutul fiecărei sesiuni.'],
        use: THROWABLE_NOTES[id],
      })),
    },
    {
      title: '⛏ Unelte',
      items: [ToolId.Tarnacop].map((id) => ({
        id: id as number,
        name: TOOLS[id].name,
        sources: [...recipeSources(id), ...lessonSources(id)],
        use: TOOL_NOTES[id],
      })),
    },
  ];
}
