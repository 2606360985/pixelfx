import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { posed, skeleton, shortfall, posedParts } from '../../src/core/rig.js';
import { HEROES } from '../data.js';
const fixtures = [
  [{}, '8a18f64f73806ca082da611d8396b7f6db65262d9e255d9c3ed4006f671deb0d'],
  [{ crouch: 5, lean: 4, fx: 15, fy: -25, ffx: 8, fbx: -7 }, '3d992c6cd5abdf0af73ce72f0822353d413eb0ca0e9cb10917debceb14248566'],
  [{ yaw: 1, fx: -5, fy: -40, bx: 7, by: -38 }, '3ea64745f9f2e7db4724abb2f90712db70b5b9e88e0c3b9fa0249114762ac633'],
];
test('legacy poses retain their exact pre-change raster output, even after profiled renders', () => {
  for (const [p, hash] of fixtures) {
    for (const h of HEROES) { posed(p, h.profile); skeleton(p, h.profile); posedParts(p, h.profile); shortfall(p, h.profile); }
    const r = posed(p); const digest = createHash('sha256').update(Buffer.from(r.xs.buffer)).update(Buffer.from(r.ys.buffer)).update(Buffer.from(r.color.buffer)).digest('hex'); assert.equal(digest, hash);
  }
});
test('profiles produce distinct heights and shoulders, use isolated cache entries and finite joints', () => {
  const [a, b] = HEROES.map(h => posed({}, h.profile)); assert.notEqual(a.y0, b.y0); assert.notEqual(a, b); assert.equal(posed({}, HEROES[0].profile), a);
  for (const h of HEROES) { const joints = skeleton({ fx: 13, fy: -25 }, h.profile).joints; assert.ok(Object.values(joints).flat().every(Number.isFinite)); assert.ok(Number.isFinite(shortfall({}, h.profile))); }
});
