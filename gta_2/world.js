import { Rng } from "../src/core/math.js";
import {
  PROTAGONISTS,
  VEHICLE_TYPES,
  PED_TYPES,
  PROP_TYPES,
  PANIC_LINES,
  ANGRY_LINES,
  SCENE_SPECS,
} from "./data.js";
import {
  FX_BY_ID,
  DEFAULT_LOADOUT,
  CHAPTER_SIGNATURE_SKILLS,
  isFxUnlocked,
} from "./fx-catalog.js";
import { STORY_MISSIONS } from "./story-data.js";

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function makeHero(spec, x, y) {
  return {
    ...spec,
    hero: true,
    maxHp: spec.hp,
    shield: 0,
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    face: 1,
    gait: spec.gait || "swagger",
    walkPhase: 0,
    sprinting: false,
    jumpBuffer: 0,
    landTimer: 0,
    prevZ: 0,
    input: { x: 0, y: 0 },
    vehicleId: null,
    seat: null,
    action: null,
    attackCool: 0,
    invuln: 0,
    hitFlash: 0,
  };
}

export class World {
  constructor(seed = 2026) {
    this.rng = new Rng(seed);
    this.seed = seed;
    this.nextId = 1;
    this.time = 0;
    this.paused = false;
    this.cash = 300;
    this.chaosScore = 0;
    this.shake = 0;
    this.hitstop = 0;

    this.scenes = Object.fromEntries(
      SCENE_SPECS.map((s) => [
        s.id,
        {
          ...s,
          sidewalkTop: [...s.sidewalkTop],
          roadLanes: [...s.roadLanes],
          sidewalkBottom: [...s.sidewalkBottom],
          exits: { ...s.exits },
          doors: s.doors.map((d) => ({ ...d })),
        },
      ])
    );

    this.heroes = [
      makeHero(PROTAGONISTS[0], 240, 138),
      makeHero(PROTAGONISTS[1], 210, 142),
    ];
    this.activeIdx = 0;

    this.loadout = [...DEFAULT_LOADOUT];
    this.selectedSlot = 0;
    this.cooldowns = new Map();

    this.peds = [];
    this.vehicles = [];
    this.props = [];
    this.zones = [];
    this.projectiles = [];
    this.hazards = [];
    this.critters = [];
    this.pickups = [];
    this.bubbles = [];
    this.events = [];

    this.weather = "weather/rain";
    this.transition = null;
    this.edgeGrace = 1.5;

    this.wanted = {
      level: 0,
      heat: 0,
      decayTimer: 0,
      policeTimer: 0,
    };

    this.story = {
      chapter: 0,
      unlockedChapter: 0,
      sandboxAllFx: false,
      trust: 50,
      law: 0,
      street: 0,
      flags: [],
      activeMissionId: null,
      missionProgress: 0,
      missionGoal: 0,
      completedMissions: [],
      endingId: null,
      pendingVnSceneId: "prologue_open",
      dialogueLog: [],
    };

    this.sceneId = "temple-nightmarket";
    this.populateScene(this.sceneId, { spawnX: 240 });
  }

  get player() {
    return this.heroes[this.activeIdx];
  }

  get partner() {
    return this.heroes[1 - this.activeIdx];
  }

  get scene() {
    return this.scenes[this.sceneId] || this.scenes["temple-nightmarket"];
  }

  get activeMission() {
    return this.story.activeMissionId ? STORY_MISSIONS[this.story.activeMissionId] || null : null;
  }

