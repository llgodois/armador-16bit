// Tela "TESTAR CONTROLE" (só no 64, no pause): mostra ao vivo o que o jogo recebe do controle —
// botões, eixos e como o jogo interpreta (analógicos, LT). Serve para achar controle/navegador que
// entrega o LT como eixo, analógico com folga etc. Sai com START (ou segurando B por 1 s).
import { VIEW } from '../config.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { rightStick64, deghostPad64 } from '../game/mech64.js';

const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'START', 'L3', 'R3', 'CIMA', 'BAIXO', 'ESQ', 'DIR', 'GUIA'];

export function buildPadTest(scene) {
  drawPanel(scene.g, 14, 10, VIEW.W - 28, VIEW.H - 20, 0x3ad6ff);
  new PixelText(scene, VIEW.W / 2, 16, 'TESTAR CONTROLE', { scale: 2, origin: [0.5, 0], color: 0x3ad6ff });
  const lines = Array.from({ length: 11 }, (_, i) => new PixelText(scene, 26, 44 + i * 14, '', { color: i === 0 ? 0xffe14d : 0xd8d0ee }));
  new PixelText(scene, VIEW.W / 2, VIEW.H - 22, 'CALIBRAR: APERTE O LT 3 VEZES COM OS ANALOGICOS SOLTOS   ·   START (OU SEGURE B) SAI', { origin: [0.5, 0], color: 0xb8b0d0 });
  scene.padTestLock = true; // B/START do controle chegam como ESC: aqui quem decide sair é a tela
  const gs = scene.gs;
  let bHeld = 0;
  let startWas = true;
  let startArmed = false;
  scene.events.on('update', (_t, dtMs) => {
    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!pad) {
      scene.padTestLock = false;
      lines[0].setText('NENHUM CONTROLE ENCONTRADO - APERTE UM BOTAO DO CONTROLE');
      for (let i = 1; i < lines.length; i++) lines[i].setText(i === 1 ? '(ESC volta)' : '');
      return;
    }
    scene.padTestLock = true;
    const b = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
    const pressed = pad.buttons.map((_, i) => (b(i) > 0.05 ? `${NAMES[i] || 'b' + i}(${i})${b(i) < 0.99 ? ' ' + b(i).toFixed(2) : ''}` : null)).filter(Boolean);
    const axes = [...pad.axes].map((a, i) => `${i}:${a >= 0 ? '+' : ''}${a.toFixed(2)}`);
    const f = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
    const cp = deghostPad64(gs, pad); // o mesmo filtro do jogo (desconta o analógico que o LT/RT mexe)
    const [rx, ry] = rightStick64(gs, cp);
    const lx = cp.axes[0] || 0;
    const ly = cp.axes[1] || 0;
    const gh = gs.ghost64 && gs.ghost64.trig[6] ? gs.ghost64.trig[6].ghost : null;
    const ghs = gh ? gh.map(([x, y]) => `${f(x)},${f(y)}`).join('  /  ') : '-';
    const trig = gs.padAxes64 && gs.padAxes64.trig && gs.padAxes64.trig.size ? [...gs.padAxes64.trig].join(', ') : 'nenhum';
    const txt = [
      `CONTROLE: ${String(pad.id).slice(0, 60)}`,
      `MAPEAMENTO: ${pad.mapping || '(nao padrao)'}   ·   ${pad.buttons.length} botoes, ${pad.axes.length} eixos`,
      `BOTOES APERTADOS: ${pressed.join('  ') || '-'}`,
      `EIXOS: ${axes.slice(0, 4).join('   ')}`,
      `       ${axes.slice(4).join('   ')}`,
      '',
      `O JOGO ENTENDE (ja descontando o LT/RT):`,
      `  ANALOGICO ESQUERDO  x ${f(lx)}  y ${f(ly)}  ${Math.hypot(lx, ly) > 0.25 ? '<< ANDANDO' : '(parado)'}`,
      `  ANALOGICO DIREITO   x ${f(rx)}  y ${f(ry)}  ${Math.hypot(rx, ry) > 0.75 ? '<< DRIBLE/ARREMESSO' : '(parado)'}`,
      `  LT ${b(6) > 0.3 ? 'APERTADO (proteger / defesa intensa)' : 'solto'}   ·   RT ${b(7) > 0.3 ? 'APERTADO (sprint)' : 'solto'}`,
      `  LT mexe o analogico (E / D): ${ghs}   ·   eixos-gatilho: ${trig}`,
    ];
    txt.forEach((s, i) => lines[i].setText(s));
    // sair: START (ao SOLTAR um aperto feito aqui) ou B segurado 1 s
    const start = b(9) > 0.5;
    if (start && !startWas) startArmed = true;
    if (!start && startArmed) return scene.closePadTest();
    startWas = start;
    bHeld = b(1) > 0.5 ? bHeld + dtMs : 0;
    if (bHeld > 1000) scene.closePadTest();
  });
  scene.closePadTest = () => {
    scene.padTestLock = false;
    scene.scene.restart({ game: gs, mode: 'pause' });
  };
}
