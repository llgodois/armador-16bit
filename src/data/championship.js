// =====================================================================
//  CAMPEONATO — formato da NBA em miniatura:
//   8 times (4 do Leste, 4 do Oeste) -> semifinais de conferência (1x4, 2x3)
//   -> finais de conferência -> FINAIS (campeão do Leste x campeão do Oeste).
//  Séries de 1 ou 3 jogos. Os jogos que não são seus são simulados pelos
//  ratings. Tudo fica salvo no navegador (localStorage).
// =====================================================================
import { TEAMS, teamById, bestRating } from './teams.js';

const KEY = 'armador_campeonato';

export const ROUND_NAMES = ['Semifinal de conferencia', 'Final de conferencia', 'Finais'];

// Força geral de um time (média das melhores notas dos 5).
export const overall = (team) => Math.round(team.players.reduce((s, p) => s + bestRating(p), 0) / team.players.length);

// Defesa favorita de cada time (vai pro scout e o adversário usa mais).
export function favoriteScheme(team) {
  const def = team.players.reduce((s, p) => s + p.r.def, 0) / 5;
  const tallC = team.players[4].cm >= 213;
  if (def >= 84) return 'switch';
  if (tallC) return 'zone';
  if (team.players.some((p) => p.r.spd >= 95)) return 'press';
  if (def >= 80) return 'hedge';
  return 'man';
}

// Relatório de scout do adversário.
export function scoutOf(team) {
  const by = (k) => [...team.players].sort((a, b) => b.r[k] - a.r[k])[0];
  const star = [...team.players].sort((a, b) => bestRating(b) - bestRating(a))[0];
  return { star, defender: by('def'), shooter: by('three'), fav: favoriteScheme(team), overall: overall(team) };
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function createChampionship(setup, bestOf) {
  const user = teamById(setup.home);
  const pickConf = (conf) => {
    const pool = shuffle(TEAMS.filter((t) => t.conf === conf && !!t.era === !!user.era && (t.base || t.id) !== (user.base || user.id))).slice(0, user.conf === conf ? 3 : 4);
    if (user.conf === conf) pool.splice(Math.floor(Math.random() * 4), 0, user);
    return pool.map((t) => t.id); // ordem = seed 1..4
  };
  const conf = { E: pickConf('E'), W: pickConf('W') };
  const series = [];
  for (const c of ['E', 'W']) {
    const s = conf[c];
    series.push(newSeries(s[0], s[3], c), newSeries(s[1], s[2], c));
  }
  const champ = { setup, bestOf, round: 0, conf, rounds: [series], champion: null, eliminated: false };
  save(champ);
  return champ;
}

function newSeries(a, b, conf) {
  return { a, b, conf, winsA: 0, winsB: 0, winner: null };
}

export const userSeries = (champ) => champ.rounds[champ.round].find((s) => !s.winner && (s.a === champ.setup.home || s.b === champ.setup.home)) || null;

export function opponentOf(champ) {
  const s = userSeries(champ);
  if (!s) return null;
  return s.a === champ.setup.home ? s.b : s.a;
}

function need(champ) {
  return Math.ceil(champ.bestOf / 2);
}

function simGame(s) {
  const A = teamById(s.a);
  const B = teamById(s.b);
  const p = 1 / (1 + Math.exp(-(overall(A) - overall(B)) / 6));
  if (Math.random() < p) s.winsA++;
  else s.winsB++;
}

function settle(champ, s) {
  const n = need(champ);
  if (s.winsA >= n) s.winner = s.a;
  else if (s.winsB >= n) s.winner = s.b;
}

// Resultado de um jogo seu. Retorna o campeonato atualizado.
export function recordUserGame(champ, userWon) {
  const s = userSeries(champ);
  if (!s) return champ;
  const userIsA = s.a === champ.setup.home;
  if (userWon === userIsA) s.winsA++;
  else s.winsB++;
  settle(champ, s);
  if (s.winner && s.winner !== champ.setup.home) champ.eliminated = true;
  if (s.winner) finishRound(champ);
  save(champ);
  return champ;
}

// Simula as outras séries da rodada e monta a próxima.
function finishRound(champ) {
  for (;;) {
    const round = champ.rounds[champ.round];
    for (const s of round) {
      while (!s.winner) {
        simGame(s);
        settle(champ, s);
      }
    }
    if (champ.round === 2) {
      champ.champion = round[0].winner;
      return;
    }
    const next = [];
    if (champ.round === 0) {
      for (const c of ['E', 'W']) {
        const [x, y] = round.filter((s) => s.conf === c);
        next.push(newSeries(x.winner, y.winner, c));
      }
    } else {
      const e = round.find((s) => s.conf === 'E');
      const w = round.find((s) => s.conf === 'W');
      next.push(newSeries(e.winner, w.winner, 'F'));
    }
    champ.round++;
    champ.rounds.push(next);
    // se você foi eliminado, simula até o fim
    if (!champ.eliminated) return;
  }
}

export function save(champ) {
  try {
    localStorage.setItem(KEY, JSON.stringify(champ));
  } catch {
    /* sem armazenamento */
  }
}

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
