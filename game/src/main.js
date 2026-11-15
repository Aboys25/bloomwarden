// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), the renderer paints
// what is there and the HUD reads the same state. The game moves between five
// screens: title, play, paused, game over and victory.
//
// ?seed=N fixes the garden's dice. ?shot=title|action|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BLOOM_HIT,
  EVENT_BOSS,
  EVENT_DASH,
  EVENT_HEAL,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_OVER,
  EVENT_OVERCHARGE,
  EVENT_PICKUP,
  EVENT_PLANT,
  EVENT_SHOT,
  EVENT_WAVE,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_OVERCHARGE,
  ACTION_PAUSE,
  ACTION_PLANT,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  hud.showScreen(scene.screen, world.state, scene.best);
  hud.update(world.state, scene.best, false);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, FIELD);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    hud.showScreen('play');
    hud.announce('Playing. Defend the Last Bloom.');
  }

  function resumeGame() {
    screen = SCREEN_PLAY;
    hud.showScreen('play');
    hud.announce('Playing.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    hud.showScreen(screen, world.state, best);
    audio.play(won ? 'win' : 'over');
    hud.announce(won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playSounds(events) {
    if (events & EVENT_SHOT) audio.play('shoot');
    if (events & EVENT_HIT) audio.play('hurt');
    if (events & EVENT_BLOOM_HIT) audio.play('bloomHit');
    if (events & EVENT_KILL) audio.play('kill');
    if (events & EVENT_PICKUP) audio.play('pickup');
    if (events & EVENT_HEAL) audio.play('heart');
    if (events & EVENT_WAVE) audio.play('wave');
    if (events & EVENT_BOSS) audio.play('boss');
    if (events & EVENT_DASH) audio.play('dash');
    if (events & EVENT_PLANT) audio.play('plant');
    if (events & EVENT_OVERCHARGE) audio.play('overcharge');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) muted = audio.toggleMute();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        audio.ensure();
        audio.play('click');
        startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        hud.showScreen('paused');
        hud.announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) resumeGame();
      else if (actions & ACTION_RESTART) startGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, null, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      const move = input.move();
      const aim = input.aim();
      const firing = input.isFiring();
      let first = true;
      let frameEvents = 0;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(
          STEP,
          {
            mx: move.x,
            my: move.y,
            aimX: aim.x,
            aimY: aim.y,
            firing,
            dash: first && Boolean(actions & ACTION_DASH),
            plant: first && Boolean(actions & ACTION_PLANT),
            overcharge: first && Boolean(actions & ACTION_OVERCHARGE),
          },
          false,
        );
        frameEvents |= events;
        accumulator -= STEP;
        first = false;
        if (events & EVENT_OVER) endGame(false);
        else if (events & EVENT_WIN) endGame(true);
      }
      playSounds(frameEvents);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen);
    hud.update(world.state, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting the horde in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showScreen('paused');
      hud.announce('Paused.');
    }
  });

  // The first gesture unlocks sound; the start buttons start the run.
  const unlock = () => audio.ensure();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  hud.bindStart(() => {
    audio.ensure();
    audio.play('click');
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
    else if (screen === SCREEN_PAUSED) resumeGame();
  });

  hud.showScreen('title', world.state, best);
  hud.announce('BLOOMWARDEN. Press Enter or click to defend the Last Bloom.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
