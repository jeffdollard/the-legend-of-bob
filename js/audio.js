// WebAudio chiptune: synthesized sound effects + a step-sequenced background track.
// No audio files. Everything is a no-op until the first key press creates the AudioContext.
'use strict';

const AudioSys = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null, pulse: null,
  muted: false,
  track: null, step: 0, nextTime: 0, timer: null,

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.5; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.2; this.musicBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 25% pulse wave, the classic NES lead timbre
    const N = 32, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    this.pulse = ctx.createPeriodicWave(real, imag);
    return true;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  },

  tone(freq, dur, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = (o.when || ctx.currentTime);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    if (o.type === 'pulse') osc.setPeriodicWave(this.pulse); else osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + Math.max(0.006, dur * (o.sustain ?? 0.6)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  noise(dur, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = (o.when || ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    const g = ctx.createGain(), vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },

  arp(notes, step, o = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    notes.forEach((m, i) => this.tone(midiFreq(m), step * 1.6, { ...o, when: t0 + i * step }));
  },

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone(280, 0.14, { type: 'pulse', slide: 620, vol: 0.14 }); break;
      case 'dig': this.noise(0.06, { freq: 900, vol: 0.22 }); this.tone(110, 0.05, { type: 'triangle', vol: 0.25 }); break;
      case 'digStone': this.noise(0.05, { filter: 'highpass', freq: 2500, vol: 0.18 }); this.tone(520, 0.04, { vol: 0.06 }); break;
      case 'place': this.tone(200, 0.09, { type: 'triangle', slide: 90, vol: 0.35 }); this.noise(0.04, { freq: 600, vol: 0.12 }); break;
      case 'select': this.tone(880, 0.04, { type: 'pulse', vol: 0.08 }); break;
      case 'deny': this.tone(110, 0.12, { vol: 0.1 }); break;
      case 'punch': this.noise(0.07, { filter: 'bandpass', freq: 1400, vol: 0.25 }); break;
      case 'swing': this.noise(0.12, { filter: 'bandpass', freq: 3000, freqEnd: 800, vol: 0.22 }); break;
      case 'hit': this.tone(260, 0.1, { slide: 70, vol: 0.18 }); this.noise(0.08, { freq: 2000, vol: 0.2 }); break;
      case 'clink': this.tone(1500, 0.06, { type: 'triangle', vol: 0.2 }); this.tone(2200, 0.05, { type: 'triangle', vol: 0.1 }); break;
      case 'botDie': this.tone(700, 0.25, { slide: 80, vol: 0.14 }); this.noise(0.25, { freq: 1500, freqEnd: 200, vol: 0.25 }); break;
      case 'hurt': this.tone(420, 0.25, { type: 'sawtooth', slide: 120, vol: 0.14 }); break;
      case 'armorBreak': this.noise(0.3, { filter: 'highpass', freq: 3000, vol: 0.25 }); this.arp([72, 67, 60], 0.06, { vol: 0.1 }); break;
      case 'chest': this.arp([72, 76, 79, 84], 0.07, { type: 'pulse', vol: 0.12 }); break;
      case 'heal': this.arp([79, 84, 88], 0.06, { type: 'triangle', vol: 0.3 }); break;
      case 'rescue': this.arp([67, 72, 76, 79, 84, 88], 0.07, { type: 'pulse', vol: 0.12 }); break;
      case 'seal':
        this.noise(1.6, { freq: 500, freqEnd: 60, vol: 0.45 });
        this.tone(55, 1.4, { type: 'triangle', slide: 30, vol: 0.4 }); break;
      case 'bossWake': this.arp([40, 43, 46, 49], 0.12, { type: 'sawtooth', vol: 0.12 }); break;
      case 'bossHit': this.tone(160, 0.25, { slide: 45, vol: 0.25 }); this.noise(0.15, { freq: 2500, vol: 0.25 }); break;
      case 'throw': this.tone(180, 0.12, { type: 'sawtooth', slide: 420, vol: 0.1 }); break;
      case 'explode': this.noise(0.5, { freq: 900, freqEnd: 60, vol: 0.45 }); this.tone(80, 0.3, { type: 'triangle', slide: 30, vol: 0.4 }); break;
      case 'land': this.noise(0.12, { freq: 300, vol: 0.35 }); break;
      case 'death': this.arp([72, 68, 65, 61, 58, 53], 0.11, { type: 'pulse', vol: 0.13 }); break;
      case 'win': this.arp([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.11, { type: 'pulse', vol: 0.13 }); break;
    }
  },

  // ---------------- Music ----------------
  playMusic(name) {
    if (!this.ctx || this.track === name) return;
    this.stopMusic();
    this.track = name; this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this._schedule(), 25);
  },
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.track = null;
  },
  _schedule() {
    const tr = TRACKS[this.track]; if (!tr) return;
    const sd = 60 / tr.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const s = this.step, t = this.nextTime;
      const L = tr.lead[s], B = tr.bass[s], D = tr.drums[s];
      if (L) this.tone(midiFreq(L.m), L.len * sd * 0.92, { type: 'pulse', vol: 0.13, when: t, bus: this.musicBus, sustain: 0.7 });
      if (B) this.tone(midiFreq(B.m), B.len * sd * 0.85, { type: 'triangle', vol: 0.35, when: t, bus: this.musicBus, sustain: 0.8 });
      if (D === 'k') this.tone(140, 0.11, { type: 'sine', slide: 40, vol: 0.6, when: t, bus: this.musicBus, sustain: 0.1 });
      if (D === 's') this.noise(0.12, { filter: 'highpass', freq: 1200, vol: 0.25, when: t, bus: this.musicBus });
      if (D === 'h') this.noise(0.03, { filter: 'highpass', freq: 7000, vol: 0.12, when: t, bus: this.musicBus });
      this.nextTime += sd;
      this.step = (s + 1) % tr.len;
    }
  },
};

