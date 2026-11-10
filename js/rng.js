// Seeded randomness and value noise. Everything in world generation derives from these.
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic hash of an integer lattice point -> [0, 1)
function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function noise1(x, s) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, 0, s), b = hash2(i + 1, 0, s);
  return a + (b - a) * smoothstep(f);
}

function noise2(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const u = smoothstep(x - ix), v = smoothstep(y - iy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
