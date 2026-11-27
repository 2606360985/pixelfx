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
  c.width = 640;
  c.height = 96;
  const ctx = c.getContext("2d");
  const { r, p } = pixels(ctx);
  const ribbons = [
    { x: 30, y: 26, w: 72, h: 10 },
    { x: 170, y: 16, w: 94, h: 12 },
    { x: 330, y: 34, w: 66, h: 9 },
    { x: 470, y: 20, w: 86, h: 11 },
  ];
  for (const rb of ribbons) {
    r(rb.x, rb.y, rb.w, rb.h, pal.base);
    r(rb.x + 8, rb.y - 4, rb.w - 16, 6, pal.mid);
    r(rb.x + 16, rb.y - 6, rb.w - 32, 3, pal.top);
    p([[rb.x - 12, rb.y + rb.h], [rb.x + 4, rb.y + 3], [rb.x + rb.w - 4, rb.y + 3], [rb.x + rb.w + 12, rb.y + rb.h]], pal.base);
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
  if (w >= 110) {
    const lx = x + Math.round(w * 0.44);
    r(lx, seaTop + 20, 2, 14, "#85654e");
    r(lx + 16, seaTop + 20, 2, 14, "#85654e");
    r(lx - 2, seaTop + 10, 20, 11, isNight ? "#2a4763" : "#44d4c8");
    r(lx + 16, seaTop + 10, 5, 11, isNight ? "#1c3145" : "#2b9e96");
    p([[lx - 4, seaTop + 10], [lx + 9, seaTop + 3], [lx + 23, seaTop + 10]], isNight ? "#453359" : "#ff6e9c");
    r(lx + 3, seaTop + 13, 10, 5, "#1b2838");
  }
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

  r(0, topSwY, width, curbY - topSwY, theme.sidewalk);
  r(0, curbY, width, 3, theme.curb);
  r(0, curbY + 3, width, 1, "#111622");
  for (let x = 0; x < width; x += 28) {
    r(x, topSwY, 1, curbY - topSwY, theme.sidewalkLine);
    r(x + 2, curbY, 22, 1, "#ffffff2e");
  }

  if (opts.roadImage) {
    const rw = opts.roadImage.width || 600;
    for (let x = 0; x < width; x += rw) {
      c.drawImage(opts.roadImage, 0, 0, rw, opts.roadImage.height, x, roadTop, rw, roadH);
    }
    if (opts.isNight) {
      r(0, roadTop, width, roadH, "#0c0f2855");
    }
  } else {
    r(0, roadTop, width, roadH, theme.asphalt);
    for (let i = 0; i < Math.floor(width / 8); i++) {
      const x = (i * 173) % (width - 18);
      const y = roadTop + 4 + ((i * 29) % Math.max(12, roadH - 10));
      r(x, y, 4 + (i % 9), 1, i % 2 === 0 ? theme.asphaltSpeckA : theme.asphaltSpeckB);
    }
  }

  r(0, roadTop, width, 6, theme.asphaltShade);
  r(0, botCurbY - 6, width, 6, theme.asphaltShade);
  if (opts.gutterNeon) {
    r(0, roadTop + 1, width, 2, opts.gutterNeon);
  }

  const laneMid = Math.round(roadTop + roadH * 0.5);
  const upperDash = Math.round(roadTop + roadH * 0.25);
  const lowerDash = Math.round(roadTop + roadH * 0.75);

  for (let x = 14; x < width; x += 42) {
    r(x, upperDash, 16, 1, "#d8e0eb55");
    r(x, lowerDash, 16, 1, "#d8e0eb55");
  }
  r(0, laneMid - 1, width, 1, "#f2b84baa");
  r(0, laneMid + 1, width, 1, "#f2b84baa");

  for (let x = 260; x < width - 100; x += 480) {
    for (let y = roadTop + 4; y < botCurbY - 4; y += 7) {
      r(x, y, 12, 3, "#e6ecf566");
    }
    r(x - 62, roadTop + 12, 12, 2, "#d8e0eb55");
    p([[x - 68, roadTop + 13], [x - 60, roadTop + 9], [x - 60, roadTop + 17]], "#d8e0eb55");
    r(x + 48, botCurbY - 14, 12, 2, "#d8e0eb55");
    p([[x + 66, botCurbY - 13], [x + 58, botCurbY - 17], [x + 58, botCurbY - 9]], "#d8e0eb55");
  }

  // Bottom curb (match bg1 checkered style if requested)
  if (opts.checkeredBottomCurb) {
    for (let x = 0; x < width; x += 14) {
      r(x, botCurbY, 7, 4, "#e6d8e6");
      r(x + 7, botCurbY, 7, 4, "#1e1f33");
    }
    r(0, botCurbY + 4, width, 1, "#0d101c");
  } else {
    r(0, botCurbY, width, 3, theme.curb);
  }
  r(0, botCurbY + 4, width, botWalkH, theme.bottomWalk);
  for (let x = 0; x < width; x += 26) {
    r(x, botCurbY + 4, 1, botWalkH, theme.sidewalkLine);
  }
}

