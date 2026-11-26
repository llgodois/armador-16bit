import { HEIGHT, SHOT, STAMINA } from '../config.js';
import { ratingMult } from '../data/teams.js';
import { badgesOf } from '../data/badges.js';

// Perfis de tempo de arremesso (escolhidos na seleção): risco x recompensa.
export const SHOT_PROFILES = {
  seguro: { name: 'Seguro', desc: 'Faixa verde maior, bonus menor', window: 1.5, max: 1.08 },
  normal: { name: 'Normal', desc: 'Equilibrado', window: 1, max: SHOT.timingMax },
  arriscado: { name: 'Arriscado', desc: 'Faixa verde pequena, bonus grande no perfeito', window: 0.6, max: 1.32 },
};

// Ratings + altura + insígnias (+ build/perfil no seu armador) -> multiplicadores do jogo.
export function makeSkills(info, build, profile = null) {
  const m = ratingMult;
  const r = info.r;
  const b = build ? build.mods : {};
  const tall = info.cm - 195;
  const badges = badgesOf(info);
  const has = (id) => badges.includes(id);
  // Gás (resistência para o sprint): rápidos e leves aguentam mais, gigantes cansam rápido;
  // cada jogador tem também um traço individual (fixo, derivado do nome).
  const trait = ([...(info.name || 'x')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 21) / 100 - 0.1; // -0.10..+0.10
  const endurance = Math.max(0.65, Math.min(1.35, 1 + (r.spd - 75) * 0.008 - (info.cm - 196) * 0.008 + trait));
  const s = {
    endurance,
    gasDrain: (STAMINA.sprintDrain / endurance) * (b.staminaDrain ?? 1),
    gasRegen: STAMINA.regen * endurance,
    badges,
    speed: m(r.spd) * (b.speed ?? 1) * (has('relampago') ? 1.05 : 1),
    three: m(r.three) * (b.shooting ?? 1) * (has('atirador') ? 1.08 : 1),
    mid: m(r.mid) * (b.shooting ?? 1) * (has('meia') ? 1.08 : 1),
    finishing: m(r.fin) * (1 + tall * 0.003) * (b.finishing ?? 1) * (has('finalizador') ? 1.08 : 1),
    passing: m(r.pass) * (b.passing ?? 1),
    defense: m(r.def),
    rebounding: m(r.reb) * Math.max(0.6, 1 + tall * HEIGHT.reboundPerCm) * (has('reboteiro') ? 1.15 : 1),
    passSpeed: (b.passSpeed ?? 1) * Math.sqrt(m(r.pass)) * (has('maestro') ? 1.12 : 1),
    interceptMult: ((b.interceptMult ?? 1) / m(r.pass)) * (has('maestro') ? 0.7 : 1),
    stealMult: has('ladrao') ? 1.4 : 1,
    blockMult: has('protetor') ? 1.4 : 1,
    crossAnkle: (b.crossAnkle ?? 1) * (has('tornozelos') ? 1.35 : 1),
    staminaDrain: b.staminaDrain ?? 1,
    assistBonus: b.assistBonus ?? 0,
    // Arremesso característico: baixinhos soltam rápido, grandões devagar;
    // bons atiradores têm faixa verde maior.
    meterTime: SHOT.meterTime * (0.88 + Math.max(0, Math.min(1, (info.cm - 183) / 35)) * 0.3),
    perfectWindow: (b.perfectWindow ?? 1) * (0.8 + (0.5 * (r.three - 40)) / 59) * (profile ? profile.window : 1),
    timingMax: profile ? profile.max : SHOT.timingMax,
  };
  // (só no 64) atributos do NBA 2K27 (info.x só existe nos elencos do 3d.html)
  if (info.x) apply2K(s, info.x);
  return s;
}

// 2K (25-99) -> multiplicadores. Jogador médio (~70) fica perto de 1.
const k2 = (v, lo, hi) => lo + (Math.max(25, Math.min(99, v ?? 70)) - 25) / 74 * (hi - lo);
function apply2K(s, x) {
  s.handle = x.hdl ?? 70; // drible (0-99): tamanho/rapidez dos movimentos e quebrar o marcador
  s.crossAnkle *= k2(x.hdl, 0.55, 1.35);
  s.handleSafe = k2(x.hdl, 1.25, 0.7); // menos roubos sofridos com drible bom
  s.stealMult *= k2(x.stl, 0.6, 1.45);
  s.blockMult *= k2(x.blk, 0.5, 1.6);
  s.endurance = Math.max(0.65, Math.min(1.4, s.endurance * k2(x.sta, 0.85, 1.15)));
  s.gasDrain = s.gasDrain / k2(x.sta, 0.85, 1.15);
  s.rebounding *= k2(x.vrt, 0.9, 1.12);
  s.strength = k2(x.str, 0.7, 1.3); // jogo de costas e contato
  s.ft = (x.ft ?? 75) / 100; // lance livre
  s.dunk = x.dnk ?? 50; // enterrada: precisa de 60+ para enterrar quando pede
}
