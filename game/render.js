import { posed, skeleton } from '../src/core/rig.js';
import { poseAt, createFrame, createFx, composite, hex, scale, Rng } from '../src/core/index.js';
import * as blunt from '../src/fx/impacts/blunt-hit.js';
import * as crit from '../src/fx/impacts/crit-hit.js';
import * as slam from '../src/fx/impacts/ground-slam.js';
import * as landing from '../src/fx/impacts/heavy-landing.js';
import { act as poundAct } from '../src/fx/moves/ground-pound.js';
import { act as stompAct } from '../src/fx/moves/earth-stomp.js';
import { WIDTH, HEIGHT, ZONES, MOVES } from './data.js';
import { clamp } from './world.js';

import * as uppercut from '../src/fx/melee/uppercut.js';
import * as double from '../src/fx/melee/double-slash.js';
import * as spin from '../src/fx/melee/spin-slash.js';
import * as cleave from '../src/fx/melee/heavy-cleave.js';
import { dressSprite } from './art.js';
import { Scenery } from './scenery.js';
const EFFECTS = { uppercut, double, spin, cleave, slam, landing };

const INK = '#101b29', WHITE = '#fff1d5';
const idle = { crouch: 2, fx: 9, fy: -23, bx: 7, by: -24, ffx: 5, fbx: -5 };
const windup = { ...idle, crouch: 4, lean: -4, fx: -9, fy: -27, bx: 10, by: -23, ffx: 8, fbx: -8 };
const strike = { ...idle, lean: 6, fx: 21, fy: -25, bx: -4, by: -22, ffx: 10, fbx: -6 };
const leg = { ...strike, lean: -4, fx: -3, fy: -28, ffx: 24, ffy: -23, fbx: -3, fby: -1 };
const raised = { ...idle, crouch: 0, fx: -4, fy: -42, bx: 7, by: -40, ffx: 8, fbx: -7 };
const hurt = { ...idle, lean: -9, crouch: 6, fx: 2, fy: -14, bx: 5, by: -15, hx: -1 };
const adaptedTracks = new Map();
function adaptedPose(id, move, time) {
  if (!adaptedTracks.has(id)) {
    const source = id === 'quake' ? stompAct.poses : poundAct.poses, impact = id === 'quake' ? .06 : .62;
    const from = source[0][0], end = source.at(-1)[0];
    adaptedTracks.set(id, source.map(([t, pose, how]) => {
      const at = t <= impact ? (t - from) / (impact - from) * move.startup : move.startup + (t - impact) / (end - impact) * (move.active + move.recovery);
      // World movement and airborne height belong to the simulation, not the preview act.
      const { x, y, weapon, ...local } = pose;
      return [at, local, how];
    }));
  }
  return poseAt(adaptedTracks.get(id), time);
}

