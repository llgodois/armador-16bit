// =====================================================================
//  TREINO DE LEITURAS e DESAFIOS DE LENDAS
//  Lição = uma posse contra uma defesa específica. Estrelas:
//    ★ fazer a cesta  ★ chamar a jogada certa (contra-jogada)  ★ boa decisão
//    (arremesso livre ou assistência, sem forçar/perder a bola)
//  Desafio = uma partida com condição especial (placar inicial, meta de stats).
//  O progresso (estrelas) fica salvo no navegador.
// =====================================================================
export const LESSONS = [
  { id: 'drop', scheme: 'man', name: 'Contra o drop', tip: 'O pivo recua no bloqueio: chame Pick and pop ou arremesse de meia.' },
  { id: 'hedge', scheme: 'hedge', name: 'Contra o hedge', tip: 'O pivo sai em voce: solte rapido para quem rola (Pick and roll).' },
  { id: 'blitz', scheme: 'blitz', name: 'Contra a dobra', tip: 'Dobram em voce: passe antes e ataque 4 contra 3 (Espacar 5).' },
  { id: 'switch', scheme: 'switch', name: 'Contra a troca', tip: 'Eles trocam: ataque o desencontro de tamanho (Isolacao).' },
  { id: 'zone', scheme: 'zone', name: 'Contra a zona 2-3', tip: 'Bola no meio e nos cantos: Horns ou Hammer.' },
  { id: 'press', scheme: 'press', name: 'Contra a pressao', tip: 'Passe antes da dobra e ataque o espaco: Drag duplo.' },
  { id: 'help', scheme: 'man', name: 'Ajuda na infiltracao', tip: 'Infiltre: quando aparecer AJUDA, passe para quem ficou livre.' },
  { id: 'shooter', scheme: 'blitz', name: 'Dobra no atirador', tip: 'Voce e o Chef: vao te dobrar. Ache o livre e ganhe a assistencia.', legend: 'chef' },
];

// MECÂNICAS: lição de 1 posse para aprender cada comando novo.
//  mech = texto que aparece quando você faz o movimento; def = lição na DEFESA.
//  Estrelas: ** fazer o movimento  + * fazer a cesta (ataque) ou parar o ataque (defesa)
export const MECHANICS = [
  { id: 'm_giro', mech: 'GIRO', scheme: 'man', name: 'Giro', tip: 'Toque L duas vezes rapido (B B) com o marcador perto e ataque a cesta.' },
  { id: 'm_hesi', mech: 'HESITACAO', scheme: 'man', name: 'Hesitacao', tip: 'Correndo para a cesta, toque L (B): voce freia e explode.' },
  { id: 'm_size', mech: 'SIZE-UP', scheme: 'man', name: 'Size-up', tip: 'Parado, toque L (B). Depois faca um crossover para o lado.' },
  { id: 'm_euro', mech: 'EURO STEP', scheme: 'man', name: 'Euro step', tip: 'Entre no garrafao indo para o LADO e aperte K (X).' },
  { id: 'm_rev', mech: 'REVERSA', scheme: 'man', name: 'Bandeja reversa', tip: 'Entre no garrafao SEGURANDO L (B) e aperte K (X).' },
  { id: 'm_quic', mech: 'QUICADO', scheme: 'man', name: 'Passe quicado', tip: 'Segure J (A) mirando um colega e toque L (B).' },
  { id: 'm_finta', mech: 'FINTA DE PASSE', scheme: 'man', name: 'Finta de passe', tip: 'Segure J (A) mirando um colega longe do aro e aperte K (X).' },
  { id: 'm_chama', mech: 'PEDIU BLOQUEIO', scheme: 'man', name: 'Chamar bloqueio', tip: 'Com a bola, aperte C (toque no LB) e use o bloqueio do pivo.' },
  { id: 'm_bloq', mech: 'BLOQUEADO', scheme: 'man', name: 'Voce bloqueia', tip: 'Passe a bola e SEGURE C (LB) no caminho do marcador do colega.' },
  { id: 'm_chuta', mech: 'CHUTA', scheme: 'man', name: 'Manda chutar', tip: 'Passe para um colega livre e aperte K (X) sem a bola.' },
  { id: 'm_sembola', mech: 'Bloqueio duplo', scheme: 'man', name: 'Jogada sem bola', tip: 'Aperte TAB e chame Bloqueio duplo: siga o anel azul e receba livre.' },
  { id: 'm_mao', mech: 'MAO ALTA', def: true, scheme: 'man', name: 'Mao alta (defesa)', tip: 'Na defesa, quando o seu homem for arremessar, aperte U (Y).' },
  { id: 'm_carga', mech: 'FALTA DE ATAQUE', def: true, scheme: 'man', name: 'Falta de ataque', tip: 'Fique PARADO na frente de quem infiltra para cavar a falta.' },
  { id: 'm_box', mech: 'BOX OUT', def: true, scheme: 'man', name: 'Box out', tip: 'Bola no ar depois do arremesso: aperte L (B) e segure seu homem.' },
  { id: 'm_troca', mech: 'TROCA', def: true, scheme: 'man', name: 'Pedir troca', tip: 'Aperte C (LB) para trocar de marcacao com o colega mais perto.' },
];

export const CHALLENGES = [
  { id: 'virada', name: 'A virada', desc: 'Comece perdendo de 12 x 18 e venca', start: { home: 12, away: 18 }, check: (r) => r.win },
  { id: 'chef', name: 'Noite do Chef', desc: 'Com o Chef: acerte 5 bolas de 3 e venca', legend: 'chef', check: (r) => r.win && r.stats.tpm >= 5 },
  { id: 'maestro', name: 'Show do passe', desc: 'Com o Showtime: 6 assistencias e vitoria', legend: 'magico', check: (r) => r.win && r.stats.ast >= 6 },
  { id: 'muralha', name: 'Muralha', desc: 'Venca sofrendo no maximo 12 pontos', check: (r) => r.win && r.score.away <= 12 },
];

const KEY = 'armador_treino';
export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
export function saveResult(id, stars) {
  const p = loadProgress();
  p[id] = Math.max(p[id] || 0, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  return p;
}
