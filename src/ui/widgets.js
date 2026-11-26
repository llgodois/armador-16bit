import PixelText from './PixelText.js';
import { THEME } from './theme.js';

// Painel pixel-art: fundo escuro, borda dupla e uma faixa de destaque no topo.
// (tema moderno da versão 3D: vidro escuro arredondado com filete colorido)
export function drawPanel(g, x, y, w, h, accent = 0x6fa0ff, alpha = 0.92) {
  if (THEME.modern) {
    const r = Math.min(6, h / 4);
    g.fillStyle(0x0a1120, alpha * 0.9).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(1, 0x2a3a58, 0.9).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.fillStyle(accent, 1).fillRect(x + r + 2, y, w - 2 * r - 4, 1.5);
    return;
  }
  g.fillStyle(0x0b0b14, alpha).fillRect(x, y, w, h);
  g.lineStyle(1, 0x3a3352, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineStyle(1, 0x1a1626, 1).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.fillStyle(accent, 1).fillRect(x + 2, y + 2, w - 4, 2);
}

// Lista vertical navegável. items: [{ label, color? }]. Retorna controlador.
export function makeMenu(scene, items, x, y, { gap = 16, scale = 1, origin = 0.5, depth = 10 } = {}) {
  const texts = items.map((it, i) => new PixelText(scene, x, y + i * gap, it.label, { scale, origin: [origin, 0], depth }));
  const cursor = new PixelText(scene, 0, 0, '>', { scale, color: 0xffe14d, depth });
  const m = {
    index: 0,
    texts,
    set(i) {
      this.index = (i + items.length) % items.length;
      texts.forEach((t, k) => t.setColor(k === this.index ? 0xffe14d : items[k].color || 0xd8d0ee));
      const t = texts[this.index];
      const left = origin === 0.5 ? t.x - t.width / 2 : t.x;
      cursor.setPosition(left - 10 * scale, t.y);
    },
    label(i, s) {
      items[i].label = s;
      texts[i].setText(s);
      this.set(this.index);
    },
  };
  m.set(0);
  return m;
}

// Texto de controles (usado no título e no menu de pausa). col: 0 = esquerda, 1 = direita.
export const CONTROLS = [
  {
    title: 'ATAQUE',
    color: 0x6dff6d,
    col: 0,
    rows: [
      ['WASD SHIFT', 'mover / sprint'],
      ['J', 'segure mira, solte passa'],
      ['J + 1-4', 'passe direto (icone)'],
      ['J+L  J+K', 'quicado / finta de passe'],
      ['U', 'ponte aerea / passe alto'],
      ['K', 'arremesso (toque: finta)'],
      ['K sem bola', 'manda o colega chutar'],
      ['L', 'cross / hesita / size-up'],
      ['L L', 'giro'],
      ['K no aro', 'L reversa, lado euro'],
      ['C', 'chama bloqueio/bloqueia'],
      ['E + 1-4', 'comando para colega'],
      ['1-9  F', 'jogadas / pagina'],
      ['Q', 'visao de quadra'],
    ],
  },
  {
    title: 'DEFESA',
    color: 0xff9a4d,
    col: 1,
    rows: [
      ['K', 'roubar ou pular'],
      ['U', 'mao alta (sem falta)'],
      ['L', 'deslize/box out/mergulho'],
      ['C', 'pedir troca'],
      ['J', 'pedir dobra'],
      ['1-6', 'esquema defensivo'],
    ],
  },
  {
    title: 'GERAL',
    color: 0x6fa0ff,
    col: 1,
    rows: [
      ['TAB', 'playbook (pausado)'],
      ['ESC R M', 'pausa / replay / som'],
    ],
  },
];

// Controle (Xbox / PlayStation) — esquema estilo NBA 2K.
export const CONTROLS_PAD = [
  {
    title: 'ATAQUE',
    color: 0x6dff6d,
    col: 0,
    rows: [
      ['Analog. E', 'mover'],
      ['RT / R2', 'sprint'],
      ['A / X', 'passe (segure: mira)'],
      ['RB+botao', 'passe direto (icone)'],
      ['A + B', 'passe quicado'],
      ['A + X', 'finta de passe'],
      ['Y / Trian', 'ponte aerea / passe alto'],
      ['X / Quad', 'arremesso (toque: finta)'],
      ['X sem bola', 'manda o colega chutar'],
      ['B / Bola', 'cross / hesita / size-up'],
      ['B B', 'giro'],
      ['X no aro', 'segure B: reversa'],
      ['LB toque', 'chama bloqueio'],
      ['LB segure', 'voce bloqueia (sem bola)'],
      ['LB+botao', 'comando para colega'],
      ['Direcional', 'jogadas 1-4 (LB: 5-8)'],
      ['R3', 'pagina de jogadas'],
      ['LT / L2', 'visao de quadra'],
    ],
  },
  {
    title: 'DEFESA',
    color: 0xff9a4d,
    col: 1,
    rows: [
      ['X / Quad', 'roubar ou pular'],
      ['Y / Trian', 'mao alta (sem falta)'],
      ['B / Bola', 'deslize/box out/mergulho'],
      ['LB / L1', 'pedir troca'],
      ['A / X', 'pedir dobra'],
      ['Direcional', 'esquema defensivo'],
    ],
  },
  {
    title: 'GERAL',
    color: 0x6fa0ff,
    col: 1,
    rows: [
      ['START', 'pausa'],
      ['VIEW/SEL.', 'playbook'],
      ['L3', 'replay da jogada'],
    ],
  },
  {
    title: 'MENUS',
    color: 0xffe14d,
    col: 1,
    rows: [
      ['A  /  B', 'confirma / volta'],
      ['LB / RB', 'pagina'],
      ['Y', 'atual / historico'],
    ],
  },
];

// Desenha os blocos de controles em duas colunas dentro de uma área.
export function drawControls(scene, g, x, y, w, depth = 10, pad = false) {
  const colW = Math.floor(w / 2);
  const cy = [y, y];
  // versão 3D: comandos que só existem no 64
  const extra = !THEME.modern
    ? []
    : [
        {
          title: 'SO NO 64',
          color: 0x3ad6ff,
          col: 1,
          rows: pad
            ? [
                ['Analog. D', 'cross/hesita/giro/jab'],
                ['Analog. D baixo', 'arremesso (segure)'],
                ['Analog. D diag.', 'step-back'],
                ['RT + X no aro', 'enterrada'],
              ]
            : [
                ['SHIFT + K aro', 'enterrada'],
                ['V', 'trocar camera'],
              ],
        },
      ];
  // no 64 o LT/Q protege a bola e o LB/C segurado é a visão de quadra
  const ROWS64 = {
    'LT / L2': 'proteger / de costas',
    'LB segure': 'visao (com bola)/bloqueia',
    'RB+botao': '(no 64: use LB + botao)',
    'LB+botao': 'colega > A passe B corta X 3 Y bloq',
    Q: 'proteger / de costas',
    C: 'toque bloqueio/segure visao',
  };
  const base = (pad ? CONTROLS_PAD : CONTROLS).map((sec) =>
    THEME.modern && sec.title === 'ATAQUE' ? { ...sec, rows: sec.rows.map(([k, v]) => [k, ROWS64[k] || v]) } : sec,
  );
  for (const sec of [...base, ...extra]) {
    const cx = x + sec.col * colW;
    let yy = cy[sec.col];
    new PixelText(scene, cx, yy, sec.title, { color: sec.color, depth });
    g.fillStyle(sec.color, 0.5).fillRect(cx, yy + 9, colW - 8, 1);
    yy += 13;
    for (const [k, d] of sec.rows) {
      new PixelText(scene, cx + 2, yy, k, { color: 0xffe14d, depth });
      new PixelText(scene, cx + 64, yy, d, { color: 0xd8d0ee, depth });
      yy += 9;
    }
    cy[sec.col] = yy + 4;
  }
  return Math.max(...cy);
}