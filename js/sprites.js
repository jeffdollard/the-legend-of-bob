// Placeholder pixel art. Every sprite is looked up by name from SPR, so swapping in
// art from the sketches means replacing the definitions in this file only.
'use strict';

const PAL = {
  k: '#000000', i: '#101010', w: '#fcfcfc', g: '#bcbcbc', G: '#7c7c7c', d: '#3c3c3c',
  s: '#fcbc94', S: '#d88860', h: '#8c4414', H: '#5c2808',
  e: '#e86818', E: '#a03c08',          // Bob's shirt
  b: '#2868e8', B: '#1838a0',          // Bob 2
  p: '#9850e8', P: '#5c24a8',          // Bob 3
  n: '#5c3c1c', N: '#3c2410',          // pants
  r: '#e83018', R: '#901808', y: '#f8c020', Y: '#fce890',
  c: '#48c8f0', C: '#2078a8', o: '#f87818', l: '#90e870', m: '#d040ff', M: '#3c1060',
};

const SPR = {};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function sprite(rows, map = {}) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = makeCanvas(w, h), x = c.getContext('2d');
  rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      let ch = row[xx];
      if (ch === '.' || ch === ' ') continue;
      if (map[ch] !== undefined) ch = map[ch];
      if (ch === '.') continue;
      x.fillStyle = PAL[ch] || ch;
      x.fillRect(xx, yy, 1, 1);
    }
  });
  return c;
}

function flipH(src) {
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}
function flipV(src) {
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(0, src.height); x.scale(1, -1); x.drawImage(src, 0, 0);
  return c;
}
function rot90(src) {
  const c = makeCanvas(src.height, src.width), x = c.getContext('2d');
  x.translate(src.height, 0); x.rotate(Math.PI / 2); x.drawImage(src, 0, 0);
  return c;
}
function scaleUp(src, n) {
  const c = makeCanvas(src.width * n, src.height * n), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ---------------- Character art (drawn from the sketches) ----------------
// Small 3x5 letters used for the "BOB" lettering on characters
const MINI = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
};
function dot(x, color, X, Y, W = 1, H = 1) { x.fillStyle = PAL[color] || color; x.fillRect(X, Y, W, H); }
function box(x, X, Y, W, H, line, fill) {
  dot(x, line, X, Y, W, H);
  if (fill && W > 2 && H > 2) dot(x, fill, X + 1, Y + 1, W - 2, H - 2);
}
function miniText(x, str, X, Y, color) {
  [...str].forEach((ch, i) => MINI[ch].forEach((row, r) => {
    for (let c = 0; c < 3; c++) if (row[c] === '#') dot(x, color, X + i * 4 + c, Y + r);
  }));
}
function canvasOf(w, h, draw) { const c = makeCanvas(w, h); draw(c.getContext('2d')); return c; }

