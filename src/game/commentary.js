// =====================================================================
//  NARRAÇÃO EM TEXTO + reação da torcida. A GameScene chama say(tipo, vars)
//  e o HUD mostra a frase numa faixa (evento 'narrate').
// =====================================================================
import { sfx } from '../audio/sfx.js';

const LINES = {
  three: ['DE TRES!', 'CHUVA DE 3!', 'NA REDINHA!', 'BANG!'],
  dunk: ['ENTERROU!', 'QUE ENTERRADA!', 'POSTER!'],
  layup: ['BANDEJA LIMPA', 'DEIXOU NA CESTA', 'NO GARRAFAO!'],
  jump: ['CAIU!', 'ARREMESSO CERTEIRO', 'TRABALHO DE MEIA DISTANCIA'],
  assist: ['QUE PASSE!', 'ASSISTENCIA DE CRAQUE!', 'BOLA NA MAO CERTA!'],
  steal: ['ROUBOU!', 'LADRAO!', 'MAO RAPIDA!'],
  block: ['TOCO!', 'NAO PASSA NADA!', 'MANDOU PRA ARQUIBANCADA!'],
  ankle: ['QUEBROU O TORNOZELO!', 'FICOU NO CHAO!'],
  run: ['PARCIAL DE {n} A 0 DO {team}!', '{team} DISPAROU: {n} A 0!'],
  fire: ['{name} ESTA EM CHAMAS!', 'NINGUEM PARA O {name}!'],
  clutch: ['JOGO PEGADO NO FINAL!', 'A TORCIDA ESTA DE PE!'],
  buzzer: ['NO ESTOURO DO CRONOMETRO!', 'BUZZER BEATER!'],
  heave: ['DO MEIO DA QUADRA!!!', 'INACREDITAVEL!'],
  alley: ['PONTE AEREA!', 'ALLEY-OOP!'],
  streak3: ['{name}: {n} DE 3 SEGUIDAS!', '{name} NAO ERRA: {n} SEGUIDAS DE 3!'],
  green: ['VERDE! NEM PRECISAVA OLHAR!', 'SOLTOU NO TEMPO PERFEITO!', 'MEDIDOR VERDINHO!'],
  spin: ['GIROU E FOI!', 'QUE GIRO!'],
  hesi: ['CONGELOU NA HESITACAO!', 'PAROU E EXPLODIU!'],
  euro: ['EURO STEP!', 'DESVIOU DO CONTATO!'],
  reverse: ['REVERSA LINDA!', 'DO OUTRO LADO DO ARO!'],
  hop: ['HOP STEP COM FORCA!'],
  charge: ['FALTA DE ATAQUE! FICOU PLANTADO!', 'CAVOU A FALTA!'],
  fake: ['MORDEU A FINTA!', 'ENGANOU A DEFESA!'],
  screen: ['BLOQUEIO PERFEITO!', 'PAREDE!'],
  badge: ['INSIGNIAS NO NIVEL {lvl}!', '{lvl}! O ARMADOR ESQUENTOU!'],
  life: ['PERDEU UMA VIDA!', 'POSSE DESPERDICADA!'],
};
// tipos que fazem a torcida vibrar mais
const LOUD = new Set(['dunk', 'block', 'ankle', 'buzzer', 'heave', 'alley', 'run', 'clutch', 'fire', 'green', 'charge', 'spin', 'badge']);

export default class Commentary {
  constructor(game) {
    this.game = game;
    this.lastAt = 0;
    this.run = { team: null, pts: 0, said: 0 };
    this.clutchSaid = 0;
  }

  say(kind, vars = {}, force = false) {
    const now = this.game.time.now;
    if (!force && now - this.lastAt < 900) return; // não atropela
    const opts = LINES[kind];
    if (!opts) return;
    let s = opts[Math.floor(Math.random() * opts.length)];
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v).toUpperCase());
    this.lastAt = now;
    this.game.events.emit('narrate', s);
    if (LOUD.has(kind) && vars.home !== false) sfx.play('cheer');
  }

  // Parciais ("8 a 0") e final apertado.
  onPoints(team, pts, teamName) {
    const g = this.game;
    if (this.run.team === team) this.run.pts += pts;
    else this.run = { team, pts, said: 0 };
    if (this.run.pts >= 6 && this.run.pts - this.run.said >= 4) {
      this.run.said = this.run.pts;
      this.say('run', { n: this.run.pts, team: teamName }, true);
    }
    const target = g.mode === 'pontos' ? 21 : 999;
    const top = Math.max(g.score.home, g.score.away);
    const late = g.mode === 'tempo' ? g.gameClock < 60 : top >= target - 5;
    if (late && Math.abs(g.score.home - g.score.away) <= 2 && g.time.now - this.clutchSaid > 15000) {
      this.clutchSaid = g.time.now;
      this.say('clutch', {}, true);
    }
  }
}
