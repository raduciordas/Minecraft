import { BlockType } from '../world/Block';
import { ToolId } from './Tool';

export interface Recipe {
  output: number;
  outputCount: number;
  ingredients: { id: number; count: number }[];
}

// Craftable only at a Masă de Cioplit (Crafting Table), using materials
// already gathered from the map.
export const RECIPES: Recipe[] = [
  {
    output: BlockType.Boltar,
    outputCount: 4,
    ingredients: [
      { id: BlockType.Stone, count: 4 },
      { id: BlockType.Sand, count: 2 },
    ],
  },
  {
    output: BlockType.Caramida,
    outputCount: 4,
    ingredients: [
      { id: BlockType.Chirpici, count: 2 },
      { id: BlockType.Dirt, count: 2 },
    ],
  },
  {
    output: BlockType.Tigla,
    outputCount: 4,
    ingredients: [
      { id: BlockType.Chirpici, count: 2 },
      { id: BlockType.Brick, count: 1 },
    ],
  },
  {
    output: ToolId.Tarnacop,
    outputCount: 1,
    ingredients: [
      { id: BlockType.Stone, count: 3 },
      { id: BlockType.Log, count: 2 },
    ],
  },
];
