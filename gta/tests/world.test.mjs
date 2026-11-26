import test from "node:test";
import assert from "node:assert/strict";
import { STEP } from "../data.js";
import { World } from "../world.js";

function advance(world, seconds, move = { x: 0, y: 0 }, handbrake = false) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) world.step(STEP, move, handbrake);
}

test("dual protagonists switch cleanly, sprint with Shift, and track distinct walk gaits", () => {
  const world = new World(2026);
  assert.equal(world.player.id, "rico");
  assert.equal(world.partner.id, "lumi");
  assert.equal(world.player.gait, "swagger");
  assert.equal(world.partner.gait, "agile");

  const x0 = world.player.x;
  advance(world, 0.5, { x: 1, y: 0 }, false, false);
  const normalDist = world.player.x - x0;
  assert.ok(world.player.walkPhase > 0);

  const x1 = world.player.x;
  for (let i = 0; i < Math.round(0.5 / STEP); i++) {
    world.step(STEP, { x: 1, y: 0 }, false, true);
  }
  const sprintDist = world.player.x - x1;
  assert.ok(sprintDist > normalDist * 1.25);

  world.switchHero();
  assert.equal(world.player.id, "lumi");
  assert.equal(world.partner.id, "rico");

  advance(world, 0.8, { x: 1, y: 0 });
  assert.ok(world.player.x > 250);
  assert.ok(world.partner.x > 220);
});

test("police dispatch stays restrained on minor hit and respects 1-star cap", () => {
  const world = new World(2026);
  const ped = world.peds.find((p) => p.hp > 0 && !p.vehicleId);
  assert.ok(ped);

  // One light hit does NOT immediately trigger 1-star police
  world.damagePed(ped, 20, 40, 0, { fromPlayer: true });
  assert.equal(world.wanted.level, 0);

  // Escalate to 1-star and advance 25s: at most 1 foot officer, 0 cruisers
  world.addCrimeHeat(22);
  assert.equal(world.wanted.level, 1);
  world.wanted.decayTimer = 30;
  advance(world, 25);
  const activeCops = world.peds.filter((p) => p.isPolice && p.hp > 0).length;
  const activeCruisers = world.vehicles.filter((v) => v.spec.isPolice && !v.exploded).length;
  assert.ok(activeCops <= 1);
  assert.equal(activeCruisers, 0);
});

test("cars and mobility tricycles support entering, driving, sidewalk riding, hijacking, and exploding", () => {
  const world = new World(2026);
  const car = world.vehicles.find((v) => v.type === "convertible");
  const trike = world.vehicles.find((v) => v.type === "trike_mobility");
  assert.ok(car && trike);

  // Enter starter tricycle
  world.player.x = trike.x;
  world.player.y = trike.y;
  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, trike.id);

  // Drive tricycle onto upper sidewalk (sidewalkFriendly)
  advance(world, 0.5, { x: 1, y: -1 });
  assert.ok(trike.vx > 60);
  assert.ok(trike.y <= world.scene.sidewalkTop[1]);
  assert.equal(world.honk(), true);

  // Exit tricycle and enter convertible car
  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, null);

  world.player.x = car.x;
  world.player.y = car.y;
  assert.equal(world.toggleVehicle(), true);
  assert.equal(world.player.vehicleId, car.id);
  advance(world, 0.6, { x: 1, y: 0 });
  assert.ok(car.vx > 120);

  // Exit and test hijacking an occupied AI vehicle
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

  // Explode an empty car
  world.toggleVehicle();
  world.damageVehicle(car, 999);
  advance(world, 1.0);
  assert.equal(car.exploded, true);
});