  uid() {
    return this.nextId++;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  addBubble(entityId, text, x, y, color = "#fff1d0", life = 2.4) {
    this.bubbles = this.bubbles.filter((b) => b.entityId !== entityId);
    this.bubbles.push({ id: this.uid(), entityId, text, x, y, life, maxLife: life, color });
  }

  setSceneWidth(sceneId, width) {
    const sc = this.scenes[sceneId];
    if (!sc) return;
    sc.width = clamp(Math.round(width), 960, 4800);
  }

  setSceneBands(sceneId, { sidewalkTop, roadLanes, sidewalkBottom }) {
    const sc = this.scenes[sceneId];
    if (!sc) return;
    if (sidewalkTop) sc.sidewalkTop = [...sidewalkTop];
    if (roadLanes) sc.roadLanes = [...roadLanes];
    if (sidewalkBottom) sc.sidewalkBottom = [...sidewalkBottom];
  }

  setSandboxAllFx(enabled) {
    this.story.sandboxAllFx = !!enabled;
    this.emit("storyUpdate", { story: this.story });
    this.emit("banner", {
      text: this.story.sandboxAllFx ? "🔓 全 244 像素特效沙盒模式已开启！" : "🔒 已切换回剧情章节渐进解锁模式",
    });
  }

  applyStoryEffects(effects = {}) {
    if (!effects) return;
    if (typeof effects.trust === "number") this.story.trust = clamp(this.story.trust + effects.trust, 0, 100);
    if (typeof effects.law === "number") this.story.law += effects.law;
    if (typeof effects.street === "number") this.story.street += effects.street;
    if (effects.flag && !this.story.flags.includes(effects.flag)) this.story.flags.push(effects.flag);
    if (typeof effects.cash === "number") this.cash += effects.cash;
    if (typeof effects.unlockChapter === "number" && effects.unlockChapter > this.story.unlockedChapter) {
      this.story.unlockedChapter = effects.unlockChapter;
      this.story.chapter = Math.max(this.story.chapter, effects.unlockChapter);
      this.grantChapterLoadout(effects.unlockChapter);
    }
    if (effects.setWeather !== undefined) {
      this.weather = effects.setWeather;
    }
    if (effects.switchScene && this.scenes[effects.switchScene] && this.sceneId !== effects.switchScene) {
      const keepV = this.player.vehicleId ? this.vehicles.find((v) => v.id === this.player.vehicleId) : null;
      this.populateScene(effects.switchScene, { spawnX: 240, keepVehicle: keepV });
    }
    if (effects.startMission) {
      this.startMission(effects.startMission);
    }
    if (effects.triggerEnding) {
      this.story.endingId = effects.triggerEnding;
      this.story.unlockedChapter = 4;
      this.story.sandboxAllFx = true;
      this.story.activeMissionId = null;
      this.story.missionProgress = 0;
      this.story.missionGoal = 0;
    }
    this.emit("storyUpdate", { story: this.story });
  }

  grantChapterLoadout(chapter) {
    const sigs = CHAPTER_SIGNATURE_SKILLS[chapter];
    if (!sigs) return;
    for (const fxId of sigs) {
      if (this.loadout.includes(fxId) || !FX_BY_ID[fxId]) continue;
      const replaceIdx = this.loadout.findIndex((id) => ["ui/confetti", "water/splash", "impacts/ground-slam", "melee/sword-slash"].includes(id));
      const idx = replaceIdx >= 0 ? replaceIdx : Math.min(this.loadout.length - 1, chapter + 1);
      this.loadout[idx] = fxId;
    }
  }

  startMission(missionId) {
    const mission = STORY_MISSIONS[missionId];
    if (!mission) return false;

    if (this.sceneId !== mission.sceneId) {
      const keepV = this.player.vehicleId ? this.vehicles.find((v) => v.id === this.player.vehicleId) : null;
      this.populateScene(mission.sceneId, { spawnX: 240, keepVehicle: keepV });
    }

    this.story.chapter = mission.chapter;
    this.story.activeMissionId = mission.id;
    this.story.missionProgress = 0;
    this.story.missionGoal = mission.goal;

    this.spawnMissionEntities(mission);
    this.emit("banner", { text: `📌 ${mission.title}` });
    this.emit("storyUpdate", { story: this.story });
    return true;
  }

  spawnMissionEntities(mission) {
    if (!mission?.spawnSpec) return;
    const sc = this.scene;
    const baseX = clamp(this.player.x, 120, sc.width - 520);

    for (const pSpec of mission.spawnSpec.peds || []) {
      const px = clamp(baseX + (pSpec.xOffset || 220), 60, sc.width - 60);
      const py = clamp(pSpec.y || sc.sidewalkTop[1] - 4, sc.sidewalkTop[0], sc.sidewalkBottom[1]);
      const ped = this.spawnPed(pSpec.type || "brawler", px, py);
      ped.name = pSpec.name || ped.name;
      ped.hp = pSpec.hp || ped.hp;
      ped.maxHp = ped.hp;
      ped.missionTarget = true;
      ped.boss = !!pSpec.boss;
      ped.aggro = true;
      ped.aiState = "fight";
      ped.aiTimer = 999;
    }

    for (const vSpec of mission.spawnSpec.vehicles || []) {
      const vx = clamp(baseX + (vSpec.xOffset || 280), 90, sc.width - 90);
      const vy = clamp(vSpec.y || sc.roadLanes[0] + 24, sc.roadLanes[0] + 6, sc.roadLanes[1] - 6);
      const veh = this.spawnVehicle(vSpec.type || "muscle", vx, vy, { face: -1, parked: false, withDriver: true });
      veh.name = vSpec.name || veh.name;
      veh.hp = vSpec.hp || veh.hp;
      veh.maxHp = veh.hp;
      veh.missionTarget = true;
      veh.empCounted = false;
      veh.vx = -40;
    }
  }

  recordMissionProgress(delta = 1) {
    const mission = this.activeMission;
    if (!mission) return;
    this.story.missionProgress = Math.min(this.story.missionGoal, this.story.missionProgress + delta);
    this.emit("storyUpdate", { story: this.story });

    if (this.story.missionProgress >= this.story.missionGoal) {
      if (!this.story.completedMissions.includes(mission.id)) {
        this.story.completedMissions.push(mission.id);
      }
      this.cash += mission.rewardCash || 0;
      if (typeof mission.unlockChapter === "number" && mission.unlockChapter > this.story.unlockedChapter) {
        this.story.unlockedChapter = mission.unlockChapter;
        this.grantChapterLoadout(mission.unlockChapter);
      }
      this.story.activeMissionId = null;
      this.story.pendingVnSceneId = mission.onCompleteSceneId || null;
      this.emit("missionComplete", { mission });
      this.emit("banner", { text: `✔ 任务完成：${mission.title} · +$${mission.rewardCash}` });
      this.emit("storyUpdate", { story: this.story });
    }
  }

  exportStoryState() {
    return {
      ...this.story,
      flags: [...this.story.flags],
      completedMissions: [...this.story.completedMissions],
      dialogueLog: this.story.dialogueLog.slice(-60),
      cash: this.cash,
      loadout: [...this.loadout],
      sceneId: this.sceneId,
    };
  }

  importStoryState(saved) {
    if (!saved || typeof saved !== "object") return false;
    this.story = {
      ...this.story,
      ...saved,
      flags: Array.isArray(saved.flags) ? [...saved.flags] : [],
      completedMissions: Array.isArray(saved.completedMissions) ? [...saved.completedMissions] : [],
      dialogueLog: Array.isArray(saved.dialogueLog) ? saved.dialogueLog.slice(-60) : [],
      pendingVnSceneId: saved.pendingVnSceneId ?? null,
    };
    if (typeof saved.cash === "number") this.cash = saved.cash;
    if (Array.isArray(saved.loadout) && saved.loadout.length === this.loadout.length) {
      this.loadout = saved.loadout.filter((id) => FX_BY_ID[id]).length === this.loadout.length ? [...saved.loadout] : this.loadout;
    }
    const targetScene = saved.sceneId && this.scenes[saved.sceneId] ? saved.sceneId : this.sceneId;
    this.populateScene(targetScene, { spawnX: 240 });
    if (this.story.activeMissionId && STORY_MISSIONS[this.story.activeMissionId]) {
      const m = STORY_MISSIONS[this.story.activeMissionId];
      if (this.sceneId === m.sceneId) this.spawnMissionEntities(m);
    }
    this.emit("storyUpdate", { story: this.story });
    return true;
  }

  resetStory() {
    this.cash = 300;
    this.chaosScore = 0;
    this.wanted = { level: 0, heat: 0, decayTimer: 0, policeTimer: 0 };
    this.loadout = [...DEFAULT_LOADOUT];
    this.story = {
      chapter: 0,
      unlockedChapter: 0,
      sandboxAllFx: false,
      trust: 50,
      law: 0,
      street: 0,
      flags: [],
      activeMissionId: null,
      missionProgress: 0,
      missionGoal: 0,
      completedMissions: [],
      endingId: null,
      pendingVnSceneId: "prologue_open",
      dialogueLog: [],
    };
    this.populateScene("temple-nightmarket", { spawnX: 240 });
    this.emit("storyUpdate", { story: this.story });
  }

  populateScene(sceneId, { spawnX = 240, keepVehicle = null } = {}) {
    this.sceneId = sceneId;
    const sc = this.scene;
    this.peds = [];
    this.vehicles = [];
    this.props = [];
    this.zones = [];
    this.projectiles = [];
    this.hazards = [];
    this.critters = [];
    this.pickups = [];
    this.bubbles = [];
    this.edgeGrace = 1.6;
    if (sc.defaultWeather !== undefined) this.weather = sc.defaultWeather;

    const swMid = Math.round((sc.sidewalkTop[0] + sc.sidewalkTop[1]) / 2);
    const laneWest = Math.round(sc.roadLanes[0] + (sc.roadLanes[1] - sc.roadLanes[0]) * 0.28);
    const laneEast = Math.round(sc.roadLanes[0] + (sc.roadLanes[1] - sc.roadLanes[0]) * 0.72);

    if (keepVehicle) {
      keepVehicle.x = clamp(spawnX, 90, sc.width - 90);
      keepVehicle.y = clamp(keepVehicle.y, sc.roadLanes[0] + 6, sc.roadLanes[1] - 6);
      keepVehicle.vx = clamp(keepVehicle.vx * 0.5, -120, 120);
      this.vehicles.push(keepVehicle);
      this.player.x = keepVehicle.x;
      this.player.y = keepVehicle.y;
      this.partner.x = keepVehicle.x;
      this.partner.y = keepVehicle.y;
    } else {
      this.player.vehicleId = null;
      this.partner.vehicleId = null;
      this.player.x = clamp(spawnX, 80, sc.width - 80);
      this.player.y = swMid;
      this.partner.x = clamp(spawnX - 28, 60, sc.width - 60);
      this.partner.y = swMid + 4;
    }

    const nearX = clamp(spawnX, 160, sc.width - 220);
    if (!keepVehicle || keepVehicle.type !== "convertible") {
      this.spawnVehicle("convertible", nearX + 95, laneEast - 6, { parked: true, face: 1 });
    }
    if (!keepVehicle || keepVehicle.spec.kind !== "tricycle") {
      this.spawnVehicle("trike_mobility", nearX - 95, sc.sidewalkTop[1] - 2, { parked: true, face: 1 });
    }

    const trafficPool = ["sedan", "convertible", "muscle", "trike_mobility", "trike_cargo"];
    const count = sc.trafficDensity || 5;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * (sc.width - 280) + 140;
      if (Math.abs(x - nearX) < 220) continue;
      const type = trafficPool[i % trafficPool.length];
      const eastbound = i % 2 === 0;
      const laneY = eastbound
        ? sc.roadLanes[0] + (sc.roadLanes[1] - sc.roadLanes[0]) * (0.62 + (i % 2) * 0.22)
        : sc.roadLanes[0] + (sc.roadLanes[1] - sc.roadLanes[0]) * (0.14 + (i % 2) * 0.22);
      const v = this.spawnVehicle(type, x, laneY, { face: eastbound ? 1 : -1, withDriver: true });
      v.vx = (eastbound ? 1 : -1) * (type.startsWith("trike") ? 54 : 88);
    }

    const pedPool = ["tourist", "skater", "tourist", "vendor", "brawler", "skater"];
    const pCount = sc.pedDensity || 12;
    for (let i = 0; i < pCount; i++) {
      const px = clamp(90 + (i * (sc.width - 180)) / pCount + this.rng.range(-30, 30), 60, sc.width - 60);
      const upper = i % 3 !== 2;
      const py = upper
        ? this.rng.range(sc.sidewalkTop[0] + 4, sc.sidewalkTop[1] - 2)
        : this.rng.range(sc.sidewalkBottom[0] + 4, sc.sidewalkBottom[1] - 4);
      this.spawnPed(pedPool[i % pedPool.length], px, py);
    }

    this.spawnProp("hydrant", clamp(nearX + 55, 80, sc.width - 80), sc.sidewalkTop[1] - 1);
    this.spawnProp("barrel", clamp(nearX + 150, 80, sc.width - 80), sc.sidewalkTop[1] - 3);
    this.spawnProp("ramp", clamp(nearX + 235, 120, sc.width - 140), laneEast - 2);
    for (let x = 320; x < sc.width - 140; x += 340) {
      if (Math.abs(x - nearX) < 160) continue;
      this.spawnProp("hydrant", x, sc.sidewalkTop[1] - 1);
      this.spawnProp("umbrella", x + 85, sc.sidewalkBottom[0] + 6);
      this.spawnProp("barrel", x + 155, sc.sidewalkTop[1] - 2);
      if ((x / 340) % 2 === 1) {
        this.spawnProp("vending", x + 210, sc.sidewalkTop[0] + 6);
      }
      if ((x / 340) % 2 === 0) {
        this.spawnProp("ramp", x + 240, laneWest);
      }
    }

    // Re-attach active mission targets if returning to the mission's district
    if (this.activeMission && this.activeMission.sceneId === sceneId && this.story.missionProgress < this.story.missionGoal) {
      this.spawnMissionEntities(this.activeMission);
    }

    this.emit("banner", { text: `${sc.name} · ${sc.subtitle}` });
  }

  spawnProp(type, x, y) {
    const spec = PROP_TYPES[type];
    if (!spec) return null;
    const prop = {
      id: this.uid(),
      type,
      spec,
      x,
      y,
      z: 0,
      vz: 0,
      hp: spec.hp,
      maxHp: spec.hp,
      broken: false,
      fuse: 0,
      geyserTimer: 0,
      variant: this.rng.int(0, 5),
    };
    this.props.push(prop);
    return prop;
  }

  addZone(kind, x, y, radius, life = 9) {
    if (this.zones.length >= 16) this.zones.shift();
    this.zones.push({ id: this.uid(), kind, x, y, radius, life, maxLife: life });
  }

  spawnVehicle(type, x, y, { face = 1, parked = false, withDriver = false } = {}) {
    const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
    const color = spec.colors[this.rng.int(0, spec.colors.length - 1)];
    const v = {
      id: this.uid(),
      type,
      spec,
      name: spec.name,
      color,
      darkColor: "#1b212e",
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      face,
      hp: spec.hp,
      maxHp: spec.hp,
      wheelPhase: 0,
      driver: null,
      passenger: null,
      parked,
      aiDir: face,
      aiLaneY: y,
      braking: false,
      drifting: false,
      empTimer: 0,
      explodeTimer: 0,
      exploded: false,
      hornTimer: 0,
      nitro: 100,
      nitroActive: false,
      nitroFxTimer: 0,
      sliding: false,
      suspY: 0,
      suspV: 0,
      rampCooldown: 0,
      missionTarget: false,
      empCounted: false,
    };
    if (withDriver) {
      const dType = spec.isPolice ? "police" : this.rng.chance(0.25) ? "brawler" : "tourist";
      const driver = this.spawnPed(dType, x, y, { inVehicle: v.id });
      v.driver = driver;
    }
    this.vehicles.push(v);
    return v;
  }

  spawnPed(type, x, y, { inVehicle = null } = {}) {
    const spec = PED_TYPES[type] || PED_TYPES.tourist;
    const ped = {
      id: this.uid(),
      type,
      name: spec.name,
      color: spec.color,
      dark: spec.dark,
      trim: spec.trim,
      hp: spec.hp,
      maxHp: spec.hp,
      speed: spec.speed,
      cashRange: spec.cash,
      isVendor: !!spec.isVendor,
      isPolice: !!spec.isPolice,
      aggro: !!spec.aggro,
      lines: spec.lines,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      face: this.rng.chance(0.5) ? 1 : -1,
      gait: spec.gait || "stroll",
      walkPhase: this.rng.range(0, Math.PI * 2),
      aiState: "wander",
      aiTimer: this.rng.range(0.5, 3.0),
      wanderDirX: this.rng.chance(0.5) ? 1 : -1,
      wanderDirY: 0,
      interactCount: 0,
      talkIndex: 0,
      attackCool: 0,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      vehicleId: inVehicle,
      deathAge: 0,
      hitFlash: 0,
      missionTarget: false,
      boss: false,
      profile: type === "brawler" ? PROTAGONISTS[0].profile : null,
    };
    this.peds.push(ped);
    return ped;
  }

