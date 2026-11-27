// Login com CONTROLE (só no 64). A tela de login usa campos e botões do navegador; a ponte do
// controle só "aperta teclas" para o jogo, que não chegam a eles — com o controle a tela parecia
// travada. Aqui: cima/baixo (direcional ou analógico) troca entre APELIDO, PIN, ENTRAR e JOGAR SEM
// CONTA; A aperta o botão (num campo, vai para o próximo); B vai direto para JOGAR SEM CONTA.
export function installLoginPad(game) {
  const prev = {};
  let repeatAt = 0;
  game.events.on('step', () => {
    const ov = document.getElementById('login-ov');
    if (!ov) return;
    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!pad) return;
    const items = ['#lg-name', '#lg-pin', '#lg-go', '#lg-guest'].map((s) => ov.querySelector(s)).filter(Boolean);
    const cur = items.indexOf(document.activeElement);
    const down = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const ay = pad.axes[1] || 0;
    const now = performance.now();
    const btn = { up: down(12) || ay < -0.6, dn: down(13) || ay > 0.6, a: down(0), b: down(1) };
    const hit = (k) => btn[k] && !prev[k];
    const held = (k) => btn[k] && now > repeatAt;
    const move = (d) => {
      const i = cur < 0 ? (d > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, cur + d));
      items[i].focus();
      repeatAt = now + 260;
    };
    if (hit('up') || (held('up') && prev.up)) move(-1);
    else if (hit('dn') || (held('dn') && prev.dn)) move(1);
    if (hit('a')) {
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON') el.click();
      else move(1);
    }
    if (hit('b')) items[items.length - 1].focus();
    Object.assign(prev, btn);
  });
}