// Bob (sketch "YOU"): square head with square eyes + box mouth, arms up,
// "B ▲O B" on the chest (blue B's, green O over a red triangle), his number on both legs.
// 22x24 sprite over a 12x22 collision box. Drawn front-on, never mirrored (the lettering
// must read correctly); left/right is shown by the pupils and the punching arm.
const BOB_W = 22, BOB_H = 24;
const BOB_COLORS = {
  bob:   { line: '#7c4818', fill: '#f4dcb0', letter: '#2858d8', tri: '#d82818', ring: '#20a030', num: '#8040c8' },
  armor: { line: '#3c4854', fill: '#c4ccd6', letter: '#2858d8', tri: '#d82818', ring: '#20a030', num: '#8040c8' },
  bob2:  { line: '#7c4818', fill: '#d4e6fa', letter: '#2858d8', tri: '#d82818', ring: '#20a030', num: '#8040c8' },
  bob3:  { line: '#7c4818', fill: '#ead8fa', letter: '#2858d8', tri: '#d82818', ring: '#20a030', num: '#8040c8' },
};
const BOB_LEG_LIFT = { stand: [0, 0], walkA: [1, 0], walkB: [0, 1], jump: [1, 1] };   // [left, right] in px
function drawBob(x, o, C) {
  const lift = BOB_LEG_LIFT[o.legs];
  box(x, 4, 17 - lift[0], 6, 7, C.line, C.fill); miniText(x, o.num, 6, 18 - lift[0], C.num);
  box(x, 12, 17 - lift[1], 6, 7, C.line, C.fill); miniText(x, o.num, 13, 18 - lift[1], C.num);
  const punch = o.arm === 'punch' ? o.look : 0;
  if (punch === -1) box(x, 0, 9, 4, 3, C.line, C.fill); else box(x, 0, 1, 3, 10, C.line, C.fill);
  if (punch === 1) box(x, 18, 9, 4, 3, C.line, C.fill); else box(x, 19, 1, 3, 10, C.line, C.fill);
  box(x, 3, 8, 16, 10, C.line, C.fill);
  miniText(x, 'B', 5, 10, C.letter); miniText(x, 'B', 15, 10, C.letter);
  dot(x, C.tri, 11, 10); dot(x, C.tri, 10, 11, 3, 2); dot(x, C.tri, 9, 13, 5, 2);
  dot(x, C.ring, 11, 11); dot(x, C.ring, 10, 12); dot(x, C.ring, 12, 12); dot(x, C.ring, 11, 13);
  box(x, 6, 0, 10, 9, C.line, C.fill);
  const pupil = o.look > 0 ? 2 : 0;
  for (const ex of [7, 12]) { dot(x, '#fcfcfc', ex, 1, 3, 3); dot(x, '#101010', ex + pupil, 2); }
  box(x, 8, 5, 6, 3, C.line, C.fill);
}
function bobFrames(kind, num) {
  const C = BOB_COLORS[kind];
  const mk = (legs, arm) => ({
    r: canvasOf(BOB_W, BOB_H, x => drawBob(x, { legs, arm, look: 1, num }, C)),
    l: canvasOf(BOB_W, BOB_H, x => drawBob(x, { legs, arm, look: -1, num }, C)),
    lift: BOB_LEG_LIFT[legs],
  });
  return {
    stand: mk('stand', 'up'), walk1: mk('walkA', 'up'), walk2: mk('walkB', 'up'), jump: mk('jump', 'up'),
    punch: mk('stand', 'punch'), punchAir: mk('jump', 'punch'),
    climb1: mk('walkA', 'up'), climb2: mk('walkB', 'up'),
  };
}

// Bob Boss (sketch "the BOSS bob"): "BOB" all over his body and legs, a "BOB" grenade held
// up in each hand, square eyes, toothy box mouth. Weak spot glows in the arch between his legs.
// 60x48 sprite; the 32x48 collision box starts at sprite x = BOSS_OX.
const BOSS_OX = 14, BOSS_SW = 60;
function drawBoss(x, o) {
  const L = '#b01818', F = '#eadfd6', TXT = '#c81818';
  const ox = BOSS_OX;
  const [ll, lr] = { stand: [0, 0], walkA: [2, 0], walkB: [0, 2], jump: [1, 1] }[o.legs];
  box(x, ox + 4, 32 - ll, 9, 16, L, F); x.drawImage(SPR.bobVertical, ox + 6, 34 - ll);
  box(x, ox + 19, 32 - lr, 9, 16, L, F); x.drawImage(SPR.bobVertical, ox + 21, 34 - lr);
  // arms: out from the torso, then up to the hands
  box(x, ox - 9, 22, 12, 3, L, F);
  box(x, ox - 11, o.raise === -1 ? 6 : 12, 3, o.raise === -1 ? 19 : 13, L, F);
  box(x, ox + 29, 22, 12, 3, L, F);
  box(x, ox + 38, o.raise === 1 ? 6 : 12, 3, o.raise === 1 ? 19 : 13, L, F);
  // torso covered in BOBs
  box(x, ox + 2, 13, 28, 20, L, F);
  miniText(x, 'BOB', ox + 4, 15, TXT); miniText(x, 'BOB', ox + 17, 15, TXT);
  miniText(x, 'BOB', ox + 10, 21, TXT);
  miniText(x, 'BOB', ox + 4, 27, TXT); miniText(x, 'BOB', ox + 17, 27, TXT);
  // head
  box(x, ox + 10, 0, 12, 14, L, F);
  box(x, ox + 11, 3, 4, 4, L, '#fcfcfc'); dot(x, '#101010', ox + 12, 4); dot(x, '#e83018', ox + 13, 5);
  box(x, ox + 17, 3, 4, 4, L, '#fcfcfc'); dot(x, '#101010', ox + 18, 4); dot(x, '#e83018', ox + 19, 5);
  box(x, ox + 12, 9, 8, 3, L, '#3c0808');
  for (let i = 0; i < 6; i += 2) dot(x, '#fcfcfc', ox + 13 + i, 10);
}
function bossFrames() {
  const mk = (legs, raise = 0) => canvasOf(BOSS_SW, 48, x => drawBoss(x, { legs, raise }));
  return {
    stand: mk('stand'), walk1: mk('walkA'), walk2: mk('walkB'), jump: mk('jump'),
    raiseL: mk('stand', -1), raiseR: mk('stand', 1),
  };
}

