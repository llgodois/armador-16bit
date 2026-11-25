import PlayRunner from './PlayRunner.js';
import { PLAY_LIBRARY, playByIndex, playbookFor, PLAYS_PER_PAGE } from './library.js';

// Cria a jogada de índice i (0-based) do playbook para o time no ataque.
export function createPlay(i, game) {
  const def = playByIndex(i);
  return def ? new PlayRunner(game, def) : null;
}

export { PLAY_LIBRARY, playbookFor, PLAYS_PER_PAGE };
export { ROLES, SLOTS, PERIMETER, INSIDE, BASE_SLOTS } from './spots.js';
