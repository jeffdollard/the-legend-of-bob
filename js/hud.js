// Heads-up display: hearts, armor, sword, material, rescue status, depth, toasts.
'use strict';

function drawHearts(ctx, x, y, quarters) {
  for (let i = 0; i < CFG.MAX_HEALTH / 4; i++) {
    const hx = x + i * 9;
    ctx.drawImage(SPR.heartEmpty, hx, y);
    const q = Math.max(0, Math.min(4, quarters - i * 4));
    if (q > 0) {
      const w = q === 4 ? 7 : Math.round(7 * q / 4);
      ctx.drawImage(SPR.heart, 0, 0, w, 6, hx, y, w, 6);
    }
  }
}

function drawHUD(ctx, g) {
  const p = g.player;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, 13);

  drawHearts(ctx, 4, 4, p.health);
  let x = 34;
  if (p.armor > 0) { ctx.drawImage(SPR.shield, x, 3); drawText(ctx, String(p.armor), x + 9, 4, '#48c8f0'); x += 22; }
  if (p.sword) { ctx.drawImage(SPR.swordIcon, x, 3); x += 12; }

  // Materials: selected one highlighted
  let mx = 96;
  MATERIALS.forEach((m, i) => {
    const sel = i === p.matIdx;
    if (sel) { ctx.fillStyle = '#fcfcfc'; ctx.fillRect(mx - 1, 2, 10, 10); }
    ctx.drawImage(SPR.tile[m.tile], mx, 3, 8, 8);
    drawText(ctx, String(p.inv[m.key]), mx + 11, 4, sel ? '#fcfcfc' : '#7c7c7c');
    mx += 14 + textWidth(String(p.inv[m.key]));
  });

  // Rescue status
  const rx = VIEW_W - 78;   // leaves room for the mute button
  [2, 3].forEach((id, i) => {
    const saved = g.rescued[id];
    const set = id === 2 ? SPR.bob2 : SPR.bob3;
    ctx.globalAlpha = saved ? 1 : 0.35;
    ctx.drawImage(set.stand.r, 6, 0, 10, 9, rx + i * 30, 2, 10, 9);
    ctx.globalAlpha = 1;
    drawText(ctx, saved ? String(id) : '?', rx + 13 + i * 30, 4, saved ? '#90e870' : '#7c7c7c');
  });

  // Depth
  const tx = p.tileX(), ty = p.tileY();
  const depth = tx >= 0 && tx < g.world.W ? ty - g.layout.heights[tx] : 0;
  if (depth > 0) drawText(ctx, `DEPTH ${depth}`, 4, 16, '#bcbcbc');

  // Toast
  const t = g.toasts[0];
  if (t) {
    const lines = wrapText(t.text, 38);
    const h = lines.length * 9 + 5, w = Math.max(...lines.map(l => textWidth(l))) + 10;
    const y = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect((VIEW_W - w) >> 1, y - 3, w, h);
    lines.forEach((l, i) => drawTextC(ctx, l, VIEW_W / 2, y + i * 9, '#fce890'));
  }
}

// Clickable speaker in the top-right corner (also on the title screen)
function muteButtonHit(gx, gy) { return gx >= VIEW_W - 18 && gy < 15; }
function drawMuteButton(ctx) {
  ctx.drawImage(AudioSys.muted ? SPR.soundOff : SPR.soundOn, VIEW_W - 14, 2);
}

function wrapText(text, max) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
