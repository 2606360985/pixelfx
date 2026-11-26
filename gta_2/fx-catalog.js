import { effects } from "../src/fx/index.js";
import { categories } from "../src/fx/categories.js";

const CAT_ZH = {
  moves: "全套招式",
  fire: "火焰",
  explosions: "爆炸",
  water: "水流",
  ice: "寒冰",
  lightning: "雷电",
  scifi: "科幻",
  melee: "近战",
  impacts: "打击",
  projectiles: "弹道",
  spawn: "召唤消散",
  arcane: "奥术",
  holy: "圣光治疗",
  shadow: "暗影虚空",
  status: "异常状态",
  nature: "自然毒系",
  weather: "全屏天气",
  ui: "街头整活",
  pickups: "掉落补给",
  transitions: "全屏转场",
  critters: "街头生物",
};

export const CATEGORIES = categories.map((c) => ({
  ...c,
  zh: CAT_ZH[c.id] || c.name,
}));

const OVERRIDES = {
  "explosions/nuke": {
    mode: "aoe",
    damage: 220,
    radius: 170,
    push: 360,
    launch: 230,
    cooldown: 2.2,
    explosive: true,
    shake: 14,
    targetMode: "aim",
    pulses: 2,
    statusApply: "burning",
    labelZh: "核爆清场",
  },
  "explosions/big-explosion": {
    damage: 115,
    radius: 82,
    push: 240,
    launch: 165,
    explosive: true,
    shake: 8,
    statusApply: "burning",
  },
  "explosions/barrel-explosion": {
    damage: 95,
    radius: 74,
    push: 210,
    launch: 145,
    explosive: true,
    shake: 7,
    statusApply: "burning",
  },
  "explosions/plasma-explosion": {
    damage: 105,
    radius: 78,
    push: 200,
    launch: 130,
    explosive: true,
    emp: 1.5,
    shake: 7,
  },
  "explosions/implosion": {
    damage: 90,
    radius: 84,
    push: -180,
    pullForce: 220,
    launch: 80,
    explosive: true,
    shake: 6,
  },
  "shadow/black-hole": {
    mode: "aoe",
    damage: 18,
    radius: 115,
    push: 0,
    pullForce: 210,
    launch: 20,
    pulses: 7,
    duration: 3.6,
    cooldown: 1.4,
    targetMode: "aim",
    shake: 4,
    labelZh: "黑洞引力",
  },
  "fire/fire-tornado": {
    mode: "aoe",
    damage: 20,
    radius: 68,
    push: 40,
    pullForce: 95,
    launch: 120,
    pulses: 6,
    duration: 2.6,
    cooldown: 1.0,
    statusApply: "burning",
    targetMode: "aim",
  },
  "ice/blizzard-vortex": {
    mode: "aoe",
    damage: 16,
    radius: 72,
    push: 30,
    pullForce: 85,
    launch: 70,
    pulses: 6,
    duration: 2.6,
    cooldown: 1.0,
    statusApply: "frozen",
    targetMode: "aim",
  },
  "nature/tornado": {
    mode: "aoe",
    damage: 16,
    radius: 76,
    push: 65,
    pullForce: 110,
    launch: 140,
    pulses: 6,
    duration: 2.4,
    cooldown: 0.9,
    targetMode: "aim",
  },
  "lightning/chain-lightning": {
    mode: "aoe",
    damage: 68,
    radius: 95,
    push: 95,
    launch: 65,
    pulses: 2,
    emp: 2.5,
    statusApply: "stunned",
    targetMode: "aim",
    shake: 5,
  },
  "lightning/lightning-strike": {
    mode: "aoe",
    damage: 86,
    radius: 62,
    push: 110,
    launch: 95,
    emp: 3.0,
    statusApply: "stunned",
    targetMode: "aim",
    shake: 6,
  },
  "scifi/emp-blast": {
    mode: "aoe",
    damage: 42,
    radius: 120,
    push: 130,
    launch: 50,
    emp: 5.0,
    statusApply: "stunned",
    targetMode: "aim",
    shake: 5,
  },
  "scifi/force-field": {
    mode: "heal",
    heal: 20,
    shield: 6,
    radius: 64,
    push: 150,
    damage: 15,
    targetMode: "self",
  },
  "holy/divine-shield": {
    mode: "heal",
    heal: 25,
    shield: 7,
    radius: 60,
    push: 130,
    damage: 12,
    targetMode: "self",
  },
  "holy/heal": { mode: "heal", heal: 55, radius: 52, targetMode: "self" },
  "holy/heal-aoe": { mode: "heal", heal: 45, radius: 90, push: 80, targetMode: "aim" },
  "holy/blessing": { mode: "heal", heal: 40, shield: 3, radius: 56, targetMode: "self" },
  "holy/resurrection": { mode: "heal", heal: 100, shield: 4, radius: 75, push: 140, targetMode: "self" },
  "nature/healing-bloom": { mode: "heal", heal: 45, radius: 72, targetMode: "aim" },
  "arcane/portal": {
    mode: "aoe",
    damage: 28,
    radius: 72,
    push: 220,
    launch: 170,
    teleportScatter: true,
    targetMode: "aim",
  },
  "arcane/time-stop": {
    mode: "aoe",
    damage: 25,
    radius: 145,
    push: 20,
    statusApply: "frozen",
    targetMode: "aim",
    shake: 4,
  },
  "moves/pistol-shots": {
    mode: "move",
    damage: 34,
    radius: 165,
    push: 75,
    pulses: 3,
    duration: 1.0,
    cooldown: 0.45,
    targetMode: "forward",
    rangeHit: true,
  },
  "moves/rocket-launcher": {
    mode: "move",
    damage: 115,
    radius: 175,
    push: 240,
    launch: 160,
    explosive: true,
    pulses: 1,
    duration: 1.15,
    cooldown: 0.9,
    targetMode: "forward",
    rangeHit: true,
    shake: 9,
  },
  "moves/meteor-call": {
    mode: "move",
    damage: 125,
    radius: 110,
    push: 230,
    launch: 175,
    explosive: true,
    pulses: 2,
    duration: 1.6,
    cooldown: 1.2,
    targetMode: "aim",
    statusApply: "burning",
    shake: 10,
  },
  "moves/lightning-call": {
    mode: "move",
    damage: 90,
    radius: 90,
    push: 140,
    launch: 110,
    emp: 3.5,
    statusApply: "stunned",
    targetMode: "aim",
    shake: 7,
  },
  "moves/fireball-throw": {
    mode: "projectile",
    damage: 65,
    radius: 56,
    push: 160,
    launch: 100,
    speed: 250,
    explosive: true,
    statusApply: "burning",
    targetMode: "aim",
  },
  "moves/ice-lance-throw": {
    mode: "projectile",
    damage: 58,
    radius: 44,
    push: 130,
    speed: 280,
    statusApply: "frozen",
    targetMode: "aim",
  },
  "moves/arrow-shot": {
    mode: "projectile",
    damage: 46,
    radius: 24,
    push: 95,
    speed: 330,
    targetMode: "aim",
  },
  "projectiles/rocket": {
    mode: "projectile",
    damage: 105,
    radius: 76,
    push: 225,
    launch: 150,
    speed: 260,
    explosive: true,
    statusApply: "burning",
    shake: 8,
  },
  "projectiles/homing-missile": {
    mode: "projectile",
    damage: 90,
    radius: 68,
    push: 200,
    launch: 135,
    speed: 240,
    homing: true,
    explosive: true,
    shake: 7,
  },
  "projectiles/cannonball": {
    mode: "projectile",
    damage: 88,
    radius: 58,
    push: 230,
    launch: 120,
    speed: 235,
    explosive: true,
    shake: 6,
  },
  "projectiles/muzzle-shotgun": {
    mode: "melee",
    damage: 64,
    radius: 68,
    push: 185,
    launch: 60,
    cooldown: 0.45,
    targetMode: "forward",
    shake: 4,
  },
  "projectiles/muzzle-pistol": {
    mode: "melee",
    damage: 34,
    radius: 54,
    push: 85,
    cooldown: 0.25,
    targetMode: "forward",
  },
  "projectiles/muzzle-smg": {
    mode: "melee",
    damage: 45,
    radius: 62,
    push: 95,
    pulses: 3,
    cooldown: 0.3,
    targetMode: "forward",
  },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function buildSpec(id, mod) {
  const [category, slug] = id.split("/");
  const meta = mod.meta ?? {};
  const tags = meta.tags ?? [];
  const [mw = 96, mh = 96] = meta.size ?? [96, 96];
  const baseRadius = clamp(Math.round(Math.max(mw, mh) * 0.42), 34, 96);
  const dur = clamp(meta.duration ?? 1.0, 0.4, 4.5);

  let mode = "aoe";
  let targetMode = "aim";
  let damage = 48;
  let radius = baseRadius;
  let push = 110;
  let launch = 60;
  let cooldown = 0.45;
  let speed = 0;
  let pulses = 1;
  let statusType = null;
  let statusApply = null;
  let explosive = false;
  let emp = 0;
  let heal = 0;
  let shield = 0;
  let screenSpace = false;
  let shake = 2;

  if (category === "weather") {
    mode = "weather";
    targetMode = "screen";
    screenSpace = true;
    damage = 0;
    cooldown = 0.3;
    shake = 0;
  } else if (category === "transitions") {
    mode = "transition";
    targetMode = "screen";
    screenSpace = true;
    damage = 32;
    radius = 180;
    push = 140;
    launch = 80;
    cooldown = 0.8;
    shake = 3;
  } else if (category === "status") {
    mode = "status";
    statusType = slug;
    statusApply = slug;
    damage = ["burning", "poisoned", "bleeding", "cursed"].includes(slug) ? 14 : 6;
    radius = 66;
    push = 30;
    launch = 0;
    cooldown = 0.35;
    shake = 1;
  } else if (category === "critters") {
    mode = "critter";
    damage = 18;
    radius = 28;
    push = 60;
    cooldown = 0.4;
    shake = 1;
  } else if (category === "pickups") {
    mode = "pickup";
    damage = 0;
    radius = 24;
    cooldown = 0.3;
    shake = 0;
  } else if (category === "ui") {
    mode = "ui";
    damage = 18;
    radius = 64;
    push = 115;
    launch = 75;
    cooldown = 0.35;
    shake = 2;
  } else if (category === "projectiles") {
    mode = "projectile";
    speed = 290;
    damage = 44;
    radius = 36;
    push = 115;
    launch = 40;
    cooldown = 0.28;
    shake = 2.5;
  } else if (category === "melee") {
    mode = "melee";
    targetMode = "forward";
    damage = 46;
    radius = clamp(Math.round(mw * 0.52), 42, 76);
    push = 135;
    launch = slug.includes("uppercut") ? 160 : 55;
    cooldown = 0.32;
    shake = 3;
  } else if (category === "moves") {
    mode = "move";
    targetMode = "forward";
    damage = 62;
    radius = clamp(Math.round(mw * 0.48), 52, 95);
    push = 155;
    launch = 105;
    cooldown = 0.6;
    shake = 4.5;
  } else if (category === "impacts") {
    mode = "aoe";
    damage = 48;
    radius = clamp(baseRadius, 40, 74);
    push = 155;
    launch = 90;
    cooldown = 0.3;
    shake = 4;
  } else if (category === "explosions") {
    mode = "aoe";
    damage = 84;
    radius = clamp(baseRadius, 58, 96);
    push = 205;
    launch = 140;
    explosive = slug !== "smoke-bomb" && slug !== "firework-burst";
    statusApply = slug === "smoke-bomb" ? "confused" : "burning";
    cooldown = 0.55;
    shake = 6.5;
  } else if (category === "fire") {
    mode = "aoe";
    damage = meta.loop ? 20 : 54;
    pulses = meta.loop ? 4 : 2;
    radius = clamp(baseRadius, 44, 78);
    push = 90;
    launch = 45;
    statusApply = "burning";
    cooldown = 0.45;
    shake = 3;
  } else if (category === "ice") {
    mode = "aoe";
    damage = 46;
    radius = clamp(baseRadius, 46, 82);
    push = 95;
    launch = 45;
    statusApply = "frozen";
    cooldown = 0.45;
    shake = 2.5;
  } else if (category === "lightning") {
    mode = "aoe";
    damage = 58;
    radius = clamp(baseRadius, 48, 86);
    push = 105;
    launch = 60;
    emp = 2.0;
    statusApply = "stunned";
    cooldown = 0.45;
    shake = 4;
  } else if (category === "water") {
    mode = "aoe";
    damage = 34;
    radius = clamp(baseRadius, 48, 84);
    push = 175;
    launch = 110;
    statusApply = "slowed";
    cooldown = 0.4;
    shake = 2.5;
  } else if (category === "holy") {
    const isOffense = ["smite", "holy-pillar", "sunburst"].includes(slug);
    mode = isOffense ? "aoe" : "heal";
    damage = isOffense ? 72 : 16;
    heal = isOffense ? 0 : 35;
    radius = clamp(baseRadius, 52, 86);
    push = isOffense ? 150 : 95;
    launch = isOffense ? 120 : 30;
    cooldown = 0.55;
    shake = isOffense ? 4.5 : 1;
  } else if (category === "shadow") {
    mode = "aoe";
    damage = 54;
    radius = clamp(baseRadius, 50, 90);
    push = 95;
    launch = 55;
    statusApply = "cursed";
    cooldown = 0.5;
    shake = 3.5;
  } else if (category === "nature") {
    mode = "aoe";
    damage = 46;
    radius = clamp(baseRadius, 46, 84);
    push = 115;
    launch = slug === "quake" || slug === "boulder" ? 130 : 45;
    statusApply = slug.includes("poison") || slug.includes("acid") || slug.includes("toxic") ? "poisoned" : "slowed";
    cooldown = 0.45;
    shake = slug === "quake" ? 6 : 2.5;
  } else if (category === "scifi") {
    mode = "aoe";
    damage = 44;
    radius = clamp(baseRadius, 48, 86);
    push = 120;
    launch = 50;
    emp = 1.6;
    cooldown = 0.45;
    shake = 3;
  } else if (category === "arcane") {
    mode = "aoe";
    damage = 54;
    radius = clamp(baseRadius, 48, 86);
    push = 120;
    launch = 65;
    cooldown = 0.45;
    shake = 3;
  } else if (category === "spawn") {
    mode = "aoe";
    damage = 38;
    radius = clamp(baseRadius, 42, 74);
    push = 135;
    launch = 95;
    cooldown = 0.4;
    shake = 2.5;
  }

  const base = {
    id,
    category,
    categoryZh: CAT_ZH[category] || category,
    slug,
    name: meta.name || slug,
    desc: meta.desc || "",
    tags,
    duration: dur,
    loop: !!meta.loop,
    size: [mw, mh],
    origin: meta.origin ?? [Math.round(mw / 2), Math.round(mh / 2)],
    actor: meta.actor ?? 0,
    mode,
    targetMode,
    screenSpace,
    damage,
    radius,
    push,
    launch,
    cooldown,
    speed,
    pulses,
    pullForce: 0,
    statusType,
    statusApply,
    explosive,
    emp,
    heal,
    shield,
    shake,
    homing: false,
    rangeHit: false,
    teleportScatter: false,
    mod,
  };

  const ov = OVERRIDES[id];
  if (ov) Object.assign(base, ov);
  return base;
}

export const ALL_FX = Object.entries(effects).map(([id, mod]) => buildSpec(id, mod));
export const FX_BY_ID = Object.fromEntries(ALL_FX.map((fx) => [fx.id, fx]));
export const FX_BY_CATEGORY = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, ALL_FX.filter((fx) => fx.category === c.id)])
);

