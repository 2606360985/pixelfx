import { STEP, SCENE_SPECS, SCENE_BY_ID } from "./data.js";
import { ALL_FX, CATEGORIES, FX_BY_ID, FX_BY_CATEGORY, fxUnlockChapter, isFxUnlocked, searchFx } from "./fx-catalog.js";
import { STORY_CHAPTERS } from "./story-data.js";
import { AssetStore } from "./assets.js";
import { World } from "./world.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";
import { Audio } from "./audio.js";
import { VNController } from "./vn.js";

const SAVE_KEY = "gta2_noir_save_v1";

const canvas = document.getElementById("game");
const assets = new AssetStore();
const world = new World(2026);
const renderer = new Renderer(canvas, assets);
const audio = new Audio();

const els = {
  hotbar: document.getElementById("hotbar"),
  fxModal: document.getElementById("fx-modal"),
  sceneModal: document.getElementById("scene-modal"),
  storyModal: document.getElementById("story-modal"),
  fxSearch: document.getElementById("fx-search"),
  fxCats: document.getElementById("fx-cats"),
  fxGrid: document.getElementById("fx-grid"),
  fxSlotLabel: document.getElementById("fx-slot-label"),
  sceneCards: document.getElementById("scene-cards"),
  transitionSelect: document.getElementById("transition-select"),
  dropZone: document.getElementById("drop-zone"),
  bgFileInput: document.getElementById("bg-file-input"),
  bgUploadStatus: document.getElementById("bg-upload-status"),
  banner: document.getElementById("hud-banner"),
  cash: document.getElementById("hud-cash"),
  chaos: document.getElementById("hud-chaos"),
  stars: document.getElementById("hud-stars"),
  scene: document.getElementById("hud-scene"),
  weather: document.getElementById("hud-weather"),
  vehBadge: document.getElementById("veh-badge"),
  footBadge: document.getElementById("foot-badge"),
  vehName: document.getElementById("veh-name"),
  vehSpeed: document.getElementById("veh-speed"),
  vehNitro: document.getElementById("veh-nitro"),
  heroCard0: document.getElementById("hero-card-0"),
  heroCard1: document.getElementById("hero-card-1"),
  h0Hp: document.getElementById("h0-hp"),
  h1Hp: document.getElementById("h1-hp"),
  h0Tag: document.getElementById("h0-tag"),
  h1Tag: document.getElementById("h1-tag"),
  storyChapter: document.getElementById("story-chapter"),
  storyTrust: document.getElementById("story-trust"),
  storyAlign: document.getElementById("story-align"),
  missionTitle: document.getElementById("mission-title"),
  missionDesc: document.getElementById("mission-desc"),
  missionFill: document.getElementById("mission-fill"),
  btnMissionWarp: document.getElementById("btn-mission-warp"),
  btnSandboxFx: document.getElementById("btn-sandbox-fx"),
  storySummaryLine: document.getElementById("story-summary-line"),
  storyLog: document.getElementById("story-log"),
};

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.exportStoryState()));
  } catch {
    // Ignore storage quota errors
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return world.importStoryState(JSON.parse(raw));
  } catch {
    return false;
  }
}

const vn = new VNController(document.getElementById("vn-overlay"), world, {
  onStateChange: () => {
    renderHotbar();
    syncHud();
    saveProgress();
  },
  onAudio: (type) => audio.play(type),
});

let activeCategory = "all";
let bannerTimer = 0;
let pendingVnTimer = 0;

function showBanner(text, duration = 2.4) {
  els.banner.textContent = text;
  els.banner.hidden = false;
  bannerTimer = duration;
}

function toggleModal(modal, open) {
  const show = open ?? modal.hidden;
  els.fxModal.hidden = true;
  els.sceneModal.hidden = true;
  els.storyModal.hidden = true;
  modal.hidden = !show;
  world.paused = vn.isOpen || !els.fxModal.hidden || !els.sceneModal.hidden || !els.storyModal.hidden;
  if (!world.paused) canvas.focus();
}

