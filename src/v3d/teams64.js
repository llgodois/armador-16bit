// Elencos 2026-27 no Armador 64: troca titulares, reservas e a descrição de cada franquia
// atual (os times históricos continuam iguais). Roda no carregamento do 3d.html, antes de
// qualquer cena — o 16-bit (index.html) nunca carrega este arquivo.
import { TEAMS } from '../data/teams.js';
import { ROSTER64 } from './roster64.js';

const copy = (p) => ({ ...p, r: { ...p.r }, x: p.x ? { ...p.x } : undefined });

export function installRoster64() {
  for (const t of TEAMS) {
    const r = !t.era && ROSTER64[t.id];
    if (!r) continue;
    t.players = r.players.map(copy);
    t.bench = r.bench.map(copy);
    if (r.style) t.style = r.style;
  }
}
