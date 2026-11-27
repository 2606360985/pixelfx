// Pure cinematic camera controller & multi-layer parallax math (Node-safe, zero DOM).
import { WIDTH, HEIGHT } from "./data.js";
import { clamp } from "./world.js";

export const PARALLAX_LAYERS = {
  ultraFar: { x: 0.06, y: 0.04 },
  far: { x: 0.20, y: 0.14 },
  mid: { x: 0.48, y: 0.30 },
  near: { x: 1.00, y: 1.00 },
  fgNear: { x: 1.28, y: 1.14 },
  fgClose: { x: 1.42, y: 1.22 },
};

/**
 * Compute parallax shift for a layer relative to the near (1.0x) gameplay plane.
 * Keeps near plane locked at 1.0 regardless of strength, so strength=0 flattens all layers to 1.0.
 */
export function computeParallaxOffset(cameraX, cameraY, factorX, factorY = 1, strength = 1) {
  const s = Math.max(0, strength);
  const effX = 1 + (factorX - 1) * s;
  const effY = 1 + (factorY - 1) * s;
  return {
    x: cameraX * effX,
    y: cameraY * effY,
    effX,
    effY,
  };
}

function dampAlpha(rate, dt) {
  return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
}

export class CinematicCamera {
  constructor() {
    this.cinematic = true;
    this.reset();
  }

  reset(x = 0) {
    this.x = x;
    this.y = 0;
    this.velLead = 0;
    this.aimLead = 0;
    this.zoom = 1.02;
    this.zoomPunch = 0;
    this.whipTimer = 0;
    this.whipOffset = 0;
    this.landBounce = 0;
    this.landVel = 0;
    this.speedRatio = 0;
  }

  addZoomPunch(amount) {
    this.zoomPunch = clamp(this.zoomPunch + amount, -0.02, 0.06);
  }

  triggerHeroSwitch(fromX, toX) {
    if (!this.cinematic) return;
    const dx = clamp(toX - fromX, -180, 180);
    this.whipOffset = -dx * 0.28;
    this.whipTimer = 0.28;
    this.zoomPunch = Math.max(this.zoomPunch, 0.025);
  }

  triggerLandBounce(strength = 3.0) {
    if (!this.cinematic) return;
    this.landVel = Math.max(this.landVel, strength * 16);
  }

  update(dt, world, aimScreen = { x: WIDTH * 0.5, y: HEIGHT * 0.5 }) {
    const safeDt = Math.min(0.05, Math.max(1 / 240, dt || 1 / 60));
    const sc = world.scene;
    const pl = world.player;
    const veh = pl.vehicleId ? world.vehicles.find((v) => v.id === pl.vehicleId && !v.exploded) : null;
    const maxCamX = Math.max(0, (sc?.width || WIDTH) - WIDTH);

    const vx = veh ? veh.vx : pl.vx || 0;
    const maxRefSpeed = veh ? Math.max(120, veh.spec?.maxSpeed || 240) : 140;
    this.speedRatio = clamp(Math.abs(vx) / maxRefSpeed, 0, 1.35);

    if (!this.cinematic) {
      this.velLead += (0 - this.velLead) * dampAlpha(10, safeDt);
      this.aimLead += (0 - this.aimLead) * dampAlpha(10, safeDt);
      this.zoom += (1.0 - this.zoom) * dampAlpha(10, safeDt);
      this.zoomPunch = 0;
      this.whipOffset = 0;
      this.whipTimer = 0;
      this.landBounce = 0;
      this.landVel = 0;
      const targetX = clamp(pl.x - WIDTH * 0.45, 0, maxCamX);
      this.x += (targetX - this.x) * dampAlpha(10, safeDt);
      this.y += (0 - this.y) * dampAlpha(10, safeDt);
      return;
    }

    // 1. Velocity look-ahead (stronger in vehicles so player sees oncoming traffic & skyline)
    let targetVelLead = 0;
    if (veh) {
      const dir = Math.abs(vx) > 12 ? Math.sign(vx) : (pl.face || 1);
      targetVelLead = clamp((vx / maxRefSpeed) * 76, -82, 82);
      if (Math.abs(vx) <= 12) targetVelLead = dir * 16;
    } else {
      const speedNorm = clamp(vx / 135, -1, 1);
      const baseDir = Math.abs(vx) > 8 ? speedNorm : (pl.face || 1) * 0.25;
      targetVelLead = baseDir * (pl.sprinting ? 36 : 26);
    }
    this.velLead += (targetVelLead - this.velLead) * dampAlpha(veh ? 4.8 : 5.6, safeDt);

    // 2. Aim bias (restrained while driving so it doesn't fight velocity look-ahead)
    const aimMax = veh ? 9 : 18;
    const targetAim = clamp(((aimScreen.x - WIDTH * 0.5) / (WIDTH * 0.5)) * aimMax, -aimMax, aimMax);
    this.aimLead += (targetAim - this.aimLead) * dampAlpha(7.5, safeDt);

    // 3. Whip-pan decay on hero switch
    if (this.whipTimer > 0) {
      this.whipTimer = Math.max(0, this.whipTimer - safeDt);
    }
    this.whipOffset += (0 - this.whipOffset) * dampAlpha(11, safeDt);

    // 4. Horizontal camera target & follow
    const targetCamX = clamp(pl.x - WIDTH * 0.44 + this.velLead + this.aimLead + this.whipOffset, 0, maxCamX);
    this.x += (targetCamX - this.x) * dampAlpha(veh ? 9.5 : 8.5, safeDt);

    // 5. Vertical depth & airtime micro-follow + spring landing bounce
    const zLift = veh ? veh.z || 0 : pl.z || 0;
    this.landVel += (-this.landBounce * 110 - this.landVel * 14) * safeDt;
    this.landBounce = clamp(this.landBounce + this.landVel * safeDt, -5, 6);
    const targetCamY = clamp((pl.y - 188) * 0.14 - zLift * 0.18 + this.landBounce, -10, 8);
    this.y += (targetCamY - this.y) * dampAlpha(8.0, safeDt);

    // 6. Dynamic focal length (strictly >= 1.00, no miniature tilt-shift feel)
    let baseZoom = 1.025;
    if (veh) {
      baseZoom = veh.nitroActive || zLift > 4 || this.speedRatio > 0.62 ? 1.0 : 1.012;
    } else if (pl.sprinting) {
      baseZoom = 1.015;
    }
    this.zoomPunch += (0 - this.zoomPunch) * dampAlpha(9, safeDt);
    if (Math.abs(this.zoomPunch) < 0.0005) this.zoomPunch = 0;
    const targetZoom = clamp(baseZoom + this.zoomPunch, 1.0, 1.08);
    this.zoom += (targetZoom - this.zoom) * dampAlpha(6.5, safeDt);
  }

  screenToWorld(sx, sy, pivotX = WIDTH * 0.5, pivotY = HEIGHT * 0.58) {
    const z = this.zoom || 1;
    const wx = pivotX + (sx - pivotX) / z;
    const wy = pivotY + (sy - pivotY) / z;
    return {
      x: this.x + wx,
      y: this.y + wy,
    };
  }
}
