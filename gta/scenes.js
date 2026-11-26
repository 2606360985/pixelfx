import { pixels } from "./art.js";
import { SCENE_BY_ID, SCENE_SPECS, HEIGHT } from "./data.js";

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

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
    { x: 55, y: 24, s: 1.15 },
    { x: 215, y: 16, s: 1.35 },
    { x: 390, y: 28, s: 0.95 },
    { x: 530, y: 20, s: 1.2 },
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

// True 3-plane extruded 3D pixel building: front facade + angled shaded side wall + rooftop parapet/AC/vents
function drawVolumetricDecoBuilding(c, r, p, opts) {
  const { x, w, h, wall, shade, roofCol, trim, neon, sign, awning, darkMode = false } = opts;
  const top = 118 - h;
  const extrude = 14;
  const frontW = w - extrude;
  const ink = "#121626";

  // 1. Rooftop slab & 3D angled side wall
  p(
    [
      [x + 2, top],
      [x + extrude, top - 7],
      [x + w, top - 7],
      [x + frontW, top],
    ],
    roofCol || trim
  );
  p(
    [
      [x + frontW, top],
      [x + w, top - 7],
      [x + w, 118],
      [x + frontW, 118],
    ],
    shade
  );
  // Roof AC unit & vent extrusion
  const acX = x + Math.round(frontW * 0.62);
  r(acX, top - 11, 14, 6, "#2c3448");
  r(acX + 2, top - 10, 8, 4, "#7989a3");
  r(acX + 10, top - 10, 3, 4, "#4b5870");
  // Side wall recessed windows in shadow
  for (let sy = top + 16; sy < 104; sy += 20) {
    p([[x + frontW + 3, sy], [x + frontW + 10, sy - 4], [x + frontW + 10, sy + 5], [x + frontW + 3, sy + 9]], darkMode ? "#262b4a" : "#446278");
  }

  // 2. Stepped Art Deco ziggurat crown with extrusion
  const crownW = Math.round(frontW * 0.42);
  const crownX = x + Math.round((frontW - crownW) / 2);
  r(crownX, top - 11, crownW, 11, ink);
  r(crownX + 2, top - 9, crownW - 6, 9, wall);
  r(crownX + crownW - 5, top - 9, 4, 9, shade);
  r(crownX + Math.round(crownW / 2) - 4, top - 17, 8, 7, trim);
  r(crownX + 2, top - 9, crownW - 4, 2, neon);

  // 3. Main front facade + crisp shadow edge
  r(x, top, frontW, h, ink);
  r(x + 2, top + 2, frontW - 4, h - 2, wall);
  r(x - 2, top, frontW + 4, 3, trim);
  r(x + 2, top + 4, frontW - 4, 2, neon);
  r(x + 4, top + 29, frontW - 8, 2, trim);

  // Vertical glass-block stair tower flute
  const towerX = x + 7;
  r(towerX, top + 7, 13, h - 11, darkMode ? "#18233b" : "#5e9ab8");
  for (let gy = top + 10; gy < 110; gy += 6) {
    r(towerX + 2, gy, 9, 2, darkMode ? "#4ff2ff66" : "#dcf7ff99");
  }

  // Recessed Deco windows + 3D eyebrow sunshade drop shadow
  for (let wx = x + 26; wx < x + frontW - 20; wx += 24) {
    r(wx - 2, top + 11, 17, 2, trim);
    r(wx - 1, top + 13, 15, 2, "#0d122066");
    r(wx, top + 14, 13, 12, darkMode ? "#181e33" : "#253b52");
    r(wx + 2, top + 16, 9, 8, darkMode ? (wx % 48 === 0 ? "#ffd97d" : "#3a5678") : "#8bd4eb");
  }

  // 4. Signboard + striped 3D awning + lobby glow
  drawNeonSign(c, r, x + 24, top + 34, frontW - 34, 18, sign, neon);
  if (awning) {
    p([[x + 8, 86], [x + frontW - 8, 86], [x + frontW - 2, 97], [x + 3, 97]], awning[0]);
    for (let sx = x + 10; sx < x + frontW - 10; sx += 11) {
      p([[sx, 86], [sx + 5, 86], [sx + 3, 97], [sx - 2, 97]], awning[1]);
    }
    r(x + 6, 97, frontW - 12, 3, "#0d122055");
  }
  r(x + 14, 98, frontW - 28, 20, "#121626");
  r(x + 18, 100, frontW - 36, 17, darkMode ? "#2a1b3d" : "#443a4d");
  r(x + 22, 102, frontW - 44, 12, darkMode ? "#ff68b444" : "#ffd68a55");
}

