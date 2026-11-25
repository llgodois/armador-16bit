// =====================================================================
//  CARREIRA DO SEU ARMADOR
//  Criar personagem -> 3 jogos no universitário -> draft -> temporadas de
//  10 jogos (plano de jogo semanal, pontos de evolução) -> prêmios.
//  Tudo salvo no navegador.
// =====================================================================
import { TEAMS, registerTeams } from './teams.js';
import { BUILDS } from './builds.js';

const KEYS = ['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'];
const P = (name, nick, cm, r) => ({ name, nick, cm, r: Object.fromEntries(KEYS.map((k, i) => [k, r[i]])) });

// Times universitários (só aparecem na carreira)
export const COLLEGE = [
  {
    id: 'univ_federal', college: true, conf: 'U', name: 'Federal', city: 'Universidade', style: 'Defesa e garra',
    colors: { jersey: '#1f6f3f', dark: '#144a2a', trim: '#f2c230', shorts: '#1a6036', shoes: '#f2f2f2' },
    players: [P('Ze Moura', 'Ze', 183, [64, 66, 66, 70, 74, 70, 50]), P('Beto Lins', 'Beto', 193, [70, 64, 62, 58, 68, 66, 52]),
      P('Gui Prado', 'Gui', 198, [60, 62, 68, 56, 66, 68, 62]), P('Rafa Leal', 'Rafa', 203, [52, 58, 70, 54, 60, 68, 70]), P('Tito Bahia', 'Tito', 208, [40, 50, 72, 50, 54, 70, 74])],
  },
  {
    id: 'univ_estadual', college: true, conf: 'U', name: 'Estadual', city: 'Universidade', style: 'Correria e arremesso',
    colors: { jersey: '#c0392b', dark: '#86271e', trim: '#ffffff', shorts: '#a93226', shoes: '#ffffff' },
    players: [P('Lipe Cruz', 'Lipe', 185, [70, 66, 64, 66, 76, 60, 48]), P('Nando Reis', 'Nando', 191, [72, 68, 62, 58, 72, 62, 50]),
      P('Duda Paiva', 'Duda', 198, [66, 64, 66, 58, 68, 64, 58]), P('Vini Sales', 'Vini', 203, [56, 60, 68, 52, 62, 64, 68]), P('Bruno Sa', 'Bruno', 211, [38, 50, 70, 48, 52, 68, 72])],
  },
  {
    id: 'univ_catolica', college: true, conf: 'U', name: 'Catolica', city: 'Universidade', style: 'Jogo de passes',
    colors: { jersey: '#283c8c', dark: '#1a285e', trim: '#e8c547', shorts: '#22337a', shoes: '#e8c547' },
    players: [P('Igor Matos', 'Igor', 188, [66, 64, 62, 72, 70, 62, 48]), P('Caue Rios', 'Caue', 196, [68, 66, 60, 62, 66, 64, 50]),
      P('Saulo Brito', 'Saulo', 201, [62, 62, 64, 60, 64, 66, 60]), P('Davi Tavares', 'Davi', 206, [50, 58, 68, 56, 58, 66, 70]), P('Lucas Pena', 'Lucas', 211, [36, 48, 70, 52, 50, 70, 74])],
  },
];

registerTeams(COLLEGE);

export const ATTRS = [
  ['three', '3 PONTOS'], ['mid', 'MEIA DISTANCIA'], ['fin', 'FINALIZACAO'], ['pass', 'PASSE'],
  ['spd', 'VELOCIDADE'], ['def', 'DEFESA'], ['reb', 'REBOTE'], ['vis', 'VISAO DE JOGO'],
  ['zone', 'ZONAS QUENTES'], ['badge', 'INSIGNIAS'],
];

const KEY = 'armador_carreira';
export const loadCareer = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};
export const saveCareer = (c) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
};
export const clearCareer = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

// Atributos iniciais a partir da altura e do estilo.
export function newCareer({ name, cm, skin, hair, build }) {
  const r = { three: 62, mid: 62, fin: 62, pass: 64, spd: 66, def: 58, reb: 50 };
  if (build === 'passador') r.pass += 10;
  if (build === 'chutador') {
    r.three += 10;
    r.mid += 6;
  }
  if (build === 'infiltrador') {
    r.fin += 8;
    r.spd += 6;
  }
  const t = cm - 188;
  r.reb += Math.round(t * 0.8);
  r.fin += Math.round(t * 0.3);
  r.spd -= Math.round(t * 0.4);
  const college = COLLEGE[Math.floor(Math.random() * COLLEGE.length)].id;
  const c = {
    player: { name, nick: 'Novato', cm, skin, hair, build, r, vis: 60 },
    stage: 'college',
    collegeTeam: college,
    college: { game: 0, wins: 0, iqSum: 0, pts: 0 },
    team: null,
    pick: null,
    year: 1,
    season: null,
    points: 0,
    plan: { plays: [0, 1, 7], defense: 'man' },
    awards: [],
    last: null,
  };
  saveCareer(c);
  return c;
}

