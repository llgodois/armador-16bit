// =====================================================================
//  CONTROLES PERSONALIZÁVEIS — teclado e gamepad (salvos no navegador).
//  Teclado: nome da tecla do Phaser (ex.: 'K', 'SPACE', 'SHIFT').
//  Gamepad: índice do botão no mapeamento padrão (0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 8=SELECT 9=START 10=L3 11=R3).
// =====================================================================
export const ACTIONS = [
  ['K', 'Arremesso / roubo'],
  ['J', 'Passe / pedir dobra'],
  ['L', 'Crossover / deslize'],
  ['LOB', 'Ponte aerea / toco'],
  ['ICON', 'Passe por icone (+ botao)'],
  ['E', 'Comando (+ botao/numero)'],
  ['SCREEN', 'Chamar bloqueio / bloquear'],
  ['Q', 'Visao de quadra'],
  ['SHIFT', 'Sprint'],
  ['PAGE', 'Proxima pagina de jogadas'],
  ['R', 'Replay'],
  ['TAB', 'Playbook'],
];

// Teclado (ICON = segurar J, já embutido; LOB = J + K também funciona)
export const DEFAULT_KEYS = { K: 'K', J: 'J', L: 'L', LOB: 'U', ICON: 'J', E: 'E', SCREEN: 'C', Q: 'Q', SHIFT: 'SHIFT', PAGE: 'F', R: 'R', TAB: 'TAB' };
// Controle no estilo NBA 2K (Xbox / PlayStation):
//   X/Quadrado arremesso e roubo · A/X passe · B/Bolinha crossover · Y/Triangulo ponte aérea e toco
//   RB/R1 (segure) + botão = passe por ícone · LB/L1 (segure) + botão = comando · RT/R2 sprint
//   LB/L1 (toque) chama bloqueio com a bola / (segure, sem bola) VOCÊ bloqueia
//   X/Quadrado sem a bola: manda o companheiro com a bola arremessar
//   LT/L2 visão de quadra · direcional = jogadas (LB + direcional = jogadas 5-8)
//   R3 próxima página de jogadas · L3 replay · VIEW/SELECT playbook · START pausa
export const DEFAULT_PAD = { K: 2, J: 0, L: 1, LOB: 3, ICON: 5, E: 4, SCREEN: 4, Q: 6, SHIFT: 7, PAGE: 11, R: 10, TAB: 8 };
const KEY = 'armador_controles';
export function loadControls() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    const padOk = s && s.v === 2;
    return { v: 2, keys: { ...DEFAULT_KEYS, ...(s && s.keys) }, pad: { ...DEFAULT_PAD, ...(padOk ? s.pad : {}) } };
  } catch {
    return { v: 2, keys: { ...DEFAULT_KEYS }, pad: { ...DEFAULT_PAD } };
  }
}
export function saveControls(c) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
export function resetControls() {
  saveControls({ v: 2, keys: { ...DEFAULT_KEYS }, pad: { ...DEFAULT_PAD } });
}