  switchHero() {
    const prev = this.player;
    this.activeIdx = 1 - this.activeIdx;
    const next = this.player;
    if (prev.vehicleId && next.vehicleId === prev.vehicleId) {
      const v = this.vehicles.find((vh) => vh.id === prev.vehicleId);
      if (v) {
        v.driver = next;
        v.passenger = prev;
        next.seat = "driver";
        prev.seat = "passenger";
      }
    }
    this.emit("switch", { hero: next });
    this.addBubble(next.id, next.id === "chen" ? "我来控场！" : "跟上我的节奏！", next.x, next.y - 36, "#2ee8c8", 1.5);
    return next;
  }

  selectSlot(idx) {
    if (idx >= 0 && idx < this.loadout.length) {
      this.selectedSlot = idx;
      this.emit("slot", { slot: idx, fxId: this.loadout[idx] });
    }
  }

  equipFx(fxId, slot = this.selectedSlot) {
    if (!FX_BY_ID[fxId]) return false;
    if (!isFxUnlocked(fxId, this.story.unlockedChapter, this.story.sandboxAllFx)) {
      this.emit("message", { text: "🔒 该特效尚未解锁，可推进剧情或开启顶部「全244沙盒」" });
      return false;
    }
    this.loadout[slot] = fxId;
    this.selectedSlot = slot;
    this.emit("equip", { slot, fxId });
    return true;
  }

  wantedLevelFromHeat(h) {
    return h >= 240 ? 5 : h >= 180 ? 4 : h >= 120 ? 3 : h >= 65 ? 2 : h >= 25 ? 1 : 0;
  }

  addCrimeHeat(amount) {
    this.wanted.heat = clamp(this.wanted.heat + amount, 0, 260);
    this.wanted.decayTimer = 6.5;
    const nextLevel = this.wantedLevelFromHeat(this.wanted.heat);
    if (nextLevel > this.wanted.level) {
      this.emit("wanted", { level: nextLevel });
    }
    this.wanted.level = nextLevel;
  }

  clearWanted() {
    this.wanted.heat = 0;
    this.wanted.level = 0;
    this.wanted.decayTimer = 0;
    for (const p of this.peds) {
      if (p.isPolice && p.hp > 0 && !p.missionTarget) p.aiState = "wander";
    }
    this.emit("message", { text: "通缉警戒已解除" });
  }

