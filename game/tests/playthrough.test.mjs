import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../world.js';
import { STEP, HEROES } from '../data.js';

// Input-only deterministic pilot: no enemy HP edits, invulnerability, skipped waves or free energy.
function pilot(w, frame) {
  const a = w.player;
  if (w.cleared) { a.input = { x: 1, y: a.y < 239 ? 1 : 0 }; return; }
  const threat = w.enemies.find(e => e.hp > 0 && e.action && e.action.t > e.action.move.startup * .75 && e.action.t < e.action.move.startup + e.action.move.active && Math.abs(e.x - a.x) < e.action.move.reach + 8 && Math.abs(e.y - a.y) < e.action.move.depth + 5);
  if (threat && a.dodgeCD <= 0 && !a.action) { a.input = { x: -Math.sign(threat.x - a.x), y: a.y < 205 ? 1 : -1 }; w.command('dodge'); return; }
  const rescue = w.partner.hp <= 0 && !w.enemies.some(e => e.hp > 0 && Math.hypot(e.x - w.partner.x, e.y - w.partner.y) < 95);
  const heal = a.hp < a.maxHp * .6 ? w.pickups.find(p => p.type === 'heal' && Math.hypot(p.x - a.x, p.y - a.y) < 140) : null;
  const target = rescue ? w.partner : heal ?? w.enemies.filter(e => e.hp > 0).sort((b, c) => Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(c.x - a.x, c.y - a.y))[0];
  if (!target) return;
  const dx = target.x - a.x, dy = target.y - a.y;
  a.input = { x: Math.abs(dx) > 25 ? Math.sign(dx) : 0, y: Math.abs(dy) > 4 ? Math.sign(dy) : 0, held: rescue && Math.hypot(dx, dy) < 28 };
  if (dx && Math.sign(dx) !== a.face) a.input.x = Math.sign(dx);
  if (!rescue && !heal && Math.abs(dx) < 50 && Math.abs(dy) < 15) {
    if (a.energy >= 100) w.command('ultimate'); else if (frame % 18 === 0) { const slot=a.skillCD.findIndex(cd=>cd<=0); if(slot>=0 && !a.carried && !a.grab) w.command('skill'+(slot+1)); else w.command(frame % 36 === 0 ? 'heavy' : 'light'); }
    if (w.meter >= 100) w.command('coop');
  }
}
const teams = HEROES.flatMap(a => HEROES.filter(b => b.id !== a.id).map(b => [a.id,b.id]));
for (const team of teams) test(`full encounter progression: ${team.join(' + ')} with autonomous partner`, () => {
  const w = new World({ seed: 2026, ai: 'expert', team });
  const visited = new Set(), events = new Set();
  for (let frame = 0; frame < 60 * 600 && w.mode === 'playing'; frame++) {
    pilot(w, frame); w.update(STEP); visited.add(w.zone);
    assert.ok(w.enemies.filter(e => !e.boss && e.hp > 0).length <= 6);
    for (const e of w.events) events.add(e.type); w.events.length = 0;
    assert.ok(w.heroes.every(h => [h.x, h.y, h.z, h.hp].every(Number.isFinite)));
  }
  assert.equal(w.mode, 'won', JSON.stringify({ zone: w.zone, active: w.active, heroes: w.heroes.map(h => ({ x: h.x, y: h.y, hp: h.hp, stun: h.stun, action: h.action?.id, z: h.z, revive: h.revive, input: h.input })), enemies: w.enemies.filter(e => e.hp > 0).map(e => ({ x: e.x, y: e.y, hp: e.hp, action: e.action?.id })) }));
  assert.deepEqual([...visited], [0, 1, 2]); assert.equal(w.stats.kills, 34); assert.ok(w.stats.relays > 0); assert.ok(events.has('ultimate')); assert.ok(events.has('cinema')); assert.ok(events.has('bossfinish'));
});
