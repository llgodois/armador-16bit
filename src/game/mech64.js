// =====================================================================
//  MECÂNICAS SÓ DO ARMADOR 64 (estilo 2K) — leva 2: ataque.
//  Chamadas pela GameScene apenas quando `g.v64` está ligado (o 16-bit nunca usa).
//
//  - ameaça tripla ao receber: jab step, arranque (primeiro passo), finta
//  - jogo de costas (post up): segurar LT/Q perto do garrafão; drop step, gancho, fadeaway
//  - contato na infiltração: quem é mais forte desequilibra o outro
//  - janela do verde que reage ao contexto (defensor perto, gás, arremesso em movimento)
//  - tapinha / enterrada no rebote ofensivo
// =====================================================================
import { SHOT, STAMINA, PLAYER, USER_DEFENSE, REBOUND, COURT, MID_Y, CROSSOVER } from '../config.js';
import { clamp, distToBasket, courtDist } from '../utils/math.js';
import { sfx } from '../audio/sfx.js';

const TRIPLE_TIME = 1.4; // segundos com a bola na mão antes de começar a quicar sozinho
const POST_RANGE = 115; // distância da cesta para encostar de costas (LT/Q)
const HOOK_RANGE = 50; // perto disso, X de costas = gancho; mais longe = fadeaway

const dirTo = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l, d: l };
};

// ------------------------------------------------------------------ ameaça tripla
export function onUserCatch(g, u) {
  if (g.inbound || distToBasket(u, g.dir) < 60) return; // perto do aro: finaliza direto
  u.triple = TRIPLE_TIME;
}

// jab step: finge que vai, o defensor pode morder
function jab(g, u, side) {
  u.jabAt = g.time.now;
  u.jabSide = side;
  u.triple = Math.max(u.triple, 0.9); // continua na ameaça tripla
  g.floatText(u.x, u.y - u.headY - 18, 'JAB', 0x6fa0ff);
  sfx.play('bounce', 0.4);
  const d = g.defenderOf(u);
  if (d && d.stun <= 0 && d.distTo(u) < 26 && Math.random() < 0.45 / d.skills.defense) {
    d.stun = 0.4;
    g.floatText(d.x, d.y - d.headY - 6, 'MORDEU!', 0xffe14d);
  }
}

// arranque: primeiro passo explosivo saindo da ameaça tripla
function firstStep(g, u, dx, dy) {
  u.triple = 0;
  u.crossDir = { x: dx, y: dy };
  u.crossTimer = 0.26;
  u.crossCooldown = 0.5;
  g.stamina = Math.max(0, g.stamina - STAMINA.crossCost * 0.6);
  g.floatText(u.x, u.y - u.headY - 18, 'ARRANQUE', 0x6fa0ff);
  sfx.play('cross');
  g.ankleCheck(0.75, 'PASSOU!');
}

// ------------------------------------------------------------------ botões do 64
// LT / Q  = PROTEGER a bola (longe do garrafão) ou jogo de costas (perto)
// LB / C  = toque: chama o bloqueio · segurando com a bola: visão de quadra
//           (sem a bola, segurar continua sendo "você bloqueia")
export function remapButtons64(g) {
  const u = g.user;
  const now = g.time.now;
  const hasBall = !!u && !g.userOnDefense && g.ball.holder === u && g.ball.state === 'held';
  g.btn.PROTECT = g.btn.VISION; // o que era a visão (LT/Q) vira proteger
  // teclado: C segurado (com a bola) = visão; toque rápido = bloqueio
  const key = g.keys.SCREEN;
  let keyTap = false;
  if (key && key.isDown) {
    if (!g.cDownAt) g.cDownAt = now;
  } else if (g.cDownAt) {
    keyTap = now - g.cDownAt < 180;
    g.cDownAt = 0;
  }
  const keyHold = !!(key && key.isDown && g.cDownAt && now - g.cDownAt > 180);
  // RB = bloqueio (o toque no LB não chama mais): apertou com a bola = chama o bloqueio;
  // segurando, A = rola para a cesta · X = abre para o 3 · Y = slip (corta antes do contato).
  // Sem a bola, RB segurado = você bloqueia.
  const rb = !!g.rbDown64;
  const rbJust = rb && !g.rbPrev64;
  if (rbJust) g.rbAt64 = now;
  g.rbPrev64 = rb;
  g.screenTap64 = keyTap || (rbJust && hasBall && !screener64(g)); // (já vindo: o RB só escolhe a opção)
  g.padScreenHold = !hasBall && rb && now - (g.rbAt64 || 0) > 120;
  if (rb && hasBall && g.rbFace64 >= 0) screenOption(g, ['roll', null, 'pop', 'slip'][g.rbFace64]);
  watchScreen(g);
  giveAndGo(g, hasBall);
  takeoverTick(g);
  const hold = hasBall && (keyHold || g.lbVision64);
  const prev = !!g.vision64Prev;
  g.btn.VISION = { isDown: hold, just: hold && !prev, up: !hold && prev };
  g.vision64Prev = hold;
}

// ------------------------------------------------------------------ LB + botão: escolher companheiro e ação
// Segure LB: sobre cada companheiro aparece o botão dele (A=SG, B=SF, X=PF, Y=C).
// Apertou um -> ele fica selecionado e aparece o menu: A passe · B corta para a cesta ·
// X abre para o 3 · Y vem bloquear para você. Soltar o LB cancela.
export const MATE_ACTIONS = [
  { id: 'pass', label: 'PASSE' },
  { id: 'cut', label: 'CORTA' },
  { id: 'spot3', label: 'ABRE NO 3' },
  { id: 'screen', label: 'BLOQUEIO' },
];
const THREE_SPOTS = ['cornerL', 'wingL', 'wingR', 'cornerR'];