  toggleVehicle() {
    const p = this.player;
    const partner = this.partner;

    if (p.vehicleId) {
      const v = this.vehicles.find((vh) => vh.id === p.vehicleId);
      if (v) {
        v.driver = null;
        if (v.passenger === p || v.passenger === partner) v.passenger = null;
        p.vehicleId = null;
        p.seat = null;
        p.x = v.x;
        p.y = clamp(v.y - 22, this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
        if (partner.vehicleId === v.id) {
          partner.vehicleId = null;
          partner.seat = null;
          partner.x = clamp(v.x - 24, 24, this.scene.width - 24);
          partner.y = clamp(p.y + 4, this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
        }
        this.emit("exitVehicle", { vehicle: v });
      }
      return true;
    }

    let best = null;
    let bestD = 56;
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const d = Math.hypot(v.x - p.x, (v.y - p.y) * 1.4);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return false;

    if (best.driver && !best.driver.hero) {
      const oldDriver = best.driver;
      oldDriver.vehicleId = null;
      oldDriver.x = best.x - best.face * 18;
      oldDriver.y = clamp(best.y - 18, this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
      oldDriver.vx = -best.face * 60;
      oldDriver.aiState = oldDriver.aggro || oldDriver.isPolice ? "fight" : "panic";
      oldDriver.aiTimer = 6.0;
      const line = oldDriver.aiState === "fight" ? ANGRY_LINES[this.rng.int(0, ANGRY_LINES.length - 1)] : PANIC_LINES[this.rng.int(0, PANIC_LINES.length - 1)];
      this.addBubble(oldDriver.id, line, oldDriver.x, oldDriver.y - 34, "#ff9e9e");
      this.addCrimeHeat(20);
      best.driver = null;
    }

    best.parked = false;
    best.driver = p;
    p.vehicleId = best.id;
    p.seat = "driver";
    p.x = best.x;
    p.y = best.y;

    if (partner.hp > 0 && Math.hypot(partner.x - best.x, partner.y - best.y) < 180) {
      best.passenger = partner;
      partner.vehicleId = best.id;
      partner.seat = "passenger";
    }

    this.emit("enterVehicle", { vehicle: best });
    this.addBubble(p.id, best.spec.kind === "tricycle" ? "三轮穿街走起！" : "坐稳，准备冲线！", best.x, best.y - 36, "#9affea", 1.5);
    return true;
  }

  honk() {
    const p = this.player;
    if (!p.vehicleId) return false;
    const v = this.vehicles.find((vh) => vh.id === p.vehicleId);
    if (!v || v.hornTimer > 0) return false;
    v.hornTimer = 0.45;
    this.emit("horn", { kind: v.spec.horn, x: v.x, y: v.y });
    for (const ped of this.peds) {
      if (ped.hp <= 0 || ped.vehicleId) continue;
      if (Math.hypot(ped.x - v.x, ped.y - v.y) < 130) {
        ped.vy = ped.y < v.y ? -45 : 45;
        if (ped.aiState === "wander" && this.rng.chance(0.45)) {
          this.addBubble(ped.id, v.spec.kind === "tricycle" ? "借过借过！" : "看路啊喂！", ped.x, ped.y - 34, "#ffe69e", 1.8);
        }
      }
    }
    return true;
  }

  interact() {
    const p = this.player;
    if (p.vehicleId) return this.honk();

    for (const d of this.scene.doors) {
      if (Math.hypot(p.x - d.x, p.y - d.y) < 42) {
        this.requestSceneSwitch(d.target, "transitions/iris", "center");
        return true;
      }
    }

    let nearest = null;
    let bestD = 58;
    for (const ped of this.peds) {
      if (ped.hp <= 0 || ped.vehicleId) continue;
      const d = Math.hypot(ped.x - p.x, (ped.y - p.y) * 1.3);
      if (d < bestD) {
        bestD = d;
        nearest = ped;
      }
    }
    if (!nearest) return false;

    nearest.face = p.x >= nearest.x ? 1 : -1;
    nearest.interactCount++;
    this.emit("talk", { ped: nearest });

    if (nearest.isVendor) {
      if (p.hp < p.maxHp && this.cash >= 20) {
        this.cash -= 20;
        p.hp = Math.min(p.maxHp, p.hp + 45);
        this.emit("pickup", { kind: "heal", x: p.x, y: p.y });
        this.addBubble(nearest.id, "鱼蛋粉拿好！回血 +45", nearest.x, nearest.y - 36, "#96ffba");
      } else {
        this.addBubble(nearest.id, nearest.lines[nearest.talkIndex % nearest.lines.length], nearest.x, nearest.y - 36, "#ffea99");
        nearest.talkIndex++;
      }
      return true;
    }

    if (nearest.isPolice && this.wanted.level > 0) {
      this.addBubble(nearest.id, "站住！重案组通缉！", nearest.x, nearest.y - 36, "#ff8796");
      nearest.aiState = "fight";
      return true;
    }

    const line = nearest.lines[nearest.talkIndex % nearest.lines.length];
    nearest.talkIndex++;
    this.addBubble(nearest.id, line, nearest.x, nearest.y - 36, "#fff2c9");

    if (nearest.interactCount >= 3 && (nearest.aggro || this.rng.chance(0.4))) {
      nearest.aiState = "fight";
      nearest.aiTimer = 8.0;
      this.addBubble(nearest.id, ANGRY_LINES[this.rng.int(0, ANGRY_LINES.length - 1)], nearest.x, nearest.y - 36, "#ff8f8f");
    }
    return true;
  }

  quickMelee() {
    const p = this.player;
    if (p.vehicleId) return false;
    if (p.attackCool > 0) return false;
    p.attackCool = 0.28;
    p.action = { t: 0, duration: 0.26, kind: "punch" };
    this.emit("fx", { fxId: "melee/uppercut", x: p.x + p.face * 18, y: p.y - 4, flip: p.face < 0 });
    this.emit("swing");

    let hitAny = false;
    for (const ped of this.peds) {
      if (ped.hp <= 0 || ped.vehicleId) continue;
      if (Math.hypot(ped.x - (p.x + p.face * 22), (ped.y - p.y) * 1.4) < 36) {
        this.damagePed(ped, 28, p.face * 135, 95, { fromPlayer: true });
        hitAny = true;
      }
    }
    for (const prop of this.props) {
      if (prop.broken || prop.spec.indestructible) continue;
      if (Math.hypot(prop.x - (p.x + p.face * 22), (prop.y - p.y) * 1.4) < 34) {
        this.damageProp(prop, 20, p.face * 90);
        hitAny = true;
      }
    }
    if (hitAny) {
      this.hitstop = Math.max(this.hitstop, 0.032);
      this.emit("hit", { x: p.x + p.face * 24, y: p.y - 14 });
    }
    return true;
  }

  castSkill(fxId = this.loadout[this.selectedSlot], aimX = null, aimY = null) {
    const spec = FX_BY_ID[fxId];
    if (!spec) return false;
    if (!isFxUnlocked(fxId, this.story.unlockedChapter, this.story.sandboxAllFx)) {
      this.emit("message", { text: "🔒 特效尚未解锁（推进剧情或开启顶部「全244沙盒」）" });
      return false;
    }

    const cd = this.cooldowns.get(fxId) || 0;
    if (cd > 0) return false;
    this.cooldowns.set(fxId, spec.cooldown);

    const p = this.player;
    const v = p.vehicleId ? this.vehicles.find((vh) => vh.id === p.vehicleId) : null;
    const ox = v ? v.x : p.x;
    const oy = v ? v.y : p.y;

    const targetX = aimX == null ? ox + p.face * 110 : clamp(aimX, 12, this.scene.width - 12);
    const targetY = aimY == null ? oy : clamp(aimY, 60, 266);

    const dx = targetX - ox;
    const dy = targetY - oy;
    if (Math.abs(dx) > 2) p.face = dx >= 0 ? 1 : -1;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    if (!v) {
      p.action = { t: 0, duration: Math.min(0.45, spec.duration), kind: "cast" };
    }

    this.emit("cast", { fxId, spec, x: ox, y: oy });

    if (spec.mode === "weather") {
      this.weather = this.weather === fxId ? null : fxId;
      this.emit("banner", { text: this.weather ? `天气切换 · ${spec.name}` : "雨歇云开" });
      return true;
    }

    if (spec.mode === "transition") {
      this.transition = { fxId, duration: spec.duration, t: 0, targetSceneId: null, swapped: false };
      this.applyAreaDamage(ox, oy, spec.radius, spec.damage, spec.push, spec.launch, spec);
      return true;
    }

    if (spec.mode === "critter") {
      if (this.critters.length >= 10) this.critters.shift();
      const cx = clamp(ox + Math.cos(angle) * Math.min(dist, 90), 24, this.scene.width - 24);
      const cy = clamp(oy + Math.sin(angle) * Math.min(dist, 90), this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
      this.critters.push({
        id: this.uid(),
        fxId,
        x: cx,
        y: cy,
        z: 0,
        vx: p.face * 45,
        vy: 0,
        face: p.face,
        life: 10.0,
        maxLife: 10.0,
        attackCool: 0.4,
        damage: spec.damage,
        push: spec.push,
      });
      return true;
    }

    if (spec.mode === "pickup") {
      const px = clamp(ox + Math.cos(angle) * Math.min(dist, 95), 24, this.scene.width - 24);
      const py = clamp(oy + Math.sin(angle) * Math.min(dist, 95), this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
      const kind = fxId.includes("heart") || fxId.includes("potion") ? "heal" : fxId.includes("power") || fxId.includes("shield") ? "shield" : "cash";
      this.pickups.push({ id: this.uid(), fxId, kind, amount: kind === "cash" ? 50 : 35, x: px, y: py, z: 12, vz: 70, life: 22 });
      return true;
    }

    if (spec.mode === "heal") {
      const hx = spec.targetMode === "self" ? ox : clamp(ox + Math.cos(angle) * Math.min(dist, 140), 20, this.scene.width - 20);
      const hy = spec.targetMode === "self" ? oy : clamp(oy + Math.sin(angle) * Math.min(dist, 140), 90, 264);
      for (const h of this.heroes) {
        if (Math.hypot(h.x - hx, h.y - hy) <= spec.radius + 35) {
          h.hp = Math.min(h.maxHp, h.hp + (spec.heal || 30));
          if (spec.shield) h.shield = Math.max(h.shield, spec.shield);
        }
      }
      this.emit("fx", { fxId, x: hx, y: hy, flip: p.face < 0 });
      if (spec.push > 0) this.applyAreaDamage(hx, hy, spec.radius, spec.damage, spec.push, spec.launch, spec);
      return true;
    }

    if (spec.mode === "projectile") {
      if (this.projectiles.length >= 24) this.projectiles.shift();
      const speed = spec.speed || 280;
      this.projectiles.push({
        id: this.uid(),
        fxId,
        spec,
        ownerHero: true,
        ownerPolice: false,
        x: ox + Math.cos(angle) * 16,
        y: oy,
        z: 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        life: 0,
        maxLife: 1.4,
        radius: spec.radius,
        damage: spec.damage,
        push: spec.push,
        launch: spec.launch,
        explosive: spec.explosive,
        homing: spec.homing,
        statusApply: spec.statusApply,
        shake: spec.shake,
      });
      return true;
    }

    if (spec.mode === "status") {
      const sx = clamp(ox + Math.cos(angle) * Math.min(dist, 175), 20, this.scene.width - 20);
      const sy = clamp(oy + Math.sin(angle) * Math.min(dist, 175), this.scene.sidewalkTop[0] - 8, this.scene.sidewalkBottom[1]);
      this.emit("fx", { fxId: "arcane/spell-charge", x: ox, y: oy });
      let hitCount = 0;
      for (const ped of this.peds) {
        if (ped.hp <= 0 || ped.vehicleId) continue;
        if (Math.hypot(ped.x - sx, (ped.y - sy) * 1.25) <= spec.radius) {
          this.applyStatusToPed(ped, fxId, spec.statusType || "burning");
          this.damagePed(ped, spec.damage, 0, 0, { fromPlayer: true });
          hitCount++;
        }
      }
      if (hitCount === 0) {
        this.emit("fx", { fxId, x: sx, y: sy });
      }
      return true;
    }

    if (spec.mode === "melee" || spec.mode === "move") {
      if (spec.rangeHit) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        this.emit("fx", { fxId, x: ox, y: oy, flip: dirX < 0, angle: Math.abs(dirY) > 0.25 ? angle : 0 });
        const reach = spec.radius || 165;
        this.hazards.push({
          id: this.uid(),
          fxId,
          spec,
          x: ox + dirX * reach * 0.55,
          y: oy + dirY * reach * 0.55,
          radius: reach * 0.52,
          damage: spec.damage,
          push: spec.push,
          launch: spec.launch,
          pullForce: 0,
          explosive: spec.explosive,
          emp: spec.emp,
          statusApply: spec.statusApply,
          shake: spec.shake,
          timer: 0,
          duration: spec.duration,
          pulseInterval: spec.duration / Math.max(1, spec.pulses),
          nextPulse: 0.14,
          pulsesLeft: spec.pulses || 1,
          lineOrigin: { x: ox, y: oy, dx: dirX, dy: dirY, reach },
        });
        return true;
      }

      const tx = spec.targetMode === "forward" ? ox + Math.cos(angle) * 32 : clamp(ox + Math.cos(angle) * Math.min(dist, 190), 20, this.scene.width - 20);
      const ty = spec.targetMode === "forward" ? oy + Math.sin(angle) * 20 : clamp(oy + Math.sin(angle) * Math.min(dist, 190), 90, 264);
      this.emit("fx", { fxId, x: spec.targetMode === "forward" ? ox : tx, y: spec.targetMode === "forward" ? oy : ty, flip: Math.cos(angle) < 0 });
      this.hazards.push({
        id: this.uid(),
        fxId,
        spec,
        x: tx,
        y: ty,
        radius: spec.radius,
        damage: spec.damage,
        push: spec.push,
        launch: spec.launch,
        pullForce: spec.pullForce || 0,
        explosive: spec.explosive,
        emp: spec.emp,
        statusApply: spec.statusApply,
        shake: spec.shake,
        timer: 0,
        duration: Math.min(spec.duration, 1.8),
        pulseInterval: spec.pulses > 1 ? spec.duration / spec.pulses : 99,
        nextPulse: 0.08,
        pulsesLeft: spec.pulses || 1,
      });
      return true;
    }

    const reachLimit = 230;
    const tx = clamp(ox + Math.cos(angle) * Math.min(dist, reachLimit), 20, this.scene.width - 20);
    const ty = clamp(oy + Math.sin(angle) * Math.min(dist, reachLimit), 92, 264);
    this.emit("fx", { fxId, x: tx, y: ty, flip: p.face < 0 });

    const pulses = Math.max(1, spec.pulses || 1);
    const activeDur = pulses > 1 ? spec.duration : 0.35;
    this.hazards.push({
      id: this.uid(),
      fxId,
      spec,
      x: tx,
      y: ty,
      radius: spec.radius,
      damage: spec.damage,
      push: spec.push,
      launch: spec.launch,
      pullForce: spec.pullForce || 0,
      explosive: spec.explosive,
      emp: spec.emp,
      statusApply: spec.statusApply,
      teleportScatter: spec.teleportScatter,
      shake: spec.shake,
      timer: 0,
      duration: activeDur,
      pulseInterval: pulses > 1 ? activeDur / pulses : 99,
      nextPulse: 0.04,
      pulsesLeft: pulses,
    });
    return true;
  }

  applyStatusToPed(ped, fxId, statusType) {
    ped.status = { fxId, type: statusType };
    ped.statusTimer = statusType === "sleep" || statusType === "frozen" || statusType === "petrified" ? 4.5 : 5.5;
    ped.statusTick = 0.6;
    if (statusType === "charmed") ped.aiState = "charm";
    else if (statusType === "rage" || statusType === "confused") ped.aiState = "brawl";
    else if (statusType === "burning") ped.aiState = "panic";
  }

  applyAreaDamage(x, y, radius, damage, push, launch, spec = {}) {
    let effRadius = radius;
    let effDamage = damage;
    let effEmp = spec.emp || 0;
    const cat = spec.category || "";

    if (cat === "water") {
      this.addZone("wet", x, y, Math.max(66, radius), 10.0);
    } else if (cat === "ice") {
      this.addZone("ice", x, y, Math.max(70, radius), 8.5);
      this.emit("ice", { x, y });
    }

    if (spec.explosive) {
      this.emit("decal", { kind: "scorch", x, y, radius: Math.min(48, radius * 0.6) });
      if (radius >= 90) {
        this.hitstop = Math.max(this.hitstop, 0.052);
        this.emit("impactPulse", { x, y, heavy: true });
      } else {
        this.hitstop = Math.max(this.hitstop, 0.03);
      }
    }

    const isElectric = cat === "lightning" || spec.id === "scifi/emp-blast" || spec.id === "moves/lightning-call";
    if (isElectric) {
      const raining = this.weather === "weather/rain" || this.weather === "weather/storm";
      const onWet = this.zones.some((z) => z.kind === "wet" && Math.hypot(z.x - x, z.y - y) <= radius + z.radius);
      if (raining || onWet) {
        effRadius = Math.round(radius * 1.65);
        effDamage += 32;
        effEmp = Math.max(effEmp, 3.5);
        this.emit("electric", { x, y });
        this.emit("chemistry", { kind: "wet_shock", text: "⚡ 雨夜湿路导电连锁！", x, y });
      }
    }

    if (spec.shake) this.shake = Math.max(this.shake, spec.shake);

    for (const ped of this.peds) {
      if (ped.hp <= 0 || ped.vehicleId) continue;
      const dx = ped.x - x;
      const dy = ped.y - y;
      const d = Math.hypot(dx, dy * 1.25);
      if (d > effRadius) continue;

      const dir = d > 1 ? dx / d : this.rng.sign();
      if (spec.teleportScatter) {
        ped.x = clamp(ped.x + this.rng.range(-140, 140), 40, this.scene.width - 40);
        ped.vz = 150;
      }
      if (spec.statusApply) {
        this.applyStatusToPed(ped, `status/${spec.statusApply}`, spec.statusApply);
      }
      if (isElectric && effDamage > damage) {
        this.emit("fx", { fxId: "lightning/spark-arc", x: ped.x, y: ped.y - 8 });
      }
      this.damagePed(ped, effDamage, dir * push, launch, { fromPlayer: true });
    }

    for (const prop of this.props) {
      if (prop.broken || prop.spec.indestructible) continue;
      const dx = prop.x - x;
      const dy = prop.y - y;
      const d = Math.hypot(dx, dy * 1.25);
      if (d > effRadius + 10) continue;
      const dir = d > 1 ? dx / d : 1;
      this.damageProp(prop, effDamage, dir * push * 0.4);
    }

    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const dx = v.x - x;
      const dy = v.y - y;
      const d = Math.hypot(dx, dy * 1.25);
      if (d > effRadius + v.spec.w * 0.35) continue;

      const isPlayerRide = v.driver?.hero;
      const dir = d > 1 ? dx / d : 1;
      if (effEmp > 0 && !isPlayerRide) {
        v.empTimer = Math.max(v.empTimer, effEmp);
        if (v.missionTarget && !v.empCounted && this.activeMission?.id === "m2_cbd") {
          v.empCounted = true;
          this.emit("chemistry", { kind: "emp_capture", text: "⚡ 黑警车队高压截停！", x: v.x, y: v.y });
          this.recordMissionProgress(1);
        }
      }
      if (!isPlayerRide) {
        const massFactor = 1 / v.spec.mass;
        v.vx += dir * push * 0.85 * massFactor;
        v.vz = Math.max(v.vz, launch * 0.55 * massFactor);
        this.damageVehicle(v, Math.round(effDamage * (spec.explosive ? 0.95 : 0.45)));
      }
    }
  }

  damageProp(prop, dmg) {
    if (prop.broken || prop.spec.indestructible || dmg <= 0) return;
    prop.hp = Math.max(0, prop.hp - dmg);
    if (prop.hp > 0) return;

    if (prop.type === "hydrant") {
      prop.broken = true;
      prop.geyserTimer = 6.5;
      this.addZone("wet", prop.x, prop.y + 8, 72, 10.5);
      this.emit("fx", { fxId: "water/geyser", x: prop.x, y: prop.y });
      this.emit("hydrant", { x: prop.x, y: prop.y });
      this.chaosScore += 45;
      for (const ped of this.peds) {
        if (ped.hp <= 0 || ped.vehicleId) continue;
        if (Math.hypot(ped.x - prop.x, ped.y - prop.y) < 62) {
          this.damagePed(ped, 16, (ped.x >= prop.x ? 1 : -1) * 90, 150, { fromPlayer: true });
        }
      }
    } else if (prop.type === "barrel") {
      if (prop.fuse <= 0) prop.fuse = 0.22;
    } else if (prop.type === "umbrella") {
      prop.broken = true;
      this.emit("fx", { fxId: "explosions/cartoon-pow", x: prop.x, y: prop.y - 10 });
      this.emit("propBreak", { x: prop.x, y: prop.y });
      this.chaosScore += 25;
    } else if (prop.type === "vending") {
      prop.broken = true;
      this.emit("fx", { fxId: "lightning/zap-hit", x: prop.x, y: prop.y - 12 });
      this.emit("propBreak", { x: prop.x, y: prop.y });
      this.pickups.push({ id: this.uid(), fxId: "pickups/heart-pickup", kind: "heal", amount: 35, x: prop.x - 10, y: prop.y + 8, z: 10, vz: 85, life: 20 });
      this.pickups.push({ id: this.uid(), fxId: "pickups/coin-spin", kind: "cash", amount: 45, x: prop.x + 10, y: prop.y + 8, z: 10, vz: 95, life: 20 });
      this.chaosScore += 40;
    }
  }

  damagePed(ped, damage, pushX = 0, launchZ = 0, { fromPlayer = false } = {}) {
    if (ped.hp <= 0) return;
    ped.hp = Math.max(0, ped.hp - damage);
    ped.hitFlash = 0.16;
    if (pushX) ped.vx = pushX;
    if (launchZ) ped.vz = Math.max(ped.vz, launchZ);
    if (damage > 0) {
      this.emit("damage", { x: ped.x, y: ped.y - 26, amount: Math.round(damage) });
    }

    if (fromPlayer && damage > 0) {
      this.chaosScore += Math.round(damage);
      this.addCrimeHeat(ped.isPolice ? 14 : 7);
    }

    if (ped.hp <= 0) {
      ped.deathAge = 0;
      const dropCash = this.rng.int(ped.cashRange[0], ped.cashRange[1]);
      this.pickups.push({
        id: this.uid(),
        fxId: "pickups/coin-spin",
        kind: "cash",
        amount: dropCash,
        x: ped.x,
        y: ped.y,
        z: 10,
        vz: 85,
        life: 25,
      });
      this.chaosScore += 50;
      if (fromPlayer) this.addCrimeHeat(ped.isPolice ? 24 : 18);
      this.emit("ko", { x: ped.x, y: ped.y });

      if (ped.missionTarget && (this.activeMission?.kind === "defeat_targets" || this.activeMission?.kind === "final_convoy")) {
        this.recordMissionProgress(1);
      }
      return;
    }

    if (fromPlayer && ped.aiState === "wander") {
      if (ped.isPolice || ped.aggro) {
        ped.aiState = "fight";
        ped.aiTimer = 10;
        this.addBubble(ped.id, ANGRY_LINES[this.rng.int(0, ANGRY_LINES.length - 1)], ped.x, ped.y - 34, "#ff8796");
      } else {
        ped.aiState = "panic";
        ped.aiTimer = 6.5;
        if (this.rng.chance(0.55)) {
          this.addBubble(ped.id, PANIC_LINES[this.rng.int(0, PANIC_LINES.length - 1)], ped.x, ped.y - 34, "#ffe2a8");
        }
      }
    }
  }

  damageHero(hero, damage) {
    if (hero.invuln > 0 || hero.hp <= 0) return;
    if (hero.shield > 0) {
      this.emit("fx", { fxId: "impacts/shield-block", x: hero.x, y: hero.y - 12 });
      return;
    }
    hero.hp = Math.max(0, hero.hp - damage);
    hero.invuln = 0.65;
    hero.hitFlash = 0.18;
    this.emit("damage", { x: hero.x, y: hero.y - 28, amount: Math.round(damage), hero: true });

    if (hero.hp <= 0) {
      this.emit("banner", { text: `${hero.name} 重伤 · 暗巷诊所急救归来 ($50)` });
      this.cash = Math.max(0, this.cash - 50);
      hero.hp = hero.maxHp;
      hero.invuln = 2.0;
      this.wanted.heat = Math.max(0, this.wanted.heat - 70);
      this.wanted.level = this.wantedLevelFromHeat(this.wanted.heat);
      if (hero.vehicleId) {
        const v = this.vehicles.find((vh) => vh.id === hero.vehicleId);
        if (v) v.driver = null;
        hero.vehicleId = null;
      }
      hero.y = Math.round((this.scene.sidewalkTop[0] + this.scene.sidewalkTop[1]) / 2);
    }
  }

  damageVehicle(v, dmg) {
    if (v.exploded || dmg <= 0) return;
    v.hp = Math.max(0, v.hp - dmg);
    if (v.hp <= 0 && v.explodeTimer <= 0) {
      v.explodeTimer = 0.85;
      this.emit("fx", { fxId: "fire/campfire", x: v.x, y: v.y - 6 });
    }
  }

  explodeVehicle(v) {
    if (v.exploded) return;
    v.exploded = true;
    v.hp = 0;
    this.shake = Math.max(this.shake, 10);
    this.emit("fx", { fxId: "explosions/big-explosion", x: v.x, y: v.y });
    this.emit("explosion", { x: v.x, y: v.y });
    this.chaosScore += 180;
    this.addCrimeHeat(28);

    if (v.missionTarget && !v.empCounted && (this.activeMission?.kind === "wreck_convoy" || this.activeMission?.kind === "final_convoy")) {
      v.empCounted = true;
      this.recordMissionProgress(1);
    }

    for (const rider of [v.driver, v.passenger]) {
      if (!rider) continue;
      rider.vehicleId = null;
      rider.seat = null;
      rider.x = v.x + this.rng.range(-20, 20);
      rider.y = clamp(v.y - 20, this.scene.sidewalkTop[0], this.scene.sidewalkBottom[1]);
      rider.vz = 130;
      if (rider.hero) this.damageHero(rider, 28);
      else this.damagePed(rider, 90, this.rng.range(-120, 120), 140, { fromPlayer: true });
    }
    v.driver = null;
    v.passenger = null;

    this.applyAreaDamage(v.x, v.y, 82, 95, 220, 145, { explosive: true, statusApply: "burning", shake: 9 });
  }

  requestSceneSwitch(targetSceneId, transitionFxId = "transitions/glitch-wipe", spawnSide = "left") {
    if (!this.scenes[targetSceneId] || this.transition) return false;
    const fx = FX_BY_ID[transitionFxId] || FX_BY_ID["transitions/glitch-wipe"];
    this.transition = {
      fxId: fx.id,
      duration: fx.duration,
      t: 0,
      targetSceneId,
      swapped: false,
      spawnSide,
    };
    return true;
  }

  step(dt, inputMove = { x: 0, y: 0 }, handbrake = false, sprint = false) {
    if (this.paused) return;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.edgeGrace = Math.max(0, this.edgeGrace - dt);

    for (const [k, v] of this.cooldowns.entries()) {
      const next = v - dt;
      if (next <= 0) this.cooldowns.delete(k);
      else this.cooldowns.set(k, next);
    }

    if (this.transition) {
      this.transition.t += dt;
      if (!this.transition.swapped && this.transition.targetSceneId && this.transition.t >= this.transition.duration * 0.45) {
        this.transition.swapped = true;
        const target = this.scenes[this.transition.targetSceneId];
        const spawnX =
          this.transition.spawnSide === "right"
            ? target.width - 110
            : this.transition.spawnSide === "center"
            ? Math.round(target.width * 0.42)
            : 110;
        const keepV = this.player.vehicleId ? this.vehicles.find((v) => v.id === this.player.vehicleId) : null;
        if (keepV) keepV.face = this.transition.spawnSide === "right" ? -1 : 1;
        this.wanted.heat = Math.max(0, this.wanted.heat * 0.55);
        this.wanted.level = this.wantedLevelFromHeat(this.wanted.heat);
        this.populateScene(this.transition.targetSceneId, { spawnX, keepVehicle: keepV });
      }
      if (this.transition.t >= this.transition.duration) {
        this.transition = null;
      }
    }

    this.stepHeroes(dt, inputMove, handbrake, sprint);
    this.stepVehicles(dt, sprint);
    this.stepProps(dt);
    this.stepZones(dt);
    this.stepPeds(dt);
    this.stepProjectiles(dt);
    this.stepHazards(dt);
    this.stepCritters(dt);
    this.stepPickups(dt);
    this.stepWanted(dt);
    this.stepBubbles(dt);
  }

  stepHeroes(dt, inputMove, handbrake, sprint = false) {
    const p = this.player;
    const partner = this.partner;
    const sc = this.scene;

    p.input = inputMove;
    p.sprinting = false;

    if (p.vehicleId) {
      const v = this.vehicles.find((vh) => vh.id === p.vehicleId);
      if (v && !v.exploded) {
        const sp = v.spec;
        const throttle = Math.abs(inputMove.x) > 0.05;
        const boosting = sprint && throttle && v.nitro > 1 && v.empTimer <= 0;
        v.nitroActive = boosting;
        if (boosting) {
          v.nitro = Math.max(0, v.nitro - 36 * dt);
          v.nitroFxTimer -= dt;
          if (v.nitroFxTimer <= 0) {
            v.nitroFxTimer = sp.kind === "tricycle" ? 0.14 : 0.22;
            const exhaustX = v.x - v.face * (sp.w * 0.52);
            this.emit("fx", {
              fxId: sp.kind === "tricycle" ? "fire/flamethrower" : "fire/torch",
              x: exhaustX,
              y: v.y - v.z - 5,
              flip: v.face > 0,
            });
            this.emit("nitro", { x: v.x, y: v.y });
          }
        } else {
          v.nitro = Math.min(100, v.nitro + 18 * dt);
        }

        const topMul = boosting ? (sp.kind === "tricycle" ? 1.65 : 1.38) : 1;
        const accMul = boosting ? (sp.kind === "tricycle" ? 1.85 : 1.5) : 1;

        if (v.empTimer <= 0) {
          if (throttle) {
            const opposing = Math.abs(v.vx) > 18 && Math.sign(inputMove.x) !== Math.sign(v.vx);
            const accel = (opposing ? sp.brake : sp.accel) * accMul;
            v.vx += inputMove.x * accel * dt;
            if (Math.abs(v.vx) < 18) v.face = inputMove.x >= 0 ? 1 : -1;
          } else {
            const dragRate = v.sliding ? sp.drag * 0.25 : sp.drag;
            v.vx *= Math.exp(-dragRate * dt);
            if (Math.abs(v.vx) < 2) v.vx = 0;
          }

          if (handbrake && Math.abs(v.vx) > 35) {
            v.braking = true;
            v.drifting = true;
            v.vx *= Math.exp(-4.2 * dt);
            this.emit("decal", { kind: "skid", x: v.x - v.face * 12, y: v.y });
          } else {
            v.braking = throttle && Math.sign(inputMove.x) !== Math.sign(v.vx) && Math.abs(v.vx) > 30;
            v.drifting = false;
            if (v.braking) this.emit("decal", { kind: "skid", x: v.x - v.face * 10, y: v.y });
          }

          v.vx = clamp(v.vx, -sp.maxSpeed * topMul, sp.maxSpeed * topMul);
          const steerFactor = sp.kind === "tricycle" ? 1 : clamp(0.45 + Math.abs(v.vx) / sp.maxSpeed, 0.45, 1);
          v.vy = inputMove.y * sp.steerY * steerFactor;
        } else {
          v.vx *= Math.exp(-3 * dt);
          v.vy = 0;
        }
        p.x = v.x;
        p.y = v.y;
        p.face = v.face;
      } else {
        p.vehicleId = null;
      }
    } else {
      const len = Math.hypot(inputMove.x, inputMove.y);
      const nx = len > 1 ? inputMove.x / len : inputMove.x;
      const ny = len > 1 ? inputMove.y / len : inputMove.y;
      const moving = len > 0.08;
      p.sprinting = moving && sprint;
      const moveSpeed = p.speed * (p.sprinting ? 1.42 : 1);
      const targetVx = nx * moveSpeed;
      const targetVy = ny * moveSpeed * 0.72;
      const rate = moving ? 920 : 1050;

      const stepAxis = (cur, target) => {
        const diff = target - cur;
        const maxDelta = rate * dt;
        return Math.abs(diff) <= maxDelta ? target : cur + Math.sign(diff) * maxDelta;
      };
      p.vx = stepAxis(p.vx, targetVx);
      p.vy = stepAxis(p.vy, targetVy);

      if (Math.abs(nx) > 0.1) p.face = nx >= 0 ? 1 : -1;
      p.x = clamp(p.x + p.vx * dt, 10, sc.width - 10);
      p.y = clamp(p.y + p.vy * dt, sc.sidewalkTop[0] - 4, sc.sidewalkBottom[1]);
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 6) {
        p.walkPhase = (p.walkPhase + (spd / 13) * dt) % (Math.PI * 2);
      }
    }

    for (const h of this.heroes) {
      h.attackCool = Math.max(0, h.attackCool - dt);
      h.invuln = Math.max(0, h.invuln - dt);
      h.hitFlash = Math.max(0, h.hitFlash - dt);
      h.shield = Math.max(0, h.shield - dt);
      h.jumpBuffer = Math.max(0, h.jumpBuffer - dt);
      h.landTimer = Math.max(0, h.landTimer - dt);
      if (h.action) {
        h.action.t += dt;
        if (h.action.t >= h.action.duration) h.action = null;
      }
      if (!h.vehicleId && h.jumpBuffer > 0 && h.z === 0) {
        h.vz = 178;
        h.jumpBuffer = 0;
      }
      h.prevZ = h.z;
      if (!h.vehicleId && (h.z > 0 || h.vz !== 0)) {
        h.z += h.vz * dt;
        h.vz -= 460 * dt;
        if (h.z <= 0) {
          h.z = 0;
          h.vz = 0;
          if (h.prevZ > 2) {
            h.landTimer = 0.12;
            this.emit("land", { x: h.x, y: h.y });
          }
        }
      }
    }

    partner.sprinting = false;
    if (partner.vehicleId) {
      const v = this.vehicles.find((vh) => vh.id === partner.vehicleId);
      if (v && !v.exploded) {
        partner.x = v.x;
        partner.y = v.y;
        partner.face = v.face;
      } else {
        partner.vehicleId = null;
      }
    } else if (!p.vehicleId) {
      const targetX = clamp(p.x - p.face * 28, 20, sc.width - 20);
      const targetY = clamp(p.y + 4, sc.sidewalkTop[0], sc.sidewalkBottom[1]);
      const dx = targetX - partner.x;
      const dy = targetY - partner.y;
      const d = Math.hypot(dx, dy);
      if (d > 14) {
        partner.sprinting = d > 65;
        const sp = Math.min(partner.speed * (partner.sprinting ? 1.35 : 1), d * 3);
        partner.vx = (dx / d) * sp;
        partner.vy = (dy / d) * sp * 0.72;
        partner.x += partner.vx * dt;
        partner.y += partner.vy * dt;
        partner.face = dx >= 0 ? 1 : -1;
        partner.input = { x: partner.vx / partner.speed, y: partner.vy / partner.speed };
        partner.walkPhase = (partner.walkPhase + (Math.hypot(partner.vx, partner.vy) / 13) * dt) % (Math.PI * 2);
      } else {
        partner.vx = 0;
        partner.vy = 0;
        partner.input = { x: 0, y: 0 };
      }
    }

    if (this.edgeGrace <= 0 && !this.transition) {
      if (p.x <= 18 && sc.exits.left) {
        this.requestSceneSwitch(sc.exits.left, "transitions/glitch-wipe", "right");
      } else if (p.x >= sc.width - 18 && sc.exits.right) {
        this.requestSceneSwitch(sc.exits.right, "transitions/glitch-wipe", "left");
      }
    }
  }

  jump() {
    const p = this.player;
    if (p.vehicleId) return false;
    p.jumpBuffer = 0.12;
    if (p.z <= 0) {
      p.vz = 178;
      p.jumpBuffer = 0;
      return true;
    }
    return true;
  }

  stepVehicles(dt) {
    const sc = this.scene;
    for (const v of this.vehicles) {
      v.hornTimer = Math.max(0, v.hornTimer - dt);
      v.empTimer = Math.max(0, v.empTimer - dt);
      v.rampCooldown = Math.max(0, v.rampCooldown - dt);

      if (v.exploded) continue;
      if (v.explodeTimer > 0) {
        v.explodeTimer -= dt;
        if (v.explodeTimer <= 0) {
          this.explodeVehicle(v);
          continue;
        }
      }

      const onBlizzard = this.weather === "weather/blizzard";
      const onIce = onBlizzard || this.zones.some((z) => z.kind === "ice" && Math.hypot(z.x - v.x, z.y - v.y) <= z.radius);
      v.sliding = onIce && Math.abs(v.vx) > 25;

      if (v.driver && !v.driver.hero && v.empTimer <= 0) {
        const baseCruise = v.spec.kind === "tricycle" ? 56 : v.spec.isPolice ? 140 : 94;
        if (v.spec.isPolice && this.wanted.level >= 3) {
          const dx = this.player.x - v.x;
          const dy = this.player.y - v.y;
          v.aiDir = dx >= 0 ? 1 : -1;
          v.face = v.aiDir;
          v.vx = v.aiDir * clamp(Math.abs(dx) * 1.4, 70, v.spec.maxSpeed * 0.78);
          v.vy = clamp(dy * 1.5, -v.spec.steerY * 0.6, v.spec.steerY * 0.6);
        } else if (!v.sliding) {
          const ahead = this.vehicles.some(
            (o) => o !== v && !o.exploded && Math.abs(o.y - v.y) < 18 && (o.x - v.x) * v.aiDir > 0 && Math.abs(o.x - v.x) < 78
          );
          const targetSpd = ahead ? 0 : v.aiDir * baseCruise;
          v.vx += (targetSpd - v.vx) * Math.min(1, dt * 3);
          v.vy = (v.aiLaneY - v.y) * 1.5;
          v.face = v.aiDir;
        }
        v.driver.x = v.x;
        v.driver.y = v.y;
      } else if (!v.driver) {
        const dragRate = v.sliding ? v.spec.drag * 0.25 : v.spec.drag * 1.3;
        v.vx *= Math.exp(-dragRate * dt);
        if (!v.sliding) v.vy = 0;
        if (Math.abs(v.vx) < 2) v.vx = 0;
      }

      if (v.sliding) {
        v.vy += Math.sin(this.time * 9 + v.id) * 55 * dt;
        this.emit("decal", { kind: "skid", x: v.x, y: v.y });
      }

      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.wheelPhase += (v.vx * dt) / 6;

      v.suspV += (-v.suspY * 140 - v.suspV * 14) * dt;
      v.suspY += v.suspV * dt;

      const wasAirborne = v.z > 2;
      if (v.z > 0 || v.vz !== 0) {
        v.z += v.vz * dt;
        v.vz -= 420 * dt;
        if (v.z <= 0) {
          v.z = 0;
          v.vz = 0;
          if (wasAirborne) {
            v.suspV = 95;
            this.emit("land", { x: v.x, y: v.y });
          }
        }
      }

      if (v.driver && !v.driver.hero) {
        if (v.x < -70) v.x = sc.width + 60;
        if (v.x > sc.width + 70) v.x = -60;
      } else {
        v.x = clamp(v.x, 12, sc.width - 12);
      }

      const minY = v.spec.sidewalkFriendly ? sc.sidewalkTop[0] + 2 : sc.roadLanes[0] - 6;
      const maxY = v.spec.sidewalkFriendly ? sc.sidewalkBottom[1] - 2 : sc.roadLanes[1] + 6;
      v.y = clamp(v.y, minY, maxY);

      const speed = Math.hypot(v.vx, v.vy);
      for (const prop of this.props) {
        if (prop.broken) continue;
        if (prop.type === "ramp") {
          if (v.rampCooldown <= 0 && v.z === 0 && speed > 72 && Math.abs(v.x - prop.x) < 22 && Math.abs(v.y - prop.y) < 14) {
            v.vz = 188 + Math.min(60, speed * 0.24);
            v.rampCooldown = 0.85;
            v.suspV = -70;
            this.emit("ramp", { x: v.x, y: v.y });
            if (v.driver?.hero) this.chaosScore += 75;
          }
        } else if (speed > 45 && Math.abs(v.x - prop.x) < v.spec.w * 0.48 && Math.abs(v.y - prop.y) < 14) {
          this.damageProp(prop, Math.round(speed * 0.4), v.vx);
        }
      }

      if (speed > 68) {
        const hitRangeX = v.spec.w * 0.52;
        for (const ped of this.peds) {
          if (ped.hp <= 0 || ped.vehicleId) continue;
          if (Math.abs(ped.x - v.x) < hitRangeX && Math.abs(ped.y - v.y) < v.spec.depth) {
            const dmg = Math.round(speed * 0.24 * v.spec.mass);
            this.damagePed(ped, dmg, v.vx * 0.9, 95 + speed * 0.25, { fromPlayer: !!v.driver?.hero });
            v.vx *= 0.88;
          }
        }
      }
    }

    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      if (a.exploded) continue;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        if (b.exploded) continue;
        const overlapX = (a.spec.w + b.spec.w) * 0.45 - Math.abs(a.x - b.x);
        const overlapY = (a.spec.depth + b.spec.depth) * 0.65 - Math.abs(a.y - b.y);
        if (overlapX > 0 && overlapY > 0) {
          const dir = a.x <= b.x ? -1 : 1;
          const relSpeed = Math.abs(a.vx - b.vx);
          a.x += dir * overlapX * 0.5;
          b.x -= dir * overlapX * 0.5;
          if (relSpeed > 75) {
            const totalMass = a.spec.mass + b.spec.mass;
            const impact = relSpeed * 0.22;
            this.damageVehicle(a, Math.round((impact * b.spec.mass) / totalMass));
            this.damageVehicle(b, Math.round((impact * a.spec.mass) / totalMass));
            a.vx = dir * relSpeed * 0.35 * (b.spec.mass / totalMass);
            b.vx = -dir * relSpeed * 0.35 * (a.spec.mass / totalMass);
            this.shake = Math.max(this.shake, 3);
          }
        }
      }
    }
  }