function drawBeachGap(r, p, x, w, isNight = false) {
  // Transparent/open sky above y=76 lets Layer 1 & Layer 2 parallax shine through!
  r(x, 76, w, 18, isNight ? "#162d47" : "#228599");
  r(x, 82, w, 3, isNight ? "#244769" : "#40b6c4");
  r(x, 92, w, 2, isNight ? "#507896" : "#d8f7fa");
  r(x, 94, w, 24, isNight ? "#575166" : "#e8d2a6");
  r(x, 94, w, 3, isNight ? "#484459" : "#d4ba8b");
  r(x, 113, w, 5, isNight ? "#4e536e" : "#d6c8b6");
  r(x, 112, w, 1, "#182030");
  if (w >= 110) {
    const lx = x + Math.round(w * 0.44);
    r(lx, 96, 2, 14, "#85654e");
    r(lx + 16, 96, 2, 14, "#85654e");
    r(lx - 2, 86, 20, 11, isNight ? "#2a4763" : "#44d4c8");
    r(lx + 16, 86, 5, 11, isNight ? "#1c3145" : "#2b9e96");
    p([[lx - 4, 86], [lx + 9, 79], [lx + 23, 86]], isNight ? "#453359" : "#ff6e9c");
    r(lx + 3, 89, 10, 5, "#1b2838");
  }
  for (let ux = x + 26; ux < x + w - 24; ux += 64) {
    r(ux, 100, 1, 13, "#705644");
    p([[ux - 9, 101], [ux, 95], [ux + 10, 101]], ux % 2 ? "#ff689c" : "#3ce0cc");
  }
}

function paintGTA6Boulevard(c, width, theme) {
  const { r, p } = pixels(c);
  r(0, 118, width, 28, theme.sidewalk);
  r(0, 144, width, 3, theme.curb);
  r(0, 147, width, 1, "#111622");
  for (let x = 0; x < width; x += 28) {
    r(x, 118, 1, 26, theme.sidewalkLine);
    r(x + 2, 144, 22, 1, "#ffffff2e");
  }
  for (let x = 14; x < width; x += 56) {
    r(x, 131, 26, 1, theme.sidewalkLine);
  }

  r(0, 148, width, 89, theme.asphalt);
  r(0, 148, width, 8, theme.asphaltShade);
  r(0, 229, width, 8, theme.asphaltShade);

  for (let i = 0; i < Math.floor(width / 8); i++) {
    const x = (i * 173) % (width - 18);
    const y = 152 + ((i * 29) % 80);
    r(x, y, 4 + (i % 9), 1, i % 2 === 0 ? theme.asphaltSpeckA : theme.asphaltSpeckB);
  }
  for (const wy of [156, 178, 202, 222]) {
    r(0, wy, width, 2, "#00000018");
  }

  for (let x = 12; x < width; x += 40) {
    r(x, 169, 18, 2, "#d8e0eb99");
    r(x, 214, 18, 2, "#d8e0eb99");
  }

  r(0, 190, width, 1, "#f2b84b");
  r(0, 193, width, 1, "#f2b84b");

  for (let x = 260; x < width - 100; x += 480) {
    for (let y = 151; y < 234; y += 8) {
      r(x, y, 14, 4, "#e6ecf5aa");
    }
    r(x - 65, 160, 14, 2, "#d8e0eb88");
    p([[x - 71, 161], [x - 63, 157], [x - 63, 165]], "#d8e0eb88");
    r(x + 48, 223, 14, 2, "#d8e0eb88");
    p([[x + 68, 224], [x + 60, 220], [x + 60, 228]], "#d8e0eb88");
  }

  for (let x = 160; x < width; x += 320) {
    r(x, 148, 12, 3, "#141924");
    r(x + 2, 149, 2, 2, "#354157");
    r(x + 6, 149, 2, 2, "#354157");
  }

  r(0, 237, width, 3, theme.curb);
  r(0, 240, width, 30, theme.bottomWalk);
  for (let x = 0; x < width; x += 24) {
    r(x, 240, 1, 30, theme.sidewalkLine);
  }
}

