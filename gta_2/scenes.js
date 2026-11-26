import { SCENE_BY_ID, SCENE_SPECS, WIDTH, HEIGHT, RENDER_SCALE } from "./data.js";

const HD_W = WIDTH * RENDER_SCALE;   // 1440
const HD_H = HEIGHT * RENDER_SCALE; // 810

function buildSeamlessTile(img) {
  const tw = HD_W;
  const tile = document.createElement("canvas");
  tile.width = tw * 2;
  tile.height = HD_H;
  const ctx = tile.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Left half: original panorama
  ctx.drawImage(img, 0, 0, tw, HD_H);

  // Right half: horizontally mirrored so loop boundary at x=tw and x=2*tw has 0 seam
  ctx.save();
  ctx.translate(tw * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, tw, HD_H);
  ctx.restore();
  return tile;
}

function buildFallbackScene(spec) {
  const cv = document.createElement("canvas");
  cv.width = HD_W * 2;
  cv.height = HD_H;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, HD_H);
  g.addColorStop(0, "#0b101d");
  g.addColorStop(0.43, "#1a2234");
  g.addColorStop(0.54, "#252936");
  g.addColorStop(1, "#12151f");
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, HD_H);
  c.fillStyle = "#e0a938";
  c.fillRect(0, Math.round(190 * RENDER_SCALE), cv.width, 6);
  c.fillRect(0, Math.round(193 * RENDER_SCALE), cv.width, 6);
  return { tile: cv, width: spec.width || 2400, custom: false, spec };
}

export class SceneManager {
  constructor(assets = null) {
    this.assets = assets;
    this.cache = new Map();
    this.refreshFromAssets(assets);
  }

  refreshFromAssets(assets) {
    this.assets = assets;
    for (const spec of SCENE_SPECS) {
      const key = `scene_${spec.id}`;
      const img = assets?.get(key);
      if (img) {
        this.cache.set(spec.id, {
          tile: buildSeamlessTile(img),
          width: spec.width || 2400,
          custom: false,
          spec,
        });
      } else if (!this.cache.has(spec.id)) {
        this.cache.set(spec.id, buildFallbackScene(spec));
      }
    }
  }

  get(sceneId) {
    return this.cache.get(sceneId) || this.cache.get("temple-nightmarket");
  }

  setCustomBackground(sceneId, image) {
    const spec = SCENE_BY_ID[sceneId];
    const entry = this.get(sceneId);
    if (!spec || !entry || !image) return null;

    const imgW = image.naturalWidth || image.width || 1440;
    const imgH = image.naturalHeight || image.height || HD_H;
    const targetLogicalW = Math.max(960, Math.min(4800, Math.round((imgW * HEIGHT) / imgH)));
    const targetHdW = targetLogicalW * RENDER_SCALE;

    const sc = document.createElement("canvas");
    sc.width = targetHdW;
    sc.height = HD_H;
    const ctx = sc.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, targetHdW, HD_H);

    entry.tile = sc;
    entry.width = targetLogicalW;
    entry.custom = true;
    spec.width = targetLogicalW;
    return { width: targetLogicalW, height: HEIGHT };
  }

  resetSceneBackground(sceneId) {
    const spec = SCENE_BY_ID[sceneId];
    if (!spec) return;
    spec.width = 2400;
    const img = this.assets?.get(`scene_${sceneId}`);
    if (img) {
      this.cache.set(sceneId, {
        tile: buildSeamlessTile(img),
        width: 2400,
        custom: false,
        spec,
      });
    } else {
      this.cache.set(sceneId, buildFallbackScene(spec));
    }
  }

  draw(ctx, sceneId, cameraX, time) {
    const entry = this.get(sceneId);
    const spec = SCENE_BY_ID[sceneId];
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (entry.custom) {
      const sx = Math.max(0, Math.min(entry.tile.width - HD_W, cameraX * RENDER_SCALE));
      ctx.drawImage(entry.tile, sx, 0, HD_W, HD_H, 0, 0, HD_W, HD_H);
      ctx.restore();
      return;
    }

    const tileW = entry.tile.width; // 2880
    const worldPx = (cameraX * RENDER_SCALE) % tileW;
    const firstW = Math.min(HD_W, tileW - worldPx);
    ctx.drawImage(entry.tile, worldPx, 0, firstW, HD_H, 0, 0, firstW, HD_H);
    if (firstW < HD_W) {
      const rem = HD_W - firstW;
      ctx.drawImage(entry.tile, 0, 0, rem, HD_H, firstW, 0, rem, HD_H);
    }

    // Subtle dynamic rain-noir neon shimmer on wet asphalt
    const neonColors =
      spec?.ambient === "noir_cbd"
        ? ["#2ee8c8", "#ff3b8d"]
        : spec?.ambient === "noir_wharf"
        ? ["#ffb84d", "#4ca8ff"]
        : spec?.ambient === "noir_viaduct"
        ? ["#ffb84d", "#5cb2ff"]
        : ["#ff3b5c", "#2ee8c8", "#ffb84d"];

    for (let i = 0; i < 6; i++) {
      const wx = 180 + i * 380;
      const sx = (wx - cameraX) * RENDER_SCALE;
      if (sx < -240 || sx > HD_W + 240) continue;
      const col = neonColors[i % neonColors.length];
      ctx.save();
      ctx.globalAlpha = 0.045 + 0.02 * Math.sin(time * 2.2 + i * 1.3);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(sx, 535 + (i % 2) * 90, 140, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