// O jogador como "info" para a GameScene (vai no lugar do armador do time).
export function careerPG(c) {
  const p = c.player;
  return { zone: p.zone || 0, badge: p.badge || 0, id: `car${p.skin}${p.hair}${p.cm}`, name: p.name, nick: p.nick, cm: p.cm, r: { ...p.r }, skin: p.skin, hair: p.hair, vis: p.vis, desc: 'Seu jogador', legend: true };
}

export const proTeams = () => TEAMS.filter((t) => !t.era && !t.college);

function newSeason(c) {
  const opps = proTeams().filter((t) => t.id !== c.team).map((t) => t.id);
  const schedule = Array.from({ length: 10 }, (_, i) => opps[(i + c.year) % opps.length]);
  c.season = { game: 0, wins: 0, losses: 0, schedule, tot: { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, to: 0, iq: 0, grade: 0 } };
}

const GRADE_VAL = { 'A+': 98, A: 92, 'A-': 87, 'B+': 82, B: 77, 'B-': 72, 'C+': 67, C: 62, 'C-': 57, D: 50, F: 40 };

// Registra um jogo da carreira (chamado pelo GameOver). Retorna { points }.
export function recordCareerGame(d) {
  const c = loadCareer();
  if (!c) return { points: 0 };
  const win = d.score.home > d.score.away;
  // pontos de evolução: jogar bem (decisões) vale mais que só pontuar
  const points = 1 + (win ? 1 : 0) + ((d.iq || 0) >= 70 ? 1 : 0) + (String(d.grade || '').startsWith('A') ? 1 : 0);
  c.points += points;
  c.last = { win, score: d.score, grade: d.grade, iq: d.iq, pts: d.stats.pts, ast: d.stats.ast };
  if (c.stage === 'college') {
    c.college.game++;
    if (win) c.college.wins++;
    c.college.iqSum += d.iq || 50;
    c.college.pts += d.stats.pts;
    if (c.college.game >= 3) {
      // draft: quanto melhor o universitário, mais cedo você é escolhido
      const avgIQ = c.college.iqSum / 3;
      const pick = Math.max(1, Math.min(30, Math.round(30 - (avgIQ - 45) * 0.6 - c.college.wins * 4 - c.college.pts / 6)));
      const pros = proTeams();
      c.pick = pick;
      c.team = pros[Math.floor(Math.random() * pros.length)].id;
      c.stage = 'draft';
    }
  } else if (c.stage === 'season') {
    const s = c.season;
    s.game++;
    if (win) s.wins++;
    else s.losses++;
    for (const k of ['pts', 'ast', 'reb', 'stl', 'blk', 'to']) s.tot[k] += d.stats[k] || 0;
    s.tot.iq += d.iq || 50;
    s.tot.grade += GRADE_VAL[d.grade] || 70;
    if (s.game >= s.schedule.length) {
      c.stage = 'awards';
      c.lastAwards = seasonAwards(c);
      c.awards.push(...c.lastAwards.map((a) => `${a} (ano ${c.year})`));
    }
  }
  saveCareer(c);
  return { points };
}

export function startPro(c) {
  c.stage = 'season';
  newSeason(c);
  saveCareer(c);
}

export function nextYear(c) {
  c.year++;
  c.player.nick = c.awards.length ? 'Estrela' : 'Titular';
  c.stage = 'season';
  newSeason(c);
  saveCareer(c);
}

// Prêmios de fim de temporada
export function seasonAwards(c) {
  const s = c.season;
  const n = s.game || 1;
  const avg = (k) => s.tot[k] / n;
  const out = [];
  if (s.wins >= 7 && avg('grade') >= 82) out.push('MVP');
  if ((s.tot.stl + s.tot.blk) / n >= 2) out.push('Defensor do ano');
  if (avg('pts') >= 10 || avg('ast') >= 5) out.push('Quinteto ideal');
  if (avg('iq') >= 75) out.push('QI de armador (lider em decisoes)');
  if (c.year === 1 && out.length) out.push('Calouro do ano');
  return out;
}

export function spendPoint(c, attr) {
  if (c.points <= 0) return;
  if (attr === 'vis') c.player.vis = Math.min(99, c.player.vis + 3);
  // zonas quentes: cada ponto esquenta todas as suas zonas de arremesso (até 10)
  else if (attr === 'zone') c.player.zone = Math.min(10, (c.player.zone || 0) + 1);
  // insígnias: começa cada jogo com o medidor mais cheio (até 6 = começa no ouro)
  else if (attr === 'badge') c.player.badge = Math.min(6, (c.player.badge || 0) + 1);
  else c.player.r[attr] = Math.min(99, c.player.r[attr] + 2);
  c.points--;
  saveCareer(c);
}

export const buildName = (id) => (BUILDS.find((b) => b.id === id) || BUILDS[0]).name;
