// =====================================================================
//  LENDAS — 30 armadores inspirados nos maiores de todos os tempos.
//  Nomes parecidos com os reais (de propósito, não idênticos). Ratings: [3pts, meia, final, passe,
//  veloc, defesa, rebote]. O escolhido substitui o armador do seu time.
// =====================================================================
const KEYS = ['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'];
const L = (id, name, nick, cm, r, desc, skin, hair) => ({
  id, name, nick, cm, desc, skin, hair, legend: true,
  r: Object.fromEntries(KEYS.map((k, i) => [k, r[i]])),
});

export const LEGENDS = [
  L('magico', 'Magic Johnson', 'Showtime', 206, [68, 82, 90, 99, 86, 72, 86], 'Showtime: passe sem olhar e contra-ataque', 1, 1),
  L('chef', 'Stephen Curry', 'Chef', 188, [99, 95, 86, 88, 84, 62, 52], 'O maior arremessador: chuta de qualquer lugar', 3, 0),
  L('professor', 'Chris Paul', 'CP3', 183, [80, 98, 80, 97, 82, 90, 55], 'Meia distancia e controle total do jogo', 2, 2),
  L('badboy', 'Isiah Thomas', 'Zeke', 185, [75, 90, 90, 94, 92, 78, 50], 'Infiltracao e frieza no fim do jogo', 4, 1),
  L('grande_o', 'Oscar Robertson', 'Big O', 196, [70, 90, 90, 92, 82, 78, 88], 'Triplo-duplo de outra era', 1, 4),
  L('canadense', 'Steve Nash', 'Nash', 191, [92, 96, 80, 97, 80, 58, 45], 'Pick and roll perfeito: 50-40-90', 0, 3),
  L('capitao', 'Jason Kidd', 'J-Kidd', 193, [72, 74, 80, 96, 86, 92, 80], 'Defesa, rebote e visao de jogo', 3, 2),
  L('resposta', 'Allen Iverson', 'The Answer', 183, [74, 88, 92, 72, 99, 74, 45], 'Crossover letal e coragem no garrafao', 4, 0),
  L('furacao', 'Russell Westbrook', 'Brodie', 191, [60, 78, 94, 86, 98, 76, 84], 'Atleta furioso: triplo-duplo em toda partida', 2, 1),
  L('luva', 'Gary Payton', 'The Glove', 193, [70, 84, 84, 86, 84, 98, 60], 'A melhor defesa que um armador ja teve', 5, 4),
  L('carteiro', 'John Stockton', 'Stock', 185, [80, 88, 80, 99, 80, 88, 48], 'Pick and roll eterno e passe perfeito', 0, 3),
  L('tio_drew', 'Kyrie Irving', 'Uncle Drew', 188, [88, 94, 97, 86, 88, 66, 46], 'Drible magico e bandejas impossiveis', 3, 0),
  L('dame', 'Damian Lillard', 'Dame Time', 188, [96, 88, 86, 88, 84, 60, 46], 'Arremesso do logo no fim do jogo', 4, 1),
  L('penny', 'Penny Hardaway', 'Penny', 201, [80, 88, 92, 92, 90, 80, 64], 'Armador alto com visao e explosao', 3, 0),
  L('timbug', 'Tim Hardaway', 'Killer Crossover', 183, [86, 84, 82, 90, 88, 70, 42], 'O crossover mais temido dos anos 90', 4, 0),
  L('houdini', 'Bob Cousy', 'Houdini', 185, [60, 82, 78, 96, 82, 72, 52], 'O primeiro maestro: passe pelas costas', 0, 2),
  L('clyde', 'Walt Frazier', 'Clyde', 193, [60, 90, 84, 88, 80, 94, 62], 'Estilo, frieza e maos rapidas', 4, 1),
  L('drose', 'Derrick Rose', 'D-Rose', 191, [70, 82, 97, 82, 98, 70, 52], 'Explosao pura ate o aro', 4, 0),
  L('frances', 'Tony Parker', 'TP', 188, [70, 90, 94, 86, 94, 64, 40], 'Infiltracao e floater frances', 2, 2),
  L('logo', 'Jerry West', 'The Logo', 191, [86, 96, 86, 86, 82, 86, 58], 'Mr. Clutch: o logo da liga', 0, 3),
  L('tiny', 'Nate Archibald', 'Tiny', 185, [60, 86, 92, 92, 94, 66, 44], 'Lider em pontos e assistencias', 4, 4),
  L('kj', 'Kevin Johnson', 'KJ', 185, [66, 86, 94, 92, 96, 70, 48], 'Velocidade e enterradas sobre gigantes', 4, 1),
  L('mira', 'Mark Price', 'Price', 183, [92, 92, 74, 90, 80, 62, 40], 'Arremesso puro e pick and roll', 0, 3),
  L('bigshot', 'Chauncey Billups', 'Mr. Big Shot', 191, [88, 86, 80, 86, 78, 82, 52], 'Lider e arremessos decisivos', 4, 4),
  L('dwill', 'Deron Williams', 'D-Will', 191, [84, 86, 86, 92, 82, 72, 52], 'Crossover forte e pick and roll', 2, 1),
  L('genio', 'Rajon Rondo', 'Rondo', 185, [55, 72, 84, 96, 92, 90, 72], 'Genio do passe e dos roubos', 4, 4),
  L('agente', 'Gilbert Arenas', 'Agent Zero', 191, [90, 88, 88, 80, 88, 66, 50], 'Chuta de muito longe e sem medo', 4, 1),
  L('stevie', 'Steve Francis', 'Franchise', 191, [76, 84, 92, 84, 96, 68, 62], 'Atleta explosivo e crossover', 4, 0),
  L('sga', 'Shai Gilgeous-Alexander', 'SGA', 198, [84, 97, 94, 86, 90, 84, 58], 'Meia distancia e cavando faltas', 3, 2),
  L('luka', 'Luka Doncic', 'Luka Magic', 201, [88, 92, 90, 96, 72, 62, 82], 'Step-back e passes de outro planeta', 0, 3),
];

export const legendById = (id) => LEGENDS.find((l) => l.id === id) || null;
