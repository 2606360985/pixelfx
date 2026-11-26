// Original procedural pixel art for Neon Coast 2D (no external copyrighted assets).
export function pixels(c) {
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  const p = (points, color) => {
    const min = Math.floor(Math.min(...points.map((v) => v[1])));
    const max = Math.ceil(Math.max(...points.map((v) => v[1])));
    for (let y = min; y < max; y++) {
      const edges = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) {
          edges.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      edges.sort((a, b) => a - b);
      for (let i = 0; i + 1 < edges.length; i += 2) {
        r(Math.ceil(edges[i]), y, Math.max(1, Math.floor(edges[i + 1]) - Math.ceil(edges[i])), 1, color);
      }
    }
  };
  const l = (x, y, tx, ty, color, width = 1) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(tx - x), Math.abs(ty - y))));
    for (let i = 0; i <= n; i++) r(x + ((tx - x) * i) / n, y + ((ty - y) * i) / n, width, width, color);
  };
  return { r, p, l };
}

export function drawPortrait(canvas, hero) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingEnabled = false;
  c.save();
  c.scale(canvas.width / 64, canvas.height / 64);
  const { r, p } = pixels(c);
  const ink = "#101824";

  // Backdrop neon gradient card
  r(0, 0, 64, 64, hero.id === "rico" ? "#152b3b" : "#2e1a36");
  r(0, 40, 64, 24, hero.id === "rico" ? "#1e4252" : "#44224a");
  r(4, 4, 56, 2, hero.trim);

  if (hero.id === "rico") {
    // Shoulders & open teal Hawaiian shirt over white tee
    p([[10, 64], [14, 42], [50, 42], [54, 64]], ink);
    p([[12, 64], [16, 44], [48, 44], [52, 64]], "#29a89a");
    r(25, 44, 14, 20, "#f5f2ea");
    // Tropical shirt leaves
    r(16, 49, 4, 3, "#ff72a6");
    r(43, 52, 5, 3, "#ffcf5e");
    r(18, 57, 5, 2, "#87ffe6");
    // Gold chain
    r(27, 46, 10, 1, "#ffd25a");
    // Neck & head
    r(26, 36, 12, 9, "#c48c64");
    p([[20, 14], [44, 14], [46, 32], [38, 40], [26, 40], [18, 32]], ink);
    p([[22, 16], [42, 16], [44, 31], [37, 38], [27, 38], [20, 31]], "#e3ae84");
    // Short styled hair
    p([[18, 22], [20, 11], [34, 9], [45, 13], [46, 22], [41, 18], [24, 18]], "#1b2029");
    // Shades
    r(22, 22, 9, 5, "#101622");
    r(33, 22, 9, 5, "#101622");
    r(30, 23, 4, 2, "#ff72a6");
    r(23, 23, 3, 1, "#6df5ff");
    r(34, 23, 3, 1, "#6df5ff");
    // Grin
    r(29, 33, 7, 2, "#8c4d3e");
    r(30, 33, 5, 1, "#fff2e0");
  } else {
    // High ponytail
    p([[11, 20], [19, 13], [22, 24], [13, 34], [8, 30]], "#38221d");
    p([[12, 21], [18, 15], [20, 23], [13, 31]], "#663f35");
    // Cropped neon pink jacket + teal top
    p([[13, 64], [17, 43], [47, 43], [51, 64]], ink);
    p([[15, 64], [19, 45], [45, 45], [49, 64]], "#ff6e9c");
    r(25, 46, 14, 18, "#38d4bf");
    r(25, 58, 14, 6, "#2c4c7a");
    // Neck & head
    r(27, 37, 10, 8, "#cfa078");
    p([[21, 15], [43, 15], [44, 32], [36, 39], [28, 39], [20, 32]], ink);
    p([[23, 17], [41, 17], [42, 31], [36, 37], [28, 37], [22, 31]], "#edb991");
    // Hair & sunglasses pushed on head
    p([[20, 22], [22, 11], [38, 10], [44, 18], [43, 24], [38, 18], [25, 19]], "#4d3129");
    r(24, 13, 7, 4, "#162030");
    r(33, 13, 7, 4, "#162030");
    r(31, 14, 2, 2, "#44e2cc");
    // Eyes & smile
    r(26, 25, 2, 3, ink);
    r(36, 25, 2, 3, ink);
    r(29, 32, 6, 2, "#b55264");
  }
  c.restore();
}