function renderHotbar() {
  els.hotbar.innerHTML = "";
  world.loadout.forEach((fxId, idx) => {
    const spec = FX_BY_ID[fxId] || ALL_FX[0];
    const btn = document.createElement("button");
    btn.className = `slot${world.selectedSlot === idx ? " active" : ""}`;
    btn.innerHTML = `
      <div class="slot-top"><span>${idx + 1}</span><span>${spec.mode.toUpperCase()}</span></div>
      <div class="slot-name" title="${spec.name}">${spec.name}</div>
      <div class="slot-cat">${spec.categoryZh}</div>
      <div class="slot-cd" data-slot="${idx}"></div>
    `;
    btn.addEventListener("click", () => {
      audio.unlock();
      world.selectSlot(idx);
      renderHotbar();
    });
    els.hotbar.appendChild(btn);
  });
  els.fxSlotLabel.textContent = `槽位 ${world.selectedSlot + 1}`;
}

function renderFxBrowser() {
  els.fxCats.innerHTML = "";
  const tabs = [{ id: "all", zh: `全部 (${ALL_FX.length})` }, ...CATEGORIES.map((c) => ({ id: c.id, zh: `${c.zh} (${FX_BY_CATEGORY[c.id].length})` }))];
  for (const tab of tabs) {
    const btn = document.createElement("button");
    btn.className = `cat-btn${activeCategory === tab.id ? " active" : ""}`;
    btn.textContent = tab.zh;
    btn.addEventListener("click", () => {
      activeCategory = tab.id;
      renderFxBrowser();
    });
    els.fxCats.appendChild(btn);
  }

  const list = searchFx(els.fxSearch.value, activeCategory);
  els.fxGrid.innerHTML = "";
  for (const fx of list) {
    const unlocked = isFxUnlocked(fx.id, world.story.unlockedChapter, world.story.sandboxAllFx);
    const reqChap = fxUnlockChapter(fx.id);
    const equipped = world.loadout[world.selectedSlot] === fx.id;
    const item = document.createElement("button");
    item.className = `fx-item${equipped ? " equipped" : ""}${unlocked ? "" : " locked"}`;
    item.innerHTML = `
      <div class="fx-item-head"><span>${fx.categoryZh}</span><span>${unlocked ? fx.mode : `🔒 第${reqChap}章`}</span></div>
      <strong>${fx.name}</strong>
      <small>${fx.desc || fx.id}</small>
    `;
    item.addEventListener("click", (e) => {
      audio.unlock();
      if (!unlocked) {
        showBanner(`需推进至第 ${reqChap} 章或开启顶部「全244沙盒」`, 1.8);
        return;
      }
      world.equipFx(fx.id, world.selectedSlot);
      renderHotbar();
      saveProgress();
      if (e.shiftKey) {
        toggleModal(els.fxModal, false);
        const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
        world.castSkill(fx.id, aim.x, aim.y);
      } else {
        renderFxBrowser();
      }
    });
    els.fxGrid.appendChild(item);
  }
}

function renderSceneModal() {
  if (!els.transitionSelect.options.length) {
    for (const tr of FX_BY_CATEGORY.transitions) {
      const opt = document.createElement("option");
      opt.value = tr.id;
      opt.textContent = `${tr.name} (${tr.id})`;
      if (tr.id === "transitions/glitch-wipe") opt.selected = true;
      els.transitionSelect.appendChild(opt);
    }
  }

  els.sceneCards.innerHTML = "";
  for (const sc of SCENE_SPECS) {
    const cur = world.sceneId === sc.id;
    const btn = document.createElement("button");
    btn.className = `scene-card${cur ? " current" : ""}`;
    const customFlag = renderer.scenes.get(sc.id)?.custom ? " · 已加载自定义图" : "";
    btn.innerHTML = `<strong>${sc.name}</strong><small>${sc.subtitle}${customFlag}</small>`;
    btn.addEventListener("click", () => {
      audio.unlock();
      if (sc.id !== world.sceneId) {
        world.requestSceneSwitch(sc.id, els.transitionSelect.value, "center");
      }
      toggleModal(els.sceneModal, false);
    });
    els.sceneCards.appendChild(btn);
  }
}

