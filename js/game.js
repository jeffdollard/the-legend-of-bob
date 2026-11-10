// Main loop, state machine (title / play / pause / dead / win), camera, rendering, debug tools.
'use strict';

const SKY = '#78a8f8';

const Game = {
  canvas: null, ctx: null,
  state: 'title',
  seed: 0, urlSeed: null, layout: null, world: null,
  player: null, bots: [], chests: [], rescuees: [], boss: null, grenades: [], particles: null,
  cam: { x: 0, y: 0 }, shake: 0,
  toasts: [], rescued: { 2: false, 3: false }, sealTimer: 0,
  stats: null, frame: 0, stateT: 0,
  debug: false, god: false, revealAll: false,
  input: Input,
  clouds: [],
  fps: 0, _fpsT: 0, _fpsN: 0,

  init() {
    const q = new URLSearchParams(location.search);
    this.debug = q.get('debug') === '1';
    if (q.get('seed')) this.urlSeed = parseInt(q.get('seed'), 10) >>> 0;
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    buildSprites();
    Input.attach(window);
    Input.onAnyKey = () => {
      if (AudioSys.ensure() && this.state === 'title' && !AudioSys.track) AudioSys.playMusic('main');
    };
    addEventListener('resize', () => this.fit()); this.fit();
    // mute button: map the pointer to game pixels
    const toGame = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * VIEW_W / r.width, (e.clientY - r.top) * VIEW_H / r.height];
    };
    this.canvas.addEventListener('pointerdown', (e) => { if (muteButtonHit(...toGame(e))) this.toggleMute(); });
    this.canvas.addEventListener('pointermove', (e) => { this.canvas.style.cursor = muteButtonHit(...toGame(e)) ? 'pointer' : ''; });
    addEventListener('blur', () => { if (this.state === 'play') this.state = 'pause'; });
    for (let i = 0; i < 40; i++) this.clouds.push({ x: Math.random() * 2000, r: Math.random() });
    let last = performance.now(), acc = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      let n = 0;
      while (acc >= 1 / 60 && n < 5) { Input.beginStep(); this.update(); acc -= 1 / 60; n++; }
      if (n === 5) acc = 0;
      this.render();
      this._fpsN++;
      if (now - this._fpsT > 500) { this.fps = Math.round(this._fpsN * 1000 / (now - this._fpsT)); this._fpsT = now; this._fpsN = 0; }
    };
    requestAnimationFrame(loop);
  },

  // Fill the window: height scales to fit, width widens to match the window's shape.
  fit() {
    const s = Math.min(innerHeight / VIEW_H, innerWidth / UI_W);
    const w = Math.max(UI_W, Math.min(VIEW_MAX_W, Math.round(innerWidth / s)));
    if (w !== VIEW_W || this.canvas.width !== w) {
      VIEW_W = w;
      this.canvas.width = w;                  // resizing resets context state
      this.ctx.imageSmoothingEnabled = false;
      if (this.world) this.clampCamera();
    }
    this.canvas.style.width = Math.round(VIEW_W * s) + 'px';
    this.canvas.style.height = Math.round(VIEW_H * s) + 'px';
  },

  toggleMute() {
    const muted = AudioSys.toggleMute();
    if (AudioSys.ensure() && !muted && this.state === 'title' && !AudioSys.track) AudioSys.playMusic('main');
    if (this.state !== 'title') this.toast(muted ? 'SOUND OFF' : 'SOUND ON', 60);
  },

  newGame(seed) {
    this.seed = seed >>> 0;
    this.layout = generateLayout(this.seed);
    this.restartLevel();
  },

  restartLevel() {
    const L = this.layout;
    this.world = new World(L);
    this.world.revealAll = this.revealAll;
    this.player = new Player(L.spawn.x, L.spawn.y);
    this.bots = L.bots.map(b => new BobBot(b.x, b.y));
    this.chests = L.chests.map(c => new Chest(c.x, c.y, c.item));
    this.rescuees = [new Rescuee(L.bob2.x, L.bob2.y, 2), new Rescuee(L.bob3.x, L.bob3.y, 3)];
    this.boss = new Boss(L);
    this.grenades = [];
    this.particles = new Particles();
    this.rescued = { 2: false, 3: false };
    this.sealTimer = 0;
    this.toasts = [];
    this.stats = { dug: 0, placed: 0, bots: 0, frames: 0 };
    this.state = 'play'; this.stateT = 0;
    this.snapCamera();
    this.toast('SAVE BOB 2 AND BOB 3, THEN DEFEAT THE BOB BOSS!');
    this.toast('HIDDEN TUNNELS LIE BENEATH THE GOLDEN GRASS.');
    AudioSys.playMusic('main');
  },

  // ---------- services used by entities ----------
  toast(text, frames = 170) {
    if (this.toasts.some(t => t.text === text)) return;
    this.toasts.push({ text, t: frames });
    if (this.toasts.length > 3) this.toasts.splice(0, this.toasts.length - 3);
  },
  burst(x, y, colors, n, speed, opts) { this.particles.burst(x, y, colors, n, speed, opts); },
  sfx(name) { AudioSys.sfx(name); },
  blockedByEntity(r) {
    return this.bots.some(b => !b.dead && overlaps(r, b))
      || (!this.boss.dead && overlaps(r, this.boss))
      || this.rescuees.some(q => q.state === 'waiting' && overlaps(r, q))
      || this.chests.some(c => overlaps(r, c));
  },
  resolvePunch(p, box, dmg) {
    let landed = false;
    for (const b of this.bots) {
      if (b.dead || p.punch.hit.has(b) || !overlaps(box, b)) continue;
      p.punch.hit.add(b); b.hit(dmg, this, p.cx); landed = true;
    }
    if (!p.punch.hit.has(this.boss)) {
      const r = this.boss.takePunch(box, dmg, this);
      if (r) {
        p.punch.hit.add(this.boss); landed = true;
        if (r === 'body') { this.sfx('clink'); this.burst(box.x + box.w / 2, box.y + box.h / 2, ['#fcfcfc', '#bcbcbc'], 5, 1.2); }
      }
    }
    return landed;
  },
  onRescue(id) {
    this.rescued[id] = true;
    this.sfx('rescue');
    this.toast(`BOB ${id} IS SAFE!`);
    if (this.rescued[2] && this.rescued[3]) {
      this.sealTimer = 100;
      this.toast('BOTH BOBS ARE SAFE... THE SEAL BEGINS TO CRACK!');
    } else {
      this.toast(id === 2 ? 'NOW FIND BOB 3 IN THE TUNNELS BELOW.' : 'NOW FIND BOB 2. HE IS SOMEWHERE ABOVE GROUND.');
    }
  },
  onBossDefeated() {
    this.state = 'win'; this.stateT = 0;
    AudioSys.stopMusic();
    this.sfx('win');
  },

  // ---------- update ----------
  update() {
    this.frame++;
    this.stateT++;
    if (Input.pressed('mute')) this.toggleMute();
    const go = Input.pressed('jump') || Input.pressed('start');
    switch (this.state) {
      case 'title':
        if (go) { AudioSys.ensure(); this.newGame(this.urlSeed ?? Math.floor(Math.random() * 1e9)); }
        break;
      case 'pause':
        if (Input.pressed('pause') || go) this.state = 'play';
        break;
      case 'dead':
        this.player.update(this);
        this.particles.update();
        if (this.stateT > 50 && go) this.restartLevel();
        break;
      case 'win':
        this.particles.update();
        if (this.stateT % 20 === 0) this.burst(this.player.cx + (Math.random() - 0.5) * 160, this.player.cy - 60, ['#f8c020', '#e83018', '#48c8f0', '#90e870'], 16, 2);
        if (this.stateT > 90 && go) { this.state = 'title'; this.stateT = 0; AudioSys.playMusic('main'); }
        break;
      case 'play':
        this.updatePlay();
        break;
    }
  },

  updatePlay() {
    if (Input.pressed('pause')) { this.state = 'pause'; return; }
    if (this.debug) this.debugKeys();
    const p = this.player, world = this.world;
    this.stats.frames++;

    p.update(this);

    for (const b of this.bots) {
      if (Math.abs(b.x - p.x) > 26 * TILE || Math.abs(b.y - p.y) > 18 * TILE) continue;
      b.update(this);
      if (!b.dead && overlaps(b, p)) p.hurt(CFG.DMG_BOT, b.cx, this);
    }
    this.bots = this.bots.filter(b => !b.dead);

    this.boss.update(this);
    if (this.boss.awake && !this.boss.dying && !this.boss.dead && overlaps(this.boss, p)) p.hurt(CFG.DMG_BOSS_TOUCH, this.boss.cx, this);

    for (const gr of this.grenades) gr.update(this);
    this.grenades = this.grenades.filter(gr => !gr.dead);
    for (const c of this.chests) c.update(this);
    for (const r of this.rescuees) r.update(this);
    this.rescuees = this.rescuees.filter(r => !r.gone);

    if (this.sealTimer > 0) {
      this.sealTimer--;
      if (this.sealTimer % 20 === 0) this.shake = Math.max(this.shake, 3);
      if (this.sealTimer === 0) {
        world.unseal();
        this.sfx('seal'); this.shake = 14;
        for (const [x, y] of this.layout.seal.doors) this.burst(x * TILE + 8, y * TILE + 8, ['#d040ff', '#3c1060', '#fcfcfc'], 8, 2);
        this.toast('THE SEAL HAS CRUMBLED! THE BOB BOSS AWAITS DEEP BELOW.');
      }
    }

    this.particles.update();
    if (this.frame % 3 === 0) world.reveal(Math.floor(p.cx / TILE), Math.floor(p.cy / TILE));
    this.updateCamera();
    if (this.toasts.length) {
      this.toasts[0].t -= this.toasts.length > 1 ? 3 : 1;   // hurry when messages are queued
      if (this.toasts[0].t <= 0) this.toasts.shift();
    }
    if (this.shake > 0) this.shake *= 0.85, this.shake < 0.5 && (this.shake = 0);

    const bossMusic = this.boss.awake && !this.boss.dying && !this.boss.dead;
    AudioSys.playMusic(bossMusic ? 'boss' : 'main');

    if (p.dead) {
      this.state = 'dead'; this.stateT = 0;
      AudioSys.stopMusic();
      this.sfx('death');
    }
  },

  updateCamera() {
    const p = this.player;
    const tx = p.cx - VIEW_W / 2, ty = p.cy - VIEW_H * 0.45;
    this.cam.x += (tx - this.cam.x) * 0.14;
    this.cam.y += (ty - this.cam.y) * 0.14;
    this.clampCamera();
  },
  snapCamera() {
    const p = this.player;
    this.cam.x = p.cx - VIEW_W / 2; this.cam.y = p.cy - VIEW_H * 0.45;
    this.clampCamera();
  },
  clampCamera() {
    this.cam.x = Math.max(0, Math.min(this.world.W * TILE - VIEW_W, this.cam.x));
    this.cam.y = Math.max(CFG.SKY_LIMIT * TILE, this.cam.y);
  },

  // ---------- debug ----------
  teleport(tx, ty) {
    const p = this.player;
    p.x = tx * TILE + (TILE - p.w) / 2; p.y = (ty + 1) * TILE - p.h; p.vx = p.vy = 0;
    this.snapCamera();
    this.world.reveal(tx, ty);
  },
  rescueAll() {
    for (const r of this.rescuees) if (r.state === 'waiting') { r.state = 'flying'; r.t = 0; this.onRescue(r.id); }
  },
  debugKeys() {
    const L = this.layout, c = L.cave, p = this.player;
    if (Input.pressed('dbgGod')) { this.god = !this.god; this.toast(this.god ? 'GOD MODE ON' : 'GOD MODE OFF', 60); }
    if (Input.pressed('dbgReveal')) { this.revealAll = this.world.revealAll = !this.revealAll; }
    if (Input.pressed('dbg1')) this.teleport(L.mesa.x0 - 3, L.heights[L.mesa.x0 - 3] - 1);
    if (Input.pressed('dbg2')) this.teleport(L.bob3.x - 2, L.bob3.y);
    if (Input.pressed('dbg3')) {
      const d = L.tunnels[0].door;
      if (d === 'left') this.teleport(c.x0 - 4, c.floorY - 1);
      else if (d === 'right') this.teleport(c.x1 + 4, c.floorY - 1);
      else this.teleport(c.cx, c.y0 - 3);
    }
    if (Input.pressed('dbg4')) { this.rescueAll(); this.sealTimer = 0; this.world.unseal(); this.teleport(c.x0 + 2, c.y1); }
    if (Input.pressed('dbg5')) { p.sword = true; p.armor = CFG.ARMOR_HITS; p.inv.dirt += 50; p.inv.stone += 50; p.health = CFG.MAX_HEALTH; }
    if (Input.pressed('dbg6')) this.rescueAll();
  },

  // ---------- render ----------
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = SKY; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.state === 'title') { this.drawTitle(ctx); drawMuteButton(ctx); return; }
    this.drawWorld(ctx);
    drawHUD(ctx, this);
    ctx.save(); ctx.translate((VIEW_W - UI_W) >> 1, 0);   // menus sit in a centered 256-wide column
    if (this.state === 'pause') this.drawPause(ctx);
    if (this.state === 'dead') this.drawDead(ctx);
    if (this.state === 'win') this.drawWin(ctx);
    ctx.restore();
    if (this.debug) this.drawDebug(ctx);
    drawMuteButton(ctx);
  },

  // Smoothed world-y of the ground near the camera, so mountains sit on the horizon
  horizonY(cam) {
    if (!this.layout) return cam.y + 200;
    const H = this.layout.heights, c = Math.floor((cam.x + VIEW_W / 2) / TILE);
    let sum = 0, n = 0;
    for (let x = c - 12; x <= c + 12; x++) if (x >= 0 && x < H.length) { sum += H[x]; n++; }
    const target = (sum / n) * TILE;
    this._horizon = this._horizon === undefined ? target : this._horizon + (target - this._horizon) * 0.05;
    return this._horizon;
  },

  drawBackground(ctx, cam) {
    const mw = SPR.mountains.width;
    const off = -Math.floor(cam.x * 0.25) % mw;
    const my = this.state === 'title' ? 110 : Math.round(this.horizonY(cam) - 80 - cam.y);
    if (my < VIEW_H && my + 96 > 0) for (let x = off - mw; x < VIEW_W; x += mw) ctx.drawImage(SPR.mountains, x, my);
    for (const cl of this.clouds) {
      const span = 2000;
      let x = ((cl.x - cam.x * 0.5) % span + span) % span - 40;
      const y = Math.round(my - 16 - cl.r * 100);
      if (x < VIEW_W && y < VIEW_H && y > -20) ctx.drawImage(SPR.cloud, Math.round(x), y);
    }
  },

  drawWorld(ctx) {
    const world = this.world, L = this.layout, p = this.player;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const cam = { x: Math.round(this.cam.x + sx), y: Math.round(this.cam.y + sy) };
    this.drawBackground(ctx, cam);

    const tx0 = Math.floor(cam.x / TILE), ty0 = Math.floor(cam.y / TILE);
    for (let ty = ty0; ty <= ty0 + VIEW_H / TILE + 1; ty++) {
      for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++) {
        const t = world.get(tx, ty);
        const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
        if (t === T.AIR) {
          if (world.underground(tx, ty)) {
            if (world.revealed(tx, ty)) ctx.drawImage(ty <= L.heights[tx] + L.dirtDepth[tx] ? SPR.bgDirt : SPR.bgStone, px, py);
            else ctx.drawImage(SPR.tile[world.disguise(tx, ty)], px, py);
          }
        } else ctx.drawImage(SPR.tile[t], px, py);
      }
    }
    // Seal glow while it is cracking
    if (this.sealTimer > 0 && this.frame % 10 < 5) {
      ctx.fillStyle = 'rgba(208,64,255,0.35)';
      for (const [x, y] of L.seal.doors) ctx.fillRect(x * TILE - cam.x, y * TILE - cam.y, TILE, TILE);
    }

    // Dig cracks
    if (p.dig) {
      const t = world.get(p.dig.x, p.dig.y);
      const stage = Math.min(2, Math.floor(p.dig.p / (DIG_TIME[t] || 10) * 3));
      ctx.drawImage(SPR.cracks[stage], p.dig.x * TILE - cam.x, p.dig.y * TILE - cam.y);
    }

    const vis = (e) => world.visible(Math.floor((e.x + e.w / 2) / TILE), Math.floor((e.y + e.h - 1) / TILE));
    for (const c of this.chests) if (vis(c)) c.draw(ctx, cam);
    for (const r of this.rescuees) if (r.state !== 'waiting' || vis(r)) r.draw(ctx, cam, this.frame);
    for (const b of this.bots) if (vis(b)) b.draw(ctx, cam);
    if (vis(this.boss) || this.boss.awake) this.boss.draw(ctx, cam, this.frame);
    for (const gr of this.grenades) gr.draw(ctx, cam);
    this.drawPlayer(ctx, cam);
    this.particles.draw(ctx, cam);
  },

  drawPlayer(ctx, cam) {
    const p = this.player;
    const set = p.armor > 0 ? SPR.bobArmor : SPR.bob;
    let f;
    if (p.punch && p.punch.dir === 'side' && p.punch.t < 11) f = p.onGround ? set.punch : set.punchAir;
    else if (p.digging && p.dig && p.dig.dir === 'side') f = set.punch;
    else if (p.climbing) f = Math.floor(p.anim / 6) % 2 ? set.climb1 : set.climb2;
    else if (!p.onGround) f = set.jump;
    else if (Math.abs(p.vx) > 0.2) f = [set.walk1, set.stand, set.walk2, set.stand][Math.floor(p.anim / 7) % 4];
    else f = set.stand;
    const x = Math.round(p.x - (BOB_W - p.w) / 2 - cam.x), y = Math.round(p.y - (BOB_H - p.h) - cam.y);
    if (p.dead) { ctx.save(); ctx.globalAlpha = 0.8; ctx.drawImage(flipV(f.r), x, y); ctx.restore(); return; }
    if (p.iframes > 0 && Math.floor(p.iframes / 3) % 2) return;
    ctx.drawImage(p.facing > 0 ? f.r : f.l, x, y);

    // Shovel while digging
    if (p.digging && p.dig) {
      const j = (Math.floor(this.frame / 3) % 2) * 2;
      const pcx = Math.round(p.cx - cam.x), py = Math.round(p.y - cam.y);
      if (p.dig.dir === 'side') {
        if (p.facing > 0) ctx.drawImage(SPR.shovel, Math.round(p.x + p.w - 4 - cam.x) + j, py + 9);
        else ctx.drawImage(SPR.shovelL, Math.round(p.x - 8 - cam.x) - j, py + 9);
      } else if (p.dig.dir === 'down') ctx.drawImage(SPR.shovelDown, pcx - 2, py + p.h - 6 + j);
      else ctx.drawImage(SPR.shovelUp, pcx - 2, py - 10 - j);
    }

    // Fist / sword
    if (p.punch && p.punch.t >= 2 && p.punch.t <= 10) {
      // thrust from Bob's body out to the full reach of the hitbox
      const b = p.punchBox();
      const k = Math.min(1, (p.punch.t - 2) / 3);
      const len = p.sword ? 16 : 6;
      const pcx = Math.round(p.cx - cam.x), top = Math.round(p.y - cam.y), bottom = Math.round(p.y + p.h - cam.y);
      let img, ix, iy;
      if (p.punch.dir === 'side') {
        const ext = Math.round((b.w - len) * k);
        img = p.sword ? (p.facing > 0 ? SPR.sword : SPR.swordL) : SPR.fist;
        ix = p.facing > 0 ? Math.round(p.x + p.w - cam.x) + ext : Math.round(p.x - cam.x) - len - ext;
        iy = top + (p.sword ? 8 : 7);
      } else if (p.punch.dir === 'up') {
        img = p.sword ? SPR.swordUp : SPR.fist;
        ix = pcx - (p.sword ? 2 : 3);
        iy = top - len - Math.round((b.h - len) * k);
      } else {
        img = p.sword ? SPR.swordDown : SPR.fist;
        ix = pcx - (p.sword ? 2 : 3);
        iy = bottom + Math.round((b.h - len) * k);
      }
      ctx.drawImage(img, ix, iy);
    }
  },

  drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fce890'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  },

  drawControls(ctx, y) {
    const rows = [
      ['ARROWS', 'MOVE / AIM / CLIMB'], ['SPACE', 'JUMP'], ['D', 'DIG (UP+D = DIG UP)'], ['E', 'PLACE BLOCK'],
      ['F', 'PUNCH / UPPERCUT'], ['Q', 'SWITCH MATERIAL'], ['ESC', 'PAUSE    M  MUTE'],
    ];
    rows.forEach(([k, v], i) => {
      drawText(ctx, k, 48, y + i * 10, '#f8c020');
      drawText(ctx, v, 94, y + i * 10, '#fcfcfc');
    });
  },

  drawTitle(ctx) {
    const cam = { x: this.frame * 0.4, y: CFG.SURFACE_BASE * TILE - 170 };
    this.drawBackground(ctx, cam);
    for (let x = 0; x < VIEW_W; x += TILE) {
      ctx.drawImage(SPR.tile[T.GRASS], x, 200);
      ctx.drawImage(SPR.tile[T.DIRT], x, 216); ctx.drawImage(SPR.tile[T.DIRT], x, 232);
    }
    // characters spread across the full width; the boss stays at the right edge
    const bx = VIEW_W - 62;
    ctx.drawImage(SPR.bob.stand.r, Math.round(VIEW_W * 0.22), 176);
    ctx.drawImage(SPR.boss.stand, bx, 152);
    ctx.drawImage(SPR.grenade, bx + 4 - 9, 156); ctx.drawImage(SPR.grenade, bx + 53 - 9, 156);
    ctx.drawImage(SPR.bot[Math.floor(this.frame / 10) % 2].l, Math.round(VIEW_W * 0.47), 184);
    ctx.drawImage(SPR.grenade, bx - 44, 176 + Math.round(Math.sin(this.frame / 15) * 4));
    ctx.save(); ctx.translate((VIEW_W - UI_W) >> 1, 0);
    drawTextC(ctx, 'THE LEGEND', UI_W / 2, 16, '#fce890', 2, '#5c2808');
    drawTextC(ctx, 'OF BOB', UI_W / 2, 36, '#f87818', 3, '#5c2808');
    this.drawPanel(ctx, 40, 62, 176, 78);
    this.drawControls(ctx, 68);
    drawTextC(ctx, 'SAVE BOB 2 AND BOB 3. DEFEAT THE BOB BOSS.', UI_W / 2, 145, '#fcfcfc');
    if (Math.floor(this.frame / 30) % 2 === 0) drawTextC(ctx, 'PRESS SPACE TO START', UI_W / 2, 157, '#fce890');
    ctx.restore();
  },

  drawPause(ctx) {
    this.drawPanel(ctx, 40, 50, 176, 110);
    drawTextC(ctx, 'PAUSED', UI_W / 2, 58, '#fce890', 2);
    this.drawControls(ctx, 80);
    drawTextC(ctx, 'ESC TO RESUME', UI_W / 2, 150, '#bcbcbc');
  },

  drawDead(ctx) {
    if (this.stateT < 30) return;
    this.drawPanel(ctx, 36, 80, 184, 64);
    drawTextC(ctx, 'BOB IS DOWN!', UI_W / 2, 88, '#e83018', 2);
    drawTextC(ctx, 'THE LEVEL RESTARTS AND', UI_W / 2, 110, '#fcfcfc');
    drawTextC(ctx, 'YOUR INVENTORY IS LOST.', UI_W / 2, 120, '#fcfcfc');
    if (this.stateT > 50 && Math.floor(this.frame / 30) % 2 === 0) drawTextC(ctx, 'PRESS SPACE', UI_W / 2, 132, '#fce890');
  },

  drawWin(ctx) {
    const s = this.stats;
    const secs = Math.floor(s.frames / 60);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    this.drawPanel(ctx, 24, 56, 208, 112);
    drawTextC(ctx, 'VICTORY!', UI_W / 2, 64, '#fce890', 2);
    drawTextC(ctx, 'THE BOB BOSS IS DEFEATED.', UI_W / 2, 86, '#fcfcfc');
    drawTextC(ctx, 'THE LEGEND OF BOB LIVES ON!', UI_W / 2, 96, '#f87818');
    drawText(ctx, `TIME        ${time}`, 60, 114, '#bcbcbc');
    drawText(ctx, `BLOCKS DUG  ${s.dug}`, 60, 124, '#bcbcbc');
    drawText(ctx, `BOTS BOPPED ${s.bots}`, 60, 134, '#bcbcbc');
    if (this.stateT > 90 && Math.floor(this.frame / 30) % 2 === 0) drawTextC(ctx, 'PRESS SPACE', UI_W / 2, 154, '#fce890');
  },

  drawDebug(ctx) {
    const p = this.player;
    const lines = [
      `FPS ${this.fps}  SEED ${this.seed}`,
      `TILE ${p.tileX()},${p.tileY()}${this.god ? '  GOD' : ''}`,
      `1 BOB2 2 BOB3 3 DOOR 4 BOSS`,
      `5 GEAR 6 RESCUE G GOD V REVEAL`,
    ];
    lines.forEach((l, i) => drawText(ctx, l, 4, VIEW_H - 40 + i * 9, '#90e870'));
  },
};

if (typeof window !== 'undefined') {
  window.Game = Game;
  window.addEventListener('load', () => Game.init());
}
