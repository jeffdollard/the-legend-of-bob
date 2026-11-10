// Live tile state: 32x32 chunks generated lazily from the layout, edited in place.
// Restarting a level = new World(sameLayout).
'use strict';

const CHUNK = 32;

class World {
  constructor(layout) {
    this.L = layout;
    this.W = layout.W;
    this.chunks = new Map();
    this.sealed = true;
    this.revealAll = false;
    // reveal BFS scratch (grown in reveal() when the view gets bigger)
    this._seen = new Int32Array(0);
    this._stamp = 0;
    this._queue = new Int32Array(0);
  }

  _chunk(cx, cy) {
    const key = cy * 64 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      c = { t: new Uint8Array(CHUNK * CHUNK), rev: new Uint8Array(CHUNK * CHUNK) };
      const L = this.L;
      for (let ly = 0; ly < CHUNK; ly++) {
        const y = cy * CHUNK + ly;
        for (let lx = 0; lx < CHUNK; lx++) c.t[ly * CHUNK + lx] = layoutTile(L, cx * CHUNK + lx, y);
      }
      this.chunks.set(key, c);
    }
    return c;
  }

  get(x, y) {
    if (x < 0 || x >= this.W) return T.WALL;
    if (y < CFG.SKY_LIMIT) return T.AIR;
    return this._chunk(x >> 5, y >> 5).t[((y & 31) << 5) | (x & 31)];
  }

  set(x, y, t) {
    if (x <= 0 || x >= this.W - 1 || y < CFG.SKY_LIMIT) return false;
    this._chunk(x >> 5, y >> 5).t[((y & 31) << 5) | (x & 31)] = t;
    return true;
  }

  solid(x, y) { return SOLID[this.get(x, y)]; }

  underground(x, y) { return x >= 0 && x < this.W && y > this.L.heights[x]; }

  revealed(x, y) {
    if (this.revealAll) return true;
    if (x < 0 || x >= this.W || y < CFG.SKY_LIMIT) return true;
    return this._chunk(x >> 5, y >> 5).rev[((y & 31) << 5) | (x & 31)] === 1;
  }

  // Can the player see a thing standing in this cell?
  visible(x, y) { return !this.underground(x, y) || this.revealed(x, y); }

  // What an unrevealed underground air cell is drawn as (keeps tunnels hidden)
  disguise(x, y) { return baseMaterial(this.L, x, y); }

  // Flood-fill through open cells around (tx,ty), marking them revealed.
  // The box covers the whole view (which grows with the window) so tunnels never pop in on screen.
  reveal(tx, ty) {
    const RX = Math.max(CFG.REVEAL_RADIUS, Math.ceil(VIEW_W / 2 / TILE) + CFG.REVEAL_MARGIN);
    const RY = Math.max(CFG.REVEAL_RADIUS, Math.ceil(VIEW_H * 0.55 / TILE) + CFG.REVEAL_MARGIN);
    const DX = 2 * RX + 1, DY = 2 * RY + 1;
    if (this.solid(tx, ty)) return;
    if (this._seen.length < DX * DY) {
      this._seen = new Int32Array(DX * DY);
      this._queue = new Int32Array(DX * DY * 2);
    }
    const seen = this._seen, q = this._queue;
    const stamp = ++this._stamp;
    let head = 0, tail = 0;
    const visit = (x, y) => {
      const lx = x - tx + RX, ly = y - ty + RY;
      if (lx < 0 || ly < 0 || lx >= DX || ly >= DY) return;
      const i = ly * DX + lx;
      if (seen[i] === stamp) return;
      seen[i] = stamp;
      if (this.solid(x, y)) return;
      q[tail++] = x; q[tail++] = y;
    };
    visit(tx, ty);
    while (head < tail) {
      const x = q[head++], y = q[head++];
      if (y >= CFG.SKY_LIMIT && x >= 0 && x < this.W) {
        this._chunk(x >> 5, y >> 5).rev[((y & 31) << 5) | (x & 31)] = 1;
      }
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
  }

  unseal() {
    if (!this.sealed) return;
    this.sealed = false;
    for (const [x, y] of this.L.seal.doors) this.set(x, y, T.AIR);
    for (const [x, y] of this.L.seal.ring) this.set(x, y, T.STONE);
  }
}
