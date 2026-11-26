export class Audio {
  constructor() {
    this.volume = 0.45;
    this.muted = false;
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx && typeof window !== "undefined") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    this.ctx?.resume().catch(() => {});
  }

  tone(startFreq, endFreq, duration, wave = "triangle", gain = 0.08) {
    if (this.muted || this.volume <= 0 || !this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(Math.max(20, startFreq), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(this.volume * gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + duration);
  }

  play(type, extra = {}) {
    if (type === "horn") {
      if (extra.kind === "bell") {
        this.tone(980, 1280, 0.09, "sine", 0.1);
        setTimeout(() => this.tone(1180, 1480, 0.11, "sine", 0.1), 90);
      } else if (extra.kind === "siren") {
        this.tone(620, 880, 0.22, "sawtooth", 0.08);
        setTimeout(() => this.tone(880, 560, 0.22, "sawtooth", 0.08), 220);
      } else if (extra.kind === "muscle") {
        this.tone(195, 175, 0.26, "sawtooth", 0.09);
      } else {
        this.tone(330, 315, 0.22, "square", 0.07);
      }
      return;
    }
    const presets = {
      cast: [320, 640, 0.14, "triangle", 0.07],
      hit: [140, 48, 0.11, "triangle", 0.09],
      swing: [220, 85, 0.08, "triangle", 0.06],
      explosion: [95, 24, 0.36, "sawtooth", 0.14],
      pickup: [520, 980, 0.15, "sine", 0.08],
      switch: [420, 740, 0.12, "sine", 0.07],
      enterVehicle: [140, 260, 0.15, "sawtooth", 0.06],
      exitVehicle: [230, 110, 0.12, "triangle", 0.06],
      wanted: [480, 720, 0.25, "square", 0.08],
      talk: [420, 520, 0.06, "sine", 0.05],
      hydrant: [240, 820, 0.28, "sawtooth", 0.09],
      nitro: [180, 540, 0.18, "sawtooth", 0.06],
      ramp: [220, 660, 0.24, "triangle", 0.09],
      electric: [760, 290, 0.2, "square", 0.09],
      ice: [980, 1480, 0.16, "sine", 0.07],
      propBreak: [190, 62, 0.14, "square", 0.08],
      trendWin: [520, 1040, 0.3, "triangle", 0.1],
      skid: [420, 360, 0.1, "sawtooth", 0.04],
    };
    const p = presets[type];
    if (p) this.tone(...p);
  }
}
