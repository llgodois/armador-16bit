// =====================================================================
//  Efeitos sonoros sintetizados com WebAudio (sem arquivos externos).
//  sfx.play('bounce'), sfx.toggleMute(). O AudioContext é criado no
//  primeiro uso (navegadores exigem uma tecla/clique antes do áudio).
// =====================================================================
const MASTER_VOLUME = 0.5;

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let musicMuted = false;
let musicGain = null;

try {
  muted = localStorage.getItem('armador_muted') === '1';
  musicMuted = localStorage.getItem('armador_musica') === '0';
} catch {
  /* sem localStorage */
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicMuted ? 0 : 0.55;
    musicGain.connect(master);
    // 1s de ruído branco reaproveitado por todos os sons "de ar"
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function envelope(g, t, vol, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.3, attack = 0.004, delay = 0, vibrato = 0, vibratoRate = 0, out = null }) {
  const c = ctx;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  if (vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = vibratoRate;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  envelope(g, t, vol, attack, dur);
  o.connect(g).connect(out || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, type = 'bandpass', freq = 1000, q = 1, attack = 0.004, delay = 0, sweepTo = null, out = null }) {
  const c = ctx;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  envelope(g, t, vol, attack, dur);
  src.connect(f).connect(g).connect(out || master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  // quique da bola: "tum" grave + estalo curto
  bounce: (v = 1) => {
    tone({ type: 'sine', f0: 160, f1: 55, dur: 0.12, vol: 0.55 * v });
    noise({ type: 'lowpass', freq: 500, dur: 0.05, vol: 0.25 * v });
  },
  // bola caindo limpa: "chuá"
  swish: () => {
    noise({ type: 'bandpass', freq: 3800, q: 0.8, dur: 0.35, vol: 0.35, attack: 0.03, sweepTo: 1800 });
  },
  // rede balançando
  net: () => {
    noise({ type: 'highpass', freq: 2500, dur: 0.18, vol: 0.18, delay: 0.02 });
    noise({ type: 'bandpass', freq: 1400, q: 2, dur: 0.22, vol: 0.12, delay: 0.08 });
  },
  // bola batendo no aro
  rim: () => {
    tone({ type: 'square', f0: 520, f1: 480, dur: 0.14, vol: 0.09 });
    tone({ type: 'square', f0: 790, dur: 0.1, vol: 0.06 });
    tone({ type: 'triangle', f0: 1320, f1: 1250, dur: 0.3, vol: 0.08 });
  },
  whistle: () => {
    tone({ type: 'sine', f0: 2900, dur: 0.42, vol: 0.16, attack: 0.02, vibrato: 140, vibratoRate: 32 });
    tone({ type: 'sine', f0: 2900, dur: 0.18, vol: 0.12, attack: 0.02, delay: 0.5, vibrato: 140, vibratoRate: 32 });
  },
  buzzer: () => {
    tone({ type: 'sawtooth', f0: 150, dur: 0.7, vol: 0.13, attack: 0.01 });
    tone({ type: 'square', f0: 152, dur: 0.7, vol: 0.07, attack: 0.01 });
  },
  pass: () => noise({ type: 'bandpass', freq: 900, q: 1.5, dur: 0.07, vol: 0.22 }),
  catch: () => noise({ type: 'lowpass', freq: 700, dur: 0.05, vol: 0.3 }),
  steal: () => {
    tone({ type: 'square', f0: 330, f1: 140, dur: 0.18, vol: 0.12 });
    noise({ type: 'lowpass', freq: 600, dur: 0.06, vol: 0.25 });
  },
  cross: () => {
    noise({ type: 'highpass', freq: 3000, dur: 0.05, vol: 0.15 });
    tone({ type: 'square', f0: 220, f1: 330, dur: 0.06, vol: 0.05 });
  },
  ankle: () => {
    tone({ type: 'square', f0: 880, f1: 220, dur: 0.25, vol: 0.08 });
  },
  cheer: () => {
    noise({ type: 'bandpass', freq: 1100, q: 0.4, dur: 1.3, vol: 0.12, attack: 0.25 });
    noise({ type: 'bandpass', freq: 2200, q: 0.6, dur: 1.0, vol: 0.06, attack: 0.3, delay: 0.1 });
  },
  aww: () => {
    noise({ type: 'bandpass', freq: 700, q: 1.2, dur: 0.8, vol: 0.08, attack: 0.15, sweepTo: 400 });
  },
  select: () => {
    tone({ type: 'square', f0: 660, dur: 0.06, vol: 0.08 });
    tone({ type: 'square', f0: 990, dur: 0.09, vol: 0.08, delay: 0.06 });
  },
  // arremesso no VERDE: brilho subindo
  green: () => {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.09, delay: i * 0.05 }));
    noise({ type: 'highpass', freq: 5000, dur: 0.4, vol: 0.06, attack: 0.05, delay: 0.1 });
  },
  // toco: pancada seca
  block: () => {
    tone({ type: 'sine', f0: 120, f1: 45, dur: 0.2, vol: 0.5 });
    noise({ type: 'lowpass', freq: 900, dur: 0.09, vol: 0.4 });
  },
  // perdeu uma vida (competitivo)
  life: () => {
    tone({ type: 'square', f0: 392, f1: 196, dur: 0.35, vol: 0.08 });
    tone({ type: 'square', f0: 294, f1: 147, dur: 0.4, vol: 0.06, delay: 0.12 });
  },
  play: () => {
    tone({ type: 'square', f0: 523, dur: 0.07, vol: 0.07 });
    tone({ type: 'square', f0: 659, dur: 0.07, vol: 0.07, delay: 0.07 });
    tone({ type: 'square', f0: 784, dur: 0.1, vol: 0.07, delay: 0.14 });
  },
};