function buildFgItems(width, ambient) {
  const items = [];
  for (let x = 85; x < width; x += 210) {
    items.push({ kind: "palm", x, factor: PARALLAX_LAYERS.fgNear.x, scale: 0.96 + ((x / 210) % 2) * 0.14, lean: (x % 420 === 85) ? 1 : -1 });
    items.push({ kind: "lamp", x: x + 105, factor: PARALLAX_LAYERS.fgNear.x });
  }
  for (let x = 40; x < width; x += 145) {
    items.push({
      kind: (x / 145) % 2 === 0 ? "shrub" : "bollard",
      x,
      factor: PARALLAX_LAYERS.fgClose.x,
      ambient,
    });
  }
  return items;
}

function drawOceanPromenadeGap(sp, x, w, isNight) {
  const { r, p } = sp;
  // Coral stone sea-wall & sunset promenade opening at y=118..154 so Layer 0/1/2 shine behind it!
  r(x, 126, w, 10, isNight ? "#2f3354" : "#d99b9b");
  r(x, 125, w, 2, isNight ? "#4f5987" : "#ffd6c9");
  r(x, 136, w, 20, isNight ? "#3f3860" : "#cf899a");
  for (let px = x + 12; px < x + w - 12; px += 36) {
    r(px, 118, 4, 10, isNight ? "#242847" : "#a86a7a");
    r(px + 1, 116, 2, 2, isNight ? "#4ff2ff" : "#ffd694");
  }
  // Checkered curb continuation matching bg1_street.png bottom edge (y=154..158)
  for (let cx = x; cx < x + w; cx += 14) {
    r(cx, 154, 7, 4, isNight ? "#98a4cf" : "#e8d6dc");
    r(cx + 7, 154, 7, 4, "#191c2e");
  }
  r(x, 158, w, 2, isNight ? "#46b8ff55" : "#d85bff44");
  // Lifeguard / beach hut silhouette in promenade gap
  if (w >= 170) {
    const hx = x + Math.round(w * 0.46);
    r(hx, 112, 24, 16, isNight ? "#263154" : "#e6a89c");
    p([[hx - 4, 112], [hx + 12, 102], [hx + 28, 112]], isNight ? "#3c688a" : "#ff6b9d");
    r(hx + 6, 116, 12, 6, isNight ? "#42f2ff" : "#2b2042");
  }
}

function buildFarSkyline(fc, fp, ambient, beacons) {
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

  // Sunset / Neon Vice City distant Art Deco skyline
  for (let i = 0; i < 15; i++) {
    const bx = i * 44 + (i % 2) * 5;
    const bh = 28 + ((i * 19) % 46);
    const topY = 132 - bh;
    const bodyCol = isNight ? (i % 2 ? "#141633" : "#1c1a42") : (i % 2 ? "#593b75" : "#6c4580");
    const sideCol = isNight ? "#0d0e24" : "#3f2957";
    const roofCol = isNight ? (i % 2 ? "#42f2ff" : "#ff4fa8") : "#ff9b8f";
    fp.r(bx, topY, 26, bh, bodyCol);
    fp.r(bx + 26, topY, 6, bh, sideCol);
    fp.r(bx + 2, topY, 22, 2, roofCol);
    if (i % 3 === 0) {
      fp.r(bx + 9, topY - 8, 8, 8, bodyCol);
      fp.r(bx + 12, topY - 14, 2, 6, roofCol);
    }
    for (let wy = topY + 6; wy < 126; wy += 6) {
      fp.r(bx + 5, wy, 3, 2, (i + wy) % 4 === 0 ? (isNight ? "#4ef2ff" : "#ffe0a3") : (isNight ? "#ff5da844" : "#87579c"));
      fp.r(bx + 15, wy, 3, 2, isNight ? "#ffd96b66" : "#87579c");
    }
    if (bh > 52) beacons.push({ x: bx + 13, y: topY - (i % 3 === 0 ? 15 : 3) });
  }
}

