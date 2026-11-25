// =====================================================================
//  PONTE DO CONTROLE PARA OS MENUS
//  Fora da partida (título, seleção, campeonato, carreira, franquia, treino,
//  fim de jogo, pausa/playbook...) o controle vira "teclado": todas as telas
//  funcionam sem mexer em cada uma.
//    Analógico/direcional -> setas (com repetição)   A -> ENTER   B -> ESC
//    Y -> V (atual/histórico)   X -> M (som)   LB/RB -> ESQ/DIR (páginas)
//    START -> ENTER (ESC na pausa)   SELECT/VIEW -> TAB (playbook na pausa)
//  Durante a partida a GameScene lê o controle direto (esquema estilo 2K).
// =====================================================================
const KEYS = {
  UP: ['ArrowUp', 38], DOWN: ['ArrowDown', 40], LEFT: ['ArrowLeft', 37], RIGHT: ['ArrowRight', 39],
  ENTER: ['Enter', 13], ESC: ['Escape', 27], V: ['v', 86], M: ['m', 77], TAB: ['Tab', 9],
};
const send = (name, type) => {
  const [key, keyCode] = KEYS[name];
  window.dispatchEvent(new KeyboardEvent(type, { key, keyCode, which: keyCode, bubbles: true, cancelable: true }));
};

export function installPadBridge(game) {
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
  const stale = {};
  game.events.on('step', () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads[0];
    if (!pad) return;
    const sm = game.scene;
    // na partida (rodando) quem lê o controle é a GameScene
    const inMatch = sm.isActive('Game') && !sm.isPaused('Game');
    const raw = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    // botão que já estava apertado quando a tela mudou (ex.: START que abriu a pausa) só vale depois de soltar
    if (inMatch !== wasMatch) for (let i = 0; i < pad.buttons.length; i++) stale[i] = raw(i);
    wasMatch = inMatch;
    for (let i = 0; i < pad.buttons.length; i++) if (!raw(i)) stale[i] = false;
    const b = (i) => raw(i) && !stale[i];
    if (inMatch) {
      for (const k of Object.keys(held)) if (held[k]) press(k, false, dt);
      return;
    }
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    press('UP', b(12) || ay < -0.55, dt, true);
    press('DOWN', b(13) || ay > 0.55, dt, true);
    press('LEFT', b(14) || b(4) || ax < -0.55, dt, true);
    press('RIGHT', b(15) || b(5) || ax > 0.55, dt, true);
    const paused = sm.isActive('Menu');
    press('ENTER', b(0) || (!paused && b(9)), dt);
    press('ESC', b(1) || (paused && b(9)), dt);
    press('V', b(3), dt);
    press('M', b(2), dt);
    press('TAB', b(8), dt);
  });
}