export function actorPose(a, time, cinema) {
  if (a.hp <= 0) return { ...hurt, crouch: 15, lean: -13, ffx: 12, fbx: -12, fy: -5, by: -7 };
  if (cinema) {
    const t = cinema.t;
    return t < .5 ? raised : a.style === 'power' ? { ...strike, crouch: 10, fy: -7, by: -10 } : a.style === 'fan' ? { ...strike, fx: 26, fy: -31, bx: -10, by: -26 } : leg;
  }
  if (a.grabbedBy || a.stun > 0) return { ...hurt, lean: a.z > 5 ? -12 : -8, ffy: a.z > 0 ? -5 : -2 };
  if (a.grab) return { ...idle, lean: 4, fx: 15, fy: -25, bx: 13, by: -23, crouch: 4 };
  if (a.action) {
    const { id, move: m, t } = a.action;
    if (id === 'quake' || id === 'airslam') return adaptedPose(id, m, t);
    let hit = /kick|launch|flurry/.test(id) || ['kick','wheel'].includes(m.pose) ? leg : strike;
    if (m.pose === 'fan') hit = { ...strike, fx: 24, fy: -32, bx: -8, by: -23, turn: .2 };
    if (m.pose === 'spin') hit = { ...leg, turn: Math.floor(t * 12) % 4 * .8, fx: 17, fy: -27, bx: -14, by: -27, ffy: -17 };
    if (m.pose === 'wheel') hit = { ...leg, crouch: 1, ffy: -30 + Math.floor(t*16)%2*10, lean: -5 };
    if (m.pose === 'slide') hit = { ...strike, crouch: 12, ffx: 23, ffy: -4, fbx: -13, lean: 8 };
    if (m.pose === 'shoulder') hit = { ...strike, lean: 12, crouch: 6, fx: 9, fy: -23 };
    if (m.pose === 'slam') hit = { ...strike, crouch: 10, fy: -5, by: -9 };
    if (id === 'flurry' && Math.floor(t * 18) % 2) hit = { ...leg, ffx: 19, ffy: -32, lean: -7 };
    if (/slam|quake/.test(id)) hit = { ...strike, crouch: 9, fy: -5, by: -8 };
    if (/shoulder|rushbody|charge/.test(id)) hit = { ...strike, lean: 11, crouch: 7, fx: 10, fy: -24 };
    const start = /slam|quake/.test(id) ? raised : windup;
    return poseAt([[0, idle], [m.startup * .65, start], [m.startup, hit, 'snap'], [m.startup + m.active, hit], [m.duration, idle]], Math.floor(t * 12) / 12);
  }
  if (a.dodge > 0) return { ...idle, crouch: 11, lean: 10, fx: -2, fy: -18, ffx: 11, fbx: -10 };
  if (a.z > 0) return { ...idle, crouch: 3, ffx: 8, ffy: -5, fbx: -6, fby: -8 };
  if (a.carried) return { ...idle, fx: 13, fy: -24, bx: 9, by: -25, crouch: 3 };
  if (Math.abs(a.input.x) + Math.abs(a.input.y) > .1) {
    const swing = Math.sin(Math.floor(time * 12) / 12 * 12);
    return { ...idle, ffx: swing * 9, fbx: -swing * 9, ffy: -Math.max(0, -swing) * 4, fby: -Math.max(0, swing) * 4, fx: 5 - swing * 5, bx: 6 + swing * 5, crouch: 2 + Math.abs(swing), lean: 3 };
  }
  if (a.style === 'fan') return { ...idle, fx: 12, fy: -29, bx: -6, by: -22, ffx: 4, fbx: -6, lean: -1, crouch: 1 + Math.floor(time*2)%2 };
  if (a.style === 'roller') return { ...idle, fx: 7, fy: -23, bx: -6, by: -25, ffx: 8, fbx: -7, crouch: 4 + Math.floor(time*3)%2, lean: 3 };
  return { ...idle, crouch: 2 + (Math.floor(time * 3) % 2) };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); canvas.width = WIDTH; canvas.height = HEIGHT;
    this.scenery = new Scenery();
    this.camera = 0; this.fx = []; this.bits = []; this.labels = []; this.trails = []; this.lastTrail = new Map(); this.flash = 0; this.banner = ''; this.bannerTime = 0;
    this.frame = createFrame(WIDTH, HEIGHT); this.img = new ImageData(WIDTH, HEIGHT);
    this.fxCanvas = document.createElement('canvas'); this.fxCanvas.width = WIDTH; this.fxCanvas.height = HEIGHT; this.fxCtx = this.fxCanvas.getContext('2d');
    this.cache = new WeakMap(); this.elapsed = 0; this.settings = { shake: 1, flash: .65 }; this.fps = 60; this.visualRng = new Rng(17);
  }
  reset() { this.fx = []; this.bits = []; this.labels = []; this.trails = []; this.lastTrail.clear(); this.camera = 0; this.flash = 0; this.banner = ''; this.bannerTime = 0; }
  rect(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); }
  text(s, x, y, color = WHITE, size = 9, align = 'left') { const c = this.ctx; c.font = `bold ${size}px "Microsoft YaHei", sans-serif`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = '#0b141f'; c.fillText(s, Math.round(x) + 1, Math.round(y) + 1); c.fillStyle = color; c.fillText(s, Math.round(x), Math.round(y)); }
  ellipse(x, y, rx, ry, color) { const c = this.ctx; c.fillStyle = color; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, 7); c.fill(); }
  handle(events, world) {
    for (const e of events) {
      if (e.type === 'banner') { this.banner = e.text; this.bannerTime = 2.4; }
      if (e.type === 'message') this.labels.push({ text: e.text, x: null, y: 146, life: 1.8, max: 1.8, color: '#ffe1a0' });
      if (e.type === 'hit' || e.type === 'block' || e.type === 'break' || e.type === 'bounce') {
        this.addFx(e.type === 'break' || e.heavy ? blunt : crit, e.x, e.y + 20, world, e.heavy ? 1 : .45);
        if (e.damage) this.labels.push({ text: String(e.damage), x: e.x, y: e.y - 8, life: .65, max: .65, color: e.heavy ? '#ffc16b' : '#e1fff2' });
        this.particles(e.x, e.y, 5, e.heavy ? '#ffc16b' : '#c5ffff', world);
      }
      if (e.type === 'relay') this.labels.push({ text: '双响接力！', x: e.x, y: e.y - 8, life: .85, max: .85, color: '#79ffda' });
      if (['slam', 'bossfinish'].includes(e.type)) { this.addFx(slam, e.x, e.y, world, 1); this.flash = .12; }
      if (['juice', 'breakprop', 'crack'].includes(e.type)) this.particles(e.x, e.y, e.type === 'juice' ? 25 : 14, e.type === 'juice' ? '#f37672' : '#c89a62', world);
      if (e.type === 'ultimate') { this.flash = .1; this.banner = MOVES[e.move].name; this.bannerTime = .85; }
      if (e.type === 'active' || e.type === 'pulse') {
        const m = MOVES[e.move];
        if (m.fx) this.addFx(EFFECTS[m.fx], e.x, e.y, world, .48, { flip: e.actor.face < 0, palette: ['#142d35',e.actor.dark,'#65525c',e.actor.color,'#f5c997','#ffecd0','#fff6df'], reach: m.reach, height: 32 });
        else if (['airslam','bossslam'].includes(e.move)) this.addFx(e.move === 'airslam' ? landing : slam, e.x, e.y, world, .55);
      }
      if (e.type === 'bossfinish') { this.banner = '招牌已落 · 这一街，双响'; this.bannerTime = 2; }
      if (e.type === 'cinema') { this.banner = e.kind === 'finish' ? '双响 · 终结' : '双响 · 破阵'; this.bannerTime = 1.1; }
      if (e.type === 'pickup' || e.type === 'revive') this.labels.push({ text: e.type === 'revive' ? '重新上阵' : e.kind === 'energy' ? '气槽充满' : e.kind === 'heal' ? '+36 生命' : '道具入手', x: e.actor.x, y: e.actor.y - 46, life: 1, max: 1, color: '#a2e5b0' });
    }
  }
  addFx(mod, x, y, world, light = 1, options = {}) {
    const impact = mod === blunt || mod === crit;
    // A crowd hit must not create six expensive flashes for every flurry pulse.
    // Reserve the budget for the character's primary skill silhouette.
    if (impact && this.fx.filter(f => f.impact).length >= 6) return;
    if (this.fx.length >= 18) { const low = this.fx.findIndex(f => f.impact); this.fx.splice(low < 0 ? 0 : low, 1); }
    this.fx.push({ x, y, impact, inst: createFx(mod, { seed: world.nextId + Math.floor(world.time * 100), height: 20, light, reach: 60, ...options }), t: 0 });
  }
  particles(x, y, n, color, world) {
    for (let i = 0; i < n && this.bits.length < 180; i++) { const a = this.visualRng.range(0, 6.28), s = this.visualRng.range(20, 95); this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: .3 + i / n * .4, color }); }
  }
  tick(dt) {
    this.elapsed += dt; this.bannerTime = Math.max(0, this.bannerTime - dt); this.flash = Math.max(0, this.flash - dt);
    this.fx.forEach(f => { f.inst.update(dt); f.t += dt; }); this.fx = this.fx.filter(f => !f.inst.done() && (!f.impact || f.t < .38));
    this.bits.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt; }); this.bits = this.bits.filter(p => p.life > 0);
    this.labels.forEach(l => { l.life -= dt; if (l.x !== null) l.y -= 12 * dt; }); this.labels = this.labels.filter(l => l.life > 0);
    this.trails.forEach(t => t.life -= dt); this.trails = this.trails.filter(t => t.life > 0);
  }
  background(world) {
    this.scenery.draw(this.ctx, this.camera, this.elapsed);
    const edge = ZONES[world.zone].end - this.camera;
    if (!world.cleared && edge < 490) { this.rect(edge-5,151,5,110,'#243d32'); for(let y=156;y<260;y+=14)this.rect(edge-5,y,5,6,'#bd9a62'); }
  }
  actorSprite(a, pose) {
    const rig = posed(pose, a.profile); let entry = this.cache.get(rig); const key = a.id || a.kind || a.name;
    if (!entry) { entry = new Map(); this.cache.set(rig, entry); }
    if (entry.has(key)) return entry.get(key);
    const pad = 12, w = rig.x1 - rig.x0 + pad*2, h = rig.y1 - rig.y0 + pad*2, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const context = cv.getContext('2d'), img = context.createImageData(w, h), pixels = new Uint32Array(img.data.buffer);
    const shirt = hex(a.color), pants = hex(a.dark), skin = hex(a.hero ? '#edbf95' : '#d9aa89');
    for (let i = 0; i < rig.n; i++) {
      const x = rig.xs[i] - rig.x0 + pad, y = rig.ys[i] - rig.y0 + pad, part = rig.part[i];
      const c = rig.color[i], luminance = ((c & 255) + (c >>> 8 & 255) + (c >>> 16 & 255)) / 3 / 230;
      let base = part >= 15 ? pants : part === 5 || part === 6 || part === 4 || part === 10 || part === 14 || (a.style === 'power' && part >= 7 && part <= 13) ? skin : shirt;
      if (part === 5 && rig.ys[i] < -34) base = hex('#24262c');
      pixels[y * w + x] = rig.ink[i] ? hex(INK) : scale(base, Math.max(.4, luminance));
    }
    context.putImageData(img, 0, 0);
    if (a.hero) { context.save(); context.translate(-rig.x0+pad,-rig.y0+pad); dressSprite(context,a,skeleton(pose,a.profile).joints); context.restore(); }
    const result = { canvas: cv, x: rig.x0 - pad, y: rig.y0 - pad }; entry.set(key, result); return result;
  }
  actor(a, world) {
    if (!a.hero && a.hp <= 0 && Math.floor(a.deathAge * 14) % 2) return;
    const x = Math.round(a.x - this.camera), y = Math.round(a.y - a.z), c = this.ctx;
    this.ellipse(x, a.y + 1, a.boss ? 16 : 11, 3, '#1d2b32');
    if (a.hero && world.player === a) { this.ellipse(x, a.y + 1, 13, 4, '#55b7ad'); this.ellipse(x, a.y + 1, 9, 2, '#304749'); }
    const pose = actorPose(a, world.time, a.hero ? world.cinematic : null); pose.y = -a.z;
    const sprite = this.actorSprite(a, pose);
    if (a.hero && a.hp > 0 && (a.dodge > 0 || a.action?.move.travel || a.action?.move.pulses) && this.elapsed - (this.lastTrail.get(a.uid) ?? -1) > .06) {
      this.trails.push({ x: a.x, y: a.y - a.z, face: a.face, sprite, life: .22 }); this.lastTrail.set(a.uid, this.elapsed);
      if (this.trails.length > 12) this.trails.shift();
    }
    c.save(); c.translate(x, y); c.scale(a.face, 1);
    if (a.invuln > 0 && Math.floor(world.time * 15) % 2) c.globalAlpha = .45;
    c.drawImage(sprite.canvas, sprite.x, sprite.y);
    if (a.action && !a.action.move.fx && a.action.t >= a.action.move.startup && a.action.t < a.action.move.startup + a.action.move.active) {
      c.globalAlpha = .75; c.strokeStyle = a.hero ? a.color : '#ff9f85'; c.lineWidth = a.action.move.heavy ? 3 : 1;
      c.beginPath(); c.arc(10, -22, a.action.move.reach * .55, -.8, 1); c.stroke();
      c.globalAlpha = .35; c.beginPath(); c.arc(8, -22, a.action.move.reach * .68, -.9, .8); c.stroke();
    }
    if (a.boss) { c.fillStyle = '#9b7758'; c.fillRect(12, -37, 5, 32); c.fillStyle = '#ddc68a'; c.fillRect(9, -40, 14, 22); c.fillStyle = '#5f4239'; c.fillRect(13, -37, 5, 15); }
    c.restore();
    if (a.carried) this.drawProp(a.carried, world);
    if (a.hero) {
      this.text(a.hp <= 0 ? '倒地 · 靠近长按救援' : world.player === a ? '▼ PLAYER' : 'AI · ' + a.aiState, x, y + sprite.y + 6, world.player === a ? '#92fff0' : '#ffd394', 6, 'center');
      if (a.grab) this.text('J 追加 / K 投掷', x, y - 50, '#fff0bc', 7, 'center');
      if (a.revive > 0) { this.rect(x - 16, y - 50, 32, 4, INK); this.rect(x - 15, y - 49, a.revive / 2 * 30, 2, '#a6f2b2'); }
    } else if (a.hp > 0 && !a.boss) {
      this.rect(x - 13, y + sprite.y + 5, 26, 3, '#18232d'); this.rect(x - 13, y + sprite.y + 5, a.hp / a.maxHp * 26, 2, a.stun > 0 ? '#ffdb91' : '#ca7e7e');
      if (a.hp <= a.maxHp * .2 && a.stun > 0) this.text('终结 I', x, y + sprite.y + 1, '#ffe1a0', 7, 'center');
    }
    if (a.action && !a.hero && a.action.t < a.action.move.startup) {
      const t = a.action.t / a.action.move.startup, m = a.action.move;
      c.globalAlpha = .2 + t * .35; this.ellipse(x + (m.radial ? 0 : a.face * m.reach / 2), a.y + 2, m.radial ? m.reach : m.reach / 2, m.depth * .55, '#f99472'); c.globalAlpha = 1;
      this.text('!', x, y + sprite.y, '#ffe4ae', 12, 'center');
    }
  }
  drawProp(p) {
    const x = Math.round(p.x - this.camera), y = Math.round(p.y - p.z), r = this.rect.bind(this);
    if (p.type === 'melon') { this.ellipse(x, y - 6, 8, 7, '#304d37'); this.ellipse(x - 1, y - 7, 6, 5, '#82a75c'); r(x - 4, y - 12, 2, 10, '#486c42'); r(x + 2, y - 12, 2, 10, '#486c42'); if (p.state) { r(x - 1, y - 12, 2, 11, '#ef9280'); r(x + 1, y - 7, 2, 5, '#de6a66'); } }
    if (p.type === 'chair') { r(x - 6, y - 17, 3, 17, '#bdac85'); r(x + 5, y - 17, 3, 17, '#928366'); r(x - 7, y - 13, 16, 4, '#d1bd8b'); r(x - 5, y - 22, 12, 5, '#ab9d7b'); }
    if (p.type === 'crate') { r(x - 13, y - 21, 27, 22, '#5a4536'); r(x - 12, y - 20, 25, 18, '#a58354'); for (let k = 0; k < 3; k++) r(x - 10, y - 17 + k * 6, 21, 2, '#705438'); r(x - 9, y - 20, 2, 20, '#cab077'); r(x + 8, y - 20, 2, 20, '#cab077'); }
    if (p.type === 'cart') { this.ellipse(x - 12, y, 4, 4, '#13222b'); this.ellipse(x + 12, y, 4, 4, '#13222b'); r(x - 19, y - 12, 39, 8, '#73978f'); r(x - 21, y - 15, 42, 4, '#aac0a1'); r(x - 22, y - 29, 3, 18, '#9aa995'); r(x - 27, y - 30, 8, 3, '#566f70'); }
    if (p.type === 'peel') { r(x - 7, y - 2, 15, 3, '#aac371'); r(x - 5, y - 4, 4, 3, '#d8d393'); r(x + 1, y - 3, 4, 2, '#eeac80'); }
  }
  drawFx(layer) {
    if (!this.fx.length) return;
    const f = this.frame; f.color.fill(0); f.light.fill(0);
    for (const fx of this.fx) { fx.inst.options.x = fx.x - this.camera; fx.inst.options.y = fx.y; fx.inst.draw(f, layer); }
    composite(f, this.img.data); this.fxCtx.putImageData(this.img, 0, 0); this.ctx.drawImage(this.fxCanvas, 0, 0);
  }
  render(world, { debug = false, fps = 60, title = false } = {}) {
    if (title) { this.camera = 340; this.background(world); this.scenery.foreground(this.ctx,this.camera); return; }
    const target = clamp(world.player.x - 185, 0, 1800 - WIDTH); this.camera += (target - this.camera) * .12;
    const c = this.ctx; c.imageSmoothingEnabled = false; c.save();
    const shake = world.shake * this.settings.shake;
    if (shake > .2) c.translate(Math.round(Math.sin(this.elapsed * 93) * shake), Math.round(Math.cos(this.elapsed * 67) * shake * .6));
    this.background(world);
    this.drawFx('back');
    for (const t of this.trails) { c.save(); c.globalAlpha = t.life * 1.2; c.translate(Math.round(t.x - this.camera), Math.round(t.y)); c.scale(t.face, 1); c.drawImage(t.sprite.canvas, t.sprite.x, t.sprite.y); c.restore(); }
    for (const p of world.pickups) { const x = p.x - this.camera, y = p.y - 8 + Math.sin(this.elapsed * 4) * 2; this.ellipse(x, p.y, 7, 2, '#253239'); this.rect(x - 5, y - 8, 10, 10, p.type === 'energy' ? '#d5b55f' : '#7aaf88'); this.text(p.type === 'energy' ? '气' : '+', x, y, '#182d36', 8, 'center'); }
    const drawables = [...world.props.filter(p => !p.holder && p.hp > 0).map(p => ({ y: p.y, draw: () => this.drawProp(p) })), ...world.heroes.map(a => ({ y: a.y, draw: () => this.actor(a, world) })), ...world.enemies.map(a => ({ y: a.y, draw: () => this.actor(a, world) }))];
    drawables.sort((a, b) => a.y - b.y).forEach(o => o.draw());
    this.drawFx('front'); this.scenery.foreground(c,this.camera); this.bits.forEach(p => this.rect(p.x - this.camera, p.y, 2, 2, p.color));
    c.restore();
    for (const l of this.labels) { c.globalAlpha = Math.min(1, l.life * 4); this.text(l.text, l.x === null ? WIDTH / 2 : l.x - this.camera, l.y, l.color, l.x === null ? 9 : 8, 'center'); } c.globalAlpha = 1;
    if (world.combo > 1) { this.text(String(world.combo).padStart(2, '0'), 460, 105, '#ffe1aa', 26, 'right'); this.text('连击 / HITS', 459, 116, '#b7c7bc', 7, 'right'); }
    if (this.bannerTime > 0) { c.globalAlpha = Math.min(1, this.bannerTime * 3); this.rect(105, 87, 270, 28, '#11232de8'); this.rect(105, 87, 3, 28, '#efbd7f'); this.text(this.banner, 240, 106, '#ffdfad', 13, 'center'); c.globalAlpha = 1; }
    if (world.cleared && world.mode === 'playing') this.text('GO →', 447, 172, '#ffdc8c', 12, 'right');
    if (this.flash > 0 && this.settings.flash > 0) { c.globalAlpha = this.flash * this.settings.flash * 2; this.rect(0, 0, WIDTH, HEIGHT, '#fff1c9'); c.globalAlpha = 1; }
    if (debug) {
      for (const a of [...world.heroes, ...world.enemies].filter(a => a.hp > 0)) { c.strokeStyle = a.hero ? '#65f6db' : '#ff8192'; c.strokeRect(Math.round(a.x - this.camera - 9), a.y - a.z - 38, 18, 38); if (a.action) { const m = a.action.move; c.strokeStyle = '#ffe08a'; c.strokeRect(a.x - this.camera + (a.face > 0 ? 0 : -m.reach), a.y - m.depth, m.reach, m.depth * 2); } }
      this.text(`${fps.toFixed(0)} FPS · FX ${this.fx.length} · seed ${world.seed}`, 8, 264, '#d9fff0', 7);
    }
  }
}
