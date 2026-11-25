import { BASKET, COURT, OFFENSE, PASS, PLAYER } from '../config.js';
import { clamp, distToBasket, inBackcourt, isLayupZone, isThree, rand } from '../utils/math.js';
import { BASE_SLOTS } from '../plays/spots.js';
import MotionOffense from './MotionOffense.js';
import { nearestN } from './util.js';

// =====================================================================
//  IA DO ATAQUE — seus 4 companheiros e o time adversário inteiro.
//  Prioridade (exceto você):
//    com a bola -> condutor (subir a bola, sondar, arremessar, infiltrar, passar)
//    recebendo passe -> espera
//    bola solta -> rebote
//    arremesso no ar -> grandalhões no rebote
//    campo de defesa -> corre para o ataque (transição)
//    jogada chamada -> segue a jogada
//    senão -> movimentação livre (MotionOffense)
// =====================================================================
export default class OffenseAI {
  constructor(game) {
    this.game = game;
    this.motion = new MotionOffense(game);
  }

  reset() {
    this.motion.reset(this.game.offTeam);
  }

  update(dt) {
    const g = this.game;
    const ball = g.ball;
    const team = g.offTeam;
    const ai = team.filter((p) => p !== g.user);
    const rspot = ball.state === 'loose' ? g.reboundSpot() : null;
    const chasers = rspot ? nearestN(ai, rspot, OFFENSE.reboundChasers) : [];
    const holder = ball.state === 'held' && ball.holder.team === g.offSide ? ball.holder : null;
    const play = g.play;

    for (const p of ai) {
      p.lookAlways = false;
      p.lookAt = holder && holder !== p ? holder : g.basket;
      if (p.layupT > 0) continue;

      if (holder === p) {
        p.body.pushable = true;
        this.withBall(p, dt);
        continue;
      }
      if (ball.state === 'pass' && ball.passTo === p) {
        p.lookAt = ball;
        p.moveDir(0, 0, 0, dt);
        continue;
      }
      if (ball.state === 'loose' && chasers.includes(p)) {
        p.body.pushable = true;
        p.lookAt = ball;
        p.seek(rspot, p.run(p.speed * Math.sqrt(p.skills.rebounding), Math.hypot(rspot.x - p.x, rspot.y - p.y) > 14), dt, null, 3);
        continue;
      }
      if ((ball.state === 'shot' || ball.state === 'drop') && (p.role === 'C' || p.role === 'PF' || (p.role === 'SF' && distToBasket(p, g.dir) < 120))) {
        p.body.pushable = true;
        const side = p.role === 'C' ? 1 : p.role === 'PF' ? -1 : 0;
        p.seek(g.toWorld({ x: BASKET.x + side * 16, y: BASKET.y + (side ? 26 : 40) }), p.run(p.speed, true), dt, p.separation(team));
        continue;
      }
      // Transição: ainda no campo de defesa -> corre para a vaga no ataque
      if (inBackcourt(p, g.dir)) {
        p.body.pushable = true;
        const slot = (p.motion && p.motion.slot) || BASE_SLOTS[p.role];
        const to = g.slot(slot);
        // transição: corre (sprint) enquanto estiver longe da vaga, se tiver gás
        p.seek(to, p.run(p.speed, Math.hypot(to.x - p.x, to.y - p.y) > 70), dt, p.separation(team), 10);
        continue;
      }

      let tgt = null;
      let fast = false;
      let hold = false;
      if (play && play.holds(p.role)) hold = true;
      else if (play && (tgt = play.target(p.role))) fast = play.isFast(p.role);
      else {
        const m = this.motion.target(p, dt);
        if (m.hold) hold = true;
        else {
          tgt = m;
          fast = m.fast;
        }
      }
      p.body.pushable = !hold;
      if (hold) {
        p.moveDir(0, 0, 0, dt * 3);
        continue;
      }
      p.seek(tgt, p.run(p.speed, fast), dt, p.separation(team), 10);
    }
  }

