// =====================================================================
//  FIM DE SEMANA DAS ESTRELAS — times do Jogo das Estrelas (Leste x Oeste)
//  montados com o melhor jogador de cada posição da conferência, e os
//  convidados dos torneios de 3 pontos e de enterradas.
// =====================================================================
import { TEAMS, registerTeams, bestRating } from './teams.js';

const modern = () => TEAMS.filter((t) => !t.era && !t.college);

function bestByPos(conf) {
  return [0, 1, 2, 3, 4].map((i) => {
    const c = modern().filter((t) => t.conf === conf).map((t) => t.players[i]);
    return { ...c.sort((a, b) => bestRating(b) - bestRating(a))[0] };
  });
}

export const ALLSTARS = [
  {
    id: 'allstar_e', conf: 'E', name: 'Leste', city: 'Jogo das Estrelas', style: 'Os melhores do Leste', allstar: true,
    colors: { jersey: '#1d3f9a', dark: '#132a66', trim: '#ffffff', shorts: '#183685', shoes: '#ffffff' },
    players: bestByPos('E'),
  },
  {
    id: 'allstar_w', conf: 'W', name: 'Oeste', city: 'Jogo das Estrelas', style: 'Os melhores do Oeste', allstar: true,
    colors: { jersey: '#b51f2e', dark: '#7a141f', trim: '#ffd23f', shorts: '#9c1a27', shoes: '#ffd23f' },
    players: bestByPos('W'),
  },
];
registerTeams(ALLSTARS);

const allPlayers = () => modern().flatMap((t) => t.players);
// 4 convidados (se você for um deles, sai da lista na hora do torneio)
export const THREE_SHOOTERS = allPlayers().sort((a, b) => b.r.three - a.r.three).slice(0, 4);
export const DUNKERS = allPlayers().filter((p) => p.cm >= 196).sort((a, b) => b.r.fin - a.r.fin).slice(0, 4);
