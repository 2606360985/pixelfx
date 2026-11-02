export class Audio {
  constructor() { this.volume = .5; this.ctx = null; }
  unlock() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume().catch(() => {}); }
  play(type) {
    if (!this.ctx || this.ctx.state !== 'running' || this.volume <= 0) return;
    const tones = { hit: [130, 42, .12, 'triangle'], block: [530, 180, .09, 'square'], swing: [210, 70, .07, 'triangle'], throw: [280, 95, .15, 'triangle'], juice: [330, 45, .2, 'sawtooth'], breakprop: [160, 35, .16, 'sawtooth'], crack: [290, 80, .08, 'square'], pickup: [500, 950, .18, 'sine'], switch: [430, 720, .1, 'sine'], ultimate: [120, 480, .4, 'sawtooth'], cinema: [220, 660, .5, 'triangle'], slam: [80, 22, .3, 'triangle'], revive: [350, 800, .3, 'sine'], victory: [440, 880, .6, 'triangle'], down: [240, 50, .4, 'triangle'] };
    const p = tones[type]; if (!p) return;
    const [start, end, duration, wave] = p, t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(start, t); o.frequency.exponentialRampToValueAtTime(end, t + duration);
    g.gain.setValueAtTime(this.volume * .08, t); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + duration);
  }
}
