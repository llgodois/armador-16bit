import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { teamById, teamHudColor, fmtHeight } from '../data/teams.js';
import { schemeById } from '../data/defense.js';
import { load, clear, opponentOf, userSeries, scoutOf, ROUND_NAMES } from '../data/championship.js';
import { playerTexKey } from '../art/sprites.js';
import { addPlayerArt } from '../ui/portrait.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

// Chave do campeonato + scout do próximo adversário.
export default class ChampionshipScene extends Phaser.Scene {
  constructor() {
    super('Championship');
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    const champ = load();
    if (!champ) return this.scene.start('Title');
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 6) g.fillStyle([0x2b1f15, 0x261b13, 0x2f2217][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    g.fillStyle(0x0b0b14, 0.65).fillRect(0, 0, W, VIEW.H);
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    const me = champ.setup.home;
    T(W / 2, 4, 'CAMPEONATO', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    T(W / 2, 22, champ.champion ? 'TEMPORADA ENCERRADA' : `${ROUND_NAMES[champ.round].toUpperCase()}  -  ${champ.bestOf === 1 ? 'JOGO UNICO' : 'MELHOR DE 3'}`, { origin: [0.5, 0], color: 0xb8b0d0 });

    // ---- chave: colunas Leste | Finais | Oeste
    const box = (x, y, s, w = 132) => {
      const done = !!s.winner;
      drawPanel(g, x, y, w, 26, s.a === me || s.b === me ? 0xffe14d : 0x3a3352, 0.9);
      [s.a, s.b].forEach((id, k) => {
        const t = teamById(id);
        const win = s.winner === id;
        T(x + 6, y + 5 + k * 9, t.name, { color: done && !win ? 0x5a5470 : teamHudColor(t) });
        T(x + w - 6, y + 5 + k * 9, String(k === 0 ? s.winsA : s.winsB), { origin: [1, 0], color: win ? 0x6dff6d : 0xd8d0ee });
      });
    };
    const col = { E: 8, W: W - 140 };
    T(col.E + 66, 36, 'LESTE', { origin: [0.5, 0], color: 0x6fa0ff });
    T(col.W + 66, 36, 'OESTE', { origin: [0.5, 0], color: 0xff9a4d });
    champ.rounds.forEach((round, r) => {
      for (const s of round) {
        if (s.conf === 'F') box(W / 2 - 66, 76, s);
        else {
          const list = round.filter((x) => x.conf === s.conf);
          const i = list.indexOf(s);
          const y = r === 0 ? 48 + i * 34 : 118;
          box(col[s.conf], y, s);
        }
      }
    });
    if (champ.round < 2) T(W / 2, 84, 'FINAIS', { origin: [0.5, 0], color: 0x7a7290 });

    // ---- rodapé: resultado ou scout
    drawPanel(g, 8, 152, W - 16, 96, 0xffe14d);
    if (champ.champion || champ.eliminated) {
      const won = champ.champion === me;
      const ct = teamById(champ.champion);
      T(W / 2, 164, won ? 'CAMPEAO!' : 'ELIMINADO', { scale: 3, origin: [0.5, 0], color: won ? 0x6dff6d : 0xff7b6b });
      T(W / 2, 196, `Campeao: ${ct.name} (${ct.city})`, { origin: [0.5, 0], color: teamHudColor(ct) });
      T(W / 2, 228, 'ENTER: VOLTAR AO TITULO', { origin: [0.5, 0], color: 0xb8b0d0 });
      this.input.keyboard.once('keydown-ENTER', () => {
        clear();
        this.scene.start('Title');
      });
    } else {
      const oppId = opponentOf(champ);
      const opp = teamById(oppId);
      const s = userSeries(champ);
      const sc = scoutOf(opp);
      const gameN = s.winsA + s.winsB + 1;
      T(16, 158, `SCOUT: ${opp.name.toUpperCase()}  (GERAL ${sc.overall})`, { color: teamHudColor(opp) });
      T(W - 16, 158, `JOGO ${gameN}`, { origin: [1, 0], color: 0xffe14d });
      const si = opp.players.indexOf(sc.star);
      const spr = addPlayerArt(this, 36, 230, playerTexKey(opp.id, si), 2, { info: sc.star, colors: opp.colors, index: si });
      void spr;
      const lines = [
        `CRAQUE: ${sc.star.name} "${sc.star.nick}" ${fmtHeight(sc.star.cm)}`,
        `MELHOR DEFENSOR: ${sc.defender.name} (DEF ${sc.defender.r.def})`,
        `MELHOR ATIRADOR: ${sc.shooter.name} (3PT ${sc.shooter.r.three})`,
        `DEFESA FAVORITA: ${schemeById(sc.fav).name.toUpperCase()}`,
        `ESTILO: ${opp.style.toUpperCase()}`,
      ];
      lines.forEach((l, i) => T(64, 172 + i * 11, l, { color: i === 3 ? 0xff9a4d : 0xd8d0ee }));
      T(W / 2, 236, 'ENTER: JOGAR    ESC: TITULO (O CAMPEONATO FICA SALVO)', { origin: [0.5, 0], color: 0x6dff6d });
      this.input.keyboard.once('keydown-ENTER', () => {
        sfx.play('select');
        this.scene.start('Game', { ...champ.setup, away: oppId, champ: true, oppFav: sc.fav });
      });
    }
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('Title'));
  }
}
