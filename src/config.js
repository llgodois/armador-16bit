// =====================================================================
//  CONFIG — constantes de layout e balanceamento.
//  Distâncias em pixels do mundo, tempos em segundos, chances 0..1.
//  Times/jogadores: src/data/teams.js   Builds: src/data/builds.js
//
//  QUADRA INTEIRA: o time da casa ataca a cesta de CIMA e o visitante a de
//  BAIXO. A IA pensa sempre em coordenadas "canônicas" (atacando para cima);
//  para o visitante, tudo é espelhado em torno do meio da quadra (MID_Y).
// =====================================================================

export const VIEW = { W: 480, H: 270 };
export const WORLD = { W: 480, H: 600 };

// Quadra inteira.
export const COURT = { left: 40, right: 440, top: 36, bottom: 564 };
export const MID_Y = 300;
// Espaço jogável FORA das linhas (laterais e fundo), para repor a bola de fora da quadra.
export const COURT_OUT = 16;

// Cesta canônica (a de cima). A de baixo é o espelho: y = 2*MID_Y - 74 = 526.
export const BASKET = { x: 240, y: 74, rimZ: 30 };
export const BASKET_BOTTOM = { x: 240, y: 2 * MID_Y - 74, rimZ: 30 };

export const Y_SCALE = 4 / 3;
export const THREE = { rx: 150, ry: 112 };
export const PAINT = { left: 202, right: 278, top: 36, bottom: 138 };
export const FT_CIRCLE = { rx: 34, ry: 26 };
export const RESTRICTED = { rx: 24, ry: 18 };

// Dentro do garrafão o K vira bandeja/enterrada.
export const LAYUP_ZONE = { paintMargin: 4, radius: 60 };

// --------------------------------------------------------------- Jogadores
export const PLAYER = {
  radius: 5,
  accel: 14,
  verticalFactor: 0.82,
  baseSpeed: 64,          // multiplicado pela velocidade (rating) do jogador
  sprintMult: 1.45,
  aiDefSpeedMult: 1.06,
  transitionMult: 1.22,   // correndo na transição (campo de defesa -> ataque)
  separationRadius: 20,
  separationForce: 0.9,
  userMass: 3,
};

// Ratings (40..99) viram multiplicadores: 40 -> min, 99 -> max.
export const RATING = { min: 0.8, max: 1.25 };

// Altura (cm) -> efeitos. Classe visual: (cm - 183) / 6, de 0 a 5 pixels a mais.
export const HEIGHT = {
  baseCm: 183,
  cmPerPixel: 6,
  maxPixels: 5,
  contestPerCm: 0.006,  // cada cm que o defensor é mais alto reduz a chance do arremesso
  blockPerCm: 0.04,     // cada cm a mais aumenta o toco em 4%
  reboundPerCm: 0.012,  // raio/velocidade de rebote
};

export const STAMINA = { max: 100, sprintDrain: 24, regen: 14, minToSprint: 8, crossCost: 12 };

export const CROSSOVER = {
  burstMult: 2.0,
  duration: 0.22,
  cooldown: 0.75,
  ankleRange: 22,
  ankleChance: 0.3,
  ankleChanceLunging: 0.7,
  ankleStun: 0.85,
};

export const PASS = {
  speed: 230,
  height: 12,
  catchRadius: 7,
  maxDist: 420,
  interceptMinLen: 55,
  interceptRadius: 13,
  interceptChance: 0.4,
};

