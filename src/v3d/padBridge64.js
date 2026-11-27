// =====================================================================
//  PONTE DO CONTROLE PARA OS MENUS — versão do 64 (mais tolerante a controle com folga)
//  Igual à do 16-bit (analógico/direcional -> setas, A -> ENTER, B -> ESC, Y -> V, X -> M,
//  LB/RB -> ESQ/DIR, START -> ENTER/ESC, VIEW -> TAB), mais:
//   - o analógico tem a posição de REPOUSO aprendida (controle que fica "puxando" para um lado
//     prendia o cursor no topo do menu) e uma folga maior;
//   - com LT/RT apertado o analógico é ignorado nos menus (alguns controles mexem o analógico
//     quando o gatilho é apertado);
//   - botão que já estava apertado ao conectar, ou que fica apertado sem soltar por 3 s, é
//     considerado preso e ignorado até ser solto (um B "preso" fazia toda tela voltar na hora).
//  Durante a partida a GameScene lê o controle direto.
// =====================================================================
const KEYS = {
  UP: ['ArrowUp', 38], DOWN: ['ArrowDown', 40], LEFT: ['ArrowLeft', 37], RIGHT: ['ArrowRight', 39],
  ENTER: ['Enter', 13], ESC: ['Escape', 27], V: ['v', 86], M: ['m', 77], TAB: ['Tab', 9],
};
const send = (name, type) => {
  const [key, keyCode] = KEYS[name];
  window.dispatchEvent(new KeyboardEvent(type, { key, keyCode, which: keyCode, bubbles: true, cancelable: true }));
};

export function installPadBridge64(game) {
  const held = {};
  const rep = {};
  const press = (name, on, dt, repeat = false) => {
    if (on && !held[name]) {
      held[name] = true;
      rep[name] = 0.38;
      send(name, 'keydown');
    } else if (on && repeat) {
      rep[name] -= dt;
      if (rep[name] <= 0) {
        rep[name] = 0.11;
        send(name, 'keydown');
      }
    } else if (!on && held[name]) {
      held[name] = false;
      send(name, 'keyup');
    }
  };
  let last = performance.now();
  let wasMatch = false;
  let padId = null;
  const stale = {};
  const downSince = {};
  const rest = [0, 0];
  game.events.on('step', () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads[0];
    if (!pad) return;
    const raw = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    // controle novo: o que já está apertado agora é "preso" até soltar; o analógico parado vira o repouso
    if (pad.id !== padId) {
      padId = pad.id;
      for (let i = 0; i < pad.buttons.length; i++) stale[i] = raw(i);
      rest[0] = Math.abs(pad.axes[0] || 0) < 0.6 ? pad.axes[0] || 0 : 0;
      rest[1] = Math.abs(pad.axes[1] || 0) < 0.6 ? pad.axes[1] || 0 : 0;
    }
    const sm = game.scene;
    const inMatch = sm.isActive('Game') && !sm.isPaused('Game');
    if (inMatch !== wasMatch) for (let i = 0; i < pad.buttons.length; i++) stale[i] = raw(i);
    wasMatch = inMatch;
    for (let i = 0; i < pad.buttons.length; i++) {
      if (!raw(i)) {
        stale[i] = false;
        downSince[i] = 0;
      } else if (!downSince[i]) downSince[i] = now;
      else if (now - downSince[i] > 3000 && i !== 12 && i !== 13 && i !== 14 && i !== 15) stale[i] = true; // preso
    }
    const b = (i) => raw(i) && !stale[i];
    if (inMatch) {
      for (const k of Object.keys(held)) if (held[k]) press(k, false, dt);
      return;
    }
    // analógico relativo ao repouso; o repouso acompanha devagar uma folga pequena
    const trig = Math.max(pad.buttons[6] ? pad.buttons[6].value || 0 : 0, pad.buttons[7] ? pad.buttons[7].value || 0 : 0);
    let ax = (pad.axes[0] || 0) - rest[0];
    let ay = (pad.axes[1] || 0) - rest[1];
    if (trig < 0.1) {
      if (Math.abs(ax) < 0.3) rest[0] += ((pad.axes[0] || 0) - rest[0]) * 0.02;
      if (Math.abs(ay) < 0.3) rest[1] += ((pad.axes[1] || 0) - rest[1]) * 0.02;
    } else {
      ax = 0; // gatilho apertado: o analógico desse controle não vale nos menus
      ay = 0;
    }
    const T = 0.65;
    press('UP', b(12) || ay < -T, dt, true);
    press('DOWN', b(13) || ay > T, dt, true);
    press('LEFT', b(14) || b(4) || ax < -T, dt, true);
    press('RIGHT', b(15) || b(5) || ax > T, dt, true);
    const paused = sm.isActive('Menu');
    press('ENTER', b(0) || (!paused && b(9)), dt);
    press('ESC', b(1) || (paused && b(9)), dt);
    press('V', b(3), dt);
    press('M', b(2), dt);
    press('TAB', b(8), dt);
  });
}

// Mostra na tela qualquer erro do jogo (para um print), em vez de só "travar" em silêncio.
export function installErrorBox() {
  let box = null;
  const show = (msg) => {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText =
        'position:fixed;left:8px;bottom:8px;right:8px;z-index:99;padding:8px 10px;background:rgba(120,10,20,.92);color:#fff;' +
        "font:600 13px/1.35 'Barlow Condensed',sans-serif;letter-spacing:.5px;border-radius:6px;white-space:pre-wrap;pointer-events:none";
      document.body.appendChild(box);
    }
    box.textContent = `ERRO NO JOGO (manda um print): ${msg}`.slice(0, 600);
  };
  window.addEventListener('error', (e) => show(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => show(String(e.reason && (e.reason.stack || e.reason.message || e.reason)).split('\n').slice(0, 3).join(' | ')));
}
