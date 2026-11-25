// =====================================================================
//  CONTRA-JOGADAS — qual jogada é a resposta certa para cada defesa.
//  Chamar uma jogada da lista "boa" contra a defesa que o adversário está
//  usando dá BÔNUS DE LEITURA (arremessos do seu time mais certeiros por um
//  tempo, nota de companheiro e QI sobem). Uma da lista "ruim" facilita a defesa.
//  As jogadas são identificadas pelo nome (plays/library.js); as defesas pelo id
//  (data/defense.js).
// =====================================================================
export const COUNTERS = {
  // pivô recua no bloqueio: arremesso de meia / quem abre para chutar
  man: {
    good: ['Pick and pop', 'Spain pick and roll', 'Horns', 'Stagger'],
    bad: ['Isolacao'],
    why: 'o pivo recua: arremesse de meia ou use quem abre',
  },
  // troca tudo: ataque o desencontro de tamanho, cortes pelas costas
  switch: {
    good: ['Isolacao', 'Corte pelas costas', 'Pick and roll', 'Zipper'],
    bad: ['Cortes cruzados', 'Iverson'],
    why: 'eles trocam: ataque o desencontro e corte por tras',
  },
  // pivô sai no armador: passe rápido para quem rola
  hedge: {
    good: ['Pick and roll', 'Drag duplo', 'Corte pelas costas', 'Flex'],
    bad: ['Isolacao', 'Hammer'],
    why: 'o pivo sai em voce: solte rapido para quem rola',
  },
  // dobra no armador: tire a bola da mão, 4 contra 3
  blitz: {
    good: ['Pick and roll', 'Pick and pop', 'Espacar 5 abertos', 'Horns'],
    bad: ['Isolacao', 'Zipper'],
    why: 'dobram em voce: solte a bola e ataque 4 contra 3',
  },
  // zona: bola no meio (poste alto), cantos e linha de fundo
  zone: {
    good: ['Horns', 'Hammer', 'Espacar 5 abertos', 'Flex', 'Elevador'],
    bad: ['Isolacao', 'Corte pelas costas', 'Drag duplo'],
    why: 'zona: bola no meio, cantos e linha de fundo',
  },
  // pressão: passe antes da dobra, ataque o espaço lá atrás
  press: {
    good: ['Drag duplo', 'Espacar 5 abertos', 'Corte pelas costas'],
    bad: ['Iverson', 'Stagger', 'Floppy'],
    why: 'pressao: passe antes da dobra e ataque o espaco',
  },
};

// 'good' | 'bad' | 'neutral'
export function readOf(playName, schemeId) {
  const c = COUNTERS[schemeId];
  if (!c) return 'neutral';
  if (c.good.includes(playName)) return 'good';
  if (c.bad.includes(playName)) return 'bad';
  return 'neutral';
}

// Nota (0..100) -> conceito, como no grau de companheiro do 2K.
export function letterGrade(v) {
  const T = [[95, 'A+'], [90, 'A'], [85, 'A-'], [80, 'B+'], [75, 'B'], [70, 'B-'], [65, 'C+'], [60, 'C'], [55, 'C-'], [48, 'D']];
  for (const [min, l] of T) if (v >= min) return l;
  return 'F';
}
