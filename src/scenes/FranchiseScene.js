import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { teamById, teamHudColor, bestRating, POS } from '../data/teams.js';
import {
  CAP, payroll, valueOf, modernTeams, loadFranchise, newFranchise, clearFranchise, simulateGame, evaluateTrade, doTrade,
  leagueRoster, draftPick, startNextSeason, franchiseSetup, nextOpponent, PLAYOFF_ROUNDS, PLAYOFF_WINS,
} from '../data/franchise.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

// Franquia: escolha do time, painel da temporada, trocas, entressafra/draft.
export default class FranchiseScene extends Phaser.Scene {
  constructor() {
    super('Franchise');
  }

  init(data) {
    this.page = (data && data.page) || null;
    this.msg = data && data.msg;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    for (let x = 0; x < VIEW.W; x += 6) g.fillStyle([0x2b1f15, 0x261b13, 0x2f2217][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    g.fillStyle(0x0b0b14, 0.65).fillRect(0, 0, VIEW.W, VIEW.H);
    this.g = g;
    this.f = loadFranchise();
    const kb = this.input.keyboard;
    const nav = (dr, dv) => this.onNav && this.onNav(dr, dv);
    kb.on('keydown-UP', () => nav(-1, 0));
    kb.on('keydown-W', () => nav(-1, 0));
    kb.on('keydown-DOWN', () => nav(1, 0));
    kb.on('keydown-S', () => nav(1, 0));
    kb.on('keydown-LEFT', () => nav(0, -1));
    kb.on('keydown-A', () => nav(0, -1));
    kb.on('keydown-RIGHT', () => nav(0, 1));
    kb.on('keydown-D', () => nav(0, 1));
    kb.on('keydown-ENTER', () => this.onEnter && this.onEnter());
    kb.once('keydown-ESC', () => (this.page === 'trade' ? this.scene.restart() : this.scene.start('Title')));
    if (!this.f) return this.pagePick();
    if (this.page === 'trade') return this.pageTrade();
    if (this.f.phase === 'offseason') return this.pageOffseason();
    this.pageHub();
  }

  T(x, y, s, o = {}) {
    return new PixelText(this, x, y, s, o);
  }

  pagePick() {
    const W = VIEW.W;
    const teams = modernTeams();
    let i = 0;
    drawPanel(this.g, 60, 40, W - 120, 170, 0xffe14d);
    this.T(W / 2, 50, 'FRANQUIA - ESCOLHA SEU TIME', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const name = this.T(W / 2, 100, '', { scale: 2, origin: [0.5, 0] });
    const info = this.T(W / 2, 124, '', { origin: [0.5, 0], color: 0xd8d0ee });
    this.T(W / 2, 170, 'VOCE E O ARMADOR E O DONO: ELENCO, TROCAS, DRAFT, SALARIOS', { origin: [0.5, 0], color: 0xb8b0d0 });
    this.T(W / 2, 190, 'ESQ/DIR ESCOLHE   ENTER COMECA   ESC TITULO', { origin: [0.5, 0], color: 0x6dff6d });
    const draw = () => {
      const t = teams[i];
      name.setText(`< ${t.name} >`).setColor(teamHudColor(t));
      info.setText(`${t.city.toUpperCase()} - ${t.style.toUpperCase()}`);
    };
    this.onNav = (dr, dv) => {
      i = (i + dv + teams.length) % teams.length;
      draw();
    };
    this.onEnter = () => {
      newFranchise(teams[i].id);
      sfx.play('play');
      this.scene.restart();
    };
    draw();
  }

  roster(x, y, f, hl = -1) {
    this.T(x, y, 'POS NOME               IDADE GERAL  $M', { color: 0x7a7290 });
    f.roster.forEach((p, k) => {
      const yy = y + 11 + k * 10 + (k >= 5 ? 4 : 0);
      this.T(x, yy, `${(k < 5 ? POS[k] : 'RES').padEnd(4)}${p.name.slice(0, 18).padEnd(19)}${String(p.age).padStart(3)}  ${String(bestRating(p)).padStart(4)}  ${String(p.salary).padStart(3)}`, {
        color: k === hl ? 0xffe14d : k === 0 ? 0x6fa0ff : 0xd8d0ee,
      });
    });
  }

  pageHub() {
    const f = this.f;
    const W = VIEW.W;
    const team = teamById(f.teamId);
    const s = f.season;
    drawPanel(this.g, 8, 8, W - 16, VIEW.H - 16, teamHudColor(team));
    this.T(16, 14, `${team.name.toUpperCase()} - ANO ${f.year}`, { scale: 2, color: teamHudColor(team) });
    this.T(W - 16, 18, `CAMPANHA ${s.wins}-${s.losses}  TITULOS ${f.titles}`, { origin: [1, 0], color: 0xffe14d });
    const po = f.phase === 'playoffs' ? f.playoffs : null;
    const next = teamById(nextOpponent(f)).name.toUpperCase();
    if (po) this.T(16, 34, `PLAYOFFS - ${PLAYOFF_ROUNDS[po.round]}: ${next}  (PERDEU, ESTA FORA)`, { color: 0xff9a4d });
    else this.T(16, 34, `FOLHA ${payroll(f)}M / TETO ${CAP}M  JOGO ${s.game + 1}/${s.schedule.length}: ${next}  (${PLAYOFF_WINS}+ V = PLAYOFFS)`, { color: 0xb8b0d0 });
    this.roster(16, 50, f);
    const items = [{ label: po ? 'JOGAR PLAYOFF' : 'JOGAR PROXIMO JOGO', color: 0x6dff6d }, { label: po ? 'SIMULAR PLAYOFF' : 'SIMULAR PROXIMO JOGO' }, { label: 'TROCAS' }, { label: 'ABANDONAR FRANQUIA', color: 0xff7b6b }];
    const m = makeMenu(this, items, 300, 170, { gap: 14, origin: 0 });
    if (this.msg) this.T(16, 230, this.msg, { color: 0xffe14d });
    (f.history || []).slice(-3).forEach((h, k) => this.T(16, 180 + k * 10, h, { color: 0x7a7290 }));
    this.onNav = (dr) => dr && m.set(m.index + dr);
    this.onEnter = () => {
      sfx.play('select');
      if (m.index === 0) {
        const base = this.registry.get('setup') || { build: 'chutador' };
        const setup = franchiseSetup(f, { build: base.build || 'chutador', diff: base.diff || 'normal', profile: base.profile || 'normal' });
        this.registry.set('setup', setup);
        return this.scene.start('Game', setup);
      }
      if (m.index === 1) {
        const win = simulateGame(f);
        return this.scene.restart({ msg: `Simulado: ${win ? 'VITORIA' : 'DERROTA'}` });
      }
      if (m.index === 2) return this.scene.restart({ page: 'trade' });
      clearFranchise();
      this.scene.start('Title');
    };
  }

  pageTrade() {
    const f = this.f;
    const W = VIEW.W;
    const others = modernTeams().filter((t) => t.id !== f.teamId);
    let out = 1;
    let ti = 0;
    let inI = 0;
    let row = 0; // 0 meu jogador, 1 time, 2 jogador deles, 3 propor
    drawPanel(this.g, 8, 8, W - 16, VIEW.H - 16, 0x6fa0ff);
    this.T(16, 14, 'TROCAS', { scale: 2, color: 0x6fa0ff });
    this.T(W - 16, 18, `FOLHA ${payroll(f)}M / TETO ${CAP}M`, { origin: [1, 0], color: 0xb8b0d0 });
    const lines = [0, 1, 2, 3].map((k) => this.T(24, 50 + k * 22, ''));
    const verdict = this.T(24, 150, '', {});
    const theirsT = [0, 1, 2, 3, 4].map((k) => this.T(260, 50 + k * 11, '', { color: 0xd8d0ee }));
    this.T(24, 232, 'CIMA/BAIXO LINHA  ESQ/DIR MUDA  ENTER PROPOR  ESC VOLTAR', { color: 0xb8b0d0 });
    const draw = () => {
      const t = others[ti];
      const theirs = leagueRoster(f, t.id);
      const mine = f.roster[out];
      const sel = (k) => (k === row ? '> ' : '  ');
      lines[0].setText(`${sel(0)}VOCE MANDA: < ${mine.name} > (${bestRating(mine)}, ${mine.age}a, ${mine.salary}M)`).setColor(row === 0 ? 0xffe14d : 0xd8d0ee);
      lines[1].setText(`${sel(1)}PARA: < ${t.name} >`).setColor(row === 1 ? 0xffe14d : teamHudColor(t));
      lines[2].setText(`${sel(2)}EM TROCA DE: < ${theirs[inI].name} > (${bestRating(theirs[inI])})`).setColor(row === 2 ? 0xffe14d : 0xd8d0ee);
      lines[3].setText(`${sel(3)}PROPOR TROCA`).setColor(row === 3 ? 0x6dff6d : 0xb8b0d0);
      theirs.forEach((p, k) => theirsT[k].setText(`${POS[k]} ${p.name.slice(0, 16)} ${bestRating(p)}`).setColor(k === inI ? 0xffe14d : 0xd8d0ee));
      const ev = evaluateTrade(f, out, t.id, inI);
      verdict.setText(`PREVISAO: ${ev.why}`).setColor(ev.ok ? 0x6dff6d : 0xff9a4d);
    };
    this.onNav = (dr, dv) => {
      if (dr) row = (row + dr + 4) % 4;
      if (dv) {
        if (row === 0) out = 1 + ((out - 1 + dv + 9) % 9); // seu armador (índice 0) não sai
        if (row === 1) {
          ti = (ti + dv + others.length) % others.length;
          inI = 0;
        }
        if (row === 2) inI = (inI + dv + 5) % 5;
      }
      draw();
    };
    this.onEnter = () => {
      if (row !== 3) return this.onNav(1, 0);
      const r = doTrade(f, out, others[ti].id, inI);
      sfx.play(r.ok ? 'play' : 'buzzer');
      this.scene.restart({ msg: r.ok ? `Troca feita: chegou ${r.incP.name}` : r.why });
    };
    draw();
  }

  pageOffseason() {
    const f = this.f;
    const W = VIEW.W;
    const ls = f.lastSeason || { wins: 0, losses: 0 };
    drawPanel(this.g, 8, 8, W - 16, VIEW.H - 16, 0xffe14d);
    this.T(16, 14, `ENTRESSAFRA - FIM DO ANO ${f.year}`, { scale: 2, color: 0xffe14d });
    this.T(16, 34, `CAMPANHA ${ls.wins}-${ls.losses}${ls.champ ? '  -  CAMPEOES!' : ls.note ? '  -  ' + ls.note.toUpperCase() : ''}`, { color: ls.champ ? 0x6dff6d : 0xd8d0ee });
    (f.news || []).slice(-3).forEach((n, k) => this.T(16, 46 + k * 10, n, { color: 0xff9a4d }));
    this.roster(16, 80, f);
    if (f.prospects) {
      this.T(300, 80, 'DRAFT - ESCOLHA 1:', { color: 0x6fa0ff });
      const items = f.prospects.map((p) => ({ label: `${p.name.slice(0, 15)} ${p.cm}cm ${bestRating(p)}` }));
      const m = makeMenu(this, items, 306, 94, { gap: 13, origin: 0 });
      this.T(300, 140, 'ELE ENTRA NO LUGAR DO', { color: 0x7a7290 });
      this.T(300, 150, 'RESERVA DE MENOR VALOR', { color: 0x7a7290 });
      this.onNav = (dr) => dr && m.set(m.index + dr);
      this.onEnter = () => {
        draftPick(f, m.index);
        sfx.play('play');
        this.scene.restart();
      };
    } else {
      this.T(300, 120, 'ENTER: NOVA TEMPORADA', { color: 0x6dff6d });
      this.onEnter = () => {
        startNextSeason(f);
        this.scene.restart();
      };
    }
    void valueOf;
  }
}