function buildMidLayer(mc, mp, ambient) {
  const isNight = ambient === "neon";
  if (ambient === "harbor") {
    for (let sx = 70; sx < 680; sx += 160) {
      mp.r(sx, 108, 18, 4, "#d8e6f0");
      mp.p([[sx + 9, 82], [sx + 9, 106], [sx + 18, 106]], "#f0f7fc");
    }
    return;
  }
  if (ambient === "bayou") {
    for (let i = 0; i < 11; i++) {
      drawCurvedPalm(mp.r, mp.p, 35 + i * 64, 118, 0.7, 1, {
        trunk: "#222620",
        lit: "#3e4034",
        frondDark: "#192b21",
        frondMid: "#243d2d",
        frondLit: "#3a5c3c",
      });
    }
    return;
  }

  // Midground secondary Art Deco hotel silhouettes & palm ridge (moves at 0.48x behind bg1_street)
  for (let i = 0; i < 9; i++) {
    const bx = 18 + i * 80;
    const bh = 36 + ((i * 23) % 34);
    const ty = 136 - bh;
    const wall = isNight ? "#222147" : (i % 2 ? "#8c598c" : "#a1678f");
    const shade = isNight ? "#151533" : "#613d69";
    mp.r(bx, ty, 38, bh, wall);
    mp.r(bx + 38, ty, 8, bh, shade);
    mp.r(bx + 2, ty, 34, 2, isNight ? "#ff5ca8" : "#ffc29e");
    for (let wy = ty + 8; wy < 128; wy += 8) {
      mp.r(bx + 7, wy, 6, 4, isNight ? "#42f2ff55" : "#ffd9b377");
      mp.r(bx + 20, wy, 6, 4, isNight ? "#ff68b455" : "#4a2c5966");
    }
    drawCurvedPalm(mp.r, mp.p, bx + 54, 132, 0.65, i % 2 ? 1 : -1, {
      trunk: isNight ? "#171a33" : "#402c52",
      lit: isNight ? "#333963" : "#6e4770",
      frondDark: isNight ? "#121a30" : "#31244a",
      frondMid: isNight ? "#1d314d" : "#4f375e",
      frondLit: isNight ? "#35748c" : "#8f5578",
    });
  }
}

function stampBg1Street(sc, assets, isNight) {
  const st = assets.streetImage;
  const { r } = pixels(sc);
  if (!st || !st.width) {
    // Fallback matching bg1 palette while async PNG finishes loading
    for (let x = 20; x < 2360; x += 220) {
      r(x, 42, 160, 114, isNight ? "#28224a" : "#e8a8a4");
      r(x + 10, 50, 140, 16, isNight ? "#42f2ff44" : "#ff66aa88");
      r(x, 134, 160, 20, isNight ? "#383559" : "#d99ea8");
    }
    return;
  }

  const drawSegment = (srcX, srcW, dstX) => {
    sc.drawImage(st, srcX, 0, srcW, st.height, dstX, 0, srcW, st.height);
  };

  // Block 1 (x = 16..616): Full authentic bg1.png panorama right at spawn!
  drawSegment(0, 600, 16);

  // Promenade Opening 1 (x = 616..828): reveals ultraFar sunset sea, far skyline & mid towers!
  drawOceanPromenadeGap(pixels(sc), 616, 212, isNight);

  // Block 2 (x = 828..1428): Re-ordered architectural collage of bg1 storefronts
  drawSegment(365, 235, 828); // Vice CAFE + BLUE Moon + CLUB
  drawSegment(0, 365, 1063);  // Ocean SEAFOOD + Bliss BAR + OCEAN VIEW

  // Promenade Opening 2 (x = 1428..1648)
  drawOceanPromenadeGap(pixels(sc), 1428, 220, isNight);

  // Block 3 (x = 1648..2248): Full bg1 panorama + eastern promenade
  drawSegment(0, 600, 1648);
  drawOceanPromenadeGap(pixels(sc), 2248, 152, isNight);

  if (isNight) {
    // Subtle midnight indigo tint over sunlit facades while keeping neon signs vivid
    sc.save();
    sc.globalCompositeOperation = "multiply";
    sc.fillStyle = "#7a78b8";
    sc.fillRect(0, 0, 2400, 158);
    sc.restore();
  }
}

