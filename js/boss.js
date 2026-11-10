// The Bob Boss: walks, jumps, throws "BOB" grenades. Only hits on his center weak spot hurt him.
'use strict';

class Boss {
  constructor(layout) {
    const c = layout.cave;
    this.cave = c;
    this.w = CFG.BOSS_W; this.h = CFG.BOSS_H;
    this.x = c.cx * TILE + (TILE - this.w) / 2;
    this.y = c.floorY * TILE - this.h;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = CFG.BOSS_HP;
    this.awake = false;
    this.state = 'think'; this.t = 60;
    this.iframes = 0;
    this.dying = 0;          // counts up once hp hits 0
    this.dead = false;
    this.onGround = false;
    this.anim = 0;
    this.windup = 0;
    this.emptyHand = { '-1': 0, '1': 0 };
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  // The weak spot is the glowing core in the arch between his legs (per the sketch)
  weakSpot() {
    const s = CFG.WEAK_SPOT;
    return rect(this.cx - s / 2, this.y + this.h - 15, s, s);
  }
  insideCave(p) {
    const c = this.cave;
    return p.cx > c.x0 * TILE && p.cx < (c.x1 + 1) * TILE && p.y + p.h > c.y0 * TILE && p.y < c.floorY * TILE;
  }

  update(g) {
    const p = g.player;
    if (this.dead) return;
    if (!this.awake) {
      if (!g.world.sealed && this.insideCave(p)) {
        this.awake = true;
        g.toast('THE BOB BOSS AWAKENS!');
        g.sfx('bossWake');
        g.shake = 10;
        this.state = 'think'; this.t = 50;
      }
      return;
    }
    if (this.dying > 0) {
      this.dying++;
      if (this.dying % 8 === 0) {
        g.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h, ['#f8c020', '#e83018', '#fcfcfc'], 10, 2.4);
        g.sfx('explode'); g.shake = 6;
      }
      if (this.dying > 130) { this.dead = true; g.onBossDefeated(); }
      return;
    }

    const angry = this.hp <= CFG.BOSS_HP / 2;
    const dx = p.cx - this.cx;
    this.t--;
    switch (this.state) {
      case 'think':
        this.vx *= 0.8;
        if (this.t <= 0 && this.onGround) {
          this.facing = Math.sign(dx) || this.facing;
          const r = Math.random();
          if (Math.abs(dx) < 7 * TILE && r < 0.5) {
            this.state = 'jump';
            this.vy = -6.6;
            this.vx = Math.max(-2.6, Math.min(2.6, dx / 44));
          } else if (r < 0.8) {
            this.state = 'windup'; this.t = angry ? 16 : 26;
          } else {
            this.state = 'walk'; this.t = 40 + Math.floor(Math.random() * 40);
          }
        }
        break;
      case 'walk':
        this.facing = Math.sign(dx) || this.facing;
        this.vx = this.facing * (angry ? 1.3 : 0.9);
        if (this.t <= 0) this.toThink(angry);
        break;
      case 'jump':
        if (this.onGround && this.vy === 0 && this.t < -3) {
          g.sfx('land'); g.shake = 5;
          g.burst(this.cx, this.y + this.h, ['#808080', '#a8a8a8'], 10, 1.5);
          this.vx = 0;
          this.toThink(angry);
        }
        break;
      case 'windup':
        this.vx = 0;
        this.facing = Math.sign(dx) || this.facing;
        if (this.t <= 0) {
          this.throwAt(p, g);
          if (angry && Math.random() < 0.5) { this.state = 'windup'; this.t = 14; }
          else this.toThink(angry);
        }
        break;
    }

    this.vy = Math.min(this.vy + 0.3, 6);
    moveAndCollide(this, g.world);
    // stay inside the cave
    const minX = this.cave.x0 * TILE, maxX = (this.cave.x1 + 1) * TILE - this.w;
    if (this.x < minX) { this.x = minX; this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; this.vx = 0; }
    if (this.iframes > 0) this.iframes--;
    for (const k in this.emptyHand) if (this.emptyHand[k] > 0) this.emptyHand[k]--;
    this.anim += Math.abs(this.vx);
  }

  toThink(angry) {
    this.state = 'think';
    this.t = (angry ? 18 : 35) + Math.floor(Math.random() * 25);
  }

  throwAt(p, g) {
    const T_FLIGHT = 46, GRAV = 0.2;
    // thrown from the hand on the side he's facing (hands are held up beside his head)
    const side = this.facing > 0 ? 1 : -1;
    const sx = this.cx + side * 25, sy = this.y + 6;
    this.emptyHand[side] = 40;
    const dx = p.cx - sx, dy = p.cy - sy;
    const vx = Math.max(-3.2, Math.min(3.2, dx / T_FLIGHT));
    const vy = (dy - 0.5 * GRAV * T_FLIGHT * T_FLIGHT) / T_FLIGHT;
    g.grenades.push(new Grenade(sx, sy, vx, Math.max(-6, vy), GRAV));
    g.sfx('throw');
  }

