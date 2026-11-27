import { STEP, PROTAGONISTS, SCENE_SPECS } from "./data.js";
import { ALL_FX, CATEGORIES, FX_BY_ID, FX_BY_CATEGORY, searchFx } from "./fx-catalog.js";
import { drawPortrait } from "./art.js";
import { World } from "./world.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";
import { Audio } from "./audio.js";

const canvas = document.getElementById("game");
const world = new World(2026);
const renderer = new Renderer(canvas);
const audio = new Audio();

const els = {
  hotbar: document.getElementById("hotbar"),
  fxModal: document.getElementById("fx-modal"),
  sceneModal: document.getElementById("scene-modal"),
  fxSearch: document.getElementById("fx-search"),
  fxCats: document.getElementById("fx-cats"),
  fxGrid: document.getElementById("fx-grid"),
  fxSlotLabel: document.getElementById("fx-slot-label"),
  sceneCards: document.getElementById("scene-cards"),
  transitionSelect: document.getElementById("transition-select"),
  chkFgOcclusion: document.getElementById("chk-fg-occlusion"),
  parallaxSelect: document.getElementById("parallax-select"),
  btnCam: document.getElementById("btn-cam"),
  btnFg: document.getElementById("btn-fg"),
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
  trendViewers: document.getElementById("trend-viewers"),
  trendOverdrive: document.getElementById("trend-overdrive"),
  trendTitle: document.getElementById("trend-title"),
  trendFill: document.getElementById("trend-fill"),
  trendDanmaku: document.getElementById("trend-danmaku"),
  heroCard0: document.getElementById("hero-card-0"),
  heroCard1: document.getElementById("hero-card-1"),
  h0Hp: document.getElementById("h0-hp"),
  h1Hp: document.getElementById("h1-hp"),
  h0Tag: document.getElementById("h0-tag"),
  h1Tag: document.getElementById("h1-tag"),
};

drawPortrait(document.getElementById("portrait-0"), PROTAGONISTS[0]);
drawPortrait(document.getElementById("portrait-1"), PROTAGONISTS[1]);

let activeCategory = "all";
let bannerTimer = 0;

function showBanner(text, duration = 2.4) {
  els.banner.textContent = text;
  els.banner.hidden = false;
  bannerTimer = duration;
}

function toggleModal(modal, open) {
  const show = open ?? modal.hidden;
  els.fxModal.hidden = true;
  els.sceneModal.hidden = true;
  modal.hidden = !show;
  world.paused = !els.fxModal.hidden || !els.sceneModal.hidden;
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
    const equipped = world.loadout[world.selectedSlot] === fx.id;
    const item = document.createElement("button");
    item.className = `fx-item${equipped ? " equipped" : ""}`;
    item.innerHTML = `
      <div class="fx-item-head"><span>${fx.categoryZh}</span><span>${fx.mode}</span></div>
      <strong>${fx.name}</strong>
      <small>${fx.desc || fx.id}</small>
    `;
    item.addEventListener("click", (e) => {
      audio.unlock();
      world.equipFx(fx.id, world.selectedSlot);
      renderHotbar();
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
    const customFlag = renderer.scenes.get(sc.id)?.custom ? " · 已加载自定义背景" : "";
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

function loadBgFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    els.bgUploadStatus.textContent = "请选择 PNG / WebP / JPEG 像素背景图！";
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const res = renderer.scenes.setCustomBackground(world.sceneId, img, "bg");
    URL.revokeObjectURL(url);
    if (res) {
      world.setSceneWidth(world.sceneId, res.width);
      els.bgUploadStatus.textContent = `已加载：${file.name}（适配宽度 ${res.width}×270px）`;
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

const input = new Input(canvas, (action) => {
  audio.unlock();

  if (action === "escape") {
    if (!els.fxModal.hidden) return toggleModal(els.fxModal, false);
    if (!els.sceneModal.hidden) return toggleModal(els.sceneModal, false);
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
document.getElementById("btn-clear-weather").addEventListener("click", () => {
  world.weather = null;
  showBanner("天气恢复晴朗", 1.5);
});
document.getElementById("btn-clear-wanted").addEventListener("click", () => world.clearWanted());
document.getElementById("btn-mute").addEventListener("click", (e) => {
  audio.muted = !audio.muted;
  e.currentTarget.textContent = audio.muted ? "🔇 静音" : "🔊 音效";
});

function syncCameraControls() {
  els.btnCam.textContent = renderer.cam.cinematic ? "🎥 电影镜头: 开" : "🎥 电影镜头: 关";
  els.btnFg.textContent = renderer.foregroundOcclusion ? "🌴 前景遮挡: 开" : "🌴 前景遮挡: 关";
  els.btnFg.classList.toggle("cyan", renderer.foregroundOcclusion);
  if (els.chkFgOcclusion) els.chkFgOcclusion.checked = renderer.foregroundOcclusion;
}

els.btnCam.addEventListener("click", () => {
  const next = !renderer.cam.cinematic;
  renderer.cam.cinematic = next;
  renderer.postProcess = next;
  syncCameraControls();
});

els.btnFg.addEventListener("click", () => {
  renderer.foregroundOcclusion = !renderer.foregroundOcclusion;
  syncCameraControls();
});

els.chkFgOcclusion.addEventListener("change", (e) => {
  renderer.foregroundOcclusion = e.target.checked;
  syncCameraControls();
});

els.parallaxSelect.addEventListener("change", (e) => {
  renderer.parallaxStrength = Number(e.target.value);
});

syncCameraControls();

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
  els.bgUploadStatus.textContent = "已恢复当前街区默认多层视差背景。";
  renderSceneModal();
});

renderHotbar();
renderSceneModal();

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

  // Livestream Trend HUD
  const tr = world.trend;
  els.trendViewers.textContent = `${tr.viewers} 围观`;
  els.trendOverdrive.hidden = tr.overdriveTimer <= 0;
  els.trendTitle.textContent = tr.challenge.title;
  els.trendFill.style.width = `${Math.min(100, (tr.progress / tr.challenge.goal) * 100)}%`;
  els.trendDanmaku.textContent = tr.danmaku[tr.danmaku.length - 1] || "";

  // Cooldown bars
  world.loadout.forEach((fxId, idx) => {
    const bar = els.hotbar.querySelector(`.slot-cd[data-slot="${idx}"]`);
    if (!bar) return;
    const rem = world.cooldowns.get(fxId) || 0;
    const max = FX_BY_ID[fxId]?.cooldown || 0.5;
    bar.style.width = rem > 0 ? `${Math.min(100, (rem / max) * 100)}%` : "0%";
  });
}

let last = performance.now();
let acc = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) els.banner.hidden = true;
  }

  if (!world.paused) {
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
      else audio.play(ev.type, ev);
    }
    renderer.tick(dt, world);
  }

  renderer.render(world, input.mouse);
  syncHud();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