function buildProceduralScene(spec) {
  const w = spec.width || 2400;

  // Layer 0+1: Far sky & distant skyline (640x118)
  const far = document.createElement("canvas");
  far.width = 640;
  far.height = 118;
  const fc = far.getContext("2d");
  const fp = pixels(fc);

  // Layer 2: Midground bay / trees / causeway (640x118 transparent background)
  const mid = document.createElement("canvas");
  mid.width = 640;
  mid.height = 118;
  const mc = mid.getContext("2d");
  const mp = pixels(mc);

  // Layer 3: Main street canvas (w x 270, transparent sky above y=118 where no building sits!)
  const street = document.createElement("canvas");
  street.width = w;
  street.height = HEIGHT;
  const sc = street.getContext("2d");
  const sp = pixels(sc);

  const lampXs = [];
  const fgPalms = [];
  const beacons = [];
  const waterSparkles = [];
  const neonGlows = [];

  if (spec.ambient === "sunset") {
    ditherSky(fc, 640, 82, ["#241b52", "#582a6e", "#a13d6c", "#e06266", "#ff9b5e", "#ffd478"]);
    drawCumulusClouds(fp.r, fp.p, { top: "#ffecc2", mid: "#f7a27e", base: "#8a4c7a" });
    fp.r(478, 28, 32, 32, "#ffd970");
    fp.r(482, 32, 24, 24, "#fff3b8");
    fp.r(0, 78, 640, 40, "#1c5f78");
    fp.r(0, 78, 640, 8, "#267c94");
    fp.r(464, 79, 58, 3, "#ffbe73aa");
    fp.r(474, 85, 38, 2, "#ff996eaa");
    for (let i = 0; i < 14; i++) {
      const bx = i * 48 + (i % 2) * 6;
      const bh = 24 + ((i * 17) % 38);
      fp.r(bx, 82 - bh, 26, bh, i % 2 ? "#422b5e" : "#54336b");
      fp.r(bx + 26, 82 - bh, 6, bh, "#2d1d42");
      fp.r(bx + 2, 82 - bh, 22, 2, "#ff87b2");
      for (let wy = 86 - bh; wy < 78; wy += 6) {
        fp.r(bx + 5, wy, 3, 2, (i + wy) % 4 === 0 ? "#ffe296" : "#6c4885");
        fp.r(bx + 14, wy, 3, 2, "#6c4885");
      }
      if (bh > 46) beacons.push({ x: bx + 12, y: 80 - bh });
    }

    // Layer 2 Midground: distant causeway silhouette & palm ridge
    for (let i = 0; i < 8; i++) {
      drawCurvedPalm(mp.r, mp.p, 38 + i * 84, 86, 0.55, i % 2 ? 1 : -1, {
        trunk: "#38284a",
        lit: "#5e3d6b",
        frondDark: "#2d2445",
        frondMid: "#47355c",
        frondLit: "#875375",
      });
    }

    paintGTA6Boulevard(sc, w, {
      sidewalk: "#d6c2ae",
      sidewalkLine: "#b5a08c",
      curb: "#917f6f",
      asphalt: "#2d3242",
      asphaltShade: "#242938",
      asphaltSpeckA: "#3c435766",
      asphaltSpeckB: "#1e223066",
      bottomWalk: "#aa9683",
    });

    const layout = [
      { kind: "deco", x: 36, w: 184, h: 80, wall: "#ffe0cc", shade: "#c99b8d", roofCol: "#fff1e0", trim: "#fff4e6", neon: "#ff5ca8", sign: "PALM DECO", awning: ["#ff6b9d", "#fff2e6"] },
      { kind: "beach", x: 226, w: 174 },
      { kind: "deco", x: 410, w: 190, h: 86, wall: "#c4f0e8", shade: "#7db3aa", roofCol: "#e6fff9", trim: "#f5fffc", neon: "#38f0d4", sign: "CORAL SUITES", awning: ["#32c7b4", "#fff5e6"] },
      { kind: "beach", x: 606, w: 120 },
      { kind: "deco", x: 734, w: 178, h: 76, wall: "#d4e2ff", shade: "#8ba1d1", roofCol: "#edf4ff", trim: "#ffffff", neon: "#4fe8ff", sign: "霓虹捷运站", awning: ["#3c88e0", "#e6f5ff"] },
      { kind: "beach", x: 918, w: 184 },
      { kind: "deco", x: 1110, w: 202, h: 84, wall: "#ffe8bd", shade: "#c9a871", roofCol: "#fff6e0", trim: "#fff9eb", neon: "#ff9b42", sign: "OCEAN DINER", awning: ["#e87b38", "#fff3db"] },
      { kind: "beach", x: 1318, w: 164 },
      { kind: "deco", x: 1490, w: 176, h: 78, wall: "#ffd4e8", shade: "#c48ea9", roofCol: "#ffebf4", trim: "#fff2f8", neon: "#ff52a8", sign: "TROPIC WAVE", awning: ["#e84c96", "#ffeaf4"] },
      { kind: "deco", x: 1672, w: 166, h: 74, wall: "#c9efe2", shade: "#87b5a6", roofCol: "#ebfff8", trim: "#f5fffa", neon: "#42f2dc", sign: "海滨栈道", awning: ["#2fa899", "#e6fff8"] },
      { kind: "beach", x: 1844, w: 208 },
      { kind: "deco", x: 2060, w: 224, h: 86, wall: "#e3d6ff", shade: "#a391cc", roofCol: "#f4edff", trim: "#f8f5ff", neon: "#b87dff", sign: "SUNSET CLUB", awning: ["#8d5ce6", "#f2ebff"] },
    ];
    for (const item of layout) {
      if (item.kind === "deco") {
        drawVolumetricDecoBuilding(sc, sp.r, sp.p, item);
        neonGlows.push({ x: item.x + item.w * 0.45, y: 162, w: item.w * 0.65, color: item.neon });
      } else {
        drawBeachGap(sp.r, sp.p, item.x, item.w, false);
        waterSparkles.push({ x: item.x + 24, y: 80, w: item.w - 48 });
      }
    }

    for (let x = 140; x < w; x += 240) {
      lampXs.push(x);
      drawCurvedPalm(sp.r, sp.p, x + 78, 122, 1.05, x % 480 === 140 ? 1 : -1);
      sp.p([[x + 78, 122], [x + 84, 122], [x + 62, 147], [x + 56, 147]], "#12162433");
      fgPalms.push(x + 30);
    }
  } else if (spec.ambient === "neon") {
    ditherSky(fc, 640, 118, ["#09081a", "#141030", "#221647", "#361c5c", "#4d226e"]);
    for (let i = 0; i < 16; i++) {
      const bx = i * 42;
      const bh = 42 + ((i * 23) % 60);
      fp.r(bx, 118 - bh, 32, bh, i % 2 ? "#151630" : "#1d1a3d");
      fp.r(bx + 32, 118 - bh, 6, bh, "#0e0e22");
      fp.r(bx + 2, 118 - bh, 30, 2, i % 2 ? "#42f2ff" : "#ff4fa8");
      for (let wy = 124 - bh; wy < 110; wy += 6) {
        fp.r(bx + 5, wy, 3, 2, (i + wy) % 3 === 0 ? "#4ef2ff" : "#ff5da8");
        fp.r(bx + 15, wy, 3, 2, (i + wy) % 2 === 0 ? "#ffd96b" : "#28224f");
      }
      if (bh > 74) beacons.push({ x: bx + 16, y: 115 - bh });
    }
    // Midground neon bridge & skyline silhouettes
    mp.r(0, 92, 640, 3, "#1f2547");
    for (let x = 20; x < 640; x += 64) {
      mp.r(x, 76, 3, 22, "#2a3059");
      mp.r(x - 1, 75, 5, 2, "#42f2ff88");
    }

    paintGTA6Boulevard(sc, w, {
      sidewalk: "#484d69",
      sidewalkLine: "#2f334a",
      curb: "#727899",
      asphalt: "#1b1f2e",
      asphaltShade: "#141724",
      asphaltSpeckA: "#2d334a66",
      asphaltSpeckB: "#11142066",
      bottomWalk: "#353954",
    });

    const clubs = [
      { x: 40, w: 192, h: 84, sign: "CLUB PULSE", neon: "#ff4fa8", wall: "#242240" },
      { x: 350, w: 186, h: 80, sign: "NEON ARCADE", neon: "#42f2ff", wall: "#1e2742" },
      { x: 630, w: 178, h: 76, sign: "海滨环线口", neon: "#42f2ff", wall: "#202b47" },
      { x: 930, w: 198, h: 86, sign: "MIAMI LOUNGE", neon: "#ff72c0", wall: "#2b2042" },
      { x: 1250, w: 192, h: 82, sign: "SYNTH AUTO", neon: "#ffd452", wall: "#24253d" },
      { x: 1580, w: 184, h: 80, sign: "跨海高架口", neon: "#42f2ff", wall: "#1d2740" },
      { x: 1920, w: 210, h: 88, sign: "STARLIGHT VIP", neon: "#c46eff", wall: "#261f45" },
    ];
    for (const cl of clubs) {
      drawVolumetricDecoBuilding(sc, sp.r, sp.p, {
        ...cl,
        shade: "#121426",
        roofCol: "#2d3254",
        trim: "#5e688c",
        darkMode: true,
        awning: [cl.neon + "bb", "#1c2038"],
      });
      sp.r(cl.x + 28, 176 + (cl.x % 3) * 14, cl.w - 64, 5, cl.neon + "33");
      sp.r(cl.x + 42, 178 + (cl.x % 3) * 14, cl.w - 92, 2, cl.neon + "66");
      neonGlows.push({ x: cl.x + cl.w * 0.45, y: 170, w: cl.w * 0.7, color: cl.neon });
    }
    for (const gx of [238, 542, 814, 1134, 1448, 1770, 2138]) {
      drawBeachGap(sp.r, sp.p, gx, 106, true);
    }
    for (let x = 130; x < w; x += 250) {
      lampXs.push(x);
      drawCurvedPalm(sp.r, sp.p, x + 95, 122, 0.95, 1, {
        trunk: "#1a1f30",
        lit: "#403c63",
        frondDark: "#122438",
        frondMid: "#1e425c",
        frondLit: "#429eb5",
      });
      fgPalms.push(x + 45);
    }
  } else if (spec.ambient === "harbor") {
    ditherSky(fc, 640, 82, ["#1c4266", "#2a638c", "#4289ab", "#72b0c2", "#b5d6d6"]);
    drawCumulusClouds(fp.r, fp.p, { top: "#ffffff", mid: "#d2ebef", base: "#84a9ba" });
    fp.r(0, 80, 640, 38, "#1b5878");
    fp.r(0, 80, 640, 5, "#338ba8");
    for (let i = 0; i < 4; i++) {
      const cx = 75 + i * 170;
      fp.r(cx, 26, 4, 56, "#3b4f63");
      fp.r(cx - 10, 26, 48, 4, "#526980");
      fp.r(cx + 22, 30, 2, 22, "#243140");
    }
    fp.r(340, 62, 128, 22, "#263647");
    fp.r(356, 48, 36, 14, "#405469");
    // Midground harbor sailboats
    for (let sx = 90; sx < 600; sx += 170) {
      mp.r(sx, 88, 16, 4, "#d8e6f0");
      mp.p([[sx + 8, 66], [sx + 8, 86], [sx + 16, 86]], "#f0f7fc");
    }

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

      // Volumetric 3D-extruded shipping container & marina office
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
    ditherSky(fc, 640, 86, ["#1b1e33", "#362c4a", "#664659", "#a3675b", "#d69463"]);
    drawCumulusClouds(fp.r, fp.p, { top: "#ffd69c", mid: "#b87a6a", base: "#573d52" });
    fp.r(0, 86, 640, 32, "#243b3b");
    for (let i = 0; i < 20; i++) {
      const tx = i * 32;
      fp.r(tx + 10, 50 + (i % 3) * 8, 5, 48, "#1b2924");
      fp.p([[tx, 60], [tx + 12, 38], [tx + 25, 60]], "#243d31");
    }
    for (let i = 0; i < 10; i++) {
      drawCurvedPalm(mp.r, mp.p, 35 + i * 64, 98, 0.65, 1, {
        trunk: "#222620",
        lit: "#3e4034",
        frondDark: "#192b21",
        frondMid: "#243d2d",
        frondLit: "#3a5c3c",
      });
    }

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
        sp.r(bx, 84, 210, 34, "#234240");
        sp.r(bx, 90, 210, 2, "#42736b");
        waterSparkles.push({ x: bx + 20, y: 88, w: 170 });
        drawCurvedPalm(sp.r, sp.p, bx + 45, 118, 0.95, 1, {
          trunk: "#282a26",
          lit: "#4f4a3c",
          frondDark: "#1b3326",
          frondMid: "#2b4f39",
          frondLit: "#4d784e",
        });
        drawCurvedPalm(sp.r, sp.p, bx + 150, 118, 0.85, -1, {
          trunk: "#282a26",
          lit: "#4f4a3c",
          frondDark: "#1b3326",
          frondMid: "#2b4f39",
          frondLit: "#4d784e",
        });
      } else {
        // Volumetric extruded roadside motel
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
      fgPalms.push(bx + 90);
    }
  }

  for (const lx of lampXs) {
    sp.r(lx, 54, 3, 66, "#171d29");
    sp.r(lx + 1, 56, 1, 62, "#65748c");
    sp.r(lx - 4, 52, 12, 3, "#263042");
    sp.r(lx - 2, 55, 8, 2, "#ffe494");
  }

  return { far, mid, street, lampXs, fgPalms, beacons, waterSparkles, neonGlows, width: w, custom: false };
}

