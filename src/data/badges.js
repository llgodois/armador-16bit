// =====================================================================
//  INSÍGNIAS — calculadas pelos ratings/altura de cada jogador.
//  Cada uma dá um bônus específico (aplicado em game/skills.js e GameScene).
// =====================================================================
export const BADGES = {
  atirador: { name: 'Atirador', desc: '+8% nas bolas de 3', test: (p) => p.r.three >= 90 },
  meia: { name: 'Meia mortal', desc: '+8% na meia distancia', test: (p) => p.r.mid >= 92 },
  finalizador: { name: 'Finalizador', desc: '+8% em bandejas e enterradas', test: (p) => p.r.fin >= 92 },
  maestro: { name: 'Passe na medida', desc: 'passe mais rapido, dificil de interceptar', test: (p) => p.r.pass >= 94 },
  ladrao: { name: 'Ladrao', desc: '+40% de chance de roubo', test: (p) => p.r.def >= 90 && p.cm < 205 },
  protetor: { name: 'Protetor do aro', desc: '+40% de tocos', test: (p) => p.cm >= 208 && p.r.def >= 80 },
  reboteiro: { name: 'Reboteiro', desc: 'pega rebotes de mais longe', test: (p) => p.r.reb >= 88 },
  relampago: { name: 'Relampago', desc: '+5% de velocidade', test: (p) => p.r.spd >= 95 },
  tornozelos: { name: 'Quebra tornozelos', desc: 'crossover desequilibra mais', test: (p) => p.r.spd >= 90 && p.r.mid >= 85 && p.cm <= 196 },
};

export function badgesOf(info) {
  return Object.keys(BADGES).filter((id) => BADGES[id].test(info));
}
