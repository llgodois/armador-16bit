// =====================================================================
//  FRANQUIA — você é o armador E o dono do time por várias temporadas:
//  elenco de 10 (5 titulares + 5 reservas), idade, salário com teto,
//  trocas, evolução/declínio por idade, aposentadoria e draft.
//  Salvo no navegador.
// =====================================================================
import { TEAMS, teamById, benchOf, bestRating } from './teams.js';

export const CAP = 250; // teto salarial (milhões)
export const GAMES = 12;
const KEY = 'armador_franquia';

export const modernTeams = () => TEAMS.filter((t) => !t.era && !t.college && !t.allstar);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
let uid = Date.now() % 100000;

export const salaryOf = (p) => Math.max(1, Math.round((bestRating(p) - 55) * 0.8 + (p.age >= 25 ? 2 : 0)));
export const valueOf = (p) => bestRating(p) - Math.max(0, p.age - 29) * 2 + Math.max(0, 25 - p.age);
export const payroll = (f) => f.roster.reduce((s, p) => s + p.salary, 0);

function mk(p, age) {
  const q = { name: p.name, nick: p.nick, cm: p.cm, r: { ...p.r }, age, fr: `f${uid++}`, skin: rnd(0, 5), hair: rnd(0, 5) };
  q.salary = salaryOf(q);
  return q;
}

export function newFranchise(teamId) {
  const team = teamById(teamId);
  const roster = [...team.players, ...benchOf(team)].map((p, i) => mk(p, rnd(i < 5 ? 24 : 21, i < 5 ? 32 : 29)));
  const f = { teamId, year: 1, roster, phase: 'season', league: {}, titles: 0, history: [] };
  newSeason(f);
  saveFranchise(f);
  return f;
}

function newSeason(f) {
  const opps = modernTeams().filter((t) => t.id !== f.teamId).map((t) => t.id);
  f.season = { game: 0, wins: 0, losses: 0, schedule: Array.from({ length: GAMES }, (_, i) => opps[(i + f.year * 3) % opps.length]) };
}

export const loadFranchise = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};
export const saveFranchise = (f) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
};
export const clearFranchise = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

// Elenco de um adversário (o padrão ou o modificado por trocas).
export const leagueRoster = (f, teamId) => f.league[teamId] || teamById(teamId).players.map((p) => ({ ...p, age: 28, salary: 0 }));

const strength = (players) => players.slice(0, 5).reduce((s, p) => s + bestRating(p), 0) / 5;

function finishGame(f, win) {
  const s = f.season;
  s.game++;
  if (win) s.wins++;
  else s.losses++;
  if (s.game >= s.schedule.length) {
    // fim da temporada regular: 6+ vitórias classificam para os PLAYOFFS (jogáveis)
    if (s.wins >= PLAYOFF_WINS) startPlayoffs(f);
    else endSeason(f, false, 'fora dos playoffs');
  }
  saveFranchise(f);
}

// ---------------------------------------------------------------- playoffs
// 3 rodadas em jogo único: semifinal e final de conferência (rivais da sua conferência)
// e as Finais contra o melhor time da outra conferência.
export const PLAYOFF_WINS = 6;
export const PLAYOFF_ROUNDS = ['SEMIFINAL DE CONFERENCIA', 'FINAL DE CONFERENCIA', 'FINAIS'];
function startPlayoffs(f) {
  const me = teamById(f.teamId);
  const rank = (ts) => ts.map((t) => ({ id: t.id, st: strength(leagueRoster(f, t.id)) + Math.random() * 4 })).sort((a, b) => b.st - a.st);
  const mine = rank(modernTeams().filter((t) => t.conf === me.conf && t.id !== f.teamId));
  const other = rank(modernTeams().filter((t) => t.conf !== me.conf));
  f.phase = 'playoffs';
  f.playoffs = { round: 0, opps: [mine[1 + Math.floor(Math.random() * 3)].id, mine[0].id, other[0].id] };
}

function endSeason(f, champ, note) {
  const s = f.season;
  if (champ) f.titles++;
  f.history.push(`Ano ${f.year}: ${s.wins}-${s.losses} ${champ ? 'CAMPEAO' : note}`);
  f.lastSeason = { wins: s.wins, losses: s.losses, champ, note };
  f.playoffs = null;
  f.phase = 'offseason';
  offseason(f);
}

function finishPlayoff(f, win) {
  const po = f.playoffs;
  if (!win) endSeason(f, false, `caiu na ${PLAYOFF_ROUNDS[po.round].toLowerCase()}`);
  else if (++po.round >= PLAYOFF_ROUNDS.length) endSeason(f, true);
  saveFranchise(f);
}

// adversário do próximo jogo (temporada ou playoffs)
export const nextOpponent = (f) => (f.phase === 'playoffs' ? f.playoffs.opps[f.playoffs.round] : f.season.schedule[f.season.game]);

export const recordFranchiseGame = (win) => {
  const f = loadFranchise();
  if (f && f.phase === 'season') finishGame(f, win);
  else if (f && f.phase === 'playoffs') finishPlayoff(f, win);
  return f;
};

