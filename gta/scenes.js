import { pixels } from "./art.js";
import { SCENE_BY_ID, SCENE_SPECS, WIDTH, HEIGHT } from "./data.js";
import { PARALLAX_LAYERS, computeParallaxOffset } from "./camera.js";

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

function wrapMod(v, mod) {
  return ((v % mod) + mod) % mod;
}

function drawTiledLayer(ctx, img, shiftX, y = 0) {
  if (!img) return;
  const w = img.width;
  if (!w) return;
  const off = Math.round(wrapMod(shiftX, w));
  for (let dx = -off; dx < WIDTH; dx += w) {
    ctx.drawImage(img, dx, Math.round(y));
  }
}

function tintSpriteToCanvas(img, multiplyHex = null, flipX = false) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.save();
  if (flipX) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  if (multiplyHex) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = multiplyHex;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }
  return c;
}

function ditherSky(ctx, w, h, stops) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const rgbs = stops.map((s) => {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const segs = rgbs.length - 1;
  for (let y = 0; y < h; y++) {
    const t = (y / Math.max(1, h - 1)) * segs;
    const i0 = Math.min(segs - 1, Math.floor(t));
    const frac = t - i0;
    const c0 = rgbs[i0];
    const c1 = rgbs[i0 + 1];
    for (let x = 0; x < w; x++) {
      const thresh = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const c = frac > thresh ? c1 : c0;
      const idx = (y * w + x) * 4;
      d[idx] = c[0];
      d[idx + 1] = c[1];
      d[idx + 2] = c[2];
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawCumulusClouds(r, p, pal) {
  const clusters = [
    { x: 48, y: 24, s: 1.15 },
    { x: 205, y: 16, s: 1.35 },
    { x: 375, y: 28, s: 0.95 },
    { x: 520, y: 20, s: 1.2 },
  ];
  for (const cl of clusters) {
    const sw = Math.round(52 * cl.s);
    const sh = Math.round(14 * cl.s);
    r(cl.x, cl.y, sw, sh, pal.base);
    r(cl.x + 8, cl.y - 6, sw - 16, sh, pal.mid);
    r(cl.x + 14, cl.y - 9, sw - 28, 5, pal.top);
    p(
      [
        [cl.x - 10, cl.y + sh],
        [cl.x + 4, cl.y + 4],
        [cl.x + sw - 6, cl.y + 4],
        [cl.x + sw + 10, cl.y + sh],
      ],
      pal.base
    );
  }
}

function buildCloudRibbon(pal) {
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 88;
  const ctx = c.getContext("2d");
  const { r } = pixels(ctx);
  const wisps = [
    { x: 36, y: 22, w: 78, h: 4 },
    { x: 196, y: 14, w: 104, h: 5 },
    { x: 382, y: 30, w: 68, h: 4 },
    { x: 548, y: 18, w: 92, h: 5 },
  ];
  for (const ws of wisps) {
    r(ws.x, ws.y, ws.w, ws.h, pal.base);
    r(ws.x + 10, ws.y - 2, ws.w - 22, 2, pal.top);
  }
  return c;
}

function drawCurvedPalm(r, p, x, baseY, scale = 1, leanDir = 1, pal = { trunk: "#242e3b", lit: "#524c5c", frondDark: "#143038", frondMid: "#215452", frondLit: "#3d8573" }) {
  const h = Math.round(54 * scale);
  let topX = x;
  let topY = baseY - h;
  for (let i = 0; i < h; i++) {
    const u = i / h;
    const cx = Math.round(x + leanDir * Math.pow(u, 1.55) * 14 * scale);
    const cy = baseY - i;
    const thick = u < 0.25 ? 3 : 2;
    r(cx, cy, thick, 1, pal.trunk);
    if (i % 4 < 2) r(cx + (leanDir > 0 ? thick - 1 : 0), cy, 1, 1, pal.lit);
    if (i === h - 1) {
      topX = cx;
      topY = cy;
    }
  }
  const fronds = [
    { dx: -24, dy: -4, drop: 7 },
    { dx: -19, dy: -12, drop: 5 },
    { dx: -9, dy: -18, drop: 4 },
    { dx: 10, dy: -18, drop: 4 },
    { dx: 20, dy: -11, drop: 5 },
    { dx: 25, dy: -3, drop: 7 },
  ];
  for (const f of fronds) {
    const ex = Math.round(topX + f.dx * scale);
    const ey = Math.round(topY + f.dy * scale);
    const mx = Math.round((topX + ex) / 2);
    const my = Math.round(Math.min(topY, ey) - 4 * scale);
    p([[topX, topY], [mx, my - 2], [ex, ey + f.drop], [mx, my + 4]], pal.frondDark);
    p([[topX, topY - 1], [mx, my - 1], [ex, ey + Math.round(f.drop * 0.4)], [mx, my + 2]], pal.frondMid);
    r(mx - 2, my - 1, 4, 1, pal.frondLit);
  }
}

function drawNeonSign(c, r, x, y, w, h, text, accent, glow = true) {
  if (glow) r(x - 2, y - 2, w + 4, h + 4, accent + "24");
  r(x + 1, y + 1, w, h, "#0a0e18");
  r(x, y, w, h, "#16192c");
  r(x, y, w, 2, accent);
  r(x, y + h - 2, w, 2, accent);
  c.fillStyle = accent;
  c.font = `bold ${h > 17 ? 9 : 7}px "Microsoft YaHei", sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x + w / 2, y + h / 2 + 0.5);
}

function drawBeachGap(r, p, x, w, isNight = false, baseFloorY = 118) {
  const seaTop = baseFloorY - 42;
  r(x, seaTop, w, 18, isNight ? "#162d47" : "#228599");
  r(x, seaTop + 6, w, 3, isNight ? "#244769" : "#40b6c4");
  r(x, seaTop + 16, w, 2, isNight ? "#507896" : "#d8f7fa");
  r(x, seaTop + 18, w, 24, isNight ? "#575166" : "#e8d2a6");
  r(x, seaTop + 18, w, 3, isNight ? "#484459" : "#d4ba8b");
  r(x, baseFloorY - 5, w, 5, isNight ? "#4e536e" : "#d6c8b6");
  r(x, baseFloorY - 6, w, 1, "#182030");
  for (let ux = x + 26; ux < x + w - 24; ux += 64) {
    r(ux, seaTop + 24, 1, 13, "#705644");
    p([[ux - 9, seaTop + 25], [ux, seaTop + 19], [ux + 10, seaTop + 25]], ux % 2 ? "#ff689c" : "#3ce0cc");
  }
}

function paintGTA6Boulevard(c, width, theme, opts = {}) {
  const { r, p } = pixels(c);
  const topSwY = opts.topSwY ?? 118;
  const curbY = opts.curbY ?? 144;
  const roadTop = opts.roadTop ?? 148;
  const roadH = opts.roadH ?? 89;
  const botCurbY = roadTop + roadH;
  const botWalkH = Math.max(12, HEIGHT - botCurbY - 3);

  if (!opts.skipTopSidewalkBase) {
    r(0, topSwY, width, curbY - topSwY, theme.sidewalk);
    r(0, curbY, width, 3, theme.curb);
    r(0, curbY + 3, width, 1, "#111622");
    for (let x = 0; x < width; x += 28) {
      r(x, topSwY, 1, curbY - topSwY, theme.sidewalkLine);
      r(x + 2, curbY, 22, 1, "#ffffff2e");
    }
  }

  if (opts.roadImage) {
    const rw = opts.roadImage.width || 600;
    for (let x = 0; x < width; x += rw) {
      c.drawImage(opts.roadImage, 0, 0, rw, opts.roadImage.height, x, roadTop, rw, roadH);
    }
    if (opts.isNight) {
      r(0, roadTop, width, roadH, "#090c2466");
    }
  } else {
    r(0, roadTop, width, roadH, theme.asphalt);
    for (let i = 0; i < Math.floor(width / 8); i++) {
      const x = (i * 173) % (width - 18);
      const y = roadTop + 4 + ((i * 29) % Math.max(12, roadH - 10));
      r(x, y, 4 + (i % 9), 1, i % 2 === 0 ? theme.asphaltSpeckA : theme.asphaltSpeckB);
    }
  }

  r(0, roadTop, width, 5, theme.asphaltShade);
  r(0, botCurbY - 5, width, 5, theme.asphaltShade);
  if (opts.gutterNeon) {
    r(0, roadTop, width, 2, opts.gutterNeon);
  }

  const laneMid = Math.round(roadTop + roadH * 0.5);
  const upperDash = Math.round(roadTop + roadH * 0.25);
  const lowerDash = Math.round(roadTop + roadH * 0.75);

  for (let x = 14; x < width; x += 42) {
    r(x, upperDash, 16, 1, "#d8e0eb48");
    r(x, lowerDash, 16, 1, "#d8e0eb48");
  }
  r(0, laneMid - 1, width, 1, "#f2b84b99");
  r(0, laneMid + 1, width, 1, "#f2b84b99");

  for (let x = 508; x < width - 120; x += 520) {
    for (let y = roadTop + 5; y < botCurbY - 4; y += 7) {
      r(x, y, 12, 3, "#e6ecf55c");
    }
    r(x - 62, roadTop + 12, 12, 2, "#d8e0eb4c");
    p([[x - 68, roadTop + 13], [x - 60, roadTop + 9], [x - 60, roadTop + 17]], "#d8e0eb4c");
    r(x + 48, botCurbY - 14, 12, 2, "#d8e0eb4c");
    p([[x + 66, botCurbY - 13], [x + 58, botCurbY - 17], [x + 58, botCurbY - 9]], "#d8e0eb4c");
  }

  if (opts.checkeredBottomCurb) {
    for (let x = 0; x < width; x += 18) {
      r(x, botCurbY, 9, 4, opts.isNight ? "#98a4cf" : "#e8d6e2");
      r(x + 9, botCurbY, 9, 4, "#1a1c30");
    }
    r(0, botCurbY + 4, width, 1, "#0d101f");
    // Painted sunset-violet promenade tiles along the bottom walk
    r(0, botCurbY + 5, width, botWalkH, theme.bottomWalk);
    r(0, botCurbY + 5, width, 3, opts.isNight ? "#48528044" : "#f09cb833");
    for (let x = 0; x < width; x += 28) {
      r(x, botCurbY + 5, 1, botWalkH, theme.sidewalkLine);
    }
    r(0, botCurbY + 15, width, 1, theme.sidewalkLine);
  } else {
    r(0, botCurbY, width, 3, theme.curb);
    r(0, botCurbY + 3, width, botWalkH, theme.bottomWalk);
    for (let x = 0; x < width; x += 26) {
      r(x, botCurbY + 3, 1, botWalkH, theme.sidewalkLine);
    }
  }
}

function buildFgItems(width, ambient) {
  // Ordered back-to-front by parallax factor so closer foreground elements occlude slightly farther ones cleanly!
  const lamps = [];
  const palms = [];
  const closeProps = [];

  for (let x = 165; x < width - 60; x += 290) {
    lamps.push({ kind: "lamp", x, factor: 1.22 });
  }
  let pIdx = 0;
  for (let x = 52; x < width - 40; x += 330) {
    palms.push({ kind: "palm", x, factor: 1.30, flip: pIdx % 2 === 1 });
    pIdx++;
  }
  let cIdx = 0;
  for (let x = 112; x < width - 50; x += 215) {
    closeProps.push({
      kind: cIdx % 2 === 0 ? "planter" : "parasol",
      x,
      factor: cIdx % 2 === 0 ? 1.38 : 1.42,
      flip: cIdx % 4 >= 2,
      ambient,
    });
    cIdx++;
  }

  return [...lamps, ...palms, ...closeProps];
}

function buildProceduralFar(fc, fp, ambient, beacons) {
  const isNight = ambient === "neon";
  if (ambient === "harbor") {
    for (let i = 0; i < 4; i++) {
      const cx = 75 + i * 170;
      fp.r(cx, 44, 4, 76, "#3b4f63");
      fp.r(cx - 10, 44, 48, 4, "#526980");
      fp.r(cx + 22, 48, 2, 22, "#243140");
    }
    fp.r(340, 82, 128, 36, "#263647");
    fp.r(356, 68, 36, 14, "#405469");
    return;
  }
  if (ambient === "bayou") {
    fp.r(0, 104, 640, 40, "#243b3b");
    for (let i = 0; i < 20; i++) {
      const tx = i * 32;
      fp.r(tx + 10, 68 + (i % 3) * 8, 5, 48, "#1b2924");
      fp.p([[tx, 78], [tx + 12, 56], [tx + 25, 78]], "#243d31");
    }
    return;
  }
  for (let i = 0; i < 15; i++) {
    const bx = i * 44 + (i % 2) * 5;
    const bh = 28 + ((i * 19) % 46);
    const topY = 132 - bh;
    fp.r(bx, topY, 26, bh, isNight ? "#161838" : "#593b75");
    fp.r(bx + 26, topY, 6, bh, isNight ? "#0d0e24" : "#3f2957");
    if (bh > 52) beacons.push({ x: bx + 13, y: topY - 3 });
  }
}

function buildProceduralMid(mc, mp, ambient) {
  if (ambient === "harbor") {
    for (let sx = 70; sx < 680; sx += 160) {
      mp.r(sx, 108, 18, 4, "#d8e6f0");
      mp.p([[sx + 9, 82], [sx + 9, 106], [sx + 18, 106]], "#f0f7fc");
    }
    return;
  }
  for (let i = 0; i < 10; i++) {
    drawCurvedPalm(mp.r, mp.p, 35 + i * 68, 124, 0.68, i % 2 ? 1 : -1, {
      trunk: "#2b2238",
      lit: "#523a5c",
      frondDark: "#1f1d33",
      frondMid: "#38294a",
      frondLit: "#7a4768",
    });
  }
}

function stampHolisticBg1Boulevard(sc, assets, isNight) {
  const st = assets.streetImage;
  const pr = assets.promenadeImage;
  const { r } = pixels(sc);

  if (!st || !st.width) {
    // Smooth warm placeholder for frame 0 while async PNGs finish decoding
    r(0, 134, 2400, 20, isNight ? "#48426b" : "#d89aa8");
    for (let x = 0; x < 2400; x += 18) {
      r(x, 154, 9, 4, "#e8d6e2");
      r(x + 9, 154, 9, 4, "#1a1c30");
    }
    return;
  }

  // Exact 2400px seamless composition:
  // [0..496]   Block 1: Main Art Deco Storefront Block (496px)
  // [496..856] Promenade 1: Oceanfront Lifeguard Pavilion & Balustrade Overlook (360px)
  // [856..1352] Block 2: Art Deco Storefront Block with warm dusk-lavender district mood (496px)
  // [1352..1712] Promenade 2: Mirrored Oceanfront Promenade Overlook (360px, pavilion on right!)
  // [1712..2208] Block 3: Eastern Art Deco Storefront Block (496px)
  // [2208..2400] Promenade 3: Coastal Palm & Balustrade Overlook tail (192px)
  sc.drawImage(st, 0, 0);

  if (pr && pr.width) {
    sc.drawImage(pr, 496, 0);

    // Block 2 with subtle warm-rose/lavender district tint on upper facades (above sidewalk y=135)
    sc.drawImage(st, 856, 0);
    sc.save();
    sc.beginPath();
    sc.rect(856, 0, 496, 135);
    sc.clip();
    sc.globalCompositeOperation = "source-atop";
    sc.fillStyle = isNight ? "#5868ff18" : "#c878ff14";
    sc.fillRect(856, 0, 496, 135);
    sc.restore();

    // Mirrored Promenade 2 (zero text in promenade, puts lifeguard pavilion on east side for natural variety!)
    const prFlip = tintSpriteToCanvas(pr, null, true);
    sc.drawImage(prFlip, 1352, 0);

    // Block 3
    sc.drawImage(st, 1712, 0);

    // Promenade 3 tail (192px)
    sc.drawImage(pr, pr.width - 192, 0, 192, pr.height, 2208, 0, 192, pr.height);
  } else {
    for (let x = 496; x < 2400; x += 496) sc.drawImage(st, x, 0);
  }

  if (isNight) {
    sc.save();
    sc.globalCompositeOperation = "source-atop";
    sc.fillStyle = "#1618426b";
    sc.fillRect(0, 0, 2400, 158);
    sc.restore();
  }
}

function buildSceneEntry(spec, assets = {}) {
  const w = spec.width || 2400;
  const isNight = spec.ambient === "neon";

  // Layer 0: Ultra-Far Sky & Horizon Ocean
  let ultraFar;
  if (spec.useBg1Layout && assets.skyImage) {
    ultraFar = document.createElement("canvas");
    ultraFar.width = assets.skyImage.width;
    ultraFar.height = assets.skyImage.height;
    const ufc = ultraFar.getContext("2d");
    ufc.drawImage(assets.skyImage, 0, 0);
    if (isNight) {
      ufc.fillStyle = "#080b269e";
      ufc.fillRect(0, 0, ultraFar.width, ultraFar.height);
      const ufp = pixels(ufc);
      for (let i = 0; i < 38; i++) {
        const sx = (i * 97 + 19) % ultraFar.width;
        const sy = 6 + ((i * 43) % 72);
        ufp.r(sx, sy, 1, 1, i % 3 === 0 ? "#8cf4ff" : "#ffe6fa");
      }
    }
  } else {
    ultraFar = document.createElement("canvas");
    ultraFar.width = 640;
    ultraFar.height = 160;
    const ufc = ultraFar.getContext("2d");
    const ufp = pixels(ufc);
    if (spec.ambient === "harbor") {
      ditherSky(ufc, 640, 118, ["#1c4266", "#2a638c", "#4289ab", "#72b0c2", "#b5d6d6"]);
      drawCumulusClouds(ufp.r, ufp.p, { top: "#ffffff", mid: "#d2ebef", base: "#84a9ba" });
      ufp.r(0, 118, 640, 42, "#1b5878");
    } else if (spec.ambient === "bayou") {
      ditherSky(ufc, 640, 118, ["#1b1e33", "#362c4a", "#664659", "#a3675b", "#d69463"]);
      drawCumulusClouds(ufp.r, ufp.p, { top: "#ffd69c", mid: "#b87a6a", base: "#573d52" });
      ufp.r(0, 118, 640, 42, "#243b3b");
    } else {
      ditherSky(
        ufc,
        640,
        128,
        isNight ? ["#09081a", "#141030", "#221647", "#361c5c", "#4d226e"] : ["#2e235c", "#583578", "#a1477a", "#df737a", "#f5a57a"]
      );
      ufp.r(0, 128, 640, 32, isNight ? "#162040" : "#3b3c6e");
    }
  }

  const cloudRibbon = buildCloudRibbon(
    isNight
      ? { top: "#7c64b828", base: "#47337024" }
      : spec.ambient === "harbor"
        ? { top: "#ffffff44", base: "#cde7f033" }
        : { top: "#ffdfc436", base: "#f28e8828" }
  );

  // Layer 1: Far Skyline
  const beacons = [];
  let far;
  if (spec.useBg1Layout && assets.farImage) {
    far = isNight ? tintSpriteToCanvas(assets.farImage, "#12153d88", false) : assets.farImage;
    for (let bx = 95; bx < far.width; bx += 210) {
      beacons.push({ x: bx, y: 44 + ((bx * 7) % 18) });
    }
  } else {
    far = document.createElement("canvas");
    far.width = 640;
    far.height = 160;
    const fc = far.getContext("2d");
    buildProceduralFar(fc, pixels(fc), spec.ambient, beacons);
  }

  // Layer 2: Midground Art Deco Hotel Row & Dusk Palms
  let mid;
  if (spec.useBg1Layout && assets.midImage) {
    mid = isNight ? tintSpriteToCanvas(assets.midImage, "#15163f80", false) : assets.midImage;
  } else {
    mid = document.createElement("canvas");
    mid.width = 720;
    mid.height = 160;
    const mc = mid.getContext("2d");
    buildProceduralMid(mc, pixels(mc), spec.ambient);
  }

  // Layer 3: Main Near Street (w x 270)
  const street = document.createElement("canvas");
  street.width = w;
  street.height = HEIGHT;
  const sc = street.getContext("2d");
  const sp = pixels(sc);

  const lampXs = [];
  const waterSparkles = [];
  const neonGlows = [];

  if (spec.useBg1Layout) {
    paintGTA6Boulevard(
      sc,
      w,
      {
        sidewalk: isNight ? "#524c75" : "#d69ca8",
        sidewalkLine: isNight ? "#2a2847" : "#4f3f63",
        curb: isNight ? "#767ea3" : "#e8d6dc",
        asphalt: isNight ? "#1c2038" : "#282e4d",
        asphaltShade: isNight ? "#14162b" : "#1e223d",
        asphaltSpeckA: "#3a426955",
        asphaltSpeckB: "#15192e55",
        bottomWalk: isNight ? "#252645" : "#3b355c",
      },
      {
        topSwY: 136,
        curbY: 154,
        roadTop: 158,
        roadH: 82,
        roadImage: assets.roadImage || null,
        isNight,
        skipTopSidewalkBase: Boolean(assets.streetImage),
        checkeredBottomCurb: true,
        gutterNeon: isNight ? "#42f2ff55" : "#d94dff40",
      }
    );

    stampHolisticBg1Boulevard(sc, assets, isNight);

    // Register subtle neon reflection pools beneath storefronts & promenade neon bollards
    for (const bx of [0, 856, 1712]) {
      neonGlows.push(
        { x: bx + 68, y: 164, w: 68, color: "#4ef2ff" },  // BLISS
        { x: bx + 166, y: 164, w: 72, color: "#ff58b0" }, // PALM CLUB
        { x: bx + 266, y: 164, w: 96, color: "#42f5e8" }, // OCEAN VIEW arch
        { x: bx + 382, y: 164, w: 74, color: "#c46eff" }, // Vice CAFE
        { x: bx + 455, y: 164, w: 64, color: "#52d8ff" }  // Lounge
      );
    }
    for (const px of [496, 1352]) {
      neonGlows.push(
        { x: px + 82, y: 162, w: 46, color: "#4ef2ff" },
        { x: px + 150, y: 162, w: 46, color: "#ff66c4" },
        { x: px + 228, y: 162, w: 46, color: "#4ef2ff" }
      );
    }
    for (let x = 165; x < w; x += 290) lampXs.push(x);
  } else if (spec.ambient === "harbor") {
    paintGTA6Boulevard(sc, w, {
      sidewalk: "#8b969e",
      sidewalkLine: "#667078",
      curb: "#aab5bd",
      asphalt: "#2d353d",
      asphaltShade: "#222830",
      asphaltSpeckA: "#3d465266",
      asphaltSpeckB: "#1e232b66",
      bottomWalk: "#68727d",
    });

    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 390;
      sp.r(x, 78, 190, 38, "#1e6785");
      sp.r(x, 84, 190, 3, "#36a2bf");
      waterSparkles.push({ x: x + 15, y: 82, w: 160 });
      sp.p([[x + 36, 98], [x + 128, 98], [x + 116, 108], [x + 42, 108]], "#eef6fc");
      sp.r(x + 54, 88, 44, 10, "#dcebf5");
      sp.r(x + 98, 88, 8, 10, "#b0c7d9");
      sp.r(x + 60, 91, 14, 5, "#264e6b");
      sp.r(x + 80, 91, 12, 5, "#264e6b");
      sp.r(x + 76, 62, 2, 26, "#c4d4e0");
      sp.r(x + 42, 104, 74, 2, "#39d9c8");
      sp.r(x, 111, 190, 7, "#82644a");
      sp.r(x, 110, 190, 1, "#18202c");

      const cx = x + 205;
      const col = ["#d1564b", "#3988ad", "#db9e3d"][i % 3];
      const shade = ["#943830", "#265f7a", "#9e6e22"][i % 3];
      const roof = ["#eb766b", "#59a8cc", "#f2bc61"][i % 3];
      sp.p([[cx + 2, 66], [cx + 14, 58], [cx + 158, 58], [cx + 146, 66]], roof);
      sp.p([[cx + 146, 66], [cx + 158, 58], [cx + 158, 118], [cx + 146, 118]], shade);
      sp.r(cx, 66, 146, 52, "#151e29");
      sp.r(cx + 2, 68, 142, 48, col);
      for (let rx = cx + 10; rx < cx + 136; rx += 14) sp.r(rx, 70, 3, 44, "#00000028");
      drawNeonSign(sc, sp.r, cx + 20, 78, 104, 18, i === 2 ? "海岸摆渡口" : `MARINA 0${i + 1}`, "#ffe070");
      lampXs.push(cx + 170);
    }
    for (let x = 140; x < w; x += 300) {
      sp.r(x, 242, 10, 14, "#e3a944");
      sp.r(x + 2, 244, 6, 4, "#222933");
    }
  } else {
    paintGTA6Boulevard(sc, w, {
      sidewalk: "#6e6958",
      sidewalkLine: "#524d3f",
      curb: "#8c846f",
      asphalt: "#303338",
      asphaltShade: "#24272b",
      asphaltSpeckA: "#40444d66",
      asphaltSpeckB: "#1d202466",
      bottomWalk: "#4b5944",
    });

    for (let i = 0; i < 8; i++) {
      const bx = 48 + i * 290;
      if (i % 2 === 0) {
        drawBeachGap(sp.r, sp.p, bx, 210, false, 118);
        waterSparkles.push({ x: bx + 20, y: 88, w: 170 });
        drawCurvedPalm(sp.r, sp.p, bx + 45, 118, 0.95, 1, {
          trunk: "#282a26",
          lit: "#4f4a3c",
          frondDark: "#1b3326",
          frondMid: "#2b4f39",
          frondLit: "#4d784e",
        });
      } else {
        sp.p([[bx + 2, 48], [bx + 14, 40], [bx + 186, 40], [bx + 172, 48]], "#8f6e56");
        sp.p([[bx + 172, 48], [bx + 186, 40], [bx + 186, 118], [bx + 172, 118]], "#3d3028");
        sp.r(bx, 48, 172, 70, "#192029");
        sp.r(bx + 2, 50, 168, 66, "#5c4a3e");
        drawNeonSign(sc, sp.r, bx + 18, 58, 134, 20, i === 3 ? "快速匝道口" : "BAYOU INN", "#ff9e5e");
        sp.r(bx + 36, 86, 98, 30, "#242b33");
        sp.r(bx + 42, 90, 86, 22, "#ff9e5e22");
        neonGlows.push({ x: bx + 85, y: 160, w: 110, color: "#ff9e5e" });
      }
      lampXs.push(bx + 220);
    }
  }

  // Build cached foreground sprite variants (normal + mirrored, night-graded when needed)
  let fgSprites = null;
  if (assets.fgPalm && assets.fgLamp && assets.fgPlanter && assets.fgParasol) {
    const nightTint = isNight ? "#12163b55" : null;
    fgSprites = {
      palm: tintSpriteToCanvas(assets.fgPalm, nightTint, false),
      palmFlip: tintSpriteToCanvas(assets.fgPalm, nightTint, true),
      lamp: tintSpriteToCanvas(assets.fgLamp, nightTint, false),
      planter: tintSpriteToCanvas(assets.fgPlanter, nightTint, false),
      planterFlip: tintSpriteToCanvas(assets.fgPlanter, nightTint, true),
      parasol: tintSpriteToCanvas(assets.fgParasol, nightTint, false),
      parasolFlip: tintSpriteToCanvas(assets.fgParasol, nightTint, true),
    };
  }

  return {
    ultraFar,
    cloudRibbon,
    far,
    mid,
    street,
    fgSprites,
    lampXs,
    fgItems: buildFgItems(w, spec.ambient),
    beacons,
    waterSparkles,
    neonGlows,
    width: w,
    custom: false,
    opaqueCustom: false,
  };
}

export class SceneManager {
  constructor(onCustomReady = null) {
    this.cache = new Map();
    this.bg1Assets = {
      skyImage: null,
      farImage: null,
      midImage: null,
      streetImage: null,
      promenadeImage: null,
      roadImage: null,
      fgPalm: null,
      fgLamp: null,
      fgPlanter: null,
      fgParasol: null,
    };

    for (const spec of SCENE_SPECS) {
      this.cache.set(spec.id, buildSceneEntry(spec, this.bg1Assets));
    }

    if (typeof Image !== "undefined") {
      this._loadBg1Assets(onCustomReady);
    }
  }

  _loadBg1Assets(onReady) {
    const firstBg1Spec = SCENE_SPECS.find((s) => s.useBg1Layout);
    if (!firstBg1Spec) return;

    const rebuildAll = () => {
      for (const spec of SCENE_SPECS) {
        const prev = this.cache.get(spec.id);
        if (prev?.custom) continue;
        this.cache.set(spec.id, buildSceneEntry(spec, this.bg1Assets));
        if (onReady && spec.useBg1Layout) onReady(spec.id, { width: spec.width, height: HEIGHT });
      }
    };

    const loadImg = (src, key) => {
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        this.bg1Assets[key] = img;
        rebuildAll();
      };
      img.src = src;
    };

    loadImg(firstBg1Spec.skyImage, "skyImage");
    loadImg(firstBg1Spec.farImage, "farImage");
    loadImg(firstBg1Spec.midImage, "midImage");
    loadImg(firstBg1Spec.streetImage, "streetImage");
    loadImg(firstBg1Spec.promenadeImage, "promenadeImage");
    loadImg(firstBg1Spec.roadImage, "roadImage");
    if (firstBg1Spec.fgSprites) {
      loadImg(firstBg1Spec.fgSprites.palm, "fgPalm");
      loadImg(firstBg1Spec.fgSprites.lamp, "fgLamp");
      loadImg(firstBg1Spec.fgSprites.planter, "fgPlanter");
      loadImg(firstBg1Spec.fgSprites.parasol, "fgParasol");
    }
  }

  get(sceneId) {
    return this.cache.get(sceneId) || this.cache.get("palm-avenue");
  }

  setCustomBackground(sceneId, image, layer = "bg") {
    const spec = SCENE_BY_ID[sceneId];
    const entry = this.get(sceneId);
    if (!spec || !entry || !image) return null;

    if (layer === "far") {
      const fc = document.createElement("canvas");
      fc.width = 640;
      fc.height = 160;
      const ctx = fc.getContext("2d");
      ctx.drawImage(image, 0, 0, fc.width, fc.height);
      entry.far = fc;
      return { width: entry.width, height: HEIGHT };
    }

    const imgW = image.naturalWidth || image.width || 2400;
    const imgH = image.naturalHeight || image.height || HEIGHT;
    const scale = HEIGHT / imgH;
    const targetW = Math.max(960, Math.min(4800, Math.round(imgW * scale)));

    const sc = document.createElement("canvas");
    sc.width = targetW;
    sc.height = HEIGHT;
    const ctx = sc.getContext("2d");
    ctx.drawImage(image, 0, 0, targetW, HEIGHT);

    let hasTransparentSky = false;
    try {
      const sample = ctx.getImageData(0, 0, Math.min(64, targetW), 16).data;
      for (let i = 3; i < sample.length; i += 4) {
        if (sample[i] < 200) {
          hasTransparentSky = true;
          break;
        }
      }
    } catch {
      hasTransparentSky = false;
    }

    entry.street = sc;
    entry.width = targetW;
    entry.custom = true;
    entry.opaqueCustom = !hasTransparentSky;
    entry.fgItems = buildFgItems(targetW, spec.ambient);
    spec.width = targetW;
    return { width: targetW, height: HEIGHT };
  }

  resetSceneBackground(sceneId) {
    const spec = SCENE_BY_ID[sceneId];
    if (!spec) return;
    spec.width = 2400;
    this.cache.set(sceneId, buildSceneEntry(spec, this.bg1Assets));
  }

  draw(ctx, sceneId, cameraX, cameraY = 0, time = 0, opts = {}) {
    const entry = this.get(sceneId);
    const spec = SCENE_BY_ID[sceneId];
    const strength = opts.parallaxStrength ?? 1;
    const isNight = spec?.ambient === "neon";

    ctx.fillStyle = "#101624";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (!entry.opaqueCustom) {
      // Layer 0: Ultra-far sunset sky & twilight ocean (0.06x) + gentle cloud drift
      const uf = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.ultraFar.x, PARALLAX_LAYERS.ultraFar.y, strength);
      drawTiledLayer(ctx, entry.ultraFar, uf.x, -uf.y * 0.35);
      drawTiledLayer(ctx, entry.cloudRibbon, uf.x + time * 2.0, -uf.y * 0.35);

      // Layer 1: Far distant across-bay skyline & causeway bridge (0.20x)
      const farOff = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.far.x, PARALLAX_LAYERS.far.y, strength);
      drawTiledLayer(ctx, entry.far, farOff.x, 3 - farOff.y * 0.55);

      if (Math.floor(time * 2) % 2 === 0 && entry.beacons.length) {
        ctx.fillStyle = "#ff5482";
        const farMod = Math.round(wrapMod(farOff.x, entry.far.width));
        for (const b of entry.beacons) {
          let bx = b.x - farMod;
          if (bx < 0) bx += entry.far.width;
          if (bx >= 0 && bx < WIDTH) ctx.fillRect(bx, Math.round(b.y - farOff.y * 0.55), 2, 2);
        }
      }

      // Layer 2: Midground Art Deco hotel row & dusk palms (0.48x)
      const midOff = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.mid.x, PARALLAX_LAYERS.mid.y, strength);
      drawTiledLayer(ctx, entry.mid, midOff.x, 8 - midOff.y * 0.75);

      // Subtle atmospheric perspective haze veil separating midground from near street
      if (spec?.useBg1Layout) {
        ctx.fillStyle = isNight ? "rgba(18, 22, 58, 0.08)" : "rgba(218, 114, 146, 0.055)";
        ctx.fillRect(0, 0, WIDTH, 158);
      }
    }

    // Layer 3: Near Main Street & Boulevard (1.00x)
    ctx.drawImage(entry.street, -Math.round(cameraX), -Math.round(cameraY));

    if (!entry.custom) {
      if (entry.waterSparkles.length) {
        ctx.fillStyle = spec?.ambient === "bayou" ? "#ffd88a88" : "#d9ffff99";
        for (const ws of entry.waterSparkles) {
          const sx = ws.x - cameraX;
          if (sx + ws.w < 0 || sx > WIDTH) continue;
          for (let k = 0; k < 4; k++) {
            const px = sx + ((Math.floor(time * 3 + k * 37) * 29 + k * 19) % Math.max(12, ws.w));
            const py = ws.y + ((k * 3) % 9) - Math.round(cameraY);
            ctx.fillRect(Math.round(px), py, 4, 1);
          }
        }
      }

      for (const ng of entry.neonGlows) {
        const sx = ng.x - cameraX;
        if (sx < -120 || sx > WIDTH + 120) continue;
        ctx.save();
        ctx.globalAlpha = (isNight ? 0.14 : 0.085) + 0.022 * Math.sin(time * 2.5 + ng.x);
        ctx.fillStyle = ng.color;
        ctx.beginPath();
        ctx.ellipse(sx, ng.y - cameraY, ng.w * 0.5, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawForeground(ctx, sceneId, cameraX, cameraY = 0, time = 0, opts = {}) {
    if (opts.foregroundOcclusion === false) return;
    const entry = this.get(sceneId);
    const spec = SCENE_BY_ID[sceneId];
    const strength = opts.parallaxStrength ?? 1;
    const playerScreenX = opts.playerScreenX ?? WIDTH * 0.5;
    const playerScreenY = opts.playerScreenY ?? 150;
    const isNight = spec?.ambient === "neon";
    const fgs = entry.fgSprites;

    for (const item of entry.fgItems) {
      const off = computeParallaxOffset(cameraX, cameraY, item.factor, 1.15, strength);
      const sx = Math.round(item.x * (1 + (item.factor - 1) * strength) - off.x);
      if (sx < -80 || sx > WIDTH + 80) continue;

      const yShift = Math.round(-off.y * 0.85);
      const distToHeroX = Math.abs(sx - playerScreenX);

      // Smooth proximity fade so tall trunks/poles never obscure the active protagonist
      let alpha = 0.96;
      if (item.kind === "palm" || item.kind === "lamp") {
        if (distToHeroX < 38) {
          const t = distToHeroX / 38;
          alpha = 0.44 + (0.96 - 0.44) * (t * t);
        }
      } else if (playerScreenY > 208 && distToHeroX < 34) {
        alpha = 0.65;
      }

      if (fgs) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (item.kind === "palm") {
          const spr = item.flip ? fgs.palmFlip : fgs.palm;
          const sway = Math.round(Math.sin(time * 1.3 + item.x * 0.02) * 1.2);
          ctx.drawImage(spr, sx - Math.round(spr.width * 0.5) + sway, HEIGHT + 6 - spr.height + yShift);
        } else if (item.kind === "lamp") {
          const spr = fgs.lamp;
          const lx = sx - Math.round(spr.width * 0.5);
          const ly = HEIGHT + 4 - spr.height + yShift;
          ctx.drawImage(spr, lx, ly);
          // Soft dual cyan + warm-amber lantern glow halo around the twin globes
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = alpha * (isNight ? 0.22 : 0.14);
          ctx.fillStyle = "#48f2ff";
          ctx.beginPath();
          ctx.arc(sx - 13, ly + 28, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffb864";
          ctx.beginPath();
          ctx.arc(sx + 13, ly + 28, 16, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.kind === "planter") {
          const spr = item.flip ? fgs.planterFlip : fgs.planter;
          ctx.drawImage(spr, sx - Math.round(spr.width * 0.5), HEIGHT + 3 - spr.height + yShift);
        } else if (item.kind === "parasol") {
          const spr = item.flip ? fgs.parasolFlip : fgs.parasol;
          ctx.drawImage(spr, sx - Math.round(spr.width * 0.5), HEIGHT + 4 - spr.height + yShift);
        }
        ctx.restore();
      } else {
        // Lightweight fallback before async foreground sprites finish loading
        const { r } = pixels(ctx);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        if (item.kind === "lamp") {
          r(sx - 2, 106 + yShift, 4, HEIGHT - 102, "#0d1024");
        } else if (item.kind === "planter") {
          r(sx - 18, HEIGHT - 22 + yShift, 36, 22, "#141830");
        }
        ctx.restore();
      }
    }
  }
}
