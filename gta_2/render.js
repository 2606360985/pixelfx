import { createFrame, createFx, composite, Rng } from "../src/core/index.js";
import { WIDTH, HEIGHT, RENDER_SCALE } from "./data.js";
import { FX_BY_ID } from "./fx-catalog.js";
import { SceneManager } from "./scenes.js";
import { clamp } from "./world.js";

const HD_W = WIDTH * RENDER_SCALE;   // 1440
const HD_H = HEIGHT * RENDER_SCALE; // 810
const PIVOT_X = HD_W * 0.5;
const PIVOT_Y = HD_H * 0.58;

export class Renderer {
  constructor(canvas, assets = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = HD_W;
    canvas.height = HD_H;

    this.assets = assets;
    this.scenes = new SceneManager(assets);
    this.camera = 0;
    this.aimLead = 0;
    this.zoom = 1.08;
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
    this.transitionFxId = null;

    this.labels = [];
    this.bits = [];
    this.decals = [];
    this.elapsed = 0;
    this.rng = new Rng(99);

    this.sceneCanvas = document.createElement("canvas");
    this.sceneCanvas.width = HD_W;
    this.sceneCanvas.height = HD_H;
    this.sCtx = this.sceneCanvas.getContext("2d", { alpha: false });

    this.bloomCanvas = document.createElement("canvas");
    this.bloomCanvas.width = 240;
    this.bloomCanvas.height = 135;
    this.bloomCtx = this.bloomCanvas.getContext("2d");

    // Native pixel buffers for authentic pixelfx skill rendering (composited crisp via nearest-neighbor)
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

  refreshAssets(assets) {
    this.assets = assets;
    this.scenes.refreshFromAssets(assets);
  }

  reset() {
    this.fx = [];
    this.statusFx.clear();
    this.critterFx.clear();
    this.pickupFx.clear();
    this.weatherFx = null;
    this.weatherId = null;
    this.transitionFx = null;
    this.transitionFxId = null;
    this.labels = [];
    this.bits = [];
    this.decals = [];
    this.camera = 0;
    this.zoom = 1.08;
    this.zoomPunch = 0;
    this.chromaTimer = 0;
  }

  screenToWorld(sx, sy) {
    // sx, sy are in logical 480x270 units from Input
    const z = this.zoom || 1;
    const lx = WIDTH * 0.5 + (sx - WIDTH * 0.5) / z;
    const ly = HEIGHT * 0.58 + (sy - HEIGHT * 0.58) / z;
    return { x: this.camera + lx, y: ly };
  }

  text(c, s, x, y, color = "#fff2d1", size = 18, align = "left") {
    c.save();
    c.font = `700 ${size}px "Microsoft YaHei", system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = "alphabetic";
    c.shadowColor = "rgba(0, 0, 0, 0.88)";
    c.shadowBlur = 4;
    c.shadowOffsetX = 1;
    c.shadowOffsetY = 2;
    c.fillStyle = color;
    c.fillText(s, Math.round(x), Math.round(y));
    c.restore();
  }

  addFx(fxId, x, y, world, opts = {}) {
    const spec = FX_BY_ID[fxId];
    if (!spec || spec.screenSpace) return;
    if (this.fx.length >= 24) this.fx.shift();
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
      // Ignore individual malformed effect options
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
          color: e.hero ? "#ff4d6d" : "#ffd670",
        });
        this.particles(e.x, e.y + 8, 5, e.hero ? "#ff6b8b" : "#ffe08c");
      } else if (e.type === "pickup") {
        const msg = e.kind === "cash" ? `+$${e.amount}` : e.kind === "heal" ? `+${e.amount} HP` : "SHIELD!";
        this.labels.push({ text: msg, x: e.x, y: e.y - 16, life: 0.9, color: e.kind === "cash" ? "#7dffb3" : "#7eeaff" });
      } else if (e.type === "explosion" || e.type === "impactPulse") {
        this.particles(e.x, e.y - 8, 28, "#ff9d4d");
        this.zoomPunch = Math.max(this.zoomPunch, 0.036);
        this.chromaTimer = Math.max(this.chromaTimer, 0.14);
      } else if (e.type === "decal") {
        this.addDecal(e.kind, e.x, e.y, e.radius);
      } else if (e.type === "land") {
        this.particles(e.x, e.y, 6, "#d9c6ab");
      } else if (e.type === "ramp") {
        this.labels.push({ text: "腾空跃起!", x: e.x, y: e.y - 34, life: 1.0, color: "#2ee8c8" });
        this.zoomPunch = Math.max(this.zoomPunch, 0.024);
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
      if (!this.transitionFx || this.transitionFxId !== world.transition.fxId) {
        this.transitionFxId = world.transition.fxId;
        const spec = FX_BY_ID[world.transition.fxId];
        this.transitionFx = spec ? createFx(spec.mod, { x: 0, y: 0, seed: 3 }) : null;
      }
      if (this.transitionFx) this.transitionFx.update(dt);
    } else {
      this.transitionFx = null;
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

  pickActorImage(a) {
    if (!this.assets) return null;
    if (a.hero) {
      let pose = "idle";
      if (a.action) pose = "cast";
      else if (Math.hypot(a.vx || 0, a.vy || 0) > 8) pose = "run";
      return this.assets.get(`sprite_${a.id}_${pose}`) || this.assets.get(`sprite_${a.id}_idle`);
    }
    return this.assets.get(`sprite_ped_${a.type}`) || this.assets.get("sprite_ped_tourist");
  }

  drawTargetBeacon(c, x, y, time, color = "#ffb84d") {
    const bob = Math.sin(time * 6) * 5;
    c.save();
    c.translate(x, y + bob);
    c.fillStyle = color;
    c.strokeStyle = "#0b0e16";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 14);
    c.lineTo(10, 0);
    c.lineTo(0, -14);
    c.lineTo(-10, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  drawActor(c, a, world) {
    if (!a.hero && a.hp <= 0 && Math.floor(a.deathAge * 14) % 2) return;
    const x = (a.x - this.camera) * RENDER_SCALE;
    const y = (a.y - a.z) * RENDER_SCALE;
    const groundY = a.y * RENDER_SCALE;
    if (x < -120 || x > HD_W + 120) return;

    // Ground soft shadow
    c.save();
    c.globalAlpha = 0.52;
    c.fillStyle = "#07090f";
    c.beginPath();
    c.ellipse(x, groundY + 3, a.hero ? 28 : 24, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    if (a.hero && world.player === a) {
      c.save();
      c.strokeStyle = "#2ee8c8";
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(x, groundY + 3, 34, 11, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    const spd = Math.hypot(a.vx || 0, a.vy || 0);
    const moving = spd > 6;
    const stepBob = moving ? Math.abs(Math.sin(a.walkPhase || 0)) * -7 : Math.sin(world.time * 2.8 + (a.id?.length || a.id || 0)) * 1.4;
    const tilt = a.hp <= 0 ? -1.25 : moving ? (a.sprinting ? 0.1 : 0.05) * a.face : 0;
    const scaleY = a.landTimer > 0 ? 0.92 : moving ? 1 + Math.sin((a.walkPhase || 0) * 2) * 0.025 : 1;
    const scaleX = a.boss ? 1.15 : 1.0;

    const img = this.pickActorImage(a);
    c.save();
    c.translate(x, y + stepBob);
    c.rotate(tilt);
    c.scale(a.face * scaleX, scaleY * (a.boss ? 1.15 : 1.0));
    if (a.invuln > 0 && Math.floor(world.time * 16) % 2) c.globalAlpha = 0.52;
    if (a.hitFlash > 0) c.filter = "brightness(1.85) saturate(1.4)";
    if (img) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(img, -img.width / 2, -img.height);
    } else {
      c.fillStyle = a.color || "#999";
      c.fillRect(-18, -108, 36, 108);
    }
    c.restore();

    if (a.hero && a.shield > 0) {
      c.save();
      c.strokeStyle = "#62f4ff";
      c.lineWidth = 3;
      c.globalAlpha = 0.6;
      c.beginPath();
      c.ellipse(x, y - 56, 40, 62, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    if (a.hero) {
      if (world.player === a) {
        const bob = Math.sin(world.time * 5) * 4;
        const my = y - 144 + bob;
        c.save();
        c.fillStyle = "#2ee8c8";
        c.strokeStyle = "#0a0e18";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(x - 10, my - 8);
        c.lineTo(x + 10, my - 8);
        c.lineTo(x, my + 6);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      } else {
        this.text(c, a.name, x, y - 138, "#ffd68c", 16, "center");
      }
    } else if (a.hp > 0) {
      if (a.missionTarget) {
        this.drawTargetBeacon(c, x, y - (a.boss ? 176 : 158), world.time, a.boss ? "#ff4d6d" : "#ffb84d");
        this.text(c, a.name, x, y - (a.boss ? 196 : 178), a.boss ? "#ff7a92" : "#ffd68c", 15, "center");
      }
      if (a.hp < a.maxHp || a.isPolice || a.missionTarget) {
        const bw = a.boss ? 92 : 58;
        const bh = a.boss ? 7 : 5;
        const col = a.isPolice ? "#4cb4ff" : a.boss ? "#ff3b5c" : "#ff7585";
        c.fillStyle = "rgba(10, 14, 24, 0.88)";
        c.fillRect(x - bw / 2 - 1, y - (a.boss ? 160 : 142) - 1, bw + 2, bh + 2);
        c.fillStyle = col;
        c.fillRect(x - bw / 2, y - (a.boss ? 160 : 142), Math.round((a.hp / a.maxHp) * bw), bh);
      }
    }
  }

  drawVehicleEntity(c, v, world) {
    const vx = (v.x - this.camera) * RENDER_SCALE;
    const vy = (v.y - v.z) * RENDER_SCALE;
    const groundY = v.y * RENDER_SCALE;
    if (vx < -280 || vx > HD_W + 280) return;

    const img = this.assets?.get(`veh_${v.type}`);
    const wPx = (img ? img.width : v.spec.w * RENDER_SCALE);
    const bob = ((Math.abs(v.vx) > 25 ? Math.sin(world.time * 24 + v.id) * 1.6 : 0) + (v.suspY || 0) * RENDER_SCALE);

    // Ground soft shadow
    c.save();
    c.globalAlpha = 0.56;
    c.fillStyle = "#06080e";
    c.beginPath();
    c.ellipse(vx, groundY + 6, wPx * 0.52, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    c.save();
    c.translate(vx, vy + bob);
    c.scale(v.face, 1);
    if (v.spec.kind === "tricycle" && v.nitroActive) {
      c.rotate(-0.08);
    } else if (v.z > 4) {
      c.rotate(-Math.min(0.16, v.vz * 0.0007));
    }

    // Headlight rain cone
    if (v.driver || Math.abs(v.vx) > 20) {
      c.save();
      const grad = c.createLinearGradient(wPx * 0.45, -24, wPx * 0.45 + 210, -24);
      grad.addColorStop(0, "rgba(255, 240, 175, 0.28)");
      grad.addColorStop(1, "rgba(255, 240, 175, 0)");
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(wPx * 0.45, -28);
      c.lineTo(wPx * 0.45 + 210, -68);
      c.lineTo(wPx * 0.45 + 210, 14);
      c.closePath();
      c.fill();
      c.restore();
    }

    if (img) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(img, -img.width / 2, -img.height);
    } else {
      c.fillStyle = v.color || "#c22";
      c.fillRect(-wPx / 2, -52, wPx, 52);
    }

    // Police flashing lightbar glow
    if (v.spec.isPolice && !v.exploded) {
      const redOn = Math.floor(world.time * 8) % 2 === 0;
      c.save();
      c.globalCompositeOperation = "lighter";
      c.fillStyle = redOn ? "rgba(255, 56, 92, 0.55)" : "rgba(64, 183, 255, 0.55)";
      c.beginPath();
      c.ellipse(0, -66, 26, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Spinning spoke accent on wheels
    const wheelXs = v.spec.kind === "tricycle" ? [-34, 34] : [-wPx * 0.3, wPx * 0.3];
    const wy = -12;
    for (const wx of wheelXs) {
      c.save();
      c.translate(wx, wy);
      c.rotate(v.wheelPhase);
      c.strokeStyle = "rgba(235, 244, 255, 0.45)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-7, 0);
      c.lineTo(7, 0);
      c.moveTo(0, -7);
      c.lineTo(0, 7);
      c.stroke();
      c.restore();
    }

    // Brake light glow
    if (v.braking) {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.fillStyle = "rgba(255, 45, 75, 0.65)";
      c.beginPath();
      c.ellipse(-wPx * 0.48, -26, 12, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    c.restore();

    if (v.missionTarget) {
      this.drawTargetBeacon(c, vx, vy - 96, world.time, "#ff4d6d");
      this.text(c, v.name, vx, vy - 116, "#ff9bb0", 15, "center");
    }

    if (v.empTimer > 0) {
      this.text(c, "⚡ EMP 瘫痪", vx, vy - 82, "#7cf4ff", 17, "center");
    } else if (v.sliding) {
      this.text(c, "❄ 打滑", vx, vy - 82, "#a6f0ff", 16, "center");
    } else if (v.hp < v.maxHp * 0.45 && !v.exploded) {
      this.text(c, "⚠ 冒烟", vx, vy - 82, "#ff9955", 16, "center");
    }
  }

  drawPropEntity(c, prop, world) {
    const px = (prop.x - this.camera) * RENDER_SCALE;
    const py = (prop.y - prop.z) * RENDER_SCALE;
    if (px < -140 || px > HD_W + 140) return;

    c.save();
    c.globalAlpha = 0.45;
    c.fillStyle = "#06080e";
    c.beginPath();
    c.ellipse(px, py + 3, prop.type === "ramp" ? 48 : 22, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    if (prop.type === "hydrant" && prop.broken) {
      c.fillStyle = "#8a222c";
      c.fillRect(px - 12, py - 12, 24, 12);
      c.fillStyle = "#7cf4ff";
      c.fillRect(px - 6, py - 18, 12, 6);
      return;
    }

    const img = this.assets?.get(`prop_${prop.type}`);
    if (img) {
      c.save();
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(img, px - img.width / 2, py - img.height);
      if (prop.type === "barrel" && prop.fuse > 0 && Math.floor(world.time * 18) % 2 === 0) {
        c.globalCompositeOperation = "lighter";
        c.fillStyle = "rgba(255, 220, 120, 0.55)";
        c.beginPath();
        c.ellipse(px, py - img.height * 0.5, 28, 34, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  // PixelFX layer: computed in native 480x270 pixel buffer and composited SHARP (nearest-neighbor)
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

    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(this.fxCanvas, 0, 0, HD_W, HD_H);
    c.restore();
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
    c.drawImage(this.screenCanvas, 0, 0, HD_W, HD_H);
    c.restore();
  }

  applyPostProcessing() {
    const out = this.ctx;
    this.bloomCtx.clearRect(0, 0, 240, 135);
    this.bloomCtx.imageSmoothingEnabled = true;
    this.bloomCtx.drawImage(this.canvas, 0, 0, 240, 135);

    out.save();
    out.globalCompositeOperation = "lighter";
    out.globalAlpha = 0.14;
    out.imageSmoothingEnabled = true;
    out.drawImage(this.bloomCanvas, 0, 0, HD_W, HD_H);
    out.restore();

    if (this.chromaTimer > 0) {
      out.save();
      out.globalCompositeOperation = "lighter";
      out.globalAlpha = 0.16;
      out.drawImage(this.bloomCanvas, -7, 0, HD_W, HD_H);
      out.drawImage(this.bloomCanvas, 7, 0, HD_W, HD_H);
      out.restore();
    }

    const grad = out.createRadialGradient(HD_W / 2, HD_H * 0.52, HD_W * 0.3, HD_W / 2, HD_H * 0.52, HD_W * 0.72);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(5,7,14,0.34)");
    out.fillStyle = grad;
    out.fillRect(0, 0, HD_W, HD_H);
  }

  render(world, aimScreen = { x: 240, y: 160 }) {
    const sc = world.scene;
    const pl = world.player;
    const veh = pl.vehicleId ? world.vehicles.find((v) => v.id === pl.vehicleId) : null;

    let targetZoom = 1.08;
    if (veh && !veh.exploded) {
      const spd = Math.abs(veh.vx);
      targetZoom = veh.nitroActive || veh.z > 4 || spd > 145 ? 1.0 : 1.02;
    }
    targetZoom += this.zoomPunch;
    this.zoom += (targetZoom - this.zoom) * 0.1;

    const leadTarget = ((aimScreen.x - WIDTH * 0.5) / (WIDTH * 0.5)) * 18;
    this.aimLead += (leadTarget - this.aimLead) * 0.08;
    const targetCam = clamp(pl.x - WIDTH * 0.44 + this.aimLead, 0, Math.max(0, sc.width - WIDTH));
    this.camera += (targetCam - this.camera) * 0.16;

    const c = this.sCtx;
    c.save();

    if (world.shake > 0.2) {
      c.translate(
        Math.round(Math.sin(this.elapsed * 92) * world.shake * RENDER_SCALE),
        Math.round(Math.cos(this.elapsed * 67) * world.shake * 0.6 * RENDER_SCALE)
      );
    }

    this.scenes.draw(c, world.sceneId, this.camera, this.elapsed);

    for (const d of this.decals) {
      const dx = (d.x - this.camera) * RENDER_SCALE;
      const dy = d.y * RENDER_SCALE;
      if (dx < -150 || dx > HD_W + 150) continue;
      c.save();
      c.globalAlpha = Math.min(0.65, (d.life / d.maxLife) * 0.65);
      if (d.kind === "scorch") {
        c.fillStyle = "#0e0c10";
        c.beginPath();
        c.ellipse(dx, dy, d.radius * RENDER_SCALE, Math.max(10, d.radius * 0.35 * RENDER_SCALE), 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillStyle = "#12151e";
        c.fillRect(dx - 12, dy - 3, 24, 5);
        c.fillRect(dx - 12, dy + 8, 24, 5);
      }
      c.restore();
    }

    for (const z of world.zones) {
      const zx = (z.x - this.camera) * RENDER_SCALE;
      const zy = z.y * RENDER_SCALE;
      if (zx < -260 || zx > HD_W + 260) continue;
      c.save();
      c.globalAlpha = Math.min(0.5, (z.life / z.maxLife) * 0.65);
      c.fillStyle = z.kind === "ice" ? "rgba(166, 244, 255, 0.55)" : "rgba(34, 143, 168, 0.55)";
      c.beginPath();
      c.ellipse(zx, zy, z.radius * 0.85 * RENDER_SCALE, z.radius * 0.28 * RENDER_SCALE, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = z.kind === "ice" ? "#ffffff" : "#6cf0ff";
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }

    for (const d of sc.doors) {
      const dx = (d.x - this.camera) * RENDER_SCALE;
      const dy = d.y * RENDER_SCALE;
      if (dx < -120 || dx > HD_W + 120) continue;
      c.fillStyle = "rgba(46, 232, 200, 0.55)";
      c.fillRect(dx - 40, dy - 10, 80, 8);
      if (Math.hypot(pl.x - d.x, pl.y - d.y) < 55) {
        this.text(c, `[E] ${d.label}`, dx, dy - 26, "#8cfff0", 17, "center");
      }
    }

    this.drawWorldFx(c, "back", world);

    const drawables = [];
    for (const prop of world.props) {
      if (prop.broken && prop.type !== "hydrant") continue;
      drawables.push({ y: prop.y, draw: () => this.drawPropEntity(c, prop, world) });
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
      const px = (pr.x - this.camera) * RENDER_SCALE;
      const py = (pr.y - pr.z) * RENDER_SCALE;
      c.save();
      c.translate(px, py);
      c.rotate(pr.angle || 0);
      c.fillStyle = pr.ownerPolice ? "#ff4060" : pr.explosive ? "#ffaa3b" : "#4cf2ff";
      c.fillRect(-14, -5, 28, 10);
      c.fillStyle = "#ffffff";
      c.fillRect(3, -3, 11, 6);
      c.restore();
    }

    // Crisp pixelated skill effects on top of realistic actors & vehicles
    this.drawWorldFx(c, "front", world);

    for (const b of this.bits) {
      c.fillStyle = b.color;
      c.fillRect(Math.round((b.x - this.camera) * RENDER_SCALE), Math.round(b.y * RENDER_SCALE), 5, 5);
    }

    c.restore();

    if (this.weatherFx) this.drawScreenFx(c, this.weatherFx);

    for (const b of world.bubbles) {
      const bx = (b.x - this.camera) * RENDER_SCALE;
      const by = b.y * RENDER_SCALE;
      if (bx < -120 || bx > HD_W + 120) continue;
      c.save();
      c.font = `700 17px "Microsoft YaHei", sans-serif`;
      const tw = c.measureText(b.text).width + 26;
      c.fillStyle = "rgba(10, 14, 24, 0.9)";
      c.fillRect(bx - tw / 2, by - 32, tw, 30);
      c.fillStyle = b.color;
      c.fillRect(bx - tw / 2, by - 32, 5, 30);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(b.text, bx, by - 16);
      c.restore();
    }

    for (const l of this.labels) {
      c.save();
      c.globalAlpha = Math.min(1, l.life * 3);
      this.text(c, l.text, (l.x - this.camera) * RENDER_SCALE, l.y * RENDER_SCALE, l.color, 20, "center");
      c.restore();
    }

    if (!pl.vehicleId) {
      const nearVeh = world.vehicles.find((v) => !v.exploded && Math.hypot(v.x - pl.x, (v.y - pl.y) * 1.4) < 52);
      if (nearVeh) {
        const vx = (nearVeh.x - this.camera) * RENDER_SCALE;
        this.text(c, `[F] ${nearVeh.driver ? "抢车" : "驾驶"} ${nearVeh.spec.shortName}`, vx, nearVeh.y * RENDER_SCALE - 92, "#7effea", 17, "center");
      } else {
        const nearPed = world.peds.find((ped) => ped.hp > 0 && !ped.vehicleId && Math.hypot(ped.x - pl.x, ped.y - pl.y) < 52);
        if (nearPed) {
          this.text(c, `[E] ${nearPed.isVendor ? "买鱼蛋粉回血" : "交谈"}`, (nearPed.x - this.camera) * RENDER_SCALE, nearPed.y * RENDER_SCALE - 135, "#ffe494", 17, "center");
        }
      }
    }

    if (this.camera < 30 && sc.exits.left) {
      this.text(c, "◀ 前往相邻街区", 22, 412, "#2ee8c8", 18, "left");
    }
    if (this.camera > sc.width - WIDTH - 30 && sc.exits.right) {
      this.text(c, "前往相邻街区 ▶", HD_W - 22, 412, "#2ee8c8", 18, "right");
    }

    // Zoomed HD blit onto main canvas
    const out = this.ctx;
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = "high";
    out.save();
    out.translate(PIVOT_X, PIVOT_Y);
    out.scale(this.zoom, this.zoom);
    out.drawImage(this.sceneCanvas, -PIVOT_X, -PIVOT_Y);
    out.restore();

    if (this.postProcess) {
      this.applyPostProcessing();
    }

    // Crisp crosshair
    const ax = Math.round(aimScreen.x * RENDER_SCALE);
    const ay = Math.round(aimScreen.y * RENDER_SCALE);
    out.save();
    out.strokeStyle = "#2ee8c8";
    out.lineWidth = 2;
    out.strokeRect(ax - 11, ay - 11, 22, 22);
    out.fillStyle = "#ff3b5c";
    out.fillRect(ax - 2, ay - 2, 4, 4);
    out.restore();

    if (this.transitionFx) this.drawScreenFx(out, this.transitionFx);
  }
}