  stepProps(dt) {
    for (const prop of this.props) {
      if (prop.fuse > 0 && !prop.broken) {
        prop.fuse -= dt;
        if (prop.fuse <= 0) {
          prop.broken = true;
          this.emit("fx", { fxId: "explosions/barrel-explosion", x: prop.x, y: prop.y });
          this.emit("explosion", { x: prop.x, y: prop.y });
          this.chaosScore += 110;
          this.applyAreaDamage(prop.x, prop.y, 78, 92, 220, 145, { explosive: true, statusApply: "burning", shake: 7 });
        }
      }
      if (prop.geyserTimer > 0) {
        prop.geyserTimer -= dt;
        if (Math.floor((prop.geyserTimer + dt) * 2) !== Math.floor(prop.geyserTimer * 2)) {
          this.emit("fx", { fxId: "water/geyser", x: prop.x, y: prop.y });
        }
      }
    }
  }

  stepZones(dt) {
    for (const z of this.zones) z.life -= dt;
    this.zones = this.zones.filter((z) => z.life > 0);
  }

  stepPeds(dt) {
    const sc = this.scene;
    const p = this.player;

    for (const ped of this.peds) {
      if (ped.vehicleId) continue;
      ped.hitFlash = Math.max(0, ped.hitFlash - dt);
      ped.attackCool = Math.max(0, ped.attackCool - dt);

      if (ped.hp <= 0) {
        ped.deathAge += dt;
        ped.x += ped.vx * dt;
        ped.vx *= Math.exp(-5 * dt);
        if (ped.z > 0 || ped.vz !== 0) {
          ped.z += ped.vz * dt;
          ped.vz -= 460 * dt;
          if (ped.z <= 0) {
            ped.z = 0;
            ped.vz = 0;
          }
        }
        continue;
      }

      let immobilized = false;
      let speedMul = 1;
      if (ped.status) {
        ped.statusTimer -= dt;
        ped.statusTick -= dt;
        const st = ped.status.type;
        if (["frozen", "petrified", "stunned", "sleep"].includes(st)) immobilized = true;
        if (st === "slowed") speedMul = 0.4;
        if (st === "haste") speedMul = 1.9;
        if (ped.statusTick <= 0) {
          ped.statusTick = 0.65;
          if (["burning", "poisoned", "bleeding", "cursed"].includes(st)) {
            this.damagePed(ped, 8, 0, 0, { fromPlayer: true });
          }
        }
        if (ped.statusTimer <= 0) {
          ped.status = null;
          if (ped.aiState === "charm" || ped.aiState === "brawl") ped.aiState = "wander";
        }
      }

      if (ped.z > 0 || ped.vz !== 0) {
        ped.z += ped.vz * dt;
        ped.vz -= 460 * dt;
        if (ped.z <= 0) {
          ped.z = 0;
          ped.vz = 0;
        }
      }

      if (immobilized) {
        ped.vx = 0;
        ped.vy = 0;
        continue;
      }

      if (ped.isPolice && this.wanted.level >= 1 && ped.aiState !== "charm") {
        ped.aiState = "fight";
      }

      if (ped.aiState === "panic") {
        ped.aiTimer -= dt;
        const dir = ped.x >= p.x ? 1 : -1;
        ped.vx = dir * ped.speed * 1.75 * speedMul;
        ped.vy = 0;
        ped.face = dir;
        if (ped.aiTimer <= 0) ped.aiState = "wander";
      } else if (ped.aiState === "charm") {
        const dx = p.x - ped.x;
        const dy = p.y - ped.y;
        const d = Math.hypot(dx, dy);
        if (d > 28) {
          ped.vx = (dx / d) * ped.speed * speedMul;
          ped.vy = (dy / d) * ped.speed * 0.7 * speedMul;
          ped.face = dx >= 0 ? 1 : -1;
        } else {
          ped.vx = 0;
          ped.vy = 0;
        }
      } else if (ped.aiState === "brawl") {
        const target = this.peds.find((o) => o !== ped && o.hp > 0 && !o.vehicleId && Math.hypot(o.x - ped.x, o.y - ped.y) < 160);
        if (target) {
          const dx = target.x - ped.x;
          const dy = target.y - ped.y;
          const d = Math.hypot(dx, dy);
          ped.face = dx >= 0 ? 1 : -1;
          if (d > 24) {
            ped.vx = (dx / d) * ped.speed * 1.3 * speedMul;
            ped.vy = (dy / d) * ped.speed * 0.8 * speedMul;
          } else {
            ped.vx = 0;
            ped.vy = 0;
            if (ped.attackCool <= 0) {
              ped.attackCool = 0.8;
              this.damagePed(target, 14, ped.face * 90, 40, { fromPlayer: false });
            }
          }
        } else {
          ped.aiState = "wander";
        }
      } else if (ped.aiState === "fight") {
        const dx = p.x - ped.x;
        const dy = p.y - ped.y;
        const d = Math.hypot(dx, dy);
        ped.face = dx >= 0 ? 1 : -1;
        if (ped.isPolice && this.wanted.level >= 3 && d < 210 && d > 55 && ped.attackCool <= 0) {
          ped.attackCool = 2.0;
          const ang = Math.atan2(dy, dx);
          this.projectiles.push({
            id: this.uid(),
            fxId: "projectiles/bullet-tracer",
            spec: FX_BY_ID["projectiles/bullet-tracer"],
            ownerHero: false,
            ownerPolice: true,
            x: ped.x + ped.face * 12,
            y: ped.y,
            z: 16,
            vx: Math.cos(ang) * 240,
            vy: Math.sin(ang) * 240,
            angle: ang,
            life: 0,
            maxLife: 1.0,
            radius: 14,
            damage: 10,
            push: 40,
            launch: 0,
          });
        } else if (d > 26) {
          ped.vx = (dx / d) * ped.speed * 1.25 * speedMul;
          ped.vy = (dy / d) * ped.speed * 0.8 * speedMul;
        } else {
          ped.vx = 0;
          ped.vy = 0;
          if (ped.attackCool <= 0 && !p.vehicleId) {
            ped.attackCool = 0.95;
            this.damageHero(p, ped.isPolice ? 12 : ped.boss ? 16 : 9);
          }
        }
      } else {
        ped.aiTimer -= dt;
        if (ped.aiTimer <= 0) {
          ped.aiTimer = this.rng.range(1.6, 4.2);
          ped.wanderDirX = this.rng.chance(0.25) ? 0 : this.rng.sign();
          ped.wanderDirY = this.rng.chance(0.7) ? 0 : this.rng.sign() * 0.4;
        }
        ped.vx = ped.wanderDirX * ped.speed * 0.55 * speedMul;
        ped.vy = ped.wanderDirY * ped.speed * 0.45 * speedMul;
        if (Math.abs(ped.vx) > 2) ped.face = ped.vx >= 0 ? 1 : -1;
      }

      const pSpd = Math.hypot(ped.vx, ped.vy);
      if (pSpd > 4) {
        ped.walkPhase = (ped.walkPhase + (pSpd / 12) * dt) % (Math.PI * 2);
      }

      ped.x = clamp(ped.x + ped.vx * dt, 24, sc.width - 24);
      if (ped.aiState === "wander") {
        const inTop = ped.y <= sc.sidewalkTop[1] + 4;
        const band = inTop ? sc.sidewalkTop : sc.sidewalkBottom;
        ped.y = clamp(ped.y + ped.vy * dt, band[0], band[1]);
      } else {
        ped.y = clamp(ped.y + ped.vy * dt, sc.sidewalkTop[0], sc.sidewalkBottom[1]);
      }
    }

    this.peds = this.peds.filter((ped) => ped.hp > 0 || ped.deathAge < 4.5);
  }

