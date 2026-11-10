// Touch controls for phones and tablets: a d-pad on the left, a diamond of action buttons on the
// right (JUMP bottom, PUNCH left, PLACE right, DIG top, small SWAP top-right), and a pause button
// under the mute speaker. Shown only on mobile devices (phones, tablets) or with ?touch=1. On mobile,
// a key press hides them (iPad + keyboard) and the next touch brings them back. Touch laptops and
// desktops never show them. Every pointer is tracked by id, so combos like
// d-pad up + DIG work, and a thumb can roll from one button to the next.
// In menus (title, pause, dead, win) any tap is a "start" press, fired on release.
// Layout and hit-testing are pure math in game px (tools/test-touch.js); drawing needs SPR.
'use strict';

const Touch = {
  enabled: false, forced: false, mobile: false,
  game: null,
  L: null,                 // layout in game px (layout())
  ptrs: new Map(),         // pointerId -> { own: 'dpad' | 'buttons' | 'tap', tap, x, y }
  held: {},                // control name -> true, as last sent to Input
  _discs: {},

  init(game, forced) {
    this.game = game;
    this.forced = !!forced;
    // Mobile = touch is the primary input and nothing can hover. Touch laptops (and iPads with a
    // trackpad) report a fine pointer that hovers, so they keep the keyboard UI.
    this.mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (hover: none)').matches;
    this.enabled = this.forced || this.mobile;
  },
  // A touch on a mobile device brings the overlay back after a key press hid it
  enable() { if (this.mobile) this.enabled = true; },
  // A real key was pressed: assume a keyboard (iPad with keyboard, touch laptop) and hide the overlay
  keyboardUsed() {
    if (this.forced || !this.enabled) return;
    this.enabled = false;
    this.reset();
  },

  // ---------- layout (game px) ----------
  layout(vw, vh, scale) {
    const C = TOUCH, u0 = 1 / scale;                       // game px per CSS px
    const ext = C.BTN_R * (C.BTN_SPREAD + 1);               // diamond half-size
    const needW = (2 * C.DPAD_R + 2 * ext + 3 * C.MARGIN) * u0;
    const needH = (2 * Math.max(C.DPAD_R, ext) + C.MARGIN_BOTTOM) * u0;
    const u = u0 * Math.min(1, vw / needW, (vh - C.TOP_CLEAR) / needH);   // shrink on very small screens
    const R = C.DPAD_R * u, b = C.BTN_R * u, d = b * C.BTN_SPREAD, s = C.SMALL_R * u;
    const m = C.MARGIN * u, mb = C.MARGIN_BOTTOM * u;
    const cx = vw - m - d - b, cy = vh - mb - d - b;
    const corner = Math.max(18, C.CORNER * u0);
    this.L = {
      dpad: { x: m + R, y: vh - mb - R, r: R },
      buttons: [
        { name: 'jump', x: cx, y: cy + d, r: b },
        { name: 'punch', x: cx - d, y: cy, r: b },
        { name: 'place', x: cx + d, y: cy, r: b },
        { name: 'dig', x: cx, y: cy - d, r: b },
        { name: 'switch', x: cx + 1.2 * d, y: cy - 1.25 * d, r: s },   // tucked in the cluster's top-right corner
      ],
      mute: { x: vw - corner, y: 0, w: corner, h: 15 },
      pause: { x: vw - corner, y: 15, w: corner, h: Math.max(16, C.CORNER * u0) },
      vw, vh,
    };
  },

  // ---------- hit testing ----------
  // Which control a new touch at (gx, gy) belongs to: the nearest control surface within its hit radius.
  // Returns 'dpad', a button object, or null.
  hitControl(gx, gy) {
    const L = this.L;
    let best = null, bestEdge = Infinity;
    const dd = Math.hypot(gx - L.dpad.x, gy - L.dpad.y);
    if (dd <= L.dpad.r * TOUCH.DPAD_HIT) { best = 'dpad'; bestEdge = dd - L.dpad.r; }
    const b = this.hitButton(gx, gy);
    if (b && Math.hypot(gx - b.x, gy - b.y) - b.r < bestEdge) best = b;
    return best;
  },
  hitButton(gx, gy) {
    let best = null, bestEdge = Infinity;
    for (const b of this.L.buttons) {
      const dist = Math.hypot(gx - b.x, gy - b.y);
      if (dist <= b.r * TOUCH.BTN_HIT && dist - b.r < bestEdge) { best = b; bestEdge = dist - b.r; }
    }
    return best;
  },
  hitCorner(gx, gy) {
    const inside = (r) => gx >= r.x && gy >= r.y && gy < r.y + r.h;
    return inside(this.L.mute) ? 'mute' : inside(this.L.pause) ? 'pause' : null;
  },
  // D-pad direction(s) for an offset from its center. Cardinals get wide wedges, diagonals a narrow one,
  // so walking doesn't leak an "up" (which would start a climb or turn a dig upward).
  dpadDirs(dx, dy, r) {
    const out = {};
    if (Math.hypot(dx, dy) < r * TOUCH.DPAD_DEAD) return out;
    const a = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;   // 0 = sideways, 90 = straight up/down
    if (a < TOUCH.DPAD_H_MAX) out[dx < 0 ? 'left' : 'right'] = true;
    if (a > TOUCH.DPAD_V_MIN) out[dy < 0 ? 'up' : 'down'] = true;
    return out;
  },

  // ---------- pointers ----------
  down(id, gx, gy) {
    if (!this.L) return;
    const corner = this.hitCorner(gx, gy);
    let p;
    if (corner === 'mute' || (corner === 'pause' && this.game.state === 'play')) p = { own: 'tap', tap: corner };
    else if (this.game.state !== 'play') p = { own: 'tap', tap: 'start' };   // menus: a tap anywhere continues
    else p = { own: this.hitControl(gx, gy) === 'dpad' ? 'dpad' : 'buttons' };
    p.x = gx; p.y = gy;
    this.ptrs.set(id, p);
    this.sync();
  },
  move(id, gx, gy) {
    const p = this.ptrs.get(id);
    if (!p) return;
    p.x = gx; p.y = gy;
    if (p.own !== 'tap') this.sync();
  },
  up(id, cancelled) {
    const p = this.ptrs.get(id);
    if (!p) return;
    this.ptrs.delete(id);
    if (p.own === 'tap' && !cancelled) {
      if (p.tap === 'mute') this.game.toggleMute();
      else if (p.tap === 'pause') Input.tap('pause');
      else {
        if (this.game.state === 'title') this.fullscreen();
        Input.tap('start');
      }
    }
    this.sync();
  },
  reset() { this.ptrs.clear(); this.sync(); },

  // Recompute the held set from every live pointer and hand it to Input
  sync() {
    const held = {};
    if (this.L) for (const p of this.ptrs.values()) {
      if (p.own === 'dpad') Object.assign(held, this.dpadDirs(p.x - this.L.dpad.x, p.y - this.L.dpad.y, this.L.dpad.r));
      else if (p.own === 'buttons') { const b = this.hitButton(p.x, p.y); if (b) held[b.name] = true; }
    }
    this.held = held;
    Input.setTouch(held);
  },

  // Android Chrome: hide the URL bar. Needs a user gesture, so it's called from the start tap.
  // iPhone Safari has no element fullscreen; Add to Home Screen gives the same effect there.
  fullscreen() {
    try {
      const el = typeof document !== 'undefined' && document.documentElement;
      if (TOUCH.FULLSCREEN && el && el.requestFullscreen && !document.fullscreenElement && /Android/i.test(navigator.userAgent))
        el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } catch (e) { /* not supported */ }
  },

  // ---------- drawing ----------
  // Crisp pixel disc with an edge (2px on bigger discs), cached per size and color
  disc(r, fill, edge) {
    const R = Math.round(r), key = `${R}${fill}${edge}`;
    if (this._discs[key]) return this._discs[key];
    const n = 2 * R + 1, c = makeCanvas(n, n), x = c.getContext('2d'), ew = R >= 14 ? 2.2 : 1.2;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      const dist = Math.hypot(xx - R, yy - R);
      if (dist <= R + 0.3) { x.fillStyle = dist > R - ew ? edge : fill; x.fillRect(xx, yy, 1, 1); }
    }
    return (this._discs[key] = c);
  },

  // Icon for a control, also used by the controls legend
  icon(name, g) {
    const p = g.player;
    switch (name) {
      case 'jump': return SPR.iconJump;
      case 'dig': return SPR.iconDig;
      case 'punch': return p && p.sword ? SPR.swordIcon : SPR.fist;
      case 'place': return SPR.tile[p ? p.material.tile : T.DIRT];
      case 'switch': return SPR.iconSwap;
    }
  },

  draw(ctx, g) {
    if (!this.enabled || !this.L) return;
    const L = this.L, h = this.held;
    ctx.save();

    // d-pad: a cross on a dark disc; held arms light up
    const cx = Math.round(L.dpad.x), cy = Math.round(L.dpad.y), r = L.dpad.r;
    const disc = this.disc(r, '#000', '#3c3c3c');
    ctx.globalAlpha = TOUCH.ALPHA * 0.5;
    ctx.drawImage(disc, cx - (disc.width >> 1), cy - (disc.width >> 1));
    ctx.globalAlpha = TOUCH.ALPHA;
    const aw = Math.max(4, Math.round(r * 0.3)), al = Math.round(r * 0.82);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - aw - 1, cy - al - 1, 2 * aw + 2, 2 * al + 2);
    ctx.fillRect(cx - al - 1, cy - aw - 1, 2 * al + 2, 2 * aw + 2);
    ctx.fillStyle = '#5c5c5c';
    ctx.fillRect(cx - aw, cy - al, 2 * aw, 2 * al);
    ctx.fillRect(cx - al, cy - aw, 2 * al, 2 * aw);
    ctx.globalAlpha = Math.min(1, TOUCH.ALPHA + 0.35);
    ctx.fillStyle = '#e0e0e0';
    if (h.up) ctx.fillRect(cx - aw, cy - al, 2 * aw, al - aw);
    if (h.down) ctx.fillRect(cx - aw, cy + aw, 2 * aw, al - aw);
    if (h.left) ctx.fillRect(cx - al, cy - aw, al - aw, 2 * aw);
    if (h.right) ctx.fillRect(cx + aw, cy - aw, al - aw, 2 * aw);
    const t = Math.max(2, Math.round(aw * 0.6)), pad = Math.max(2, Math.round(aw * 0.4));
    const arrow = (dir, x, y) => {
      ctx.fillStyle = h[dir] ? '#3c3c3c' : '#bcbcbc';
      for (let i = 0; i < t; i++) {
        if (dir === 'up') ctx.fillRect(x - i, y + i, 2 * i + 1, 1);
        else if (dir === 'down') ctx.fillRect(x - i, y - i, 2 * i + 1, 1);
        else if (dir === 'left') ctx.fillRect(x + i, y - i, 1, 2 * i + 1);
        else ctx.fillRect(x - i, y - i, 1, 2 * i + 1);
      }
    };
    arrow('up', cx, cy - al + pad); arrow('down', cx, cy + al - 1 - pad);
    arrow('left', cx - al + pad, cy); arrow('right', cx + al - 1 - pad, cy);

    // action buttons
    for (const b of L.buttons) {
      const on = !!h[b.name];
      const img = this.disc(b.r, on ? '#5c5c5c' : '#000', on ? '#fcfcfc' : '#bcbcbc');
      const bx = Math.round(b.x), by = Math.round(b.y);
      ctx.globalAlpha = on ? Math.min(1, TOUCH.ALPHA + 0.3) : TOUCH.ALPHA;
      ctx.drawImage(img, bx - (img.width >> 1), by - (img.width >> 1));
      const icon = this.icon(b.name, g);
      if (!icon) continue;
      ctx.globalAlpha = 1;   // icons stay solid so they read over any terrain
      let w = icon.width, ih = icon.height;
      if (b.name === 'place') w = ih = b.r * 1.4 >= 16 ? 16 : 8;   // tiles shrink by half on small buttons
      else { const k = Math.max(1, Math.min(2, Math.floor(b.r * 1.4 / Math.max(w, ih)))); w *= k; ih *= k; }
      const ix = bx - (w >> 1), iy = by - (ih >> 1);
      if (b.name === 'place') { ctx.fillStyle = '#000'; ctx.fillRect(ix - 1, iy - 1, w + 2, ih + 2); }
      ctx.drawImage(icon, ix, iy, w, ih);
    }

    // pause, under the mute speaker
    ctx.globalAlpha = 0.85;
    const px = L.vw - 15;
    ctx.fillStyle = '#000'; ctx.fillRect(px, 15, 13, 12);
    ctx.fillStyle = '#7c7c7c'; ctx.fillRect(px, 15, 13, 1); ctx.fillRect(px, 26, 13, 1); ctx.fillRect(px, 15, 1, 12); ctx.fillRect(px + 12, 15, 1, 12);
    ctx.drawImage(SPR.iconPause, px + 4, 17);
    ctx.restore();
  },
};