export const SHOT = {
  meterTime: 0.85,
  sweetSpot: 0.8,
  perfectWindow: 0.042,   // janela VERDE (menor = mais difícil)
  tolerance: 0.4,
  greenRating: 80,        // VERDE garantido: rating de 3 (ou meia) do arremessador >= isso...
  greenOpenDist: 24,      // ... sem defensor mais perto que isso ...
  greenMaxDist: 178,      // ... e até um passo atrás da linha de 3
  greenBonus: 1.35,       // verde sem as condições: chance x1,35
  autoRelease: 1.2,
  releaseZ: 24,
  distanceCurve: [
    [0, 0.76],
    [35, 0.64],
    [90, 0.5],
    [149, 0.42],
    [160, 0.38],
    [200, 0.22],
    [260, 0.04],
  ],
  contestOpenDist: 30,
  contestMinFactor: 0.45,
  timingMin: 0.55,
  timingMax: 1.18,
  staminaMin: 0.82,
  minChance: 0.02,
  maxChance: 0.95,
  flightBase: 0.5,
  flightPerPx: 0.0024,
  arcBase: 24,
  arcPerPx: 0.13,
};

export const LAYUP = {
  driveTime: 0.28,
  driveSpeedMult: 1.35,
  openChance: 0.8,
  contestedChance: 0.3,
  contestOpenDist: 26,
  dunkMinFinishing: 1.15,
  dunkOpenDist: 30,
  dunkMaxDist: 40,      // distância máxima do aro para enterrar
  dunkTry: 0.55,        // mesmo podendo, às vezes prefere a bandeja
  dunkChance: 0.93,
  maxChance: 0.95,
};

export const BALL = {
  gravity: 280,
  bounceDamping: 0.55,
  groundFriction: 2.2,
  pickupRadius: 8,
  pickupMaxZ: 16,
  dribblePeriod: 0.42,
  dribbleHeight: 11,
};

// Rebote no ar: alcance do pulo (z) e ponto de "mira" dos reboteiros.
export const REBOUND = {
  jumpReach: 16,     // além do pickupMaxZ (16): todos pegam até ~28 de altura...
  reachPerCm: 0.3,    // ... e cada cm acima de 1,83 m alcança mais
  handZ: 24,          // a IA corre para onde a bola vai estar nessa altura
  airRadius: 4,       // raio extra para agarrar a bola no ar
  crashers: 2,        // além do pivô e do ala de força, mais quantos correm para o rebote
};

// --------------------------------------------------------------- Defesa (IA)
export const DEFENSE = {
  ballGap: 12,
  shooterBallGap: 9,      // cola mais em grandes arremessadores
  offGap: 20,
  helpSag: 0.2,
  sagByShooting: 0.45,    // jogador que não arremessa: defensor afunda até +45% (dá espaço)
  reaction: 0.16,
  helpDriveDist: 85,
  closeoutMult: 1.2,
  stealRange: 11,
  stealCooldown: 1.6,
  stealBase: 0.012,
  stealExposedBonus: 0.06,
  stealVsAiMult: 0.6,
  blockRange: 11,
  blockChance: 0.08,
  pnrSwitchChance: 0.45,  // troca de marcação no bloqueio — só a defesa ADVERSÁRIA troca (0 = nunca)
  reboundChasers: 3,
  transitionDelay: 0.15,  // ao perder a bola, a defesa demora um pouco para voltar
};

// Dobra de marcação: a defesa manda um segundo defensor em jogadores perigosos.
export const DOUBLE = {
  threeRating: 88,        // arremessador de elite: dobra quando pega a bola perto da linha de 3
  finishRating: 90,       // finalizador de elite: dobra quando pega no garrafão
  starRating: 92,         // craque geral (melhor nota) — dobra em qualquer lugar perto da cesta
  chance: 0.65,           // chance de dobrar quando a situação acontece
  maxTime: 3.2,
  cooldown: 2.5,
  maxDoublerDist: 120,
};

// --------------------------------------------------------------- Você na defesa (sempre o armador)
export const USER_DEFENSE = {
  stealRange: 21,       // alcance do roubo (o bote cobre a distância)
  stealChance: 0.3,
  stealCooldown: 0.7,
  whiffSlow: 0.45,
  blockRange: 14,
  blockChance: 0.3,
  contestBonus: 0.85,
  slideMult: 1.9,
  slideTime: 0.2,
  slideCooldown: 0.7,
  callDoubleTime: 2.5,   // J na defesa: pede dobra no homem da bola
};

