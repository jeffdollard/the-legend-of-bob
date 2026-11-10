// Bob-bot: small patrolling robot. Turns at walls and ledges, chases Bob when he's close.
'use strict';

class BobBot {
  constructor(tx, ty) {
    this.w = 12; this.h = 12;
    this.x = tx * TILE + 2; this.y = (ty + 1) * TILE - this.h;
    this.vx = 0; this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.hp = CFG.BOT_HP;
    this.onGround = false;
    this.dead = false;
    this.flash = 0;
    this.t = Math.floor(Math.random() * 60);
    this.chasing = false;
  }
  get cx() { return this.x + this.w / 2; }

  update(g) {
    const p = g.player, world = g.world;
    this.t++;
    const dx = p.cx - this.cx, dy = (p.y + p.h) - (this.y + this.h);
    this.chasing = !p.dead && Math.abs(dx) < 7 * TILE && Math.abs(dy) < 2.5 * TILE;
    if (this.chasing) this.dir = Math.sign(dx) || this.dir;

    const speed = this.chasing ? 0.95 : 0.45;
    this.vx = this.dir * speed;
    this.vy = Math.min(this.vy + 0.35, 5);

    if (this.onGround && !this.chasing) {
      // patrol: turn around at ledges
      const aheadX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const below = Math.floor((this.y + this.h + 1) / TILE);
      if (!world.solid(Math.floor(aheadX / TILE), below)) this.dir = -this.dir;
    }
    moveAndCollide(this, world);
    if (this.hitWall) {
      if (this.chasing && this.onGround) this.vy = -3.6; // hop up 1-block steps
      else this.dir = -this.dir;
    }
    if (this.flash > 0) this.flash--;
  }

  hit(dmg, g, fromX) {
    this.hp -= dmg;
    this.flash = 8;
    this.vy = -2;
    this.dir = Math.sign(this.cx - fromX) || this.dir;
    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('botDie');
      g.burst(this.cx, this.y + 6, ['#bcbcbc', '#7c7c7c', '#e83018', '#48c8f0'], 16, 2.2);
      g.stats.bots++;
    } else g.sfx('hit');
  }

  draw(ctx, cam) {
    const frames = SPR.bot[Math.floor(this.t / 10) % 2];
    const img = this.dir > 0 ? frames.r : frames.l;
    const x = Math.round(this.x - 2 - cam.x), y = Math.round(this.y - 4 - cam.y);
    if (this.flash % 4 < 2) ctx.drawImage(img, x, y);
  }
}
