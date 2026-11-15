// The simulation: the Warden, the Last Bloom, five kinds of void creature, the
// Herald boss, thorn turrets, pickups and particles. It touches no DOM, no canvas
// and no clock: every step takes its seconds and its input, and every random choice
// comes from the seeded generator it was built with, so the same seed and the same
// inputs always play the same game. The renderer and the HUD only read its state.

import {
  BLOOM,
  BREATHER_SECONDS,
  DART,
  ENEMY,
  FIELD,
  HERALD,
  OVERCHARGE,
  PICKUP,
  POOL,
  SPITTER,
  TOTAL_WAVES,
  TURRET,
  WARDEN,
} from './config.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_BLOOM_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_PICKUP = 16;
export const EVENT_WAVE = 32;
export const EVENT_BOSS = 64;
export const EVENT_OVER = 128;
export const EVENT_WIN = 256;
export const EVENT_DASH = 512;
export const EVENT_PLANT = 1024;
export const EVENT_OVERCHARGE = 2048;
export const EVENT_HEAL = 4096;

/** Wave rosters: what marches on the garden, wave by wave. */
const ROSTERS = [
  null,
  { mote: 6 },
  { mote: 8, dart: 3 },
  { mote: 8, dart: 4, bramble: 2 },
  { mote: 8, dart: 4, bramble: 3, spitter: 2 },
  { herald: 1, mote: 6, spitter: 2 },
  { mote: 10, dart: 5, bramble: 3, spitter: 3, wisp: 3 },
  { mote: 12, dart: 6, bramble: 4, spitter: 4, wisp: 4 },
  { mote: 13, dart: 6, bramble: 5, spitter: 4, wisp: 5 },
  { mote: 14, dart: 6, bramble: 6, spitter: 5, wisp: 6 },
  { herald: 1, mote: 8, spitter: 4, wisp: 4 },
];

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createWorld(random) {
  const state = {
    time: 0,
    wave: 0,
    phase: 'breather',
    phaseTimer: 2,
    spawnQueue: [],
    spawnTimer: 0,
    trickleTimer: 0,
    score: 0,
    kills: 0,
    shards: 10,
    warden: null,
    bloom: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    turrets: [],
    pickups: [],
    particles: [],
    floaters: [],
    decor: [],
    fireflies: [],
    shake: 0,
    over: false,
    won: false,
    overReason: '',
    boss: null,
    banner: '',
    bannerTimer: 0,
  };

  function freshWarden() {
    return {
      x: BLOOM.x,
      y: BLOOM.y + 170,
      hp: WARDEN.hp,
      maxHp: WARDEN.hp,
      aim: -Math.PI / 2,
      fireTimer: 0,
      dashTimer: 0,
      dashCd: 0,
      dashDirX: 0,
      dashDirY: -1,
      mercy: 0,
      over: 0,
      overTime: 0,
    };
  }

  function growDecor() {
    state.decor = [];
    for (let i = 0; i < 140; i += 1) {
      const x = random() * FIELD.width;
      const y = random() * FIELD.height;
      if (distance(x, y, BLOOM.x, BLOOM.y) < 78) continue;
      const roll = random();
      state.decor.push({
        x,
        y,
        kind: roll < 0.55 ? 'grass' : roll < 0.75 ? 'flower' : roll < 0.9 ? 'stone' : 'shroom',
        angle: random() * Math.PI * 2,
        size: 0.7 + random() * 0.7,
        hue: random(),
      });
    }
    state.fireflies = [];
    for (let i = 0; i < 14; i += 1) {
      state.fireflies.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        phase: random() * Math.PI * 2,
        speed: 8 + random() * 14,
        angle: random() * Math.PI * 2,
      });
    }
  }

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.phase = 'breather';
    state.phaseTimer = 2;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.trickleTimer = 0;
    state.score = 0;
    state.kills = 0;
    state.shards = 10;
    state.warden = freshWarden();
    state.bloom = { hp: BLOOM.hp, maxHp: BLOOM.hp, pulse: 0, hurtFlash: 0, lastHurt: -99 };
    state.enemies = [];
    state.bullets = [];
    state.ebullets = [];
    state.turrets = [];
    state.pickups = [];
    state.particles = [];
    state.floaters = [];
    state.shake = 0;
    state.over = false;
    state.won = false;
    state.overReason = '';
    state.boss = null;
    state.banner = '';
    state.bannerTimer = 0;
    growDecor();
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= POOL.particles) return;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life: life * (0.6 + random() * 0.6),
        maxLife: life,
        size: size * (0.6 + random() * 0.8),
        color,
        drag: 3.2,
      });
    }
  }

  function floater(x, y, text, color) {
    if (state.floaters.length >= POOL.floaters) state.floaters.shift();
    state.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  function edgeSpawn() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const side = Math.floor(random() * 4);
      const along = random();
      let x;
      let y;
      if (side === 0) {
        x = along * FIELD.width;
        y = -24;
      } else if (side === 1) {
        x = FIELD.width + 24;
        y = along * FIELD.height;
      } else if (side === 2) {
        x = along * FIELD.width;
        y = FIELD.height + 24;
      } else {
        x = -24;
        y = along * FIELD.height;
      }
      if (distance(x, y, state.warden.x, state.warden.y) > 240) return { x, y };
    }
    return { x: -24, y: random() * FIELD.height };
  }

  function spawnEnemy(kind, x, y) {
    if (state.enemies.length >= POOL.enemies) return null;
    const plan = ENEMY[kind];
    const hpScale = kind === 'herald' ? (state.wave >= TOTAL_WAVES ? 1.35 : 1) : 1 + 0.04 * (state.wave - 1);
    const spot = x === undefined ? edgeSpawn() : { x, y };
    const enemy = {
      kind,
      x: spot.x,
      y: spot.y,
      hp: Math.round(plan.hp * hpScale),
      maxHp: Math.round(plan.hp * hpScale),
      speed: plan.speed,
      radius: plan.radius,
      wobble: random() * Math.PI * 2,
      timer: 1 + random() * 1.5,
      shotTimer: 1.2 + random(),
      burstTimer: 1.5,
      summonTimer: 3,
      strafeDir: random() < 0.5 ? 1 : -1,
      mode: 'stalk',
      modeTimer: 0,
      lockX: 0,
      lockY: 0,
      hitFlash: 0,
      burstAngle: random() * Math.PI * 2,
    };
    state.enemies.push(enemy);
    if (kind === 'herald') state.boss = enemy;
    return enemy;
  }

  function buildQueue(wave) {
    const roster = ROSTERS[wave];
    const queue = [];
    for (const [kind, count] of Object.entries(roster)) {
      for (let i = 0; i < count; i += 1) queue.push(kind);
    }
    // The Herald leads; the rest march in shuffled order.
    const heralds = queue.filter((kind) => kind === 'herald');
    const rest = queue.filter((kind) => kind !== 'herald');
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [...heralds, ...rest];
  }

  function startWave(wave) {
    state.wave = wave;
    state.phase = 'active';
    state.spawnQueue = buildQueue(wave);
    state.spawnTimer = 0.4;
    state.trickleTimer = 9;
    state.banner = state.spawnQueue.includes('herald') ? `Wave ${wave} — the Herald comes` : `Wave ${wave}`;
    state.bannerTimer = 2.2;
    return state.spawnQueue.includes('herald') ? EVENT_WAVE | EVENT_BOSS : EVENT_WAVE;
  }

  function dropPickup(x, y, kind, value) {
    if (state.pickups.length >= POOL.pickups) return;
    const angle = random() * Math.PI * 2;
    state.pickups.push({
      x,
      y,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      kind,
      value,
      life: PICKUP.life,
    });
  }

  function killEnemy(index, events) {
    const enemy = state.enemies[index];
    const plan = ENEMY[enemy.kind];
    state.enemies[index] = state.enemies[state.enemies.length - 1];
    state.enemies.pop();
    state.kills += 1;
    state.score += plan.score;
    state.warden.over = Math.min(OVERCHARGE.max, state.warden.over + OVERCHARGE.gainPerKill);
    floater(enemy.x, enemy.y - enemy.radius, `+${plan.score}`, '#eef7ee');
    burst(enemy.x, enemy.y, enemy.kind === 'herald' ? '#e8b4ff' : '#b388ff', enemy.kind === 'herald' ? 46 : 14, 190, 4, 0.6);
    const drops = Math.min(5, Math.max(1, plan.shards));
    for (let i = 0; i < drops; i += 1) dropPickup(enemy.x, enemy.y, 'shard', Math.ceil(plan.shards / drops));
    if (enemy.kind === 'herald') {
      state.boss = null;
      state.shake = Math.max(state.shake, 10);
      dropPickup(enemy.x, enemy.y, 'heart', 1);
      dropPickup(enemy.x, enemy.y, 'mend', 1);
      dropPickup(enemy.x, enemy.y, 'mend', 1);
    } else if (enemy.kind === 'bramble' || enemy.kind === 'spitter') {
      if (random() < PICKUP.heartChance) dropPickup(enemy.x, enemy.y, 'heart', 1);
      if (random() < PICKUP.mendChance) dropPickup(enemy.x, enemy.y, 'mend', 1);
    } else if (enemy.kind === 'wisp' && random() < PICKUP.mendChance) {
      dropPickup(enemy.x, enemy.y, 'mend', 1);
    }
    return events | EVENT_KILL;
  }

  function damageBloom(amount, events) {
    state.bloom.hp = Math.max(0, state.bloom.hp - amount);
    state.bloom.hurtFlash = 0.35;
    state.bloom.lastHurt = state.time;
    state.shake = Math.max(state.shake, 6);
    burst(BLOOM.x, BLOOM.y, '#ff7ad9', 12, 160, 4, 0.5);
    return events | EVENT_BLOOM_HIT;
  }

  function damageWarden(amount, events) {
    const warden = state.warden;
    if (warden.mercy > 0 || warden.dashTimer > 0) return events;
    warden.hp = Math.max(0, warden.hp - amount);
    warden.mercy = WARDEN.mercyTime;
    state.shake = Math.max(state.shake, 4);
    burst(warden.x, warden.y, '#ff5d5d', 10, 170, 4, 0.5);
    return events | EVENT_HIT;
  }

  function stepWarden(dt, input, events) {
    const warden = state.warden;
    warden.fireTimer -= dt;
    warden.dashCd -= dt;
    warden.mercy -= dt;
    if (warden.overTime > 0) warden.overTime -= dt;

    if (input.dash && warden.dashCd <= 0 && warden.dashTimer <= 0) {
      const moving = input.mx !== 0 || input.my !== 0;
      const dx = moving ? input.mx : Math.cos(warden.aim);
      const dy = moving ? input.my : Math.sin(warden.aim);
      const len = Math.hypot(dx, dy) || 1;
      warden.dashDirX = dx / len;
      warden.dashDirY = dy / len;
      warden.dashTimer = WARDEN.dashTime;
      warden.dashCd = WARDEN.dashCooldown;
      burst(warden.x, warden.y, '#7ee6a2', 8, 120, 3, 0.4);
      events |= EVENT_DASH;
    }
    if (warden.dashTimer > 0) {
      warden.dashTimer -= dt;
      warden.x += warden.dashDirX * WARDEN.dashSpeed * dt;
      warden.y += warden.dashDirY * WARDEN.dashSpeed * dt;
    } else {
      warden.x += input.mx * WARDEN.speed * dt;
      warden.y += input.my * WARDEN.speed * dt;
    }
    warden.x = Math.min(FIELD.width - WARDEN.radius, Math.max(WARDEN.radius, warden.x));
    warden.y = Math.min(FIELD.height - WARDEN.radius, Math.max(WARDEN.radius, warden.y));
    warden.aim = Math.atan2(input.aimY - warden.y, input.aimX - warden.x);

    if (input.overcharge && warden.over >= OVERCHARGE.max && warden.overTime <= 0) {
      warden.over = 0;
      warden.overTime = OVERCHARGE.duration;
      burst(warden.x, warden.y, '#ffe066', 24, 220, 4, 0.6);
      events |= EVENT_OVERCHARGE;
    }

    if (input.plant && state.shards >= TURRET.cost && state.turrets.length < TURRET.max) {
      state.shards -= TURRET.cost;
      state.turrets.push({
        x: warden.x,
        y: warden.y,
        hp: TURRET.hp,
        maxHp: TURRET.hp,
        fireTimer: 0,
        angle: warden.aim,
        grow: 0.25,
      });
      burst(warden.x, warden.y, '#8fce6e', 12, 130, 4, 0.5);
      events |= EVENT_PLANT;
    }

    if (input.firing && warden.fireTimer <= 0 && state.bullets.length < POOL.bullets) {
      const charged = warden.overTime > 0;
      warden.fireTimer = WARDEN.fireInterval * (charged ? OVERCHARGE.fireScale : 1);
      const muzzle = WARDEN.radius + 6;
      state.bullets.push({
        x: warden.x + Math.cos(warden.aim) * muzzle,
        y: warden.y + Math.sin(warden.aim) * muzzle,
        vx: Math.cos(warden.aim) * WARDEN.bulletSpeed,
        vy: Math.sin(warden.aim) * WARDEN.bulletSpeed,
        damage: WARDEN.bulletDamage * (charged ? OVERCHARGE.damageScale : 1),
        radius: WARDEN.bulletRadius,
        charged,
        life: 1.4,
      });
      burst(warden.x + Math.cos(warden.aim) * muzzle, warden.y + Math.sin(warden.aim) * muzzle, charged ? '#ffe066' : '#c8ffd9', 2, 60, 2, 0.15);
      events |= EVENT_SHOT;
    }
    return events;
  }

  function stepTurrets(dt) {
    for (let i = state.turrets.length - 1; i >= 0; i -= 1) {
      const turret = state.turrets[i];
      turret.fireTimer -= dt;
      if (turret.grow > 0) turret.grow -= dt;
      let best = null;
      let bestDist = TURRET.range;
      for (const enemy of state.enemies) {
        const d = distance(turret.x, turret.y, enemy.x, enemy.y);
        if (d < bestDist) {
          bestDist = d;
          best = enemy;
        }
      }
      if (best) {
        turret.angle = Math.atan2(best.y - turret.y, best.x - turret.x);
        if (turret.fireTimer <= 0 && turret.grow <= 0 && state.bullets.length < POOL.bullets) {
          turret.fireTimer = TURRET.interval;
          state.bullets.push({
            x: turret.x + Math.cos(turret.angle) * (TURRET.radius + 4),
            y: turret.y + Math.sin(turret.angle) * (TURRET.radius + 4),
            vx: Math.cos(turret.angle) * TURRET.bulletSpeed,
            vy: Math.sin(turret.angle) * TURRET.bulletSpeed,
            damage: TURRET.damage,
            radius: 4,
            charged: false,
            life: 1.2,
          });
        }
      }
      if (turret.hp <= 0) {
        burst(turret.x, turret.y, '#8fce6e', 16, 170, 4, 0.6);
        state.turrets[i] = state.turrets[state.turrets.length - 1];
        state.turrets.pop();
      }
    }
  }

  function stepEnemy(enemy, dt, events) {
    if (enemy.hp <= 0) return events;
    const warden = state.warden;
    enemy.wobble += dt * 2.2;
    if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
    const toBloom = Math.atan2(BLOOM.y - enemy.y, BLOOM.x - enemy.x);
    const distBloom = distance(enemy.x, enemy.y, BLOOM.x, BLOOM.y);
    const distWarden = distance(enemy.x, enemy.y, warden.x, warden.y);

    if (enemy.kind === 'mote' || enemy.kind === 'wisp') {
      const sway = enemy.kind === 'wisp' ? 0.9 : 0.45;
      const heading = toBloom + Math.sin(enemy.wobble) * sway;
      enemy.x += Math.cos(heading) * enemy.speed * dt;
      enemy.y += Math.sin(heading) * enemy.speed * dt;
    } else if (enemy.kind === 'bramble') {
      const heading = toBloom + Math.sin(enemy.wobble * 0.6) * 0.15;
      enemy.x += Math.cos(heading) * enemy.speed * dt;
      enemy.y += Math.sin(heading) * enemy.speed * dt;
    } else if (enemy.kind === 'spitter') {
      let heading;
      if (distBloom > SPITTER.ring + 40) heading = toBloom;
      else if (distBloom < SPITTER.ring - 40) heading = toBloom + Math.PI;
      else heading = toBloom + (Math.PI / 2) * enemy.strafeDir;
      enemy.timer -= dt;
      if (enemy.timer <= 0) {
        enemy.timer = 2 + random() * 1.5;
        enemy.strafeDir *= -1;
      }
      enemy.x += Math.cos(heading) * enemy.speed * dt;
      enemy.y += Math.sin(heading) * enemy.speed * dt;
      enemy.shotTimer -= dt;
      if (enemy.shotTimer <= 0 && state.ebullets.length < POOL.enemyBullets) {
        enemy.shotTimer = SPITTER.shotInterval * (0.85 + random() * 0.3);
        const target = distWarden < 280 ? warden : BLOOM;
        const aim = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        state.ebullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(aim) * SPITTER.globSpeed,
          vy: Math.sin(aim) * SPITTER.globSpeed,
          damage: SPITTER.globDamage,
          radius: SPITTER.globRadius,
          kind: 'glob',
          life: 4,
        });
      }
    } else if (enemy.kind === 'dart') {
      if (enemy.mode === 'stalk') {
        const heading = Math.atan2(warden.y - enemy.y, warden.x - enemy.x);
        enemy.x += Math.cos(heading) * enemy.speed * dt;
        enemy.y += Math.sin(heading) * enemy.speed * dt;
        if (distWarden < DART.lungeRange) {
          enemy.mode = 'telegraph';
          enemy.modeTimer = DART.telegraph;
        }
      } else if (enemy.mode === 'telegraph') {
        enemy.modeTimer -= dt;
        enemy.lockX = warden.x;
        enemy.lockY = warden.y;
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'lunge';
          enemy.modeTimer = DART.lungeTime;
        }
      } else if (enemy.mode === 'lunge') {
        enemy.modeTimer -= dt;
        const heading = Math.atan2(enemy.lockY - enemy.y, enemy.lockX - enemy.x);
        enemy.x += Math.cos(heading) * DART.lungeSpeed * dt;
        enemy.y += Math.sin(heading) * DART.lungeSpeed * dt;
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'recover';
          enemy.modeTimer = 0.6;
        }
      } else {
        enemy.modeTimer -= dt;
        if (enemy.modeTimer <= 0) enemy.mode = 'stalk';
      }
    } else if (enemy.kind === 'herald') {
      const enraged = enemy.hp < enemy.maxHp * HERALD.enrageBelow;
      enemy.burstAngle += dt * 0.35;
      const orbitAngle = Math.atan2(enemy.y - BLOOM.y, enemy.x - BLOOM.x) + dt * 0.12;
      const goalX = BLOOM.x + Math.cos(orbitAngle) * HERALD.orbit;
      const goalY = BLOOM.y + Math.sin(orbitAngle) * HERALD.orbit;
      const heading = Math.atan2(goalY - enemy.y, goalX - enemy.x);
      const speed = enemy.speed * (enraged ? 1.4 : 1);
      enemy.x += Math.cos(heading) * speed * dt;
      enemy.y += Math.sin(heading) * speed * dt;
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0 && state.ebullets.length < POOL.enemyBullets - 20) {
        enemy.burstTimer = enraged ? HERALD.enrageBurst : HERALD.burstInterval;
        const count = enraged ? HERALD.enrageCount : HERALD.burstCount;
        for (let i = 0; i < count; i += 1) {
          const angle = enemy.burstAngle + (i / count) * Math.PI * 2;
          state.ebullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * HERALD.bulletSpeed * (enraged ? 1.3 : 1),
            vy: Math.sin(angle) * HERALD.bulletSpeed * (enraged ? 1.3 : 1),
            damage: 12,
            radius: HERALD.bulletRadius,
            kind: 'bolt',
            life: 4.5,
          });
        }
        burst(enemy.x, enemy.y, '#e8b4ff', 10, 120, 4, 0.4);
      }
      enemy.summonTimer -= dt;
      if (enemy.summonTimer <= 0) {
        enemy.summonTimer = HERALD.summonInterval;
        for (let i = 0; i < HERALD.summonCount; i += 1) {
          const angle = random() * Math.PI * 2;
          spawnEnemy('mote', enemy.x + Math.cos(angle) * (enemy.radius + 20), enemy.y + Math.sin(angle) * (enemy.radius + 20));
        }
        burst(enemy.x, enemy.y, '#b388ff', 12, 140, 4, 0.5);
      }
    }

    // Light separation so the horde never stacks into one body.
    for (const other of state.enemies) {
      if (other === enemy) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const d = Math.hypot(dx, dy);
      const min = enemy.radius + other.radius - 4;
      if (d > 0.01 && d < min) {
        const push = ((min - d) / min) * 26 * dt;
        enemy.x += (dx / d) * push;
        enemy.y += (dy / d) * push;
      }
    }

    // Contact with the Bloom.
    if (distBloom < enemy.radius + BLOOM.radius) {
      const plan = ENEMY[enemy.kind];
      events = damageBloom(plan.bloomDamage, events);
      if (enemy.kind === 'bramble') {
        enemy.hp -= 20;
        enemy.x += Math.cos(toBloom + Math.PI) * 26;
        enemy.y += Math.sin(toBloom + Math.PI) * 26;
      } else if (enemy.kind === 'herald') {
        enemy.x += Math.cos(toBloom + Math.PI) * 30;
        enemy.y += Math.sin(toBloom + Math.PI) * 30;
      } else {
        enemy.hp = 0;
      }
    }
    // Contact with the Warden.
    if (distWarden < enemy.radius + WARDEN.radius && warden.mercy <= 0 && warden.dashTimer <= 0) {
      const plan = ENEMY[enemy.kind];
      const before = events;
      events = damageWarden(plan.touchDamage, events);
      if (events !== before) {
        if (enemy.kind === 'mote' || enemy.kind === 'dart' || enemy.kind === 'wisp') enemy.hp = 0;
        else {
          const away = Math.atan2(enemy.y - warden.y, enemy.x - warden.x);
          enemy.x += Math.cos(away) * 24;
          enemy.y += Math.sin(away) * 24;
        }
      }
    }
    // Contact with a turret: the horde chews through thorns.
    for (const turret of state.turrets) {
      if (distance(enemy.x, enemy.y, turret.x, turret.y) < enemy.radius + TURRET.radius) {
        turret.hp -= 14 * dt * 4;
        const away = Math.atan2(enemy.y - turret.y, enemy.x - turret.x);
        enemy.x += Math.cos(away) * 14 * dt;
        enemy.y += Math.sin(away) * 14 * dt;
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let spent = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!spent) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.radius + bullet.radius) {
            enemy.hp -= bullet.damage;
            enemy.hitFlash = 0.08;
            burst(bullet.x, bullet.y, bullet.charged ? '#ffe066' : '#c8ffd9', 3, 90, 2, 0.25);
            spent = true;
            if (enemy.hp <= 0) events = killEnemy(j, events);
            break;
          }
        }
      }
      if (spent) {
        state.bullets[i] = state.bullets[state.bullets.length - 1];
        state.bullets.pop();
      }
    }
    return events;
  }

  function stepEnemyBullets(dt, events) {
    const warden = state.warden;
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const shot = state.ebullets[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      let spent = shot.life <= 0 || shot.x < -30 || shot.x > FIELD.width + 30 || shot.y < -30 || shot.y > FIELD.height + 30;
      if (!spent && distance(shot.x, shot.y, warden.x, warden.y) < shot.radius + WARDEN.radius) {
        const before = events;
        events = damageWarden(shot.damage, events);
        if (events !== before || warden.mercy > 0 || warden.dashTimer > 0) spent = true;
      }
      if (!spent && distance(shot.x, shot.y, BLOOM.x, BLOOM.y) < shot.radius + BLOOM.radius) {
        events = damageBloom(Math.max(3, Math.round(shot.damage * 0.5)), events);
        spent = true;
      }
      if (!spent) {
        for (const turret of state.turrets) {
          if (distance(shot.x, shot.y, turret.x, turret.y) < shot.radius + TURRET.radius) {
            turret.hp -= shot.damage;
            burst(shot.x, shot.y, '#8fce6e', 4, 90, 3, 0.3);
            spent = true;
            break;
          }
        }
      }
      if (spent) {
        state.ebullets[i] = state.ebullets[state.ebullets.length - 1];
        state.ebullets.pop();
      }
    }
    return events;
  }

  function stepPickups(dt, events) {
    const warden = state.warden;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      const d = distance(pickup.x, pickup.y, warden.x, warden.y);
      if (d < PICKUP.magnet) {
        const pull = 1 - d / PICKUP.magnet;
        pickup.vx += ((warden.x - pickup.x) / (d || 1)) * 900 * pull * dt;
        pickup.vy += ((warden.y - pickup.y) / (d || 1)) * 900 * pull * dt;
      }
      pickup.vx *= 1 - 3 * dt;
      pickup.vy *= 1 - 3 * dt;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      let taken = pickup.life <= 0;
      if (!taken && d < PICKUP.collect) {
        taken = true;
        if (pickup.kind === 'shard') {
          state.shards += pickup.value;
          burst(pickup.x, pickup.y, '#ffd76a', 4, 80, 3, 0.3);
          events |= EVENT_PICKUP;
        } else if (pickup.kind === 'heart') {
          warden.hp = Math.min(warden.maxHp, warden.hp + PICKUP.heartHeal);
          floater(warden.x, warden.y - 26, `+${PICKUP.heartHeal}`, '#ff5d8f');
          burst(pickup.x, pickup.y, '#ff5d8f', 8, 100, 3, 0.4);
          events |= EVENT_HEAL;
        } else {
          state.bloom.hp = Math.min(state.bloom.maxHp, state.bloom.hp + PICKUP.mendHeal);
          floater(BLOOM.x, BLOOM.y - 44, `+${PICKUP.mendHeal}`, '#7ee6ff');
          burst(pickup.x, pickup.y, '#7ee6ff', 8, 100, 3, 0.4);
          events |= EVENT_HEAL;
        }
      }
      if (taken) {
        state.pickups[i] = state.pickups[state.pickups.length - 1];
        state.pickups.pop();
      }
    }
    return events;
  }

  function stepAmbient(dt) {
    state.time += dt;
    state.bloom.pulse += dt;
    if (random() < dt * 6 && state.particles.length < POOL.particles) {
      state.particles.push({
        x: random() * FIELD.width,
        y: FIELD.height + 8,
        vx: (random() - 0.5) * 14,
        vy: -12 - random() * 16,
        life: 6 + random() * 4,
        maxLife: 10,
        size: 1.5 + random() * 2,
        color: random() < 0.5 ? '#ffd76a' : '#ff7ad9',
        drag: 0,
      });
    }
    stepParticles(dt);
    stepFireflies(dt);
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = 1 - Math.min(0.9, p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      if (p.life <= 0) {
        state.particles[i] = state.particles[state.particles.length - 1];
        state.particles.pop();
      }
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
  }

  function stepFireflies(dt) {
    for (const fly of state.fireflies) {
      fly.phase += dt;
      fly.angle += Math.sin(fly.phase * 0.7) * dt * 0.8;
      fly.x += Math.cos(fly.angle) * fly.speed * dt;
      fly.y += Math.sin(fly.angle) * fly.speed * dt;
      if (fly.x < 0 || fly.x > FIELD.width) fly.angle = Math.PI - fly.angle;
      if (fly.y < 0 || fly.y > FIELD.height) fly.angle = -fly.angle;
      fly.x = Math.min(FIELD.width, Math.max(0, fly.x));
      fly.y = Math.min(FIELD.height, Math.max(0, fly.y));
    }
  }

  function step(dt, input, ambient) {
    if (ambient) {
      stepAmbient(dt);
      return 0;
    }
    if (state.over || state.won) return 0;
    let events = 0;
    state.time += dt;
    state.bloom.pulse += dt;
    if (state.bloom.hurtFlash > 0) state.bloom.hurtFlash -= dt;
    // The Bloom slowly recovers when the horde leaves it alone.
    if (state.bloom.hp > 0 && state.bloom.hp < state.bloom.maxHp && state.time - state.bloom.lastHurt > 4) {
      state.bloom.hp = Math.min(state.bloom.maxHp, state.bloom.hp + 2 * dt);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;

    if (state.phase === 'breather') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) events |= startWave(state.wave + 1);
    } else {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = Math.max(0.3, 0.8 - state.wave * 0.04);
          spawnEnemy(state.spawnQueue.shift());
        }
      }
      const bossAlive = state.boss !== null;
      if (bossAlive && state.spawnQueue.length === 0) {
        state.trickleTimer -= dt;
        if (state.trickleTimer <= 0) {
          state.trickleTimer = 12;
          spawnEnemy('mote');
          spawnEnemy('mote');
        }
      }
      if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
        const bonus = state.wave * 50;
        state.score += bonus;
        floater(BLOOM.x, BLOOM.y - 60, `Wave clear +${bonus}`, '#ffd76a');
        if (state.wave >= TOTAL_WAVES) {
          state.won = true;
          state.score += 1000;
          events |= EVENT_WIN;
        } else {
          state.phase = 'breather';
          state.phaseTimer = BREATHER_SECONDS;
          state.banner = `Wave ${state.wave} cleared`;
          state.bannerTimer = 2;
        }
      }
    }

    events = stepWarden(dt, input, events);
    stepTurrets(dt);
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      events = stepEnemy(enemy, dt, events);
      // Contact handling only zeroes hp; sweep the dead here, in the same step.
      if (state.enemies[i] === enemy && enemy.hp <= 0) {
        events = killEnemy(i, events);
      }
    }
    state.boss = state.enemies.find((enemy) => enemy.kind === 'herald') ?? null;
    events = stepBullets(dt, events);
    events = stepEnemyBullets(dt, events);
    events = stepPickups(dt, events);
    stepParticles(dt);
    stepFireflies(dt);

    if (!state.over && !state.won) {
      if (state.warden.hp <= 0) {
        state.over = true;
        state.overReason = 'warden';
        burst(state.warden.x, state.warden.y, '#7ee6a2', 30, 240, 4, 0.8);
        events |= EVENT_OVER;
      } else if (state.bloom.hp <= 0) {
        state.over = true;
        state.overReason = 'bloom';
        burst(BLOOM.x, BLOOM.y, '#ff7ad9', 40, 260, 5, 0.9);
        events |= EVENT_OVER;
      }
    }
    return events;
  }

  reset();

  return { state, reset, step };
}