export function lbSelect64(g, face) {
  const u = g.user;
  const sel = g.sel64;
  if (!sel) return;
  if (sel.stage === 'pick') {
    const mate = g.home[face + 1];
    if (!mate || mate === u) return;
    g.sel64 = { stage: 'action', mate };
    sfx.play('select');
    return;
  }
  const act = MATE_ACTIONS[face];
  if (act) mateAction(g, sel.mate, act.id);
  g.sel64 = { stage: 'pick' }; // segue segurando o LB: pode escolher outro
}

function mateAction(g, p, id) {
  const u = g.user;
  if (id === 'pass') {
    if (g.ball.holder === u && g.ball.state === 'held') {
      g.iconUsed = true;
      g.jArmed = false;
      g.doPass(u, p);
    }
    return;
  }
  if (!p.motion) return;
  if (g.play) {
    g.play.finish();
    g.play = null;
  }
  p.body.pushable = true;
  const m = p.motion;
  if (id === 'cut') {
    Object.assign(m, { action: 'cut', phase: 0, t: 2.4, holdT: undefined, backdoor: true, slot: null, mate: null });
    g.floatText(p.x, p.y - p.headY - 8, 'CORTA!', 0x6fa0ff);
  } else if (id === 'spot3') {
    // o ponto de 3 livre mais perto dele (canto ou ala)
    const taken = new Set(g.offTeam.filter((o) => o !== p && o.motion).map((o) => o.motion.slot));
    let best = THREE_SPOTS[0];
    let bd = Infinity;
    for (const s of THREE_SPOTS) {
      if (taken.has(s)) continue;
      const pt = g.slot(s);
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < bd) [bd, best] = [d, s];
    }
    Object.assign(m, { action: 'spot', slot: best, phase: 0, t: 4, holdT: undefined, fastT: 1.2, mate: null });
    g.floatText(p.x, p.y - p.headY - 8, 'ABRE NO 3!', 0x6fa0ff);
  } else if (id === 'screen') {
    Object.assign(m, { action: 'ballscreen', phase: 0, t: 3.5, holdT: undefined, mate: null });
    g.floatText(p.x, p.y - p.headY - 8, 'BLOQUEIO!', 0x6fa0ff);
  }
  sfx.play('select');
}

// ------------------------------------------------------------------ jogo de costas
export function wantsPost(g) {
  const u = g.user;
  const lt = g.btn.PROTECT || g.btn.VISION;
  return !!(u && !g.userOnDefense && g.ball.holder === u && g.ball.state === 'held' && lt && lt.isDown && distToBasket(u, g.dir) < POST_RANGE);
}

// ---- proteger a bola (LT longe do garrafão): bola do lado oposto ao marcador, roubo bem mais
// difícil (a IA tem 30% da chance), anda mais devagar e sem sprint
function protectBall(g, u, on) {
  u.protect = on;
  if (!on) return;
  const d = g.defenderOf(u);
  if (d) g.ball.side = Math.sign(u.x - d.x) || g.ball.side || 1;
}

function postHook(g, u) {
  const d = g.defenderOf(u);
  const tall = d ? (u.cm - d.cm) * 0.008 : 0;
  const chance = clamp((0.4 + 0.32 * u.skills.finishing + tall) * g.contestFactor(u, 18, 0.55), 0.12, 0.85);
  u.post = false;
  if (g.tryBlock(u, 0.9)) return;
  const made = Math.random() < chance;
  u.setPose('shoot', 0.4);
  u.lift = 7;
  u.stop();
  g.ball.shoot(u, made, 'floater', g.basket, g.dir);
  g.pendingShot = { shooter: u, three: false, made, kind: 'floater' };
  g.logShot(u, made, false);
  if (u === g.pg) g.stats.fga++;
  g.floatText(u.x, u.y - u.headY - 12, `GANCHO ${Math.round(chance * 100)}%`, 0xffffff);
}

function dropStep(g, u, side) {
  const b = dirTo(u, g.basket);
  const a = side * 0.85; // gira por fora do defensor, rumo à cesta
  u.crossDir = { x: b.x * Math.cos(a) - b.y * Math.sin(a), y: b.x * Math.sin(a) + b.y * Math.cos(a) };
  u.crossTimer = 0.3;
  u.crossCooldown = 0.6;
  u.post = false;
  u.lookAlways = false;
  g.stamina = Math.max(0, g.stamina - STAMINA.crossCost * 0.7);
  g.floatText(u.x, u.y - u.headY - 18, 'DROP STEP', 0x6fa0ff);
  sfx.play('cross');
  g.ankleCheck(0.9, 'PASSOU!');
}

// finta de costas: o marcador pode pular (e abre o up-and-under)
function postFake(g, u) {
  u.uauAt = g.time.now;
  u.setPose('shoot', 0.2);
  g.floatText(u.x, u.y - u.headY - 18, 'FINTA', 0x6fa0ff);
  const d = g.defenderOf(u);
  if (d && d.stun <= 0 && d.distTo(u) < 24 && Math.random() < 0.55 / d.skills.defense) {
    d.stun = 0.55;
    d.lift = 6;
    d.setPose('shoot', 0.4);
    g.floatText(d.x, d.y - d.headY - 6, 'PULOU!', 0xffe14d);
  }
}