function renderStoryModal() {
  const chap = STORY_CHAPTERS[world.story.chapter] || STORY_CHAPTERS[0];
  els.storySummaryLine.textContent = `当前章节：${chap.name} · 搭档羁绊 ${world.story.trust} · 警律 ${world.story.law} / 街头 ${world.story.street}`;
  els.storyLog.innerHTML = "";
  const logs = world.story.dialogueLog;
  if (!logs.length) {
    els.storyLog.innerHTML = `<div class="log-entry"><span>暂无对话记录。点击下方「重播当前章节剧情」开启剧情。</span></div>`;
    return;
  }
  for (const item of logs.slice().reverse()) {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<small>${item.scene}</small><strong>${item.speaker}</strong><span>${item.text}</span>`;
    els.storyLog.appendChild(div);
  }
}

function loadBgFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    els.bgUploadStatus.textContent = "请选择 PNG / WebP / JPEG 街景图！";
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const res = renderer.scenes.setCustomBackground(world.sceneId, img);
    URL.revokeObjectURL(url);
    if (res) {
      world.setSceneWidth(world.sceneId, res.width);
      els.bgUploadStatus.textContent = `已加载：${file.name}（适配逻辑宽度 ${res.width}px）`;
      renderSceneModal();
      showBanner(`已替换当前街区背景 · ${file.name}`);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    els.bgUploadStatus.textContent = "图片读取失败，请检查文件格式。";
  };
  img.src = url;
}

const input = new Input(canvas, (action, code) => {
  audio.unlock();

  if (vn.isOpen) {
    vn.handleKey(code);
    return;
  }

  if (action === "escape") {
    if (!els.fxModal.hidden) return toggleModal(els.fxModal, false);
    if (!els.sceneModal.hidden) return toggleModal(els.sceneModal, false);
    if (!els.storyModal.hidden) return toggleModal(els.storyModal, false);
    return;
  }
  if (action === "fxwheel") {
    renderHotbar();
    renderFxBrowser();
    return toggleModal(els.fxModal);
  }
  if (action === "scenes") {
    renderSceneModal();
    return toggleModal(els.sceneModal);
  }
  if (action === "storylog") {
    renderStoryModal();
    return toggleModal(els.storyModal);
  }

  if (world.paused) return;

  if (action === "switch") {
    world.switchHero();
    return;
  }
  if (action === "vehicle") {
    world.toggleVehicle();
    return;
  }
  if (action === "interact") {
    world.interact();
    return;
  }
  if (action === "horn") {
    world.honk();
    return;
  }
  if (action === "space") {
    if (!world.player.vehicleId) world.jump();
    return;
  }
  if (action === "cast") {
    const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    world.castSkill(world.loadout[world.selectedSlot], aim.x, aim.y);
    return;
  }
  if (action === "melee") {
    world.quickMelee();
    return;
  }
  if (action === "nextSlot") {
    world.selectSlot((world.selectedSlot + 1) % world.loadout.length);
    renderHotbar();
    return;
  }
  if (action === "prevSlot") {
    world.selectSlot((world.selectedSlot - 1 + world.loadout.length) % world.loadout.length);
    renderHotbar();
    return;
  }
  if (action.startsWith("slot")) {
    const idx = Number(action.slice(4));
    world.selectSlot(idx);
    renderHotbar();
  }
});

// UI Button Bindings
document.getElementById("btn-open-fx").addEventListener("click", () => {
  audio.unlock();
  renderFxBrowser();
  toggleModal(els.fxModal);
});
document.getElementById("close-fx").addEventListener("click", () => toggleModal(els.fxModal, false));
document.getElementById("btn-open-scenes").addEventListener("click", () => {
  audio.unlock();
  renderSceneModal();
  toggleModal(els.sceneModal);
});
document.getElementById("close-scene").addEventListener("click", () => toggleModal(els.sceneModal, false));
document.getElementById("btn-open-story").addEventListener("click", () => {
  audio.unlock();
  renderStoryModal();
  toggleModal(els.storyModal);
});
document.getElementById("close-story").addEventListener("click", () => toggleModal(els.storyModal, false));

els.btnSandboxFx.addEventListener("click", () => {
  audio.unlock();
  world.setSandboxAllFx(!world.story.sandboxAllFx);
  if (!els.fxModal.hidden) renderFxBrowser();
  syncHud();
  saveProgress();
});

document.getElementById("btn-clear-weather").addEventListener("click", () => {
  world.weather = null;
  showBanner("雨夜放晴", 1.5);
});
document.getElementById("btn-clear-wanted").addEventListener("click", () => world.clearWanted());
document.getElementById("btn-mute").addEventListener("click", (e) => {
  audio.muted = !audio.muted;
  e.currentTarget.textContent = audio.muted ? "🔇 静音" : "🔊 音效";
});
document.getElementById("btn-post").addEventListener("click", (e) => {
  renderer.postProcess = !renderer.postProcess;
  e.currentTarget.textContent = renderer.postProcess ? "🎬 电影滤镜: 开" : "🎬 电影滤镜: 关";
});

els.btnMissionWarp.addEventListener("click", () => {
  const m = world.activeMission;
  if (m && m.sceneId !== world.sceneId) {
    world.requestSceneSwitch(m.sceneId, "transitions/glitch-wipe", "center");
  }
});

document.getElementById("btn-replay-vn").addEventListener("click", () => {
  const chap = world.story.chapter;
  const sceneMap = ["prologue_open", "ch1_open", "ch2_open", "ch3_open", "ch4_open"];
  toggleModal(els.storyModal, false);
  vn.play(sceneMap[chap] || "prologue_open");
});

document.getElementById("btn-reset-story").addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  world.resetStory();
  toggleModal(els.storyModal, false);
  vn.play("prologue_open");
});

document.getElementById("btn-ending-freeroam").addEventListener("click", () => {
  vn.close();
  showBanner("自由九龙模式 · 全 244 特效已解封！");
});
document.getElementById("btn-ending-restart").addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  world.resetStory();
  vn.play("prologue_open");
});

els.heroCard0.addEventListener("click", () => {
  if (world.activeIdx !== 0) world.switchHero();
});
els.heroCard1.addEventListener("click", () => {
  if (world.activeIdx !== 1) world.switchHero();
});
els.fxSearch.addEventListener("input", () => renderFxBrowser());

els.bgFileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) loadBgFile(file);
  e.target.value = "";
});
els.dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  els.dropZone.classList.add("dragover");
});
els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragover"));
els.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  els.dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) loadBgFile(file);
});
document.getElementById("btn-reset-bg").addEventListener("click", () => {
  renderer.scenes.resetSceneBackground(world.sceneId);
  world.setSceneWidth(world.sceneId, 2400);
  els.bgUploadStatus.textContent = "已恢复当前街区默认写实长卷。";
  renderSceneModal();
});

function syncHud() {
  const [h0, h1] = world.heroes;
  els.heroCard0.classList.toggle("active", world.activeIdx === 0);
  els.heroCard1.classList.toggle("active", world.activeIdx === 1);
  els.h0Tag.textContent = world.activeIdx === 0 ? "主控" : "AI搭档";
  els.h1Tag.textContent = world.activeIdx === 1 ? "主控" : "AI搭档";
  els.h0Hp.style.width = `${Math.max(0, (h0.hp / h0.maxHp) * 100)}%`;
  els.h1Hp.style.width = `${Math.max(0, (h1.hp / h1.maxHp) * 100)}%`;

  els.cash.textContent = `$${world.cash}`;
  els.chaos.textContent = `CHAOS ${world.chaosScore}`;
  els.scene.textContent = world.scene.name;

  const lv = world.wanted.level;
  els.stars.textContent = "★".repeat(lv) + "☆".repeat(5 - lv);
  els.stars.classList.toggle("hot", lv >= 3);

  if (world.weather && FX_BY_ID[world.weather]) {
    els.weather.hidden = false;
    els.weather.textContent = `天气: ${FX_BY_ID[world.weather].name}`;
  } else {
    els.weather.hidden = true;
  }

  const p = world.player;
  const v = p.vehicleId ? world.vehicles.find((vh) => vh.id === p.vehicleId) : null;
  if (v && !v.exploded) {
    els.vehBadge.hidden = false;
    els.footBadge.hidden = true;
    els.vehName.textContent = v.spec.kind === "tricycle" && v.nitroActive ? `${v.spec.name} · ⚡喷射` : v.spec.name;
    els.vehSpeed.textContent = `${Math.round(Math.abs(v.vx) * 0.48)} KM/H`;
    els.vehNitro.style.width = `${Math.round(v.nitro)}%`;
  } else {
    els.vehBadge.hidden = true;
    els.footBadge.hidden = false;
  }

  // Story & Mission HUD
  const chapSpec = STORY_CHAPTERS[world.story.chapter] || STORY_CHAPTERS[0];
  els.storyChapter.textContent = chapSpec.name.split("·")[0].trim();
  els.storyTrust.textContent = `羁绊 ${world.story.trust}`;
  els.storyAlign.textContent =
    world.story.law > world.story.street
      ? `警律 ${world.story.law}`
      : world.story.street > world.story.law
      ? `街头 ${world.story.street}`
      : "平衡";

  const m = world.activeMission;
  if (m) {
    els.missionTitle.textContent = `${m.title} (${world.story.missionProgress}/${world.story.missionGoal})`;
    els.missionDesc.textContent = m.desc;
    els.missionFill.style.width = `${Math.min(100, (world.story.missionProgress / Math.max(1, world.story.missionGoal)) * 100)}%`;
    els.btnMissionWarp.hidden = m.sceneId === world.sceneId;
    if (m.sceneId !== world.sceneId) {
      els.btnMissionWarp.textContent = `前往 ${SCENE_BY_ID[m.sceneId]?.name || ""} ➔`;
    }
  } else if (world.story.endingId) {
    els.missionTitle.textContent = "主线已通关 · 自由探索";
    els.missionDesc.textContent = "全 244 特效已解封，可随时按 M 切换四大写实街区或按 V 重温剧情。";
    els.missionFill.style.width = "100%";
    els.btnMissionWarp.hidden = true;
  } else {
    els.missionTitle.textContent = "剧情衔接中…";
    els.missionDesc.textContent = "即将切入下一幕 VN 剧情。";
    els.missionFill.style.width = "0%";
    els.btnMissionWarp.hidden = true;
  }

  els.btnSandboxFx.textContent = world.story.sandboxAllFx ? "🔓 全244沙盒: 开" : "🔒 全244沙盒: 关";
  els.btnSandboxFx.classList.toggle("active", world.story.sandboxAllFx);

  world.loadout.forEach((fxId, idx) => {
    const bar = els.hotbar.querySelector(`.slot-cd[data-slot="${idx}"]`);
    if (!bar) return;
    const rem = world.cooldowns.get(fxId) || 0;
    const max = FX_BY_ID[fxId]?.cooldown || 0.5;
    bar.style.width = rem > 0 ? `${Math.min(100, (rem / max) * 100)}%` : "0%";
  });
}

// Pass key code to Input callback so VN can handle Space/Enter/1/2/3
loadProgress();
renderHotbar();
renderSceneModal();
syncHud();

assets.loadAll().then(() => {
  renderer.refreshAssets(assets);
  if (world.story.pendingVnSceneId && !vn.isOpen) {
    vn.play(world.story.pendingVnSceneId);
  }
});

let last = performance.now();
let acc = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) els.banner.hidden = true;
  }

  if (vn.isOpen) {
    vn.tick(dt);
  } else if (!world.paused) {
    acc += dt;
    while (acc >= STEP) {
      world.step(STEP, input.movement(), input.handbrake(), input.sprint());
      acc -= STEP;
    }
    const events = world.events.splice(0);
    renderer.handle(events, world);
    for (const ev of events) {
      if (ev.type === "banner") showBanner(ev.text);
      else if (ev.type === "message") showBanner(ev.text, 1.5);
      else if (ev.type === "missionComplete") {
        pendingVnTimer = 0.9;
        saveProgress();
      } else if (ev.type === "storyUpdate") {
        saveProgress();
      } else {
        audio.play(ev.type, ev);
      }
    }
    if (pendingVnTimer > 0) {
      pendingVnTimer -= dt;
      if (pendingVnTimer <= 0 && world.story.pendingVnSceneId && !vn.isOpen) {
        vn.play(world.story.pendingVnSceneId);
      }
    }
    renderer.tick(dt, world);
  }

  renderer.render(world, input.mouse);
  syncHud();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