function buildSceneEntry(spec, assets = {}) {
  const w = spec.width || 2400;
  const isNight = spec.ambient === "neon";

  // Layer 0: Ultra-Far Sky (640x160) + drifting Cloud Ribbon (640x96)
  const ultraFar = document.createElement("canvas");
  ultraFar.width = 640;
  ultraFar.height = 160;
  const ufc = ultraFar.getContext("2d");
  const ufp = pixels(ufc);

  if (spec.useBg1Layout && assets.skyImage) {
    ufc.drawImage(assets.skyImage, 0, 0, 640, 148);
    ufp.r(0, 148, 640, 12, "#2c305c");
    if (isNight) {
      ufc.fillStyle = "#0a0c2688";
      ufc.fillRect(0, 0, 640, 160);
    }
  } else if (spec.ambient === "sunset" || spec.ambient === "neon") {
    ditherSky(
      ufc,
      640,
      128,
      isNight
        ? ["#09081a", "#141030", "#221647", "#361c5c", "#4d226e"]
        : ["#2e235c", "#583578", "#a1477a", "#df737a", "#f5a57a"]
    );
    drawCumulusClouds(
      ufp.r,
      ufp.p,
      isNight
        ? { top: "#7056a8", mid: "#422c6b", base: "#20173d" }
        : { top: "#ffdfb8", mid: "#f0927d", base: "#7a4475" }
    );
    ufp.r(0, 128, 640, 32, isNight ? "#162040" : "#3b3c6e");
  } else if (spec.ambient === "harbor") {
    ditherSky(ufc, 640, 118, ["#1c4266", "#2a638c", "#4289ab", "#72b0c2", "#b5d6d6"]);
    drawCumulusClouds(ufp.r, ufp.p, { top: "#ffffff", mid: "#d2ebef", base: "#84a9ba" });
    ufp.r(0, 118, 640, 42, "#1b5878");
  } else {
    ditherSky(ufc, 640, 118, ["#1b1e33", "#362c4a", "#664659", "#a3675b", "#d69463"]);
    drawCumulusClouds(ufp.r, ufp.p, { top: "#ffd69c", mid: "#b87a6a", base: "#573d52" });
    ufp.r(0, 118, 640, 42, "#243b3b");
  }

  const cloudRibbon = buildCloudRibbon(
    isNight
      ? { top: "#6e559c55", mid: "#47337055", base: "#281b4755" }
      : spec.ambient === "harbor"
        ? { top: "#ffffff66", mid: "#cde7f055", base: "#89afc244" }
        : { top: "#ffdcc455", mid: "#f2968855", base: "#8b4d7844" }
  );

  // Layer 1: Far Skyline (640x160 transparent)
  const far = document.createElement("canvas");
  far.width = 640;
  far.height = 160;
  const fc = far.getContext("2d");
  const fp = pixels(fc);
  const beacons = [];
  buildFarSkyline(fc, fp, spec.ambient, beacons);

  // Layer 2: Midground Bay / Towers / Palms (720x160 transparent)
  const mid = document.createElement("canvas");
  mid.width = 720;
  mid.height = 160;
  const mc = mid.getContext("2d");
  const mp = pixels(mc);
  buildMidLayer(mc, mp, spec.ambient);

  // Layer 3: Main Near Street (w x 270 transparent sky)
  const street = document.createElement("canvas");
  street.width = w;
  street.height = HEIGHT;
  const sc = street.getContext("2d");
  const sp = pixels(sc);

  const lampXs = [];
  const waterSparkles = [];
  const neonGlows = [];

  if (spec.useBg1Layout) {
    paintGTA6Boulevard(sc, w, {
      sidewalk: isNight ? "#524c75" : "#d69ca8",
      sidewalkLine: isNight ? "#333052" : "#ad7483",
      curb: isNight ? "#767ea3" : "#e8d6dc",
      asphalt: isNight ? "#1c2038" : "#282e4d",
      asphaltShade: isNight ? "#14162b" : "#1e223d",
      asphaltSpeckA: "#3a426955",
      asphaltSpeckB: "#15192e55",
      bottomWalk: isNight ? "#2f3354" : "#3a4063",
    }, {
      topSwY: 134,
      curbY: 154,
      roadTop: 158,
      roadH: 82,
      roadImage: assets.roadImage || null,
      isNight,
      checkeredBottomCurb: true,
      gutterNeon: isNight ? "#42f2ff55" : "#d94dff44",
    });

    stampBg1Street(sc, assets, isNight);

    // Register neon glow pools & street lamps matching bg1 signage positions
    const bg1Blocks = [16, 1648];
    for (const bx of bg1Blocks) {
      neonGlows.push(
        { x: bx + 68, y: 164, w: 72, color: "#ff9d5e" },  // Ocean SEAFOOD
        { x: bx + 158, y: 164, w: 68, color: "#ff4fa8" }, // Bliss BAR
        { x: bx + 275, y: 164, w: 96, color: "#58e8ff" }, // OCEANVIEW
        { x: bx + 418, y: 164, w: 78, color: "#c46eff" }, // Vice CAFE
        { x: bx + 498, y: 164, w: 72, color: "#42d8ff" }  // BLUE Moon
      );
    }
    neonGlows.push(
      { x: 905, y: 164, w: 78, color: "#c46eff" },
      { x: 985, y: 164, w: 72, color: "#42d8ff" },
      { x: 1130, y: 164, w: 72, color: "#ff9d5e" },
      { x: 1220, y: 164, w: 68, color: "#ff4fa8" },
      { x: 1338, y: 164, w: 96, color: "#58e8ff" }
    );
    for (let x = 130; x < w; x += 260) lampXs.push(x);
    waterSparkles.push({ x: 640, y: 120, w: 160 }, { x: 1450, y: 120, w: 170 });
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

  return {
    ultraFar,
    cloudRibbon,
    far,
    mid,
    street,
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
    this.bg1Assets = { skyImage: null, streetImage: null, roadImage: null };

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

    const rebuildAllBg1 = () => {
      for (const spec of SCENE_SPECS) {
        if (!spec.useBg1Layout) continue;
        const prev = this.cache.get(spec.id);
        if (prev?.custom) continue;
        this.cache.set(spec.id, buildSceneEntry(spec, this.bg1Assets));
        if (onReady) onReady(spec.id, { width: spec.width, height: HEIGHT });
      }
    };

    const loadImg = (src, key) => {
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        this.bg1Assets[key] = img;
        rebuildAllBg1();
      };
      img.src = src;
    };

    loadImg(firstBg1Spec.skyImage, "skyImage");
    loadImg(firstBg1Spec.streetImage, "streetImage");
    loadImg(firstBg1Spec.roadImage, "roadImage");
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
      ctx.imageSmoothingEnabled = false;
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
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, targetW, HEIGHT);

    // Detect if uploaded PNG has transparent sky so ultraFar/far/mid parallax stays visible
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

    ctx.fillStyle = "#101624";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (!entry.opaqueCustom) {
      // Layer 0: Ultra-far sky & distant sea (0.06x) + drifting cloud ribbon
      const uf = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.ultraFar.x, PARALLAX_LAYERS.ultraFar.y, strength);
      drawTiledLayer(ctx, entry.ultraFar, uf.x, -uf.y * 0.4);
      drawTiledLayer(ctx, entry.cloudRibbon, uf.x + time * 2.4, -uf.y * 0.4);

      // Layer 1: Far city skyline (0.20x) + blinking aviation beacons
      const farOff = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.far.x, PARALLAX_LAYERS.far.y, strength);
      drawTiledLayer(ctx, entry.far, farOff.x, -farOff.y * 0.55);

      if (Math.floor(time * 2) % 2 === 0 && entry.beacons.length) {
        ctx.fillStyle = "#ff4e78";
        const farMod = Math.round(wrapMod(farOff.x, entry.far.width));
        for (const b of entry.beacons) {
          let bx = b.x - farMod;
          if (bx < 0) bx += entry.far.width;
          if (bx >= 0 && bx < WIDTH) ctx.fillRect(bx, Math.round(b.y - farOff.y * 0.55), 2, 2);
        }
      }

      // Layer 2: Midground secondary buildings & palms (0.48x)
      const midOff = computeParallaxOffset(cameraX, cameraY, PARALLAX_LAYERS.mid.x, PARALLAX_LAYERS.mid.y, strength);
      drawTiledLayer(ctx, entry.mid, midOff.x, -midOff.y * 0.75);
    }

    // Layer 3: Near Main Street (1.00x)
    ctx.drawImage(entry.street, -Math.round(cameraX), -Math.round(cameraY));

    if (!entry.custom) {
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

      for (const ng of entry.neonGlows) {
        const sx = ng.x - cameraX;
        if (sx < -120 || sx > WIDTH + 120) continue;
        ctx.save();
        ctx.globalAlpha = (spec?.ambient === "neon" ? 0.14 : 0.09) + 0.025 * Math.sin(time * 2.5 + ng.x);
        ctx.fillStyle = ng.color;
        ctx.beginPath();
        ctx.ellipse(sx, ng.y - cameraY, ng.w * 0.5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const lampColor = spec?.ambient === "neon" ? "#4ff2ff" : "#ffd682";
      for (const wx of entry.lampXs) {
        const sx = wx - cameraX;
        if (sx < -60 || sx > WIDTH + 60) continue;
        ctx.save();
        ctx.globalAlpha = 0.06 + 0.018 * Math.sin(time * 3 + wx);
        ctx.fillStyle = lampColor;
        ctx.beginPath();
        ctx.moveTo(sx - 4, 72 - cameraY);
        ctx.lineTo(sx + 6, 72 - cameraY);
        ctx.lineTo(sx + 34, 154 - cameraY);
        ctx.lineTo(sx - 30, 154 - cameraY);
        ctx.closePath();
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
    const isNight = spec?.ambient === "neon";

    const silDark = "#0b0d1f";
    const silMid = "#151936";
    const rimCol = isNight ? "#48f2ff" : "#e8688c";
    const leafCol = isNight ? "#102438" : "#15232b";

    const { r, p } = pixels(ctx);

    for (const item of entry.fgItems) {
      const off = computeParallaxOffset(cameraX, cameraY, item.factor, 1.15, strength);
      const sx = Math.round(item.x * (1 + (item.factor - 1) * strength) - off.x);
      if (sx < -44 || sx > WIDTH + 44) continue;

      const nearPlayer = Math.abs(sx - playerScreenX) < 26;
      const baseAlpha = item.kind === "shrub" || item.kind === "bollard" ? 0.96 : nearPlayer ? 0.42 : 0.9;

      ctx.save();
      ctx.globalAlpha = baseAlpha;
      const yShift = Math.round(-off.y * 0.85);

      if (item.kind === "palm") {
        // Tall foreground palm trunk silhouette along bottom curb/edge
        const sway = Math.round(Math.sin(time * 1.4 + item.x * 0.03) * 1.5);
        const topX = sx + item.lean * 10 + sway;
        const baseY = HEIGHT + 8 + yShift;
        const topY = 124 + yShift;
        p(
          [
            [sx - 4, baseY],
            [sx + 3, baseY],
            [topX + 2, topY],
            [topX - 2, topY],
          ],
          silDark
        );
        // Rim highlight on sunlit edge
        p(
          [
            [sx + 2, baseY],
            [sx + 3, baseY],
            [topX + 2, topY],
            [topX + 1, topY],
          ],
          rimCol + "66"
        );
        // Canopy fronds framing top of viewport
        const fronds = [
          [-26, 6],
          [-18, -10],
          [0, -14],
          [18, -10],
          [26, 6],
        ];
        for (const [dx, dy] of fronds) {
          p([[topX, topY], [topX + Math.round(dx * 0.5), topY + dy - 4], [topX + dx, topY + dy + 5], [topX + Math.round(dx * 0.45), topY + 2]], leafCol);
          r(topX + Math.round(dx * 0.4), topY + dy - 3, 4, 1, rimCol + "88");
        }
      } else if (item.kind === "lamp") {
        // Foreground Art Deco boulevard lamp post passing across camera
        const ly = HEIGHT + 4 + yShift;
        r(sx - 2, 102 + yShift, 4, ly - (102 + yShift), silDark);
        r(sx + 1, 104 + yShift, 1, ly - (104 + yShift), rimCol + "55");
        r(sx - 7, 98 + yShift, 14, 4, silMid);
        r(sx - 4, 102 + yShift, 8, 3, isNight ? "#58f5ff" : "#ffd684");
      } else if (item.kind === "shrub") {
        // Low close-foreground tropical fern cluster along bottom screen edge (y=252..270)
        const by = HEIGHT + yShift;
        p([[sx - 18, by], [sx - 12, by - 13], [sx - 2, by - 9], [sx + 4, by - 16], [sx + 13, by - 10], [sx + 20, by]], silDark);
        r(sx - 6, by - 11, 5, 1, rimCol + "66");
        r(sx + 3, by - 15, 6, 1, rimCol + "66");
      } else {
        // Art Deco concrete bollard / parking meter silhouette
        const by = HEIGHT + yShift;
        r(sx - 3, by - 17, 6, 17, silDark);
        r(sx - 4, by - 19, 8, 3, silMid);
        r(sx - 2, by - 18, 4, 1, rimCol + "88");
      }
      ctx.restore();
    }
  }
}