// up-and-under: depois da finta, passa por baixo do marcador e finaliza
function upAndUnder(g, u) {
  u.uauAt = 0;
  u.post = false;
  u.lookAlways = false;
  u.forceStyle = { style: 'uau' };
  g.startLayup(u);
}

// dream shake: giro de costas com finta, sai pelo outro lado rumo à cesta
function dreamShake(g, u, b) {
  const d = g.defenderOf(u);
  const side = d ? -(Math.sign((d.x - u.x) * b.y - (d.y - u.y) * b.x) || 1) : 1;
  const a = side * 1.15;
  u.crossDir = { x: b.x * Math.cos(a) - b.y * Math.sin(a), y: b.x * Math.sin(a) + b.y * Math.cos(a) };
  u.crossTimer = 0.36;
  u.crossCooldown = 0.7;
  u.post = false;
  u.lookAlways = false;
  g.stamina = Math.max(0, g.stamina - STAMINA.crossCost);
  g.floatText(u.x, u.y - u.headY - 18, 'DREAM SHAKE', 0x6fa0ff);
  sfx.play('cross');
  g.ankleCheck(1.15, 'BALANCOU!');
}

// vira de frente para o aro (sai das costas para a ameaça tripla)
function faceUp(g, u) {
  u.post = false;
  u.lookAlways = false;
  u.triple = 1.0;
  g.floatText(u.x, u.y - u.headY - 18, 'DE FRENTE', 0x6fa0ff);
}

function fadeaway(g, u) {
  const b = dirTo(u, g.basket);
  u.post = false;
  u.lookAlways = false;
  g.gathering = true;
  g.meterValue = 0;
  g.stepBack = 0.22; // o recuo do fadeaway usa o mesmo caminho do step-back
  g.stepBackUsed = true; // e freia firme no fim do recuo
  u.stepDir = { x: -b.x, y: -b.y };
  u.gatherSpeed = 0;
  g.jArmed = false;
  u.setPose('shoot', 0.1);
  g.floatText(u.x, u.y - u.headY - 18, 'FADEAWAY', 0x6fa0ff);
}

// ------------------------------------------------------------------ rebote ofensivo
export function onOffensiveRebound(g, p, ballZ) {
  if (ballZ < 12 || Math.hypot(p.x - g.basket.x, p.y - g.basket.y) > 45) return;
  p.putbackT = 0.55; // você: aperte X logo para o tapinha / enterrada no rebote
  if (p !== g.user && Math.random() < 0.55 * p.skills.finishing) g.time.delayedCall(120, () => putback(g, p));
}

export function putback(g, p) {
  if (g.ball.holder !== p || g.ball.state !== 'held' || g.state !== 'live') return;
  p.putbackT = 0;
  const fin = p.skills.finishing;
  const dunk = (p.skills.dunk != null ? p.skills.dunk >= 60 : fin >= 0.95 || p.cm >= 196) && Math.random() < 0.7;
  const chance = clamp((dunk ? 0.82 : 0.62) * fin * g.contestFactor(p, 18, 0.45), 0.15, 0.9);
  if (g.tryBlock(p, 1.2)) return;
  const made = Math.random() < chance;
  const kind = dunk ? 'dunk' : 'layup';
  p.setPose('shoot', 0.4);
  p.lift = dunk ? 12 : 8;
  p.stop();
  g.ball.shoot(p, made, kind, g.basket, g.dir);
  g.pendingShot = { shooter: p, three: false, made, kind, putback: true };
  g.logShot(p, made, false);
  if (p === g.pg) g.stats.fga++;
  g.floatText(p.x, p.y - p.headY - 12, `${dunk ? 'ENTERRADA NO REBOTE' : 'TAPINHA'} ${Math.round(chance * 100)}%`, 0xffe14d);
}