export function dressProtagonist(c, actor, joints) {
  const { r, l } = pixels(c);
  const h = joints.head;
  const chest = joints.chest;
  const waist = joints.waist;
  const ink = "#101824";

  // Hair base
  r(h[0] - 4, h[1] - 5, 8, 4, actor.hair);
  r(h[0] - 5, h[1] - 3, 3, 5, actor.hair);

  if (actor.id === "rico") {
    // Cool aviator sunglasses, crisp white inner tee, tropical palm accent & gold chain
    r(h[0] - 1, h[1] - 6, 6, 2, actor.hair);
    r(h[0] + 1, h[1] - 1, 5, 2, ink);
    r(h[0] + 2, h[1] - 1, 2, 1, "#5ef2ff");
    l(chest[0] + 1, chest[1] - 2, waist[0] + 1, waist[1] + 2, "#f7f5ee", 2);
    r(chest[0] - 1, chest[1] - 1, 3, 1, "#ffd25a");
    r(chest[0] - 4, chest[1] + 1, 2, 2, actor.trim);
    r(waist[0] - 3, waist[1] - 1, 2, 2, "#ffd96b");
  } else {
    // Lumi high flowing brown ponytail, sunglasses on forehead, cropped neon pink jacket & cyan top
    r(h[0] - 8, h[1] - 4, 4, 6, actor.hair);
    r(h[0] - 10, h[1] - 2, 3, 4, actor.hair);
    r(h[0] - 5, h[1] - 5, 3, 2, actor.trim);
    r(h[0] + 1, h[1] - 4, 3, 2, ink);
    r(h[0] + 2, h[1], 2, 1, ink);
    r(h[0] + 2, h[1] + 2, 2, 1, "#c4536b");
    l(chest[0] + 1, chest[1] - 1, waist[0] + 1, waist[1] + 1, actor.trim, 2);
    r(chest[0] - 3, chest[1] + 1, 3, 2, "#ff9ac4");
  }
}

export function dressPedestrian(c, ped, joints) {
  const { r } = pixels(c);
  const h = joints.head;
  const chest = joints.chest;
  const ink = "#101824";

  if (ped.type === "police") {
    // Police cap & gold badge
    r(h[0] - 5, h[1] - 6, 10, 3, "#1d2b42");
    r(h[0] - 1, h[1] - 6, 7, 1, "#f0cc69");
    r(h[0] + 2, h[1] - 3, 4, 1, ink);
    r(chest[0] + 2, chest[1], 2, 2, "#ffd96b");
  } else if (ped.type === "vendor") {
    r(h[0] - 4, h[1] - 5, 9, 2, "#e8d194");
    r(chest[0] - 3, chest[1] - 1, 6, 8, "#f3e6c8");
  } else if (ped.type === "brawler") {
    r(h[0] - 4, h[1] - 4, 8, 2, "#eb4d4d");
    r(h[0] + 2, h[1], 2, 1, ink);
  } else if (ped.type === "skater") {
    r(h[0] - 4, h[1] - 6, 8, 3, "#5df2d6");
    r(h[0] - 1, h[1] - 2, 3, 3, "#18212e");
  } else {
    // Tourist shades / straw hat brim
    r(h[0] - 5, h[1] - 5, 11, 2, "#f0cf7b");
    r(h[0] + 1, h[1] - 1, 3, 2, ink);
  }
}