// Progressive story unlock tiers for the VN-driven campaign
export const FX_UNLOCK_TIERS = [
  {
    chapter: 0,
    title: "序章 · 位元微光",
    categories: ["melee", "impacts", "pickups", "ui"],
    ids: ["moves/pistol-shots", "holy/heal", "holy/blessing", "water/splash", "water/ripples", "water/bubbles", "lightning/spark-arc"],
  },
  {
    chapter: 1,
    title: "第一章 · 街头炽焰",
    categories: ["fire", "projectiles", "status", "water"],
    ids: ["explosions/small-explosion", "explosions/smoke-bomb", "explosions/barrel-explosion", "explosions/firework-burst"],
  },
  {
    chapter: 2,
    title: "第二章 · 霓虹雷暴",
    categories: ["lightning", "scifi", "weather", "transitions"],
    ids: ["explosions/big-explosion", "explosions/plasma-explosion", "explosions/implosion", "moves/lightning-call", "moves/fireball-throw"],
  },
  {
    chapter: 3,
    title: "第三章 · 暗港裂隙",
    categories: ["shadow", "ice", "arcane", "critters", "nature", "spawn"],
    ids: ["moves/ice-lance-throw", "moves/arrow-shot", "moves/rocket-launcher"],
  },
  {
    chapter: 4,
    title: "终局 · 全位元觉醒 (244)",
    categories: CATEGORIES.map((c) => c.id),
    ids: ALL_FX.map((f) => f.id),
  },
];

