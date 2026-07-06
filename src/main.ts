import { Game } from './Game';

const NAME_KEY = 'cuburia-player-name';

function randomName(): string {
  return `Explorator${Math.floor(1000 + Math.random() * 9000)}`;
}

const nameEntry = document.getElementById('name-entry')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const nameSubmit = document.getElementById('name-submit')!;

nameInput.value = localStorage.getItem(NAME_KEY) || '';

function startGame(): void {
  const name = (nameInput.value.trim() || randomName()).slice(0, 16);
  localStorage.setItem(NAME_KEY, name);
  nameEntry.classList.add('hidden');

  const container = document.getElementById('app')!;
  const game = new Game(container, name);
  game.start();
}

nameSubmit.addEventListener('click', startGame);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});
nameInput.focus();
