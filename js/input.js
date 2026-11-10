// Keyboard state. "pressed" edges are latched until the next fixed update step consumes them,
// so taps are never lost between render frames.
'use strict';

const Input = {
  held: {},
  _queued: {},
  _now: {},
  onAnyKey: null,

  attach(target) {
    target.addEventListener('keydown', e => {
      const name = KEYMAP[e.code];
      if (this.onAnyKey) this.onAnyKey();
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
    target.addEventListener('blur', () => { this.held = {}; });
  },

  beginStep() { this._now = this._queued; this._queued = {}; },
  down(name) { return !!this.held[name]; },
  pressed(name) { return !!this._now[name]; },

  // test/debug helpers
  hold(name, on) { this.held[name] = on; if (on) this._queued[name] = true; },
  tap(name) { this._queued[name] = true; },
  clear() { this.held = {}; this._queued = {}; this._now = {}; },
};