test("all major FX categories affect pedestrians, wanted stars, weather, critters, and pickups", () => {
  const world = new World(2026);
  const targetPed = world.peds.find((p) => !p.vehicleId);
  assert.ok(targetPed);
  const startHp = targetPed.hp;

  // 1. AoE explosion hurts ped & escalates wanted level
  world.castSkill("explosions/big-explosion", targetPed.x, targetPed.y);
  advance(world, 0.25);
  assert.ok(targetPed.hp < startHp || world.pickups.length > 0);
  assert.ok(world.wanted.level >= 1);

  // 2. Status FX attaches to pedestrian
  const ped2 = world.peds.find((p) => p.hp > 0 && !p.vehicleId && p !== targetPed);
  assert.ok(ped2);
  world.player.x = ped2.x - 40;
  world.player.y = ped2.y;
  world.castSkill("status/burning", ped2.x, ped2.y);
  assert.equal(ped2.status?.type, "burning");

  // 3. Frozen immobilizes ped
  world.cooldowns.clear();
  world.castSkill("status/frozen", ped2.x, ped2.y);
  assert.equal(ped2.status?.type, "frozen");
  const frozenX = ped2.x;
  advance(world, 0.3);
  assert.equal(ped2.x, frozenX);

  // 4. Projectile hits target
  const ped3 = world.peds.find((p) => p.hp > 0 && !p.vehicleId && p !== ped2);
  assert.ok(ped3);
  world.player.x = ped3.x - 50;
  world.player.y = ped3.y;
  const hp3 = ped3.hp;
  world.castSkill("projectiles/rocket", ped3.x, ped3.y);
  advance(world, 0.5);
  assert.ok(ped3.hp < hp3);

  // 5. Weather, Critters, Pickups, UI, Moves
  world.castSkill("weather/rain");
  assert.equal(world.weather, "weather/rain");

  world.castSkill("critters/slime", world.player.x + 20, world.player.y);
  assert.equal(world.critters.length, 1);

  const cashBefore = world.cash;
  world.castSkill("pickups/coin-spin", world.player.x, world.player.y);
  advance(world, 0.2);
  assert.ok(world.cash > cashBefore);

  world.castSkill("ui/confetti", world.player.x + 15, world.player.y);
  world.castSkill("moves/pistol-shots", world.player.x + 60, world.player.y);
  advance(world, 0.4);

  // Clear wanted
  world.clearWanted();
  assert.equal(world.wanted.level, 0);
});

test("pedestrian interaction and scene switching with transitions work", () => {
  const world = new World(2026);
  const ped = world.peds.find((p) => p.hp > 0 && !p.vehicleId);
  assert.ok(ped);
  world.player.x = ped.x - 20;
  world.player.y = ped.y;
  assert.equal(world.interact(), true);
  assert.ok(world.bubbles.length >= 1);

  // Scene switch via transition
  assert.equal(world.requestSceneSwitch("neon-downtown", "transitions/glitch-wipe", "left"), true);
  advance(world, 1.9);
  assert.equal(world.sceneId, "neon-downtown");
  assert.equal(world.transition, null);

  // Custom background width updates bounds
  world.setSceneWidth("neon-downtown", 3200);
  assert.equal(world.scene.width, 3200);
});

test("destructible props, elemental chemistry, tricycle nitro, ramp airtime, and trend challenges work", () => {
  const world = new World(2026);
  const hydrant = world.props.find((p) => p.type === "hydrant");
  const barrel = world.props.find((p) => p.type === "barrel");
  const ramp = world.props.find((p) => p.type === "ramp");
  assert.ok(hydrant && barrel && ramp);

  // 1. Smash hydrant -> creates wet ground zone & completes first trend challenge (hydrant_launch)
  const cash0 = world.cash;
  world.damageProp(hydrant, 50, 80);
  assert.equal(hydrant.broken, true);
  assert.ok(world.zones.some((z) => z.kind === "wet"));
  assert.ok(world.cash > cash0);
  assert.equal(world.trend.challenge.id, "wet_shock");

  // 2. Wet ground + lightning triggers conductive surge & completes wet_shock trend
  const wetZone = world.zones.find((z) => z.kind === "wet");
  world.events.length = 0;
  world.castSkill("lightning/chain-lightning", wetZone.x, wetZone.y);
  advance(world, 0.25);
  assert.ok(world.events.some((e) => e.type === "chemistry" && e.kind === "wet_shock"));
  assert.equal(world.trend.challenge.id, "ice_slide");

  // 3. Ice skill creates ice zone and causes vehicle sliding
  world.castSkill("ice/frost-nova", ramp.x - 40, ramp.y);
  advance(world, 0.2);
  assert.ok(world.zones.some((z) => z.kind === "ice"));

  // 4. Verify wet_shock EMP stalled nearby trike, then let EMP expire and test Shift nitro + ramp airtime
  const trike = world.vehicles.find((v) => v.type === "trike_mobility");
  assert.ok(trike);
  assert.ok(trike.empTimer > 0);
  trike.empTimer = 0;
  world.player.x = trike.x;
  world.player.y = trike.y;
  world.toggleVehicle();
  const nitroStart = trike.nitro;
  for (let i = 0; i < 45; i++) world.step(STEP, { x: 1, y: 0 }, false, true);
  assert.ok(trike.nitro < nitroStart);
  assert.ok(trike.vx > trike.spec.maxSpeed);

  // Drive trike onto ramp
  trike.x = ramp.x - 10;
  trike.y = ramp.y;
  trike.vx = 180;
  advance(world, 0.12, { x: 1, y: 0 }, false, true);
  assert.ok(trike.z > 0);

  // 5. Barrel fuse explodes
  world.damageProp(barrel, 50, 0);
  advance(world, 0.35);
  assert.equal(barrel.broken, true);
});
