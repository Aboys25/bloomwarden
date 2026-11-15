// Procedural WebAudio: every sound is synthesised from oscillators and filtered
// noise, so the game ships no audio files. The context is created lazily on the
// first user gesture, and every call is guarded: a missing AudioContext, a muted
// tab or a blocked autoplay never throws and never stops the game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let lastShot = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ freq, end, duration, type = 'sine', gain = 0.5, delay = 0 }) {
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (end !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
      amp.gain.setValueAtTime(gain, start);
      amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(amp).connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // A failed note is silence, never a crash.
    }
  }

  function noise({ duration, gain = 0.4, cutoff = 1200, delay = 0 }) {
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + delay;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(gain, start);
      amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
      source.connect(filter).connect(amp).connect(master);
      source.start(start);
    } catch {
      // Silence, never a crash.
    }
  }

  const VOICES = {
    shoot() {
      const now = ctx ? ctx.currentTime : 0;
      if (now - lastShot < 0.05) return;
      lastShot = now;
      tone({ freq: 880, end: 320, duration: 0.07, type: 'square', gain: 0.16 });
    },
    hit() {
      noise({ duration: 0.06, gain: 0.25, cutoff: 2400 });
    },
    kill() {
      tone({ freq: 320, end: 90, duration: 0.14, type: 'sawtooth', gain: 0.2 });
      noise({ duration: 0.1, gain: 0.2, cutoff: 1600 });
    },
    pickup() {
      tone({ freq: 660, duration: 0.07, type: 'sine', gain: 0.3 });
      tone({ freq: 990, duration: 0.09, type: 'sine', gain: 0.3, delay: 0.06 });
    },
    heart() {
      tone({ freq: 520, duration: 0.12, type: 'sine', gain: 0.35 });
      tone({ freq: 780, duration: 0.16, type: 'sine', gain: 0.35, delay: 0.1 });
    },
    wave() {
      tone({ freq: 392, duration: 0.14, type: 'triangle', gain: 0.4 });
      tone({ freq: 523, duration: 0.14, type: 'triangle', gain: 0.4, delay: 0.12 });
      tone({ freq: 659, duration: 0.2, type: 'triangle', gain: 0.4, delay: 0.24 });
    },
    boss() {
      tone({ freq: 110, end: 55, duration: 0.7, type: 'sawtooth', gain: 0.4 });
      tone({ freq: 165, end: 82, duration: 0.7, type: 'sawtooth', gain: 0.25, delay: 0.08 });
    },
    dash() {
      noise({ duration: 0.14, gain: 0.22, cutoff: 3200 });
    },
    plant() {
      tone({ freq: 220, end: 440, duration: 0.16, type: 'triangle', gain: 0.35 });
      noise({ duration: 0.08, gain: 0.15, cutoff: 900 });
    },
    overcharge() {
      tone({ freq: 440, end: 1320, duration: 0.35, type: 'sawtooth', gain: 0.25 });
      tone({ freq: 880, end: 1760, duration: 0.35, type: 'sine', gain: 0.2, delay: 0.05 });
    },
    bloomHit() {
      tone({ freq: 180, end: 90, duration: 0.25, type: 'sine', gain: 0.45 });
    },
    hurt() {
      tone({ freq: 240, end: 120, duration: 0.16, type: 'square', gain: 0.25 });
    },
    over() {
      tone({ freq: 330, duration: 0.3, type: 'triangle', gain: 0.35 });
      tone({ freq: 262, duration: 0.3, type: 'triangle', gain: 0.35, delay: 0.28 });
      tone({ freq: 196, duration: 0.55, type: 'triangle', gain: 0.35, delay: 0.56 });
    },
    win() {
      tone({ freq: 523, duration: 0.14, type: 'triangle', gain: 0.4 });
      tone({ freq: 659, duration: 0.14, type: 'triangle', gain: 0.4, delay: 0.13 });
      tone({ freq: 784, duration: 0.14, type: 'triangle', gain: 0.4, delay: 0.26 });
      tone({ freq: 1047, duration: 0.4, type: 'triangle', gain: 0.4, delay: 0.39 });
    },
    click() {
      tone({ freq: 700, duration: 0.05, type: 'sine', gain: 0.25 });
    },
  };

  return {
    /** Create (or resume) the context. Call from a user gesture. */
    ensure,
    /** Play a named voice; unknown names are ignored. */
    play(name) {
      if (!ctx || muted) return;
      const voice = VOICES[name];
      if (voice) voice();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