export class SceneManager {
  constructor(onCustomReady = null) {
    this.cache = new Map();
    for (const spec of SCENE_SPECS) {
      this.cache.set(spec.id, buildProceduralScene(spec));
      if (spec.bgImage && typeof Image !== "undefined") {
        const img = new Image();
        img.onload = () => {
          const res = this.setCustomBackground(spec.id, img, "bg");
          if (res && onCustomReady) onCustomReady(spec.id, res);
        };
        img.src = spec.bgImage;
      }
      if (spec.farImage && typeof Image !== "undefined") {
        const farImg = new Image();
        farImg.onload = () => this.setCustomBackground(spec.id, farImg, "far");
        farImg.src = spec.farImage;
      }
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
      fc.height = 118;
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

    entry.street = sc;
    entry.width = targetW;
    entry.custom = true;
    spec.width = targetW;
    return { width: targetW, height: HEIGHT };
  }

  resetSceneBackground(sceneId) {
    const spec = SCENE_BY_ID[sceneId];
    if (!spec) return;
    spec.width = 2400;
    this.cache.set(sceneId, buildProceduralScene(spec));
  }

  draw(ctx, sceneId, cameraX, time) {
    const entry = this.get(sceneId);
    const spec = SCENE_BY_ID[sceneId];
    ctx.fillStyle = "#101624";
    ctx.fillRect(0, 0, 480, HEIGHT);

    if (!entry.custom) {
      const farShift = Math.round(cameraX * 0.2) % 320;
      ctx.drawImage(entry.far, -farShift, 0);
      if (640 - farShift < 480) ctx.drawImage(entry.far, 640 - farShift, 0);

      // Layer 2 midground parallax
      const midShift = Math.round(cameraX * 0.45) % 320;
      ctx.drawImage(entry.mid, -midShift, 0);
      if (640 - midShift < 480) ctx.drawImage(entry.mid, 640 - midShift, 0);

      if (Math.floor(time * 2) % 2 === 0) {
        ctx.fillStyle = "#ff4e78";
        for (const b of entry.beacons) {
          const bx = b.x - farShift;
          if (bx >= 0 && bx < 480) ctx.fillRect(bx, b.y, 2, 2);
        }
      }
    }

    ctx.drawImage(entry.street, -Math.round(cameraX), 0);

    if (!entry.custom) {
      ctx.fillStyle = spec?.ambient === "bayou" ? "#ffd88a88" : "#d9ffff99";
      for (const ws of entry.waterSparkles) {
        const sx = ws.x - cameraX;
        if (sx + ws.w < 0 || sx > 480) continue;
        for (let k = 0; k < 4; k++) {
          const px = sx + ((Math.floor(time * 3 + k * 37) * 29 + k * 19) % Math.max(12, ws.w));
          const py = ws.y + ((k * 3) % 9);
          ctx.fillRect(Math.round(px), py, 4, 1);
        }
      }

      // Soft neon pools on asphalt beneath signs
      for (const ng of entry.neonGlows) {
        const sx = ng.x - cameraX;
        if (sx < -120 || sx > 600) continue;
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.02 * Math.sin(time * 2.5 + ng.x);
        ctx.fillStyle = ng.color;
        ctx.beginPath();
        ctx.ellipse(sx, ng.y, ng.w * 0.5, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const lampColor = spec?.ambient === "neon" ? "#4ff2ff" : "#ffd682";
      for (const wx of entry.lampXs) {
        const sx = wx - cameraX;
        if (sx < -60 || sx > 540) continue;
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.02 * Math.sin(time * 3 + wx);
        ctx.fillStyle = lampColor;
        ctx.beginPath();
        ctx.moveTo(sx - 4, 57);
        ctx.lineTo(sx + 6, 57);
        ctx.lineTo(sx + 38, 146);
        ctx.lineTo(sx - 34, 146);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawForeground(ctx, sceneId, cameraX) {
    const entry = this.get(sceneId);
    if (entry.custom) return;
    const { r, p } = pixels(ctx);
    const fgShift = cameraX * 1.16;
    for (const wx of entry.fgPalms) {
      const sx = wx * 1.16 - fgShift;
      if (sx < -30 || sx > 510) continue;
      r(sx, 250, 4, 20, "#0b141c");
      p([[sx - 8, 250], [sx - 14, 240], [sx - 2, 244], [sx + 3, 236], [sx + 8, 244], [sx + 16, 240], [sx + 10, 250]], "#102129");
    }
  }
}