  // ------------------------------------------------------------ condutor
  withBall(p, dt) {
    const g = this.game;
    p.lookAt = g.basket;
    if (p.pose === 'shoot') {
      p.moveDir(0, 0, 0, dt);
      return;
    }
    if (g.inbound) {
      // reposição: caminha até o ponto e espera parado até passar
      if (g.inbound.walk) p.seek(g.inbound.spot, p.run(p.speed, true), dt, null, 4);
      else p.moveDir(0, 0, 0, dt);
      return;
    }
    // Rua 3x3: depois de rebote de defesa/roubo, leva a bola para fora do arco (ou passa para quem está lá)
    if (g.needClear && !isThree(p, g.dir)) {
      p.drive = null;
      p.decideTimer -= dt;
      if (p.decideTimer <= 0) {
        p.decideTimer = rand(0.3, 0.6);
        const out = g.offTeam.find((t) => t !== p && isThree(t, g.dir) && g.nearestDefenderDist(t) > 22 && g.laneRisk(p, t) > 12);
        if (out && Math.random() < 0.6) return g.doPass(p, out);
      }
      p.seek(g.clearSpot(p), p.run(p.speed, true), dt, null, 6);
      return;
    }
    // Jogada SEM bola do armador: quem recebeu segura e devolve quando a leitura abrir
    if (g.play && g.play.offBall && p.role !== 'PG' && !inBackcourt(p, g.dir)) return this.playHolder(p, dt);
    if (p.drive) return this.driving(p, dt);
    p.decideTimer -= dt;

    // Você pediu a bola (J sem a bola)
    if (p.team === 'home' && g.userCalling && p.decideTimer < OFFENSE.decideMax - 0.25) {
      g.doPass(p, g.user);
      return;
    }

    // Transição: subir a bola
    if (inBackcourt(p, g.dir)) {
      const pg = g.offTeam[0];
      // quem não é o armador entrega para ele (passe de saída)
      if (p !== pg && p.decideTimer < OFFENSE.decideMax - 0.3 && g.laneRisk(p, pg) > 10) {
        g.doPass(p, pg);
        return;
      }
      // contra-ataque: se ninguém está na frente, sobe a bola correndo
      p.seek(g.toWorld({ x: clamp(p.x, 140, 340), y: 228 }), p.run(p.speed, g.nearestDefenderDist(p) > 30), dt, null, 8);
      // contra-ataque: se alguém está livre na frente, lança
      if (p.decideTimer <= 0) {
        p.decideTimer = rand(0.4, 0.7);
        const ahead = g.offTeam.find((t) => t !== p && !inBackcourt(t, g.dir) && distToBasket(t, g.dir) < 90 && g.nearestDefenderDist(t) > 30);
        if (ahead && g.laneRisk(p, ahead) > 12) g.doPass(p, ahead);
      }
      return;
    }

    // Dobrado: decide rápido e procura o passe
    const doubled = g.isDoubled(p);
    if (doubled && p.decideTimer > 0.25) p.decideTimer = 0.25;
    // nada entre ele e o aro: não fica sondando, ataca já
    if (!doubled && p.decideTimer > 0 && distToBasket(p, g.dir) < 170 && this.pathClear(p, 18)) {
      p.drive = { t: 0, off: rand(-5, 5) };
      return;
    }
    if (p.decideTimer > 0 && g.shotClock > 2.5) {
      this.probe(p, dt);
      return;
    }
    this.decide(p, doubled);
  }

  playHolder(p, dt) {
    const g = this.game;
    p.lookAt = g.basket;
    // relógio acabando: esquece a jogada
    if (g.shotClock < 4) {
      g.play.finish();
      return;
    }
    p.moveDir(0, 0, 0, dt);
    p.decideTimer -= dt;
    if (p.decideTimer > 0) return;
    p.decideTimer = 0.18;
    for (const t of g.play.options()) {
      if (t === p) continue;
      const close = Math.hypot(t.x - p.x, t.y - p.y) < 20; // mão em mão
      // o armador recebe quando chega no ponto da jogada (ex.: saiu dos bloqueios na linha de 3)
      const spot = t.role === 'PG' ? g.play.target('PG') : null;
      if (spot && !close && Math.hypot(t.x - spot.x, t.y - spot.y) > 22) continue;
      if (close || (g.nearestDefenderDist(t) > 17 && g.laneRisk(p, t) > 9)) {
        g.doPass(p, t);
        if (close) g.floatText(p.x, p.y - p.headY - 6, 'MAO EM MAO', 0x6fa0ff);
        return;
      }
    }
  }

  probe(p, dt) {
    if (!p.probe || p.probeT <= 0) {
      p.probeT = rand(0.35, 0.8);
      p.probe = {
        x: clamp(p.x + rand(-14, 14), COURT.left + 10, COURT.right - 10),
        y: clamp(p.y + rand(-6, 6), COURT.top + 10, COURT.bottom - 10),
      };
    }
    p.probeT -= dt;
    p.seek(p.probe, p.speed * 0.6, dt, null, 6);
  }