const UNLOCK_MAP = new Map();
for (const fx of ALL_FX) {
  let tierChapter = 4;
  for (const tier of FX_UNLOCK_TIERS) {
    if (tier.categories.includes(fx.category) || tier.ids.includes(fx.id)) {
      if (fx.id === "explosions/nuke" && tier.chapter < 4) continue;
      tierChapter = Math.min(tierChapter, tier.chapter);
    }
  }
  UNLOCK_MAP.set(fx.id, tierChapter);
}

export function fxUnlockChapter(fxId) {
  return UNLOCK_MAP.has(fxId) ? UNLOCK_MAP.get(fxId) : 4;
}

export function isFxUnlocked(fxId, unlockedChapter = 0, sandboxAllFx = false) {
  if (sandboxAllFx) return true;
  return fxUnlockChapter(fxId) <= unlockedChapter;
}

// Starter loadout uses Chapter-0 unlocked skills so new players can fight cleanly from frame 1
export const DEFAULT_LOADOUT = [
  "moves/pistol-shots",
  "melee/uppercut",
  "melee/sword-slash",
  "lightning/spark-arc",
  "impacts/ground-slam",
  "water/splash",
  "holy/heal",
  "ui/confetti",
];

export const CHAPTER_SIGNATURE_SKILLS = {
  1: ["projectiles/rocket", "fire/flame-pillar"],
  2: ["lightning/chain-lightning", "scifi/emp-blast"],
  3: ["shadow/black-hole", "critters/flying-skull"],
  4: ["explosions/nuke", "moves/meteor-call"],
};

export function searchFx(query = "", category = "all") {
  const q = query.trim().toLowerCase();
  return ALL_FX.filter((fx) => {
    if (category && category !== "all" && fx.category !== category) return false;
    if (!q) return true;
    return (
      fx.id.toLowerCase().includes(q) ||
      fx.name.toLowerCase().includes(q) ||
      fx.categoryZh.toLowerCase().includes(q) ||
      fx.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}
