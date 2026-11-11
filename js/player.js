// Bob: movement, digging, building, punching, health/armor/sword, inventory.
// `g` is the game: { world, input, toast(), burst(), sfx(), blockedByEntity(), resolvePunch(), stats, god }
'use strict';

class Player {
  constructor(tx, ty) {
    this.w = CFG.P_W; this.h = CFG.P_H;
    this.x = tx * TILE + (TILE - this.w) / 2;
    this.y = (ty + 1) * TILE - this.h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.health = CFG.MAX_HEALTH;
    this.armor = 0;              // hits remaining (0 = no armor)
    this.sword = false;
    this.goldShovel = false;     // powerups: kept until death
    this.juice = false;
    this.shoes = false;
    this.inv = { dirt: 0, stone: 0 };
    this.matIdx = 0;
    this.coyote = 0; this.jumpBuf = 0;
    this.iframes = 0; this.stun = 0;
    this.punch = null;           // { t, dir, hit:Set }
    this.dig = null;             // { x, y, p, dir }
    this.digging = false;
    this.climbing = false;
    this.anim = 0;
    this.dead = false;
    this.sealNagCooldown = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get material() { return MATERIALS[this.matIdx]; }
  get speedMul() { return this.shoes ? CFG.SHOES_SPEED : 1; }
  digTime(tile) { return Math.ceil(DIG_TIME[tile] / (this.goldShovel ? CFG.GOLD_SHOVEL_DIG : 1)); }
  tileX() { return Math.floor(this.cx / TILE); }
  tileY() { return Math.floor((this.y + this.h - 1) / TILE); }

  hurt(amount, fromX, g) {
    if (this.iframes > 0 || this.dead || g.god) return;
    let dmg = amount;
    if (this.armor > 0) {
      dmg = amount / 2;
      this.armor--;
      if (this.armor === 0) { g.toast('YOUR ARMOR BROKE!'); g.sfx('armorBreak'); }
    }
    this.health = Math.max(0, this.health - dmg);
    this.iframes = CFG.IFRAMES;
    this.stun = 12;
    const dir = this.cx < fromX ? -1 : 1;
    this.vx = dir * 2.2; this.vy = -3;
    g.sfx('hurt');
    g.burst(this.cx, this.cy, ['#e83018', '#fcfcfc'], 8, 1.8);
    if (this.health <= 0) { this.dead = true; this.punch = null; this.dig = null; }
  }

  // ---- cells relative to Bob ----
  frontCol() {
    return this.facing > 0 ? Math.floor((this.x + this.w - EPS) / TILE) + 1 : Math.floor(this.x / TILE) - 1;
  }
  bodyRows() {
    return [Math.floor(this.y / TILE), Math.floor((this.y + this.h - EPS) / TILE)];
  }
  digTarget(dir, world) {
    if (dir === 'side') {
      const col = this.frontCol();
      const [r0, r1] = this.bodyRows();
      for (let r = r1; r >= r0; r--) if (world.solid(col, r)) return { x: col, y: r };
      return null;
    }
    const col = Math.floor(this.cx / TILE);
    if (dir === 'down') {
      const row = Math.floor((this.y + this.h + 1) / TILE);
      return world.solid(col, row) ? { x: col, y: row } : null;
    }
    // up: the ceiling cell, if it's within reach of his head
    let row = Math.floor((this.y - 1) / TILE);
    if (!world.solid(col, row)) row--;
    return world.solid(col, row) && this.y - (row + 1) * TILE <= 12 ? { x: col, y: row } : null;
  }
  placeTarget(dir, world) {
    const col = Math.floor(this.cx / TILE);
    if (dir === 'up') return { x: col, y: Math.floor((this.y + EPS) / TILE) - 1 };
    if (dir === 'side') return { x: this.frontCol(), y: Math.floor((this.y + this.h - EPS) / TILE) };
    // down: drop a block onto the first solid ground below; if standing on ground, bridge forward
    const r0 = Math.ceil((this.y + this.h) / TILE - EPS);
    for (let s = r0; s <= r0 + 3; s++) {
      if (world.solid(col, s)) {
        if (s > r0) return { x: col, y: s - 1 };
        return { x: this.frontCol(), y: r0 };
      }
    }
    return { x: col, y: r0 };
  }
  // Is column `col` a 1-wide shaft (open, walled left and right) at Bob's head, feet, or just above his head?
  inShaft(world, col) {
    const shaft = r => !world.solid(col, r) && world.solid(col - 1, r) && world.solid(col + 1, r);
    const head = Math.floor(this.y / TILE);
    return shaft(head) || shaft(Math.floor((this.y + this.h - EPS) / TILE)) || shaft(head - 1);
  }
  // Leaving the top of a shaft: small hop, steered toward a ledge he can stand on
  popOut(world, col) {
    this.vy = -3.4;
    const r = Math.floor((this.y + this.h + 1) / TILE);
    for (const s of [this.facing, -this.facing]) {
      if (world.solid(col + s, r) && !world.solid(col + s, r - 1) && !world.solid(col + s, r - 2)) {
        this.vx = s * 1.6; this.facing = s;
        return;
      }
    }
  }
  // Center Bob over his column so he fits 1-wide shafts
  snapToColumn(world) {
    const col = Math.floor(this.cx / TILE);
    const nx = col * TILE + (TILE - this.w) / 2;
    if (!boxHitsSolid(world, nx, this.y, this.w, this.h)) this.x = nx;
  }

  punchBox() {
    const sword = this.sword;
    const reach = sword ? CFG.SWORD_REACH : CFG.PUNCH_REACH;
    const p = this.punch;
    if (p.dir === 'up') {
      const up = sword ? CFG.SWORD_UPPERCUT_REACH : CFG.UPPERCUT_REACH;
      return rect(this.cx - 8, this.y - up, 16, up);
    }
    if (p.dir === 'down') return rect(this.cx - 8, this.y + this.h, 16, reach - 2);
    return rect(this.facing > 0 ? this.x + this.w : this.x - reach, this.y + 6, reach, 10);
  }

  update(g) {
    const I = g.input, world = g.world;
    if (this.dead) { this.vy = Math.min(this.vy + CFG.G_FALL, CFG.MAX_FALL); this.vx *= 0.9; moveAndCollide(this, world); return; }
    const left = I.down('left'), right = I.down('right'), up = I.down('up'), down = I.down('down');

    if (I.pressed('switch')) {
      this.matIdx = (this.matIdx + 1) % MATERIALS.length;
      g.sfx('select');
    }
    if (I.pressed('jump')) this.jumpBuf = CFG.JUMP_BUFFER;

    // ---- horizontal ----
    let ax = 0;
    if (this.stun <= 0) { if (left) ax -= 1; if (right) ax += 1; }
    if (ax !== 0 && !this.punch) this.facing = ax;
    const vertDig = this.digging && this.dig && this.dig.dir !== 'side' && this.onGround;
    if (vertDig) ax = 0;

    // ---- climbing: hold ↑ in a 1-wide shaft (or under one) ----
    const col = Math.floor(this.cx / TILE);
    const colX = col * TILE + (TILE - this.w) / 2;
    if (!this.climbing && up && this.stun <= 0 && this.inShaft(world, col)
        && Math.abs(this.x - colX) <= 5 && !boxHitsSolid(world, colX, this.y, this.w, this.h)) {
      this.climbing = true;
      this.x = colX; this.vx = 0; this.vy = 0;
    }
    if (this.climbing) {
      // Holding ↑ keeps him on the shaft; without ↑, left/right steps off into an open side passage
      let stepOff = 0;
      if (!up && ax !== 0) {
        const [r0, r1] = this.bodyRows();
        let open = true;
        for (let r = r0; r <= r1; r++) if (world.solid(col + ax, r)) open = false;
        if (open) stepOff = ax;
      }
      if (stepOff) this.climbing = false;
      else { ax = 0; this.vx = 0; }
    }

    const mul = this.speedMul, maxSpeed = CFG.MAX_SPEED * mul;
    if (ax !== 0) {
      const acc = (this.onGround ? CFG.ACCEL_GROUND : CFG.ACCEL_AIR) * mul;
      if (Math.sign(this.vx) === -ax && this.onGround) this.vx += ax * acc * 2; // skid turn
      else this.vx += ax * acc;
      if (Math.abs(this.vx) > maxSpeed) this.vx = Math.sign(this.vx) * Math.max(maxSpeed, Math.abs(this.vx) - 0.2 * mul);
    } else {
      const f = this.onGround ? CFG.FRICTION_GROUND * mul : CFG.FRICTION_AIR;
      if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= Math.sign(this.vx) * f;
    }

    // ---- jump ----
    this.coyote = (this.onGround || this.climbing) ? CFG.COYOTE : this.coyote - 1;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.stun <= 0) {
      this.vy = -(this.juice ? CFG.JUICE_JUMP_V : CFG.JUMP_V);
      this.coyote = 0; this.jumpBuf = 0;
      this.climbing = false;
      g.sfx('jump');
      if (this.juice) g.burst(this.cx, this.y + this.h, ['#90e870', '#fcfcfc', '#3cb030'], 6, 1.2, { up: 0 });
    }
    if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.climbing) {
      this.vy = up ? -CFG.CLIMB_SPEED : down ? CFG.CLIMB_SPEED : 0;
    } else {
      let grav = CFG.G_FALL;
      if (this.vy < 0) grav = I.down('jump') ? CFG.G_HOLD : CFG.G_RELEASE;
      this.vy = Math.min(this.vy + grav, CFG.MAX_FALL);
    }

