// node tools/test-worldgen.js [seedCount]
// Checks, for many seeds, that generated worlds are playable:
//  - 3+ tunnels; each one leads from its (dug-open) entrance to its seal door
//  - Bob 3 and every chest are reachable through the tunnels
//  - the seal fully encloses the boss cave; after unsealing, the cave is reachable
//  - Bob 2's mesa is taller than a jump
// Reachability models Bob as a 1x2 agent that can fall, walk, and climb ledges up to 2 tiles.
'use strict';
const { loadGame } = require('./load');
const G = loadGame(['config.js', 'rng.js', 'worldgen.js', 'world.js'],
  ['T', 'SOLID', 'CFG', 'generateLayout', 'World']);
const { T, CFG, generateLayout, World } = G;

function reach(world, sx, sy, bounds) {
  const solid = (x, y) => world.solid(x, y);
  const free = (x, y) => !solid(x, y) && !solid(x, y - 1);
  const key = (x, y) => y * 100000 + x;
  const seen = new Set([key(sx, sy)]);
  const q = [[sx, sy]];
  const push = (x, y) => {
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) return;
    const k = key(x, y);
    if (seen.has(k) || !free(x, y)) return;
    seen.add(k); q.push([x, y]);
  };
  while (q.length) {
    const [x, y] = q.shift();
    if (!solid(x, y + 1)) {               // falling (with a little air control)
      push(x, y + 1); push(x - 1, y + 1); push(x + 1, y + 1);
      continue;
    }
    for (const d of [-1, 1]) {
      push(x + d, y);
      if (!solid(x, y - 2)) push(x + d, y - 1);
      if (!solid(x, y - 2) && !solid(x, y - 3)) push(x + d, y - 2);
    }
  }
  return { has: (x, y) => seen.has(key(x, y)), size: seen.size };
}

const N = parseInt(process.argv[2] || '20', 10);
let failures = 0;
const stats = { tunnels: 0, chests: 0, bots: 0, caveFrac: 0, pathLen: 0 };

for (let s = 1; s <= N; s++) {
  const seed = s * 7919;
  const L = generateLayout(seed);
  const errs = [];
  const c = L.cave;
  const bounds = { x0: 1, x1: L.W - 2, y0: CFG.SKY_LIMIT, y1: c.floorY + 4 };

  if (L.tunnels.length < 3) errs.push(`only ${L.tunnels.length} tunnels`);

  // Dig open every entrance cover (marker + one dirt row)
  const world = new World(L);
  for (const t of L.tunnels) {
    const { x, y } = t.entrance;
    for (const dx of [0, 1]) for (const dy of [0, 1]) world.set(x + dx, y + dy, T.AIR);
  }

  // Each tunnel reaches its door from its entrance
  const reached = [];
  for (const t of L.tunnels) {
    const r = reach(world, t.entrance.x, t.entrance.y - 1, bounds);
    reached.push(r);
    const g = t.door === 'left' ? [c.x0 - 3, c.floorY - 1]
      : t.door === 'right' ? [c.x1 + 3, c.floorY - 1] : [c.cx, c.y0 - 3];
    if (!r.has(g[0], g[1])) errs.push(`tunnel@${t.entrance.x} (${t.door}) does not reach its door`);
    stats.pathLen += t.pts.length;
  }
  const anyReach = (x, y) => reached.some(r => r.has(x, y));
  if (!L.bob3) errs.push('no Bob 3');
  else if (!anyReach(L.bob3.x, L.bob3.y)) errs.push(`Bob 3 @${L.bob3.x},${L.bob3.y} unreachable`);
  L.chests.forEach(ch => { if (!anyReach(ch.x, ch.y)) errs.push(`chest(${ch.item}) @${ch.x},${ch.y} unreachable`); });
  if (!L.chests.some(ch => ch.item === 'sword')) errs.push('no sword chest');

  // Seal encloses the cave: open-air flood from the cave interior stays inside it
  const inside = reach(world, c.cx, c.y1, { x0: c.x0 - 10, x1: c.x1 + 10, y0: c.y0 - 10, y1: c.floorY + 10 });
  for (let x = c.x0 - 10; x <= c.x1 + 10; x++) for (let y = c.y0 - 10; y <= c.floorY + 10; y++) {
    if (inside.has(x, y) && (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1)) { errs.push('seal leaks'); x = 1e9; break; }
  }

  // After unsealing, the cave floor is reachable from the tunnels
  world.unseal();
  const after = L.tunnels.map(t => reach(world, t.entrance.x, t.entrance.y - 1, bounds));
  if (!after.some(r => r.has(c.cx, c.y1))) errs.push('cave unreachable after unseal');

  // Bob 2 mesa height vs neighbours
  const m = L.mesa;
  for (const x of [m.x0 - 1, m.x1 + 1]) {
    if (L.heights[x] - m.top < 3) errs.push(`mesa only ${L.heights[x] - m.top} tiles above column ${x}`);
  }

  // Cave density sample
  let air = 0, tot = 0;
  for (let y = CFG.SURFACE_BASE + 20; y < CFG.SURFACE_BASE + 150; y += 2)
    for (let x = 2; x < L.W - 2; x += 2) { tot++; if (G.SOLID[world.get(x, y)] === false) air++; }
  stats.caveFrac += air / tot;
  stats.tunnels += L.tunnels.length; stats.chests += L.chests.length; stats.bots += L.bots.length;

  if (errs.length) { failures++; console.log(`seed ${seed}: FAIL\n  ` + errs.join('\n  ')); }
}

console.log(`\n${N - failures}/${N} seeds OK`);
console.log(`avg tunnels ${(stats.tunnels / N).toFixed(1)}, chests ${(stats.chests / N).toFixed(1)}, bots ${(stats.bots / N).toFixed(1)}, ` +
  `tunnel length ${(stats.pathLen / stats.tunnels).toFixed(0)} cells, underground air ${(100 * stats.caveFrac / N).toFixed(1)}%`);
process.exit(failures ? 1 : 0);