// ------------------------------------------------------------------ você no ataque (antes do resto)
// Retorna true quando a jogada deste quadro já foi resolvida aqui.
export function userOffense64(g, u, hasBall, ix, iy, moving, dt) {
  // tapinha no rebote ofensivo
  if (u.putbackT > 0) {
    u.putbackT -= dt;
    if (hasBall && g.btn.K.just) {
      putback(g, u);
      return true;
    }
  }
  if (!hasBall) {
    u.triple = 0;
    u.protect = false;
    if (u.post) {
      u.post = false;
      u.lookAlways = false;
    }
    // rebote ofensivo: X pula no tempo certo; pulando, A dá um tapinha para um companheiro
    const b = g.ball;
    if (b.state === 'loose' || b.state === 'shot') {
      if (g.btn.K.just) {
        reboundJump(g, u);
        return true;
      }
      if (g.btn.J.just && tipOut(g, u)) return true;
    }
    return false;
  }

  // ---- jogo de costas (segure LT / Q perto do garrafão)
  if (wantsPost(g) && !g.gathering && !(u.crossTimer > 0)) {
    u.protect = false;
    if (!u.post) {
      u.post = true;
      u.triple = 0;
      g.floatText(u.x, u.y - u.headY - 18, 'DE COSTAS', 0x6fa0ff);
    }
    const b = dirTo(u, g.basket);
    u.lookAt = { x: u.x - b.x * 20, y: u.y - b.y * 20 }; // de costas para a cesta
    u.lookAlways = true;
    const sm = g.stickMove;
    g.stickMove = null;
    // analógico direito girando: DREAM SHAKE
    if (sm && sm.kind === 'spin') {
      dreamShake(g, u, b);
      return true;
    }
    // analógico direito: para trás = vira de frente · para a cesta = força (hop) · para o lado = drop step
    // B = drop step (lado = o do analógico esquerdo, se houver)
    if ((sm && sm.kind === 'flick') || g.btn.L.just) {
      let sx = sm ? sm.sx : ix;
      let sy = sm ? sm.sy : iy;
      if (sm) [sx, sy] = g.screenToWorld(sx, sy);
      const tw = sm ? sx * b.x + sy * b.y : 0;
      if (tw < -0.5) {
        u.post = false;
        u.lookAlways = false;
        faceUp(g, u);
      } else if (tw > 0.6) {
        u.post = false;
        u.lookAlways = false;
        u.forceStyle = { style: 'hop' };
        g.startLayup(u);
      } else dropStep(g, u, Math.sign(sx * b.y - sy * b.x) || 1);
      return true;
    }
    // X: toque = finta (abre o up-and-under por 0,9 s) · segurando = gancho (perto) / fadeaway (longe)
    const now = g.time.now;
    if (g.btn.K.just) {
      if (now - (u.uauAt || -1e9) < 900) {
        upAndUnder(g, u);
        return true;
      }
      u.postKAt = now;
    }
    if (u.postKAt && g.btn.K.isDown && now - u.postKAt > 160) {
      u.postKAt = 0;
      if (b.d < HOOK_RANGE) postHook(g, u);
      else fadeaway(g, u);
      return true;
    }
    if (u.postKAt && !g.btn.K.isDown) {
      u.postKAt = 0;
      postFake(g, u);
      return true;
    }
    if (g.btn.J.just) {
      const t = g.choosePassTarget(u, moving ? { x: ix, y: iy } : { x: -b.x, y: -b.y });
      if (t) {
        u.post = false;
        u.lookAlways = false;
        g.doPass(u, t);
      }
      return true;
    }
    // andando para a cesta: empurra o marcador (devagar); para os lados: se ajeita
    if (moving) {
      u.moveDir(ix, iy, u.speed * 0.42, dt);
      const d = g.defenderOf(u);
      const toward = ix * b.x + iy * b.y;
      if (d && toward > 0.3 && d.distTo(u) < 15) {
        const str = 0.3 + (u.cm - d.cm) * 0.01 + (u.skills.finishing - d.skills.defense) * 0.5 + ((u.skills.strength || 1) - (d.skills.strength || 1)) * 0.6;
        if (Math.random() < clamp(str, 0.05, 0.75) * dt * 4) d.setPosition(d.x + b.x * 2.5, d.y + b.y * 2.5);
      }
    } else u.moveDir(0, 0, 0, dt);
    return true;
  }
  if (u.post) {
    u.post = false;
    u.lookAlways = false;
    // soltou o LT de costas: vira de frente para o aro (ameaça tripla), como no 2K
    if (!g.gathering && !(u.crossTimer > 0)) faceUp(g, u);
  }
  // ---- proteger a bola (LT longe do garrafão)
  protectBall(g, u, !!(g.btn.PROTECT && g.btn.PROTECT.isDown) && !g.gathering);
  if (u.protect) u.triple = 0;

  // ---- ameaça tripla (acabou de receber, ainda não quicou)
  if (u.triple > 0 && !g.gathering) {
    u.triple -= dt;
    const b = dirTo(u, g.basket);
    const sm = g.stickMove;
    if (sm && sm.kind === 'flick') {
      g.stickMove = null;
      const [fx, fy] = g.screenToWorld(sm.sx, sm.sy);
      if (fx * b.x + fy * b.y > 0.5) firstStep(g, u, b.x, b.y);
      else jab(g, u, Math.sign(fx * b.y - fy * b.x) || 1);
      return true;
    }
    if (g.btn.L.just) {
      jab(g, u, Math.sign(ix * b.y - iy * b.x) || 1);
      return true;
    }
    if (moving) {
      // sair andando para a cesta = arranque; para outro lado = começa a driblar
      if (ix * b.x + iy * b.y > 0.5) {
        firstStep(g, u, ix, iy);
        return true;
      }
      u.triple = 0;
    }
  }
  return false;
}

// ------------------------------------------------------------------ contato na infiltração
export function driveContact(g, u, dt) {
  u.contactCD = Math.max(0, (u.contactCD || 0) - dt);
  if (u.contactCD > 0 || u.post) return;
  const v = u.body.velocity;
  const vf = PLAYER.verticalFactor;
  const spd = Math.hypot(v.x, v.y / vf);
  if (spd < 60) return;
  const vx = v.x / spd;
  const vy = v.y / vf / spd;
  for (const d of g.defTeam) {
    if (d.stun > 0) continue;
    const dx = d.x - u.x;
    const dy = (d.y - u.y) / vf;
    const dist = Math.hypot(dx, dy);
    // (os corpos se tocam a ~11-12: detecta um pouco antes, ainda em velocidade)
    if (dist > 16 || dist < 0.01 || (dx * vx + dy * vy) / dist < 0.6) continue;
    const dv = d.body.velocity;
    const set = Math.hypot(dv.x, dv.y) < 30; // defensor plantado
    u.contactCD = 0.8;
    // (força do 2K27, quando houver: 0,7..1,3)
    const atk = u.skills.finishing + (u.cm - 195) * 0.01 + (u.sprinting ? 0.15 : 0) + ((u.skills.strength || 1) - 1) * 0.5;
    const def = d.skills.defense + (d.cm - 195) * 0.01 + (set ? 0.25 : 0) + ((d.skills.strength || 1) - 1) * 0.5;
    u.bumpAt = d.bumpAt = g.time.now;
    if (u === g.user) rumble(g, 0.55, 0.3, 140);
    // em sprint contra defensor plantado na frente (entre você e a cesta): pode ser falta de ataque
    if (set && u.sprinting && courtDist(d, g.basket) < courtDist(u, g.basket) && Math.random() < 0.2 * d.skills.defense) return offensiveFoul(g, u, d);
    g.floatText((u.x + d.x) / 2, Math.min(u.y, d.y) - 30, 'CONTATO', 0xffffff);
    sfx.play('bounce', 0.5);
    if (Math.random() * 0.5 + atk - def > 0.25) {
      d.stun = 0.45; // o atacante ganhou: o defensor desequilibra
      d.stop();
    } else {
      v.x *= 0.3; // o defensor segurou: você perde o embalo
      v.y *= 0.3;
      u.slowT = 0.35;
      u.crossTimer = 0;
    }
    return;
  }
}

