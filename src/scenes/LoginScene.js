import Phaser from 'phaser';
import { VIEW } from '../config.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { login, isOnline, lastName } from '../net/backend.js';

// =====================================================================
//  LOGIN (ao abrir o site): apelido + PIN de 4 números.
//  Usa CAMPOS DE TEXTO DE VERDADE do navegador (por cima do jogo): digitar
//  funciona como em qualquer site — o PIN avança sozinho a cada número.
//  "Jogar sem conta" entra como convidado.
// =====================================================================
const CSS = `
#login-ov{position:fixed;z-index:20;display:flex;flex-direction:column;align-items:center;gap:10px;
  font-family:'Courier New',monospace;font-weight:bold;color:#d8d0ee;transform-origin:top left}
#login-ov label{display:flex;align-items:center;gap:12px;font-size:15px;letter-spacing:2px}
#login-ov label span{width:90px;text-align:right;color:#ffe14d}
#login-ov input{width:180px;padding:6px 8px;font:inherit;font-size:20px;letter-spacing:4px;text-transform:uppercase;
  background:#1d1a2b;color:#fff;border:2px solid #3a3352;border-radius:0;outline:none}
#login-ov input:focus{border-color:#ffe14d;background:#2a2440}
#login-ov input.pin{width:110px;letter-spacing:12px;text-align:center}
#login-ov button{width:300px;padding:7px;font:inherit;font-size:15px;letter-spacing:2px;cursor:pointer;
  background:#1d1a2b;color:#d8d0ee;border:2px solid #3a3352;border-radius:0}
#login-ov button:hover,#login-ov button:focus{border-color:#ffe14d;color:#ffe14d;outline:none}
#login-ov button.main{color:#6dff6d;border-color:#2e8b3a}
#login-ov .msg{min-height:18px;font-size:13px;letter-spacing:1px}
`;

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super('Login');
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    sfx.music('menu');
    // o Phaser não pode "engolir" Tab/espaço/setas enquanto digitamos nos campos
    this.input.keyboard.disableGlobalCapture();
    this.input.keyboard.enabled = false;

    const g = this.add.graphics();
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    T(W / 2 + 2, 14, 'ARMADOR', { scale: 4, origin: [0.5, 0], color: 0xffe14d, shadow: 0xa3231c });
    T(W / 2, 50, 'QUEM VAI JOGAR?', { origin: [0.5, 0], color: 0x6fa0ff });
    drawPanel(g, W / 2 - 150, 62, 300, 178, 0xffe14d);
    T(W / 2, 246, 'APELIDO SO COM LETRAS  -  PIN COM 4 NUMEROS  -  NOME NOVO = CONTA NOVA', { origin: [0.5, 0], color: 0x7a7290 });

    this.buildOverlay();
    this.events.once('shutdown', () => this.destroyOverlay());
  }

  buildOverlay() {
    if (!document.getElementById('login-css')) {
      const st = document.createElement('style');
      st.id = 'login-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const ov = document.createElement('div');
    ov.id = 'login-ov';
    ov.innerHTML = `
      <label><span>APELIDO</span><input id="lg-name" maxlength="12" autocomplete="username" spellcheck="false"></label>
      <label><span>PIN</span><input id="lg-pin" class="pin" maxlength="4" inputmode="numeric" type="password" autocomplete="current-password"></label>
      <button id="lg-go" class="main">ENTRAR / CRIAR CONTA</button>
      <button id="lg-guest">JOGAR SEM CONTA</button>
      <div class="msg" id="lg-msg"></div>`;
    document.body.appendChild(ov);
    this.ov = ov;
    const name = ov.querySelector('#lg-name');
    const pin = ov.querySelector('#lg-pin');
    const msg = ov.querySelector('#lg-msg');
    this.setMsg = (t, c) => {
      msg.textContent = t;
      msg.style.color = c;
    };
    this.setMsg(isOnline() ? 'ONLINE: RANKING COMPARTILHADO' : 'OFFLINE: CONTA SALVA SO NESTE NAVEGADOR', isOnline() ? '#6dff6d' : '#ff9a4d');
    name.value = lastName() || '';
    // apelido: só letras; digitou número aqui = começou o PIN
    name.addEventListener('input', () => {
      const digits = name.value.replace(/\D/g, '');
      name.value = name.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 12);
      if (digits) {
        pin.focus();
        pin.value = (pin.value + digits).slice(0, 4);
      }
    });
    pin.addEventListener('input', () => {
      pin.value = pin.value.replace(/\D/g, '').slice(0, 4);
      if (pin.value.length === 4) ov.querySelector('#lg-go').focus();
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        pin.focus();
      }
    });
    pin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    ov.querySelector('#lg-go').addEventListener('click', () => this.submit());
    ov.querySelector('#lg-guest').addEventListener('click', () => this.enter(null));
    this.nameEl = name;
    this.pinEl = pin;
    this.place = () => {
      const r = this.game.canvas.getBoundingClientRect();
      const s = r.width / VIEW.W;
      ov.style.left = `${r.left + (VIEW.W / 2 - 150) * s}px`;
      ov.style.top = `${r.top + 70 * s}px`;
      ov.style.width = `${300}px`;
      ov.style.transform = `scale(${(300 * s) / 300 / 1.6})`;
      ov.style.width = `${300 * 1.6}px`;
    };
    this.place();
    window.addEventListener('resize', this.place);
    setTimeout(() => (name.value ? pin : name).focus(), 50);
  }

  destroyOverlay() {
    window.removeEventListener('resize', this.place);
    if (this.ov) this.ov.remove();
    this.ov = null;
    this.input.keyboard.enabled = true;
    this.input.keyboard.enableGlobalCapture();
  }

  async submit() {
    if (this.busy) return;
    const name = this.nameEl.value.trim();
    const pin = this.pinEl.value;
    if (name.length < 2) {
      this.nameEl.focus();
      return this.setMsg('APELIDO COM 2 LETRAS OU MAIS', '#ff9a4d');
    }
    if (!/^\d{4}$/.test(pin)) {
      this.pinEl.focus();
      return this.setMsg('DIGITE OS 4 NUMEROS DO PIN', '#ff9a4d');
    }
    sfx.unlock();
    this.busy = true;
    this.setMsg('ENTRANDO...', '#b8b0d0');
    const r = await login(name, pin);
    this.busy = false;
    if (!r.ok) {
      sfx.play('buzzer');
      this.pinEl.value = '';
      this.pinEl.focus();
      return this.setMsg(r.error, '#ff7b6b');
    }
    sfx.play('play');
    this.enter(r.profile, r.created);
  }

  enter(profile, created = false) {
    sfx.unlock();
    this.registry.set('profile', profile);
    this.registry.set('profileNew', created);
    this.scene.start('Title');
  }
}
