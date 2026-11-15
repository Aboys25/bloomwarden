// Every tuning number and colour for BLOOMWARDEN lives here. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the size of the screen it is played on.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The Last Bloom, rooted at the garden's centre: lose it and the garden falls. */
export const BLOOM = { x: 640, y: 360, radius: 30, hp: 120 };

export const WARDEN = {
  radius: 15,
  speed: 305,
  hp: 100,
  fireInterval: 0.13,
  bulletSpeed: 760,
  bulletDamage: 10,
  bulletRadius: 5,
  dashSpeed: 950,
  dashTime: 0.16,
  dashCooldown: 1.5,
  /** Brief mercy after a hit, so one touch is never two. */
  mercyTime: 0.6,
};

export const TOTAL_WAVES = 10;
/** The breather between waves, in seconds: enough to plant and breathe, never to idle. */
export const BREATHER_SECONDS = 3.5;

export const TURRET = {
  cost: 25,
  max: 3,
  radius: 15,
  range: 360,
  interval: 0.3,
  damage: 7,
  hp: 40,
  bulletSpeed: 660,
};

export const OVERCHARGE = {
  max: 100,
  gainPerKill: 9,
  duration: 5,
  /** Fire-interval multiplier while overcharged: smaller means faster. */
  fireScale: 0.55,
  damageScale: 1.6,
};

/** Per-kind body plan: speed in pixels a second, damage on contact, spoils on death. */
export const ENEMY = {
  mote: { hp: 14, speed: 105, radius: 12, score: 20, shards: 2, bloomDamage: 5, touchDamage: 8 },
  bramble: { hp: 70, speed: 48, radius: 22, score: 50, shards: 5, bloomDamage: 12, touchDamage: 12 },
  spitter: { hp: 30, speed: 72, radius: 15, score: 40, shards: 4, bloomDamage: 8, touchDamage: 8 },
  dart: { hp: 18, speed: 150, radius: 11, score: 30, shards: 3, bloomDamage: 6, touchDamage: 14 },
  wisp: { hp: 24, speed: 185, radius: 12, score: 35, shards: 3, bloomDamage: 7, touchDamage: 10 },
  herald: { hp: 950, speed: 42, radius: 44, score: 500, shards: 40, bloomDamage: 25, touchDamage: 20 },
};

export const SPITTER = { ring: 300, shotInterval: 2.3, globSpeed: 250, globDamage: 8, globRadius: 7 };
export const DART = { lungeRange: 270, telegraph: 0.45, lungeSpeed: 520, lungeTime: 0.5 };
export const HERALD = {
  burstInterval: 2.4,
  burstCount: 12,
  bulletSpeed: 205,
  bulletRadius: 8,
  summonInterval: 6,
  summonCount: 3,
  enrageBelow: 0.3,
  enrageBurst: 1.6,
  enrageCount: 16,
  orbit: 240,
};

export const PICKUP = {
  magnet: 110,
  collect: 26,
  life: 12,
  heartHeal: 25,
  mendHeal: 20,
  heartChance: 0.25,
  mendChance: 0.12,
};

/** Pool caps: everything is allocated once, at boot, and reused. */
export const POOL = { enemies: 90, bullets: 160, enemyBullets: 220, turrets: 3, pickups: 90, particles: 420, floaters: 24 };

export const PALETTE = {
  backdrop: '#0d1410',
  soil: '#1c2f22',
  soilDark: '#14231a',
  grass: '#1e3a24',
  grassTip: '#439a52',
  petal: '#ff7ad9',
  petalCore: '#ffd76a',
  bloomGlow: 'rgba(255, 122, 217, 0.35)',
  warden: '#7ee6a2',
  wardenCloak: '#2c6e4a',
  bullet: '#c8ffd9',
  overcharge: '#ffe066',
  mote: '#b388ff',
  bramble: '#7a5f8f',
  spitter: '#4fd8c4',
  dart: '#ff6b6b',
  wisp: '#a8e6ff',
  herald: '#e8b4ff',
  glob: '#9dff57',
  shard: '#ffd76a',
  heart: '#ff5d8f',
  mend: '#7ee6ff',
  turret: '#8fce6e',
  panel: 'rgba(10, 20, 14, 0.82)',
  text: '#eef7ee',
  muted: '#93a893',
  danger: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'bloomwarden.best';
