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
import { SHOT, STAMINA, PLAYER, USER_DEFENSE, REBOUND } from '../config.js';
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

// ------------------------------------------------------------------ jogo de costas
export function wantsPost(g) {
  const u = g.user;
  return !!(u && !g.userOnDefense && g.ball.holder === u && g.ball.state === 'held' && g.btn.VISION && g.btn.VISION.isDown && distToBasket(u, g.dir) < POST_RANGE);
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
  const dunk = (fin >= 0.95 || p.cm >= 196) && Math.random() < 0.7;
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
    // drop step: analógico direito para o lado ou B (lado = o do analógico esquerdo, se houver)
    if ((sm && sm.kind === 'flick') || g.btn.L.just) {
      let sx = sm ? sm.sx : ix;
      let sy = sm ? sm.sy : iy;
      if (sm) [sx, sy] = g.screenToWorld(sx, sy);
      const side = Math.sign(sx * b.y - sy * b.x) || 1;
      dropStep(g, u, side);
      return true;
    }
    if (g.btn.K.just) {
      if (b.d < HOOK_RANGE) postHook(g, u);
      else fadeaway(g, u);
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
        const str = 0.3 + (u.cm - d.cm) * 0.01 + (u.skills.finishing - d.skills.defense) * 0.5;
        if (Math.random() < clamp(str, 0.05, 0.75) * dt * 4) d.setPosition(d.x + b.x * 2.5, d.y + b.y * 2.5);
      }
    } else u.moveDir(0, 0, 0, dt);
    return true;
  }
  if (u.post) {
    u.post = false;
    u.lookAlways = false;
  }

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
    const atk = u.skills.finishing + (u.cm - 195) * 0.01 + (u.sprinting ? 0.15 : 0);
    const def = d.skills.defense + (d.cm - 195) * 0.01 + (set ? 0.25 : 0);
    u.bumpAt = d.bumpAt = g.time.now;
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
