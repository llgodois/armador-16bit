import Phaser from 'phaser';
import { VIEW } from '../config.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { login, isOnline, lastName, knownNames } from '../net/backend.js';

// =====================================================================
//  LOGIN (ao abrir o site): apelido + PIN de 4 números.
//  Teclado: digite. Controle: CIMA/BAIXO troca entre apelidos já usados
//  e muda os números do PIN; ESQ/DIR anda entre os números; A confirma.
//  "Jogar sem conta" entra como convidado (só as lendas gratuitas fora do Arcade).
// =====================================================================
export default class LoginScene extends Phaser.Scene {
  constructor() {
    super('Login');
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    sfx.music('menu');
    this.name = lastName() || '';
    this.pin = ['0', '0', '0', '0'];
    this.filled = [false, false, false, false]; // quais números do PIN já foram digitados
    this.pinTyped = 0;
    this.pinPos = 0;
    this.focus = this.name ? 1 : 0; // 0 nome, 1 pin, 2 entrar, 3 sem conta
    this.msg = isOnline() ? 'ONLINE: RANKING COMPARTILHADO' : 'OFFLINE: CONTA SALVA SO NESTE NAVEGADOR';
    this.msgColor = isOnline() ? 0x6dff6d : 0xff9a4d;
    this.busy = false;
    this.g = this.add.graphics();
    this.dyn = [];
    // teclado lido direto do navegador (o repasse do Phaser às vezes duplicava teclas no PIN)
    const onDown = (ev) => {
      if (!this.sys.isActive()) return;
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', ' '].includes(ev.key)) ev.preventDefault();
      this.onKey(ev);
    };
    window.addEventListener('keydown', onDown);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onDown));
    // mouse/toque: clique no apelido, em cada caixa do PIN ou nos botões
    this.input.on('pointerdown', (ptr) => this.onClick(ptr.x, ptr.y));
    this.draw();
  }

  onKey(ev, again = false) {
    if (this.busy) return;
    // o mesmo evento de tecla às vezes chega duas vezes: conta só uma
    if (!again) {
      if (ev === this.lastEv || (ev.timeStamp && ev.timeStamp === this.lastTs && ev.key === this.lastKey)) return;
      this.lastEv = ev;
      this.lastTs = ev.timeStamp;
      this.lastKey = ev.key;
    }
    const k = ev.key;
    if (k === 'ArrowDown' && this.focus !== 1) this.focus = (this.focus + 1) % 4;
    else if (k === 'ArrowUp' && this.focus !== 1 && this.focus !== 0) this.focus = (this.focus + 3) % 4;
    else if (k === 'Tab') this.focus = (this.focus + 1) % 4;
    else if (this.focus === 0) {
      const names = knownNames();
      // apelido + ENTER já leva para o PIN; números depois de um apelido pronto também
      if (/^\d$/.test(k)) {
        // número no apelido = começou o PIN: pula para as caixas do PIN
        if (this.name.length < 2) {
          this.msg = 'PRIMEIRO O APELIDO (SO LETRAS)';
          this.msgColor = 0xff9a4d;
          return this.draw();
        }
        this.focus = 1;
        return this.onKey(ev, true);
      }
      if ((k === 'ArrowUp' || k === 'ArrowDown') && names.length) {
        const i = names.indexOf(this.name);
        this.name = names[(i + (k === 'ArrowDown' ? 1 : -1) + names.length) % names.length];
      } else if (k === 'ArrowUp') this.focus = 3;
      else if (k === 'Backspace') this.name = this.name.slice(0, -1);
      else if (/^[a-zA-Z]$/.test(k) && this.name.length < 12) this.name += k.toUpperCase();
      else if (k === 'Enter') this.focus = 1;
      else if (k === 'Escape') this.name = '';
    } else if (this.focus === 1) {
      if (/^\d$/.test(k)) {
        this.pin[this.pinPos] = k;
        this.filled[this.pinPos] = true;
        this.pinTyped++;
        // completou os 4: vai para ENTRAR (ENTER confirma)
        if (this.filled.every(Boolean) && this.pinPos === 3) this.focus = 2;
        else this.pinPos = Math.min(3, this.pinPos + 1);
      } else if (k === 'Backspace') {
        if (!this.filled[this.pinPos] && this.pinPos > 0) this.pinPos--;
        this.filled[this.pinPos] = false;
        this.pin[this.pinPos] = '0';
      }
      else if (k === 'ArrowLeft') this.pinPos = Math.max(0, this.pinPos - 1);
      else if (k === 'ArrowRight') this.pinPos = Math.min(3, this.pinPos + 1);
      else if (k === 'ArrowUp' || k === 'ArrowDown') {
        if (k === 'ArrowUp' && this.pinPos === 0 && this.pinTyped === 0) this.focus = 0;
        else {
          const d = (Number(this.pin[this.pinPos]) + (k === 'ArrowUp' ? 1 : 9)) % 10;
          this.pin[this.pinPos] = String(d);
          this.filled[this.pinPos] = true;
          this.pinTyped++;
        }
      } else if (k === 'Enter') return this.submit();
      else if (k === 'Escape') this.focus = 0;
    } else if (k === 'Enter') {
      if (this.focus === 2) return this.submit();
      return this.enter(null);
    }
    sfx.play('select');
    this.draw();
  }

  // regiões clicáveis (coordenadas da tela do jogo)
  onClick(x, y) {
    if (this.busy) return;
    const W = VIEW.W;
    if (x < W / 2 - 130 || x > W / 2 + 130) return;
    if (y >= 84 && y < 108) this.focus = 0;
    else if (y >= 112 && y < 136) {
      this.focus = 1;
      const i = Math.floor((x - (W / 2 - 42)) / 18);
      if (i >= 0 && i < 4) this.pinPos = i;
    } else if (y >= 142 && y < 166) return this.submit();
    else if (y >= 168 && y < 192) return this.enter(null);
    else return;
    sfx.play('select');
    this.draw();
  }

  async submit() {
    if (!this.filled.every(Boolean)) {
      this.msg = 'DIGITE OS 4 NUMEROS DO PIN';
      this.msgColor = 0xff9a4d;
      this.focus = 1;
      this.pinPos = this.filled.indexOf(false);
      return this.draw();
    }
    sfx.unlock();
    this.busy = true;
    this.msg = 'ENTRANDO...';
    this.msgColor = 0xb8b0d0;
    this.draw();
    const r = await login(this.name, this.pin.join(''));
    this.busy = false;
    if (!r.ok) {
      this.msg = r.error;
      this.msgColor = 0xff7b6b;
      sfx.play('buzzer');
      return this.draw();
    }
    sfx.play('play');
    this.enter(r.profile, r.created);
  }

  enter(profile, created = false) {
    this.registry.set('profile', profile);
    this.registry.set('profileNew', created);
    this.scene.start('Title');
  }

  draw() {
    this.dyn.forEach((o) => o.destroy());
    this.dyn = [];
    const g = this.g;
    g.clear();
    const W = VIEW.W;
    const T = (x, y, s, o = {}) => this.dyn.push(new PixelText(this, x, y, s, o));
    T(W / 2 + 2, 22, 'ARMADOR', { scale: 4, origin: [0.5, 0], color: 0xffe14d, shadow: 0xa3231c });
    T(W / 2, 60, 'QUEM VAI JOGAR?', { origin: [0.5, 0], color: 0x6fa0ff });
    drawPanel(g, W / 2 - 130, 76, 260, 150, 0xffe14d);
    const row = (i, y) => {
      if (this.focus === i) g.fillStyle(0xffe14d, 0.18).fillRect(W / 2 - 122, y - 4, 244, 22);
    };
    row(0, 88);
    T(W / 2 - 114, 92, 'APELIDO', { color: this.focus === 0 ? 0xffe14d : 0x7a7290 });
    const cursor = this.focus === 0 && Math.floor(this.time.now / 400) % 2 === 0 ? '_' : '';
    T(W / 2 - 40, 90, (this.name || (this.focus === 0 ? '' : '---')) + cursor, { scale: 1, color: 0xffffff });
    row(1, 116);
    T(W / 2 - 114, 120, 'PIN', { color: this.focus === 1 ? 0xffe14d : 0x7a7290 });
    this.pin.forEach((d, i) => {
      const x = W / 2 - 40 + i * 18;
      const cur = this.focus === 1 && this.pinPos === i;
      g.fillStyle(cur ? 0xffe14d : this.filled[i] ? 0x6fa0ff : 0x3a3352, 1).fillRect(x - 2, 116, 13, 14);
      // digitado = *, vazio = _, na caixa atual mostra o número
      const ch = cur && this.filled[i] ? d : this.filled[i] ? '*' : '_';
      T(x + 4, 119, ch, { origin: [0.5, 0], color: cur ? 0x0b0b14 : 0xffffff });
    });
    if (this.focus === 0) T(W / 2 + 122, 92, 'ENTER: PIN', { origin: [1, 0], color: 0x7a7290 });
    if (this.focus === 1) T(W / 2 + 122, 120, `${this.filled.filter(Boolean).length}/4`, { origin: [1, 0], color: 0x7a7290 });
    row(2, 146);
    T(W / 2, 150, 'ENTRAR / CRIAR CONTA', { origin: [0.5, 0], color: this.focus === 2 ? 0x6dff6d : 0xd8d0ee });
    row(3, 172);
    T(W / 2, 176, 'JOGAR SEM CONTA', { origin: [0.5, 0], color: this.focus === 3 ? 0xffe14d : 0x9a92b0 });
    T(W / 2, 204, this.msg, { origin: [0.5, 0], color: this.msgColor });
    T(W / 2, 236, 'DIGITE O APELIDO E O PIN  -  TAB/SETAS MUDAM DE CAMPO  -  ENTER CONFIRMA', { origin: [0.5, 0], color: 0x7a7290 });
    T(W / 2, 248, 'CONTROLE: CIMA/BAIXO APELIDOS E NUMEROS  -  ESQ/DIR NUMERO  -  A CONFIRMA', { origin: [0.5, 0], color: 0x7a7290 });
    T(W / 2, 214, 'NOME NOVO = CONTA NOVA COM ESSE PIN', { origin: [0.5, 0], color: 0x5a5270 });
  }
}
