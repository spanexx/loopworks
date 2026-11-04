// WHY: sound is feedback tied to a line the drone ran or the way the run ended, never decoration.
//      Every cue is synthesised here, so a cue adds no request, no file and no dependency, and
//      the speaker button puts a quiet room one click away.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: palette A chosen by ear in GRILL-loopworks-sound entry 2; the recipes
//                          and the graph are the audition page's wood table, unchanged.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const doc = host.document;
  const KEY = 'loopworks.app.sound.v1';

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let on = true;
  // WHY: a stored choice beats the default, but only the two values this module writes count. A
  //      corrupt or blocked store leaves sound on rather than muting a learner by accident.
  try {
    on = host.localStorage.getItem(KEY) !== 'off';
  } catch (err) {
    on = true;
  }

  // WHY: the master gain and the compressor are the audition's, because that graph is the quiet
  //      level the learner approved by ear. A second attenuator would change the sound he chose.
  function ensure() {
    if (!on) return null;
    // WHY: a background tab must not make noise, so no context is created or resumed while hidden.
    if (doc && doc.hidden) return null;
    const Ctor = host.AudioContext || host.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
      ctx = new Ctor();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -15;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(comp).connect(ctx.destination);
      noiseBuffer = makeNoise();
    }
    // WHY: the context is born on the first cue that follows a gesture; if a browser still holds
    //      it suspended, this is the one place that asks again.
    if (ctx.state === 'suspended') {
      const resumed = ctx.resume();
      if (resumed && resumed.catch) resumed.catch(function () {});
    }
    return ctx;
  }

  function makeNoise() {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(t, spec) {
    const dur = spec.dur || 0.1;
    const attack = Math.min(spec.attack || 0.004, dur * 0.4);
    const osc = ctx.createOscillator();
    osc.type = spec.type || 'sine';
    osc.frequency.setValueAtTime(spec.f0, t);
    if (spec.f1 && spec.f1 !== spec.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.f1), t + dur);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(spec.peak || 0.1, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail = gain;
    if (spec.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = spec.filter;
      lp.Q.value = 0.8;
      gain.connect(lp);
      tail = lp;
    }
    tail.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function noise(t, spec) {
    const dur = spec.dur || 0.05;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type || 'bandpass';
    filter.frequency.value = spec.freq || 1200;
    filter.Q.value = spec.q || 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(spec.peak || 0.08, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const CUES = {
    move: function (t) {
      noise(t, { dur: 0.018, peak: 0.07, type: 'bandpass', freq: 1800, q: 1.4 });
      tone(t, { f0: 260, f1: 210, dur: 0.07, peak: 0.14, type: 'triangle', filter: 2400 });
    },
    grab: function (t) {
      noise(t, { dur: 0.03, peak: 0.08, type: 'lowpass', freq: 900, q: 0.8 });
      tone(t, { f0: 170, f1: 120, dur: 0.1, peak: 0.16, type: 'sine', filter: 1400 });
    },
    bump: function (t) {
      noise(t, { dur: 0.09, peak: 0.12, type: 'lowpass', freq: 420, q: 0.8 });
      tone(t, { f0: 100, f1: 52, dur: 0.22, peak: 0.24, type: 'sine' });
      tone(t, { f0: 60, f1: 48, dur: 0.26, peak: 0.1, type: 'triangle' });
    },
    code: function (t) {
      tone(t, { f0: 360, f1: 320, dur: 0.07, peak: 0.11, type: 'triangle', filter: 1600 });
      tone(t + 0.1, { f0: 250, f1: 230, dur: 0.11, peak: 0.11, type: 'triangle', filter: 1400 });
    },
    fuel: function (t) {
      tone(t, { f0: 330, f1: 100, dur: 0.55, peak: 0.14, type: 'triangle', filter: 1800 });
      noise(t, { dur: 0.3, peak: 0.03, type: 'lowpass', freq: 300, q: 0.7 });
    },
    steps: function (t) {
      tone(t, { f0: 280, f1: 90, dur: 0.45, peak: 0.14, type: 'triangle', filter: 1600 });
    },
    ended: function (t) {
      tone(t, { f0: 170, f1: 160, dur: 0.34, peak: 0.14, type: 'sine', filter: 1200 });
      tone(t + 0.02, { f0: 113, f1: 110, dur: 0.36, peak: 0.07, type: 'sine' });
    },
    solved: function (t) {
      tone(t, { f0: 392, dur: 0.16, peak: 0.14, type: 'triangle', filter: 2800 });
      tone(t + 0.13, { f0: 523, dur: 0.3, peak: 0.15, type: 'triangle', filter: 3000 });
      tone(t + 0.13, { f0: 1046, dur: 0.22, peak: 0.05, type: 'sine', filter: 3000 });
    }
  };

  function play(name) {
    const cue = CUES[name];
    if (!cue) return;
    const context = ensure();
    if (!context) return;
    cue(context.currentTime + 0.02);
  }

  function remember() {
    // WHY: a browser with storage blocked still plays; only the choice is forgotten.
    try {
      host.localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch (err) {
      /* the app runs either way */
    }
  }

  // WHY: the stylesheet chooses the icon from the root attribute and this only keeps the name and
  //      the tooltip honest for a screen reader, the same split the theme uses.
  function sync() {
    if (!doc) return;
    doc.documentElement.setAttribute('data-sound', on ? 'on' : 'off');
    const button = doc.querySelector('[data-action="toggle-sound"]');
    if (!button) return;
    const label = on ? 'Mute sound' : 'Turn sound on';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function toggle() {
    on = !on;
    remember();
    sync();
    // WHY: muting has to stop a cue already in the air, not wait for the next one. Turning sound
    //      on stays silent, because the speaker button is chrome and chrome makes no cue.
    if (!on && ctx && ctx.suspend) {
      const suspended = ctx.suspend();
      if (suspended && suspended.catch) suspended.catch(function () {});
    }
    return on;
  }

  if (doc) {
    doc.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (doc.hidden) {
        const suspended = ctx.suspend();
        if (suspended && suspended.catch) suspended.catch(function () {});
      } else if (on) {
        const resumed = ctx.resume();
        if (resumed && resumed.catch) resumed.catch(function () {});
      }
    });
    doc.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('[data-action="toggle-sound"]')) toggle();
    });
    doc.addEventListener('DOMContentLoaded', sync);
    sync();
  }

  host.LoopworksSound = { play: play, toggle: toggle, isOn: function () { return on; }, key: KEY };
})();
