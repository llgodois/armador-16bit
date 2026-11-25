import { DEFENSE, DOUBLE, PASS, PLAYER, TRANSITION } from '../config.js';
import { clamp, closestOnSegment, courtDist, distToBasket, inBackcourt, isThree, lerp, rand } from '../utils/math.js';
import { bestRating } from '../data/teams.js';
import { ZONE_SPOTS } from '../data/defense.js';
import { nearestN } from './util.js';

// =====================================================================
//  IA DA DEFESA — marca o time que ataca, seguindo o ESQUEMA do time
//  (data/defense.js): individual, trocas, hedge, dobrar no armador,
//  zona 2-3 ou pressão. Além disso:
//   - lê o estilo de cada atacante (cola em atirador, dá espaço a quem não arremessa)
//   - dobra em jogadores perigosos
//   - ajuda na infiltração, fecha em quem recebeu
//   - VOLTA NA MARCAÇÃO: depois de perder a bola, quem está atrás corre para
//     proteger a cesta e cada um pega o atacante mais perigoso mais perto
//  O defensor que VOCÊ controla nunca é movido nem trocado pela IA.
// =====================================================================
export default class DefenseAI {
  constructor(game) {
    this.game = game;
    this.assign = new Map();
    this.helper = null;
    this.double = null;
    this.doubleCd = 0;
    this.evalHolder = null;
    this.forceDouble = 0;
    this.transitionT = 0;
    this.rematchT = 0;
    this.pnr = null; // { handler, screener, t }
  }

  scheme() {
    return this.game.defScheme();
  }

  // Multiplicadores de dificuldade (só para o time adversário).
  diff(key) {
    const g = this.game;
    return g.defTeam === g.away ? g.difficulty[key] : 1;
  }

  reset(keepPositions = true) {
    const g = this.game;
    this.assign.clear();
    g.defTeam.forEach((d, i) => this.assign.set(d, g.offTeam[i]));
    this.double = null;
    this.evalHolder = null;
    this.pnr = null;
    this.transitionT = keepPositions ? TRANSITION.time : 0;
    this.rematchT = 0;
    for (const d of g.defTeam) {
      d.track = null;
      d.transT = keepPositions ? DEFENSE.transitionDelay * rand(0.6, 1.4) : 0;
      if (!keepPositions) {
        const t = this.guardSpot(d, true);
        d.setPosition(t.x, t.y);
      }
    }
  }

  manOf(d) {
    return this.assign.get(d);
  }

  defenderOf(attacker) {
    for (const [d, a] of this.assign) if (a === attacker) return d;
    return null;
  }

  swap(d1, d2) {
    const a1 = this.assign.get(d1);
    this.assign.set(d1, this.assign.get(d2));
    this.assign.set(d2, a1);
  }

  speedOf(d) {
    let s = d.speed * PLAYER.aiDefSpeedMult * (0.9 + 0.1 * d.skills.defense) * this.diff('def');
    if (d.transT > 0) s *= 0.85; // reação curta ao perder a bola
    return s;
  }

  threat(p) {
    return (bestRating(p.info) - 60) / 40;
  }