// ---------------- Pixel font (5x7, column-major, bit0 = top row) ----------------
const FONT = {
  A: [0x7C, 0x12, 0x11, 0x12, 0x7C], B: [0x7F, 0x49, 0x49, 0x49, 0x36], C: [0x3E, 0x41, 0x41, 0x41, 0x22],
  D: [0x7F, 0x41, 0x41, 0x22, 0x1C], E: [0x7F, 0x49, 0x49, 0x49, 0x41], F: [0x7F, 0x09, 0x09, 0x09, 0x01],
  G: [0x3E, 0x41, 0x49, 0x49, 0x7A], H: [0x7F, 0x08, 0x08, 0x08, 0x7F], I: [0x00, 0x41, 0x7F, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3F, 0x01], K: [0x7F, 0x08, 0x14, 0x22, 0x41], L: [0x7F, 0x40, 0x40, 0x40, 0x40],
  M: [0x7F, 0x02, 0x0C, 0x02, 0x7F], N: [0x7F, 0x04, 0x08, 0x10, 0x7F], O: [0x3E, 0x41, 0x41, 0x41, 0x3E],
  P: [0x7F, 0x09, 0x09, 0x09, 0x06], Q: [0x3E, 0x41, 0x51, 0x21, 0x5E], R: [0x7F, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [0x01, 0x01, 0x7F, 0x01, 0x01], U: [0x3F, 0x40, 0x40, 0x40, 0x3F],
  V: [0x1F, 0x20, 0x40, 0x20, 0x1F], W: [0x3F, 0x40, 0x38, 0x40, 0x3F], X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  0: [0x3E, 0x51, 0x49, 0x45, 0x3E], 1: [0x00, 0x42, 0x7F, 0x40, 0x00], 2: [0x42, 0x61, 0x51, 0x49, 0x46],
  3: [0x21, 0x41, 0x45, 0x4B, 0x31], 4: [0x18, 0x14, 0x12, 0x7F, 0x10], 5: [0x27, 0x45, 0x45, 0x45, 0x39],
  6: [0x3C, 0x4A, 0x49, 0x49, 0x30], 7: [0x01, 0x71, 0x09, 0x05, 0x03], 8: [0x36, 0x49, 0x49, 0x49, 0x36],
  9: [0x06, 0x49, 0x49, 0x29, 0x1E],
  ' ': [0, 0, 0, 0, 0], '!': [0x00, 0x00, 0x5F, 0x00, 0x00], '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  ',': [0x00, 0x50, 0x30, 0x00, 0x00], ':': [0x00, 0x36, 0x36, 0x00, 0x00], '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '+': [0x08, 0x08, 0x3E, 0x08, 0x08], '/': [0x20, 0x10, 0x08, 0x04, 0x02], '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  "'": [0x00, 0x00, 0x07, 0x00, 0x00], '(': [0x00, 0x1C, 0x22, 0x41, 0x00], ')': [0x00, 0x41, 0x22, 0x1C, 0x00],
  '=': [0x14, 0x14, 0x14, 0x14, 0x14], '<': [0x08, 0x14, 0x22, 0x41, 0x00], '>': [0x00, 0x41, 0x22, 0x14, 0x08],
  '%': [0x23, 0x13, 0x08, 0x64, 0x62], '*': [0x14, 0x08, 0x3E, 0x08, 0x14],
};

function textWidth(str, s = 1) { return String(str).length * 6 * s - s; }

function drawTextRaw(ctx, str, x, y, color, s) {
  ctx.fillStyle = color;
  let cx = Math.round(x); y = Math.round(y);
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch];
    if (g) for (let col = 0; col < 5; col++) {
      const bits = g[col];
      for (let row = 0; row < 7; row++) if ((bits >> row) & 1) ctx.fillRect(cx + col * s, y + row * s, s, s);
    }
    cx += 6 * s;
  }
}

function drawText(ctx, str, x, y, color = '#fcfcfc', s = 1, shadow = '#000') {
  if (shadow) drawTextRaw(ctx, str, x + s, y + s, shadow, s);
  drawTextRaw(ctx, str, x, y, color, s);
}

function drawTextC(ctx, str, cx, y, color, s = 1, shadow) {
  drawText(ctx, str, cx - textWidth(str, s) / 2, y, color, s, shadow);
}

