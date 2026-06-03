/* Studi audio engine — all sounds generated live with the Web Audio API.
   No audio files, nothing copyrighted: brown noise, rain, forest, synth pad,
   and a generative lo-fi chord loop are all synthesized in real time. */
(function () {
  let ctx = null;
  let master = null;
  let current = null;        // { name, nodes:[], stop:fn }
  let volume = 0.6;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ---- noise buffer helpers ----
  function noiseBuffer(seconds = 2) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function brownBuffer(seconds = 3) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }
  function loopSource(buffer) {
    const s = ctx.createBufferSource();
    s.buffer = buffer; s.loop = true; s.start();
    return s;
  }

  // ---- individual sounds ----
  function buildBrown() {
    const src = loopSource(brownBuffer());
    const g = ctx.createGain(); g.gain.value = 0.9;
    src.connect(g).connect(master);
    return { nodes: [src, g], stop: () => src.stop() };
  }

  function buildRain() {
    const src = loopSource(noiseBuffer());
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(hp).connect(lp).connect(g).connect(master);
    // slow shimmer
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.2;
    const lfoG = ctx.createGain(); lfoG.gain.value = 1500;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    return { nodes: [src, hp, lp, g, lfo, lfoG], stop: () => { src.stop(); lfo.stop(); } };
  }

  function buildForest() {
    // wind bed
    const src = loopSource(noiseBuffer());
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.value = 0.18;
    src.connect(lp).connect(g).connect(master);
    // random bird chirps
    let timer = null;
    function chirp() {
      const o = ctx.createOscillator(); o.type = "sine";
      const cg = ctx.createGain(); cg.gain.value = 0;
      const base = 1800 + Math.random() * 1800;
      o.frequency.setValueAtTime(base, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(base + 600, ctx.currentTime + 0.08);
      cg.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      cg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      o.connect(cg).connect(master); o.start(); o.stop(ctx.currentTime + 0.25);
      timer = setTimeout(chirp, 700 + Math.random() * 2600);
    }
    timer = setTimeout(chirp, 600);
    return { nodes: [src, lp, g], stop: () => { src.stop(); clearTimeout(timer); } };
  }

  function buildSynth() {
    // warm detuned pad on a slow chord
    const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 311.13]];
    const g = ctx.createGain(); g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 2);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
    g.connect(lp).connect(master);
    const oscs = [];
    let idx = 0, timer = null;
    function playChord() {
      oscs.forEach((o) => { try { o.stop(); } catch (e) {} });
      oscs.length = 0;
      chords[idx % chords.length].forEach((f) => {
        [0, 0.6].forEach((det) => {
          const o = ctx.createOscillator(); o.type = "sawtooth";
          o.frequency.value = f; o.detune.value = det * 8;
          const og = ctx.createGain(); og.gain.value = 0.16;
          o.connect(og).connect(g); o.start(); oscs.push(o);
        });
      });
      idx++; timer = setTimeout(playChord, 4000);
    }
    playChord();
    return { nodes: [g, lp], stop: () => { oscs.forEach((o) => { try { o.stop(); } catch (e) {} }); clearTimeout(timer); } };
  }

  function buildLofi() {
    // generative lo-fi: soft triangle chords + bass + vinyl crackle
    const out = ctx.createGain(); out.gain.value = 0.5; out.connect(master);
    // vinyl crackle
    const crackle = loopSource(noiseBuffer());
    const ch = ctx.createBiquadFilter(); ch.type = "highpass"; ch.frequency.value = 4000;
    const cg = ctx.createGain(); cg.gain.value = 0.04;
    crackle.connect(ch).connect(cg).connect(out);
    // ii–V–I–vi style loop in C
    const prog = [
      [261.63, 311.13, 392.00],   // Cm7-ish pad
      [349.23, 440.00, 523.25],   // F
      [392.00, 493.88, 587.33],   // G
      [329.63, 415.30, 493.88],   // Em-ish
    ];
    const bass = [130.81, 174.61, 196.00, 164.81];
    let step = 0, timer = null;
    const live = [];
    function voice(freq, dur, type, gain) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.05);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      o.connect(g).connect(lp).connect(out); o.start(); o.stop(ctx.currentTime + dur + 0.1);
      live.push(o);
    }
    function tick() {
      const chord = prog[step % prog.length];
      chord.forEach((f) => voice(f, 1.8, "triangle", 0.12));
      voice(bass[step % bass.length], 1.8, "sine", 0.18);
      step++; timer = setTimeout(tick, 1900);
    }
    tick();
    return { nodes: [out, crackle, ch, cg], stop: () => { crackle.stop(); clearTimeout(timer); live.forEach((o) => { try { o.stop(); } catch (e) {} }); } };
  }

  const builders = { brown: buildBrown, rain: buildRain, forest: buildForest, synth: buildSynth, lofi: buildLofi };

  function stop() {
    if (current) { try { current.stop(); } catch (e) {} current = null; }
  }
  function play(name) {
    ensure();
    if (current && current.name === name) { stop(); return null; }  // toggle off
    stop();
    const b = builders[name];
    if (!b) return null;
    const built = b();
    current = Object.assign({ name }, built);
    return name;
  }
  function setVolume(v) {
    volume = v;
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }
  function playing() { return current ? current.name : null; }
  // short chime for timer-complete (also works if no ambient playing)
  function chime() {
    ensure();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0;
      const t = now + i * 0.12;
      g.gain.linearRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(master || ctx.destination); o.start(t); o.stop(t + 0.7);
    });
  }

  window.StudiAudio = { play, stop, setVolume, playing, chime };
})();