// ------------------------------------------------------------------ janela do verde
// < 1 encolhe a janela: defensor perto, gás baixo, arremesso em movimento.
export function windowMult(g, u) {
  let m = 1;
  const dd = g.nearestDefenderDist(u);
  if (dd < 30) m *= 0.55 + 0.45 * (dd / 30);
  if (g.stamina < 40) m *= 0.75 + 0.25 * (g.stamina / 40);
  if ((u.gatherSpeed || 0) > 40) m *= 0.85;
  return m;
}

export const baseWindow = (u) => SHOT.perfectWindow * u.skills.perfectWindow;

// =====================================================================
//  DEFESA E REBOTE (leva 3)
// =====================================================================

// Contestação pela MÃO: colado de mão alta (ou pulando) contesta muito; colado de mão baixa, pouco.
export function handContest(g, shooter, openDist, minFactor) {
  const { d, dist } = g.nearestDefender(shooter);
  const f = clamp(dist / openDist, minFactor, 1);
  if (!d || dist >= openDist) return f;
  const u = g.user;
  // você: mão alta (Y / analógico D para cima) ou pulo (X); IA: levanta a mão quando chega perto
  const up = d === u ? u.handsT > g.time.now || g.userJumpT > 0 || u.pose === 'shoot' : dist < 22 && d.stun <= 0;
  const tall = (d.cm - shooter.cm) * 0.006;
  if (up) return clamp(f * clamp(0.8 + (dist / openDist) * 0.2 - tall, 0.6, 1), minFactor * 0.85, 1);
  return Math.min(1, f * 1.15 + 0.05); // mão baixa: só o corpo atrapalha
}

// ---- botões da defesa no 64:
//   LT  = DEFESA INTENSA no homem da bola (base baixa, deslize mais rápido, roubo melhor, gasta gás)
//         ou NEGAR a linha de passe do seu homem (fica entre ele e a bola)
//   B segurado parado = PLANTADO para cavar a falta de ataque
//   X = roubo · Y = pulo (toco, contestar, rebote) · analógico D para cima = mão alta
//   LB + botão do colega = ele dobra no homem da bola
// Devolve a velocidade de movimento (a defesa intensa desliza mais rápido).
export function defense64(g, u, handler, moving, dt, speed) {
  const lt = !!(g.btn.PROTECT && g.btn.PROTECT.isDown);
  const man = g.defenseAI.manOf(u);
  u.denyTarget = null;
  u.denying = false;
  // B segurado sem andar: plantado (a falta de ataque sai muito mais)
  u.chargeHold = g.btn.L.isDown && !moving ? (u.chargeHold || 0) + dt : 0;
  const was = u.planted;
  u.planted = u.chargeHold > 0.25;
  if (u.planted && !was) g.floatText(u.x, u.y - u.headY - 6, 'PLANTADO', 0x6fa0ff);
  if (lt && handler && (man === handler || u.distTo(handler) < 30) && g.stamina > 8) {
    if (!u.intenseD) g.floatText(u.x, u.y - u.headY - 6, 'DEFESA INTENSA', 0x6fa0ff);
    u.intenseD = true;
    g.stamina = Math.max(0, g.stamina - 26 * dt); // (o gás também recupera ~14/s: gasto líquido ~12/s)
    return speed * 1.15;
  }
  u.intenseD = false;
  if (lt && man && handler && man !== handler) {
    u.denying = true; // nega a linha: entre o seu homem e a bola, mais perto dele
    u.denyTarget = { x: man.x + (handler.x - man.x) * 0.25, y: man.y + (handler.y - man.y) * 0.25 };
  }
  return speed;
}

export function chooseDoubler64(g, face, handler) {
  const mate = g.home[face + 1];
  if (!mate || mate === g.user || !handler) return;
  g.defenseAI.double = null;
  g.defenseAI.doubleCd = 0;
  g.defenseAI.startDouble(mate, handler, 'DOBRA!');
  sfx.play('select');
}

// Roubo na HORA CERTA: a bola está exposta quando desce do lado em que você está.
export function stealTiming(g, u, h) {
  const b = g.ball;
  if (b.state !== 'held' || b.holder !== h) return 1;
  const mySide = Math.hypot(b.x - u.x, b.y - u.y) < Math.hypot(h.x - u.x, h.y - u.y);
  const low = b.z < 7; // fora da mão (descendo / no chão)
  if (mySide && low) return 1.8;
  if (!low) return 0.55; // bola na mão: quase impossível
  return 1;
}

// Dica visual no 3D: a bola brilha quando dá para roubar agora
export function stealCue(g) {
  const u = g.user;
  const b = g.ball;
  if (!g.userOnDefense || b.state !== 'held' || !b.holder || b.holder.team === u.team) return false;
  if (u.distTo(b.holder) > USER_DEFENSE.stealRange) return false;
  return stealTiming(g, u, b.holder) > 1.5;
}

