// =====================================================================
//  LENDAS BLOQUEADAS (fora do Arcade). Cada uma libera de dois jeitos:
//   - DESAFIO numa partida do modo Sobrevivência (r = resultado da partida:
//     score = cestas + assistências do seu armador, fgm, tpm, ast, pts, poss)
//   - MOEDAS: cada partida da Sobrevivência rende 10 moedas por ponto de ranking.
//  No ARCADE tudo é liberado.
// =====================================================================
export const FREE_LEGENDS = ['magico', 'chef', 'professor', 'canadense', 'resposta', 'capitao'];

const U = (id, price, desc, check) => ({ id, price, desc, check });
export const UNLOCKS = [
  U('badboy', 250, 'Faca 8 cestas numa partida', (r) => r.fgm >= 8),
  U('grande_o', 300, 'Faca 6 assistencias numa partida', (r) => r.ast >= 6),
  U('furacao', 300, 'Faca 25 pontos numa partida', (r) => r.pts >= 25),
  U('luva', 250, 'Sobreviva a 12 posses', (r) => r.poss >= 12),
  U('carteiro', 400, 'Faca 10 assistencias numa partida', (r) => r.ast >= 10),
  U('tio_drew', 400, 'Faca 12 cestas numa partida', (r) => r.fgm >= 12),
  U('dame', 400, 'Acerte 6 bolas de 3 numa partida', (r) => r.tpm >= 6),
  U('penny', 300, 'Marque 15 no ranking', (r) => r.score >= 15),
  U('timbug', 250, 'Acerte 4 bolas de 3 numa partida', (r) => r.tpm >= 4),
  U('houdini', 200, 'Faca 4 assistencias numa partida', (r) => r.ast >= 4),
  U('clyde', 300, 'Faca 20 pontos numa partida', (r) => r.pts >= 20),
  U('drose', 350, 'Faca 10 cestas numa partida', (r) => r.fgm >= 10),
  U('frances', 250, 'Faca 6 cestas numa partida', (r) => r.fgm >= 6),
  U('logo', 500, 'Marque 25 no ranking', (r) => r.score >= 25),
  U('tiny', 300, 'Faca 5 cestas e 5 assistencias', (r) => r.fgm >= 5 && r.ast >= 5),
  U('kj', 300, 'Sobreviva a 15 posses', (r) => r.poss >= 15),
  U('mira', 250, 'Acerte 5 bolas de 3 numa partida', (r) => r.tpm >= 5),
  U('bigshot', 350, 'Marque 18 no ranking', (r) => r.score >= 18),
  U('dwill', 250, 'Marque 12 no ranking', (r) => r.score >= 12),
  U('genio', 350, 'Faca 8 assistencias numa partida', (r) => r.ast >= 8),
  U('agente', 350, 'Faca 30 pontos numa partida', (r) => r.pts >= 30),
  U('stevie', 250, 'Sobreviva a 10 posses', (r) => r.poss >= 10),
  U('sga', 600, 'Marque 30 no ranking', (r) => r.score >= 30),
  U('luka', 600, 'Faca 8 cestas e 8 assistencias', (r) => r.fgm >= 8 && r.ast >= 8),
];

export const unlockOf = (id) => UNLOCKS.find((u) => u.id === id) || null;

// Lenda liberada para este perfil? (perfil null = convidado: só as gratuitas)
export const isUnlocked = (profile, id) => FREE_LEGENDS.includes(id) || !!(profile && (profile.unlocked || []).includes(id));

// Confere os desafios no fim de uma partida; devolve os ids recém-liberados.
export function checkChallenges(profile, result) {
  if (!profile) return [];
  const got = [];
  for (const u of UNLOCKS) {
    if (isUnlocked(profile, u.id)) continue;
    if (u.check(result)) got.push(u.id);
  }
  profile.unlocked = [...(profile.unlocked || []), ...got];
  return got;
}

// ---------------------------------------------------------------------
//  TIMES HISTÓRICOS (fora do Arcade): para liberar a versão histórica de uma
//  franquia, faça pelo menos 20 pontos no Competitivo com o time ATUAL dela.
//  Se a franquia tiver mais de uma versão histórica, cada uma pede +10.
// ---------------------------------------------------------------------
import { HISTORIC } from './teams.js';
export const HISTORIC_POINTS = 20;
export function historicRequirement(team) {
  if (!team || !team.era) return 0;
  const eras = HISTORIC.filter((h) => h.base === team.base).sort((a, b) => b.era - a.era);
  return HISTORIC_POINTS + 10 * Math.max(0, eras.indexOf(team));
}
export const teamBest = (profile, frId) => ((profile && profile.team_best) || {})[frId] || 0;
export const isTeamUnlocked = (profile, team) => !team || !team.era || teamBest(profile, team.base) >= historicRequirement(team);

// Fim de uma partida do Competitivo com um time ATUAL: guarda o recorde e diz quais históricos liberou.
export function recordTeamScore(profile, frId, score) {
  if (!profile || !frId) return [];
  const before = { ...(profile.team_best || {}) };
  profile.team_best = { ...before, [frId]: Math.max(before[frId] || 0, score) };
  return HISTORIC.filter((h) => h.base === frId && !isTeamUnlocked({ team_best: before }, h) && isTeamUnlocked(profile, h));
}
