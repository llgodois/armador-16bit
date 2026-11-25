import Phaser from 'phaser';
import { GAME, VIEW, THREE, PAINT, BASKET } from '../config.js';
import { PLAY_LIBRARY, SLOTS, BASE_SLOTS, ROLES, PLAYS_PER_PAGE } from '../plays/index.js';
import { DEF_SCHEMES, ZONE_SPOTS } from '../data/defense.js';

const lerpN = (a, b, t) => a + (b - a) * t;
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu, drawControls } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

const ROLE_COLORS = { PG: 0xffe14d, SG: 0x6fa0ff, SF: 0x6dff6d, PF: 0xff9a4d, C: 0xff6bd5 };
const TAG_COLORS = { BLOQUEIO: 0xff9a4d, ARREMESSO: 0x6dff6d, CORTE: 0x6fa0ff, '1X1': 0xffe14d, INFILTRAR: 0xff6bd5, 'SEM BOLA': 0x3ad6ff, POSTE: 0xc8a2ff };

function wrap(text, max) {
  const words = text.toUpperCase().split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines;
}

// Sobreposição com o jogo PAUSADO: menu de pausa, playbook e controles.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  init(data) {
    this.gs = data.game;
    this.mode = data.mode || 'pause';
    this.padPage = !!data.padPage;
    this.from = data.from || null;
    this.page = data.page;
  }

  create() {
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05050a, 0.68).setOrigin(0);
    this.g = this.add.graphics();
    const kb = this.input.keyboard;
    if (this.mode === 'pause') this.buildPause();
    else if (this.mode === 'playbook') this.buildPlaybook();
    else if (this.mode === 'subs') this.buildSubs();
    else if (this.mode === 'timeout') this.buildTimeout();
    else this.buildControls();

    const nav = (d) => this.onNav && this.onNav(d);
    kb.on('keydown-UP', () => nav(-1));
    kb.on('keydown-W', () => nav(-1));
    kb.on('keydown-DOWN', () => nav(1));
    kb.on('keydown-S', () => nav(1));
    kb.on('keydown-ENTER', () => this.onEnter && this.onEnter());
    kb.on('keydown-SPACE', () => this.onEnter && this.onEnter());
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-P', () => this.back());
    kb.on('keydown-TAB', () => (this.mode === 'playbook' ? this.back() : null));
    kb.on('keydown-M', () => sfx.toggleMute());
  }

  resumeGame() {
    this.scene.resume('Game');
    this.scene.stop();
  }

  back() {
    if (this.mode !== 'pause' && this.from === 'pause') {
      this.scene.restart({ game: this.gs, mode: 'pause' });
      return;
    }
    this.resumeGame();
  }

  // ------------------------------------------------------------ pausa
  buildPause() {
    const x = VIEW.W / 2 - 100;
    drawPanel(this.g, x, 50, 200, 160, 0xffe14d);
    new PixelText(this, VIEW.W / 2, 62, 'PAUSADO', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const sc = this.gs.score;
    new PixelText(this, VIEW.W / 2, 84, `${this.gs.homeTeam.name} ${sc.home} X ${sc.away} ${this.gs.awayTeam.name}`, { origin: [0.5, 0], color: 0xb8b0d0 });
    const items = [
      { label: 'CONTINUAR' },
      { label: 'PLAYBOOK' },
      { label: 'SUBSTITUICOES' },
      { label: `TEMPO TECNICO (${this.gs.timeouts})` },
      { label: 'CONTROLES' },
      { label: 'REINICIAR PARTIDA' },
      { label: 'SAIR PARA O TITULO', color: 0xff7b6b },
    ];
    const m = makeMenu(this, items, VIEW.W / 2, 100, { gap: 14 });
    this.onNav = (d) => {
      m.set(m.index + d);
      sfx.play('select');
    };
    this.onEnter = () => {
      sfx.play('select');
      switch (m.index) {
        case 0:
          return this.resumeGame();
        case 1:
          return this.scene.restart({ game: this.gs, mode: 'playbook', from: 'pause' });
        case 2:
          return this.scene.restart({ game: this.gs, mode: 'subs', from: 'pause' });
        case 3:
          return this.scene.restart({ game: this.gs, mode: 'timeout', from: 'pause' });
        case 4:
          return this.scene.restart({ game: this.gs, mode: 'controls', from: 'pause', padPage: !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) });
        case 5:
          return this.scene.start('Game', this.gs.registry.get('setup'));
        default:
          this.scene.stop('Game');
          this.scene.stop('HUD');
          return this.scene.start('Title');
      }
    };
  }

  // ------------------------------------------------------------ playbook
  buildPlaybook() {
    const gs = this.gs;
    const book = gs.playbook || PLAY_LIBRARY.map((_, i) => i);
    const pages = Math.ceil(book.length / PLAYS_PER_PAGE);
    if (this.page === undefined || this.page === 'off') this.page = gs.userOnDefense ? 'def' : gs.playPage || 0;
    if (this.page === 'def') return this.buildDefensePage();
    const pg = this.page;
    drawPanel(this.g, 10, 10, VIEW.W - 20, VIEW.H - 20, 0x6fa0ff);
    new PixelText(this, 20, 18, 'PLAYBOOK', { scale: 2, color: 0x6fa0ff });
    new PixelText(this, 118, 22, `[ATAQUE ${pg + 1}/${pages}]  DEFESA  (ESQ/DIR)`, { color: 0xb8b0d0 });
    const canCall = !gs.userOnDefense && gs.state === 'live';
    new PixelText(this, VIEW.W - 20, 22, canCall ? 'JOGO PAUSADO' : 'SO LEITURA', { origin: [1, 0], color: canCall ? 0xb8b0d0 : 0xff9a4d });
    this.bindPageSwitch(pages);

    const ids = book.slice(pg * PLAYS_PER_PAGE, (pg + 1) * PLAYS_PER_PAGE);
    const items = ids.map((li, k) => {
      const p = PLAY_LIBRARY[li];
      return { label: `${k + 1} ${p.name}`.slice(0, 26), color: p.teams ? 0xffe14d : p.offBall ? 0x3ad6ff : undefined };
    });
    const list = makeMenu(this, items, 24, 42, { gap: 13, origin: 0 });
    new PixelText(this, 24, 168, 'AMARELO = DO SEU TIME', { color: 0xffe14d });
    new PixelText(this, 24, 178, 'AZUL = SEM BOLA (VOCE CORRE)', { color: 0x3ad6ff });

    // Detalhe
    this.dName = new PixelText(this, 210, 40, '', { scale: 2, color: 0xffffff });
    this.dTag = new PixelText(this, 210, 60, '', {});
    this.dDesc = [0, 1, 2].map((i) => new PixelText(this, 210, 74 + i * 10, '', { color: 0xd8d0ee }));
    this.diagram = this.add.graphics();
    this.roleLabels = ROLES.map((r) => new PixelText(this, 0, 0, r, { color: ROLE_COLORS[r], shadow: 0x000000 }));
    new PixelText(this, 210, 236, 'QUADRADO=BLOQUEIO   *=LEITURA', { color: 0x7a7290 });
    new PixelText(this, 20, 248, canCall ? 'ENTER/A CHAMAR   ESQ/DIR (LB/RB) PAGINA   ESC/B VOLTAR' : 'ESQ/DIR PAGINA   ESC/B VOLTAR', { color: 0xb8b0d0 });

    const show = (k) => {
      const p = PLAY_LIBRARY[ids[k]];
      this.dName.setText(p.name.slice(0, 20));
      this.dTag.setText(p.tag).setColor(TAG_COLORS[p.tag] || (p.offBall ? 0x3ad6ff : 0xffffff));
      const lines = wrap(p.desc, 42);
      this.dDesc.forEach((t, j) => t.setText(lines[j] || ''));
      this.drawDiagram(p);
    };
    const cur = gs.play ? ids.findIndex((li) => PLAY_LIBRARY[li].name === gs.play.name) : -1;
    const start = Math.max(0, cur);
    list.set(start);
    show(start);
    this.onNav = (d) => {
      list.set(list.index + d);
      show(list.index);
      sfx.play('select');
    };
    this.onEnter = () => {
      if (!canCall) return;
      gs.playPage = pg; // as teclas 1..9 passam a valer para esta página
      gs.callPlay(ids[list.index]);
      this.resumeGame();
    };
  }

  // ESQ/DIR: páginas de ataque ... -> defesa -> volta
  bindPageSwitch(pages = Math.ceil((this.gs.playbook || PLAY_LIBRARY).length / PLAYS_PER_PAGE)) {
    const seq = [...Array(pages).keys(), 'def'];
    const go = (d) => {
      const i = seq.indexOf(this.page);
      const page = seq[(i + d + seq.length) % seq.length];
      this.scene.restart({ game: this.gs, mode: 'playbook', from: this.from, page });
    };
    this.input.keyboard.on('keydown-LEFT', () => go(-1));
    this.input.keyboard.on('keydown-RIGHT', () => go(1));
    this.input.keyboard.on('keydown-A', () => go(-1));
    this.input.keyboard.on('keydown-D', () => go(1));
  }
  // Playbook defensivo: escolhe o esquema do seu time.
  buildDefensePage() {
    const gs = this.gs;
    drawPanel(this.g, 10, 10, VIEW.W - 20, VIEW.H - 20, 0xff9a4d);
    new PixelText(this, 20, 18, 'PLAYBOOK', { scale: 2, color: 0xff9a4d });
    new PixelText(this, 118, 22, 'ATAQUE  [DEFESA]  (ESQ/DIR)', { color: 0xb8b0d0 });
    new PixelText(this, VIEW.W - 20, 22, `ADV: ${gs.oppScheme.name}`, { origin: [1, 0], color: 0xb8b0d0 });
    this.bindPageSwitch();
    const items = DEF_SCHEMES.map((s, i) => ({ label: `${i + 1} ${s.name}${s === gs.userScheme ? ' *' : ''}` }));
    const list = makeMenu(this, items, 30, 44, { gap: 14, origin: 0 });
    this.dName = new PixelText(this, 210, 44, '', { scale: 2, color: 0xffffff });
    this.dTag = new PixelText(this, 210, 64, '', { color: 0xff9a4d });
    this.dDesc = [0, 1, 2].map((i) => new PixelText(this, 210, 78 + i * 10, '', { color: 0xd8d0ee }));
    this.diagram = this.add.graphics();
    this.roleLabels = [];
    const PNR = { drop: 'PICK AND ROLL: RECUA (DROP)', switch: 'PICK AND ROLL: TROCA', hedge: 'PICK AND ROLL: HEDGE', blitz: 'PICK AND ROLL: DOBRA (BLITZ)' };
    const LEIT = {
      man: 'LEITURA: ARREMESSO DE MEIA NO BLOQUEIO',
      switch: 'LEITURA: ATAQUE O DESENCONTRO DE TAMANHO',
      hedge: 'LEITURA: PASSE RAPIDO PARA QUEM ROLA',
      blitz: 'LEITURA: SOLTE A BOLA, 4X3 ATRAS',
      zone: 'LEITURA: BOLA NO MEIO E CANTOS ABERTOS',
      press: 'LEITURA: PASSE LONGO ANTES DA DOBRA',
    };
    this.leit = new PixelText(this, 210, 222, '', { color: 0x6dff6d });
    new PixelText(this, 20, 248, 'ENTER USAR ESTA DEFESA    ESC/TAB VOLTAR', { color: 0xb8b0d0 });
    const show = (i) => {
      const s = DEF_SCHEMES[i];
      this.dName.setText(s.name);
      this.dTag.setText(PNR[s.pnr]);
      const lines = wrap(s.desc, 42);
      this.dDesc.forEach((t, k) => t.setText(lines[k] || ''));
      this.leit.setText(LEIT[s.id]);
      this.drawDefense(s);
    };
    const start = Math.max(0, DEF_SCHEMES.indexOf(gs.userScheme));
    list.set(start);
    show(start);
    this.onNav = (d) => {
      list.set(list.index + d);
      show(list.index);
      sfx.play('select');
    };
    this.onEnter = () => {
      gs.setUserScheme(list.index);
      this.resumeGame();
    };
  }

  drawDefense(s) {
    const g = this.diagram;
    g.clear();
    const X0 = 214;
    const Y0 = 108;
    const S = 0.6;
    const map = (p) => ({ x: X0 + (p.x - 70) * S, y: Y0 + (p.y - 36) * S * 0.85 });
    g.fillStyle(0xc08043, 1).fillRect(X0, Y0, 340 * S, 226 * S * 0.85);
    const pa = map({ x: PAINT.left, y: PAINT.top });
    const pb = map({ x: PAINT.right, y: PAINT.bottom });
    g.fillStyle(0x3355a8, 1).fillRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y);
    const arc = [];
    for (let a = 0; a <= 180; a += 6) {
      const r = (a * Math.PI) / 180;
      arc.push(map({ x: BASKET.x + Math.cos(r) * THREE.rx, y: BASKET.y + Math.sin(r) * THREE.ry }));
    }
    g.lineStyle(1, 0xf3efe6, 1).strokePoints(arc);
    for (const r of ROLES) {
      const a = map(SLOTS[BASE_SLOTS[r]]);
      g.fillStyle(0x6fa0ff, 1).fillCircle(a.x, a.y, 2);
      let d;
      if (s.zone) d = map(ZONE_SPOTS[r]);
      else if (s.press) d = { x: a.x, y: a.y + 10 };
      else {
        const t = 0.18;
        d = map({ x: lerpN(SLOTS[BASE_SLOTS[r]].x, BASKET.x, t), y: lerpN(SLOTS[BASE_SLOTS[r]].y, BASKET.y, t) });
      }
      g.fillStyle(0xff5a4d, 1).fillRect(d.x - 2, d.y - 2, 5, 5);
      if (!s.zone) g.lineStyle(1, 0xff5a4d, 0.6).lineBetween(a.x, a.y, d.x, d.y);
    }
    if (s.doublePG || s.press) {
      const pg = map(SLOTS.top);
      g.fillStyle(0xff5a4d, 1).fillRect(pg.x + 5, pg.y - 2, 5, 5);
    }
  }

  // Mini quadra com o caminho de cada posição ao longo das fases.
  drawDiagram(play) {
    const g = this.diagram;
    g.clear();
    const X0 = 214;
    const Y0 = 108;
    const S = 0.6;
    const map = (p) => ({ x: X0 + (p.x - 70) * S, y: Y0 + (p.y - 36) * S * 0.85 });
    const W = 340 * S;
    const H = 226 * S * 0.85;
    g.fillStyle(0xc08043, 1).fillRect(X0, Y0, W, H);
    g.lineStyle(1, 0xf3efe6, 1).strokeRect(X0 + 0.5, Y0 + 0.5, W - 1, H - 1);
    const pa = map({ x: PAINT.left, y: PAINT.top });
    const pb = map({ x: PAINT.right, y: PAINT.bottom });
    g.fillStyle(0x3355a8, 1).fillRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y);
    g.lineStyle(1, 0xf3efe6, 1);
    const arc = [];
    for (let a = 0; a <= 180; a += 6) {
      const r = (a * Math.PI) / 180;
      arc.push(map({ x: BASKET.x + Math.cos(r) * THREE.rx, y: BASKET.y + Math.sin(r) * THREE.ry }));
    }
    g.strokePoints(arc);
    const bk = map(BASKET);
    g.fillStyle(0xe8551c, 1).fillCircle(bk.x, bk.y, 2);

    const pos = {};
    for (const r of ROLES) pos[r] = map(SLOTS[BASE_SLOTS[r]]);
    pos.PG = map({ x: 296, y: 216 });
    const resolve = (s) => (typeof s === 'string' ? SLOTS[s] : typeof s === 'function' ? s.preview : s);
    const opts = new Set();
    for (const ph of play.phases) {
      const screens = [].concat(ph.screen || []);
      for (const [role, spot] of Object.entries(ph.spots)) {
        const pt = resolve(spot);
        if (!pt) continue;
        const to = map(pt);
        const from = pos[role];
        g.lineStyle(1, ROLE_COLORS[role], 0.9).lineBetween(from.x, from.y, to.x, to.y);
        g.fillStyle(ROLE_COLORS[role], 1);
        if (screens.includes(role)) g.fillRect(to.x - 2, to.y - 2, 5, 5);
        else g.fillCircle(to.x, to.y, 1.5);
        pos[role] = to;
      }
      (ph.option || []).forEach((r) => opts.add(r));
    }
    g.fillStyle(ROLE_COLORS.PG, 1).fillCircle(pos.PG.x, pos.PG.y, 2.5);
    ROLES.forEach((r, i) => {
      const p = pos[r];
      this.roleLabels[i].setText(opts.has(r) ? `${r}*` : r).setPosition(p.x + 3, p.y - 9);
    });
  }

  // ------------------------------------------------------------ substituições
  buildSubs() {
    const gs = this.gs;
    drawPanel(this.g, 30, 24, VIEW.W - 60, VIEW.H - 48, 0x6fa0ff);
    new PixelText(this, VIEW.W / 2, 32, 'SUBSTITUICOES', { scale: 2, origin: [0.5, 0], color: 0x6fa0ff });
    new PixelText(this, 46, 54, 'EM QUADRA                    GAS     NO BANCO               GAS', { color: 0x7a7290 });
    const pct = (e) => `${Math.round(e)}%`;
    const items = gs.home.map((p, i) => {
      const b = gs.bench.home[i];
      const me = p === gs.user;
      return {
        label: `${p.role.padEnd(3)}${p.info.name.slice(0, 16).padEnd(17)}${pct(p.energy).padStart(5)}   ${me ? '(VOCE NAO SAI)' : b.info.name.slice(0, 16).padEnd(17) + pct(b.energy).padStart(5)}`,
        color: p.energy < 35 ? 0xff7b6b : 0xd8d0ee,
      };
    });
    items.push({ label: `TROCA AUTOMATICA: ${gs.autoSubHome ? 'LIGADA' : 'DESLIGADA'}`, color: 0xffe14d });
    const m = makeMenu(this, items, 46, 70, { gap: 16, origin: 0 });
    new PixelText(this, VIEW.W / 2, VIEW.H - 40, 'ENTER TROCA    ESC VOLTA', { origin: [0.5, 0], color: 0xb8b0d0 });
    this.onNav = (d) => {
      m.set(m.index + d);
      sfx.play('select');
    };
    this.onEnter = () => {
      if (m.index < 5) {
        if (gs.substitute(gs.home[m.index])) sfx.play('whistle');
      } else gs.autoSubHome = !gs.autoSubHome;
      this.scene.restart({ game: gs, mode: 'subs', from: this.from });
    };
  }

  // ------------------------------------------------------------ tempo técnico
  buildTimeout() {
    const gs = this.gs;
    const t = gs.track;
    drawPanel(this.g, 20, 14, VIEW.W - 40, VIEW.H - 28, 0xffe14d);
    new PixelText(this, VIEW.W / 2, 22, 'TEMPO TECNICO', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    if (gs.timeouts <= 0) {
      new PixelText(this, VIEW.W / 2, 120, 'SEM TEMPOS TECNICOS RESTANTES', { origin: [0.5, 0], color: 0xff7b6b });
      return;
    }
    // Relatório
    const dblPct = t.userPoss ? Math.round((100 * t.doubledUser) / t.userPoss) : 0;
    const topScheme = Object.entries(t.schemes).sort((a, b) => b[1] - a[1])[0];
    const schemeName = topScheme ? DEF_SCHEMES.find((s) => s.id === topScheme[0]).name : '-';
    const plays = Object.entries(t.plays).sort((a, b) => b[1].uses - a[1].uses).slice(0, 3);
    const lines = [
      `PLACAR ${gs.score.home} X ${gs.score.away}    POSSES NO ATAQUE ${t.userPoss}`,
      `DOBRAS EM VOCE: ${t.doubledUser} (${dblPct}% DAS POSSES)`,
      `DEFESA MAIS USADA PELO ADVERSARIO: ${schemeName}`,
      ...plays.map(([n, v]) => `${n}: ${v.uses}X  ${(v.pts / v.uses).toFixed(1)} PTS POR USO`),
    ];
    if (!plays.length) lines.push('VOCE AINDA NAO CHAMOU JOGADAS');
    lines.forEach((l, i) => new PixelText(this, 34, 44 + i * 10, l, { color: i === 0 ? 0xffffff : 0xd8d0ee }));

    // Ajustes (até 2)
    const ADJ = [
      ['space', 'MAIS ESPACAMENTO (+ ARREMESSO DE 3)'],
      ['paint', 'ATACAR O GARRAFAO (+ BANDEJAS)'],
      ['protect', 'PROTEGER O GARRAFAO (- BANDEJAS DELES)'],
      ['closeout', 'FECHAR NOS ATIRADORES (- 3 DELES)'],
      ['run', 'CORRER MAIS (MAIS RAPIDO, CANSA MAIS)'],
    ];
    this.pick = this.pick || new Set(Object.keys(gs.adj).filter((k) => gs.adj[k]));
    new PixelText(this, 34, 110, 'ESCOLHA ATE 2 AJUSTES:', { color: 0xffe14d });
    const items = ADJ.map(([k, l]) => ({ label: `${this.pick.has(k) ? '[X]' : '[ ]'} ${l}` }));
    items.push({ label: 'CONFIRMAR E VOLTAR AO JOGO', color: 0x6dff6d });
    const m = makeMenu(this, items, 44, 124, { gap: 13, origin: 0 });
    this.onNav = (d) => {
      m.set(m.index + d);
      sfx.play('select');
    };
    this.onEnter = () => {
      if (m.index < ADJ.length) {
        const k = ADJ[m.index][0];
        if (this.pick.has(k)) this.pick.delete(k);
        else if (this.pick.size < 2) this.pick.add(k);
        m.label(m.index, `${this.pick.has(k) ? '[X]' : '[ ]'} ${ADJ[m.index][1]}`);
        sfx.play('select');
        return;
      }
      gs.adj = Object.fromEntries([...this.pick].map((k) => [k, true]));
      gs.timeouts--;
      gs.atoReady = true; // jogada desenhada no tempo (ATO): a próxima jogada chamada rende mais
      // o tempo também descansa todo mundo
      gs.stamina = Math.min(100, gs.stamina + 30);
      for (const p of gs.all) p.energy = Math.min(100, p.energy + 15);
      gs.events.emit('toast', 'Ajustes aplicados - a proxima jogada e desenhada (ATO)', 0x6dff6d);
      this.resumeGame();
    };
  }

  // ------------------------------------------------------------ controles
  buildControls() {
    drawPanel(this.g, 14, 10, VIEW.W - 28, VIEW.H - 20, 0x6dff6d);
    const pad = !!this.padPage;
    new PixelText(this, VIEW.W / 2, 16, pad ? 'CONTROLES - JOYSTICK' : 'CONTROLES - TECLADO', { scale: 2, origin: [0.5, 0], color: 0x6dff6d });
    drawControls(this, this.g, 24, 40, VIEW.W - 44, 10, pad);
    new PixelText(this, VIEW.W / 2, VIEW.H - 22, 'ESQ/DIR (LB/RB) TECLADO-JOYSTICK    ESC/B VOLTAR', { origin: [0.5, 0], color: 0xb8b0d0 });
    const flip = () => this.scene.restart({ game: this.gs, mode: 'controls', from: this.from, padPage: !pad });
    this.input.keyboard.on('keydown-LEFT', flip);
    this.input.keyboard.on('keydown-RIGHT', flip);
  }
}