export function simulateGame(f) {
  const opp = nextOpponent(f);
  const p = 1 / (1 + Math.exp(-(strength(f.roster) - strength(leagueRoster(f, opp))) / 5));
  const win = Math.random() < p;
  if (f.phase === 'playoffs') finishPlayoff(f, win);
  else finishGame(f, win);
  return win;
}

// Proposta de troca: aceita se o que você manda vale pelo menos o que pede e cabe no teto.
export function evaluateTrade(f, outIdx, otherId, inIdx) {
  const out = f.roster[outIdx];
  const theirs = leagueRoster(f, otherId);
  const inc = theirs[inIdx];
  const incAge = inc.age && inc.age !== 28 ? inc.age : 22 + (inc.name.length % 11);
  const incP = { ...inc, age: incAge };
  incP.salary = salaryOf(incP);
  const newPay = payroll(f) - out.salary + incP.salary;
  // acima do teto só passam trocas que não aumentam a folha
  if (newPay > CAP && newPay > payroll(f)) return { ok: false, why: `Estoura o teto (${newPay}M de ${CAP}M)` };
  if (valueOf(out) < valueOf(incP) - 1) return { ok: false, why: `Eles querem mais (valor ${valueOf(out)} x ${valueOf(incP)})` };
  return { ok: true, why: 'Troca aceita!', incP, theirs };
}

export function doTrade(f, outIdx, otherId, inIdx) {
  const ev = evaluateTrade(f, outIdx, otherId, inIdx);
  if (!ev.ok) return ev;
  const out = f.roster[outIdx];
  const theirs = ev.theirs.slice();
  theirs[inIdx] = { ...out };
  f.league[otherId] = theirs;
  f.roster[outIdx] = { ...ev.incP, fr: `f${uid++}`, skin: rnd(0, 5), hair: rnd(0, 5) };
  saveFranchise(f);
  return ev;
}

// Entressafra: idade, evolução/declínio, aposentadoria e prospectos do draft.
function offseason(f) {
  f.news = [];
  f.roster = f.roster.map((p) => {
    const q = { ...p, r: { ...p.r }, age: p.age + 1 };
    const delta = q.age <= 25 ? () => rnd(0, 3) : q.age <= 30 ? () => rnd(-1, 1) : q.age <= 34 ? () => -rnd(0, 2) : () => -rnd(1, 4);
    for (const k of Object.keys(q.r)) q.r[k] = Math.max(40, Math.min(99, q.r[k] + delta()));
    if (q.age >= 36) {
      f.news.push(`${q.name} se aposentou`);
      const fa = mk({ name: `${['Leo', 'Davi', 'Caio', 'Igor', 'Raul'][rnd(0, 4)]} ${['Prado', 'Lopes', 'Matos', 'Reis'][rnd(0, 3)]}`, nick: 'Novato', cm: p.cm, r: Object.fromEntries(Object.keys(p.r).map((k) => [k, rnd(58, 70)])) }, rnd(22, 25));
      return fa;
    }
    q.salary = salaryOf(q);
    return q;
  });
  f.prospects = [0, 1, 2].map(() => {
    const cm = rnd(183, 211);
    return mk({ name: `${['Joao', 'Pedro', 'Lucas', 'Gabriel', 'Bruno', 'Thiago'][rnd(0, 5)]} ${['Andrade', 'Neves', 'Castro', 'Barros', 'Freitas'][rnd(0, 4)]}`, nick: 'Prospecto', cm, r: Object.fromEntries(['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'].map((k) => [k, rnd(56, 76)])) }, rnd(19, 21));
  });
}

// Escolhe um prospecto: ele entra no lugar do reserva de menor valor.
export function draftPick(f, i) {
  const p = f.prospects[i];
  let worst = 5;
  for (let k = 5; k < 10; k++) if (valueOf(f.roster[k]) < valueOf(f.roster[worst])) worst = k;
  f.news = [...(f.news || []), `Draft: ${p.name} entra no lugar de ${f.roster[worst].name}`];
  f.roster[worst] = p;
  f.prospects = null;
  saveFranchise(f);
}

export function startNextSeason(f) {
  f.year++;
  f.phase = 'season';
  newSeason(f);
  saveFranchise(f);
}

// Setup da partida para a GameScene (titulares = 5 primeiros, reservas = 5 últimos).
export function franchiseSetup(f, base) {
  const opp = nextOpponent(f);
  const toInfo = (p) => ({ ...p, r: { ...p.r } });
  return {
    ...base,
    home: f.teamId,
    away: opp,
    legend: null,
    customPG: null,
    career: null,
    champ: false,
    franchise: true,
    // títulos e boa campanha: seu armador começa os jogos com as insígnias mais quentes
    franchiseBadge: Math.min(6, (f.titles || 0) * 1.5 + (f.season && f.season.wins >= 8 ? 1.5 : 0)),
    roster: f.roster.slice(0, 5).map(toInfo),
    bench: f.roster.slice(5, 10).map((p) => ({ ...toInfo(p), bench: true })),
    awayRoster: f.league[opp] ? f.league[opp].map(toInfo) : null,
    mode: 'pontos',
  };
}