function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
}

// Parse "A4 - C5 . ..." : note starts, '-' holds the previous note, '.' is a rest.
function parseLine(str) {
  const toks = str.trim().split(/\s+/);
  const out = new Array(toks.length).fill(null);
  toks.forEach((tk, i) => {
    if (tk === '-' || tk === '.') return;
    let len = 1;
    while (toks[i + len] === '-') len++;
    out[i] = { m: noteMidi(tk), len };
  });
  return out;
}

function bassLine(roots, pattern) {
  const out = [];
  for (const r of roots) {
    const m = noteMidi(r);
    for (const p of pattern) out.push(p === null ? null : { m: m + p, len: 2 });
  }
  return out;
}

function makeTrack(bpm, leadBars, roots, bassPattern, drumBar) {
  const lead = parseLine(leadBars.join(' '));
  const bass = bassLine(roots, bassPattern);
  const drums = drumBar.repeat(roots.length).split('');
  return { bpm, lead, bass, drums, len: lead.length };
}

const TRACKS = {
  main: makeTrack(124, [
    'A4 - C5 - E5 - D5 C5 - - A4 - B4 - C5 -',
    'A4 - - - F4 - A4 - C5 - - D5 C5 - A4 -',
    'G4 - C5 - E5 - G5 - - - E5 - D5 - C5 -',
    'D5 - - - B4 - - - G4 - A4 - B4 - D5 -',
    'E5 - - E5 D5 - C5 - A4 - - - C5 - E5 -',
    'F5 - - - E5 - D5 - C5 - - - A4 - C5 -',
    'B4 - - - D5 - - - G5 - - - F5 - D5 -',
    'B4 - C5 - D5 - - - . . . . G4 - - -',
  ], ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'G2', 'G2'],
  [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, null, 7, null],
  'k.h.s.h.kkh.s.hh'),

  boss: makeTrack(150, [
    'E5 . E5 . G5 . E5 . B5 - A5 - G5 - F#5 -',
    'E5 . E5 . G5 . E5 . C6 - B5 - G5 - E5 -',
    'D5 . D5 . F#5 . D5 . A5 - G5 - F#5 - D5 -',
    'D#5 - F#5 - B5 - - - A5 - F#5 - D#5 - B4 -',
  ], ['E2', 'C2', 'D2', 'B1'],
  [0, null, 0, null, 12, null, 0, null, 0, null, 0, null, 12, null, 10, null],
  'k.hks.h.k.hks.hh'),
};
