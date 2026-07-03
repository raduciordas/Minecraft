import { Game } from './Game';

const container = document.getElementById('app')!;
const game = new Game(container);
game.start();
