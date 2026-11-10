// Keyboard + touch state. "pressed" edges are latched until the next fixed update step consumes them,
// so taps are never lost between render frames.
'use strict';

const Input = {
  held: {},
  touch: {},          // held state from the touch controls (Touch.sync), ORed with the keyboard
  _queued: {},
  _now: {},
  onAnyKey: null,

  attach(target) {
    target.addEventListener('keydown', e => {
      const name = KEYMAP[e.code];
      if (this.onAnyKey) this.onAnyKey(name);
      if (!name) return;
      e.preventDefault();
      if (!e.repeat) this._queued[name] = true;
      this.held[name] = true;
    });
    target.addEventListener('keyup', e => {
      const name = KEYMAP[e.code];
      if (!name) return;
      e.preventDefault();
      this.held[name] = false;
    });
    target.addEventListener('blur', () => { this.held = {}; this.touch = {}; });
  },

  beginStep() { this._now = this._queued; this._queued = {}; },
  down(name) { return !!(this.held[name] || this.touch[name]); },
  pressed(name) { return !!this._now[name]; },
  // Touch reports its whole held set; a control that goes from up to down queues one press
  setTouch(next) {
    for (const k in next) if (next[k] && !this.down(k)) this._queued[k] = true;
    this.touch = next;
  },

  // test/debug helpers
  hold(name, on) { this.held[name] = on; if (on) this._queued[name] = true; },
  tap(name) { this._queued[name] = true; },
  clear() { this.held = {}; this.touch = {}; this._queued = {}; this._now = {}; },
};
