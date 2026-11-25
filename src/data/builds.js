// =====================================================================
//  BUILDS do armador (só o jogador que você controla).
//  speed/shooting/finishing/passing multiplicam os atributos.
//  Extras:
//   passSpeed      velocidade do seu passe
//   interceptMult  chance de interceptarem seu passe (menor = melhor)
//   assistBonus    bônus na chance do companheiro que arremessa logo após seu passe
//   perfectWindow  multiplica a janela "PERFEITO" do medidor
//   crossAnkle     multiplica a chance de desequilibrar no crossover
//   staminaDrain   multiplica o gasto de estamina no sprint
// =====================================================================
export const BUILDS = [
  {
    id: 'passador',
    name: 'Passador',
    desc: 'Passe rapido e seguro. Quem recebe de voce arremessa melhor.',
    mods: {
      speed: 1.0, shooting: 0.95, finishing: 0.95, passing: 1.3,
      passSpeed: 1.3, interceptMult: 0.45, assistBonus: 0.1,
      perfectWindow: 1.0, crossAnkle: 1.0, staminaDrain: 1.0,
    },
  },
  {
    id: 'chutador',
    name: 'Chutador',
    desc: 'Arremesso de longe e janela perfeita maior no medidor.',
    mods: {
      speed: 1.0, shooting: 1.18, finishing: 0.92, passing: 1.0,
      passSpeed: 1.0, interceptMult: 1.0, assistBonus: 0,
      perfectWindow: 1.7, crossAnkle: 1.0, staminaDrain: 1.0,
    },
  },
  {
    id: 'infiltrador',
    name: 'Infiltrador',
    desc: 'Mais rapido, crossover letal, bandejas e enterradas.',
    mods: {
      speed: 1.08, shooting: 0.92, finishing: 1.25, passing: 1.0,
      passSpeed: 1.0, interceptMult: 1.0, assistBonus: 0,
      perfectWindow: 1.0, crossAnkle: 1.5, staminaDrain: 0.8,
    },
  },
];

export const buildById = (id) => BUILDS.find((b) => b.id === id) || BUILDS[0];

// O estilo é o do PRÓPRIO armador escolhido: o ponto forte dele define a build.
export function buildForPlayer(info) {
  const r = (info && info.r) || {};
  const options = [
    ['passador', (r.pass || 0) - 4],
    ['chutador', Math.max(r.three || 0, (r.mid || 0) - 4)],
    ['infiltrador', Math.max(r.fin || 0, (r.spd || 0) - 2)],
  ];
  options.sort((a, b) => b[1] - a[1]);
  return options[0][0];
}
