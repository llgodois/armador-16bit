import Phaser from 'phaser';
import { VIEW } from '../config.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { LEGENDS } from '../data/legends.js';
import { UNLOCKS, FREE_LEGENDS, isUnlocked, unlockOf, checkChallenges, recordTeamScore } from '../data/unlocks.js';
import { saveProfile, submitScore, topScores, isOnline } from '../net/backend.js';
import { THEME } from '../ui/theme.js';

// =====================================================================
//  COMPETITIVO — SOBREVIVÊNCIA: só posses de ataque, 3 vidas.
//  Posse sem pontuar = perde 1 vida. Ranking = cestas + assistências do seu armador.
//  Cada ponto de ranking = 10 moedas. Lendas bloqueadas: desafio ou moedas.
// =====================================================================
export const COIN_PER_POINT = 10;

export default class CompetitiveScene extends Phaser.Scene {
  constructor() {
    super('Competitive');
  }

  init(data) {
    this.result = (data && data.result) || null;
    this.page = this.result ? 'result' : (data && data.page) || 'menu';
  }

  create() {
    // cada abertura da tela tem um número: textos de uma tela antiga (que ainda carregava) não aparecem na nova
    this.gen = (this.gen || 0) + 1;
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.g = this.add.graphics();
    this.profile = this.registry.get('profile');
    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.onNav && this.onNav(-1, 0));
    kb.on('keydown-W', () => this.onNav && this.onNav(-1, 0));
    kb.on('keydown-DOWN', () => this.onNav && this.onNav(1, 0));
    kb.on('keydown-S', () => this.onNav && this.onNav(1, 0));
    kb.on('keydown-LEFT', () => this.onNav && this.onNav(0, -1));
    kb.on('keydown-RIGHT', () => this.onNav && this.onNav(0, 1));
    kb.on('keydown-ENTER', () => this.onEnter && this.onEnter());
    kb.on('keydown-ESC', () => (this.page === 'menu' ? this.scene.start('Title') : this.scene.restart({ page: 'menu' })));
    if (this.result) return this.pageResult();
    ({ menu: () => this.pageMenu(), ranking: () => this.pageRanking(), legends: () => this.pageLegends() })[this.page]();
  }

  T(x, y, s, o = {}) {
    return new PixelText(this, x, y, s, o);
  }

  header(title, color = 0xffe14d) {
    const W = VIEW.W;
    drawPanel(this.g, 8, 8, W - 16, VIEW.H - 16, color);
    this.T(16, 14, title, { scale: 2, color });
    const p = this.profile;
    this.T(W - 16, 14, p ? `${p.name}` : 'CONVIDADO', { origin: [1, 0], color: p ? 0x6dff6d : 0x7a7290 });
    this.T(W - 16, 24, p ? `${p.coins} MOEDAS  RECORDE ${p.best}` : 'SEM CONTA: NAO SALVA', { origin: [1, 0], color: 0xffe14d });
    this.T(W - 16, VIEW.H - 20, isOnline() ? 'ONLINE' : 'OFFLINE (SO ESTE PC)', { origin: [1, 0], color: isOnline() ? 0x6dff6d : 0xff9a4d });
  }

  pageMenu() {
    const W = VIEW.W;
    this.header('COMPETITIVO');
    this.T(W / 2, 40, 'SEMPRE CONTRA O CHICAGO BULLS 96 (JORDAN)', { origin: [0.5, 0], color: 0xff9a4d });
    this.T(W / 2, 52, 'SOBREVIVENCIA: SO ATAQUE, 3 VIDAS', { origin: [0.5, 0], color: 0x6fa0ff });
    this.T(W / 2, 64, 'POSSE SEM PONTUAR = MENOS 1 VIDA', { origin: [0.5, 0], color: 0xd8d0ee });
    this.T(W / 2, 76, 'RANKING = SUAS CESTAS + SUAS ASSISTENCIAS', { origin: [0.5, 0], color: 0xd8d0ee });
    this.T(W / 2, 88, `CADA PONTO = ${COIN_PER_POINT} MOEDAS  -  A DEFESA FICA MAIS DURA`, { origin: [0.5, 0], color: 0xd8d0ee });
    const items = [{ label: 'JOGAR', color: 0x6dff6d }, { label: 'RANKING' }, { label: 'LENDAS: DESAFIOS E LOJA' }, { label: 'VOLTAR' }];
    const m = makeMenu(this, items, W / 2, 116, { gap: 18 });
    this.onNav = (d) => {
      if (!d) return;
      m.set(m.index + d);
      sfx.play('select');
    };
    this.onEnter = () => {
      sfx.play('select');
      if (m.index === 0) this.scene.start('Select', { survival: true });
      else if (m.index === 1) this.scene.restart({ page: 'ranking' });
      else if (m.index === 2) this.scene.restart({ page: 'legends' });
      else this.scene.start('Title');
    };
  }

  async pageRanking(highlight = null) {
    const W = VIEW.W;
    this.header('RANKING', 0x6fa0ff);
    const gen = this.gen;
    const loading = this.T(W / 2, 100, 'CARREGANDO...', { origin: [0.5, 0], color: 0xb8b0d0 });
    this.onEnter = () => this.scene.restart({ page: 'menu' });
    const rows = await topScores(15);
    if (!this.sys.isActive() || gen !== this.gen) return;
    loading.destroy();
    if (!rows) return this.T(W / 2, 100, 'SEM CONEXAO COM O SERVIDOR', { origin: [0.5, 0], color: 0xff7b6b });
    if (!rows.length) return this.T(W / 2, 100, 'NINGUEM JOGOU AINDA', { origin: [0.5, 0], color: 0xb8b0d0 });
    if (THEME.modern) {
      // (64: a fonte não é monoespaçada: cada coluna no seu lugar)
      this.rankRow64({ name: 'JOGADOR', score: 'PTS', baskets: 'CESTAS', assists: 'ASSIST', pg: 'ARMADOR | TIME' }, -1, 44, 0x7a7290, 16);
      rows.forEach((r, i) => {
        const me = this.profile && r.name === this.profile.name;
        const hl = highlight && r.name === highlight.name && r.score === highlight.score;
        this.rankRow64(r, i, 56 + i * 11, hl ? 0x6dff6d : me ? 0xffe14d : 0xd8d0ee, 16);
      });
      this.T(W / 2, VIEW.H - 30, 'ENTER / ESC VOLTAR', { origin: [0.5, 0], color: 0xb8b0d0 });
      return;
    }
    this.T(16, 44, '#  JOGADOR      PTS CESTAS ASSIST  ARMADOR          TIME', { color: 0x7a7290 });
    rows.forEach((r, i) => {
      const me = this.profile && r.name === this.profile.name;
      const hl = highlight && r.name === highlight.name && r.score === highlight.score;
      // o campo "pg" guarda "Armador | Time"
      const [pg, team] = String(r.pg || '').split(' | ');
      const line = `${String(i + 1).padStart(2)} ${r.name.padEnd(12).slice(0, 12)} ${String(r.score).padStart(3)} ${String(r.baskets).padStart(6)} ${String(r.assists).padStart(6)}  ${(pg || '').padEnd(16).slice(0, 16)} ${(team || '-').slice(0, 13)}`;
      this.T(16, 56 + i * 11, line, { color: hl ? 0x6dff6d : me ? 0xffe14d : 0xd8d0ee });
    });
    this.T(W / 2, VIEW.H - 30, 'ENTER / ESC VOLTAR', { origin: [0.5, 0], color: 0xb8b0d0 });
  }

  pageLegends() {
    const W = VIEW.W;
    this.header('LENDAS', 0xff9a4d);
    const p = this.profile;
    const list = LEGENDS;
    let idx = 0;
    const rows = [];
    for (let k = 0; k < 15; k++) rows.push(this.T(20, 44 + k * 12, '', {}));
    const info = [0, 1, 2, 3].map((k) => this.T(250, 60 + k * 12, '', { color: 0xd8d0ee }));
    const msg = this.T(250, 130, '', {});
    this.T(250, 44, 'LIVRES FORA DO ARCADE:', { color: 0x7a7290 });
    this.T(20, VIEW.H - 30, 'CIMA/BAIXO ESCOLHE   ENTER COMPRA COM MOEDAS   ESC VOLTA', { color: 0xb8b0d0 });
    const draw = () => {
      const start = Math.max(0, Math.min(list.length - 15, idx - 7));
      rows.forEach((t, k) => {
        const l = list[start + k];
        if (!l) return t.setText('');
        const open = isUnlocked(p, l.id);
        t.setText(`${start + k === idx ? '> ' : '  '}${open ? '   ' : '[X]'} ${l.name}`.slice(0, 34));
        t.setColor(start + k === idx ? 0xffe14d : open ? 0x6dff6d : 0x9a92b0);
      });
      const l = list[idx];
      const u = unlockOf(l.id);
      const open = isUnlocked(p, l.id);
      info[0].setText(l.name).setColor(0xffffff);
      info[1].setText(open ? (FREE_LEGENDS.includes(l.id) ? 'LIVRE PARA TODOS' : 'DESBLOQUEADO!') : 'BLOQUEADO').setColor(open ? 0x6dff6d : 0xff7b6b);
      info[2].setText(u ? `DESAFIO: ${u.desc}`.slice(0, 36) : '').setColor(0xd8d0ee);
      info[3].setText(u ? `OU ${u.price} MOEDAS` : '').setColor(0xffe14d);
    };
    this.onNav = (d) => {
      if (!d) return;
      idx = (idx + d + list.length) % list.length;
      msg.setText('');
      sfx.play('select');
      draw();
    };
    this.onEnter = async () => {
      const l = list[idx];
      const u = unlockOf(l.id);
      if (!p) return msg.setText('ENTRE NUMA CONTA PARA COMPRAR').setColor(0xff9a4d);
      if (!u || isUnlocked(p, l.id)) return;
      if (p.coins < u.price) {
        sfx.play('buzzer');
        return msg.setText(`FALTAM ${u.price - p.coins} MOEDAS`).setColor(0xff7b6b);
      }
      p.coins -= u.price;
      p.unlocked = [...(p.unlocked || []), l.id];
      sfx.play('play');
      msg.setText(`${l.name.toUpperCase()} LIBERADO!`).setColor(0x6dff6d);
      await saveProfile(p);
      draw();
    };
    draw();
  }

  // (64) uma linha do ranking em colunas fixas: posição, jogador, pontos, cestas, assistências, armador, time
  rankRow64(r, i, y, color, x0) {
    const [pg, team] = String(r.pg || '').split(' | ');
    const cols = [
      [0, i < 0 ? '#' : String(i + 1), 0],
      [16, String(r.name).slice(0, 12), 0],
      [96, String(r.score), 1],
      [132, String(r.baskets ?? ''), 1],
      [170, String(r.assists ?? ''), 1],
      // bônus de estilo do 64 = pontos - cestas - assistências (a conta fecha em cada linha)
      [206, i < 0 ? 'BONUS' : String(Math.max(0, (Number(r.score) || 0) - (Number(r.baskets) || 0) - (Number(r.assists) || 0))), 1],
      [220, (pg || '-').slice(0, 22), 0],
      [334, (team || '-').slice(0, 18), 0],
    ];
    for (const [dx, txt, right] of cols) this.T(x0 + dx, y, txt, { color, origin: [right ? 1 : 0, 0] });
  }

  // Fim da partida de Sobrevivência: salva, dá moedas, confere desafios e mostra o ranking.
  async pageResult() {
    const W = VIEW.W;
    const r = this.result;
    const p = this.profile;
    const gen = this.gen;
    // atualiza o perfil antes de desenhar (moedas, recorde, desafios)
    const coins = r.score * COIN_PER_POINT;
    let record = false;
    let got = [];
    let teams = [];
    if (p) {
      record = r.score > (p.best || 0);
      p.coins += coins;
      p.games = (p.games || 0) + 1;
      if (record) p.best = r.score;
      got = checkChallenges(p, r);
      // recorde com o time ATUAL libera a versão histórica dele (20+ pontos)
      teams = recordTeamScore(p, r.team, r.score);
    }
    this.header('FIM DE JOGO', 0x6dff6d);
    this.T(W / 2, 46, `${r.score} PONTOS`, { scale: 3, origin: [0.5, 0], color: 0xffe14d });
    // (64: o desafio de estilo dá pontos de bônus; entram na conta mostrada)
    const bonusTxt = r.bonus ? `  +  ${r.bonus} BONUS DE ESTILO` : '';
    this.T(W / 2, 74, `${r.fgm} CESTAS  +  ${r.ast} ASSISTENCIAS${bonusTxt}   -   ${r.poss} POSSES   -   ${r.pts} PONTOS NO PLACAR`, { origin: [0.5, 0], color: 0xd8d0ee });
    this.T(W / 2, 86, `ARMADOR: ${r.pg}   -   TIME: ${r.teamName || '-'}`, { origin: [0.5, 0], color: 0x6fa0ff });
    let y = 104;
    if (p) {
      this.T(W / 2, y, `+${coins} MOEDAS  (TOTAL ${p.coins})`, { origin: [0.5, 0], color: 0xffe14d });
      y += 12;
      if (record) {
        this.T(W / 2, y, 'NOVO RECORDE PESSOAL!', { origin: [0.5, 0], color: 0x6dff6d });
        y += 12;
      }
      // (64: muitos desafios de uma vez estouravam a tela: vira uma lista corrida em poucas linhas)
      if (THEME.modern && got.length > 2) {
        const names = got.map((id) => (LEGENDS.find((x) => x.id === id) || { name: id }).name.toUpperCase());
        const lines = [''];
        for (const n of names) {
          const cur = lines[lines.length - 1];
          if ((cur + ', ' + n).length > 78 && cur) lines.push(n);
          else lines[lines.length - 1] = cur ? `${cur}, ${n}` : n;
        }
        this.T(W / 2, y, `DESAFIOS CUMPRIDOS (${names.length}) - LENDAS LIBERADAS:`, { origin: [0.5, 0], color: 0xff6bd5 });
        y += 11;
        for (const ln of lines.slice(0, 3)) {
          this.T(W / 2, y, ln + (ln === lines[2] && lines.length > 3 ? ' ...' : ''), { origin: [0.5, 0], color: 0xffb3ea });
          y += 10;
        }
        got = [];
      }
      for (const id of got) {
        const l = LEGENDS.find((x) => x.id === id);
        this.T(W / 2, y, `DESAFIO CUMPRIDO: ${l.name.toUpperCase()} LIBERADO!`, { origin: [0.5, 0], color: 0xff6bd5 });
        y += 12;
      }
      for (const t of teams) {
        this.T(W / 2, y, `TIME HISTORICO LIBERADO: ${t.name.toUpperCase()}!`, { origin: [0.5, 0], color: 0xffe14d });
        y += 12;
      }
      await saveProfile(p);
      await submitScore({ name: p.name, score: r.score, baskets: r.fgm, assists: r.ast, pg: `${r.pg} | ${r.teamName || ''}` });
    } else this.T(W / 2, y, 'CONVIDADO: ENTRE NUMA CONTA PARA SALVAR NO RANKING', { origin: [0.5, 0], color: 0xff9a4d });
    if (!this.sys.isActive() || gen !== this.gen) return;
    const rows = (await topScores(5)) || [];
    if (!this.sys.isActive() || gen !== this.gen) return;
    y = Math.max(y + 8, 150);
    this.T(W / 2, y, 'TOP 5', { origin: [0.5, 0], color: 0x6fa0ff });
    rows.forEach((row, i) => {
      const hl = p && row.name === p.name && row.score === r.score;
      const team = String(row.pg || '').split(' | ')[1] || '-';
      if (THEME.modern) return this.rankRow64(row, i, y + 12 + i * 10, hl ? 0x6dff6d : 0xd8d0ee, W / 2 - 170);
      this.T(W / 2, y + 12 + i * 10, `${i + 1}. ${row.name.padEnd(12)} ${String(row.score).padStart(4)}   ${team.padEnd(13).slice(0, 13)}`, { origin: [0.5, 0], color: hl ? 0x6dff6d : 0xd8d0ee });
    });
    this.T(W / 2, VIEW.H - 30, 'ENTER: JOGAR DE NOVO    ESC: MENU', { origin: [0.5, 0], color: 0xb8b0d0 });
    this.onEnter = () => this.scene.start('Select', { survival: true });
  }
}
