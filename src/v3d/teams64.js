// Elencos do Armador 64: troca titulares, reservas e a descrição de cada franquia atual
// (2026-27) e acrescenta os times históricos a mais (versões clássicas do 2K27).
// Roda no carregamento do 3d.html, antes de qualquer cena — o 16-bit (index.html) nunca
// carrega este arquivo.
import { TEAMS, HISTORIC } from '../data/teams.js';
import { ROSTER64 } from './roster64.js';
import { HISTORIC64 } from './historic64.js';

const copy = (p) => ({ ...p, r: { ...p.r }, x: p.x ? { ...p.x } : undefined });

export function installRoster64() {
  for (const t of TEAMS) {
    const r = !t.era && ROSTER64[t.id];
    if (!r) continue;
    t.players = r.players.map(copy);
    t.bench = r.bench.map(copy);
    if (r.style) t.style = r.style;
  }
  // históricos a mais (os que já existiam continuam primeiro: o Competitivo usa o Bulls 96)
  for (const h of HISTORIC64) {
    const m = TEAMS.find((t) => t.id === h.base && !t.era);
    const id = `${h.base}${String(h.era).slice(2)}`;
    if (!m || TEAMS.some((t) => t.id === id)) continue;
    const team = {
      id,
      base: h.base,
      era: h.era,
      season: h.season,
      style: h.style,
      conf: m.conf,
      name: `${h.name || m.name} ${String(h.era).slice(2)}`,
      city: h.city || m.city,
      colors: h.colors || m.colors,
      players: h.players.map(copy),
    };
    if (h.bench) team.bench = h.bench.map(copy);
    HISTORIC.push(team);
    TEAMS.push(team);
  }
}

// todas as versões históricas de uma franquia, da mais nova para a mais antiga
export const historicsOf = (frId) => HISTORIC.filter((h) => h.base === frId).sort((a, b) => b.era - a.era);
