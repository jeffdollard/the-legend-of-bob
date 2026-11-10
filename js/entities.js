// Chests, rescuable Bobs, particles.
'use strict';

class Chest {
  constructor(tx, ty, item) {
    this.w = 14; this.h = 12;
    this.x = tx * TILE + 1; this.y = (ty + 1) * TILE - this.h;
    this.tx = tx; this.ty = ty;
    this.item = item;
    this.open = false;
    this.popT = 0;
  }
  update(g) {
    if (this.open) { if (this.popT < 60) this.popT++; return; }
    if (overlaps(this, g.player) && !g.player.dead) this.openChest(g);
  }
  openChest(g) {
    const p = g.player;
    this.open = true;
    g.sfx('chest');
    g.burst(this.x + 7, this.y, ['#f8c020', '#fce890', '#fcfcfc'], 10, 1.6);
    if (this.item === 'sword') {
      p.sword = true;
      g.toast('YOU FOUND A SWORD! 2X DAMAGE, LONGER REACH');
    } else if (this.item === 'armor') {
      p.armor = CFG.ARMOR_HITS;
      g.toast(`ARMOR! HALF DAMAGE FOR ${CFG.ARMOR_HITS} HITS`);
    } else {
      p.health = Math.min(CFG.MAX_HEALTH, p.health + CFG.HEAL);
      g.toast('+1 HEART');
      g.sfx('heal');
    }
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - 1 - cam.x), y = Math.round(this.y - cam.y);
    ctx.drawImage(this.open ? SPR.chestOpen : SPR.chest, x, y);
    if (this.open && this.popT < 60) {
      const icon = this.item === 'sword' ? SPR.swordIcon : this.item === 'armor' ? SPR.shield : SPR.potion;
      const rise = Math.min(this.popT, 20);
      if (this.popT < 50 || this.popT % 4 < 2) ctx.drawImage(icon, x + 4, y - 6 - rise);
    }
  }
}

class Rescuee {
  constructor(tx, ty, id) {
    this.id = id;
    this.w = 12; this.h = 22;
    this.x = tx * TILE + 2; this.y = (ty + 1) * TILE - this.h;
    this.state = 'waiting';
    this.t = 0;
    this.vy = 0;
    this.gone = false;
  }
  update(g) {
    this.t++;
    if (this.state === 'waiting') {
      if (overlaps(this, g.player) && !g.player.dead) {
        this.state = 'flying';
        this.t = 0;
        g.onRescue(this.id);
        g.burst(this.x + 6, this.y + 4, ['#fcfcfc', '#fce890'], 14, 1.6);
      }
    } else if (this.state === 'flying') {
      // hover for a moment with wings out, then fly up and away
      if (this.t > 40) this.vy = Math.max(-1.6, this.vy - 0.03);
      this.y += this.vy;
      if (this.t % 6 === 0) g.burst(this.x + 6, this.y + 22, ['#fce890', '#fcfcfc'], 1, 0.5);
      if (this.t > 300) this.gone = true;
    }
  }
  draw(ctx, cam, frame) {
    const set = this.id === 2 ? SPR.bob2 : SPR.bob3;
    const x = Math.round(this.x - (BOB_W - this.w) / 2 - cam.x), y = Math.round(this.y - (BOB_H - this.h) - cam.y);
    const facingR = this.state === 'waiting' ? (Math.floor(this.t / 90) % 2 === 0) : true;
    if (this.state === 'flying') {
      const flap = Math.floor(this.t / 6) % 2;
      ctx.drawImage(SPR.wingL[flap], x - 6, y + 9);
      ctx.drawImage(SPR.wingR[flap], x + BOB_W - 2, y + 9);
      ctx.drawImage(set.jump.r, x, y);
    } else {
      ctx.drawImage(facingR ? set.stand.r : set.stand.l, x, y);
      const bob = Math.floor(this.t / 20) % 2;
      drawTextC(ctx, 'HELP!', x + BOB_W / 2, y - 18 - bob, '#fce890');
      drawTextC(ctx, `BOB ${this.id}`, x + BOB_W / 2, y - 9, this.id === 2 ? '#48c8f0' : '#c890fc');
    }
  }
}

class Particles {
  constructor() { this.list = []; }
  burst(x, y, colors, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up ?? 1),
        life: (opts.life ?? 30) + Math.random() * 15, color: colors[i % colors.length],
        size: opts.size ?? (Math.random() < 0.3 ? 2 : 1), grav: opts.grav ?? 0.12,
      });
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }
  update() {
    for (const p of this.list) { p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.98; p.life--; }
    this.list = this.list.filter(p => p.life > 0);
  }
  draw(ctx, cam) {
    for (const p of this.list) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.size, p.size);
    }
  }
}
