// =====================================================================
//  PLAYBOOK — jogadas em dados, executadas por PlayRunner.
//  Escritas em coordenadas CANÔNICAS (atacando a cesta de cima, x=240 y=74)
//  com a bola do lado DIREITO. O runner espelha para o lado da bola e para
//  a cesta de baixo automaticamente.
//
//  Cada fase:
//    dur          duração máxima (s)
//    until        'used' = termina quando o condutor passa pelo 1º bloqueio
//    spots        { posição: destino }  destino = vaga (SLOTS), {x,y} canônico
//                 ou função (game, run) => ponto NO MUNDO
//    screen       posição (ou lista) que bloqueia nessa fase
//    switchOnUse  a defesa pode trocar a marcação ao usar o bloqueio
//    option       posições que são a "leitura" (destacadas para você)
//    fast         posições que se movem em velocidade de corte
//    pass         posicao que recebe o passe de entrada no inicio da fase
//    until 'pg'   a fase termina quando o ARMADOR chega no destino (jogadas sem bola)
//    offBall      jogada SEM a bola para o armador (voce corre pelos bloqueios)
//    teams        jogada de franquia: so aparece no playbook desses times (id ou base)
//  Teclas 1..9 chamam as 9 jogadas da PAGINA atual (F / R3 troca de pagina);
//  TAB abre o playbook completo (pausado).
// =====================================================================

// Bloqueio na bola: ao lado do marcador do condutor, do lado do meio.
const onBallScreen = (g, run) => {
  const h = run.handler();
  const d = h && g.defenderOf(h);
  if (!d) return run.world({ x: 240, y: 190 });
  return { x: d.x + run.mid * 10, y: d.y + 3 * g.dir };
};
// Bloqueio "por trás" no marcador do pivô (Spain PnR)
const backScreen = (g, run) => {
  const c = run.byRole('C');
  const cd = c && g.defenderOf(c);
  if (!cd) return run.world({ x: 240, y: 150 });
  return { x: cd.x + (g.basket.x - cd.x) * 0.2, y: cd.y + (g.basket.y - cd.y) * 0.2 };
};
const roll = (g, run) => run.world({ x: 240 + run.side * 10, y: 96 });
// Posição aproximada para o diagrama do playbook (as funções dependem da defesa).
onBallScreen.preview = { x: 250, y: 200 };
backScreen.preview = { x: 262, y: 168 };
roll.preview = { x: 250, y: 96 };