function drawWheel(r, cx, cy, rad, phase) {
  r(cx - rad, cy - rad, rad * 2, rad * 2, "#121720");
  r(cx - rad + 1, cy - rad + 1, rad * 2 - 2, rad * 2 - 2, "#242c3a");
  r(cx - Math.max(1, rad - 2), cy - Math.max(1, rad - 2), (rad - 1) * 2 - 1, (rad - 1) * 2 - 1, "#9aa8bd");
  const sx = Math.round(Math.cos(phase) * (rad - 2));
  const sy = Math.round(Math.sin(phase) * (rad - 2));
  r(cx + sx, cy + sy, 1, 1, "#e8f2ff");
  r(cx - sx, cy - sy, 1, 1, "#e8f2ff");
}

export function drawVehicle(c, v, time, drawRidersFn) {
  const { r, p } = pixels(c);
  const spec = v.spec;
  const ink = "#101824";
  const body = v.color;
  const dark = v.darkColor;
  const halfW = Math.round(spec.w / 2);

  // Soft ground shadow
  c.save();
  c.globalAlpha = 0.45;
  c.fillStyle = "#0b111c";
  c.beginPath();
  c.ellipse(0, 2, halfW + 2, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.save();
  c.scale(v.face, 1);
  if (v.spec.kind === "tricycle" && v.nitroActive) {
    c.rotate(-0.08);
  } else if (v.z > 4) {
    c.rotate(-Math.min(0.16, v.vz * 0.0007));
  }

  const bob = (Math.abs(v.vx) > 25 ? Math.round(Math.sin(time * 24 + v.id) * 0.6) : 0) + Math.round(v.suspY || 0);

  if (spec.kind === "tricycle") {
    // Tricycle: mobility scooter / cargo electric trike with strictly cockpit-clipped riders
    const rearX = -12;
    const frontX = 12;
    if (spec.id === "trike_cargo") {
      // Far cargo backplate & backrest
      r(-20, -16 + bob, 22, 6, "#1a2230");
      r(2, -16 + bob, 6, 4, "#242c3c");
      // Clip riders strictly above cargo/floorboard line so legs never protrude below trike
      if (drawRidersFn) {
        c.save();
        c.beginPath();
        c.rect(-24, -52, 48, 52 + (-9 + bob));
        c.clip();
        drawRidersFn(c, bob);
        c.restore();
      }
      // Near-side cargo box, cab, handlebar & canopy frame drawn ON TOP of seated riders' lower bodies
      r(-20, -14 + bob, 22, 10, ink);
      r(-19, -13 + bob, 20, 8, body);
      r(-19, -13 + bob, 20, 2, "#d8efe5");
      r(2, -13 + bob, 14, 9, ink);
      r(3, -12 + bob, 12, 7, body);
      r(8, -22 + bob, 3, 10, "#9ab0c4");
      r(6, -23 + bob, 6, 2, "#243040");
      r(-20, -28 + bob, 32, 2, "#dce8ef");
      r(-19, -28 + bob, 2, 15, "#8396a8");
      r(9, -28 + bob, 2, 15, "#8396a8");
    } else {
      // Mobility trike ("老头乐" open-top scooter): seatback first, clip riders above floor, then body & front shield
      r(-14, -17 + bob, 8, 5, "#242b3a");
      if (drawRidersFn) {
        c.save();
        c.beginPath();
        c.rect(-22, -52, 44, 52 + (-9 + bob));
        c.clip();
        drawRidersFn(c, bob);
        c.restore();
      }
      r(-16, -13 + bob, 29, 9, ink);
      r(-15, -12 + bob, 27, 7, body);
      r(-14, -12 + bob, 24, 2, "#fff3d1");
      r(8, -22 + bob, 2, 11, "#cfd9e6");
      r(6, -23 + bob, 6, 2, "#1c2432");
      r(11, -17 + bob, 5, 5, "#a68558");
    }
    // Wheels (rear pair + front wheel)
    drawWheel(r, rearX - 2, -3, 4, v.wheelPhase);
    drawWheel(r, rearX + 4, -2, 4, v.wheelPhase + 0.4);
    drawWheel(r, frontX, -2, 4, v.wheelPhase);
    // Headlight & tail light
    r(frontX + 2, -10 + bob, 3, 3, "#fff29e");
    r(-halfW + 1, -10 + bob, 2, 3, "#ff4d63");
  } else {
    // Cars (convertible, muscle, sedan, police)
    const bodyY = -15 + bob;
    const bodyH = 11;

    if (spec.openTop) {
      // Open-top convertible: interior backing -> clipped riders -> outer door/chassis -> windshield
      r(-16, bodyY - 2, 24, 3, "#273042");
      if (drawRidersFn) {
        c.save();
        c.beginPath();
        c.rect(-halfW, -52, spec.w, 52 + bodyY + 1);
        c.clip();
        drawRidersFn(c, bob);
        c.restore();
      }
    } else {
      // Closed roof cabin: cabin interior backing -> window-clipped riders -> glass sheen -> solid outer shell
      const roofCol = spec.isPolice ? "#eef5ff" : body;
      p([[-18, bodyY + 1], [-12, bodyY - 9], [10, bodyY - 9], [17, bodyY + 1]], ink);
      p([[-16, bodyY + 1], [-11, bodyY - 8], [9, bodyY - 8], [15, bodyY + 1]], roofCol);
      // Dark interior behind window openings
      p([[-14, bodyY], [-10, bodyY - 7], [9, bodyY - 7], [13, bodyY]], "#172133");
      if (drawRidersFn) {
        c.save();
        c.beginPath();
        c.moveTo(-14, bodyY);
        c.lineTo(-10, bodyY - 7);
        c.lineTo(9, bodyY - 7);
        c.lineTo(13, bodyY);
        c.closePath();
        c.clip();
        drawRidersFn(c, bob);
        c.restore();
      }
      // Translucent glass tint & reflections over clipped riders + B-pillar
      c.save();
      c.globalAlpha = 0.28;
      p([[-14, bodyY], [-10, bodyY - 7], [-1, bodyY - 7], [-1, bodyY]], "#86d5f7");
      p([[1, bodyY], [1, bodyY - 7], [9, bodyY - 7], [13, bodyY]], "#9be6ff");
      c.restore();
      r(-1, bodyY - 7, 2, 7, ink);
      r(4, bodyY - 6, 2, 5, "#ffffff55");
      if (spec.isPolice) {
        const redOn = Math.floor(time * 8) % 2 === 0;
        r(-5, bodyY - 11, 4, 2, redOn ? "#ff385c" : "#6b1b2b");
        r(-1, bodyY - 11, 4, 2, redOn ? "#1c3f6e" : "#40b7ff");
      }
    }

    // Main outer chassis & doors drawn AFTER riders so lower body is always covered cleanly
    p(
      [
        [-halfW, bodyY + bodyH],
        [-halfW + 1, bodyY + 2],
        [-halfW + 8, bodyY],
        [halfW - 10, bodyY],
        [halfW - 1, bodyY + 3],
        [halfW, bodyY + bodyH],
      ],
      ink
    );
    p(
      [
        [-halfW + 1, bodyY + bodyH - 1],
        [-halfW + 2, bodyY + 3],
        [-halfW + 9, bodyY + 1],
        [halfW - 10, bodyY + 1],
        [halfW - 2, bodyY + 4],
        [halfW - 1, bodyY + bodyH - 1],
      ],
      body
    );

    if (!spec.openTop && spec.isPolice) {
      r(-10, bodyY + 2, 20, 8, "#eef5ff");
      r(-3, bodyY + 4, 6, 3, "#e3b94f");
    }

    // Highlight stripe & bumper chrome
    r(-halfW + 4, bodyY + 2, spec.w - 14, 2, "#ffffff44");
    r(-halfW, bodyY + bodyH - 3, 4, 2, "#cad7e6");
    r(halfW - 4, bodyY + bodyH - 3, 4, 2, "#cad7e6");

    if (spec.openTop) {
      // Windshield slant & headrest frame on top
      p([[8, bodyY + 1], [13, bodyY - 7], [15, bodyY - 7], [11, bodyY + 1]], "#97e8ff");
      r(-halfW + 3, bodyY + 1, 7, 2, "#192230");
    }

    // Wheels
    drawWheel(r, -halfW + 13, -3, 5, v.wheelPhase);
    drawWheel(r, halfW - 13, -3, 5, v.wheelPhase);

    // Headlight & brake taillight
    r(halfW - 3, bodyY + 4, 3, 3, "#fff4a8");
    r(-halfW, bodyY + 4, 2, 3, v.braking ? "#ff6884" : "#b82a3b");
  }

  // Headlight glow cone when occupied or driving
  if (v.driver || Math.abs(v.vx) > 20) {
    c.save();
    c.globalAlpha = 0.14;
    c.fillStyle = "#fff1a8";
    c.beginPath();
    c.moveTo(halfW, -9 + bob);
    c.lineTo(halfW + 58, -18);
    c.lineTo(halfW + 58, 2);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Damage cracks / scorch
  if (v.hp < v.spec.hp * 0.45) {
    r(-6, -12 + bob, 12, 2, "#1c171b");
    r(-3, -10 + bob, 4, 2, dark);
  }

  c.restore();
}

export function drawProp(c, prop, time) {
  const { r, p } = pixels(c);
  const ink = "#101824";

  c.save();
  c.globalAlpha = 0.4;
  c.fillStyle = "#0a101b";
  c.beginPath();
  c.ellipse(0, 1, prop.type === "ramp" ? 16 : 8, 3, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  if (prop.type === "hydrant") {
    if (prop.broken) {
      r(-5, -4, 10, 5, ink);
      r(-4, -3, 8, 3, "#c43844");
      r(-2, -6, 4, 3, "#7ff2ff");
    } else {
      r(-4, -13, 8, 13, ink);
      r(-3, -12, 6, 11, "#e84855");
      r(1, -12, 2, 11, "#a32836");
      r(-5, -10, 10, 3, "#ffd466");
      r(-3, -15, 6, 3, "#ffd466");
    }
  } else if (prop.type === "barrel") {
    const flash = prop.fuse > 0 && Math.floor(time * 18) % 2 === 0;
    r(-6, -16, 12, 16, ink);
    r(-5, -15, 10, 14, flash ? "#fff1a8" : "#d94343");
    r(2, -15, 3, 14, "#8c2328");
    r(-5, -11, 10, 2, "#ffd166");
    r(-5, -5, 10, 2, "#ffd166");
    r(-4, -15, 8, 2, "#f78379");
  } else if (prop.type === "umbrella") {
    // Table & beach umbrella with 3D canopy shade
    r(-1, -17, 2, 17, "#6e5544");
    r(-6, -8, 12, 2, "#f0dfc4");
    p([[-13, -15], [0, -24], [13, -15]], ink);
    p([[-12, -16], [0, -23], [12, -16]], prop.variant % 2 ? "#ff689c" : "#38e0c8");
    p([[-4, -16], [0, -23], [4, -16]], "#fff5e6");
  } else if (prop.type === "vending") {
    r(-9, -24, 18, 24, ink);
    r(-8, -23, 12, 22, "#243b5c");
    r(4, -23, 4, 22, "#17263d");
    r(-7, -21, 10, 11, "#4ff2ff");
    r(-6, -19, 8, 3, "#ff68b4");
    r(-6, -14, 8, 3, "#ffd970");
    r(-6, -7, 8, 4, "#101824");
  } else if (prop.type === "ramp") {
    p([[-16, 0], [16, 0], [16, -12]], ink);
    p([[-14, -1], [15, -1], [15, -10]], "#f2b84b");
    r(12, -10, 3, 9, "#a37424");
    r(-4, -4, 4, 3, "#182030");
    r(4, -7, 4, 6, "#182030");
  }
}
