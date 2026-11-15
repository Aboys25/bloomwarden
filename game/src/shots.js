// The screenshot scenes behind ?shot=title|action|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by an
// autopilot that kites, dodges, plants and overcharges like a careful player — so
// every frame is what a real game looks like, and the same seed always stages the
// same frame. Nothing is posed by editing state: the purse, the meter and the
// turrets in the action shot are all earned by playing.

import { BLOOM, FIELD, OVERCHARGE, STEP, TURRET } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 5;
const LIMIT_SECONDS = 420;
const END_LIMIT_SECONDS = 600;

/**
 * A careful player: keeps a ring around the Bloom, slides away from the nearest
 * enemy and from incoming shots, gathers pickups when it is safe, plants thorns
 * near the Bloom and fires overcharge into a crowd.
 */
export function autopilot(state, spareBoss) {
  const warden = state.warden;
  let mx = 0;
  let my = 0;

  // The threat: the enemy closest to the Bloom. Everything else is secondary.
  let threat = null;
  let threatBloomDist = Infinity;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const db = Math.hypot(enemy.x - BLOOM.x, enemy.y - BLOOM.y);
    if (db < threatBloomDist) {
      threatBloomDist = db;
      threat = enemy;
    }
    const dw = Math.hypot(enemy.x - warden.x, enemy.y - warden.y);
    if (dw < nearestDist) {
      nearestDist = dw;
      nearest = enemy;
    }
  }

  // Anchor: stand between the threat and the Bloom, so the line of fire meets
  // the horde before it meets the flower. No threat: hold a ring round the Bloom.
  let anchorX;
  let anchorY;
  if (threat) {
    const a = Math.atan2(threat.y - BLOOM.y, threat.x - BLOOM.x);
    anchorX = BLOOM.x + Math.cos(a) * 150;
    anchorY = BLOOM.y + Math.sin(a) * 150;
  } else {
    const toWarden = Math.atan2(warden.y - BLOOM.y, warden.x - BLOOM.x);
    anchorX = BLOOM.x + Math.cos(toWarden) * 240;
    anchorY = BLOOM.y + Math.sin(toWarden) * 240;
  }
  const anchorDist = Math.hypot(anchorX - warden.x, anchorY - warden.y);
  if (anchorDist > 30) {
    mx += ((anchorX - warden.x) / anchorDist) * 0.8;
    my += ((anchorY - warden.y) / anchorDist) * 0.8;
  }

  // Repulsion from close enemies, so the Warden never stands inside the horde.
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - warden.x, enemy.y - warden.y);
    if (d < 170) {
      const push = (1 - d / 170) * 1.5;
      mx += ((warden.x - enemy.x) / (d || 1)) * push;
      my += ((warden.y - enemy.y) / (d || 1)) * push;
    }
  }

  // Sidestep incoming shots.
  let dodge = false;
  for (const shot of state.ebullets) {
    const dx = warden.x - shot.x;
    const dy = warden.y - shot.y;
    const d = Math.hypot(dx, dy);
    if (d < 120) {
      const closing = dx * shot.vx + dy * shot.vy;
      if (closing > 0) {
        dodge = d < 75;
        const side = dx * shot.vy - dy * shot.vx > 0 ? 1 : -1;
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        mx += (-shot.vy / speed) * side * 1.6;
        my += (shot.vx / speed) * side * 1.6;
      }
    }
  }

  // Gather a pickup when nothing is breathing down the Warden's neck.
  if (nearestDist > 130) {
    let bestPickup = null;
    let bestPickupDist = 280;
    for (const pickup of state.pickups) {
      const d = Math.hypot(pickup.x - warden.x, pickup.y - warden.y);
      if (d < bestPickupDist) {
        bestPickupDist = d;
        bestPickup = pickup;
      }
    }
    if (bestPickup) {
      mx += ((bestPickup.x - warden.x) / (bestPickupDist || 1)) * 0.9;
      my += ((bestPickup.y - warden.y) / (bestPickupDist || 1)) * 0.9;
    }
  }

  const moveLen = Math.hypot(mx, my);
  if (moveLen > 1) {
    mx /= moveLen;
    my /= moveLen;
  }

  // Aim: the threat to the Bloom first, unless it is the Herald and its minions
  // still live (the boss scene spares it); an enemy on top of the Warden wins.
  let target = threat;
  if (spareBoss && threat && threat.kind === 'herald') {
    let minion = null;
    let minionDist = Infinity;
    for (const enemy of state.enemies) {
      if (enemy.kind === 'herald') continue;
      const db = Math.hypot(enemy.x - BLOOM.x, enemy.y - BLOOM.y);
      if (db < minionDist) {
        minionDist = db;
        minion = enemy;
      }
    }
    if (minion) target = minion;
  } else if (state.boss && threat && threat.kind !== 'herald' && threatBloomDist > 200) {
    // The garden's edge is quiet: pour fire into the Herald to end the siege.
    target = state.boss;
  }
  // Spitters shell the Bloom from range: hunt them before they settle in,
  // unless a melee enemy is already at the flower.
  if (threatBloomDist > 120) {
    let spitter = null;
    let spitterDist = 430;
    for (const enemy of state.enemies) {
      if (enemy.kind !== 'spitter') continue;
      const db = Math.hypot(enemy.x - BLOOM.x, enemy.y - BLOOM.y);
      if (db < spitterDist) {
        spitterDist = db;
        spitter = enemy;
      }
    }
    if (spitter) target = spitter;
  }
  if (nearest && nearestDist < 80) target = nearest;
  if (!target) target = nearest;
  const aimX = target ? target.x : warden.x + Math.cos(warden.aim) * 100;
  const aimY = target ? target.y : warden.y + Math.sin(warden.aim) * 100;

  const nearBloom = Math.hypot(warden.x - BLOOM.x, warden.y - BLOOM.y) < 320;
  return {
    mx,
    my,
    aimX,
    aimY,
    firing: state.enemies.length > 0,
    dash: dodge || nearestDist < 55,
    plant: state.shards >= TURRET.cost && state.turrets.length < TURRET.max && state.wave >= 2 && nearBloom,
    overcharge: warden.over >= OVERCHARGE.max && state.enemies.length >= 3,
  };
}

