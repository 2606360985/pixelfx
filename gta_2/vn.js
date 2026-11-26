import { STORY_CHARACTERS, VN_SCENES, ENDINGS } from "./story-data.js";

export class VNController {
  constructor(rootEl, world, { onStateChange, onAudio } = {}) {
    this.root = rootEl;
    this.world = world;
    this.onStateChange = onStateChange || (() => {});
    this.onAudio = onAudio || (() => {});

    this.activeScene = null;
    this.currentNodeId = null;
    this.currentNode = null;
    this.fullText = "";
    this.shownChars = 0;
    this.typing = false;
    this.autoPlay = false;
    this.autoTimer = 0;

    this.els = {
      bg: rootEl.querySelector("#vn-bg"),
      chapter: rootEl.querySelector("#vn-chapter"),
      leftImg: rootEl.querySelector("#vn-left"),
      rightImg: rootEl.querySelector("#vn-right"),
      speaker: rootEl.querySelector("#vn-speaker"),
      title: rootEl.querySelector("#vn-role"),
      text: rootEl.querySelector("#vn-text"),
      choices: rootEl.querySelector("#vn-choices"),
      nextHint: rootEl.querySelector("#vn-next-hint"),
      toast: rootEl.querySelector("#vn-toast"),
      btnAuto: rootEl.querySelector("#vn-auto"),
      btnSkip: rootEl.querySelector("#vn-skip"),
      endingBox: rootEl.querySelector("#vn-ending"),
      endingTitle: rootEl.querySelector("#vn-ending-title"),
      endingSub: rootEl.querySelector("#vn-ending-sub"),
      endingDesc: rootEl.querySelector("#vn-ending-desc"),
      endingStats: rootEl.querySelector("#vn-ending-stats"),
    };

    this.bindEvents();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  bindEvents() {
    this.root.querySelector("#vn-dialog-box").addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      this.advance();
    });

    this.els.btnAuto.addEventListener("click", (e) => {
      e.stopPropagation();
      this.autoPlay = !this.autoPlay;
      this.els.btnAuto.classList.toggle("active", this.autoPlay);
      this.els.btnAuto.textContent = this.autoPlay ? "▶ 自动: 开" : "▶ 自动";
    });

