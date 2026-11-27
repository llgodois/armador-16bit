// =====================================================================
//  SOM DO ARMADOR 64 — jogo de basquete do fim dos anos 90 (só no 64)
//  Tudo sintetizado com WebAudio, sem arquivos:
//   - música: piano elétrico (Rhodes por FM), baixo funk estalado, metais, bateria
//     de verdade e eco de ginásio. 'menu' = hip-hop jazzístico · 'game' = funk acelerado.
//   - efeitos: quique no taco, tênis rangendo, aro metálico, apito e buzina de arena
//     com reverberação, torcida de fundo durante a partida ("uuuh", festa, vaia).
//  Substitui sfx.play / sfx.music / sfx.stopMusic deste carregamento (3d.html). O 16-bit
//  (index.html) nunca importa este arquivo e segue com o som chiptune.
// =====================================================================
import { sfx } from '../audio/sfx.js';

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let revIn = null;
let noiseBuf = null;

const MASTER = 0.55;
const MUSIC = 0.34;

function ac() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = sfx.muted ? 0 : MASTER;
  // compressor leve: tudo junto sem estourar
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = sfx.musicMuted ? 0 : MUSIC;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 1.8; // efeitos à frente da música
  sfxBus.connect(master);
  // eco de ginásio (impulso sintético, 1,8 s)
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  revIn = ctx.createGain();
  revIn.gain.value = 0.55;
  revIn.connect(conv).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// saída com envio para o eco
function bus(out, rev = 0) {
  const g = ctx.createGain();
  g.connect(out);
  if (rev > 0) {
    const s = ctx.createGain();
    s.gain.value = rev;
    g.connect(s).connect(revIn);
  }
  return g;
}

function env(g, t, vol, a, d, curve = 'exp') {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  else g.gain.linearRampToValueAtTime(0.0001, t + a + d);
}

function osc(type, f0, t, dur, vol, { f1 = null, a = 0.003, out, rev = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  if (detune) o.detune.value = detune;
  const g = ctx.createGain();
  env(g, t, vol, a, dur);
  o.connect(g).connect(bus(out || sfxBus, rev));
  o.start(t);
  o.stop(t + a + dur + 0.05);
}

function nz(t, dur, vol, { type = 'bandpass', f = 1000, q = 1, f1 = null, a = 0.003, out, rev = 0, curve = 'exp' } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  fl.Q.value = q;
  const g = ctx.createGain();
  env(g, t, vol, a, dur, curve);
  s.connect(fl).connect(g).connect(bus(out || sfxBus, rev));
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + dur + 0.05);
}

