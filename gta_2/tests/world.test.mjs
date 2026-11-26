import test from "node:test";
import assert from "node:assert/strict";
import { STEP } from "../data.js";
import { World } from "../world.js";

function advance(world, seconds, move = { x: 0, y: 0 }, handbrake = false, sprint = false) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) world.step(STEP, move, handbrake, sprint);
}

test("dual noir protagonists switch cleanly, sprint with Shift, and track distinct walk gaits", () => {
  const world = new World(2026);
  assert.equal(world.player.id, "chen");
  assert.equal(world.partner.id, "lin");
  assert.equal(world.sceneId, "temple-nightmarket");
  assert.equal(world.player.gait, "swagger");
  assert.equal(world.partner.gait, "agile");

  const x0 = world.player.x;
  advance(world, 0.5, { x: 1, y: 0 }, false, false);
  const normalDist = world.player.x - x0;
  assert.ok(world.player.walkPhase > 0);

  const x1 = world.player.x;
  advance(world, 0.5, { x: 1, y: 0 }, false, true);
  const sprintDist = world.player.x - x1;
  assert.ok(sprintDist > normalDist * 1.25);

  world.switchHero();
  assert.equal(world.player.id, "lin");
  assert.equal(world.partner.id, "chen");

  advance(world, 0.8, { x: 1, y: 0 });
  assert.ok(world.player.x > 250);
  assert.ok(world.partner.x > 220);
});

test("police dispatch stays restrained on minor hit and respects 1-star cap", () => {
  const world = new World(2026);
  const ped = world.peds.find((p) => p.hp > 0 && !p.vehicleId);
  assert.ok(ped);

  world.damagePed(ped, 20, 40, 0, { fromPlayer: true });
  assert.equal(world.wanted.level, 0);

  world.addCrimeHeat(22);
  assert.equal(world.wanted.level, 1);
  world.wanted.decayTimer = 30;
  advance(world, 25);
  const activeCops = world.peds.filter((p) => p.isPolice && p.hp > 0 && !p.missionTarget).length;
  const activeCruisers = world.vehicles.filter((v) => v.spec.isPolice && !v.exploded && !v.missionTarget).length;
  assert.ok(activeCops <= 1);
  assert.equal(activeCruisers, 0);
});

test("cars and mobility tricycles support entering, driving, sidewalk riding, hijacking, and exploding", () => {
  const world = new World(2026);
  const car = world.vehicles.find((v) => v.type === "convertible");
  const trike = world.vehicles.find((v) => v.type === "trike_mobility");
  assert.ok(car && trike);

  world.player.x = trike.x;
  world.player.y = trike.y;
  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, trike.id);

  advance(world, 0.5, { x: 1, y: -1 });
  assert.ok(trike.vx > 60);
  assert.ok(trike.y <= world.scene.sidewalkTop[1]);
  assert.equal(world.honk(), true);

  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, null);

  world.player.x = car.x;
  world.player.y = car.y;
  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, car.id);
  advance(world, 0.6, { x: 1, y: 0 });
  assert.ok(car.vx > 120);

  world.toggleVehicle();
  const traffic = world.vehicles.find((v) => v.driver && !v.driver.hero);
  assert.ok(traffic);
  world.player.x = traffic.x;
  world.player.y = traffic.y;
  const oldDriver = traffic.driver;
  assert.equal(world.toggleVehicle(), true);
  assert.equal(traffic.driver, world.player);
  assert.equal(oldDriver.vehicleId, null);
  assert.ok(world.wanted.heat > 0);

  world.toggleVehicle();
  world.damageVehicle(car, 999);
  advance(world, 1.0);
  assert.equal(car.exploded, true);
});

test("progressive FX unlocks block locked skills until chapter unlock or sandbox toggle", () => {
  const world = new World(2026);
  // Chapter 0 starts with nuke locked
  assert.equal(world.story.unlockedChapter, 0);
  assert.equal(world.castSkill("explosions/nuke", 260, 160), false);
  assert.equal(world.equipFx("explosions/nuke", 0), false);

  // Toggling sandboxAllFx immediately unlocks all 244 effects
  world.setSandboxAllFx(true);
  assert.equal(world.equipFx("explosions/nuke", 0), true);
  assert.equal(world.castSkill("explosions/nuke", 260, 160), true);
  advance(world, 0.3);

  // Turning sandbox back off restores chapter gating
  world.setSandboxAllFx(false);
  world.cooldowns.clear();
  assert.equal(world.castSkill("explosions/nuke", 260, 160), false);

  // Chapter 4 unlocks all effects permanently
  world.applyStoryEffects({ unlockChapter: 4 });
  assert.equal(world.castSkill("explosions/nuke", 260, 160), true);
});

test("story mission spawns targets, tracks progress, and queues next VN scene", () => {
  const world = new World(2026);
  assert.equal(world.startMission("m0_alley"), true);
  const targets = world.peds.filter((p) => p.missionTarget && p.hp > 0);
  assert.equal(targets.length, 3);
  assert.equal(world.story.missionGoal, 3);

  for (const t of targets) {
    world.damagePed(t, 999, 0, 0, { fromPlayer: true });
  }
  assert.equal(world.story.activeMissionId, null);
  assert.equal(world.story.unlockedChapter, 1);
  assert.equal(world.story.pendingVnSceneId, "ch1_open");
  assert.ok(world.story.completedMissions.includes("m0_alley"));
});

test("sandbox mode enables all major FX categories and scene switching", () => {
  const world = new World(2026);
  world.setSandboxAllFx(true);
  const targetPed = world.peds.find((p) => !p.vehicleId);
  assert.ok(targetPed);

  world.castSkill("status/frozen", targetPed.x, targetPed.y);
  assert.equal(targetPed.status?.type, "frozen");
  const fx = targetPed.x;
  advance(world, 0.25);
  assert.equal(targetPed.x, fx);

  world.castSkill("critters/slime", world.player.x + 20, world.player.y);
  assert.equal(world.critters.length, 1);

  assert.equal(world.requestSceneSwitch("kowloon-cbd", "transitions/glitch-wipe", "left"), true);
  advance(world, 1.9);
  assert.equal(world.sceneId, "kowloon-cbd");
  assert.equal(world.transition, null);
});