/** A doomed player: shoots, never moves, never dashes — the end scene's author. */
function doomedPilot(state) {
  const warden = state.warden;
  let target = null;
  let targetDist = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - warden.x, enemy.y - warden.y);
    if (d < targetDist) {
      targetDist = d;
      target = enemy;
    }
  }
  return {
    mx: 0,
    my: 0,
    aimX: target ? target.x : warden.x,
    aimY: target ? target.y : warden.y - 100,
    firing: state.enemies.length > 0,
    dash: false,
    plant: false,
    overcharge: false,
  };
}

function playUntil(world, seconds, pilot) {
  const limit = Math.floor(seconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    const events = world.step(STEP, pilot(world.state), false);
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'action') {
    let waveMarkAt = null;
    const limit = Math.floor(LIMIT_SECONDS / STEP);
    for (let i = 0; i < limit; i += 1) {
      const events = world.step(STEP, autopilot(world.state, false), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      const s = world.state;
      if (s.wave >= 8 && s.phase === 'active') {
        if (waveMarkAt === null) waveMarkAt = s.time;
        // Catch the wave at its densest, before the autopilot thins it out:
        // ten enemies on screen beats an overcharge glow with the field cleared.
        const busy = s.time - waveMarkAt > 2 && s.enemies.length >= 10;
        if (busy || s.time - waveMarkAt > 10) break;
      }
    }
    const over = world.state.over;
    const won = world.state.won;
    return { screen: over ? SCREEN_OVER : won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    let bossAt = null;
    const limit = Math.floor(LIMIT_SECONDS / STEP);
    for (let i = 0; i < limit; i += 1) {
      const events = world.step(STEP, autopilot(world.state, true), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      const s = world.state;
      if (s.boss) {
        if (bossAt === null) bossAt = s.time;
        if (s.time - bossAt > 3.5) break;
      }
    }
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    playUntil(world, END_LIMIT_SECONDS, doomedPilot);
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step(STEP, null, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
