import test from "node:test";
import assert from "node:assert/strict";
import { effects } from "../../src/fx/index.js";
import { createFrame, createFx } from "../../src/core/index.js";
import { ALL_FX, FX_BY_ID, FX_BY_CATEGORY, CATEGORIES, DEFAULT_LOADOUT, searchFx } from "../fx-catalog.js";

test("catalog covers all 244 pixelfx modules with valid metadata", () => {
  const rawIds = Object.keys(effects);
  assert.equal(ALL_FX.length, rawIds.length);
  assert.equal(ALL_FX.length, 244);

  for (const id of rawIds) {
    const spec = FX_BY_ID[id];
    assert.ok(spec, `Missing spec for ${id}`);
    assert.ok(spec.mode, `Missing mode for ${id}`);
    assert.ok(spec.cooldown >= 0, `Invalid cooldown for ${id}`);
  }

  for (const cat of CATEGORIES) {
    assert.ok(FX_BY_CATEGORY[cat.id].length > 0, `Empty category ${cat.id}`);
  }

  for (const id of DEFAULT_LOADOUT) {
    assert.ok(FX_BY_ID[id], `Invalid default loadout fx ${id}`);
  }
});

test("searchFx filters by keyword and category", () => {
  const nukes = searchFx("nuke", "all");
  assert.ok(nukes.some((f) => f.id === "explosions/nuke"));

  const weatherRain = searchFx("rain", "weather");
  assert.ok(weatherRain.some((f) => f.id === "weather/rain"));
  assert.ok(weatherRain.every((f) => f.category === "weather"));
});

test("every single pixelfx module instantiates, updates, and draws cleanly", () => {
  const worldFrame = createFrame(480, 270);
  const screenFrame = createFrame(320, 180);

  for (const spec of ALL_FX) {
    const frame = spec.screenSpace ? screenFrame : worldFrame;
    const opts = spec.screenSpace
      ? { x: spec.category === "transitions" ? 0 : spec.origin[0], y: spec.category === "transitions" ? 0 : spec.origin[1], seed: 3 }
      : { x: 240, y: 180, seed: 3 };
    const inst = createFx(spec.mod, opts);
    inst.update(1 / 30);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
    assert.equal(typeof inst.done(), "boolean");
  }
});