// Você se mexendo ao trombar com quem infiltra: falta de bloqueio (a falta é sua)
export function blockingFoul(g, u, h, moving) {
  if (!moving || !h || !h.drive || (g.blockFoulCd || 0) > g.time.now) return;
  if (h.distTo(u) > 11 || courtDist(u, g.basket) > courtDist(h, g.basket)) return;
  g.blockFoulCd = g.time.now + 2500;
  u.bumpAt = h.bumpAt = g.time.now;
  g.maybeReachFoul(u, h); // ~30%: falta sua
}

// Infiltração em sprint contra defensor da IA plantado na frente: pode ser falta de ataque
function offensiveFoul(g, u, d) {
  sfx.play('whistle');
  g.floatText(u.x, u.y - u.headY - 14, 'FALTA DE ATAQUE', 0xff7b6b);
  if (u === g.pg) {
    g.stats.to++;
    g.gradeAdd(-3);
  }
  g.turnover(d, 'Falta de ataque', 0xff7b6b);
}

// ---- rebote: X pula (o alcance vem do tempo do pulo); pulando, A dá um tapinha para um companheiro
export function reboundJump(g, u) {
  if (g.userJumpT > 0) return;
  g.userJumpT = 0.45;
  u.lift = 8;
  u.setPose('shoot', 0.35);
}

// Alcance do rebote: no 64 o SEU jogador só alcança alto se pular na hora (a IA continua igual)
export function reachZ64(g, p, base) {
  if (p !== g.user) return base;
  return base - REBOUND.jumpReach + (g.userJumpT > 0 ? REBOUND.jumpReach + 8 : 0);
}

export function tipOut(g, u) {
  const b = g.ball;
  if (b.state !== 'loose' || g.userJumpT <= 0) return false;
  if (Math.hypot(b.x - u.x, b.y - u.y) > 14 || b.z > g.reachZ(u) + 4) return false;
  const mates = (u.team === 'home' ? g.home : g.away).filter((p) => p !== u);
  let best = null;
  let bd = Infinity;
  for (const m of mates) {
    const d = Math.hypot(m.x - u.x, m.y - u.y);
    if (d < bd) [bd, best] = [d, m];
  }
  if (!best) return false;
  const dx = (best.x - b.x) / (bd || 1);
  const dy = (best.y - b.y) / (bd || 1);
  b.loose(dx * 120, dy * 120, 30);
  b.lastTouch = u.team;
  u.noPickUntil = g.time.now + 350; // quem deu o tapinha não pega de volta na hora
  g.floatText(u.x, u.y - u.headY - 14, 'TAPINHA', 0x6fa0ff);
  sfx.play('bounce', 0.6);
  return true;
}

// ------------------------------------------------------------------ dribles novos (analógico direito)
// Combo: qualquer movimento logo depois de outro (até 0,9 s) desequilibra mais, até x4.
function comboStep(g, u) {
  const now = g.time.now;
  g.combo = now - (g.lastCross || 0) < 900 ? (g.combo || 1) + 1 : 1;
  g.lastCross = now;
  const size = g.sizeUpT > now ? 1.5 : 1;
  if (g.combo >= 2) g.floatText(u.x, u.y - u.headY - 28, `COMBO x${g.combo}`, 0x3ad6ff);
  return (1 + 0.35 * Math.min(3, g.combo - 1)) * size;
}

const MOVE_TIME = { legs: 0.26, behind: 0.3, snatch: 0.34 };

// kind: 'legs' (entre as pernas, parado: size-up que muda de mão) · 'behind' (atrás das costas,
// correndo: muda de mão sem perder velocidade) · 'snatch' (snatch back: puxa a bola e recua forte)
export function dribble64(g, u, kind, ix, iy) {
  const b = dirTo(u, g.basket);
  const ball = g.ball;
  u.dribMove = { kind, t0: g.time.now, dur: MOVE_TIME[kind] * 1000 };
  if (kind === 'legs') {
    ball.side *= -1;
    u.crossDir = { x: -b.y * ball.side * 0.4, y: b.x * ball.side * 0.4 };
    u.crossTimer = 0.14;
    u.crossCooldown = 0.32;
    g.sizeUpT = g.time.now + 1300;
    g.stamina = Math.max(0, g.stamina - STAMINA.crossCost * 0.45);
    g.floatText(u.x, u.y - u.headY - 18, 'ENTRE AS PERNAS', 0x6fa0ff);
    sfx.play('bounce', 0.7);
    return g.ankleCheck(0.55 * comboStep(g, u), 'BALANCOU!');
  }
  if (kind === 'behind') {
    ball.side *= -1;
    const l = Math.hypot(ix, iy) || 1;
    const dx = ix / l + -iy / l * ball.side * 0.45;
    const dy = iy / l + ix / l * ball.side * 0.45;
    const dl = Math.hypot(dx, dy) || 1;
    u.crossDir = { x: dx / dl, y: dy / dl };
    u.crossTimer = 0.28;
    u.crossCooldown = 0.45;
    g.stamina = Math.max(0, g.stamina - STAMINA.crossCost * 1.1);
    g.floatText(u.x, u.y - u.headY - 18, 'ATRAS DAS COSTAS', 0x6fa0ff);
    sfx.play('cross');
    return g.ankleCheck(1.0 * comboStep(g, u), 'QUEBROU!');
  }
  // snatch back: recuo longo e firme, abre espaço para o arremesso
  u.crossDir = { x: -b.x, y: -b.y };
  u.crossTimer = 0.32;
  u.crossCooldown = 0.6;
  g.stamina = Math.max(0, g.stamina - STAMINA.crossCost * 1.2);
  g.floatText(u.x, u.y - u.headY - 18, 'SNATCH BACK', 0x6fa0ff);
  sfx.play('cross');
  g.ankleCheck(0.75 * comboStep(g, u), 'RECUOU!');
}

