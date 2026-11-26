import { posed, skeleton } from "../src/core/rig.js";
import { poseAt, createFrame, createFx, composite, hex, scale, Rng } from "../src/core/index.js";
import { WIDTH, HEIGHT } from "./data.js";
import { FX_BY_ID } from "./fx-catalog.js";
import { dressProtagonist, dressPedestrian, drawVehicle, drawProp } from "./art.js";
import { SceneManager } from "./scenes.js";
import { clamp } from "./world.js";

const INK = "#101824";
const TAU = Math.PI * 2;
const PIVOT_X = WIDTH * 0.5;
const PIVOT_Y = HEIGHT * 0.58;

const casualIdle = { crouch: 0.5, lean: 0, fx: -2, fy: -14, bx: 4, by: -15, ffx: -2, ffy: -2, fbx: 3, fby: -2 };
const seatedPose = { crouch: 10, lean: 2, fx: 13, fy: -21, bx: 11, by: -20, ffx: 10, ffy: -3, fbx: 4, fby: -3 };
const punchPose = { ...casualIdle, crouch: 2, lean: 7, fx: 21, fy: -25, bx: -4, by: -21, ffx: 9, fbx: -6 };
const castPose = { ...casualIdle, crouch: 1.5, lean: 4, fx: 18, fy: -29, bx: 14, by: -27 };
const hurtPose = { ...casualIdle, lean: -8, crouch: 6, fx: 2, fy: -15, bx: 5, by: -16 };

const GAITS = {
  swagger: { stride: 7.2, lift: 3.8, bob: 1.3, baseCrouch: 0.6, lean: 1.5, armSwing: 6.2, armY: -14.2, armLift: 1.4, turn: 0.55 },
  agile: { stride: 7.6, lift: 4.5, bob: 1.6, baseCrouch: 1.2, lean: 2.5, armSwing: 7.0, armY: -15.2, armLift: 2.0, turn: 0.6 },
  sprint: { stride: 9.2, lift: 5.8, bob: 2.1, baseCrouch: 3.4, lean: 5.2, armSwing: 8.2, armY: -17.5, armLift: 3.2, turn: 0.5 },
  stroll: { stride: 5.4, lift: 2.6, bob: 0.9, baseCrouch: 0.6, lean: 0.5, armSwing: 4.0, armY: -14.0, armLift: 0.8, turn: 0.62 },
  groove: { stride: 6.8, lift: 3.6, bob: 2.2, baseCrouch: 1.8, lean: -0.5, armSwing: 5.8, armY: -14.8, armLift: 1.8, turn: 0.58 },
  tough: { stride: 6.6, lift: 3.2, bob: 1.4, baseCrouch: 1.6, lean: 2.0, armSwing: 5.2, armY: -15.2, armLift: 1.2, turn: 0.45 },
  patrol: { stride: 6.4, lift: 3.4, bob: 1.0, baseCrouch: 0.2, lean: 0.8, armSwing: 4.8, armY: -14.5, armLift: 1.0, turn: 0.52 },
  panic_run: { stride: 8.8, lift: 5.5, bob: 2.2, baseCrouch: 2.6, lean: 4.0, armSwing: 6.5, armY: -22.5, armLift: 4.2, turn: 0.65 },
};