// --------------------------------------------------------------- Ataque (IA)
export const OFFENSE = {
  decideMin: 0.35,
  decideMax: 0.9,
  openDist: 28,
  shootRange: 175,
  catchAndShoot: 0.25,
  motionMin: 1.6,
  motionMax: 3.4,
  cutSpeedMult: 1.18,
  driveTimeMax: 1.3,
  aiTimingMin: 0.62,
  aiTimingMax: 0.95,
  returnPassBias: 0.25,
  reboundChasers: 2,
  assistWindow: 4.0,
};

// --------------------------------------------------------------- Partida (contínua)
export const GAME = {
  targetScore: 21,
  shotClock: 24,
  offensiveReboundClock: 14,
  introTime: 1.4,
  inboundTime: 0.9,      // depois de uma cesta: reposição pela linha de fundo
  finalTime: 2.2,
  quickPlays: 9,         // teclas 1..9 chamam as 9 primeiras jogadas do playbook
};

// --------------------------------------------------------------- Faltas e lances livres
export const FOUL = {
  closeDist: 16,          // defensor a essa distância (ou menos) pode fazer falta no arremesso
  layupChance: 0.22,      // chance de falta numa bandeja contestada de perto
  jumpChance: 0.05,       // chance de falta num arremesso contestado de perto
  madeMult: 0.6,          // a falta atrapalha: a chance de cair cai para 60%
  userReachChance: 0.3,   // você errou o roubo: chance de ser falta
  aiReachChance: 0.04,    // a IA errou o roubo: chance de ser falta
  bonus: 5,               // a partir da 5ª falta coletiva, falta comum vira 2 lances livres
};
export const FT = {
  wait: 0.9,              // pausa antes de cada lance livre
  base: 0.5,              // chance base (somada à habilidade de meia distância)
  skill: 0.45,
};

// --------------------------------------------------------------- Transição defensiva (volta na marcação)
export const TRANSITION = {
  time: 4,                // segundos de "correria" após perder a bola
  rematchEvery: 0.35,     // a cada quanto tempo os defensores reescolhem quem pegar
  sprintMult: 1.28,       // velocidade de quem está atrás da jogada
};

// --------------------------------------------------------------- Dificuldade (afeta o time adversário)
export const DIFFICULTY = {
  facil: { name: 'Facil', def: 0.9, steal: 0.6, dbl: 0.6, shoot: 0.9 },
  normal: { name: 'Normal', def: 1, steal: 1, dbl: 1, shoot: 1 },
  dificil: { name: 'Dificil', def: 1.1, steal: 1.4, dbl: 1.25, shoot: 1.08 },
};
export const MODES = {
  pontos: { name: 'Ate 21', desc: 'Primeiro a 21 pontos vence' },
  tempo: { name: '6 minutos', desc: 'Quem tiver mais pontos; empate = morte subita', seconds: 360 },
};

// --------------------------------------------------------------- Leitura de jogo
export const READ = {
  goodBonus: 1.12,      // contra-jogada certa: arremessos do seu time x1.12 ...
  badMalus: 0.9,        // ... jogada errada contra a defesa: x0.9
  duration: 9,          // por quantos segundos
  disguiseChance: 0.35, // chance do adversário disfarçar a defesa (mostra uma, usa outra)
  disguiseTime: 4,      // revela no primeiro passe ou depois desse tempo
};

// Visão de quadra (segure Q): câmera lenta + linhas de passe
export const VISION = {
  timeScale: 0.35,
  drain: 45,            // barra por segundo usando
  regen: 9,             // barra por segundo parado
};

// Grau de companheiro (0..100, começa em B-) e QI do armador
export const GRADE = {
  start: 70,
  assist: 4, openShot: 2, forcedShot: -4, turnover: -5, goodRead: 3, badRead: -2,
  steal: 3, block: 3, manScored: -3, stop: 1, made: 1, goodPass: 1, riskyPass: -2,
};

export const DEBUG = { showShotChance: true, physics: false };