// =====================================================================
//  MÚSICA 16-BIT (sintetizada): 'menu' (tranquila) e 'game' (acelerada).
//  Sequenciador simples com agendamento à frente (sem travar o jogo).
// =====================================================================
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[45, 'm'], [48, 'M'], [43, 'M'], [40, 'm'], [41, 'M'], [43, 'M'], [45, 'm'], [40, 'M']];
const TRIAD = { M: [0, 4, 7], m: [0, 3, 7] };
const SONGS = {
  menu: { bpm: 92, lead: 'triangle', leadVol: 0.035, bassVol: 0.05, drums: 0.6, arpEvery: 2 },
  game: { bpm: 132, lead: 'square', leadVol: 0.022, bassVol: 0.045, drums: 1, arpEvery: 1 },
};
const music = { name: null, timer: null, step: 0, next: 0 };

function musicStep(song, step, when) {
  const c = ctx;
  const delay = Math.max(0, when - c.currentTime);
  const [root, kind] = CHORDS[Math.floor(step / 4) % CHORDS.length];
  const tri = TRIAD[kind];
  const sixteenth = 60 / song.bpm / 4;
  // baixo: tônica em colcheias (oitava alternando na música do jogo)
  if (step % 2 === 0) tone({ type: 'square', f0: midi(root + (song === SONGS.game && step % 4 === 2 ? 12 : 0)), dur: sixteenth * 1.8, vol: song.bassVol, delay, out: musicGain });
  // arpejo
  if (step % song.arpEvery === 0) {
    const n = root + 24 + tri[(step / song.arpEvery) % 3];
    tone({ type: song.lead, f0: midi(n), dur: sixteenth * 1.5, vol: song.leadVol, delay, out: musicGain });
  }
  // bateria
  const d = song.drums;
  if (step % 8 === 0) tone({ type: 'sine', f0: 140, f1: 50, dur: 0.12, vol: 0.12 * d, delay, out: musicGain });
  if (step % 8 === 4) noise({ type: 'bandpass', freq: 1800, q: 0.7, dur: 0.1, vol: 0.05 * d, delay, out: musicGain });
  if (step % 2 === 1 || song === SONGS.game) noise({ type: 'highpass', freq: 7000, dur: 0.03, vol: 0.02 * d, delay, out: musicGain });
}

function musicTick() {
  if (!ctx || !music.name) return;
  const song = SONGS[music.name];
  const sixteenth = 60 / song.bpm / 4;
  while (music.next < ctx.currentTime + 0.15) {
    try {
      musicStep(song, music.step, music.next);
    } catch {
      /* ignore */
    }
    music.next += sixteenth;
    music.step = (music.step + 1) % 64;
  }
}
export const sfx = {
  unlock() {
    ac();
  },
  play(name, ...args) {
    if (muted) return;
    if (!ac() || !SOUNDS[name]) return;
    try {
      SOUNDS[name](...args);
    } catch (e) {
      console.warn('sfx', name, e);
    }
  },
  // toca a música (mesma música não reinicia)
  music(name) {
    if (music.name === name) return;
    music.name = name;
    if (!ac()) return;
    music.step = 0;
    music.next = ctx.currentTime + 0.05;
    if (!music.timer) music.timer = setInterval(musicTick, 30);
  },
  stopMusic() {
    music.name = null;
  },
  toggleMusic() {
    musicMuted = !musicMuted;
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : 0.55;
    try {
      localStorage.setItem('armador_musica', musicMuted ? '0' : '1');
    } catch {
      /* ignore */
    }
    return musicMuted;
  },
  get musicMuted() {
    return musicMuted;
  },
  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
    try {
      localStorage.setItem('armador_muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return muted;
  },
  get muted() {
    return muted;
  },
};