export const PLAY_LIBRARY = [
  {
    name: 'Pick and roll',
    tag: 'BLOQUEIO',
    desc: 'Pivo bloqueia seu marcador e rola para a cesta',
    phases: [
      { dur: 4.5, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, SG: 'cornerR', SF: 'wingL', PF: 'cornerL' } },
      { dur: 2.6, spots: { C: roll, SG: 'cornerR', SF: 'wingL', PF: 'cornerL' }, option: ['C', 'SG'], fast: ['C'] },
    ],
  },
  {
    name: 'Pick and pop',
    tag: 'BLOQUEIO',
    desc: 'Ala-pivo bloqueia e abre para o arremesso',
    phases: [
      { dur: 4.5, until: 'used', screen: 'PF', switchOnUse: true, spots: { PF: onBallScreen, C: 'dunkerL', SG: 'cornerR', SF: 'wingL' } },
      { dur: 2.6, spots: { PF: 'slotL', C: 'dunkerR', SG: 'cornerR', SF: 'wingL' }, option: ['PF', 'C'], fast: ['PF'] },
    ],
  },
  {
    name: 'Isolacao',
    tag: '1X1',
    desc: 'Todos abrem espaco para o seu 1x1',
    phases: [{ dur: 8, spots: { SG: 'cornerR', SF: 'cornerL', PF: 'wingL', C: 'dunkerL' } }],
  },
  {
    name: 'Corte pelas costas',
    tag: 'CORTE',
    desc: 'Ala sobe como se fosse receber e corta pelas costas',
    phases: [
      { dur: 1.1, spots: { SG: { x: 340, y: 186 }, SF: 'wingL', PF: 'cornerL', C: 'elbowL' } },
      { dur: 1.2, spots: { SG: 'rim', SF: 'wingL', PF: 'cornerL', C: 'elbowL' }, option: ['SG'], fast: ['SG'] },
      { dur: 1.4, spots: { SG: 'cornerR', C: 'blockL' }, option: ['SG'] },
    ],
  },
  {
    name: 'Saida do bloqueio',
    tag: 'ARREMESSO',
    desc: 'Ala sai do garrafao usando o bloqueio do pivo',
    phases: [
      { dur: 1.3, spots: { SF: 'blockR', C: { x: 304, y: 118 }, PF: 'cornerL', SG: 'wingL' } },
      { dur: 1.6, screen: 'C', spots: { SF: 'wingR', C: { x: 304, y: 118 }, PF: 'cornerL', SG: 'wingL' }, option: ['SF'], fast: ['SF'] },
      { dur: 1.5, spots: { C: 'dunkerR', SF: 'wingR' }, option: ['SF', 'C'] },
    ],
  },
  {
    name: 'Espacar 5 abertos',
    tag: 'INFILTRAR',
    desc: 'Garrafao vazio: infiltre e solte para quem ficar livre',
    phases: [{ dur: 9, spots: { SG: 'cornerR', SF: 'cornerL', PF: 'wingL', C: 'wingR' } }],
  },
  {
    name: 'Cortes cruzados',
    tag: 'CORTE',
    desc: 'Os alas cortam para a cesta e trocam de lado',
    phases: [
      { dur: 1.6, spots: { SG: { x: 256, y: 96 }, SF: { x: 224, y: 100 }, PF: 'slotL', C: 'elbowR' }, fast: ['SG', 'SF'], option: ['SG', 'SF'] },
      { dur: 2.0, spots: { SG: 'wingL', SF: 'wingR', PF: 'slotL', C: 'elbowR' }, option: ['SG', 'SF'], fast: ['SG', 'SF'] },
      { dur: 2.0, spots: { SG: 'wingL', SF: 'wingR', PF: 'cornerL', C: 'blockR' } },
    ],
  },
  {
    name: 'Horns',
    tag: 'BLOQUEIO',
    desc: 'Dois grandes nos cotovelos; pivo bloqueia, ala-pivo abre',
    phases: [
      { dur: 1.5, spots: { PF: 'elbowL', C: 'elbowR', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 4, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, PF: 'elbowL', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 2.6, spots: { C: roll, PF: 'slotL', SG: 'cornerR', SF: 'cornerL' }, option: ['C', 'PF'], fast: ['C', 'PF'] },
    ],
  },
  {
    name: 'Spain pick and roll',
    tag: 'BLOQUEIO',
    desc: 'Pick and roll + ala bloqueia o marcador do pivo por tras',
    phases: [
      { dur: 4.5, until: 'used', screen: ['C', 'SG'], spots: { C: onBallScreen, SG: backScreen, SF: 'cornerL', PF: 'wingL' } },
      { dur: 2.6, spots: { C: roll, SG: 'slotR', SF: 'cornerL', PF: 'wingL' }, option: ['C', 'SG'], fast: ['C', 'SG'] },
    ],
  },
  {
    name: 'Floppy',
    tag: 'ARREMESSO',
    desc: 'Dois atiradores sob a cesta escolhem um lado dos bloqueios',
    phases: [
      { dur: 1.3, spots: { SG: 'blockR', SF: 'blockL', PF: { x: 176, y: 118 }, C: { x: 304, y: 118 } } },
      { dur: 1.6, screen: ['PF', 'C'], spots: { SG: 'wingR', SF: 'wingL', PF: { x: 176, y: 118 }, C: { x: 304, y: 118 } }, option: ['SG', 'SF'], fast: ['SG', 'SF'] },
      { dur: 1.4, spots: { PF: 'dunkerL', C: 'dunkerR', SG: 'wingR', SF: 'wingL' }, option: ['SG', 'SF'] },
    ],
  },
  {
    name: 'Hammer',
    tag: 'ARREMESSO',
    desc: 'Infiltre pela linha de fundo: ala recebe bloqueio no canto oposto',
    phases: [
      { dur: 1.4, spots: { SF: { x: 96, y: 112 }, PF: { x: 122, y: 86 }, SG: 'wingR', C: 'dunkerR' } },
      { dur: 1.8, screen: 'PF', spots: { SF: 'cornerL', PF: { x: 122, y: 86 }, SG: 'wingR', C: 'dunkerR' }, option: ['SF'], fast: ['SF'] },
    ],
  },
  {
    name: 'Elevador',
    tag: 'ARREMESSO',
    desc: 'Atirador passa entre dois grandes que fecham a porta atras dele',
    phases: [
      { dur: 1.3, spots: { SG: 'blockR', PF: { x: 222, y: 168 }, C: { x: 258, y: 168 }, SF: 'cornerL' } },
      { dur: 1.1, spots: { SG: 'top', PF: { x: 222, y: 168 }, C: { x: 258, y: 168 } }, fast: ['SG'], option: ['SG'] },
      { dur: 1.2, screen: ['PF', 'C'], spots: { SG: 'top', PF: { x: 233, y: 172 }, C: { x: 247, y: 172 } }, option: ['SG'] },
    ],
  },
  {
    name: 'Zipper',
    tag: 'CORTE',
    desc: 'Ala desce ao bloco e sobe em velocidade para receber no topo',
    phases: [
      { dur: 1.0, spots: { SG: 'blockR', C: { x: 286, y: 120 }, SF: 'wingL', PF: 'cornerL' } },
      { dur: 1.3, screen: 'C', spots: { SG: 'slotR', C: { x: 286, y: 120 } }, fast: ['SG'], option: ['SG'] },
    ],
  },
  {
    name: 'Flex',
    tag: 'CORTE',
    desc: 'Corte pela linha de fundo e bloqueio descendo para o pivo',
    phases: [
      { dur: 1.3, spots: { SF: 'cornerL', C: 'blockL', PF: 'elbowR', SG: 'wingR' } },
      { dur: 1.4, screen: 'C', spots: { SF: 'blockR', C: 'blockL', PF: 'elbowR' }, fast: ['SF'], option: ['SF'] },
      { dur: 1.4, screen: 'PF', spots: { C: 'elbowL', PF: { x: 230, y: 110 }, SF: 'blockR' }, fast: ['C'], option: ['C', 'SF'] },
    ],
  },
  {
    name: 'Iverson',
    tag: 'CORTE',
    desc: 'Alas cruzam o topo por tras dos grandes nos cotovelos',
    phases: [
      { dur: 1.0, spots: { PF: 'elbowL', C: 'elbowR', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 1.8, screen: ['PF', 'C'], spots: { SG: 'wingL', SF: 'wingR', PF: 'elbowL', C: 'elbowR' }, fast: ['SG', 'SF'], option: ['SG', 'SF'] },
    ],
  },
  {
    name: 'Stagger',
    tag: 'ARREMESSO',
    desc: 'Atirador sai de dois bloqueios em sequencia para a ala',
    phases: [
      { dur: 1.2, spots: { SG: 'dunkerR', PF: { x: 318, y: 118 }, C: { x: 344, y: 146 }, SF: 'wingL' } },
      { dur: 1.8, screen: ['PF', 'C'], spots: { SG: 'wingR', PF: { x: 318, y: 118 }, C: { x: 344, y: 146 } }, fast: ['SG'], option: ['SG'] },
    ],
  },
  {
    name: 'Drag duplo',
    tag: 'BLOQUEIO',
    desc: 'Dois bloqueios seguidos na bola (transicao): um abre, o outro rola',
    phases: [
      { dur: 3, until: 'used', screen: 'PF', switchOnUse: true, spots: { PF: onBallScreen, SG: 'cornerR', SF: 'cornerL' } },
      { dur: 3, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, PF: 'slotL', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 2.4, spots: { C: roll, PF: 'slotL' }, option: ['C', 'PF'], fast: ['C'] },
    ],
  },
  // ----------------------------------------------------------------- mais jogadas COM a bola
  {
    name: 'Slip',
    tag: 'BLOQUEIO',
    desc: 'Pivo finge o bloqueio e escorrega direto para a cesta',
    phases: [
      { dur: 1.5, spots: { C: onBallScreen, SG: 'cornerR', SF: 'wingL', PF: 'cornerL' } },
      { dur: 2.4, spots: { C: 'rim', SG: 'cornerR', SF: 'wingL', PF: 'cornerL' }, option: ['C'], fast: ['C'] },
    ],
  },
  {
    name: 'Ghost screen',
    tag: 'ARREMESSO',
    desc: 'Ala-pivo ameaca o bloqueio e abre para o 3 sem encostar',
    phases: [
      { dur: 1.4, spots: { PF: onBallScreen, C: 'dunkerL', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 2.4, spots: { PF: 'slotL', C: 'dunkerL', SG: 'cornerR', SF: 'cornerL' }, option: ['PF'], fast: ['PF'] },
    ],
  },
  {
    name: 'Pick and roll espacado',
    tag: 'BLOQUEIO',
    desc: 'Quatro abertos: pivo bloqueia, cantos punem a ajuda',
    phases: [
      { dur: 4.5, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, SG: 'cornerR', SF: 'cornerL', PF: 'wingL' } },
      { dur: 2.6, spots: { C: roll, SG: 'cornerR', SF: 'cornerL', PF: 'wingL' }, option: ['C', 'SG', 'SF'], fast: ['C'] },
    ],
  },
  {
    name: 'Short roll',
    tag: 'BLOQUEIO',
    desc: 'Pivo rola so ate a linha de lance livre e decide 4x3',
    phases: [
      { dur: 4.5, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, SG: 'cornerR', SF: 'wingL', PF: 'cornerL' } },
      { dur: 2.6, spots: { C: { x: 240, y: 132 }, SG: 'cornerR', SF: 'wingL', PF: 'dunkerL' }, option: ['C', 'PF'], fast: ['C'] },
    ],
  },
  {
    name: 'Pick and roll com o ala',
    tag: 'BLOQUEIO',
    desc: 'Ala bloqueia (1-3): troca vira vantagem e ele abre',
    phases: [
      { dur: 4.5, until: 'used', screen: 'SF', switchOnUse: true, spots: { SF: onBallScreen, SG: 'cornerR', PF: 'cornerL', C: 'dunkerL' } },
      { dur: 2.6, spots: { SF: 'slotL', SG: 'cornerR', PF: 'cornerL', C: 'dunkerL' }, option: ['SF', 'C'], fast: ['SF'] },
    ],
  },
  {
    name: 'Horns flare',
    tag: 'ARREMESSO',
    desc: 'Horns: pivo bloqueia a bola e o ala-pivo recebe flare',
    phases: [
      { dur: 1.4, spots: { PF: 'elbowL', C: 'elbowR', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 3.5, until: 'used', screen: 'C', spots: { C: onBallScreen, PF: 'elbowL', SG: 'cornerR', SF: 'cornerL' } },
      { dur: 2.2, screen: 'SF', spots: { SF: { x: 196, y: 150 }, PF: 'wingL', C: roll }, option: ['PF', 'C'], fast: ['PF'] },
    ],
  },
  {
    name: 'Post up do pivo',
    tag: 'POSTE',
    desc: 'Bola no pivo de costas; os outros cortam e abrem',
    phases: [
      { dur: 1.2, pass: 'C', spots: { C: 'blockR', SG: 'cornerR', SF: 'wingL', PF: 'slotL' } },
      { dur: 3.5, spots: { SG: 'cornerR', SF: 'wingL', PF: 'slotL' }, option: ['SG', 'SF'] },
    ],
  },
  // ----------------------------------------------------------------- SEM a bola: VOCÊ corre pelos bloqueios
  // (offBall: você passa a bola automaticamente e segue o marcador azul; quem recebeu devolve quando você ficar livre)
  {
    name: 'Bloqueio duplo',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Passe e corra pelo garrafao: saia dos dois bloqueios para o 3 livre',
    phases: [
      { dur: 3, until: 'pg', pass: 'SG', spots: { PG: { x: 226, y: 100 }, SG: 'wingR', PF: { x: 182, y: 118 }, C: { x: 156, y: 146 }, SF: 'cornerL' } },
      { dur: 3, until: 'pg', screen: ['PF', 'C'], spots: { PG: 'wingL', PF: { x: 182, y: 118 }, C: { x: 156, y: 146 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.8, spots: { PG: 'wingL', PF: 'dunkerL', C: 'rim' }, option: ['PG', 'C'] },
    ],
  },
  {
    name: 'Pin-down',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Desca ate o bloco: o ala-pivo bloqueia e voce sobe para a ala',
    phases: [
      { dur: 3, until: 'pg', pass: 'SG', spots: { PG: 'blockL', SG: 'slotR', PF: { x: 176, y: 120 }, SF: 'cornerR', C: 'dunkerR' } },
      { dur: 3, until: 'pg', screen: 'PF', spots: { PG: 'wingL', PF: { x: 176, y: 120 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.6, spots: { PG: 'wingL', PF: 'blockL' }, option: ['PG', 'PF'] },
    ],
  },
  {
    name: 'Flare',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Passe: o pivo bloqueia por dentro e voce abre de costas para o 3',
    phases: [
      { dur: 1.2, pass: 'SG', spots: { SG: 'wingR', C: { x: 222, y: 196 }, SF: 'cornerL', PF: 'dunkerL' } },
      { dur: 3, until: 'pg', screen: 'C', spots: { PG: 'wingL', C: { x: 222, y: 196 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.6, spots: { PG: 'wingL', C: roll }, option: ['PG', 'C'] },
    ],
  },
  {
    name: 'Curl',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Desca ao bloco e faca a curva em volta do bloqueio para dentro',
    phases: [
      { dur: 3, until: 'pg', pass: 'SG', spots: { PG: 'blockL', SG: 'wingR', PF: { x: 190, y: 130 }, SF: 'cornerL', C: 'dunkerR' } },
      { dur: 2.6, until: 'pg', screen: 'PF', spots: { PG: { x: 238, y: 118 }, PF: { x: 190, y: 130 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.4, spots: { PG: { x: 244, y: 104 } }, option: ['PG'] },
    ],
  },
  {
    name: 'UCLA',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Passe para a ala e corte para a cesta raspando no pivo do cotovelo',
    phases: [
      { dur: 1.2, pass: 'SG', spots: { SG: 'wingR', C: 'elbowR', SF: 'wingL', PF: 'cornerL' } },
      { dur: 2.6, until: 'pg', screen: 'C', spots: { PG: { x: 258, y: 100 }, C: 'elbowR' }, option: ['PG'], fast: ['PG'] },
      { dur: 1.4, spots: { PG: 'blockR', C: 'top' }, option: ['PG', 'C'] },
    ],
  },
  {
    name: 'Passa e corta',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Give and go: passe, corte para a cesta e receba de volta',
    phases: [
      { dur: 0.9, pass: 'SG', spots: { SG: 'wingR', SF: 'cornerL', PF: 'wingL', C: 'dunkerL' } },
      { dur: 2.4, until: 'pg', spots: { PG: 'rim' }, option: ['PG'], fast: ['PG'] },
    ],
  },
  {
    name: 'Floppy do armador',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Comece embaixo da cesta e escolha o lado dos bloqueios',
    phases: [
      { dur: 3, until: 'pg', pass: 'SG', spots: { PG: { x: 240, y: 90 }, SG: 'top', PF: { x: 176, y: 118 }, C: { x: 304, y: 118 }, SF: 'cornerR' } },
      { dur: 3, until: 'pg', screen: ['PF', 'C'], spots: { PG: 'wingL', PF: { x: 176, y: 118 }, C: { x: 304, y: 118 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.4, spots: { PG: 'wingL', PF: 'dunkerL', C: 'dunkerR' }, option: ['PG'] },
    ],
  },
  {
    name: 'Elevador do armador',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Passe entre os dois grandes: eles fecham a porta no seu marcador',
    phases: [
      { dur: 3, until: 'pg', pass: 'SG', spots: { PG: 'blockR', SG: 'wingR', PF: { x: 222, y: 172 }, C: { x: 258, y: 172 }, SF: 'cornerL' } },
      { dur: 2.6, until: 'pg', spots: { PG: 'top', PF: { x: 222, y: 172 }, C: { x: 258, y: 172 } }, fast: ['PG'], option: ['PG'] },
      { dur: 1.4, screen: ['PF', 'C'], spots: { PG: 'top', PF: { x: 233, y: 176 }, C: { x: 247, y: 176 } }, option: ['PG'] },
    ],
  },
  {
    name: 'Chicago',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Bloqueio para baixo e voce recebe a bola de mao em mao no topo',
    phases: [
      { dur: 3, until: 'pg', pass: 'C', spots: { PG: 'blockL', C: 'slotR', PF: { x: 186, y: 122 }, SG: 'cornerR', SF: 'cornerL' } },
      { dur: 3, until: 'pg', screen: 'PF', spots: { PG: { x: 270, y: 200 }, C: 'slotR', PF: { x: 186, y: 122 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.6, spots: { C: roll, PG: 'slotR' }, option: ['PG', 'C'] },
    ],
  },
  {
    name: 'Pistol',
    tag: 'SEM BOLA',
    offBall: true,
    desc: 'Passe para a ala, pegue de volta de mao em mao e ataque o pick and roll',
    phases: [
      { dur: 0.9, pass: 'SG', spots: { SG: 'wingR', C: 'elbowR', SF: 'cornerL', PF: 'wingL' } },
      { dur: 2.6, until: 'pg', spots: { PG: { x: 352, y: 172 } }, option: ['PG'], fast: ['PG'] },
      { dur: 3.5, until: 'used', screen: 'C', spots: { C: onBallScreen, SG: 'cornerR' } },
      { dur: 2.2, spots: { C: roll, SG: 'cornerR' }, option: ['C', 'SG'], fast: ['C'] },
    ],
  },
  // ----------------------------------------------------------------- JOGADAS DE FRANQUIA (só do time / época)
  {
    name: 'Split do Chef',
    tag: 'SEM BOLA',
    offBall: true,
    teams: ['ondas', 'ondas17'],
    desc: 'Bola no pivo alto; voce bloqueia para o ala e sai para o 3 (split action)',
    phases: [
      { dur: 1.2, pass: 'C', spots: { C: { x: 264, y: 150 }, SG: 'wingR', SF: 'cornerL', PF: 'wingL' } },
      { dur: 2.6, until: 'pg', spots: { PG: { x: 312, y: 168 }, SG: 'rim' }, option: ['SG'], fast: ['SG'] },
      { dur: 2.2, until: 'pg', spots: { PG: 'wingR', SG: 'cornerR' }, option: ['PG', 'SG'], fast: ['PG'] },
    ],
  },
  {
    name: 'Luka e LeBron',
    tag: 'BLOQUEIO',
    teams: ['astros'],
    desc: 'Pick and roll 1-3 com o craque: ele rola ou abre na troca',
    phases: [
      { dur: 4.5, until: 'used', screen: 'SF', switchOnUse: true, spots: { SF: onBallScreen, SG: 'cornerR', PF: 'cornerL', C: 'dunkerL' } },
      { dur: 2.6, spots: { SF: roll, SG: 'cornerR', PF: 'cornerL', C: 'dunkerL' }, option: ['SF', 'C'], fast: ['SF'] },
    ],
  },
  {
    name: 'Joker hand-off',
    tag: 'SEM BOLA',
    offBall: true,
    teams: ['pepitas', 'pepitas23'],
    desc: 'O pivo armador no topo: corte pelas costas do ala ou pegue de mao em mao',
    phases: [
      { dur: 1.2, pass: 'C', spots: { C: 'slotR', SG: 'wingR', SF: 'cornerL', PF: 'dunkerL' } },
      { dur: 2.4, spots: { SG: 'rim', PG: { x: 312, y: 196 } }, option: ['SG', 'PG'], fast: ['SG'] },
      { dur: 2, spots: { SG: 'cornerR', PG: 'wingR' }, option: ['PG'] },
    ],
  },
  {
    name: 'Iso no cotovelo',
    tag: '1X1',
    teams: ['trovoes'],
    desc: 'Receba no cotovelo com o lado limpo: meia distancia ou falta',
    phases: [{ dur: 8, spots: { SG: 'cornerL', SF: 'wingL', PF: 'cornerR', C: 'dunkerL' } }],
  },
  {
    name: 'Drag do Grego',
    tag: 'BLOQUEIO',
    teams: ['cervos', 'cervos21'],
    desc: 'O ala-pivo atleta bloqueia e mergulha no garrafao',
    phases: [
      { dur: 4, until: 'used', screen: 'PF', switchOnUse: true, spots: { PF: onBallScreen, SG: 'cornerR', SF: 'cornerL', C: 'wingL' } },
      { dur: 2.4, spots: { PF: roll, SG: 'cornerR', SF: 'cornerL', C: 'wingL' }, option: ['PF'], fast: ['PF'] },
    ],
  },
  {
    name: 'DHO do Bam',
    tag: 'SEM BOLA',
    offBall: true,
    teams: ['calor', 'calor13'],
    desc: 'Passe para o grandalhao no topo e pegue de volta raspando nele',
    phases: [
      { dur: 1.1, pass: 'PF', spots: { PF: 'slotR', SG: 'cornerR', SF: 'cornerL', C: 'dunkerL' } },
      { dur: 2.6, until: 'pg', spots: { PG: { x: 312, y: 200 } }, option: ['PG'], fast: ['PG'] },
      { dur: 1.8, spots: { PF: roll }, option: ['PF'] },
    ],
  },
  {
    name: 'Lob do pivo',
    tag: 'BLOQUEIO',
    teams: ['cavaleiros', 'veleiros14', 'cavaleiros11'],
    desc: 'Pick and roll para a ponte aerea: o pivo sobe para a enterrada',
    phases: [
      { dur: 4.5, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, SG: 'cornerR', SF: 'cornerL', PF: 'wingL' } },
      { dur: 2.2, spots: { C: 'rim', SG: 'cornerR', SF: 'cornerL', PF: 'wingL' }, option: ['C'], fast: ['C'] },
    ],
  },
  {
    name: 'Pick and pop do gigante',
    tag: 'ARREMESSO',
    teams: ['esporas', 'metro', 'trevos', 'cavaleiros11'],
    desc: 'O pivo arremessador bloqueia e abre para o 3',
    phases: [
      { dur: 4.5, until: 'used', screen: 'C', switchOnUse: true, spots: { C: onBallScreen, SG: 'cornerR', SF: 'cornerL', PF: 'dunkerL' } },
      { dur: 2.4, spots: { C: 'slotL', SG: 'cornerR', SF: 'cornerL', PF: 'dunkerL' }, option: ['C'], fast: ['C'] },
    ],
  },
  {
    name: 'Triangulo',
    tag: 'POSTE',
    teams: ['touros96', 'astros'],
    desc: 'Pivo no poste, ala no canto, voce na ala: passe e corte',
    phases: [
      { dur: 1.2, pass: 'C', spots: { C: 'blockR', SG: 'cornerR', SF: 'slotL', PF: 'elbowL' } },
      { dur: 2.6, spots: { PG: 'rim', SG: 'wingR', SF: 'slotL' }, option: ['PG', 'SG'], fast: ['PG'] },
      { dur: 1.6, spots: { PG: 'cornerR' }, option: ['SG', 'SF'] },
    ],
  },
  {
    name: 'Stockton e Malone',
    tag: 'BLOQUEIO',
    teams: ['jazz97', 'jazz'],
    desc: 'O ala-pivo bloqueia e abre no cotovelo para o arremesso',
    phases: [
      { dur: 4.5, until: 'used', screen: 'PF', switchOnUse: true, spots: { PF: onBallScreen, SG: 'cornerR', SF: 'wingL', C: 'dunkerL' } },
      { dur: 2.4, spots: { PF: 'elbowR', SG: 'cornerR', SF: 'wingL', C: 'dunkerL' }, option: ['PF'], fast: ['PF'] },
    ],
  },
  {
    name: 'Dream shake',
    tag: 'POSTE',
    teams: ['foguetes95'],
    desc: 'Bola no pivo de costas com quatro arremessadores abertos',
    phases: [
      { dur: 1.2, pass: 'C', spots: { C: 'blockR', SG: 'cornerR', SF: 'cornerL', PF: 'wingL' } },
      { dur: 4, spots: { SG: 'cornerR', SF: 'cornerL', PF: 'wingL', PG: 'wingR' }, option: ['SG', 'SF', 'PG'] },
    ],
  },
  {
    name: 'Sete segundos',
    tag: 'BLOQUEIO',
    teams: ['fenix05', 'fenix', 'astros87'],
    desc: 'Bloqueio rapido na transicao e todos correndo para os cantos',
    phases: [
      { dur: 3, until: 'used', screen: 'PF', switchOnUse: true, spots: { PF: onBallScreen, SG: 'cornerR', SF: 'cornerL', C: 'dunkerL' } },
      { dur: 2, spots: { PF: 'rim', SG: 'cornerR', SF: 'cornerL', C: 'dunkerL' }, option: ['PF', 'SG', 'SF'], fast: ['PF'] },
    ],
  },
];

export const playByIndex = (i) => PLAY_LIBRARY[i] || null;

// Playbook de um time: as jogadas de franquia dele primeiro, depois as gerais (índices do PLAY_LIBRARY).
export function playbookFor(team) {
  const ids = [team.id, team.base].filter(Boolean);
  const own = [];
  const gen = [];
  PLAY_LIBRARY.forEach((p, i) => {
    if (!p.teams) gen.push(i);
    else if (p.teams.some((t) => ids.includes(t))) own.push(i);
  });
  return [...own, ...gen];
}
export const PLAYS_PER_PAGE = 9;
