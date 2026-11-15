// Keyboard and mouse for a twin-stick game. Held keys steer, the mouse aims and
// fires, and one-shot presses (start, pause, dash, plant, overcharge, mute, restart)
// are queued as bit flags and taken once per frame, so a press between two frames is
// never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_PLANT = 8;
export const ACTION_OVERCHARGE = 16;
export const ACTION_MUTE = 32;
export const ACTION_RESTART = 64;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PLANT = new Set(['KeyQ', 'KeyE']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas, field) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let aimX = field.width / 2;
  let aimY = field.height / 2 - 120;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    aimX = ((event.clientX - rect.left) / rect.width) * field.width;
    aimY = ((event.clientY - rect.top) / rect.height) * field.height;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (DASH.has(event.code)) {
      // Space also confirms on menus; the loop reads it by screen, never twice.
      if (!event.repeat) actions |= ACTION_DASH | ACTION_CONFIRM;
    } else if (PLANT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PLANT;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_OVERCHARGE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });
  canvas.addEventListener('mousemove', toLogical);
  canvas.addEventListener('pointerdown', (event) => {
    toLogical(event);
    if (event.button === 0) {
      firing = true;
      actions |= ACTION_CONFIRM;
    } else if (event.button === 2) {
      actions |= ACTION_PLANT;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The steering vector, normalised: x and y each in [-1, 1]. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
        else if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** The mouse position in logical field coordinates. */
    aim() {
      return { x: aimX, y: aimY };
    },
    /** True while the fire button is held. */
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