    moveAndCollide(this, world);

    if (this.climbing) {
      this.anim += Math.abs(this.vy);
      if (this.onGround && down) this.climbing = false;
      else if (!this.inShaft(world, col)) {
        this.climbing = false;
        if (up) this.popOut(world, col);   // reached the top: hop out onto the ledge
      }
    }

    // ---- dig (hold D; up/down arrows aim) ----
    this.digging = false;
    if (I.down('dig') && this.stun <= 0) {
      const dir = up ? 'up' : down ? 'down' : 'side';
      const tgt = this.digTarget(dir, world);
      if (tgt) {
        const tile = world.get(tgt.x, tgt.y);
        if (!DIGGABLE[tile]) {
          this.dig = null;
          if (tile === T.SEAL && this.sealNagCooldown <= 0) {
            g.toast('THE SEAL HOLDS. SAVE BOB 2 AND BOB 3!');
            g.sfx('deny');
            this.sealNagCooldown = 120;
          }
        } else {
          if (!this.dig || this.dig.x !== tgt.x || this.dig.y !== tgt.y) {
            this.dig = { x: tgt.x, y: tgt.y, p: 0, dir };
            if (dir !== 'side') this.snapToColumn(world);
          }
          this.digging = true;
          this.dig.p++;
          if (this.dig.p % 5 === 1) g.sfx(tile === T.STONE ? 'digStone' : 'dig');
          if (this.dig.p >= this.digTime(tile)) {
            world.set(tgt.x, tgt.y, T.AIR);
            this.inv[DIG_YIELD[tile]]++;
            g.stats.dug++;
            g.burst(tgt.x * TILE + 8, tgt.y * TILE + 8, tileColors(tile), 6, 1.5);
            this.dig = null;
          }
        }
      } else this.dig = null;
    } else this.dig = null;

