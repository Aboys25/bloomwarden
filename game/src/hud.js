// The DOM layer: the heads-up display, the wave banner, the boss bar and the
// four screens (title, pause, game over, victory). The canvas paints the world;
// this module owns every word and bar around it. Writes are cached, so a value
// that did not change costs no DOM work.

export function createHud() {
  const cache = new Map();
  const el = (id) => document.getElementById(id);
  const elements = {
    score: el('score'),
    best: el('best'),
    wave: el('wave-label'),
    shards: el('shards'),
    wardenFill: el('warden-hp-fill'),
    wardenText: el('warden-hp-text'),
    dashPip: el('dash-pip'),
    bloomFill: el('bloom-hp-fill'),
    bloomText: el('bloom-hp-text'),
    overFill: el('over-fill'),
    overLabel: el('over-label'),
    turrets: el('turret-count'),
    bossBar: el('boss-bar'),
    bossFill: el('boss-fill'),
    bossLabel: el('boss-label'),
    banner: el('banner'),
    mute: el('mute-badge'),
    status: el('status'),
    title: el('screen-title'),
    pause: el('screen-pause'),
    over: el('screen-over'),
    win: el('screen-win'),
    titleBest: el('title-best'),
    overScore: el('over-score'),
    overWave: el('over-wave'),
    overKills: el('over-kills'),
    overBest: el('over-best'),
    overReason: el('over-reason'),
    winScore: el('win-score'),
    winKills: el('win-kills'),
    winBest: el('win-best'),
  };

  function setText(node, value) {
    if (!node) return;
    if (cache.get(node) !== value) {
      cache.set(node, value);
      node.textContent = value;
    }
  }

  function setWidth(node, fraction) {
    if (!node) return;
    const percent = `${Math.max(0, Math.min(100, Math.round(fraction * 100)))}%`;
    if (cache.get(node) !== percent) {
      cache.set(node, percent);
      node.style.width = percent;
    }
  }

  function show(node, visible, display = 'block') {
    if (!node) return;
    const state = visible ? display : 'none';
    if (cache.get(node) !== state) {
      cache.set(node, state);
      node.style.display = state;
    }
  }

  return {
    /** Show one screen and hide the others; 'play' hides them all. */
    showScreen(name, state, best) {
      show(elements.title, name === 'title', 'flex');
      show(elements.pause, name === 'paused', 'flex');
      show(elements.over, name === 'over', 'flex');
      show(elements.win, name === 'win', 'flex');
      if (name === 'title') setText(elements.titleBest, `Best score: ${best}`);
      if (name === 'over' && state) {
        setText(elements.overScore, String(state.score));
        setText(elements.overWave, String(Math.max(1, state.wave)));
        setText(elements.overKills, String(state.kills));
        setText(elements.overBest, String(best));
        setText(
          elements.overReason,
          state.overReason === 'bloom' ? 'The Last Bloom was destroyed.' : 'The Warden has fallen.',
        );
      }
      if (name === 'win' && state) {
        setText(elements.winScore, String(state.score));
        setText(elements.winKills, String(state.kills));
        setText(elements.winBest, String(best));
      }
    },

    /** Refresh every bar and number from the world's state. */
    update(state, best, muted) {
      const warden = state.warden;
      setText(elements.score, String(state.score));
      setText(elements.best, `Best ${best}`);
      setText(elements.wave, state.wave === 0 ? 'The garden stirs…' : `Wave ${state.wave} / 10`);
      setText(elements.shards, String(state.shards));
      setWidth(elements.wardenFill, warden.hp / warden.maxHp);
      setText(elements.wardenText, `${Math.ceil(warden.hp)}`);
      setWidth(elements.bloomFill, state.bloom.hp / state.bloom.maxHp);
      setText(elements.bloomText, `${Math.ceil(state.bloom.hp)} / ${state.bloom.maxHp}`);
      setWidth(elements.overFill, warden.overTime > 0 ? warden.overTime / 5 : warden.over / 100);
      setText(
        elements.overLabel,
        warden.overTime > 0 ? 'OVERCHARGE!' : warden.over >= 100 ? 'OVERCHARGE READY [F]' : 'Overcharge',
      );
      setText(elements.turrets, `Thorns ${state.turrets.length}/3`);
      const dashReady = warden.dashCd <= 0;
      setText(elements.dashPip, dashReady ? 'DASH READY' : 'dash…');
      elements.dashPip.classList.toggle('ready', dashReady);
      elements.overLabel.classList.toggle('ready', warden.over >= 100 || warden.overTime > 0);
      if (state.boss) {
        show(elements.bossBar, true);
        setWidth(elements.bossFill, state.boss.hp / state.boss.maxHp);
        setText(elements.bossLabel, state.boss.hp < state.boss.maxHp * 0.3 ? 'THE HERALD — ENRAGED' : 'THE HERALD');
      } else {
        show(elements.bossBar, false);
      }
      if (state.bannerTimer > 0) {
        setText(elements.banner, state.banner);
        elements.banner.style.opacity = String(Math.min(1, state.bannerTimer));
        show(elements.banner, true);
      } else {
        show(elements.banner, false);
      }
      show(elements.mute, muted);
    },

    /** Wire every start/restart button to one handler. */
    bindStart(handler) {
      for (const button of document.querySelectorAll('[data-action="start"]')) {
        button.addEventListener('click', handler);
      }
    },

    /** The line screen readers announce. */
    announce(message) {
      setText(elements.status, message);
    },
  };
}
