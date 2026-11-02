import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../world.js';
import { STEP, AI_LEVELS } from '../data.js';

function arena() { const w = new World(); w.props = []; w.pickups = []; w.waveDelay = 1e6; w.partner.think = 1e6; w.player.x = 100; w.player.y = 210; w.partner.x = 145; w.partner.y = 220; return w; }
function enemy(w, type = 'punk', x = 122, y = 210) { const e = w.spawn(type, x, y); e.think = 1e6; return e; }
function ticks(w, n) { for (let i = 0; i < n; i++) w.update(STEP); }

test('switch transfers control without changing action, velocity, resources, or equipment', () => {
  const w = arena(), h = w.player; w.startMove(h, 'jab'); h.vx = 41; h.energy = 72; const prop = w.prop('chair', h.x, h.y); prop.holder = h; h.carried = prop; h.input.x = 1;
  const action = h.action; assert.equal(w.switchHero(), true); assert.equal(w.active, 1); assert.equal(h.action, action); assert.equal(h.vx, 41); assert.equal(h.energy, 72); assert.equal(h.carried, prop); assert.equal(h.input.x, 0); assert.equal(h.invuln, 0);
  w.switchHero(); assert.equal(w.player, h); assert.equal(h.action, action);
});
test('one hit per attack, connected combo cancels only after active frames', () => {
  const w = arena(), e = enemy(w); w.command('light'); ticks(w, 8); const hp = e.hp; assert.equal(hp, 80);
  ticks(w, 6); assert.equal(e.hp, hp); w.command('light'); assert.equal(w.player.action.id, 'elbow'); ticks(w, 10); assert.equal(e.hp, 68);
});
test('missed attacks retain recovery and expired buffered input does not fire later', () => {
  const w = arena(); w.command('heavy'); ticks(w, 2); w.command('light'); ticks(w, 50); assert.equal(w.player.action, null); assert.equal(w.player.comboStep, 0);
});
test('jump then immediate attack in the same simulation frame selects an aerial move', () => {
  const w = arena(); w.command('jump'); w.command('light'); assert.equal(w.player.action.id, 'airkick');
  w.switchHero(); w.command('jump'); w.command('light'); assert.equal(w.player.action.id, 'airslam');
});
test('guard rejects light attack but heavy breaks guard', () => {
  const w = arena(), e = enemy(w, 'guard'); const hp = e.hp;
  w.hit(w.player, e, 10); assert.equal(e.hp, hp);
  w.hit(w.player, e, 25, { heavy: true }); assert.equal(e.hp, hp - 25); assert.ok(e.stun >= .8);
});
test('launch scaling, one wall bounce and landing reset', () => {
  const w = arena(), e = enemy(w); w.hit(w.player, e, 20, { launch: 150, push: 0 }); const hp = e.hp;
  w.hit(w.player, e, 20, { launch: 100, push: 0 }); assert.ok(hp - e.hp < 20); assert.equal(e.airHits, 2);
  e.x = w.bounds.right - 1; e.vx = 200; w.moveActor(e, STEP); assert.equal(e.bounced, true); assert.ok(e.vx < 0);
  e.vx = 200; e.x = w.bounds.right; w.moveActor(e, STEP); assert.ok(e.vx > 0);
  e.z = .01; e.vz = -100; w.moveActor(e, STEP); assert.equal(e.airHits, 0); assert.equal(e.bounced, false);
});
test('grabbing, two follow-ups, throwing and interruption release both actors', () => {
  const w = arena(), e = enemy(w); e.stun = 1; w.command('heavy'); assert.equal(w.player.grab, e);
  w.command('light'); w.command('light'); w.command('light'); assert.equal(w.player.grabHits, 2);
  w.command('heavy'); assert.equal(e.grabbedBy, null); assert.equal(w.player.grab, null); assert.ok(e.thrown); assert.ok(e.vx > 0);
  const f = enemy(w, 'punk', 120); f.stun = 1; w.player.action = null; w.command('heavy'); w.hit({ hero: false, x: 80 }, w.player, 10); assert.equal(f.grabbedBy, null); assert.equal(w.player.grab, null);
});
test('directional throw uses the requested side, even when turning during a grab', () => {
  const w = arena(), e = enemy(w); e.stun = 1; w.command('heavy'); w.player.input.x = -1; w.command('heavy'); assert.ok(e.vx < 0); assert.ok(e.x < w.player.x);
});
test('melon state machine, one-use peel, breakable chair and guaranteed crate healing', () => {
  const w = arena(), melon = w.prop('melon', 120, 210); w.crackMelon(melon); assert.equal(melon.state, 1); w.crackMelon(melon); assert.equal(melon.hp, 0);
  const peel = w.props.find(p => p.type === 'peel'); w.player.x = peel.x; w.updateProps(STEP); assert.ok(w.player.stun > 0); assert.equal(peel.hp, 0);
  const chair = w.prop('chair', 120, 210); for (let i = 0; i < 3; i++) w.damageProp(chair, w.player, 12, false); assert.equal(chair.hp, 0);
  const crate = w.prop('crate', 350, 210); w.damageProp(crate, w.player, 50, true); assert.equal(w.pickups.length, 1); w.damageProp(crate, w.player, 50, true); assert.equal(w.pickups.length, 1);
});
test('cart damages each enemy once per push, never heroes', () => {
  const w = arena(), e = enemy(w, 'punk', 140), cart = w.prop('cart', 120, 210); cart.vx = 220; const hp = w.player.hp;
  w.updateProps(STEP); const ehp = e.hp; w.updateProps(STEP); assert.equal(e.hp, ehp); assert.equal(w.player.hp, hp); assert.ok(ehp < e.maxHp);
});
test('ultimates require energy; five flurry pulses are independently counted', () => {
  const w = arena(), e = enemy(w); w.command('ultimate'); assert.equal(w.player.action, null); w.player.energy = 100; w.command('ultimate'); assert.equal(w.player.action.id, 'flurry'); assert.equal(w.player.energy, 0);
  e.maxHp = e.hp = 1000;
  for (let i = 0; i < 110; i++) { e.x = 124; e.y = 210; e.z = 0; e.vz = 0; e.vx = 0; w.update(STEP); }
  assert.equal(e.hp, 935);
});
test('different heroes build relay meter, finishers kill and unlock control', () => {
  const w = arena(), e = enemy(w); w.hit(w.player, e, 10); w.hit(w.partner, e, 10); assert.equal(w.stats.relays, 1); assert.ok(w.meter >= 14);
  w.player.action = null; w.player.stun = 0; w.partner.action = null; w.partner.stun = 0; e.hp = 10; e.stun = 1; w.cooperate(); assert.equal(w.cinematic.type, 'finish'); const index = w.active; w.switchHero(); assert.equal(w.active, index);
  ticks(w, 80); assert.equal(e.hp, 0); assert.equal(w.cinematic, null); assert.equal(w.stats.finishers, 1);
});
test('team attack spends meter once, and invalid targets safely abort', () => {
  const w = arena(), e = enemy(w); w.meter = 100; w.cooperate(); assert.equal(w.cinematic.type, 'team'); assert.equal(w.meter, 0); e.hp = 0; w.update(STEP); assert.equal(w.cinematic, null);
  w.meter = 100; e.hp = 90; w.cooperate(); ticks(w, 80); assert.equal(w.cinematic, null); assert.equal(e.hp, 0);
});
test('assist can be requested mid-combo without canceling the attack or spending team meter', () => {
  const w = arena(); enemy(w); w.meter = 100; w.command('light'); const action = w.player.action; w.cooperate(); assert.ok(w.assist > 0); assert.equal(w.cinematic, null); assert.equal(w.player.action, action); assert.equal(w.meter, 100);
});
test('a cracked melon settles for a second throw, and cannot create multiple peels after breaking', () => {
  const w = arena(), p = w.prop('melon', 250, 210); p.vx = 200; p.z = 10; w.crackMelon(p);
  for (let i = 0; i < 90; i++) w.updateProps(STEP);
  assert.equal(p.state, 1); assert.equal(p.hp, 3); assert.equal(p.z, 0); w.crackMelon(p); w.crackMelon(p); assert.equal(w.props.filter(p => p.type === 'peel').length, 1);
});
test('execution ignores airborne damage reduction and partner interruption releases the cinematic', () => {
  const w = arena(), e = enemy(w); e.hp = 12; e.z = 4; e.airHits = 6; e.stun = 1; w.cooperate(); ticks(w, 80); assert.equal(e.hp, 0);
  const f = enemy(w); w.meter = 100; w.heroes.forEach(h => { h.action = null; h.stun = 0; }); w.cooperate(); assert.ok(w.cinematic); w.partner.stun = 1; w.update(STEP); assert.equal(w.cinematic, null);
});
test('downed hero drops equipment, auto-switches; rescue requires sustained safe interaction', () => {
  const w = arena(), a = w.player, b = w.partner, chair = w.prop('chair', a.x, a.y); chair.holder = a; a.carried = chair;
  w.hit({ hero: false, x: a.x - 10 }, a, 500); assert.equal(w.player, b); assert.equal(a.carried, null); assert.equal(chair.holder, null);
  b.x = a.x + 10; b.y = a.y; b.stun = 0; for (let i = 0; i < 121; i++) w.reviveActor(b, a, STEP);
  assert.equal(a.hp, a.maxHp * .3); assert.ok(a.invuln > 0);
});
test('double knockdown retries checkpoint with restored rewards, props and minimum health', () => {
  const w = arena(); w.heroes[0].hp = 10; w.stats.kills = 3; w.saveCheckpoint(); w.stats.kills = 99; w.props = []; w.heroes.forEach(h => h.hp = 0); w.update(STEP); assert.equal(w.mode, 'lost');
  w.retry(); assert.equal(w.mode, 'playing'); assert.equal(w.stats.kills, 3); assert.equal(w.heroes[0].hp, 55); assert.equal(w.props.length, 4);
});
test('AI difficulty changes thinking cadence, not actor stats, and never spends special meters', () => {
  for (const [ai, config] of Object.entries(AI_LEVELS)) {
    const w = arena(); w.ai = ai; w.partner.think = 0; w.partner.energy = 100; w.meter = 100; enemy(w, 'guard', 170, 220);
    for (let i = 0; i < 60; i++) w.thinkPartner(w.partner, STEP);
    assert.ok(Math.abs(w.partner.decisions - Math.ceil(1 / config.interval)) <= 1); assert.equal(w.partner.energy, 100); assert.equal(w.meter, 100); assert.equal(w.partner.maxHp, 160);
    w.switchHero(); w.partner.think = 0; w.thinkPartner(w.partner, STEP); assert.ok(w.partner.decisions > 0);
  }
});
test('AI rescue and stuck-path recovery work for both body types', () => {
  for (const active of [0, 1]) {
    const w = arena(); w.active = active; const a = w.partner; w.player.hp = 0; a.x = w.player.x + 10; a.y = w.player.y; a.think = 0;
    w.thinkPartner(a, STEP); assert.equal(a.aiState, '救援'); assert.equal(a.input.held, true);
    w.player.hp = 50; a.x = 101; a.y = 211; enemy(w, 'punk', 300, 211); a.lastX = a.x; a.lastY = a.y; a.stuck = .6; a.think = 0; w.thinkPartner(a, STEP); assert.equal(a.aiState, '绕行'); assert.notEqual(a.input.y, 0);
  }
});
test('only two enemy attack slots, and Boss phase spawns reinforcements once', () => {
  const w = arena(); const enemies = [enemy(w), enemy(w), enemy(w)]; w.startMove(enemies[0], 'enemyjab'); w.startMove(enemies[1], 'enemyjab'); enemies[2].think = 0; w.thinkEnemy(enemies[2], STEP); assert.equal(enemies[2].action, null);
  w.enemies = []; w.zone = 2; const boss = enemy(w, 'boss', 1400); boss.hp = 300; ticks(w, 2); assert.equal(boss.phase, 2); assert.equal(w.enemies.filter(e => !e.boss).length, 3);
});
test('cleared zones advance and final wave completion wins', () => {
  const w = arena(); w.cleared = true; w.player.x = 585; w.update(STEP); assert.equal(w.zone, 1); assert.equal(w.checkpoint.zone, 1);
  w.zone = 2; w.wave = 0; w.cleared = false; w.enemies = []; w.waveDelay = 0; w.update(STEP); assert.equal(w.mode, 'won');
});
test('same seed and input stream produce identical combat outcomes', () => {
  const run = () => { const w = new World({ seed: 910 }); for (let i = 0; i < 900; i++) { if (i % 17 === 0) w.command('light'); if (i % 71 === 0) w.command('heavy'); w.player.input.x = i % 120 < 60 ? 1 : -1; w.update(STEP); } return JSON.stringify({ stats: w.stats, heroes: w.heroes.map(h => [h.hp, h.x, h.y]), enemies: w.enemies.map(e => [e.kind, e.hp, e.x]) }); };
  assert.equal(run(), run());
});