    this.els.btnSkip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.skipToChoiceOrEnd();
    });
  }

  play(sceneId) {
    const scene = VN_SCENES[sceneId];
    if (!scene) return false;
    this.activeScene = scene;
    this.world.story.pendingVnSceneId = null;
    this.world.paused = true;
    this.root.hidden = false;
    this.els.endingBox.hidden = true;
    this.els.chapter.textContent = scene.title;
    this.els.toast.hidden = true;

    if (scene.bg && scene.bg !== "live") {
      this.els.bg.style.backgroundImage = `url('./assets/cg/${scene.bg.replace("cg_", "")}.png')`;
      this.els.bg.classList.add("has-cg");
    } else {
      this.els.bg.style.backgroundImage = "";
      this.els.bg.classList.remove("has-cg");
    }

    this.showNode("n1");
    this.onStateChange();
    return true;
  }

  showNode(nodeId) {
    const node = this.activeScene?.nodes?.[nodeId];
    if (!node) {
      this.close();
      return;
    }
    this.currentNodeId = nodeId;
    this.currentNode = node;

    const char = STORY_CHARACTERS[node.speaker] || STORY_CHARACTERS.narrator;
    this.els.speaker.textContent = char.name;
    this.els.speaker.style.color = char.color;
    this.els.title.textContent = char.title;

    // Portraits
    this.updatePortrait(this.els.leftImg, node.leftChar, node.side === "left", node.mood);
    this.updatePortrait(this.els.rightImg, node.rightChar, node.side === "right", node.mood);

    // Text typewriter
    this.fullText = node.text || "";
    this.shownChars = 0;
    this.typing = true;
    this.autoTimer = 0;
    this.els.text.textContent = "";
    this.els.choices.innerHTML = "";
    this.els.choices.hidden = true;
    this.els.nextHint.hidden = false;

    // Record in dialogue log
    this.world.story.dialogueLog.push({
      scene: this.activeScene.title,
      speaker: char.name,
      text: this.fullText,
    });
    if (this.world.story.dialogueLog.length > 60) this.world.story.dialogueLog.shift();

    this.onAudio("talk");
  }

  updatePortrait(imgEl, charId, isActive, mood = "calm") {
    if (!charId || !STORY_CHARACTERS[charId]?.portrait) {
      imgEl.hidden = true;
      imgEl.removeAttribute("src");
      return;
    }
    const nextSrc = `./assets/portraits/${STORY_CHARACTERS[charId].portrait}.png`;
    if (imgEl.getAttribute("src") !== nextSrc) {
      imgEl.src = nextSrc;
    }
    imgEl.hidden = false;
    imgEl.classList.toggle("active", !!isActive);
    imgEl.classList.toggle("dim", !isActive);
    imgEl.dataset.mood = isActive ? mood || "calm" : "calm";
  }

  tick(dt) {
    if (!this.isOpen || !this.currentNode || !this.els.endingBox.hidden) return;
    if (this.typing) {
      this.shownChars += dt * 44;
      const count = Math.min(this.fullText.length, Math.floor(this.shownChars));
      this.els.text.textContent = this.fullText.slice(0, count);
      if (count >= this.fullText.length) {
        this.finishTyping();
      }
    } else if (this.autoPlay && !this.currentNode.choices) {
      this.autoTimer += dt;
      if (this.autoTimer >= 1.5) {
        this.advance();
      }
    }
  }

  finishTyping() {
    this.typing = false;
    this.shownChars = this.fullText.length;
    this.els.text.textContent = this.fullText;

    if (this.currentNode?.choices?.length) {
      this.els.nextHint.hidden = true;
      this.els.choices.hidden = false;
      this.els.choices.innerHTML = "";
      this.currentNode.choices.forEach((ch, idx) => {
        const btn = document.createElement("button");
        btn.className = "vn-choice-btn";
        btn.innerHTML = `<span class="vn-choice-num">${idx + 1}</span><div><strong>${ch.label}</strong><small>${ch.tag || ""}</small></div>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.pickChoice(idx);
        });
        this.els.choices.appendChild(btn);
      });
    }
  }

  pickChoice(index) {
    const ch = this.currentNode?.choices?.[index];
    if (!ch) return;
    this.onAudio("switch");
    if (ch.effects) {
      this.world.applyStoryEffects(ch.effects);
      this.showStatToast(ch.effects);
    }
    if (ch.next) {
      this.showNode(ch.next);
    } else {
      this.finishScene();
    }
    this.onStateChange();
  }

  showStatToast(eff) {
    const parts = [];
    if (eff.trust) parts.push(`搭档羁绊 ${eff.trust > 0 ? "+" : ""}${eff.trust}`);
    if (eff.law) parts.push(`警律 +${eff.law}`);
    if (eff.street) parts.push(`街头 +${eff.street}`);
    if (eff.cash) parts.push(`+$${eff.cash}`);
    if (!parts.length) return;
    this.els.toast.textContent = parts.join(" · ");
    this.els.toast.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.els.toast.hidden = true;
    }, 2400);
  }

  advance() {
    if (!this.isOpen || !this.currentNode || !this.els.endingBox.hidden) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }
    if (this.currentNode.choices?.length) return;
    if (this.currentNode.next) {
      this.showNode(this.currentNode.next);
    } else {
      this.finishScene();
    }
  }

  skipToChoiceOrEnd() {
    if (!this.activeScene) return;
    let guard = 0;
    let id = this.currentNodeId;
    while (id && guard++ < 20) {
      const node = this.activeScene.nodes[id];
      if (!node) break;
      if (node.choices?.length) {
        this.showNode(id);
        this.finishTyping();
        return;
      }
      if (!node.next) {
        this.currentNode = node;
        this.finishScene();
        return;
      }
      id = node.next;
    }
    this.finishScene();
  }

  finishScene() {
    const act = this.currentNode?.endAction;
    if (act) {
      this.world.applyStoryEffects(act);
      if (act.triggerEnding) {
        this.showEnding(act.triggerEnding);
        this.onStateChange();
        return;
      }
    }
    this.close();
    this.onStateChange();
  }

  showEnding(endingId) {
    const end = ENDINGS[endingId] || ENDINGS.ending_law;
    this.els.endingTitle.textContent = end.title;
    this.els.endingSub.textContent = end.subtitle;
    this.els.endingDesc.textContent = end.summary;
    this.els.endingStats.textContent = `最终搭档羁绊 ${this.world.story.trust} · 警律 ${this.world.story.law} · 街头 ${this.world.story.street} · 现金 $${this.world.cash}`;
    this.els.endingBox.hidden = false;
  }

  close() {
    this.root.hidden = true;
    this.activeScene = null;
    this.currentNode = null;
    this.world.paused = false;
    this.onStateChange();
  }

  handleKey(code) {
    if (!this.isOpen) return false;
    if (!this.els.endingBox.hidden) return false;
    if (code === "Space" || code === "Enter") {
      this.advance();
      return true;
    }
    if (this.currentNode?.choices?.length && !this.typing) {
      if (code === "Digit1") { this.pickChoice(0); return true; }
      if (code === "Digit2") { this.pickChoice(1); return true; }
      if (code === "Digit3") { this.pickChoice(2); return true; }
    }
    return false;
  }
}