  // Returns 'weak' | 'body' | null
  takePunch(box, dmg, g) {
    if (!this.awake || this.dying || this.dead) return null;
    if (overlaps(box, this.weakSpot())) {
      if (this.iframes > 0) return 'weak';
      this.hp = Math.max(0, this.hp - dmg);
      this.iframes = 40;
      g.sfx('bossHit'); g.shake = 6;
      const ws = this.weakSpot();
      g.burst(ws.x + ws.w / 2, ws.y + ws.h / 2, ['#f8c020', '#fcfcfc', '#e83018'], 14, 2);
      if (this.hp <= 0) { this.dying = 1; g.toast('THE BOB BOSS IS CRUMBLING!'); }
      return 'weak';
    }
    if (overlaps(box, this)) return 'body';
    return null;
  }

  draw(ctx, cam, frame) {
    if (this.dead) return;
    const B = SPR.boss;
    let img = B.stand;
    if (!this.onGround) img = B.jump;
    else if (this.state === 'windup') img = this.facing > 0 ? B.raiseR : B.raiseL;
    else if (Math.abs(this.vx) > 0.2) img = (Math.floor(this.anim / 10) % 2) ? B.walk1 : B.walk2;
    const x = Math.round(this.x - BOSS_OX - cam.x), y = Math.round(this.y - cam.y);
    const show = this.iframes % 6 < 3 || this.dying;
    if (show) {
      ctx.drawImage(img, x, y);
      // the BOB grenades he holds up in each hand
      const gw = SPR.grenade.width, gh = SPR.grenade.height;
      for (const side of [-1, 1]) {
        if (this.emptyHand[side] > 0) continue;
        const raised = this.state === 'windup' && side === (this.facing > 0 ? 1 : -1);
        const hx = side < 0 ? x + 4 : x + 53;
        const hy = y + (raised ? 6 : 12) - gh + 1;
        ctx.drawImage(SPR.grenade, hx - (gw >> 1), hy);
      }
    }
    if (!this.awake) {
      drawTextC(ctx, 'Z', x + BOSS_OX + 26 + Math.sin(frame / 20) * 3, y - 6 - (frame / 2) % 12, '#fcfcfc');
      return;
    }
    // weak spot: glowing core in the arch between his legs
    const ws = this.weakSpot();
    const wx = Math.round(ws.x - cam.x), wy = Math.round(ws.y - cam.y), s = ws.w;
    const pulse = Math.floor(frame / 8) % 2;
    ctx.fillStyle = '#000'; ctx.fillRect(wx, wy, s, s);
    ctx.fillStyle = this.iframes > 0 ? '#fcfcfc' : (pulse ? '#f8c020' : '#fce890');
    ctx.fillRect(wx + 1, wy + 1, s - 2, s - 2);
    ctx.fillStyle = '#e83018'; ctx.fillRect(wx + s / 2 - 1, wy + s / 2 - 1, 2, 2);
    // HP bar
    const bw = 40, bx = Math.round(this.cx - cam.x - bw / 2), by = y - 10;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = '#e83018'; ctx.fillRect(bx, by, Math.round(bw * this.hp / CFG.BOSS_HP), 3);
  }
}

class Grenade {
  constructor(x, y, vx, vy, grav) {
    this.w = 19; this.h = 9;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = vx; this.vy = vy; this.grav = grav;
    this.t = 0;
    this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(g) {
    this.t++;
    this.vy += this.grav;
    this.x += this.vx; this.y += this.vy;
    const tx = Math.floor(this.cx / TILE), ty = Math.floor((this.cy + 3) / TILE);
    if (g.world.solid(tx, ty) || overlaps(this, g.player) || this.t > 300) this.explode(g);
  }
  explode(g) {
    this.dead = true;
    g.sfx('explode'); g.shake = 8;
    g.burst(this.cx, this.cy, ['#e83018', '#f8c020', '#fcfcfc', '#3c3c3c'], 22, 2.6);
    const p = g.player;
    if (Math.hypot(p.cx - this.cx, p.cy - this.cy) < 24) p.hurt(CFG.DMG_GRENADE, this.cx, g);
  }
  draw(ctx, cam) {
    const wob = Math.round(Math.sin(this.t / 3));
    ctx.drawImage(SPR.grenade, Math.round(this.x - cam.x), Math.round(this.y - cam.y) + wob);
  }
}