function actorPose(a, time) {
  if (a.hp <= 0) return { ...hurtPose, crouch: 15, lean: -13, ffx: 12, fbx: -12, fy: -5, by: -7 };
  if (a.vehicleId) return seatedPose;
  if (a.action) {
    const t = a.action.t / Math.max(0.05, a.action.duration);
    const peak = a.action.kind === "cast" ? castPose : punchPose;
    return poseAt([[0, casualIdle], [0.25, peak, "snap"], [0.7, peak], [1, casualIdle]], Math.min(1, t));
  }
  if (a.z > 0) return { ...casualIdle, crouch: 3, ffx: 7, ffy: -6, fbx: -6, fby: -8, fx: -4, fy: -19, bx: 7, by: -20 };
  if (a.landTimer > 0) return { ...casualIdle, crouch: 5.5, lean: 2, ffx: 3, fbx: -3, fx: -5, fy: -14, bx: 6, by: -14 };

  const spd = Math.hypot(a.vx || 0, a.vy || 0);
  if (spd > 6) {
    const gaitId = a.aiState === "panic" ? "panic_run" : a.sprinting ? "sprint" : a.gait || "stroll";
    const g = GAITS[gaitId] || GAITS.stroll;
    const steps = 12;
    const rawPhase = (((a.walkPhase || 0) % TAU) + TAU) % TAU;
    const qPhase = (Math.floor((rawPhase / TAU) * steps) / steps) * TAU;
    const s = Math.sin(qPhase);
    const c = Math.cos(qPhase);

    return {
      crouch: g.baseCrouch + g.bob * (1 - Math.abs(s)),
      lean: g.lean,
      twist: -s * 0.6,
      turn: g.turn,
      ffx: 0.5 + s * g.stride,
      fbx: 0.5 - s * g.stride,
      ffy: -2 - Math.max(0, c) * g.lift,
      fby: -2 - Math.max(0, -c) * g.lift,
      toeF: s < -0.55,
      toeB: s > 0.55,
      fx: -1 - s * g.armSwing,
      fy: g.armY - Math.max(0, -s) * g.armLift,
      bx: 3 + s * g.armSwing,
      by: g.armY - Math.max(0, s) * g.armLift,
    };
  }

  const breath = Math.floor(time * 2 + (a.id?.length || a.id || 0)) % 2 ? 0.5 : 0;
  if (a.id === "rico") {
    return { ...casualIdle, crouch: 0.6 + breath, turn: 0.52, fx: -3, fy: -14, bx: 5, by: -14.5, ffx: -3, fbx: 4 };
  }
  if (a.id === "lumi") {
    return { ...casualIdle, crouch: 0.8 + breath, lean: -0.5, turn: 0.68, fx: -4, fy: -15, bx: 5, by: -16, ffx: -2, fbx: 3 };
  }
  if (a.isPolice) {
    return { ...casualIdle, crouch: 0.2 + breath, turn: 0.5, fx: -1, fy: -14, bx: 4, by: -14 };
  }
  return { ...casualIdle, crouch: 0.6 + breath };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    this.scenes = new SceneManager();
    this.camera = 0;
    this.aimLead = 0;
    this.zoom = 1.1;
    this.zoomPunch = 0;
    this.chromaTimer = 0;
    this.postProcess = true;

    this.fx = [];
    this.statusFx = new Map();
    this.critterFx = new Map();
    this.pickupFx = new Map();
    this.weatherFx = null;
    this.weatherId = null;
    this.transitionFx = null;
    this.transitionKey = null;
    this.transitionFxId = null;

    this.labels = [];
    this.bits = [];
    this.decals = [];
    this.spriteCache = new WeakMap();
    this.elapsed = 0;
    this.rng = new Rng(99);

    this.sceneCanvas = document.createElement("canvas");
    this.sceneCanvas.width = WIDTH;
    this.sceneCanvas.height = HEIGHT;
    this.sCtx = this.sceneCanvas.getContext("2d", { alpha: false });

    this.bloomCanvas = document.createElement("canvas");
    this.bloomCanvas.width = 120;
    this.bloomCanvas.height = 68;
    this.bloomCtx = this.bloomCanvas.getContext("2d");

    this.blurSmall = document.createElement("canvas");
    this.blurSmall.width = 96;
    this.blurSmall.height = 54;
    this.blurSmallCtx = this.blurSmall.getContext("2d");

    this.blurCanvas = document.createElement("canvas");
    this.blurCanvas.width = 160;
    this.blurCanvas.height = 90;
    this.blurCtx = this.blurCanvas.getContext("2d");

    this.frame = createFrame(WIDTH, HEIGHT);
    this.img = new ImageData(WIDTH, HEIGHT);
    this.fxCanvas = document.createElement("canvas");
    this.fxCanvas.width = WIDTH;
    this.fxCanvas.height = HEIGHT;
    this.fxCtx = this.fxCanvas.getContext("2d");

    this.screenFrame = createFrame(320, 180);
    this.screenImg = new ImageData(320, 180);
    this.screenCanvas = document.createElement("canvas");
    this.screenCanvas.width = 320;
    this.screenCanvas.height = 180;
    this.screenCtx = this.screenCanvas.getContext("2d");
  }

  reset() {
    this.fx = [];
    this.statusFx.clear();
    this.critterFx.clear();
    this.pickupFx.clear();
    this.weatherFx = null;
    this.weatherId = null;
    this.transitionFx = null;
    this.transitionKey = null;
    this.transitionFxId = null;
    this.labels = [];
    this.bits = [];
    this.decals = [];
    this.camera = 0;
    this.zoom = 1.1;
    this.zoomPunch = 0;
    this.chromaTimer = 0;
  }

  screenToWorld(sx, sy) {
    const z = this.zoom || 1;
    const wx = PIVOT_X + (sx - PIVOT_X) / z;
    const wy = PIVOT_Y + (sy - PIVOT_Y) / z;
    return { x: this.camera + wx, y: wy };
  }

  text(c, s, x, y, color = "#fff2d1", size = 8, align = "left") {
    c.font = `bold ${size}px "Microsoft YaHei", sans-serif`;
    c.textAlign = align;
    c.textBaseline = "alphabetic";
    c.fillStyle = "#0a0f1a";
    c.fillText(s, Math.round(x) + 1, Math.round(y) + 1);
    c.fillStyle = color;
    c.fillText(s, Math.round(x), Math.round(y));
  }

  addFx(fxId, x, y, world, opts = {}) {
    const spec = FX_BY_ID[fxId];
    if (!spec || spec.screenSpace) return;
    if (this.fx.length >= 22) this.fx.shift();
    try {
      const inst = createFx(spec.mod, {
        seed: world.nextId + Math.floor(world.time * 60),
        light: 1,
        ...opts,
      });
      this.fx.push({
        fxId,
        x,
        y,
        inst,
        t: 0,
        maxDur: spec.loop ? Math.min(spec.duration, 2.2) : spec.duration,
      });
    } catch {
      // Ignore malformed individual effect options gracefully
    }
  }

  particles(x, y, n, color) {
    for (let i = 0; i < n && this.bits.length < 180; i++) {
      const a = this.rng.range(0, 6.28);
      const s = this.rng.range(24, 110);
      this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 36, life: 0.35 + (i / n) * 0.35, color });
    }
  }

  addDecal(kind, x, y, radius = 14) {
    if (this.decals.length >= 75) this.decals.shift();
    this.decals.push({ kind, x, y, radius, life: kind === "scorch" ? 16 : 9, maxLife: kind === "scorch" ? 16 : 9 });
  }

  handle(events, world) {
    for (const e of events) {
      if (e.type === "fx") {
        this.addFx(e.fxId, e.x, e.y, world, { flip: !!e.flip, angle: e.angle || 0 });
      } else if (e.type === "damage") {
        this.labels.push({
          text: `-${e.amount}`,
          x: e.x,
          y: e.y,
          life: 0.7,
          color: e.hero ? "#ff6884" : "#ffd670",
        });
        this.particles(e.x, e.y + 8, 5, e.hero ? "#ff7b93" : "#ffe08c");
      } else if (e.type === "pickup") {
        const msg = e.kind === "cash" ? `+$${e.amount}` : e.kind === "heal" ? `+${e.amount} HP` : "SHIELD!";
        this.labels.push({ text: msg, x: e.x, y: e.y - 16, life: 0.9, color: e.kind === "cash" ? "#7dffb3" : "#7eeaff" });
      } else if (e.type === "explosion" || e.type === "impactPulse") {
        this.particles(e.x, e.y - 8, 28, "#ff9d4d");
        this.zoomPunch = Math.max(this.zoomPunch, 0.038);
        this.chromaTimer = Math.max(this.chromaTimer, 0.13);
      } else if (e.type === "decal") {
        this.addDecal(e.kind, e.x, e.y, e.radius);
      } else if (e.type === "land") {
        this.particles(e.x, e.y, 6, "#d9c6ab");
      } else if (e.type === "ramp") {
        this.labels.push({ text: "AIRTIME!", x: e.x, y: e.y - 34, life: 1.0, color: "#42f2dc" });
        this.zoomPunch = Math.max(this.zoomPunch, 0.025);
      } else if (e.type === "chemistry") {
        this.labels.push({ text: e.text, x: e.x, y: e.y - 32, life: 1.2, color: "#68f2ff" });
        this.chromaTimer = Math.max(this.chromaTimer, 0.11);
      } else if (e.type === "propBreak" || e.type === "hydrant") {
        this.particles(e.x, e.y - 8, 12, e.type === "hydrant" ? "#7eeaff" : "#ff9ec4");
      }
    }
  }

  tick(dt, world) {
    this.elapsed += dt;
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 0.25);
    this.chromaTimer = Math.max(0, this.chromaTimer - dt);

    for (const f of this.fx) {
      f.inst.update(dt);
      f.t += dt;
    }
    this.fx = this.fx.filter((f) => !f.inst.done() && f.t < f.maxDur);

    if (world.weather !== this.weatherId) {
      this.weatherId = world.weather;
      const spec = world.weather ? FX_BY_ID[world.weather] : null;
      this.weatherFx = spec
        ? createFx(spec.mod, {
            x: spec.origin?.[0] ?? 160,
            y: spec.origin?.[1] ?? 170,
            seed: 7,
          })
        : null;
    }
    if (this.weatherFx) this.weatherFx.update(dt);

    if (world.transition) {
      this.transitionKey = world.transition;
      if (!this.transitionFx || this.transitionFxId !== world.transition.fxId) {
        this.transitionFxId = world.transition.fxId;
        const spec = FX_BY_ID[world.transition.fxId];
        this.transitionFx = spec ? createFx(spec.mod, { x: 0, y: 0, seed: 3 }) : null;
      }
      if (this.transitionFx) this.transitionFx.update(dt);
    } else {
      this.transitionFx = null;
      this.transitionKey = null;
      this.transitionFxId = null;
    }

    const activePedIds = new Set();
    for (const ped of world.peds) {
      if (ped.hp > 0 && ped.status && !ped.vehicleId) {
        activePedIds.add(ped.id);
        let entry = this.statusFx.get(ped.id);
        if (!entry || entry.fxId !== ped.status.fxId) {
          const spec = FX_BY_ID[ped.status.fxId];
          if (spec && this.statusFx.size < 10) {
            entry = { fxId: ped.status.fxId, inst: createFx(spec.mod, { seed: ped.id }) };
            this.statusFx.set(ped.id, entry);
          }
        }
        if (entry) entry.inst.update(dt);
      }
    }
    for (const id of this.statusFx.keys()) {
      if (!activePedIds.has(id)) this.statusFx.delete(id);
    }

    const critterIds = new Set();
    for (const cr of world.critters) {
      critterIds.add(cr.id);
      let entry = this.critterFx.get(cr.id);
      if (!entry) {
        const spec = FX_BY_ID[cr.fxId];
        if (spec) {
          entry = { inst: createFx(spec.mod, { seed: cr.id }) };
          this.critterFx.set(cr.id, entry);
        }
      }
      if (entry) entry.inst.update(dt);
    }
    for (const id of this.critterFx.keys()) {
      if (!critterIds.has(id)) this.critterFx.delete(id);
    }

    const pickupIds = new Set();
    for (const pk of world.pickups) {
      pickupIds.add(pk.id);
      let entry = this.pickupFx.get(pk.id);
      if (!entry) {
        const spec = FX_BY_ID[pk.fxId];
        if (spec) {
          entry = { inst: createFx(spec.mod, { seed: pk.id }) };
          this.pickupFx.set(pk.id, entry);
        }
      }
      if (entry) entry.inst.update(dt);
    }
    for (const id of this.pickupFx.keys()) {
      if (!pickupIds.has(id)) this.pickupFx.delete(id);
    }

    this.bits.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 200 * dt;
      b.life -= dt;
    });
    this.bits = this.bits.filter((b) => b.life > 0);
    this.labels.forEach((l) => {
      l.life -= dt;
      l.y -= 14 * dt;
    });
    this.labels = this.labels.filter((l) => l.life > 0);
    this.decals.forEach((d) => {
      d.life -= dt;
    });
    this.decals = this.decals.filter((d) => d.life > 0);
  }

  actorSprite(a, pose) {
    const rig = posed(pose, a.profile);
    let entry = this.spriteCache.get(rig);
    const key = `${a.id || a.type}_${a.color}`;
    if (!entry) {
      entry = new Map();
      this.spriteCache.set(rig, entry);
    }
    if (entry.has(key)) return entry.get(key);

    const pad = 12;
    const w = rig.x1 - rig.x0 + pad * 2;
    const h = rig.y1 - rig.y0 + pad * 2;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const context = cv.getContext("2d");
    const img = context.createImageData(w, h);
    const pixels = new Uint32Array(img.data.buffer);
    const shirt = hex(a.color);
    const pants = hex(a.dark);
    const skin = hex(a.skin || "#e2b28a");
    const shoe = a.shoeColor ? hex(a.shoeColor) : pants;

    for (let i = 0; i < rig.n; i++) {
      const x = rig.xs[i] - rig.x0 + pad;
      const y = rig.ys[i] - rig.y0 + pad;
      const part = rig.part[i];
      const c = rig.color[i];
      const luminance = ((c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255)) / 3 / 230;
      let base;
      if (part === 18 || part === 22) {
        base = shoe;
      } else if (part >= 15) {
        base = a.shorts && (part === 16 || part === 17 || part === 20 || part === 21) ? skin : pants;
      } else if (part === 5 || part === 6 || part === 4 || part === 10 || part === 14) {
        base = skin;
      } else {
        base = shirt;
      }
      if (part === 5 && rig.ys[i] < -34) base = hex(a.hair || "#23252c");
      pixels[y * w + x] = rig.ink[i] ? hex(INK) : scale(base, Math.max(0.42, luminance));
    }
    context.putImageData(img, 0, 0);
    context.save();
    context.translate(-rig.x0 + pad, -rig.y0 + pad);
    const joints = skeleton(pose, a.profile).joints;
    if (a.hero) dressProtagonist(context, a, joints);
    else dressPedestrian(context, a, joints);
    context.restore();

    const result = { canvas: cv, x: rig.x0 - pad, y: rig.y0 - pad };
    entry.set(key, result);
    return result;
  }

  drawActor(c, a, world) {
    if (!a.hero && a.hp <= 0 && Math.floor(a.deathAge * 14) % 2) return;
    const x = Math.round(a.x - this.camera);
    const y = Math.round(a.y - a.z);
    if (x < -40 || x > WIDTH + 40) return;

    c.save();
    c.globalAlpha = 0.45;
    c.fillStyle = "#0a101b";
    c.beginPath();
    c.ellipse(x, a.y + 1, a.hero ? 10 : 8, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    if (a.hero && world.player === a) {
      c.save();
      c.strokeStyle = "#4ff2dc";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(x, a.y + 1, 12, 4, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    const pose = actorPose(a, world.time);
    const sprite = this.actorSprite(a, pose);
    c.save();
    c.translate(x, y);
    c.scale(a.face, 1);
    if (a.invuln > 0 && Math.floor(world.time * 16) % 2) c.globalAlpha = 0.5;
    c.drawImage(sprite.canvas, sprite.x, sprite.y);
    c.restore();

    if (a.hero && a.shield > 0) {
      c.save();
      c.strokeStyle = "#62f4ff";
      c.globalAlpha = 0.55;
      c.beginPath();
      c.ellipse(x, y - 16, 15, 22, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    if (a.hero) {
      if (world.player === a) {
        const bob = Math.round(Math.sin(world.time * 5) * 1);
        const my = y - 43 + bob;
        c.fillStyle = "#101824";
        c.fillRect(x - 4, my - 3, 8, 5);
        c.fillStyle = "#4ff2dc";
        c.fillRect(x - 3, my - 2, 6, 2);
        c.fillRect(x - 2, my, 4, 1);
        c.fillRect(x - 1, my + 1, 2, 1);
      } else {
        this.text(c, a.name, x, y - 40, "#ffd68c", 6, "center");
      }
    } else if (a.hp > 0 && (a.hp < a.maxHp || a.isPolice)) {
      const col = a.isPolice ? "#4cb4ff" : "#ff7585";
      c.fillStyle = "#121a28";
      c.fillRect(x - 11, y - 40, 22, 3);
      c.fillStyle = col;
      c.fillRect(x - 11, y - 40, Math.round((a.hp / a.maxHp) * 22), 2);
    }
  }

  drawVehicleEntity(c, v, world) {
    const vx = Math.round(v.x - this.camera);
    const vy = Math.round(v.y - v.z);
    if (vx < -80 || vx > WIDTH + 80) return;

    c.save();
    c.translate(vx, vy);
    drawVehicle(c, v, world.time, (ctx, bob) => {
      const riders = [
        { actor: v.driver, off: v.spec.seatOffset },
        { actor: v.passenger, off: v.spec.passengerOffset },
      ];
      for (const { actor, off } of riders) {
        if (!actor || !off) continue;
        const spr = this.actorSprite({ ...actor, face: 1 }, seatedPose);
        ctx.drawImage(spr.canvas, Math.round(off.x + spr.x), Math.round(off.y + bob + spr.y + 18));
      }
    });
    c.restore();

    if (v.empTimer > 0) {
      this.text(c, "⚡ EMP", vx, vy - 28, "#7cf4ff", 7, "center");
    } else if (v.sliding) {
      this.text(c, "❄ 打滑", vx, vy - 28, "#a6f0ff", 6, "center");
    } else if (v.hp < v.maxHp * 0.4 && !v.exploded) {
      this.text(c, "⚠ 冒烟", vx, vy - 28, "#ff9955", 6, "center");
    }
  }

  drawWorldFx(c, layer, world) {
    if (!this.fx.length && !(layer === "front" && (this.statusFx.size || this.critterFx.size || this.pickupFx.size))) return;
    const f = this.frame;
    f.color.fill(0);
    f.light.fill(0);

    for (const fx of this.fx) {
      fx.inst.options.x = fx.x - this.camera;
      fx.inst.options.y = fx.y;
      fx.inst.draw(f, layer);
    }

    if (layer === "front") {
      for (const [pedId, entry] of this.statusFx.entries()) {
        const ped = world.peds.find((p) => p.id === pedId);
        if (!ped || ped.hp <= 0) continue;
        entry.inst.options.x = ped.x - this.camera;
        entry.inst.options.y = ped.y - ped.z;
        entry.inst.draw(f, "front");
      }
      for (const cr of world.critters) {
        const entry = this.critterFx.get(cr.id);
        if (!entry) continue;
        entry.inst.options.x = cr.x - this.camera;
        entry.inst.options.y = cr.y - cr.z;
        entry.inst.options.flip = cr.face < 0;
        entry.inst.draw(f, "front");
      }
      for (const pk of world.pickups) {
        const entry = this.pickupFx.get(pk.id);
        if (!entry) continue;
        entry.inst.options.x = pk.x - this.camera;
        entry.inst.options.y = pk.y - pk.z;
        entry.inst.draw(f, "front");
      }
    }

    composite(f, this.img.data);
    this.fxCtx.putImageData(this.img, 0, 0);
    c.drawImage(this.fxCanvas, 0, 0);
  }

  drawScreenFx(c, inst) {
    if (!inst) return;
    const f = this.screenFrame;
    f.color.fill(0);
    f.light.fill(0);
    inst.draw(f);
    composite(f, this.screenImg.data);
    this.screenCtx.putImageData(this.screenImg, 0, 0);
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(this.screenCanvas, 0, 0, WIDTH, HEIGHT);
    c.restore();
  }

  applyPostProcessing(world) {
    const out = this.ctx;
    const sc = world.scene;

    // 1. Additive Neon Bloom Pass
    this.bloomCtx.clearRect(0, 0, 120, 68);
    this.bloomCtx.imageSmoothingEnabled = true;
    this.bloomCtx.drawImage(this.canvas, 0, 0, 120, 68);

    out.save();
    out.globalCompositeOperation = "lighter";
    out.globalAlpha = sc.ambient === "neon" ? 0.2 : 0.14;
    out.imageSmoothingEnabled = true;
    out.drawImage(this.bloomCanvas, 0, 0, WIDTH, HEIGHT);
    out.restore();

    // 2. Tilt-Shift Miniature Micro-Lens (bokeh on extreme top sky & bottom margin, razor-sharp street)
    this.blurSmallCtx.imageSmoothingEnabled = true;
    this.blurSmallCtx.drawImage(this.canvas, 0, 0, 96, 54);
    this.blurCtx.imageSmoothingEnabled = true;
    this.blurCtx.drawImage(this.blurSmall, 0, 0, 160, 90);

    out.save();
    out.beginPath();
    out.rect(0, 0, WIDTH, 34);
    out.clip();
    out.globalAlpha = 0.65;
    out.imageSmoothingEnabled = true;
    out.drawImage(this.blurCanvas, 0, 0, WIDTH, HEIGHT);
    out.restore();

    out.save();
    out.beginPath();
    out.rect(0, 242, WIDTH, 28);
    out.clip();
    out.globalAlpha = 0.62;
    out.imageSmoothingEnabled = true;
    out.drawImage(this.blurCanvas, 0, 0, WIDTH, HEIGHT);
    out.restore();

    // 3. Impact Chromatic Split on heavy explosions / chemistry surges
    if (this.chromaTimer > 0) {
      out.save();
      out.globalCompositeOperation = "lighter";
      out.globalAlpha = 0.14;
      out.drawImage(this.bloomCanvas, -3, 0, WIDTH, HEIGHT);
      out.drawImage(this.bloomCanvas, 3, 0, WIDTH, HEIGHT);
      out.restore();
    }

    // 4. Subtle miniature lens vignette
    const grad = out.createRadialGradient(WIDTH / 2, HEIGHT * 0.52, WIDTH * 0.28, WIDTH / 2, HEIGHT * 0.52, WIDTH * 0.68);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(8,10,20,0.28)");
    out.fillStyle = grad;
    out.fillRect(0, 0, WIDTH, HEIGHT);
  }

  render(world, aimScreen = { x: 240, y: 160 }) {
    const sc = world.scene;
    const pl = world.player;
    const veh = pl.vehicleId ? world.vehicles.find((v) => v.id === pl.vehicleId) : null;

    let targetZoom = 1.11;
    if (veh && !veh.exploded) {
      const spd = Math.abs(veh.vx);
      targetZoom = veh.nitroActive || veh.z > 4 || spd > 145 ? 1.0 : 1.03;
    }
    targetZoom += this.zoomPunch;
    this.zoom += (targetZoom - this.zoom) * 0.1;

    const leadTarget = ((aimScreen.x - WIDTH * 0.5) / (WIDTH * 0.5)) * 18;
    this.aimLead += (leadTarget - this.aimLead) * 0.08;
    const targetCam = clamp(pl.x - WIDTH * 0.44 + this.aimLead, 0, Math.max(0, sc.width - WIDTH));
    this.camera += (targetCam - this.camera) * 0.16;

    const c = this.sCtx;
    c.imageSmoothingEnabled = false;
    c.save();

    if (world.shake > 0.2) {
      c.translate(Math.round(Math.sin(this.elapsed * 92) * world.shake), Math.round(Math.cos(this.elapsed * 67) * world.shake * 0.6));
    }

    this.scenes.draw(c, world.sceneId, this.camera, this.elapsed);

    // Persistent road decals
    for (const d of this.decals) {
      const dx = Math.round(d.x - this.camera);
      if (dx < -50 || dx > WIDTH + 50) continue;
      c.save();
      c.globalAlpha = Math.min(0.65, (d.life / d.maxLife) * 0.65);
      if (d.kind === "scorch") {
        c.fillStyle = "#141016";
        c.beginPath();
        c.ellipse(dx, d.y, d.radius, Math.max(4, d.radius * 0.35), 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillStyle = "#181c26";
        c.fillRect(dx - 4, d.y - 1, 8, 2);
        c.fillRect(dx - 4, d.y + 3, 8, 2);
      }
      c.restore();
    }

    // Elemental ground zones
    for (const z of world.zones) {
      const zx = Math.round(z.x - this.camera);
      if (zx < -90 || zx > WIDTH + 90) continue;
      c.save();
      c.globalAlpha = Math.min(0.55, (z.life / z.maxLife) * 0.7);
      c.fillStyle = z.kind === "ice" ? "#a6f4ff" : "#228fa8";
      c.beginPath();
      c.ellipse(zx, z.y, z.radius * 0.85, z.radius * 0.28, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = z.kind === "ice" ? "#ffffff" : "#6cf0ff";
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }

    for (const d of sc.doors) {
      const dx = Math.round(d.x - this.camera);
      if (dx < -40 || dx > WIDTH + 40) continue;
      c.fillStyle = "#38e0c488";
      c.fillRect(dx - 14, d.y - 4, 28, 3);
      if (Math.hypot(pl.x - d.x, pl.y - d.y) < 55) {
        this.text(c, `[E] ${d.label}`, dx, d.y - 12, "#8cfff0", 7, "center");
      }
    }

    this.drawWorldFx(c, "back", world);

    // Depth-sorted entities (props, vehicles, actors)
    const drawables = [];
    for (const prop of world.props) {
      if (prop.broken && prop.type !== "hydrant") continue;
      const px = Math.round(prop.x - this.camera);
      if (px < -40 || px > WIDTH + 40) continue;
      drawables.push({
        y: prop.y,
        draw: () => {
          c.save();
          c.translate(px, Math.round(prop.y - prop.z));
          drawProp(c, prop, world.time);
          c.restore();
        },
      });
    }
    for (const v of world.vehicles) {
      if (!v.exploded) drawables.push({ y: v.y, draw: () => this.drawVehicleEntity(c, v, world) });
    }
    for (const h of world.heroes) {
      if (!h.vehicleId) drawables.push({ y: h.y, draw: () => this.drawActor(c, h, world) });
    }
    for (const ped of world.peds) {
      if (!ped.vehicleId) drawables.push({ y: ped.y, draw: () => this.drawActor(c, ped, world) });
    }
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    for (const pr of world.projectiles) {
      const px = Math.round(pr.x - this.camera);
      const py = Math.round(pr.y - pr.z);
      c.save();
      c.translate(px, py);
      c.rotate(pr.angle || 0);
      c.fillStyle = pr.ownerPolice ? "#ff5268" : pr.explosive ? "#ffaa3b" : "#6df2ff";
      c.fillRect(-5, -2, 10, 4);
      c.fillStyle = "#ffffff";
      c.fillRect(1, -1, 4, 2);
      c.restore();
    }

    this.drawWorldFx(c, "front", world);

    for (const b of this.bits) {
      c.fillStyle = b.color;
      c.fillRect(Math.round(b.x - this.camera), Math.round(b.y), 2, 2);
    }
    this.scenes.drawForeground(c, world.sceneId, this.camera);

    c.restore();

    if (this.weatherFx) this.drawScreenFx(c, this.weatherFx);

    for (const b of world.bubbles) {
      const bx = Math.round(b.x - this.camera);
      if (bx < -40 || bx > WIDTH + 40) continue;
      const w = Math.min(180, b.text.length * 7 + 14);
      c.fillStyle = "#0e1524dd";
      c.fillRect(bx - w / 2, b.y - 12, w, 13);
      c.fillStyle = b.color;
      c.fillRect(bx - w / 2, b.y - 12, 2, 13);
      this.text(c, b.text, bx, b.y - 3, b.color, 7, "center");
    }

    for (const l of this.labels) {
      c.save();
      c.globalAlpha = Math.min(1, l.life * 3);
      this.text(c, l.text, l.x - this.camera, l.y, l.color, 8, "center");
      c.restore();
    }

    if (!pl.vehicleId) {
      const nearVeh = world.vehicles.find((v) => !v.exploded && Math.hypot(v.x - pl.x, (v.y - pl.y) * 1.4) < 52);
      if (nearVeh) {
        const vx = Math.round(nearVeh.x - this.camera);
        this.text(c, `[F] ${nearVeh.driver ? "抢车" : "驾驶"} ${nearVeh.spec.shortName}`, vx, nearVeh.y - 30, "#7effea", 7, "center");
      } else {
        const nearPed = world.peds.find((ped) => ped.hp > 0 && !ped.vehicleId && Math.hypot(ped.x - pl.x, ped.y - pl.y) < 52);
        if (nearPed) {
          this.text(c, `[E] ${nearPed.isVendor ? "购买/补给" : "交谈"}`, Math.round(nearPed.x - this.camera), nearPed.y - 45, "#ffe494", 7, "center");
        }
      }
    }

    if (this.camera < 30 && sc.exits.left) {
      this.text(c, "◀ 切换街区", 8, 138, "#72ffe8", 7, "left");
    }
    if (this.camera > sc.width - WIDTH - 30 && sc.exits.right) {
      this.text(c, "切换街区 ▶", WIDTH - 8, 138, "#72ffe8", 7, "right");
    }

    // Zoomed blit onto main canvas
    const out = this.ctx;
    out.imageSmoothingEnabled = false;
    out.save();
    out.translate(PIVOT_X, PIVOT_Y);
    out.scale(this.zoom, this.zoom);
    out.drawImage(this.sceneCanvas, -PIVOT_X, -PIVOT_Y);
    out.restore();

    if (this.postProcess) {
      this.applyPostProcessing(world);
    }

    const ax = Math.round(aimScreen.x);
    const ay = Math.round(aimScreen.y);
    out.strokeStyle = "#4ff2dc";
    out.lineWidth = 1;
    out.strokeRect(ax - 4, ay - 4, 8, 8);
    out.fillStyle = "#ff5c9e";
    out.fillRect(ax, ay, 1, 1);

    if (this.transitionFx) this.drawScreenFx(out, this.transitionFx);
  }
}