// ---- instrumentos -------------------------------------------------------
// piano elétrico (FM: portadora + moduladora 1:1 que "abre" no ataque + brilho de sino)
function rhodes(n, t, dur, vol, out = musicBus) {
  const f = midi(n);
  const car = ctx.createOscillator();
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 2.2, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.5);
  mod.connect(mg).connect(car.frequency);
  const tine = ctx.createOscillator();
  tine.frequency.value = f * 14;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(f * 1.5, t);
  tg.gain.exponentialRampToValueAtTime(1, t + 0.08);
  tine.connect(tg).connect(car.frequency);
  const g = ctx.createGain();
  env(g, t, vol, 0.004, dur);
  car.connect(g).connect(bus(out, 0.35));
  for (const o of [car, mod, tine]) {
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

// baixo funk: serra + quadrada num filtro que fecha rápido (estalo no "pop")
function bass(n, t, dur, vol, pop = false) {
  const f = midi(n);
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.Q.value = pop ? 6 : 3;
  fl.frequency.setValueAtTime(pop ? 2600 : 1300, t);
  fl.frequency.exponentialRampToValueAtTime(pop ? 500 : 260, t + 0.18);
  const g = ctx.createGain();
  env(g, t, vol, 0.004, dur);
  fl.connect(g).connect(bus(musicBus, 0.05));
  for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(fl);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  osc('sine', f, t, dur, vol * 0.8, { out: musicBus }); // corpo grave
}

// metais: acorde de serras desafinadas com filtro que abre e fecha
function brass(notes, t, dur, vol) {
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.Q.value = 2;
  fl.frequency.setValueAtTime(600, t);
  fl.frequency.linearRampToValueAtTime(3200, t + 0.04);
  fl.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = ctx.createGain();
  env(g, t, vol, 0.02, dur);
  fl.connect(g).connect(bus(musicBus, 0.3));
  for (const n of notes) {
    for (const det of [-9, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = det;
      o.connect(fl);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

// bateria
const kick = (t, v = 1) => {
  osc('sine', 150, t, 0.32, 0.9 * v, { f1: 42, out: musicBus });
  nz(t, 0.02, 0.25 * v, { type: 'highpass', f: 2500, out: musicBus });
};
const snare = (t, v = 1) => {
  nz(t, 0.17, 0.45 * v, { type: 'bandpass', f: 1900, q: 0.8, out: musicBus, rev: 0.45 });
  osc('triangle', 210, t, 0.08, 0.35 * v, { f1: 150, out: musicBus });
};
const hat = (t, v = 1, open = false) => nz(t, open ? 0.22 : 0.035, 0.13 * v, { type: 'highpass', f: 7500, out: musicBus, rev: 0.08 });
const clap = (t, v = 1) => {
  for (const d of [0, 0.012, 0.024]) nz(t + d, 0.06, 0.25 * v, { type: 'bandpass', f: 1300, q: 1.2, out: musicBus, rev: 0.5 });
};

// ---- músicas ------------------------------------------------------------
// cada compasso: [baixo (midi), acorde (midi)]
const SONGS = {
  // hip-hop jazzístico, relaxado (Fá maior: Gm9 · C13 · Fmaj9 · Dm9), com swing
  menu: {
    bpm: 88,
    swing: 0.14,
    bars: [
      [43, [58, 62, 65, 69]],
      [36, [58, 64, 69]],
      [41, [57, 60, 64, 67]],
      [38, [53, 57, 60, 64]],
    ],
    step(s, t, bar, six) {
      const [b, ch] = bar;
      const i = s % 16;
      if (i === 0 || i === 10) kick(t, 0.85);
      if (i === 4 || i === 12) snare(t, 0.7);
      if (i % 2 === 0) hat(t, i % 4 === 0 ? 0.7 : 0.45);
      if (i === 0) ch.forEach((n) => rhodes(n, t, six * 7, 0.07));
      if (i === 8 && s % 32 < 16) ch.slice(1).forEach((n) => rhodes(n + 12, t, six * 3, 0.035));
      if (i === 0) bass(b, t, six * 5, 0.2);
      if (i === 7) bass(b + 7, t, six * 2, 0.14);
      if (i === 10) bass(b, t, six * 3, 0.16);
      if (i === 14 && (s >> 4) % 4 === 3) bass(b + 10, t, six * 2, 0.14);
    },
  },
  // funk de quadra, acelerado (Mi menor: Em9 · A13 · Cmaj9 · B7#9)
  game: {
    bpm: 112,
    swing: 0.04,
    bars: [
      [40, [55, 59, 62, 66]],
      [45, [55, 61, 66]],
      [36, [52, 55, 59, 62]],
      [35, [51, 57, 62, 66]],
    ],
    step(s, t, bar, six) {
      const [b, ch] = bar;
      const i = s % 16;
      const barN = s >> 4;
      const fill = barN % 8 === 7 && i >= 12;
      if (i === 0 || i === 7 || i === 10) kick(t, i === 0 ? 1 : 0.8);
      if (i === 4 || i === 12) (barN % 2 ? clap : snare)(t, 0.85);
      if (fill) snare(t, 0.45 + (i - 12) * 0.12);
      if (!fill) hat(t, i % 2 === 0 ? 0.75 : 0.35, i === 14);
      // baixo estalado
      const riff = { 0: [0, false], 3: [12, true], 6: [0, false], 8: [7, false], 10: [10, false], 11: [12, true], 14: [7, false] };
      if (riff[i]) bass(b + riff[i][0], t, six * 1.6, 0.18, riff[i][1]);
      // piano comping
      if (i === 2 || i === 9) ch.forEach((n) => rhodes(n, t, six * 1.8, 0.045));
      // metais nos contratempos, a cada dois compassos
      if (barN % 2 === 1 && (i === 6 || i === 15)) brass(ch.slice(-3).map((n) => n + 12), t, six * (i === 15 ? 2.5 : 1.2), 0.05);
      // frase de metais (pentatônica) na segunda metade do ciclo
      if (barN % 8 >= 4 && barN % 8 < 7) {
        const mel = [0, null, 3, null, 5, 7, null, 10, null, 7, 5, null, 3, null, 0, null];
        const n = mel[(i + barN * 3) % 16];
        if (n != null && i % 2 === 0) brass([64 + n], t, six * 1.4, 0.035);
      }
    },
  },
};

const seq = { name: null, timer: null, step: 0, next: 0 };

function tick() {
  if (!ctx || !seq.name) return;
  const song = SONGS[seq.name];
  const six = 60 / song.bpm / 4;
  while (seq.next < ctx.currentTime + 0.2) {
    const s = seq.step;
    const t = seq.next + (s % 2 === 1 ? song.swing * six : 0);
    try {
      if (!sfx.musicMuted) song.step(s, Math.max(t, ctx.currentTime), song.bars[(s >> 4) % song.bars.length], six);
    } catch {
      /* ignore */
    }
    seq.next += six;
    seq.step = (s + 1) % (16 * 32);
  }
}

// ---- torcida de fundo (só durante a partida) ----------------------------
const crowd = { src: null, gain: null };
function crowdOn() {
  if (crowd.src || !ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 850;
  f1.Q.value = 0.6;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.value = 2600;
  const g = ctx.createGain();
  g.gain.value = 0.035;
  // ondas lentas de volume (a torcida "respira")
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lg = ctx.createGain();
  lg.gain.value = 0.012;
  lfo.connect(lg).connect(g.gain);
  s.connect(f1).connect(f2).connect(g).connect(bus(sfxBus, 0.4));
  s.start();
  lfo.start();
  crowd.src = s;
  crowd.lfo = lfo;
  crowd.gain = g;
}
function crowdOff() {
  if (!crowd.src) return;
  const t = ctx.currentTime;
  crowd.gain.gain.cancelScheduledValues(t);
  crowd.gain.gain.setValueAtTime(crowd.gain.gain.value, t);
  crowd.gain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
  crowd.src.stop(t + 0.7);
  crowd.lfo.stop(t + 0.7);
  crowd.src = null;
}

// torcida reagindo: camadas de ruído com formantes de voz
function crowdShout(t, dur, vol, { from = 700, to = 1100, ooh = false } = {}) {
  nz(t, dur, vol, { type: 'bandpass', f: from, f1: to, q: ooh ? 3 : 0.7, a: dur * 0.25, out: sfxBus, rev: 0.6, curve: 'lin' });
  nz(t + 0.05, dur * 0.9, vol * 0.6, { type: 'bandpass', f: from * 2.3, f1: to * 2.1, q: ooh ? 4 : 0.9, a: dur * 0.3, out: sfxBus, rev: 0.6, curve: 'lin' });
}
const claps = (t, n, vol) => {
  for (let k = 0; k < n; k++) nz(t + Math.random() * 1.2, 0.03, vol * (0.5 + Math.random() * 0.5), { type: 'bandpass', f: 1400 + Math.random() * 900, q: 1.5, rev: 0.5 });
};

// sino FM curto (interface)
function bell(n, t, dur, vol) {
  const f = midi(n);
  const car = ctx.createOscillator();
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f * 3.5;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.2, t);
  mg.gain.exponentialRampToValueAtTime(1, t + dur);
  mod.connect(mg).connect(car.frequency);
  const g = ctx.createGain();
  env(g, t, vol, 0.002, dur);
  car.connect(g).connect(bus(sfxBus, 0.25));
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
}

// ---- efeitos ------------------------------------------------------------
const SOUNDS = {
  // quique no taco do ginásio: baque grave + estalo de madeira + eco
  bounce: (t, v = 1) => {
    osc('sine', 125, t, 0.11, 0.6 * v, { f1: 62, rev: 0.25 });
    nz(t, 0.035, 0.32 * v, { type: 'bandpass', f: 2400, q: 1.4, rev: 0.3 });
    nz(t, 0.06, 0.18 * v, { type: 'lowpass', f: 380 });
  },
  swish: (t) => {
    nz(t, 0.32, 0.32, { type: 'bandpass', f: 4200, f1: 1700, q: 0.9, a: 0.02, rev: 0.3 });
    nz(t + 0.05, 0.25, 0.14, { type: 'highpass', f: 6000, rev: 0.2 });
  },
  net: (t) => {
    nz(t, 0.2, 0.16, { type: 'highpass', f: 3200, a: 0.01, rev: 0.25 });
    nz(t + 0.06, 0.24, 0.1, { type: 'bandpass', f: 1600, q: 2, rev: 0.25 });
  },
  // aro: metal com parciais inarmônicos que ressoam
  rim: (t) => {
    [[410, 0.12, 0.5], [1135, 0.08, 0.35], [2230, 0.05, 0.25], [3490, 0.03, 0.18]].forEach(([f, v, d]) => osc('sine', f, t, d, v, { rev: 0.45 }));
    nz(t, 0.03, 0.25, { type: 'bandpass', f: 3000, q: 2 });
  },
  // apito do juiz: dois tons com trinado + eco do ginásio
  whistle: (t) => {
    for (const [d, len] of [[0, 0.38], [0.48, 0.16]]) {
      const o = ctx.createOscillator();
      o.frequency.value = 2750;
      const o2 = ctx.createOscillator();
      o2.frequency.value = 2810;
      const am = ctx.createOscillator();
      am.frequency.value = 34;
      const amg = ctx.createGain();
      amg.gain.value = 0.5;
      const g = ctx.createGain();
      env(g, t + d, 0.11, 0.015, len, 'lin');
      const trem = ctx.createGain();
      trem.gain.value = 0.6;
      am.connect(amg).connect(trem.gain);
      o.connect(trem);
      o2.connect(trem);
      trem.connect(g).connect(bus(sfxBus, 0.5));
      for (const x of [o, o2, am]) {
        x.start(t + d);
        x.stop(t + d + len + 0.1);
      }
    }
  },
  // buzina de arena
  buzzer: (t) => {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 1800;
    const g = ctx.createGain();
    env(g, t, 0.16, 0.02, 0.95, 'lin');
    fl.connect(g).connect(bus(sfxBus, 0.5));
    for (const f of [220, 277, 330]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(fl);
      o.start(t);
      o.stop(t + 1.05);
    }
  },
  pass: (t) => nz(t, 0.13, 0.7, { type: 'bandpass', f: 700, f1: 2200, q: 0.6 }),
  catch: (t) => {
    nz(t, 0.04, 0.35, { type: 'lowpass', f: 900 });
    osc('sine', 180, t, 0.05, 0.25, { f1: 110 });
  },
  steal: (t) => {
    nz(t, 0.04, 0.4, { type: 'lowpass', f: 1000 });
    nz(t + 0.02, 0.14, 0.14, { type: 'bandpass', f: 1500, f1: 500, q: 1 });
    crowdShout(t + 0.05, 0.9, 0.08, { from: 600, to: 1000 });
  },
  // tênis rangendo no taco
  cross: (t) => {
    osc('sine', 2300, t, 0.07, 0.07, { f1: 3300 });
    osc('sine', 3300, t + 0.07, 0.05, 0.05, { f1: 2800 });
    nz(t, 0.06, 0.05, { type: 'bandpass', f: 2800, q: 4 });
  },
  // tornozelo quebrado: rangido forte + "uuuuh" da torcida
  ankle: (t) => {
    osc('sine', 2600, t, 0.12, 0.08, { f1: 3600 });
    crowdShout(t + 0.05, 1.3, 0.14, { from: 450, to: 650, ooh: true });
  },
  cheer: (t) => {
    crowdShout(t, 2.2, 0.16, { from: 800, to: 1300 });
    crowdShout(t + 0.1, 1.8, 0.1, { from: 1500, to: 2200 });
    claps(t + 0.2, 16, 0.12);
  },
  aww: (t) => crowdShout(t, 1.1, 0.1, { from: 650, to: 380, ooh: true }),
  select: (t) => bell(84, t, 0.12, 0.16),
  play: (t) => {
    bell(79, t, 0.16, 0.14);
    bell(86, t + 0.08, 0.22, 0.14);
  },
  // verde: sinos subindo com brilho
  green: (t) => {
    [76, 83, 88, 95].forEach((n, i) => bell(n, t + i * 0.045, 0.3, 0.06));
    nz(t + 0.1, 0.5, 0.05, { type: 'highpass', f: 6500, a: 0.05, rev: 0.5 });
  },
  // toco: tapa seco + "uuuh"
  block: (t) => {
    osc('sine', 110, t, 0.2, 0.6, { f1: 45 });
    nz(t, 0.08, 0.45, { type: 'lowpass', f: 1200, rev: 0.3 });
    crowdShout(t + 0.05, 1.0, 0.12, { from: 500, to: 900, ooh: true });
  },
  life: (t) => {
    bell(67, t, 0.4, 0.08);
    bell(62, t + 0.14, 0.5, 0.07);
    bell(55, t + 0.3, 0.7, 0.06);
  },
};

// ---- liga no jogo -------------------------------------------------------
const origToggleMute = sfx.toggleMute.bind(sfx);
const origToggleMusic = sfx.toggleMusic.bind(sfx);

sfx.unlock = () => {
  ac();
};
sfx.play = (name, ...args) => {
  if (sfx.muted || !SOUNDS[name] || !ac()) return;
  try {
    SOUNDS[name](ctx.currentTime + 0.005, ...args);
  } catch (e) {
    console.warn('som64', name, e);
  }
};
sfx.music = (name) => {
  if (seq.name === name) return;
  seq.name = SONGS[name] ? name : null;
  if (!ac()) return;
  seq.step = 0;
  seq.next = ctx.currentTime + 0.08;
  if (!seq.timer) seq.timer = setInterval(tick, 25);
  if (name === 'game') crowdOn();
  else crowdOff();
};
sfx.stopMusic = () => {
  seq.name = null;
  if (ctx) crowdOff();
};
sfx.toggleMute = () => {
  const m = origToggleMute();
  if (master) master.gain.value = m ? 0 : MASTER;
  return m;
};
sfx.toggleMusic = () => {
  const m = origToggleMusic();
  if (musicBus) musicBus.gain.value = m ? 0 : MUSIC;
  return m;
};
