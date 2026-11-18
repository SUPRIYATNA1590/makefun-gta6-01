// Solmar Heat — audio.js: all sound is synthesized with WebAudio, no audio files.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null, musicTimer = null, musicStep = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq || 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master); src.start(t);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setEnabled(v) { enabled = v; if (!v && sirenGain) sirenGain.gain.value = 0; },
    playClick() { blip(660, 0.07, 'square', 0.08); },
    playPickup() { blip(880, 0.09, 'sine', 0.18); setTimeout(() => blip(1318, 0.12, 'sine', 0.18), 70); },
    playCash() { blip(988, 0.1, 'triangle', 0.2); setTimeout(() => blip(1318, 0.14, 'triangle', 0.2), 80); },
    playGunshot() { noiseBurst(0.14, 0.5, 2800); blip(180, 0.1, 'square', 0.25, 60); },
    playEnemyShot() { noiseBurst(0.1, 0.2, 1800); },
    playCrash() { noiseBurst(0.25, 0.45, 500); },
    playHorn() { blip(370, 0.25, 'square', 0.12); blip(466, 0.25, 'square', 0.1); },
    playMissionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    playBusted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.15), i * 160)); },
    startEngine() {
      if (!ensure() || engineOsc) return;
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    },
    setEngine(speed01, on) {
      if (!engineOsc) return;
      engineOsc.frequency.value = 50 + speed01 * 130;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, ctx.currentTime, 0.08);
    },
    stopEngine() {
      if (!engineOsc) return;
      try { engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null; engineGain = null; engineFilter = null;
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 750;
        sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.55;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
        sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); sirenLfo.start();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenLfo.stop(); } catch { /* already stopped */ }
        sirenOsc = null; sirenLfo = null; sirenGain = null;
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      // Lazy sunset groove: a two-bar bassline + hats, scheduled on a timer.
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
      musicTimer = setInterval(() => {
        if (!enabled) return;
        const f = bass[musicStep % bass.length];
        if (f) blip(f, 0.22, 'triangle', 0.11);
        if (musicStep % 2 === 0) noiseBurst(0.03, 0.03, 6000);
        musicStep += 1;
      }, 210);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}
