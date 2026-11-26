import { WIDTH, HEIGHT } from "./data.js";

const ACTION_KEYS = {
  KeyF: "vehicle",
  KeyE: "interact",
  KeyQ: "switch",
  KeyH: "horn",
  KeyJ: "cast",
  KeyK: "melee",
  Space: "space",
  Enter: "enter",
  Tab: "fxwheel",
  KeyM: "scenes",
  KeyV: "storylog",
  Escape: "escape",
  Digit1: "slot0",
  Digit2: "slot1",
  Digit3: "slot2",
  Digit4: "slot3",
  Digit5: "slot4",
  Digit6: "slot5",
  Digit7: "slot6",
  Digit8: "slot7",
};

export class Input {
  constructor(canvas, onAction) {
    this.canvas = canvas;
    this.onAction = onAction;
    this.keys = new Set();
    this.mouse = { x: WIDTH * 0.65, y: HEIGHT * 0.6, down: false };

    window.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) {
        if (e.code === "Escape") this.onAction("escape", e.code);
        return;
      }
      if (ACTION_KEYS[e.code] || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (!e.repeat && ACTION_KEYS[e.code]) {
        this.onAction(ACTION_KEYS[e.code], e.code);
      }
    });

    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener("mousemove", (e) => this.updateMouse(e));
    canvas.addEventListener("mousedown", (e) => {
      this.updateMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.onAction("cast");
      } else if (e.button === 2) {
        this.onAction("melee");
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.onAction(e.deltaY > 0 ? "nextSlot" : "prevSlot");
      },
      { passive: false }
    );
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.mouse.x = Math.max(0, Math.min(WIDTH, ((e.clientX - rect.left) / rect.width) * WIDTH));
    this.mouse.y = Math.max(0, Math.min(HEIGHT, ((e.clientY - rect.top) / rect.height) * HEIGHT));
  }

  movement() {
    const k = this.keys;
    return {
      x: Number(k.has("KeyD") || k.has("ArrowRight")) - Number(k.has("KeyA") || k.has("ArrowLeft")),
      y: Number(k.has("KeyS") || k.has("ArrowDown")) - Number(k.has("KeyW") || k.has("ArrowUp")),
    };
  }

  handbrake() {
    return this.keys.has("Space");
  }

  sprint() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }
}