  stepProjectiles(dt) {
    const keep = [];
    for (const pr of this.projectiles) {
      pr.life += dt;
      if (pr.homing && pr.ownerHero) {
        const target = this.peds.find((ped) => ped.hp > 0 && !ped.vehicleId && Math.hypot(ped.x - pr.x, ped.y - pr.y) < 160);
        if (target) {
          const ang = Math.atan2(target.y - pr.y, target.x - pr.x);
          const spd = Math.hypot(pr.vx, pr.vy);
          pr.vx += (Math.cos(ang) * spd - pr.vx) * Math.min(1, dt * 6);
          pr.vy += (Math.sin(ang) * spd - pr.vy) * Math.min(1, dt * 6);
          pr.angle = Math.atan2(pr.vy, pr.vx);
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      let hit = false;
      if (pr.ownerPolice) {
        const p = this.player;
        if (Math.hypot(p.x - pr.x, (p.y - pr.y) * 1.2) < 18) {
          if (p.vehicleId) {
            const v = this.vehicles.find((vh) => vh.id === p.vehicleId);
            if (v) this.damageVehicle(v, 8);
          } else {
            this.damageHero(p, pr.damage);
          }
          this.emit("fx", { fxId: "impacts/bullet-impact", x: pr.x, y: pr.y });
          hit = true;
        }
      } else if (pr.ownerHero) {
        for (const ped of this.peds) {
          if (ped.hp <= 0 || ped.vehicleId) continue;
          if (Math.hypot(ped.x - pr.x, (ped.y - pr.y) * 1.25) < 20) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const v of this.vehicles) {
            if (v.exploded || v.driver?.hero) continue;
            if (Math.abs(v.x - pr.x) < v.spec.w * 0.45 && Math.abs(v.y - pr.y) < 16) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          const impactFx = pr.explosive ? "explosions/small-explosion" : "impacts/bullet-impact";
          this.emit("fx", { fxId: impactFx, x: pr.x, y: pr.y });
          this.applyAreaDamage(pr.x, pr.y, pr.radius, pr.damage, pr.push, pr.launch, pr);
        }
      }

      if (!hit && pr.life < pr.maxLife && pr.x > 0 && pr.x < this.scene.width && pr.y > 50 && pr.y < 270) {
        keep.push(pr);
      } else if (!hit && pr.ownerHero && pr.explosive && pr.life >= pr.maxLife) {
        this.emit("fx", { fxId: "explosions/small-explosion", x: pr.x, y: pr.y });
        this.applyAreaDamage(pr.x, pr.y, pr.radius, pr.damage, pr.push, pr.launch, pr);
      }
    }
    this.projectiles = keep;
  }

  stepHazards(dt) {
    const keep = [];
    for (const hz of this.hazards) {
      hz.timer += dt;

      if (hz.pullForce > 0) {
        for (const ped of this.peds) {
          if (ped.hp <= 0 || ped.vehicleId) continue;
          const dx = hz.x - ped.x;
          const dy = hz.y - ped.y;
          const d = Math.hypot(dx, dy);
          if (d > 8 && d < hz.radius * 1.35) {
            ped.x += (dx / d) * hz.pullForce * dt;
            ped.y += (dy / d) * hz.pullForce * 0.65 * dt;
          }
        }
        for (const v of this.vehicles) {
          if (v.exploded || v.driver?.hero) continue;
          const dx = hz.x - v.x;
          const d = Math.abs(dx);
          if (d > 10 && d < hz.radius * 1.2) {
            v.vx += (Math.sign(dx) * hz.pullForce * dt) / v.spec.mass;
          }
        }
        for (const prop of this.props) {
          if (prop.broken || prop.spec.indestructible) continue;
          const dx = hz.x - prop.x;
          const dy = hz.y - prop.y;
          const d = Math.hypot(dx, dy);
          if (d > 8 && d < hz.radius * 1.25) {
            prop.x += (dx / d) * hz.pullForce * 0.75 * dt;
            prop.y += (dy / d) * hz.pullForce * 0.5 * dt;
          }
        }
      }

      if (hz.pulsesLeft > 0 && hz.timer >= hz.nextPulse) {
        hz.pulsesLeft--;
        hz.nextPulse += hz.pulseInterval;
        if (hz.lineOrigin) {
          const o = hz.lineOrigin;
          for (let s = 0.25; s <= 1.0; s += 0.25) {
            this.applyAreaDamage(o.x + o.dx * o.reach * s, o.y + o.dy * o.reach * s, 32, hz.damage / 3, hz.push, hz.launch, hz.spec);
          }
        } else {
          this.applyAreaDamage(hz.x, hz.y, hz.radius, hz.damage, hz.push, hz.launch, hz.spec);
        }
      }

      if (hz.timer < hz.duration) keep.push(hz);
    }
    this.hazards = keep;
  }

  stepCritters(dt) {
    const keep = [];
    for (const cr of this.critters) {
      cr.life -= dt;
      cr.attackCool = Math.max(0, cr.attackCool - dt);
      const target = this.peds.find((ped) => ped.hp > 0 && !ped.vehicleId && Math.hypot(ped.x - cr.x, ped.y - cr.y) < 180);
      if (target) {
        const dx = target.x - cr.x;
        const dy = target.y - cr.y;
        const d = Math.hypot(dx, dy);
        cr.face = dx >= 0 ? 1 : -1;
        if (d > 16) {
          cr.x += (dx / d) * 68 * dt;
          cr.y += (dy / d) * 48 * dt;
        } else if (cr.attackCool <= 0) {
          cr.attackCool = 0.85;
          this.damagePed(target, cr.damage, cr.face * cr.push, 45, { fromPlayer: true });
        }
      } else {
        cr.x = clamp(cr.x + cr.vx * dt, 24, this.scene.width - 24);
        if (cr.x <= 26 || cr.x >= this.scene.width - 26) cr.vx = -cr.vx;
        cr.face = cr.vx >= 0 ? 1 : -1;
      }
      if (cr.life > 0) keep.push(cr);
    }
    this.critters = keep;
  }

  stepPickups(dt) {
    const p = this.player;
    const keep = [];
    for (const pk of this.pickups) {
      pk.life -= dt;
      if (pk.z > 0 || pk.vz !== 0) {
        pk.z += pk.vz * dt;
        pk.vz -= 340 * dt;
        if (pk.z <= 0) {
          pk.z = 0;
          pk.vz = 0;
        }
      }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 28) {
        if (pk.kind === "cash") this.cash += pk.amount;
        else if (pk.kind === "heal") p.hp = Math.min(p.maxHp, p.hp + pk.amount);
        else if (pk.kind === "shield") p.shield = Math.max(p.shield, 6);
        this.emit("pickup", { kind: pk.kind, amount: pk.amount, x: pk.x, y: pk.y });
      } else if (pk.life > 0) {
        keep.push(pk);
      }
    }
    this.pickups = keep;
  }

  stepWanted(dt) {
    if (this.wanted.level <= 0) return;
    this.wanted.decayTimer -= dt;
    if (this.wanted.decayTimer <= 0) {
      this.wanted.heat = Math.max(0, this.wanted.heat - 11 * dt);
      this.wanted.level = this.wantedLevelFromHeat(this.wanted.heat);
    }

    this.wanted.policeTimer -= dt;
    if (this.wanted.policeTimer <= 0) {
      this.wanted.policeTimer = Math.max(3.6, 8.2 - this.wanted.level * 1.1);
      const activeCops = this.peds.filter((p) => p.isPolice && p.hp > 0 && !p.missionTarget).length;
      const activeCruisers = this.vehicles.filter((v) => v.spec.isPolice && !v.exploded && !v.missionTarget).length;

      if (activeCops < this.wanted.level) {
        const side = this.rng.sign();
        const sx = clamp(this.player.x + side * 240, 40, this.scene.width - 40);
        const sy = this.scene.sidewalkTop[1] - 4;
        const cop = this.spawnPed("police", sx, sy);
        cop.aiState = "fight";
      }
      if (this.wanted.level >= 2 && activeCruisers < Math.min(2, this.wanted.level - 1)) {
        const side = this.rng.sign();
        const sx = clamp(this.player.x + side * 290, 60, this.scene.width - 60);
        const sy = this.scene.roadLanes[0] + 24;
        const cruiser = this.spawnVehicle("police", sx, sy, { face: -side, withDriver: true });
        cruiser.vx = -side * 120;
      }
    }
  }

  stepBubbles(dt) {
    for (const b of this.bubbles) b.life -= dt;
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
  }
}
