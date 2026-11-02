import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../input.js';

test('keyboard and standard gamepad map all actions, movement, rescue hold, and disconnect', t => {
  const oldWindow = globalThis.window, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const handlers = {}, actions = []; let pads = [], disconnected = false;
  globalThis.window = { addEventListener: (type, fn) => handlers[type] = fn };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } });
  t.after(() => { globalThis.window = oldWindow; if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator; });
  const input = new Input(a => actions.push(a), () => disconnected = true);
  const event = code => ({ code, repeat: false, target: { matches: () => false }, preventDefault() {} });
  for (const code of ['Digit1', 'Digit2', 'Digit3', 'KeyJ', 'KeyK', 'Space', 'KeyL', 'KeyE', 'KeyQ', 'KeyU', 'KeyI', 'Escape']) handlers.keydown(event(code));
  assert.deepEqual(actions, ['skill1', 'skill2', 'skill3', 'light', 'heavy', 'jump', 'dodge', 'interact', 'switch', 'ultimate', 'coop', 'pause']);
  handlers.keydown(event('KeyD')); assert.equal(input.movement().x, 1); assert.equal(input.movement().held, true); handlers.blur(); assert.equal(input.movement().x, 0);
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [.8, -.6], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }; pads = [pad];
  const map = { 2: 'light', 3: 'heavy', 0: 'jump', 1: 'dodge', 4: 'interact', 5: 'switch', 7: 'coop', 9: 'pause' };
  actions.length = 0;
  for (const [button, name] of Object.entries(map)) { pad.buttons[button].pressed = true; input.poll(); assert.equal(actions.at(-1), name); const count = actions.length; input.poll(); assert.equal(actions.length, count); pad.buttons[button].pressed = false; input.poll(); }
  const count = actions.length; pad.buttons[6].pressed = true; input.poll(); assert.equal(actions.length, count, 'LT alone must not fire an ultimate');
  for (const [button, action] of Object.entries({ 2: 'skill1', 3: 'skill2', 1: 'skill3', 0: 'ultimate' })) {
    const before = actions.length; pad.buttons[button].pressed = true; input.poll(); assert.deepEqual(actions.slice(before), [action], 'modified attack never leaks its base action');
    input.poll(); assert.equal(actions.length, before + 1, 'holding a combo never repeats'); pad.buttons[button].pressed = false; input.poll();
  }
  pad.buttons[6].pressed = false; input.poll();
  const beforeFocus = actions.length; handlers.keydown({ ...event('Digit1'), target: { matches: () => true } }); assert.equal(actions.length, beforeFocus);
  pad.buttons[4].pressed = true; input.poll(); assert.deepEqual(input.movement(), { x: .8, y: -.6, held: true });
  handlers.gamepaddisconnected(); assert.equal(disconnected, true); assert.equal(input.padIndex, null);
});