  // O marcador está entre o condutor e a cesta?
  laneOpen(p) {
    const g = this.game;
    const d = g.defenderOf(p);
    if (!d || d.stun > 0) return true;
    const ux = g.basket.x - p.x;
    const uy = g.basket.y - p.y;
    const l = Math.hypot(ux, uy) || 1;
    const vx = d.x - p.x;
    const vy = d.y - p.y;
    const along = (vx * ux + vy * uy) / l;
    const lateral = Math.abs(vx * uy - vy * ux) / l;
    return !(along > -2 && along < 40 && lateral < 12);
  }

  // Caminho até o aro livre de QUALQUER defensor (não só o marcador)?
  pathClear(p, width = 16) {
    const g = this.game;
    const ux = g.basket.x - p.x;
    const uy = g.basket.y - p.y;
    const l = Math.hypot(ux, uy) || 1;
    for (const d of g.defTeam) {
      if (d.stun > 0) continue;
      const vx = d.x - p.x;
      const vy = d.y - p.y;
      const along = (vx * ux + vy * uy) / l;
      const lateral = Math.abs(vx * uy - vy * ux) / l;
      if (along > -4 && along < l && lateral < width) return false;
    }
    return true;
  }

  // Marcador vindo correndo para fechar (closeout): hora de passar por ele.
  closingOut(p) {
    const d = this.game.defenderOf(p);
    if (!d || d.stun > 0) return false;
    const dist = Math.hypot(d.x - p.x, d.y - p.y);
    if (dist > 45 || dist < 8) return false;
    const v = d.body.velocity;
    const toward = (v.x * (p.x - d.x) + v.y * (p.y - d.y)) / dist;
    return toward > 55;
  }

  // Companheiro cortando para o aro, livre, que pode receber uma ponte aérea.
  alleyTarget(p) {
    const g = this.game;
    for (const t of g.offTeam) {
      if (t === p || t === g.user || inBackcourt(t, g.dir)) continue;
      if (t.skills.finishing < 1.08 || t.cm < 198) continue;
      const db = distToBasket(t, g.dir);
      if (db > 75 || db < 18) continue;
      const v = t.body.velocity;
      const toRim = (v.x * (g.basket.x - t.x) + v.y * (g.basket.y - t.y)) / (db || 1);
      if (toRim < 35 || g.nearestDefenderDist(t) < 18) continue;
      if (g.laneRisk(p, t) < 12) continue;
      return t;
    }
    return null;
  }

  shootSkill(p) {
    return isThree(p, this.game.dir) ? p.skills.three : p.skills.mid;
  }

  decide(p, doubled = false) {
    const g = this.game;
    p.decideTimer = rand(OFFENSE.decideMin, OFFENSE.decideMax);
    const open = g.nearestDefenderDist(p);
    const d = distToBasket(p, g.dir);
    const lane = this.laneOpen(p);
    const catchShoot = p.catchShoot;
    p.catchShoot = false;

    if (isLayupZone(p, g.dir) && !doubled) return g.startLayup(p);
    if (g.shotClock < 3) {
      if (lane && d < 120) p.drive = { t: 0, off: 0 };
      else g.aiShoot(p);
      return;
    }

    // --- instinto de pontuar (antes de pensar em passe) ---
    // caminho livre até o aro: ataca na hora
    if (!doubled && d < 230 && this.pathClear(p)) {
      p.drive = { t: 0, off: rand(-5, 5) };
      return;
    }
    // marcador chegando correndo: passa por ele
    if (!doubled && d < 200 && this.closingOut(p) && Math.random() < 0.75 * p.skills.finishing) {
      p.drive = { t: 0, off: rand(-14, 14) };
      return;
    }
    // ponte aérea para um grandalhão cortando livre
    const lobT = !doubled && Math.random() < 0.55 * p.skills.passing ? this.alleyTarget(p) : null;
    if (lobT) {
      g.ball.lob = true;
      g.doPass(p, lobT);
      return;
    }

    // segurar/ler tem peso; cada passe na posse deixa o time mais agressivo
    let best = { type: 'hold', score: doubled ? 0.05 : 0.3 + 0.12 * (g.passCount || 0) };
    const consider = (c) => {
      if (c.score > best.score) best = c;
    };
    const skill = this.shootSkill(p);
    if (d < OFFENSE.shootRange * (skill > 1.1 ? 1.12 : 1)) {
      const q = clamp((open - 12) / OFFENSE.openDist, 0, 1.3) * skill;
      // livre e dentro do alcance: arremessa sem pensar duas vezes
      const wideOpen = open >= OFFENSE.openDist && skill >= 0.95 ? 0.5 : 0;
      consider({ type: 'shoot', score: (catchShoot ? 0.35 : 0) + wideOpen + (q > 0.55 ? q + 0.15 : 0) * rand(0.85, 1.15) });
    }
    const patience = 0.06 * (g.passCount || 0);
    if (!doubled) {
      const helpFar = this.pathClear(p, 10) ? 0.25 : 0;
      consider({ type: 'drive', score: ((lane ? 1.0 : 0.15) + helpFar + patience) * p.skills.finishing * (d < 200 ? 1 : 0.6) * rand(0.85, 1.15) });
    }
    // passar custa: só passa se for CLARAMENTE melhor (dobra = passe é a saída)
    const passCost = doubled ? -0.3 : 0.2;
    for (const t of g.offTeam) {
      if (t === p) continue;
      consider({ type: 'pass', score: this.passScore(p, t) - passCost, to: t });
    }

    // passe com a linha meio fechada: às vezes finta antes de passar
    if (best.type === 'pass' && g.laneRisk(p, best.to) < 12 && !p.faked && Math.random() < 0.35) {
      p.faked = true;
      g.aiPassFake(p, best.to);
      p.decideTimer = 0.25;
      return;
    }
    p.faked = false;
    if (best.type === 'shoot') g.aiShoot(p);
    else if (best.type === 'drive') p.drive = { t: 0, off: lane ? rand(-6, 6) : rand(-18, 18) };
    else if (best.type === 'pass') g.doPass(p, best.to);
  }