// ---------------- Tiles (procedural 16x16) ----------------
function tileCanvas(draw, seed) {
  const c = makeCanvas(16, 16), x = c.getContext('2d');
  draw(x, mulberry32(seed));
  return c;
}
function speckle(x, rnd, color, n, size = 1) {
  x.fillStyle = color;
  for (let i = 0; i < n; i++) x.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), size, size);
}
function drawDirt(x, rnd) {
  x.fillStyle = '#9c5c24'; x.fillRect(0, 0, 16, 16);
  speckle(x, rnd, '#6c3810', 14, 2); speckle(x, rnd, '#c07838', 10); speckle(x, rnd, '#7c4418', 12);
}
function drawGrassTop(x, rnd, light, mid, dark) {
  x.fillStyle = mid; x.fillRect(0, 0, 16, 4);
  x.fillStyle = light; x.fillRect(0, 0, 16, 1);
  x.fillStyle = dark;
  for (let i = 0; i < 16; i++) { const d = Math.floor(rnd() * 3); if (d) x.fillRect(i, 4, 1, d); }
  speckle(x, () => rnd() * 0.25, light, 6);
}

function buildTiles() {
  SPR.tile = [];
  SPR.tile[T.DIRT] = tileCanvas(drawDirt, 11);
  SPR.tile[T.GRASS] = tileCanvas((x, r) => { drawDirt(x, r); drawGrassTop(x, r, '#78e048', '#3cb030', '#1c7c20'); }, 12);
  SPR.tile[T.MARKER] = tileCanvas((x, r) => {
    drawDirt(x, r); drawGrassTop(x, r, '#fce070', '#e8b828', '#a87810');
    x.fillStyle = '#e83018'; x.fillRect(7, 0, 2, 2); x.fillStyle = '#fcfcfc'; x.fillRect(4, 8, 2, 1); x.fillRect(10, 11, 2, 1);
  }, 13);
  SPR.tile[T.STONE] = tileCanvas((x, r) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, 16, 16);
    speckle(x, r, '#a8a8a8', 12); speckle(x, r, '#686868', 14);
    x.fillStyle = '#505050';
    for (let k = 0; k < 3; k++) { let px = Math.floor(r() * 16), py = Math.floor(r() * 16); for (let i = 0; i < 5; i++) { x.fillRect(px, py, 1, 1); px += r() < 0.5 ? 1 : 0; py += 1; } }
    x.fillStyle = '#606060'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16);
    x.fillStyle = '#989898'; x.fillRect(0, 0, 16, 1);
  }, 14);
  SPR.tile[T.SEAL] = tileCanvas((x, r) => {
    x.fillStyle = '#3c1060'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#1c0830'; x.fillRect(0, 7, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(7, 0, 1, 7); x.fillRect(3, 8, 1, 7); x.fillRect(12, 8, 1, 7);
    x.fillStyle = '#5c2090'; x.fillRect(0, 0, 7, 1); x.fillRect(8, 0, 8, 1); x.fillRect(0, 8, 3, 1); x.fillRect(4, 8, 8, 1);
    x.fillStyle = '#d040ff'; x.fillRect(2, 2, 1, 3); x.fillRect(3, 2, 2, 1); x.fillRect(3, 4, 2, 1); x.fillRect(10, 2, 1, 3); x.fillRect(6, 10, 3, 1); x.fillRect(7, 11, 1, 2);
  }, 15);
  SPR.tile[T.WALL] = tileCanvas((x, r) => {
    x.fillStyle = '#202024'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#34343c'; x.fillRect(1, 1, 6, 6); x.fillRect(9, 1, 6, 6); x.fillRect(5, 9, 6, 6);
  }, 16);
  SPR.bgDirt = tileCanvas((x, r) => { x.fillStyle = '#3c200c'; x.fillRect(0, 0, 16, 16); speckle(x, r, '#2c1606', 14, 2); speckle(x, r, '#4c2c14', 10); }, 21);
  SPR.bgStone = tileCanvas((x, r) => { x.fillStyle = '#2a2a32'; x.fillRect(0, 0, 16, 16); speckle(x, r, '#202026', 14, 2); speckle(x, r, '#38383f', 10); }, 22);
  SPR.cracks = [1, 2, 3].map(stage => tileCanvas((x, r) => {
    x.fillStyle = 'rgba(0,0,0,0.75)';
    const lines = stage * 2;
    for (let k = 0; k < lines; k++) {
      let px = 8, py = 8, dx = r() < 0.5 ? -1 : 1, dy = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3 + stage * 2; i++) { x.fillRect(px, py, 1, 1); if (r() < 0.6) px += dx; else py += dy; }
    }
  }, 30 + stage));
}

