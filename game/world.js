import { Rng } from '../src/core/math.js';
import { HEROES, ENEMIES, MOVES, ZONES, AI_LEVELS, neutral, teamIds } from './data.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.4);
const ready = a => a.hp > 0 && a.stun <= 0 && !a.action && !a.grabbedBy && a.z < 3 && a.vz <= 0;
export class World {
  constructor({ seed = 2026, ai = 'skilled', team } = {}) {
    this.seed = seed; this.ai = ai; this.team = teamIds(team); this.reset();
  }
  reset(team = this.team) {
    this.team = teamIds(team);
    this.rng = new Rng(this.seed); this.nextId = 1; this.time = 0; this.mode = 'playing'; this.active = 0;
    this.zone = 0; this.wave = -1; this.waveDelay = 1; this.cleared = false;
    this.heroes = this.team.map((id, i) => this.actor(HEROES.find(h => h.id === id), 70 + i * 35, 211 + i * 13, true));
    this.enemies = []; this.props = []; this.pickups = []; this.events = []; this.meter = 0; this.assistCD = 0;
    this.assist = 0; this.hitstop = 0; this.shake = 0; this.cinematic = null; this.combo = 0; this.comboTimer = 0;
    this.stats = { kills: 0, damage: 0, relays: 0, finishers: 0, bestCombo: 0 };
    this.setupProps(); this.saveCheckpoint(); this.emit('banner', { text: ZONES[0].name });
  }
  actor(def, x, y, hero = false) {
    return { ...def, uid: this.nextId++, hero, maxHp: def.hp, hp: def.hp, x, y, z: 0, vz: 0, vx: 0, face: hero ? 1 : -1,
      energy: 0, skillCD: [0, 0, 0], stun: 0, invuln: 0, dodge: 0, dodgeCD: 0, comboStep: 0, comboUntil: 0, action: null,
      input: neutral(), buffer: null, think: 0, decisions: 0, airHits: 0, bounced: false, carried: null,
      grab: null, grabbedBy: null, grabTime: 0, grabHits: 0, revive: 0, deathAge: 0, lastAttacker: null,
      lastHit: -10, lastDodge: -10, phase: 1, stuck: 0, aiState: '跟随', lastX: x, lastY: y };
  }
  get player() { return this.heroes[this.active]; }
  get partner() { return this.heroes[1 - this.active]; }
  get bounds() { return { left: ZONES[this.zone].start + 12, right: ZONES[this.zone].end - (this.cleared ? 0 : 14) }; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  message(text) { this.emit('message', { text }); }
  prop(type, x, y) { const p = { uid: this.nextId++, type, x, y, z: 0, vx: 0, vz: 0, hp: type === 'crate' ? 45 : 3, state: 0, holder: null, hit: new Set(), age: 0, ttl: Infinity }; this.props.push(p); return p; }
  setupProps() {
    const s = ZONES[this.zone].start;
    this.props = []; this.pickups = [];
    this.prop('melon', s + 172, 223); this.prop('chair', s + 247, 184);
    this.prop('crate', s + 359, 216); this.prop('cart', s + 455, 187);
    if (this.zone === 1) { this.prop('melon', s + 290, 232); this.prop('crate', s + 180, 185); }
    this.pickups.push({ uid: this.nextId++, type: this.zone === 0 ? 'energy' : 'heal', x: s + 121, y: 191 });
  }
  saveCheckpoint() { this.checkpoint = { zone: this.zone, active: this.active, team: [...this.team], heroes: this.heroes.map(h => ({ hp: h.hp, energy: h.energy, skillCD: [...h.skillCD] })), meter: this.meter, stats: { ...this.stats }, time: this.time }; }
  retry() {
    const cp = this.checkpoint;
    this.zone = cp.zone; this.active = cp.active; this.mode = 'playing'; this.wave = -1; this.waveDelay = .8; this.cleared = false;
    this.enemies = []; this.cinematic = null; this.events = []; this.hitstop = 0; this.combo = 0; this.comboTimer = 0; this.assistCD = 0; this.assist = 0;
    this.time = cp.time; this.stats = { ...cp.stats }; this.meter = cp.meter;
    this.rng = new Rng(this.seed + this.zone * 31); this.nextId = 1;
    this.team = [...cp.team];
    this.heroes = this.team.map((id, i) => { const d = HEROES.find(h => h.id === id), a = this.actor(d, ZONES[this.zone].start + 70 + i * 35, 211 + i * 13, true); a.hp = Math.max(d.hp * .5, cp.heroes[i].hp); a.energy = cp.heroes[i].energy; a.skillCD = [...cp.heroes[i].skillCD]; return a; });
    this.setupProps(); this.emit('banner', { text: '再来一次 · ' + ZONES[this.zone].short });
  }
  spawn(type, x, y) { const a = this.actor(ENEMIES[type], x, y); a.kind = type; this.enemies.push(a); return a; }
  nextWave() {
    this.wave++; const list = ZONES[this.zone].waves[this.wave];
    if (!list) { this.cleared = true; if (this.zone === 2) { this.mode = 'won'; this.emit('victory'); } else this.emit('banner', { text: '清场！向右推进 →' }); return; }
    const b = this.bounds;
    list.forEach((type, i) => this.spawn(type, clamp(this.player.x + (i % 2 ? -1 : 1) * (135 + i * 11), b.left + 20, b.right - 20), 174 + (i * 19) % 66));
    this.emit('wave', { wave: this.wave + 1 });
  }
  switchHero() {
    if (this.cinematic) return this.message('合击演出中');
    if (this.partner.hp <= 0) return this.message('搭档已倒地，请靠近救援');
    this.heroes.forEach(h => { h.input = neutral(); h.buffer = null; h.think = 0; });
    this.active = 1 - this.active; this.emit('switch', { actor: this.player }); return true;
  }
  command(action) {
    if (this.mode !== 'playing') return;
    if (action === 'switch') return this.switchHero();
    if (this.cinematic || this.player.hp <= 0) return;
    if (action === 'coop') return this.cooperate();
    if (action === 'interact') return this.interact(this.player);
    if (/^skill[123]$/.test(action) || action === 'ultimate') { this.player.buffer = null; return this.useSkill(this.player, action === 'ultimate' ? 3 : Number(action.at(-1)) - 1); }
    this.player.buffer = { action, until: this.time + .1 };
    this.consume(this.player);
  }
  consume(a) {
    if (!a.buffer || a.buffer.until < this.time) { a.buffer = null; return; }
    const { action } = a.buffer;
    if (a.grab) { if (a.input.x) a.face = Math.sign(a.input.x); if (action === 'light' && a.grabHits < 2) { a.grabHits++; this.hit(a, a.grab, 8, { push: 0, grabHit: true }); } else if (action === 'heavy') this.throwEnemy(a); a.buffer = null; return; }
    if (a.hp <= 0 || a.stun > 0 || a.grabbedBy || a.dodge > 0) return;
    const chain = a.action && a.action.move.combo && a.action.t >= a.action.move.startup + a.action.move.active && a.action.connected;
    if (a.action && !chain) return;
    if (action === 'dodge') { if (a.dodgeCD > 0 || a.z > 1 || a.vz > 0) return; a.dodge = .23; a.dodgeCD = .72; a.lastDodge = this.time; a.invuln = .18; a.action = null; this.emit('dodge', { actor: a }); }
    else if (action === 'jump') { if (a.z > 0 || a.vz > 0) return; a.vz = 175; }
    else if (action === 'light' || action === 'heavy') {
      if (a.carried) { if (a.carried.type === 'melon' || action === 'heavy') this.throwProp(a); else this.startMove(a, 'tool'); }
      else if (action === 'heavy' && a.z < 1 && this.enemies.some(e => e.hp > 0 && !e.boss && e.stun > 0 && !e.grabbedBy && distance(a, e) < 29)) {
        a.grab = this.enemies.find(e => e.hp > 0 && !e.boss && e.stun > 0 && !e.grabbedBy && distance(a, e) < 29); a.grab.grabbedBy = a; a.grab.action = null; a.grabTime = 1.2; a.grabHits = 0; a.action = null;
      } else {
        let id;
        if (a.z > 3 || a.vz > 0) id = a.aerial;
        else if (this.time - a.lastDodge < .65) { id = a.rush; a.lastDodge = -10; }
        else if (action === 'heavy') id = a.heavy;
        else { if (this.time > a.comboUntil) a.comboStep = 0; id = a.combo[a.comboStep % 3]; a.comboStep = (a.comboStep + 1) % 3; a.comboUntil = this.time + .85; }
        this.startMove(a, id);
      }
    }
    a.buffer = null;
  }
  skillReason(a, slot) {
    if (!a?.hero || !Number.isInteger(slot) || slot < 0 || slot > 3) return '无效技能';
    if (this.mode !== 'playing' || this.cinematic || this.hitstop > 0) return '等待行动';
    if (a.hp <= 0) return '角色已倒地';
    if (a.stun > 0 || a.grabbedBy || a.dodge > 0 || a.action) return '当前动作未结束';
    if (a.z > 0 || a.vz > 0) return '落地后使用';
    if (a.carried || a.grab) return '放下道具或结束抓取后使用';
    if (slot === 3 && a.energy < 100) return '气槽未满';
    if (slot < 3 && a.skillCD[slot] > 0) return '技能冷却中';
    return '';
  }
  useSkill(a, slot) {
    const reason = this.skillReason(a, slot);
    if (reason) { if (a === this.player) this.message(reason); return false; }
    const id = slot === 3 ? a.ultimate : a.skills[slot];
    if (slot === 3) a.energy = 0; else a.skillCD[slot] = MOVES[id].cooldown;
    a.buffer = null; a.comboStep = 0; this.startMove(a, id);
    this.emit(slot === 3 ? 'ultimate' : 'skill', { actor: a, move: id }); return true;
  }
  startMove(a, id) { a.action = { id, move: MOVES[id], t: 0, hits: new Map(), connected: false }; a.revive = 0; this.emit('swing', { actor: a, move: id }); }
  interact(a) {
    if (!ready(a)) return;
    if (a.carried) { const p = a.carried; p.holder = null; p.x = a.x + a.face * 17; p.y = a.y; p.z = 0; a.carried = null; return; }
    const p = this.props.filter(p => !p.holder && p.hp > 0 && ['melon', 'chair'].includes(p.type) && distance(a, p) < 30).sort((p, q) => distance(a, p) - distance(a, q))[0];
    if (p) { p.holder = a; p.vx = 0; a.carried = p; this.emit('pickup', { actor: a }); }
  }
  throwProp(a) { const p = a.carried; if (!p) return; a.carried = null; p.holder = null; p.owner = a; p.x = a.x + a.face * 18; p.y = a.y; p.z = 20 + a.z; p.vz = 85; p.vx = a.face * 230; p.hit.clear(); this.startMove(a, a.combo[0]); this.emit('throw', { actor: a }); }
  throwEnemy(a) {
    const e = a.grab; if (!e) return;
    e.grabbedBy = null; a.grab = null; e.x = a.x + a.face * 18; e.z = Math.max(12, e.z); e.vz = 115; e.vx = a.face * a.throwPower; e.stun = .9; e.thrown = true; e.throwOwner = a; e.thrownHit = new Set(); e.cartHits = new Set();
    this.hit(a, e, a.throwDamage, { push: Math.abs(e.vx), launch: 115 }); this.emit('throw', { actor: a });
  }
  release(a) { if (a.grab) { a.grab.grabbedBy = null; a.grab = null; } if (a.grabbedBy) { a.grabbedBy.grab = null; a.grabbedBy = null; } }
  hit(source, target, damage, effect = {}) {
    if (target.hp <= 0 || target.invuln > 0 || (source.hero && target.hero)) return false;
    if (target.guard && !target.action && target.stun <= 0 && target.face === -source.face && !effect.heavy && !effect.grabHit) {
      this.emit('block', { x: target.x, y: target.y - 22, actor: target }); target.energy = clamp(target.energy + 2, 0, 100); return true;
    }
    const amount = effect.execute ? target.hp : Math.max(1, Math.round(damage * (target.z > 0 ? Math.max(.35, 1 - target.airHits * .12) : 1)));
    target.hp = Math.max(0, target.hp - amount); target.revive = 0;
    if (!target.action?.move.armor) { target.action = null; target.stun = effect.heavy ? .65 : .28; }
    if (target.guard && effect.heavy) { target.stun = .9; this.emit('break', { x: target.x, y: target.y - 20 }); }
    if (!effect.grabHit) {
      this.release(target); target.vx = (source.x <= target.x ? 1 : -1) * (effect.push ?? 40);
      if (effect.launch || target.z > 3) { target.vz = Math.max(target.vz, effect.launch ?? 60); target.z = Math.max(1, target.z); target.airHits++; }
    }
    target.energy = clamp(target.energy + amount * .45, 0, 100);
    if (source.hero) {
      const credit = source.credit ?? source; credit.energy = clamp(credit.energy + amount * .55, 0, 100); this.stats.damage += amount;
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1; this.comboTimer = 2; this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      if (this.heroes.some(h => h.uid === target.lastAttacker) && this.heroes.some(h => h.uid === source.uid) && target.lastAttacker !== source.uid && this.time - target.lastHit < 1.6) { this.meter = clamp(this.meter + 12, 0, 100); this.stats.relays++; this.emit('relay', { x: target.x, y: target.y - 45 }); }
      else this.meter = clamp(this.meter + 2, 0, 100);
      target.lastAttacker = source.uid; target.lastHit = this.time;
    }
    this.hitstop = Math.max(this.hitstop, effect.heavy ? .065 : .032); this.shake = Math.max(this.shake, effect.heavy ? 2.5 : .7);
    this.emit('hit', { x: target.x, y: target.y - target.z - 20, damage: amount, heavy: !!effect.heavy, actor: target, source });
    if (target.hp <= 0) {
      this.release(target); if (target.carried) { target.carried.holder = null; target.carried.x = target.x; target.carried.y = target.y; target.carried = null; }
      target.action = null; target.stun = 0;
      if (!target.hero) { this.stats.kills++; this.emit('ko', { actor: target }); if (target.boss) this.emit('bossfinish', { x: target.x, y: target.y - 20 }); }
      else { this.emit('down', { actor: target }); if (target === this.player && this.partner.hp > 0) this.switchHero(); }
    }
    return true;
  }
  cooperate() {
    const a = this.player, b = this.partner;
    if (this.cinematic || a.hp <= 0 || b.hp <= 0) return this.message('搭档恢复行动后可协作');
    const pairReady = ready(a) && ready(b) && distance(a, b) <= 135;
    const e = pairReady && this.enemies.find(e => e.hp > 0 && !e.boss && e.hp <= e.maxHp * .2 && e.stun > 0 && distance(a, e) < 75 && distance(b, e) < 100);
    if (e) { this.beginCinema('finish', e); return; }
    if (pairReady && this.meter >= 100 && this.enemies.some(e => e.hp > 0 && distance(a, e) < 120)) { this.meter = 0; this.beginCinema('team', this.enemies.filter(e => e.hp > 0).sort((x, y) => distance(a, x) - distance(a, y))[0]); return; }
    if (this.assistCD <= 0) { this.assist = 2; this.assistCD = 6; b.think = 0; this.message('接力！搭档正在寻找机会'); } else this.message('接力请求冷却中');
  }
  beginCinema(type, target) { this.cinematic = { type, target, t: 0, applied: false }; this.heroes.forEach(h => { h.input = neutral(); h.buffer = null; this.release(h); }); this.emit('cinema', { kind: type, x: target.x, y: target.y }); }
  updateCinema(dt) {
    const c = this.cinematic;
    if (this.heroes.some(h => h.hp <= 0 || h.stun > 0) || (!c.applied && c.target.hp <= 0)) { this.cinematic = null; return; }
    c.t += dt;
    // Move into the shared choreography over time, without changing control ownership.
    this.heroes.forEach((h, i) => {
      const goalX = clamp(c.target.x + (i ? 24 : -24), this.bounds.left, this.bounds.right);
      h.x += clamp(goalX - h.x, -190 * dt, 190 * dt); h.y += clamp(c.target.y - h.y, -90 * dt, 90 * dt); h.face = i ? -1 : 1;
    });
    if (!c.applied) { c.target.z = Math.sin(Math.min(1, c.t / .65) * Math.PI) * (c.type === 'team' ? 35 : 15); c.target.vz = 0; }
    if (c.t >= .65 && !c.applied) {
      c.applied = true;
      if (c.type === 'finish') { c.target.invuln = 0; this.hit(this.player, c.target, c.target.hp + 1, { execute: true, heavy: true, push: 220, launch: 130 }); this.stats.finishers++; this.heroes.forEach(h => h.energy = clamp(h.energy + 15, 0, 100)); }
      else this.enemies.filter(e => e.hp > 0 && distance(e, c.target) < 115).forEach(e => this.hit(this.player, e, 95, { heavy: true, push: 220, launch: 140 }));
      this.emit('slam', { x: c.target.x, y: c.target.y }); this.shake = 5;
    }
    if (c.t > 1.15) { this.cinematic = null; this.heroes.forEach(h => h.input = neutral()); }
  }
  reviveActor(a, target, dt) {
    if (!ready(a) || distance(a, target) > 30) { a.revive = 0; return; }
    a.revive += dt;
    if (a.revive >= 2) { target.hp = target.maxHp * .3; target.invuln = 2; target.stun = 0; target.z = 0; target.vx = 0; target.vz = 0; target.input = neutral(); a.revive = 0; this.emit('revive', { actor: target }); }
  }
  thinkPartner(a, dt) {
    a.think -= dt; if (a.think > 0) return;
    a.think += AI_LEVELS[this.ai].interval; a.decisions++; a.input = neutral();
    if (a.hp <= 0 || a.stun > 0 || a.grabbedBy) return;
    const level = this.ai, player = this.player;
    const danger = this.enemies.find(e => e.hp > 0 && e.action && distance(a, e) < e.action.move.reach + 22 && Math.abs(a.y - e.y) < e.action.move.depth + 6 && (level === 'expert' || e.action.t > e.action.move.startup * .65));
    if (danger && !a.action && a.dodgeCD <= 0) { a.aiState = '避险'; a.input.y = a.y < 207 ? 1 : -1; a.buffer = { action: 'dodge', until: this.time + .1 }; return; }
    if (player.hp <= 0 && !this.enemies.some(e => e.hp > 0 && distance(e, player) < 75)) { a.aiState = '救援'; this.steer(a, player, 20); if (distance(a, player) < 29 && !danger) a.input.held = true; return; }
    const targets = this.enemies.filter(e => e.hp > 0 && !e.grabbedBy).sort((e, f) => {
      const score = e => distance(a, e) + (e.uid === player.target ? 45 : 0) - (e.z > 5 && level !== 'basic' ? 65 : 0) - (e.lastAttacker === player.uid && this.assist > 0 ? 80 : 0) - (level === 'expert' && e.target === player.uid && e.action ? 45 : 0);
      return score(e) - score(f);
    });
    const target = targets[0];
    if (a.grab) { a.buffer = { action: a.grabHits < 2 ? 'light' : 'heavy', until: this.time + .1 }; return; }
    if (!target) { a.aiState = '跟随'; this.steer(a, { x: player.x - player.face * 35, y: clamp(player.y + 14, 172, 238) }, 18); return; }
    a.target = target.uid; a.aiState = this.assist > 0 || target.z > 4 ? '接击' : '战斗';
    if (ready(a) && !a.carried && !a.grab && !a.dodge && !this.hitstop) {
      const dx = target.x - a.x, depth = Math.abs(target.y - a.y), nearby = targets.filter(e => distance(a, e) < 80).length;
      for (const slot of [2, 1, 0]) {
        const m = MOVES[a.skills[slot]];
        const useful = m.purpose === 'crowd' ? nearby >= (level === 'basic' ? 3 : 2) : m.purpose === 'dash' ? Math.abs(dx) > 43 && Math.abs(dx) < (level === 'basic' ? 80 : 110) : m.purpose === 'retreat' ? Math.abs(dx) < 35 : Math.abs(dx) < m.reach - 5;
        if (useful && depth < m.depth && a.skillCD[slot] <= 0) { a.face = Math.sign(dx) || a.face; if (this.useSkill(a, slot)) { a.aiState = '施技'; a.input = neutral(); return; } }
      }
    }
    if (level !== 'basic' && !a.carried && !a.action) {
      const p = this.props.find(p => p.hp > 0 && !p.holder && ['melon', 'chair'].includes(p.type) && distance(a, p) < 23);
      if (p && distance(a, target) > 48) this.interact(a);
    }
    const offset = level === 'basic' ? 0 : (a.uid % 2 ? 5 : -5);
    this.steer(a, { x: target.x - Math.sign(target.x - a.x || a.face) * 25, y: target.y + offset }, 7);
    if (Math.abs(target.x - a.x) < (a.carried?.type === 'melon' ? 150 : 40) && Math.abs(target.y - a.y) < 15) {
      a.face = target.x > a.x ? 1 : -1; a.input.x = 0; a.input.y = 0;
      a.buffer = { action: level !== 'basic' && (target.guard || target.stun > 0 || (this.assist > 0 && a.style === 'power')) ? 'heavy' : 'light', until: this.time + .1 };
    }
    if (Math.abs(a.x - a.lastX) + Math.abs(a.y - a.lastY) < 1 && Math.abs(a.input.x) > 0) a.stuck += AI_LEVELS[level].interval; else a.stuck = 0;
    if (a.stuck > .5) { a.input.y = a.y < 210 ? 1 : -1; a.aiState = '绕行'; }
    a.lastX = a.x; a.lastY = a.y;
  }
  steer(a, p, tolerance) { a.input.x = Math.abs(p.x - a.x) > tolerance ? Math.sign(p.x - a.x) : 0; a.input.y = Math.abs(p.y - a.y) > 5 ? Math.sign(p.y - a.y) : 0; }
  thinkEnemy(e, dt) {
    e.think -= dt; if (e.think > 0) return; e.think = e.boss && e.phase === 2 ? .18 : .32;
    e.input = neutral(); if (!ready(e)) return;
    const alive = this.heroes.filter(h => h.hp > 0); if (!alive.length) return;
    const target = alive.sort((a, b) => distance(e, a) - distance(e, b))[0]; e.target = target.uid;
    const attackers = this.enemies.filter(a => a.hp > 0 && a.action).length;
    if (attackers >= 2) { e.aiState = '包围'; this.steer(e, { x: target.x + (e.uid % 2 ? 65 : -65), y: clamp(target.y + (e.uid % 2 ? -25 : 25), 174, 239) }, 12); return; }
    e.aiState = '接近'; this.steer(e, { x: target.x - Math.sign(target.x - e.x || 1) * 25, y: target.y }, 5);
    const reach = e.kind === 'charger' || e.boss ? 140 : 39;
    if (Math.abs(e.x - target.x) < reach && Math.abs(e.y - target.y) < 14) {
      e.face = target.x > e.x ? 1 : -1;
      const id = e.boss ? ['sweep', 'bosscharge', 'bossslam'][Math.floor(this.rng.range(0, 3))] : e.move;
      this.startMove(e, id); e.input = neutral();
    }
  }
  moveActor(a, dt) {
    a.stun = Math.max(0, a.stun - dt); a.invuln = Math.max(0, a.invuln - dt); a.dodgeCD = Math.max(0, a.dodgeCD - dt);
    if (a.hp <= 0) a.deathAge += dt;
    if (a.grabbedBy) { const h = a.grabbedBy; a.x = h.x + h.face * 18; a.y = h.y + 1; a.vx = 0; return; }
    if (a.grab) { a.grabTime -= dt; if (a.grab.hp <= 0) this.release(a); else if (a.grabTime <= 0) this.throwEnemy(a); }
    if (a.z > 0 || a.vz > 0) { a.z += a.vz * dt; a.vz -= (420 + a.airHits * 75) * dt; if (a.z <= 0) { a.z = 0; a.vz = 0; a.airHits = 0; a.bounced = false; a.thrown = false; } }
    let dx = a.vx * dt, dy = 0; a.vx *= Math.exp(-5 * dt);
    if (a.hp > 0 && a.stun <= 0 && !a.grab) {
      if (a.dodge > 0) { a.dodge -= dt; const l = Math.hypot(a.input.x, a.input.y) || 1; dx += (a.input.x || (!a.input.y ? a.face : 0)) / l * 220 * dt; dy += a.input.y / l * 150 * dt; }
      else if (!a.action) { const l = Math.max(1, Math.hypot(a.input.x, a.input.y)); dx += a.input.x / l * a.speed * (a.carried ? .7 : 1) * dt; dy += a.input.y / l * a.speed * .65 * dt; if (a.input.x) a.face = Math.sign(a.input.x); }
      if (a.action && a.action.t >= a.action.move.startup && a.action.t < a.action.move.startup + a.action.move.active) dx += (a.action.move.travel ?? 0) * a.face * dt;
    }
    const b = this.bounds, nx = clamp(a.x + dx, b.left, b.right), ny = clamp(a.y + dy, 168, 244);
    const obstacle = this.props.find(p => p.hp > 0 && !p.holder && (p.type === 'crate' || p.type === 'cart') && Math.abs(nx - p.x) < (p.type === 'cart' ? 19 : 13) && Math.abs(ny - p.y) < 10);
    if (!obstacle || a.z > 18 || a.hp <= 0 || Math.abs(a.vx) > 60) { a.x = nx; a.y = ny; }
    else { if (Math.abs(a.x - obstacle.x) > (obstacle.type === 'cart' ? 19 : 13)) a.y = ny; else a.x = nx; }
    if ((nx <= b.left || nx >= b.right) && Math.abs(a.vx) > 60 && a.z > 0 && !a.bounced) { a.vx *= -.65; a.vz = Math.max(a.vz, 95); a.bounced = true; a.stun = Math.max(a.stun, .4); this.emit('bounce', { x: a.x, y: a.y - a.z }); }
  }
  updateAttack(a, dt) {
    const action = a.action; if (!action || a.hp <= 0) return;
    action.t += dt; const m = action.move;
    const pulseCount = m.pulses ?? 1;
    if (!action.visualStarted && action.t >= m.startup) { action.visualStarted = true; this.emit('active', { actor: a, move: action.id, x: a.x, y: a.y }); }
    if (action.t >= m.startup && action.t <= m.startup + m.active) {
      const pulse = Math.min(pulseCount - 1, Math.floor((action.t - m.startup) / m.active * pulseCount));
      if (pulse > 0 && action.visualPulse !== pulse && m.pulses > 2) { action.visualPulse = pulse; if (pulse % 2 === 0) this.emit('pulse', { actor: a, move: action.id, x: a.x, y: a.y }); }
      if (!action.hits.has(pulse)) action.hits.set(pulse, new Set()); const hits = action.hits.get(pulse);
      const radial = m.radial || (m.finalRadial && pulse === pulseCount - 1);
      const targets = a.hero ? this.enemies : this.heroes;
      for (const t of targets) {
        if (t.hp <= 0 || t.grabbedBy || hits.has(t.uid)) continue;
        const ahead = (t.x - a.x) * a.face, dz = Math.abs(t.z - a.z);
        if ((radial ? Math.abs(ahead) < m.reach : ahead > -9 && ahead < m.reach) && Math.abs(t.y - a.y) < m.depth && (dz < 34 || m.launch || radial)) {
          hits.add(t.uid); if (this.hit(a, t, m.damage, { ...m, push: pulse === pulseCount - 1 ? m.finalPush ?? m.push : m.push, launch: pulse === pulseCount - 1 ? m.launch : 0 })) action.connected = true;
        }
      }
      if (a.hero) for (const p of this.props) {
        if (p.hp <= 0 || p.holder || hits.has(p.uid) || p.type === 'peel') continue;
        const ahead = (p.x - a.x) * a.face;
        if ((radial ? Math.abs(ahead) < m.reach : ahead > 0 && ahead < m.reach) && Math.abs(p.y - a.y) < m.depth && a.z < 25) {
          hits.add(p.uid); this.damageProp(p, a, m.damage, m.heavy); action.connected = true;
        }
      }
      if (action.id === 'tool' && action.connected && !action.toolUsed) { action.toolUsed = true; if (a.carried && --a.carried.hp <= 0) { this.breakProp(a.carried); a.carried = null; } }
    }
    if (action.t >= m.duration) a.action = null;
  }
  damageProp(p, source, damage, heavy) {
    if (p.hp <= 0) return;
    if (p.type === 'cart') { if (heavy) { p.owner = source; p.vx = source.face * 230; p.hit.clear(); this.emit('throw', { actor: source }); } return; }
    if (p.type === 'melon') { if (heavy) this.crackMelon(p); return; }
    p.hp -= p.type === 'chair' ? 1 : damage;
    if (p.hp <= 0) this.breakProp(p);
  }
  crackMelon(p) {
    if (p.hp <= 0) return;
    if (p.state === 0) { p.state = 1; p.vx = 0; p.vz = 0; this.emit('crack', { x: p.x, y: p.y - p.z }); }
    else { p.hp = 0; this.emit('juice', { x: p.x, y: p.y - p.z }); const peel = this.prop('peel', p.x, p.y); peel.ttl = 9; }
  }
  breakProp(p) {
    p.hp = 0; if (p.holder) { p.holder.carried = null; p.holder = null; }
    this.emit('breakprop', { x: p.x, y: p.y - p.z, kind: p.type });
    if (p.type === 'crate') this.pickups.push({ uid: this.nextId++, type: 'heal', x: p.x, y: p.y });
  }
  updateProps(dt) {
    for (const p of [...this.props]) {
      if (p.hp <= 0) continue; p.age += dt;
      if (p.holder) { p.x = p.holder.x + p.holder.face * 10; p.y = p.holder.y; p.z = p.holder.z + 23; continue; }
      p.ttl -= dt; if (p.ttl <= 0) { p.hp = 0; continue; }
      if (p.type === 'peel') { const t = [...this.heroes, ...this.enemies].find(a => a.hp > 0 && !a.boss && a.z < 2 && distance(a, p) < 13); if (t) { t.stun = .85; t.action = null; t.vx = t.face * 80; this.release(t); p.hp = 0; this.emit('slip', { actor: t }); } continue; }
      if (Math.abs(p.vx) < 5 && p.z <= 0) continue;
      p.x += p.vx * dt; p.vx *= Math.exp(-(p.type === 'cart' ? 1.4 : .65) * dt);
      if (p.type !== 'cart') { p.z += p.vz * dt; p.vz -= 300 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; if (p.type === 'melon' && Math.abs(p.vx) > 20) this.crackMelon(p); else if (p.type === 'chair') this.breakProp(p); } }
      const b = this.bounds;
      if (p.x < b.left || p.x > b.right) { p.x = clamp(p.x, b.left, b.right); if (p.type === 'melon') this.crackMelon(p); else if (p.type === 'chair') this.breakProp(p); p.vx = 0; }
      for (const e of this.enemies) if (p.hp > 0 && e.hp > 0 && !p.hit.has(e.uid) && distance(p, e) < (p.type === 'cart' ? 28 : 18) && Math.abs(e.z + 18 - p.z) < 40 && Math.abs(p.vx) > 20) {
        p.hit.add(e.uid); const s = { hero: true, uid: -p.uid, x: p.x - Math.sign(p.vx), face: Math.sign(p.vx), energy: 0 };
        this.hit(p.owner ? { ...s, uid: p.owner.uid, credit: p.owner } : s, e, p.type === 'cart' ? 28 : 22, { heavy: true, push: Math.abs(p.vx) * .6 });
        if (p.type === 'melon') this.crackMelon(p); else if (p.type === 'chair') this.breakProp(p);
      }
    }
    for (const e of this.enemies) if (e.thrown && e.hp > 0 && Math.abs(e.vx) > 65) {
      for (const t of this.enemies) if (t !== e && t.hp > 0 && !e.thrownHit.has(t.uid) && distance(e, t) < 24) { e.thrownHit.add(t.uid); this.hit({ hero: true, uid: e.throwOwner?.uid ?? -e.uid, credit: e.throwOwner, x: e.x, energy: 0 }, t, 18, { heavy: true, push: Math.abs(e.vx) }); }
      for (const p of this.props) if (p.type === 'cart' && !e.cartHits.has(p.uid) && distance(e, p) < 28) { e.cartHits.add(p.uid); p.owner = e.throwOwner; p.vx = e.vx; p.hit.clear(); }
    }
    this.pickups = this.pickups.filter(p => { const h = this.heroes.find(h => h.hp > 0 && distance(h, p) < 19); if (!h) return true; if (p.type === 'heal') h.hp = Math.min(h.maxHp, h.hp + 36); else h.energy = 100; this.emit('pickup', { actor: h, kind: p.type }); return false; });
    this.props = this.props.filter(p => p.hp > 0);
  }
  update(dt) {
    if (this.mode !== 'playing') return;
    if (this.cinematic) { this.updateCinema(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.time += dt; this.assistCD = Math.max(0, this.assistCD - dt); this.assist = Math.max(0, this.assist - dt); this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; this.shake *= .88;
    if (this.heroes.every(h => h.hp <= 0)) { this.mode = 'lost'; return; }
    if (this.player.hp <= 0 && this.partner.hp > 0) this.switchHero();
    this.thinkPartner(this.partner, dt);
    for (const e of this.enemies) {
      if (e.boss && e.hp > 0 && e.hp <= e.maxHp * .5 && e.phase === 1) { e.phase = 2; this.emit('banner', { text: '招牌王暴走！' }); ['punk', 'guard', 'charger'].forEach((k, i) => this.spawn(k, 1300 + i * 90, 185 + i * 20)); }
      this.thinkEnemy(e, dt);
    }
    for (const h of this.heroes) h.skillCD = h.skillCD.map(cd => Math.max(0, cd - dt));
    for (const a of [...this.heroes, ...this.enemies]) { this.consume(a); this.moveActor(a, dt); this.updateAttack(a, dt); }
    for (const h of this.heroes) { const down = this.heroes.find(a => a !== h && a.hp <= 0); if (h.input.held && down) this.reviveActor(h, down, dt); else h.revive = 0; }
    this.updateProps(dt);
    this.enemies = this.enemies.filter(e => e.hp > 0 || e.deathAge < 1.2);
    if (!this.enemies.some(e => e.hp > 0) && !this.cleared) { this.waveDelay -= dt; if (this.waveDelay <= 0) { this.nextWave(); this.waveDelay = 1.5; } }
    if (this.cleared && this.zone < 2 && this.player.x > ZONES[this.zone].end - 28) {
      this.zone++; this.wave = -1; this.waveDelay = 1.6; this.cleared = false; this.enemies = [];
      this.heroes.forEach((h, i) => { this.release(h); if (h.carried) h.carried.holder = null; h.carried = null; h.x = ZONES[this.zone].start + 35 + i * 28; h.y = 211 + i * 13; h.hp = Math.max(h.hp, h.maxHp * .3); h.action = null; h.stun = 0; h.z = 0; h.vz = 0; h.vx = 0; h.input = neutral(); });
      this.setupProps(); this.saveCheckpoint(); this.emit('banner', { text: ZONES[this.zone].name });
    }
  }
}