  passScore(p, t) {
    const g = this.game;
    const len = Math.hypot(t.x - p.x, t.y - p.y);
    if (len > PASS.maxDist) return -1;
    if (inBackcourt(t, g.dir)) return -1; // não volta a bola para o campo de defesa
    const open = g.nearestDefenderDist(t);
    let s = clamp((open - 10) / 40, 0, 1.1);
    if (open < g.nearestDefenderDist(p) + 8) s -= 0.25;
    const risk = g.laneRisk(p, t);
    if (risk < 8) s -= 0.7;
    else if (risk < 14) s -= 0.3;
    if (distToBasket(t, g.dir) < 60 && open > 16) s += 0.45 * t.skills.finishing;
    // atirador livre fora da linha de 3 vale mais
    if (open > 26 && isThree(t, g.dir)) s += 0.25 * (t.skills.three - 0.9);
    if (g.play && g.play.options().includes(t)) s += 0.3;
    if (t === g.user) s += OFFENSE.returnPassBias;
    return s * rand(0.85, 1.15);
  }

  driving(p, dt) {
    const g = this.game;
    const dr = p.drive;
    dr.t += dt;
    // no começo da infiltração, se o marcador está colado: drible (crossover, hesitação ou giro)
    if (!dr.moved && dr.t > 0.08) {
      dr.moved = true;
      if (Math.random() < 0.45 * p.skills.passing * (p.role === 'PG' || p.role === 'SG' ? 1.3 : 0.7) && g.aiDribble(p)) dr.burst = 0.25;
    }
    if (dr.burst > 0) dr.burst -= dt;
    p.seek(g.toWorld({ x: BASKET.x + dr.off, y: BASKET.y + 16 }), p.run(p.speed, true) * (dr.burst > 0 ? 1.35 : 1), dt, null, 4);
    if (isLayupZone(p, g.dir)) {
      p.drive = null;
      const myDef = g.defenderOf(p);
      const helper = g.defTeam.find((d) => d !== myDef && d.stun <= 0 && Math.hypot(d.x - p.x, d.y - p.y) < 18);
      if (helper && Math.random() < 0.6 * p.skills.passing) {
        let best = null;
        let bs = 0.55;
        for (const t of g.offTeam) {
          if (t === p) continue;
          const s = this.passScore(p, t);
          if (s > bs) {
            bs = s;
            best = t;
          }
        }
        if (best) return g.doPass(p, best);
      }
      g.startLayup(p);
      return;
    }
    const d = g.defenderOf(p);
    if (dr.t > OFFENSE.driveTimeMax || (dr.t > 0.5 && d && d.stun <= 0 && !this.laneOpen(p))) {
      p.drive = null;
      p.decideTimer = rand(0.1, 0.3);
    }
  }
}
