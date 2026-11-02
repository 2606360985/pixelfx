const KEYS = { Digit1: 'skill1', Digit2: 'skill2', Digit3: 'skill3', Numpad1: 'skill1', Numpad2: 'skill2', Numpad3: 'skill3', KeyJ: 'light', KeyK: 'heavy', Space: 'jump', KeyL: 'dodge', KeyE: 'interact', KeyQ: 'switch', KeyU: 'ultimate', KeyI: 'coop', Escape: 'pause', Enter: 'enter' };
const BUTTONS = { 2: 'light', 3: 'heavy', 0: 'jump', 1: 'dodge', 4: 'interact', 5: 'switch', 7: 'coop', 9: 'pause', 12: 'navup', 13: 'navdown', 14: 'navleft', 15: 'navright' };
const SKILLS = { 2: 'skill1', 3: 'skill2', 1: 'skill3', 0: 'ultimate' };
export class Input {
  constructor(onAction, onDisconnect) {
    this.keys = new Set(); this.edges = []; this.buttons = []; this.padIndex = null; this.device = 'keyboard'; this.onAction = onAction;
    window.addEventListener('keydown', e => {
      if (e.target.matches('input, select, button, a') && e.code !== 'Escape') return;
      if (KEYS[e.code] || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.device = 'keyboard'; this.keys.add(e.code); if (!e.repeat && KEYS[e.code]) this.onAction(KEYS[e.code]);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('gamepaddisconnected', () => { this.buttons = []; this.padIndex = null; onDisconnect(); });
  }
  clear() { this.keys.clear(); this.buttons = []; this.padMove = { x: 0, y: 0, held: false }; }
  poll() {
    const pads = navigator.getGamepads?.() ?? [], pad = [...pads].find(p => p?.connected && p.mapping === 'standard');
    this.padMove = { x: 0, y: 0, held: false };
    if (!pad) return;
    const axis = v => Math.abs(v) > .22 ? v : 0;
    const x = axis(pad.axes[0] ?? 0) + (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
    const y = axis(pad.axes[1] ?? 0) + (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
    if (x || y || pad.buttons.some(b => b.pressed)) this.device = 'gamepad';
    this.padMove = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), held: pad.buttons[4]?.pressed ?? false };
    for (const [i, action] of Object.entries(BUTTONS)) if (pad.buttons[i]?.pressed && !this.buttons[i]) this.onAction(pad.buttons[6]?.pressed && SKILLS[i] ? SKILLS[i] : action);
    this.buttons = pad.buttons.map(b => b.pressed); this.padIndex = pad.index;
  }
  movement() {
    if (this.device === 'gamepad') return this.padMove ?? { x: 0, y: 0, held: false };
    const k = this.keys;
    return { x: Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')), y: Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp')), held: k.has('KeyE') };
  }
}