  // ------------------------------------------------------------ volta na marcação
  // Greedy: os atacantes mais perto da cesta (mais perigosos) são pegos primeiro
  // pelo defensor livre mais próximo. Você continua no armador.
  rematch() {
    const g = this.game;
    const B = g.basket;
    // Inclui você: na transição você pode acabar marcando outro (o losango vermelho mostra quem).
    const freeDef = g.defTeam.filter((d) => d.stun <= 0);
    const handler = g.ball.state === 'held' && g.ball.holder.team === g.offSide ? g.ball.holder : null;
    const attackers = [...g.offTeam].sort((a, b) => {
      // 1º parar a bola, depois quem está mais perto da cesta / mais perigoso
      if (a === handler) return -1;
      if (b === handler) return 1;
      return courtDist(a, B) - this.threat(a) * 30 - (courtDist(b, B) - this.threat(b) * 30);
    });
    for (const a of attackers) {
      let best = null;
      let bd = Infinity;
      for (const d of freeDef) {
        const dd = Math.hypot(d.x - a.x, d.y - a.y);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (!best) break;
      this.assign.set(best, a);
      freeDef.splice(freeDef.indexOf(best), 1);
    }
  }

  guardSpot(d, ignoreHelp = false) {
    const g = this.game;
    const realMan = this.assign.get(d);
    const man = ignoreHelp || !d.track ? realMan : d.track;
    const ball = g.ball;
    const B = g.basket;
    const hasBall = ball.holder === realMan && ball.state === 'held';
    let dx = B.x - man.x;
    let dy = B.y - man.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const three = realMan.r.three;
    const shooter = three >= 85 && distToBasket(realMan, g.dir) < 210;
    const nonShooter = three < 62;
    const press = this.scheme().press && inBackcourt(realMan, g.dir);
    let gap = hasBall ? (shooter || press ? DEFENSE.shooterBallGap : DEFENSE.ballGap) : DEFENSE.offGap * (shooter || press ? 0.75 : 1);
    if (hasBall && nonShooter && isThree(realMan, g.dir) && !press) gap += 8;
    gap = Math.min(gap, len * 0.6);
    let x = man.x + dx * gap;
    let y = man.y + dy * gap;
    // Negação: atirador perigoso sem a bola perto da linha -> o defensor fica na linha do passe
    // (sinal visual "!" no HUD; leitura: corte pelas costas)
    d.denying = false;
    if (!hasBall && !ignoreHelp && shooter && ball.state === 'held' && isThree(realMan, g.dir)) {
      d.denying = true;
      return { x: lerp(man.x, ball.x, 0.22), y: lerp(man.y, ball.y, 0.22) };
    }
    if (!hasBall && !ignoreHelp && !press) {
      const hx = (ball.x + B.x) / 2;
      const hy = (ball.y + B.y) / 2;
      const sag = (DEFENSE.helpSag * clamp((90 - three) / 40, 0, 1) + (nonShooter ? DEFENSE.sagByShooting * 0.3 : 0)) / Math.sqrt(d.skills.defense);
      x = lerp(x, hx, sag);
      y = lerp(y, hy, sag);
    }
    return { x, y };
  }

  // Zona 2-3: protege a área; marca quem entrar nela.
  zoneSpot(d, handler) {
    const g = this.game;
    const spot = g.toWorld(ZONE_SPOTS[d.role] || ZONE_SPOTS.C);
    const ball = g.ball;
    const base = { x: lerp(spot.x, ball.x, 0.28), y: lerp(spot.y, ball.y, 0.2) };
    let target = null;
    let bd = 50;
    for (const a of g.offTeam) {
      const dd = Math.hypot(a.x - spot.x, a.y - spot.y);
      if (dd < bd) {
        bd = dd;
        target = a;
      }
    }
    if (!target) return { pos: base, man: null };
    const B = g.basket;
    const gap = target === handler ? DEFENSE.ballGap : 14;
    const dx = B.x - target.x;
    const dy = B.y - target.y;
    const l = Math.hypot(dx, dy) || 1;
    return { pos: { x: target.x + (dx / l) * gap, y: target.y + (dy / l) * gap }, man: target };
  }

  findHelper(handler) {
    const g = this.game;
    if (!handler || this.scheme().zone || distToBasket(handler, g.dir) > DEFENSE.helpDriveDist) return null;
    const own = this.defenderOf(handler);
    if (own && own.stun <= 0 && !g.offenseAI.laneOpen(handler)) return null;
    let best = null;
    let bd = Infinity;
    for (const d of g.defTeam) {
      if (d === own || d === g.user || d.stun > 0 || (this.double && d === this.double.by)) continue;
      const man = this.assign.get(d);
      if (man && man.r.three >= DOUBLE.threeRating && isThree(man, g.dir)) continue;
      const dd = Math.hypot(d.x - handler.x, d.y - handler.y);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return bd < 90 ? best : null;
  }

  dangerous(h) {
    const g = this.game;
    const d = distToBasket(h, g.dir);
    if ((h.heat || 0) >= 3.2 && d < 210) return 'EM CHAMAS';
    if (h.r.three >= DOUBLE.threeRating && d > 105 && d < 205) return 'ATIRADOR';
    if (h.r.fin >= DOUBLE.finishRating && d < 95) return 'GARRAFAO';
    if (bestRating(h.info) >= DOUBLE.starRating && d < 170) return 'CRAQUE';
    return null;
  }

  startDouble(by, target, label = 'DOBRA!') {
    if (!by || by === this.game.user || by.stun > 0) return;
    this.double = { by, target, t: 0 };
    if (target === this.game.user && this.game.track) this.game.track.doubledUser++;
    this.game.floatText(by.x, by.y - by.headY - 6, label, 0xff5a4d);
  }

  updateDouble(handler, dt) {
    const g = this.game;
    const sc = this.scheme();
    this.doubleCd = Math.max(0, this.doubleCd - dt);
    this.forceDouble = Math.max(0, this.forceDouble - dt);
    if (this.double) {
      this.double.t += dt;
      if (!handler || handler !== this.double.target || this.double.t > DOUBLE.maxTime) {
        this.double = null;
        this.doubleCd = DOUBLE.cooldown;
      }
      return;
    }
    if (!handler || g.inbound) {
      this.evalHolder = null;
      return;
    }
    const back = inBackcourt(handler, g.dir);
    let want = false;
    if (this.forceDouble > 0) want = true;
    else if (sc.press && back && this.doubleCd <= 0) want = this.evalHolder !== handler && Math.random() < 0.7 * this.diff('dbl');
    else if (!back && sc.doublePG && handler === g.offTeam[0] && distToBasket(handler, g.dir) < 200 && this.doubleCd <= 0) want = true;
    else if (!back && this.doubleCd <= 0 && this.evalHolder !== handler) {
      const why = this.dangerous(handler);
      want = !!why && Math.random() < DOUBLE.chance * this.diff('dbl');
    }
    this.evalHolder = handler;
    if (!want) return;
    const own = this.defenderOf(handler);
    let best = null;
    let bs = Infinity;
    for (const d of g.defTeam) {
      if (d === own || d === g.user || d.stun > 0) continue;
      const dd = Math.hypot(d.x - handler.x, d.y - handler.y);
      if (dd > DOUBLE.maxDoublerDist) continue;
      const score = dd + this.threat(this.assign.get(d)) * 60;
      if (score < bs) {
        bs = score;
        best = d;
      }
    }
    this.forceDouble = 0;
    this.startDouble(best, handler);
  }

  // Detecta pick and roll: um companheiro do condutor parado (bloqueio) colado no marcador dele.
  detectPnr(handler) {
    const g = this.game;
    if (!handler) return null;
    const own = this.defenderOf(handler);
    if (!own) return null;
    for (const s of g.offTeam) {
      if (s === handler || s.body.pushable) continue;
      if (Math.hypot(s.x - own.x, s.y - own.y) < 16) return s;
    }
    return null;
  }

  updatePnr(handler, dt) {
    const g = this.game;
    const sc = this.scheme();
    const screener = this.detectPnr(handler);
    if (screener && (!this.pnr || this.pnr.screener !== screener || this.pnr.handler !== handler)) {
      this.pnr = { handler, screener, t: 0 };
      const own = this.defenderOf(handler);
      const sd = this.defenderOf(screener);
      // troca também vale para você: passa a marcar o bloqueador (você continua sendo o armador)
      if (sc.pnr === 'switch' && own && sd && !sc.zone) {
        this.swap(own, sd);
        g.floatText(own.x, own.y - own.headY - 6, 'TROCA', 0xff7b6b);
      } else if (sc.pnr === 'blitz' && !this.double) {
        this.startDouble(sd, handler, 'BLITZ!');
      } else if (sc.pnr === 'hedge' && sd && sd !== g.user) {
        g.floatText(sd.x, sd.y - sd.headY - 6, 'HEDGE', 0xff9a4d);
      }
    }
    if (this.pnr) {
      this.pnr.t += dt;
      if (this.pnr.t > 2.2 || this.pnr.handler !== handler) this.pnr = null;
    }
  }

  update(dt) {
    const g = this.game;
    const ball = g.ball;
    const sc = this.scheme();
    const handler = ball.state === 'held' && ball.holder.team === g.offSide ? ball.holder : null;
    const ai = g.defTeam.filter((d) => d !== g.user);
    const rspot = ball.state === 'loose' ? g.reboundSpot() : null;
    const chasers = rspot ? nearestN(ai, rspot, DEFENSE.reboundChasers) : [];

    // volta na marcação
    if (this.transitionT > 0) {
      this.transitionT -= dt;
      this.rematchT -= dt;
      if (this.rematchT <= 0 && !sc.zone) {
        this.rematchT = TRANSITION.rematchEvery;
        this.rematch();
      }
    }
    this.updateDouble(handler, dt);
    this.updatePnr(handler, dt);
    const helper = this.findHelper(handler);
    if (helper && helper !== this.helper) g.floatText(helper.x, helper.y - helper.headY - 6, 'AJUDA', 0xff9a4d);
    this.helper = helper;
    const B = g.basket;
    const ballDist = courtDist(ball, B);

    const side = g.offSide;
    for (const d of [...g.defTeam]) {
      if (g.offSide !== side) break;
      const man = this.assign.get(d);
      if (!man) continue;
      d.transT = Math.max(0, (d.transT || 0) - dt);
      const k = 1 - Math.exp(-dt / (DEFENSE.reaction / (d.skills.defense * this.diff('def'))));
      if (!d.track) d.track = { x: man.x, y: man.y };
      d.track.x += (man.x - d.track.x) * k;
      d.track.y = man.y;
      if (d === g.user) continue;

      d.lookAlways = true;
      d.lookAt = handler || ball;
      if (d.stun > 0) {
        d.moveDir(0, 0, 0, dt);
        continue;
      }
      let speed = this.speedOf(d);

      if (ball.state === 'pass' && ball.interceptor === d) {
        d.lookAt = ball;
        d.seek(ball.interceptPoint, d.run(speed, true), dt, null, 3);
        continue;
      }
      if (ball.state === 'loose' && chasers.includes(d)) {
        d.lookAt = ball;
        d.seek(rspot, d.run(speed * Math.sqrt(d.skills.rebounding), Math.hypot(rspot.x - d.x, rspot.y - d.y) > 14), dt, null, 3);
        continue;
      }
      const doubling = this.double && this.double.by === d;
      if (d.lunge > 0.15 && handler && (handler === man || doubling)) {
        d.seek(ball, speed * 1.25, dt, null, 2);
        continue;
      }

      // atrás da jogada na transição: corre primeiro para proteger a cesta
      const behind = this.transitionT > 0 && courtDist(d, B) > ballDist + 24;
      let target;
      let want = false; // sprint (gasta o gás do defensor)
      if (ball.state === 'shot' || ball.state === 'drop') {
        const dx = B.x - man.x;
        const dy = B.y - man.y;
        const l = Math.hypot(dx, dy) || 1;
        target = { x: man.x + (dx / l) * 10, y: man.y + (dy / l) * 10 };
      } else if (doubling) {
        const h = this.double.target;
        const own = this.defenderOf(h);
        const s = own && own.x > h.x ? -1 : 1;
        target = { x: h.x + s * 9, y: h.y + (B.y > h.y ? 6 : -6) };
        want = true;
      } else if (behind) {
        const gb = g.toWorld({ x: 240 + (d.index - 2) * 14, y: 120 });
        target = { x: lerp(gb.x, man.x, 0.3), y: lerp(gb.y, man.y, 0.3) };
        want = true; // volta correndo para a defesa
      } else if (d === helper) {
        const dx = B.x - handler.x;
        const dy = B.y - handler.y;
        const l = Math.hypot(dx, dy) || 1;
        target = { x: handler.x + (dx / l) * 10, y: handler.y + (dy / l) * 10 };
        want = true;
      } else if (sc.zone && !inBackcourt(ball, g.dir)) {
        const z = this.zoneSpot(d, handler);
        target = z.pos;
        if (z.man === handler && handler) this.trySteal(d, handler);
      } else {
        target = this.guardSpot(d);
        // cobertura do pick and roll pelo marcador do bloqueador
        if (this.pnr && this.pnr.screener === man && handler) {
          if (sc.pnr === 'drop') target = { x: lerp(B.x, handler.x, 0.4), y: lerp(B.y, handler.y, 0.4) };
          else if (sc.pnr === 'hedge' && this.pnr.t < 0.9) {
            const dx = B.x - handler.x;
            const dy = B.y - handler.y;
            const l = Math.hypot(dx, dy) || 1;
            target = { x: handler.x + (dx / l) * 11, y: handler.y + (dy / l) * 11 };
            speed *= 1.15;
          }
        }
        const gap = Math.hypot(d.x - man.x, d.y - man.y);
        if (handler === man) {
          if (gap > DEFENSE.ballGap * 1.8) speed *= DEFENSE.closeoutMult * (man.r.three >= 85 ? 1.1 : 1);
          // quem tem a bola acelerou (sprint): o marcador acelera junto, se tiver gás
          const mv = man.body.velocity;
          if (man.sprinting || Math.hypot(mv.x, mv.y) > 85) want = true;
          target.y += man.body.velocity.y * 0.2;
          if (gap < DEFENSE.ballGap) target.y += Math.sign(B.y - man.y) * 6;
        }
      }
      const sep = d.separation(g.defTeam);
      sep.x *= 0.6;
      sep.y *= 0.6;
      // longe de onde deveria estar (fechamento longo): corre
      if (Math.hypot(target.x - d.x, target.y - d.y) > 55) want = true;
      // transição: quem ficou atrás do próprio homem volta no esforço máximo
      if (this.transitionT > 0 && courtDist(d, B) > courtDist(man, B) - 4) {
        want = true;
        speed *= 1.12;
      }
      d.seek(target, d.run(speed, want), dt, sep, handler === man ? 1.5 : 8);

      if (handler && !sc.zone && (handler === man || doubling)) this.trySteal(d, handler);
    }
  }

  trySteal(d, man) {
    const g = this.game;
    if (d.stealCooldown > 0 || man.layupT > 0 || g.inbound || d.distTo(man) > DEFENSE.stealRange) return;
    d.stealCooldown = DEFENSE.stealCooldown * rand(0.8, 1.3);
    d.lunge = 0.35;
    let chance = DEFENSE.stealBase * d.skills.defense * d.skills.stealMult * this.diff('steal');
    if (man.sprinting || man.crossTimer > 0) chance += DEFENSE.stealExposedBonus;
    if (man !== g.user) chance *= DEFENSE.stealVsAiMult;
    if (g.isDoubled(man)) chance *= 2.2;
    if (this.scheme().press && inBackcourt(man, g.dir)) chance *= 1.5;
    if (Math.random() < chance) g.onSteal(d, man);
    else g.maybeReachFoul(d, man);
  }

  rollIntercept(from, to, mult = 1) {
    const g = this.game;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < PASS.interceptMinLen) return null;
    for (const d of g.defTeam) {
      if (d.stun > 0 || d === g.user) continue;
      const c = closestOnSegment(d, from, to);
      if (c.t < 0.15 || c.t > 0.92 || c.d > PASS.interceptRadius) continue;
      if (c.d / (this.speedOf(d) * 1.15) > (len * c.t) / PASS.speed + 0.1) continue;
      const chance = PASS.interceptChance * mult * d.skills.defense * this.diff('steal') * (1 - c.d / PASS.interceptRadius) * Math.min(1.3, len / 180);
      if (Math.random() < chance) return { defender: d, point: { x: c.x, y: c.y } };
    }
    return null;
  }
}