    // ---- place (E; up/down arrows aim) ----
    if (I.pressed('place')) {
      const dir = up ? 'up' : down ? 'down' : 'side';
      const c = this.placeTarget(dir, world);
      const mat = this.material;
      const cellRect = rect(c.x * TILE, c.y * TILE, TILE, TILE);
      if (this.inv[mat.key] <= 0) {
        g.toast(`NO ${mat.name} LEFT. DIG SOME!`); g.sfx('deny');
      } else if (world.get(c.x, c.y) !== T.AIR || overlaps(cellRect, this) || g.blockedByEntity(cellRect)) {
        g.sfx('deny');
      } else if (world.set(c.x, c.y, mat.tile)) {
        this.inv[mat.key]--;
        g.stats.placed++;
        g.sfx('place');
        g.burst(c.x * TILE + 8, c.y * TILE + 8, tileColors(mat.tile), 4, 1);
      }
    }

    // ---- punch (F; up = uppercut, down in air = down-punch) ----
    if (I.pressed('punch') && !this.punch && this.stun <= 0) {
      const dir = up ? 'up' : (down && !this.onGround) ? 'down' : 'side';
      this.punch = { t: 0, dir, hit: new Set(), bounced: false };
      g.sfx(this.sword ? 'swing' : 'punch');
    }
    if (this.punch) {
      this.punch.t++;
      if (this.punch.t >= 3 && this.punch.t <= 9) {
        const dmg = this.sword ? CFG.SWORD_DMG : CFG.PUNCH_DMG;
        const landed = g.resolvePunch(this, this.punchBox(), dmg);
        if (landed && this.punch.dir === 'down' && !this.punch.bounced) { this.vy = -3.5; this.punch.bounced = true; }
      }
      if (this.punch.t >= (this.sword ? 18 : 14)) this.punch = null;
    }

    if (this.iframes > 0) this.iframes--;
    if (this.stun > 0) this.stun--;
    if (this.sealNagCooldown > 0) this.sealNagCooldown--;
    this.anim += Math.abs(this.vx) > 0.2 && this.onGround ? Math.abs(this.vx) : 0;
  }
}

// Debris colors per tile type (used by particles)
function tileColors(t) {
  switch (t) {
    case T.GRASS: return ['#3cb030', '#9c5c24', '#6c3810'];
    case T.MARKER: return ['#e8b828', '#9c5c24'];
    case T.STONE: return ['#808080', '#a8a8a8', '#505050'];
    default: return ['#9c5c24', '#6c3810', '#c07838'];
  }
}
