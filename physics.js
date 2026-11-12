/**
 * Deterministic 2D gameplay simulation. It deliberately does not depend on the
 * renderer: Three.js uses x/y (positive Y is up) and interpolates freely.
 * Actor coordinates are the center of the feet; terrain uses bottom-left.
 */
const STEP = 1 / 120;
const EPS = 0.00001;
const BODY_CLEARANCE = 0.02;
const GRAVITY = 24;
const RUN_SPEED = 6.25;
const JUMP_SPEED = 11.45;
const JUMP_BUFFER = 0.135;
const COYOTE = 0.105;
const FALL_SPEED = 16;
const DASH_DURATION = 0.155;
const ATTACKS = [
  { duration: 0.31, startup: 0.058, end: 0.148, range: 1.59, recoil: 3.4 },
  { duration: 0.32, startup: 0.059, end: 0.155, range: 1.66, recoil: 3.7 },
  { duration: 0.39, startup: 0.078, end: 0.188, range: 1.83, recoil: 4.8 },
];
const BUTTONS = ['left', 'right', 'jump', 'attack', 'dash', 'interact', 'run'];
const EDGE_BUTTONS = ['jump', 'attack', 'dash', 'interact'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = (v, dt) => Math.max(0, v - dt);
const toward = (v, goal, max) => v + clamp(goal - v, -max, max);
const overlaps = (a, b, c, d) => a < d - EPS && b > c + EPS;
const shape = (r, anchor) => ({
  x: r.anchor === 'top-center' || anchor === 'top-center' ? r.x - r.w / 2 : r.x,
  y: r.anchor === 'top-center' || anchor === 'top-center' ? r.y - r.h : r.y,
  w: r.w, h: r.h, gateId: r.gateId ?? null,
  // Older rooms describe their shelves by thickness alone. Ground and gates
  // stay solid; a shelf only catches feet coming down from above.
  oneWay: !r.gateId && (r.oneWay ?? r.h <= .30),
});
const center = a => a.y + a.height * 0.52;
const actor = (spec, options) => ({
  x: spec.x, y: spec.y, vx: 0, vy: 0, facing: spec.facing === -1 ? -1 : 1,
  grounded: false, width: spec.width ?? options.width, height: spec.height ?? options.height,
  hp: spec.hp ?? options.hp, maxHp: spec.hp ?? options.hp,
});

/**
 * dt is seconds. Input is the current button state, not a keydown event.
 * A press is latched until the next 120 Hz tick. Returned events last only until
 * the next step; call equipSword/heal/damagePlayer between steps to queue events.
 */
export function createSimulation(config = {}) {
  const terrain = (config.platforms ?? []).filter(r => r.w > 0 && r.h > 0)
    .map(r => shape(r, config.anchor));
  const gates = new Map(terrain.filter(t => t.gateId !== null).map(t => [t.gateId, false]));
  const hazards = (config.hazards ?? []).filter(r => r.w > 0 && r.h > 0)
    .map(r => shape(r, config.anchor));
  const minX = config.minX ?? 0;
  const maxX = config.maxX ?? config.width ?? 120;
  const killY = config.killY ?? config.minY ?? Math.min(-8, ...terrain.map(r => r.y - 4));
  const spawn = config.spawn ?? { x: 2, y: 1 };
  const player = {};
  const enemies = [], shots = [];
  const events = [];
  const queuedEvents = [];
  const held = Object.create(null);
  const latched = Object.create(null);
  const edge = Object.create(null);
  let remainder = 0;
  let hitstop = 0;
  let time = 0;
  let stepping = false;
  let safe = { ...spawn };
  let sinceSafe = 0;
  let attackHits = new Set();
  let comboWait = 0;

  const emit = (type, a, extra = {}) => (stepping ? events : queuedEvents)
    .push({ type, x: a.x, y: center(a), facing: a.facing, ...extra });
  const solidNow = t => t.gateId === null || !gates.get(t.gateId);
  const groundAt = a => terrain.some(t => solidNow(t) && Math.abs(a.y - t.y - t.h) < EPS * 8 &&
    overlaps(a.x - a.width / 2, a.x + a.width / 2, t.x, t.x + t.w));
  const hazardAt = a => hazards.some(t =>
    overlaps(a.x - a.width / 2, a.x + a.width / 2, t.x, t.x + t.w) &&
    // Touching a spike surface with the feet counts, including on a solid tile.
    overlaps(a.y - 0.035, a.y + a.height, t.y, t.y + t.h));

  function reset() {
    shots.length=0;
    for (const id of gates.keys()) gates.set(id, false);
    Object.assign(player, actor(spawn, { width: 0.60, height: 1.25, hp: config.health ?? 5 }), {
      attack: 0, attackDuration: ATTACKS[0].duration, attackPhase: 'idle',
      dash: 0, dashCooldown: 0, hurt: 0, invulnerable: 0, energy: 100, maxEnergy: 100,
      hasSword: config.hasSword !== false, damage: config.damage ?? 1, mods:{},
      coyote: 0, jumpBuffer: 0, attackBuffer: 0, combo: 0, doubleJump: !!config.doubleJump,
      airDash: true, dashDirection: 1, attackDirection: 1, state: 'idle',
    });
    player.grounded = groundAt(player);
    enemies.splice(0, enemies.length, ...(config.enemies ?? []).map((spec, id) => {
      const type = spec.type ?? (spec.variant === 2 ? 'brute' : spec.variant === 1 ? 'stalker' : 'shade');
      const brute = ['brute','guardian','warden','curator'].includes(type);
      const flying=type==='moth', shooter=type==='sentry', hopper=type==='hopper';
      const stalker = type === 'stalker' || type === 'wisp' || hopper || flying;
      const a = actor(spec, { width: brute ? 0.94 : 0.66, height: brute ? 1.58 : 1.15, hp: brute ? 5 : 3 });
      return Object.assign(a, {
        id, sourceId: spec.id ?? id, type, state: 'idle', phase: 'idle', timer: 0.45, knockback: 0,
        homeY:spec.y, flying, shooter, hopper,
        left: spec.left ?? spec.patrolMin ?? Math.max(minX, spec.x - 4),
        right: spec.right ?? spec.patrolMax ?? Math.min(maxX, spec.x + 4),
        patrol: spec.patrol !== false, patrolDirection: spec.facing === 1 ? 1 : -1,
        awareness: spec.awareness ?? (shooter?7.8:flying?5.5:brute?6.1:5.6), speed: spec.speed ?? (stalker ? 3.45 : brute ? 1.55 : 2.35),
        range: spec.range ?? (shooter?6.5:type==='curator'?2.05:brute?1.59:1.22), damage: spec.damage ?? 1,
        windup: spec.windup ?? (shooter?.8:hopper?.42:brute?.68:stalker?.45:.57),
        recovery: spec.recovery ?? (brute ? 0.97 : 0.73),
        charge: brute ? 4.25 : 3.4, staggerResist: brute, active: spec.active !== false,
        strikeHit: false, guarded: false, hurt: 0,
      }, { grounded: groundAt(a) });
    }));
    remainder = hitstop = time = sinceSafe = comboWait = 0;
    safe = { x: spawn.x, y: spawn.y };
    attackHits.clear();
    events.length = queuedEvents.length = 0;
    for (const k of BUTTONS) held[k] = latched[k] = edge[k] = false;
    return player;
  }

  function move(a, dt, left = minX, right = maxX) {
    const half = a.width / 2;
    const prevX = a.x;
    const dx = a.vx * dt;
    const goalX = prevX + dx;
    let x = clamp(goalX, Math.max(left, minX + half), Math.min(right, maxX - half));
    for (const t of terrain) {
      if (t.oneWay || !solidNow(t) || !overlaps(a.y, a.y + a.height, t.y, t.y + t.h)) continue;
      if (x > prevX && prevX + half <= t.x + EPS && x + half >= t.x) {
        x = Math.min(x, t.x - half); a.vx = 0;
      } else if (x < prevX && prevX - half >= t.x + t.w - EPS && x - half <= t.x + t.w) {
        x = Math.max(x, t.x + t.w + half); a.vx = 0;
      }
    }
    const blockedX = Math.abs(goalX - x) > EPS;
    if (blockedX) a.vx = 0;
    a.x = x;
    const prevY = a.y;
    let y = prevY + a.vy * dt;
    a.grounded = false;
    for (const t of terrain) {
      if (!solidNow(t) || !overlaps(a.x - half, a.x + half, t.x, t.x + t.w)) continue;
      const top = t.y + t.h;
      if (a.vy <= 0 && prevY >= top - EPS && y <= top + EPS) {
        y = Math.max(y, top); a.grounded = true;
      } else if (!t.oneWay && a.vy > 0 && prevY + a.height <= t.y + EPS && y + a.height >= t.y) {
        y = Math.min(y, t.y - a.height);
      }
    }
    a.y = y;
    if (a.grounded || (a.vy > 0 && y < prevY + a.vy * dt - EPS)) a.vy = 0;
    return blockedX;
  }

  function bodyIntersects(a, t) {
    return overlaps(a.x - a.width / 2, a.x + a.width / 2, t.x, t.x + t.w) &&
      overlaps(a.y + BODY_CLEARANCE, a.y + a.height, t.y, t.y + t.h);
  }

  function setGate(id, open = true) {
    if (!gates.has(id)) return false;
    if (!open && terrain.some(t => t.gateId === id &&
        [player, ...enemies].some(a => a.hp > 0 && a.active !== false && bodyIntersects(a, t)))) return false;
    gates.set(id, !!open);
    return true;
  }

  function teleport(x, y, { checkpoint = true, restore = false } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || y < killY ||
        x < minX + player.width / 2 || x > maxX - player.width / 2 ||
        (!restore && player.hp <= 0)) return false;
    const destination = { ...player, x, y };
    if (terrain.some(t => !t.oneWay && solidNow(t) && bodyIntersects(destination, t)) ||
        hazardAt(destination)) return false;
    shots.length=0;
    Object.assign(player, {
      x, y, vx: 0, vy: 0, hurt: 0, attack: 0, attackPhase: 'idle',
      dash: 0, dashCooldown: 0, coyote: 0, attackBuffer: 0, jumpBuffer: 0,
      airDash: true, doubleJump: !!(config.doubleJump||player.mods.doubleJump), combo: 0,
      state: 'idle', invulnerable: 0.60,
    });
    if (restore) {
      player.hp = player.maxHp;
      player.energy = player.maxEnergy;
    }
    player.grounded = groundAt(player);
    hitstop = remainder = comboWait = 0;
    attackHits.clear();
    for (const k of BUTTONS) held[k] = latched[k] = edge[k] = false;
    if (checkpoint) setCheckpoint(x, y);
    return true;
  }

  // Patrolling creatures turn at real walls or a drop. High shelves aren't a
  // wall and aren't mistaken for floor under a creature walking below them.
  function supportAhead(a, dx) {
    const x = a.x + dx * (a.width * .32 + .16);
    return terrain.some(t => {
      const step = t.y + t.h - a.y;
      return t.gateId === null && step >= -.60 - EPS && step <= .045 &&
        x >= t.x - EPS && x <= t.x + t.w + EPS;
    });
  }

  function lineBlocked(a, b) {
    const x0 = a.x, dx = b.x - a.x;
    const y0 = center(a), dy = center(b) - y0;
    if (Math.abs(dx) < EPS) return false;
    return terrain.some(t => {
      if (t.oneWay || !solidNow(t)) return false;
      const q0 = (t.x - x0) / dx, q1 = (t.x + t.w - x0) / dx;
      const near = Math.max(0, Math.min(q0, q1));
      const far = Math.min(1, Math.max(q0, q1));
      if (near >= far - EPS) return false;
      const ya = y0 + dy * near, yb = y0 + dy * far;
      return Math.min(ya, yb) < t.y + t.h - EPS && Math.max(ya, yb) > t.y + EPS;
    });
  }

  function damagePlayer(amount = 1, direction = 0, force = false) {
    if (amount <= 0 || player.hp <= 0 || (!force && player.invulnerable > 0)) return false;
    const p = player;
    p.hp = Math.max(0, p.hp - amount);
    p.invulnerable = 0.95;
    p.hurt = 0.22;
    p.attack = p.dash = p.attackBuffer = 0;
    p.attackPhase = 'idle';
    p.state = p.hp ? 'hurt' : 'dead';
    p.vx = direction * 4.3;
    p.vy = 3.65;
    emit('hurt', p, { amount, hp: p.hp, direction });
    if (p.hp <= 0) emit('death', p);
    if (stepping) hitstop = 0.048;
    return true;
  }

  function heal(amount = 2) {
    if (amount <= 0 || player.hp <= 0) return 0;
    const restored = Math.min(amount, player.maxHp - player.hp);
    player.hp += restored;
    if (restored) emit('heal', player, { amount: restored, hp: player.hp });
    return restored;
  }

  function equipSword() {
    if (player.hasSword) return false;
    player.hasSword = true;
    emit('sword', player);
    return true;
  }

  function setCheckpoint(x = player.x, y = player.y) {
    safe = { x, y };
    sinceSafe = 0;
  }

  function setLoadout(rank=1,mods={}) {
    const p=player;
    const hadDouble=p.mods.doubleJump;
    p.mods={...mods};p.damage=rank+(mods.damage??0);
    p.maxHp=(config.health??5)+(mods.health??0);
    p.hp=Math.min(p.hp,p.maxHp);
    if(!mods.doubleJump&&!config.doubleJump)p.doubleJump=false;
    else if(p.grounded||!hadDouble)p.doubleJump=true;
  }
  const attackCost=p=>18-(p.mods.attackDiscount??0);
  function beginAttack(p) {
    p.combo = comboWait > 0 ? p.combo % ATTACKS.length + 1 : 1;
    const spec = ATTACKS[p.combo - 1];
    p.attack = p.attackDuration = spec.duration;
    p.attackPhase = 'windup';
    p.attackDirection = p.facing;
    p.attackBuffer = 0;
    p.energy -= attackCost(p);
    attackHits = new Set();
    comboWait = 0;
    emit('attack', p, { combo: p.combo, duration: spec.duration });
  }

  function enemyState(e, state, timer) {
    e.state = e.phase = state;
    e.timer = timer;
    e.guarded = e.staggerResist && (state === 'windup' || state === 'strike');
  }

  function strike(p, e, spec) {
    // Read the heavy foe's windup: either slip behind it or wait for recovery.
    if (e.guarded && (p.x - e.x) * e.facing >= -0.12) {
      p.vx -= p.attackDirection * 1.1;
      emit('block', e, { id: e.id, direction: p.attackDirection });
      hitstop = 0.023;
      return;
    }
    e.hp = Math.max(0, e.hp - p.damage);
    e.hurt = 0.18;
    e.knockback = p.attackDirection * (e.staggerResist ? spec.recoil * 0.36 : spec.recoil);
    if (!e.hp) enemyState(e, 'dead', 0);
    else if (!e.staggerResist) enemyState(e, 'stunned', 0.21);
    emit('hit', e, { amount: p.damage, id: e.id, hp: e.hp, combo: p.combo, direction: p.attackDirection });
    if (!e.hp) emit('defeat', e, { id: e.id, enemyType: e.type });
    hitstop = e.hp ? 0.037 : 0.052;
  }

  function tick(dt, input) {
    const p = player;
    if (p.hp <= 0) return;
    if (hitstop > 0) {
      hitstop = reduce(hitstop, dt);
      // Input still buffers while motion freezes on impact.
      if (edge.jump) p.jumpBuffer = JUMP_BUFFER;
      if (edge.attack) p.attackBuffer = 0.16;
      return;
    }
    const wasGrounded = p.grounded;
    const previousVy = p.vy;
    p.energy = Math.min(p.maxEnergy, p.energy + (p.attack > 0 ? 12 : 27) * dt);
    p.invulnerable = reduce(p.invulnerable, dt);
    p.hurt = reduce(p.hurt, dt);
    p.dashCooldown = reduce(p.dashCooldown, dt);
    p.dash = reduce(p.dash, dt);
    p.coyote = wasGrounded ? COYOTE : reduce(p.coyote, dt);
    p.jumpBuffer = edge.jump ? JUMP_BUFFER : reduce(p.jumpBuffer, dt);
    p.attackBuffer = edge.attack ? 0.16 : reduce(p.attackBuffer, dt);
    comboWait = reduce(comboWait, dt);
    if (p.attack > 0) {
      p.attack = reduce(p.attack, dt);
      if (p.attack <= EPS) {
        p.attack = 0;
        p.attackPhase = 'idle';
        comboWait = 0.28;
      } else {
        const spec = ATTACKS[p.combo - 1];
        const t = p.attackDuration - p.attack;
        p.attackPhase = t < spec.startup ? 'windup' : t < spec.end ? 'active' : 'recovery';
      }
    }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (!p.hurt && !p.attack && !p.dash && dir) p.facing = dir;
    if (edge.dash && !p.hurt && !p.dashCooldown && (wasGrounded || p.airDash) &&
        p.attackPhase !== 'active' && p.attackPhase !== 'windup') {
      p.dash = DASH_DURATION;
      p.dashCooldown = 0.39;
      p.attack = 0;
      p.attackPhase = 'idle';
      p.dashDirection = dir || p.facing;
      p.facing = p.dashDirection;
      p.airDash = false;
      p.invulnerable = Math.max(p.invulnerable, DASH_DURATION + 0.035);
      emit('dash', p, { duration: DASH_DURATION });
    }
    if (!p.hurt && !p.dash && !p.attack && p.hasSword && p.attackBuffer && p.energy >= attackCost(p)) beginAttack(p);

    if (!p.hurt && !p.dash && p.attackPhase !== 'active' && p.jumpBuffer > 0 &&
        (p.coyote > 0 || p.doubleJump)) {
      const second = p.coyote <= 0;
      p.vy = second ? JUMP_SPEED * 0.91 : JUMP_SPEED;
      p.coyote = p.jumpBuffer = 0;
      if (second) p.doubleJump = false;
      p.grounded = false;
      emit('jump', p, { double: second });
    }
    if (p.dash > 0) {
      p.vx = p.dashDirection * 16.8;
      p.vy = 0;
    } else {
      const gravity = p.vy > 0 && !input.jump ? GRAVITY * 1.7 : GRAVITY;
      p.vy = Math.max(-FALL_SPEED, p.vy - gravity * dt);
      if (p.hurt > 0) p.vx = toward(p.vx, 0, 13 * dt);
      else {
        const limit = p.attack ? (wasGrounded ? 0.22 : 0.70) : (input.run ? 1.10 : 1);
        const accel = wasGrounded ? (dir ? 56 : 69) : (dir ? 34 : 22);
        p.vx = toward(p.vx, dir * RUN_SPEED * limit * (1+(p.mods.speed??0)), accel * dt);
      }
    }

    move(p, dt);
    if (p.grounded) {
      p.doubleJump = !!(config.doubleJump||p.mods.doubleJump);
      if (!p.dash) p.airDash = true;
      if (!wasGrounded && previousVy < -3) emit('land', p, { speed: -previousVy });
      const threatened = enemies.some(e => e.hp > 0 && e.active &&
        Math.abs(e.x - p.x) < 1.8 && Math.abs(e.y - p.y) < 1.3);
      if (!hazardAt(p) && !threatened && !p.hurt) {
        sinceSafe += dt;
        if (sinceSafe >= 0.21) setCheckpoint();
      } else sinceSafe = 0;
    } else sinceSafe = 0;

    if (p.y < (p.x<284?Math.max(killY,-7):killY) || (hazardAt(p) && p.invulnerable <= 0)) {
      const where = { x: p.x, y: p.y };
      damagePlayer(1, 0, true);
      emit('fall', p, { fromX: where.x, fromY: where.y });
      p.x = safe.x; p.y = safe.y; p.vx = p.vy = 0;
      p.grounded = groundAt(p); p.coyote = p.jumpBuffer = 0;
      p.airDash = true; p.doubleJump = !!(config.doubleJump||p.mods.doubleJump);
      if (!p.hp) return;
    }

    if (p.attackPhase === 'active') {
      const spec = ATTACKS[p.combo - 1];
      for (const e of enemies) {
        if (!e.hp || !e.active || attackHits.has(e.id)) continue;
        const dx = (e.x - p.x) * p.attackDirection;
        const yOverlap = overlaps(p.y + 0.13, p.y + p.height + 0.22, e.y + 0.06, e.y + e.height);
        if (dx > -0.22 && dx <= spec.range + (p.mods.reach??0) + e.width * 0.35 && yOverlap && !lineBlocked(p, e)) {
          attackHits.add(e.id); strike(p, e, spec);
        }
      }
    }

    for (const e of enemies) {
      if (!e.hp || !e.active || !p.hp) continue;
      e.timer = reduce(e.timer, dt);
      e.hurt = reduce(e.hurt, dt);
      if(e.flying){
        const h=e.homeY+Math.sin(time*3.2+e.id)*.24;
        const target=e.state==='chase'||e.state==='strike'?clamp(p.y+.28,e.homeY-1.5,e.homeY+1.15):h;
        e.vy=clamp((target-e.y)*5,-3.4,3.4);
      }else e.vy=Math.max(-FALL_SPEED,e.vy-GRAVITY*dt);
      const dx = p.x - e.x;
      const distance = Math.abs(dx);
      const closeY = Math.abs(center(p) - center(e)) < (e.flying?2.8:e.shooter?1.75:1.28);
      const frenzy=e.type==='curator'&&e.hp<=e.maxHp/2;
      const targetDirection = Math.sign(dx) || e.facing;
      let movement = 0;

      if (e.state === 'stunned' || e.state === 'recovery') {
        if (!e.timer) enemyState(e, 'idle', 0);
      } else if (e.state === 'windup') {
        if (!e.timer) {
          if(e.shooter){
            if(shots.length<16)shots.push({x:e.x+e.facing*.49,y:center(e),vx:e.facing*7.5,life:1.12});
            enemyState(e,'recovery',1.1);
            emit('enemyShot',e,{id:e.id});
          }else{
            const duration=e.hopper?.36:frenzy?.31:.18;
            enemyState(e,'strike',duration);e.strikeHit=false;
            if(e.hopper&&e.grounded)e.vy=7.9;
            emit('enemyAttack',e,{id:e.id,duration});
          }
        }
      } else if (e.state === 'strike') {
        movement = e.facing * e.charge * (frenzy?1.45:1);
        if (!e.timer) enemyState(e, 'recovery', e.recovery*(frenzy?.67:1));
      } else if (closeY && distance < e.awareness && !lineBlocked(e, p)) {
        e.facing = targetDirection;
        if (distance <= e.range + (e.staggerResist ? 0.30 : 0) && !e.timer) {
          enemyState(e, 'windup', e.windup*(frenzy?.72:1));
          emit('warning', e, { id: e.id, duration: e.windup });
        } else {
          if (e.state !== 'chase') enemyState(e, 'chase', e.timer);
          if (distance > e.range * 0.68) movement = targetDirection * e.speed*(frenzy?1.28:1);
        }
      } else {
        if (e.state !== 'idle') enemyState(e, 'idle', 0.12);
        if (e.patrol) {
          if (e.x <= e.left + 0.03) e.patrolDirection = 1;
          if (e.x >= e.right - 0.03) e.patrolDirection = -1;
          e.facing = e.patrolDirection;
          movement = e.facing * e.speed * 0.44;
        }
      }

      e.knockback = toward(e.knockback, 0, 21 * dt);
      const direction = Math.sign(movement);
      const ledge = direction && e.grounded && !e.flying && !(e.hopper&&e.state==='strike') && !supportAhead(e, direction);
      e.vx = (ledge ? 0 : movement) + e.knockback;
      const blocked = move(e, dt, e.left, e.right);
      if ((ledge || blocked) && direction && e.state === 'idle') {
        e.patrolDirection = e.facing = -direction;
      }
      if (e.y < killY) {
        e.hp = 0;
        enemyState(e, 'dead', 0);
        emit('defeat', e, { id: e.id, enemyType: e.type });
      } else if (e.state === 'strike' && !e.strikeHit &&
          Math.abs(center(p) - center(e)) < 0.89) {
        const forward = (p.x - e.x) * e.facing;
        if (forward >= -0.17 && forward <= e.range + 0.14 && !lineBlocked(e, p)) {
          e.strikeHit = damagePlayer(e.damage, e.facing);
        }
      }
    }
    for(let i=shots.length-1;i>=0;i--){
      const q=shots[i],next=q.x+q.vx*dt;
      q.life-=dt;
      const wall=terrain.some(t=>!t.oneWay&&solidNow(t)&&q.y>t.y&&q.y<t.y+t.h&&overlaps(Math.min(q.x,next)-.08,Math.max(q.x,next)+.08,t.x,t.x+t.w));
      if(wall||q.life<=0){shots.splice(i,1);continue;}
      q.x=next;
      if(Math.abs(q.x-p.x)<p.width*.5+.16&&q.y>p.y&&q.y<p.y+p.height){
        damagePlayer(1,Math.sign(q.vx));shots.splice(i,1);
      }
    }
    p.state = !p.hp ? 'dead' : p.hurt ? 'hurt' : p.dash ? 'dash' : p.attack ? 'attack' :
      !p.grounded ? 'jump' : Math.abs(p.vx) > 0.12 ? 'run' : 'idle';
  }

  function step(dt, input = {}) {
    events.length = 0;
    if (queuedEvents.length) events.push(...queuedEvents.splice(0));
    for (const k of BUTTONS) {
      const next = !!input[k];
      if (EDGE_BUTTONS.includes(k) && next && !held[k]) latched[k] = true;
      held[k] = next;
    }
    remainder += clamp(Number.isFinite(dt) ? dt : 0, 0, 0.10);
    stepping = true;
    while (remainder + EPS >= STEP) {
      for (const k of EDGE_BUTTONS) {
        edge[k] = latched[k];
        latched[k] = false;
      }
      tick(STEP, held);
      remainder = Math.max(0, remainder - STEP);
      time += STEP;
    }
    stepping = false;
    return events;
  }

  reset();
  return {
    player, enemies, shots, events, step, reset, damagePlayer, heal, equipSword, setCheckpoint, teleport, setLoadout,
    setGate, isGateOpen: id => gates.get(id) === true,
    get time() { return time; },
    get interpolation() { return remainder / STEP; },
    get hitstop() { return hitstop; },
  };
}