// ------------------------------------------------------------------ bloqueio no RB: rolar / abrir / slip
function screener64(g) {
  const u = g.user;
  let best = null;
  for (const p of g.home) {
    if (p === u || !p.motion || p.motion.action !== 'ballscreen') continue;
    if (!best || p.distTo(u) < best.distTo(u)) best = p;
  }
  return best;
}

const SCREEN_LABEL = { roll: 'ROLA!', pop: 'ABRE!', slip: 'SLIP!' };

function screenOption(g, opt) {
  if (!opt) return;
  const p = screener64(g);
  if (!p) {
    // ninguém vindo ainda: chama o bloqueio e já guarda a escolha
    if (g.callScreen) g.callScreen();
  }
  const s = p || screener64(g);
  if (!s) return;
  s.screenOpt = opt;
  g.floatText(s.x, s.y - s.headY - 16, SCREEN_LABEL[opt], 0x3ad6ff);
  sfx.play('select');
  if (opt === 'slip') {
    // slip: nem encosta, corta direto para a cesta
    s.body.pushable = true;
    Object.assign(s.motion, { action: 'cut', phase: 0, t: 2.4, holdT: undefined, backdoor: false, slot: null, mate: null });
    s.screenOpt = null;
  } else if (opt === 'pop' && s.motion.phase > 0) openToThree(g, s);
}

function openToThree(g, p) {
  const taken = new Set(g.offTeam.filter((o) => o !== p && o.motion).map((o) => o.motion.slot));
  let best = THREE_SPOTS[0];
  let bd = Infinity;
  for (const s of THREE_SPOTS) {
    if (taken.has(s)) continue;
    const pt = g.slot(s);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d < bd) [bd, best] = [d, s];
  }
  p.body.pushable = true;
  Object.assign(p.motion, { action: 'spot', slot: best, phase: 0, t: 4, holdT: undefined, fastT: 1.4, mate: null });
  p.screenOpt = null;
}

// depois do contato do bloqueio: quem escolheu "abrir" vai para o 3 (rolar é o padrão)
function watchScreen(g) {
  for (const p of g.home) {
    if (!p.screenOpt || !p.motion) continue;
    if (p.motion.action !== 'ballscreen') p.screenOpt = null;
    else if (p.screenOpt === 'pop' && p.motion.phase > 0) openToThree(g, p);
  }
}

// ------------------------------------------------------------------ tabela (give-and-go)
// Passou para um colega e apertou A de novo (sem a bola) em até 3 s: ele devolve na hora,
// à frente de você se estiver correndo.
function giveAndGo(g, hasBall) {
  const u = g.user;
  const b = g.ball;
  const now = g.time.now;
  if (!u || g.userOnDefense) return;
  if (b.state === 'pass' && b.passFrom === u && b.passTo) g.lastPass64 = { to: b.passTo, at: now };
  const lp = g.lastPass64;
  if (!lp || hasBall || now - lp.at > 3000 || !g.btn.J.just) return;
  const h = b.state === 'held' ? b.holder : null;
  if (h !== lp.to || h === u || h.team !== u.team || g.inbound || h.layupT > 0 || h.pose === 'shoot') return;
  g.lastPass64 = null;
  g.floatText(h.x, h.y - h.headY - 12, 'TABELA!', 0x3ad6ff);
  h.drive = null;
  g.giveGoAt = now;
  g.doPass(h, u);
}

// ------------------------------------------------------------------ passes do 64 (você passando)
// handoff: colega colado (entrega na mão, quase impossível de cortar)
// vistoso (A segurado + Y): sem olhar, mais rápido e a defesa lê pior
export function passMods64(g, from, to, opts) {
  const r = { mult: 1, speed: 1 };
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d < 20 && !opts.bounce && !g.ball.lob) {
    r.mult = 0.1;
    r.speed = 1.5;
    g.floatText(from.x, from.y - from.headY - 14, 'HANDOFF', 0x6fa0ff);
    return r;
  }
  if (opts.flashy) {
    r.mult = 0.65;
    r.speed = 1.25;
    from.flashyAt = g.time.now;
    g.floatText(from.x, from.y - from.headY - 14, 'PASSE VISTOSO', 0xffe14d);
  }
  return r;
}

// ------------------------------------------------------------------ TAKEOVER (L3 + R3)
// Jogadas boas enchem a barra (pontos, assistências, roubos, tocos, tornozelos quebrados).
// Cheia: L3 + R3 (teclado: T) ativa por 20 s — chute, finalização, drible e velocidade melhores.
const TK_TIME = 20;
const TK_GAIN = { pts: 0.06, ast: 0.18, stl: 0.2, blk: 0.2, ankle: 0.15 };

