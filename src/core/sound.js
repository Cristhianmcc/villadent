/* ───────────────────────── Sonido: todo sintetizado con Web Audio ───────────────────────── */
export const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  const ensure = () => {
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const tone = (type, f0, f1, dur, peak = .3, delay = 0) => {
    if (!ctx) return; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, .005, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  };
  const noise = (dur, freq, q, peak, delay = 0) => {
    if (!ctx) return; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, .003, peak, dur); s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  };
  const loop = (build) => {
    let nodes = null;
    return {
      start(){ if (!ensure() || nodes) return; nodes = build(); },
      set(fn){ if (nodes) fn(nodes, ctx.currentTime); },
      stop(){ if (!nodes) return; const n = nodes; nodes = null; n.g.gain.setTargetAtTime(0, ctx.currentTime, .03); setTimeout(() => n.srcs.forEach(s => { try { s.stop(); } catch(e){} }), 200); }
    };
  };
  const squish = loop(() => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start();
    return { srcs:[s], f, g };
  });
  const drill = loop(() => {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 150;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 302;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.07, ctx.currentTime, .05);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
    return { srcs:[o1, o2], o1, o2, f, g };
  });
  // cepillado: ruido agudo que sube y baja con el vaivén
  const brush = loop(() => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.1;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(hp); hp.connect(g); g.connect(master); s.start();
    return { srcs:[s], f, g };
  });
  return {
    unlock: ensure,
    get muted(){ return muted; },
    setMuted(m){ muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .85, ctx.currentTime, .02); },
    pop(){ tone('sine', 760, 110, .2, .5); noise(.05, 2600, 1, .35); },
    boing(){ tone('sine', 240, 560, .32, .16, .04); tone('triangle', 480, 900, .25, .05, .04); },
    clack(v){ const p = Math.min(.3, v * .05); if (p < .025) return; noise(.035, 3000 + Math.random() * 1500, 5, p); tone('sine', 1700 + Math.random() * 700, null, .05, p * .5); },
    drip(){ tone('sine', 900 + Math.random() * 600, 1700, .07, .06); },
    ding(){ tone('sine', 1318, null, .6, .2); tone('sine', 1975, null, .8, .12, .08); },
    snap(){ noise(.07, 800, 2, .28); tone('sine', 320, 90, .12, .22); },
    creak(){ noise(.09, 500 + Math.random() * 300, 6, .12); },
    chime(){ [2093, 1760, 1568, 1319, 1175, 1047, 1319, 1568].forEach((f, i) => tone('sine', f, null, .45, .08, i * .06)); },
    fanfare(){ [523, 659, 784, 1047].forEach((f, i) => { tone('triangle', f, null, .3, .16, i * .11); tone('sine', f * 2, null, .25, .04, i * .11); }); tone('triangle', 1047, null, .9, .16, .48); tone('triangle', 1319, null, .9, .1, .48); },
    whoosh(){ noise(.25, 700, .7, .16); },
    tick(){ tone('sine', 1568, 2093, .12, .09); },
    squish, drill, brush
  };
})();