// ---------------- Everything else ----------------
function buildSprites() {
  buildTiles();
  SPR.bob = bobFrames('bob', '1');
  SPR.bobArmor = bobFrames('armor', '1');
  SPR.bob2 = bobFrames('bob2', '2');
  SPR.bob3 = bobFrames('bob3', '3');
  SPR.bobVertical = rot90(canvasOf(11, 5, x => miniText(x, 'BOB', 0, 0, '#c81818')));
  SPR.boss = bossFrames();

  // Bob-bot (sketch "BOB BOT"): stepped block body, round eyes, blue antenna, two block legs.
  // Drawn facing left.
  const bot1 = [
    '.........b......',
    '........kkkk....',
    '........kggk....',
    '........kggk....',
    '....kkkkkggk....',
    '....kwwgwwgk....',
    '....kwkgkwgkkkk.',
    '....kgggggggggk.',
    '.kkkkgggggggggk.',
    '.kgggggkkkggggk.',
    '.kggggk...kgggk.',
    '.kggggk...kgggk.',
    '.kggggk...kgggk.',
    '.kggggk...kgggk.',
    '.kggggk...kkkkk.',
    '.kkkkkk.........',
  ];
  const bot2 = bot1.slice();
  bot2[0] = '..........b.....';
  bot2[14] = '.kkkkkk...kgggk.';
  bot2[15] = '..........kkkkk.';
  SPR.bot = [sprite(bot1), sprite(bot2)].map(c => ({ l: c, r: flipH(c) }));

  const chestBody = [
    '.yyyyyyyyyyyyyy.',
    '.nNnnnnyynnnnNn.',
    '.nNnnnnkknnnnNn.',
    '.nNnnnnnnnnnnNn.',
    '.nNnnnnnnnnnnNn.',
    '.nNnnnnnnnnnnNn.',
    '.nNNNNNNNNNNNNn.',
    '..kkkkkkkkkkkk..',
  ];
  SPR.chest = sprite(['..nnnnnnnnnnnn..', '.nNNNNNNNNNNNNn.', '.nNnnnnnnnnnnNn.', '.nNnnnnnnnnnnNn.', ...chestBody]);
  SPR.chestOpen = sprite(['.nnnnnnnnnnnnnn.', '.nNNNNNNNNNNNNn.', '.nkkkkkkkkkkkkn.', '.nkkkkYYYYkkkkn.', ...chestBody]);

  SPR.heart = sprite(['.rr.rr.', 'rYrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']);
  SPR.heartEmpty = sprite(['.dd.dd.', 'ddddddd', 'ddddddd', '.ddddd.', '..ddd..', '...d...']);
  SPR.shield = sprite(['.kkkkk.', 'kcwccck', 'kcwccck', 'kccccck', 'kCccCck', '.kCCCk.', '..kCk..', '...k...']);
  // mute button: speaker with sound waves, or with a red X when muted
  SPR.soundOn = sprite(['....k......', '...kwk...w.', 'kkkwwk.w..w', 'kwwwwk..w.w', 'kwwwwk..w.w', 'kwwwwk..w.w', 'kkkwwk.w..w', '...kwk...w.', '....k......']);
  SPR.soundOff = sprite(['....k......', '...kwk.....', 'kkkwwkr...r', 'kwwwwk.r.r.', 'kwwwwk..r..', 'kwwwwk.r.r.', 'kkkwwkr...r', '...kwk.....', '....k......']);
  SPR.swordIcon = sprite(['.......w', '......wg', '.....wg.', '....wg..', '.k.wg...', '..kg....', '.nnk....', 'nn..k...']);
  SPR.sword = sprite([
    '..k.............',
    '.nkwwwwwwwwwwww.',
    'nnkggggggggggggw',
    '.nkwwwwwwwwwwww.',
    '..k.............',
  ]);
  SPR.swordL = flipH(SPR.sword);
  SPR.swordUp = flipV(rot90(SPR.sword));
  SPR.swordDown = rot90(SPR.sword);
  SPR.fist = sprite(['.NNNN.', 'NTTTTN', 'NTTTTN', 'NTTTTN', 'NTTTTN', '.NNNN.'], { N: '#7c4818', T: '#f4dcb0' });
  // Shovel held while digging: r/l sideways, down, up. The golden shovel is the same shape in gold.
  const shovelSet = map => {
    const r = sprite(['........ggg.', 'nnnnnnnngggg', 'nnnnnnnnGggg', '........GGG.'], map), down = rot90(r);
    return { r, l: flipH(r), down, up: flipV(down) };
  };
  SPR.plainShovel = shovelSet();
  SPR.goldShovel = shovelSet({ g: 'y', G: '#b07c10' });
  SPR.shovel = SPR.plainShovel.r;
  // Powerup icons (HUD and chest pop): golden spade, green jumping juice, sneaker with lit-up sole
  SPR.goldShovelIcon = sprite(['..y..', '.yYy.', 'yYyyy', 'yyyyD', '.yyD.', '..n..', '..n..', '.nnn.'], { D: '#b07c10' });
  SPR.juice = sprite(['..nn..', '..kk..', '.kwwk.', 'kllllk', 'kwlllk', 'kllllk', 'kLLLLk', '.kkkk.'], { L: '#3cb030' });
  SPR.shoes = sprite(['.kkk....', '.kwwk...', '.kwwwkk.', 'kwwwwwwk', 'krrlcyyk', '.kkkkkk.']);
  const wing = sprite(['.....www', '...wwwww', '.wwwwwwg', 'wwwwwgg.', 'wwwgg...', 'wg......']);
  SPR.wingR = [wing, flipV(wing)];
  SPR.wingL = SPR.wingR.map(flipH);
  // touch control icons
  SPR.iconJump = sprite(['...w...', '..www..', '.wwwww.', 'wwwwwww', '..www..', '..www..', '..www..']);
  SPR.iconPause = sprite(['ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww']);
  SPR.iconDig = rot90(sprite(['........ggg.', 'oooooooogggg', 'ooooooooGggg', '........GGG.']));   // shovel pointing down, light handle
  SPR.iconSwap = sprite(['.....w..', 'wwwwwww.', '.....w..', '........', '..w.....', '.wwwwwww', '..w.....']);
  SPR.iconDpad = sprite(['..ggg..', '..ggg..', 'ggggggg', 'ggggggg', 'ggggggg', '..ggg..', '..ggg..']);
  SPR.potion = sprite(['..kk..', '.kwwk.', '.kwwk.', 'krrrrk', 'krYrrk', 'krrrrk', '.kkkk.']);

  // "BOB" grenade: block letters from the font, red with a black outline
  {
    const glyphs = ['B', 'O', 'B'];
    const W = 19, H = 9;
    const grid = Array.from({ length: H }, () => Array(W).fill('.'));
    glyphs.forEach((ch, gi) => {
      FONT[ch].forEach((bits, col) => {
        for (let row = 0; row < 7; row++) if ((bits >> row) & 1) grid[row + 1][1 + gi * 6 + col] = 'r';
      });
    });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (grid[y + dy] && grid[y + dy][x + dx] === 'r') { grid[y][x] = 'k'; break; }
      }
    }
    for (let x = 0; x < W; x++) if (grid[2][x] === 'r') grid[2][x] = 'y';
    SPR.grenade = sprite(grid.map(r => r.join('')));
  }

  // Background: distant mountains strip + clouds
  {
    const c = makeCanvas(512, 96), x = c.getContext('2d');
    for (let px = 0; px < 512; px++) {
      const hgt = 30 + noise1(px * 0.02, 77) * 50 + noise1(px * 0.07, 78) * 12;
      const top = Math.round(96 - hgt);
      x.fillStyle = '#5a6cc8'; x.fillRect(px, top, 1, 96 - top);
      if (hgt > 70) { x.fillStyle = '#e8f0fc'; x.fillRect(px, top, 1, Math.round((hgt - 70) / 2) + 1); }
    }
    for (let px = 0; px < 512; px++) {
      const hgt = 14 + noise1(px * 0.04, 79) * 30;
      const top = Math.round(96 - hgt);
      x.fillStyle = '#4858a8'; x.fillRect(px, top, 1, 96 - top);
    }
    SPR.mountains = c;
  }
  SPR.cloud = sprite([
    '..........wwww..........',
    '.....wwwwwwwwwww........',
    '...wwwwwwwwwwwwwwww.....',
    '.wwwwwwwwwwwwwwwwwwwww..',
    'wwwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwwwww',
    '.cccwwwwwwwwwwwwwwwwccc.',
    '...cccccccccccccccccc...',
  ], { c: '#c8d8f8' });
}