export function takeoverTick(g) {
  const u = g.pg;
  if (!u || !g.stats) return;
  const tk = g.tk64 || (g.tk64 = { meter: 0, active: 0, prev: { ...g.stats }, orig: null });
  const dt = Math.min(0.1, (g.game.loop.delta || 16) / 1000);
  if (tk.active <= 0) {
    for (const k of ['pts', 'ast', 'stl', 'blk']) {
      const d = (g.stats[k] || 0) - (tk.prev[k] || 0);
      if (d > 0) tk.meter = Math.min(1, tk.meter + d * TK_GAIN[k]);
    }
    if (g.ankles64 > (tk.ankles || 0)) tk.meter = Math.min(1, tk.meter + TK_GAIN.ankle);
    if (tk.meter >= 1 && !tk.readyShown) {
      tk.readyShown = true;
      // faixa no meio da tela (o toast do topo era coberto pelas dicas do técnico)
      g.events.emit('banner', 'TAKEOVER PRONTO', 'aperte L3 + R3 juntos (teclado: T)', 0xff8a2a, 2.2);
      sfx.play('life');
      rumble(g, 0.4, 0.4, 200);
    }
  }
  tk.ankles = g.ankles64 || 0;
  tk.prev = { ...g.stats };
  // L3 + R3 (sozinhos eles continuam sendo replay / página, mas só ao soltar)
  const l3 = g.btn.REPLAY;
  const r3 = g.btn.PAGE;
  const both = l3.isDown && r3.isDown;
  const keyT = g.keyT64 || (g.keyT64 = g.input.keyboard.addKey('T', false));
  if ((both && !g.l3r3) || Phaser_JustDown(keyT)) startTakeover(g, tk);
  if (both) g.l3r3 = true;
  const delay = (b, arm) => {
    if (b.just && b.isDown) {
      g[arm] = true;
      b.just = false;
    }
    if (b.up && g[arm]) {
      if (!g.l3r3) b.just = true;
      g[arm] = false;
    }
  };
  delay(l3, 'l3Arm');
  delay(r3, 'r3Arm');
  if (!l3.isDown && !r3.isDown) g.l3r3 = false;
  if (tk.active > 0) {
    tk.active -= dt;
    tk.meter = Math.max(0, tk.active / TK_TIME);
    if (tk.active <= 0) endTakeover(g, tk);
  }
}

function Phaser_JustDown(key) {
  if (!key || !key.isDown) {
    if (key) key._t64 = false;
    return false;
  }
  if (key._t64) return false;
  key._t64 = true;
  return true;
}

function startTakeover(g, tk) {
  if (tk.active > 0 || tk.meter < 1 || g.state !== 'live') return;
  const u = g.pg;
  tk.active = TK_TIME;
  tk.readyShown = false;
  tk.orig = u.skills;
  const s = u.skills;
  u.skills = { ...s, three: s.three * 1.1, mid: s.mid * 1.1, finishing: s.finishing * 1.1, crossAnkle: s.crossAnkle * 1.4, perfectWindow: s.perfectWindow * 1.35, speed: s.speed * 1.05 };
  tk.baseSpeed = u.baseSpeed;
  if (u.baseSpeed) u.baseSpeed *= 1.05; // (a velocidade fica guardada no jogador)
  g.floatText(u.x, u.y - u.headY - 24, 'TAKEOVER!', 0xff8a2a);
  g.events.emit('banner', 'TAKEOVER!', '20 segundos de fogo', 0xff8a2a, 1.4);
  sfx.play('cheer');
  rumble(g, 0.9, 0.6, 400);
}

function endTakeover(g, tk) {
  tk.active = 0;
  tk.meter = 0;
  if (tk.orig) g.pg.skills = tk.orig;
  if (tk.baseSpeed) g.pg.baseSpeed = tk.baseSpeed;
  tk.baseSpeed = null;
  tk.orig = null;
}

// ------------------------------------------------------------------ vibração do controle
export function rumble(g, strong, weak, ms) {
  if (g && g.lastInputPad === false) return;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('rumble3d') === 'off') return;
  } catch (e) {
    /* sem storage: vibra */
  }
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  for (const p of pads) {
    const a = p.vibrationActuator;
    if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  }
}

// ------------------------------------------------------------------ arranque do drible (você, no 64)
// Mais curto que no 16-bit e ajustado pela nota de drible: bons dribladores fazem o movimento
// rápido e curto; o analógico esquerdo ainda orienta um pouco; perto da linha, o arranque
// desliza ao longo dela em vez de levar você para fora (antes virava 'Pisou fora!').
export function dribbleBurst64(g, u, ix, iy, moving, dt) {
  const q = clamp(((u.skills.handle ?? 75) - 55) / 44, 0, 1);
  u.crossTimer = Math.max(0, u.crossTimer - dt * 0.35 * q); // (elite termina antes)
  let dx = u.crossDir.x;
  let dy = u.crossDir.y;
  if (moving) {
    dx = dx * 0.7 + ix * 0.3;
    dy = dy * 0.7 + iy * 0.3;
  }
  const M = 16;
  const bottom = (g.street ? MID_Y : COURT.bottom) - M;
  if ((u.x < COURT.left + M && dx < 0) || (u.x > COURT.right - M && dx > 0)) dx = 0;
  if ((u.y < COURT.top + M && dy < 0) || (u.y > bottom && dy > 0)) dy = 0;
  const l = Math.hypot(dx, dy);
  if (l < 0.05) return u.moveDir(0, 0, 0, dt * 4);
  u.moveDir(dx / l, dy / l, u.speed * CROSSOVER.burstMult * (0.55 + 0.15 * q), dt * 3);
}

// recarga entre dribles pela nota de drible: elite (~97) encadeia em ~0,45 s; fraco (~60) ~0,8 s
export const dribbleCd64 = (u) => 1.1 - 0.5 * clamp(((u.skills.handle ?? 75) - 55) / 44, 0, 1);
