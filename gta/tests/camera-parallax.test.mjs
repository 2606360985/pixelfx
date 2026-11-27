import test from "node:test";
import assert from "node:assert/strict";
import { WIDTH, HEIGHT, STEP, SCENE_BY_ID } from "../data.js";
import { World } from "../world.js";
import { PARALLAX_LAYERS, computeParallaxOffset, CinematicCamera } from "../camera.js";

test("parallax offsets scale monotonically from ultra-far to close foreground", () => {
  const camX = 500;
  const camY = 10;
  const u = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.ultraFar.x, PARALLAX_LAYERS.ultraFar.y, 1);
  const f = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.far.x, PARALLAX_LAYERS.far.y, 1);
  const m = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.mid.x, PARALLAX_LAYERS.mid.y, 1);
  const n = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.near.x, PARALLAX_LAYERS.near.y, 1);
  const fn = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.fgNear.x, PARALLAX_LAYERS.fgNear.y, 1);
  const fc = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.fgClose.x, PARALLAX_LAYERS.fgClose.y, 1);

  assert.ok(u.x < f.x && f.x < m.x && m.x < n.x && n.x < fn.x && fn.x < fc.x);
  assert.equal(n.x, camX);

  // strength = 0 flattens every layer to near (1.0x)
  const flatFar = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.far.x, PARALLAX_LAYERS.far.y, 0);
  const flatFg = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.fgClose.x, PARALLAX_LAYERS.fgClose.y, 0);
  assert.equal(flatFar.x, camX);
  assert.equal(flatFg.x, camX);

  // strength = 1.45 keeps near at 1.0 and widens separation
  const boostMid = computeParallaxOffset(camX, camY, PARALLAX_LAYERS.mid.x, PARALLAX_LAYERS.mid.y, 1.45);
  assert.ok(boostMid.x < m.x);
});

test("CinematicCamera handles look-ahead, zoom bounds, hero whip-pan, land bounce, and screenToWorld", () => {
  const world = new World(2026);
  const cam = new CinematicCamera();

  // Walk right for 0.6s -> positive velocity look-ahead, non-miniature zoom (< 1.1)
  for (let i = 0; i < 36; i++) {
    world.step(STEP, { x: 1, y: 0 }, false, true);
    cam.update(STEP, world, { x: WIDTH * 0.5, y: HEIGHT * 0.5 });
  }
  const footLead = cam.velLead;
  assert.ok(footLead > 8);
  assert.ok(cam.zoom >= 1.0 && cam.zoom < 1.08);

  // Drive car fast -> stronger look-ahead than walking and wider focal length
  const car = world.vehicles.find((v) => v.type === "convertible");
  assert.ok(car);
  world.player.x = car.x;
  world.player.y = car.y;
  world.toggleVehicle();
  for (let i = 0; i < 45; i++) {
    world.step(STEP, { x: 1, y: 0 }, false, true);
    cam.update(STEP, world, { x: WIDTH * 0.5, y: HEIGHT * 0.5 });
  }
  assert.ok(cam.velLead > footLead);
  assert.ok(cam.zoom >= 1.0 && cam.zoom <= 1.02);

  // Whip-pan & land bounce
  cam.triggerHeroSwitch(200, 340);
  assert.ok(cam.whipTimer > 0);
  assert.notEqual(cam.whipOffset, 0);
  cam.triggerLandBounce(3.0);
  assert.ok(cam.landVel > 0);

  // screenToWorld inverse check at pivot
  const pivotWorld = cam.screenToWorld(WIDTH * 0.5, HEIGHT * 0.58, WIDTH * 0.5, HEIGHT * 0.58);
  assert.ok(Math.abs(pivotWorld.x - (cam.x + WIDTH * 0.5)) < 1e-6);
  assert.ok(Math.abs(pivotWorld.y - (cam.y + HEIGHT * 0.58)) < 1e-6);
});

test("bg1-backed scenes declare valid bg1 layers and non-overlapping street bands", () => {
  const palm = SCENE_BY_ID["palm-avenue"];
  const neon = SCENE_BY_ID["neon-downtown"];
  for (const sc of [palm, neon]) {
    assert.equal(sc.useBg1Layout, true);
    assert.ok(sc.bgImage.endsWith("bg1.png"));
    assert.ok(sc.skyImage.endsWith("bg1_sky.png"));
    assert.ok(sc.streetImage.endsWith("bg1_street.png"));
    assert.ok(sc.roadImage.endsWith("bg1_road.png"));
    assert.ok(sc.sidewalkTop[0] < sc.sidewalkTop[1]);
    assert.ok(sc.sidewalkTop[1] < sc.roadLanes[0]);
    assert.ok(sc.roadLanes[0] < sc.roadLanes[1]);
    assert.ok(sc.roadLanes[1] < sc.sidewalkBottom[0]);
    assert.ok(sc.sidewalkBottom[0] < sc.sidewalkBottom[1]);
  }
});
