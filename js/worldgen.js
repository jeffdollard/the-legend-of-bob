// Deterministic world layout from a seed: surface, hidden tunnels, boss cave + seal,
// chests, Bob 2's mesa, Bob 3's room, enemy spawns.
// Tile lookup = structure override (tunnels, cave, seal, mesa) ?? baseTile (noise terrain).
'use strict';

function sKey(L, x, y) { return y * L.W + x; }

function inNoCave(L, x, y) {
  for (const b of L.noCave) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true;
  return false;
}

function caveValue(L, x, y) {
  return noise2(x * 0.08, y * 0.14, L.seed + 101) * 0.7 + noise2(x * 0.21, y * 0.21, L.seed + 202) * 0.3;
}

// Solid material that would be here ignoring caves/structures (also used to disguise hidden air)
function baseMaterial(L, x, y) {
  const h = L.heights[x];
  if (y === h) return T.GRASS;
  if (y <= h + L.dirtDepth[x]) return T.DIRT;
  return noise2(x * 0.1, y * 0.1, L.seed + 303) > 0.72 ? T.DIRT : T.STONE;
}

function baseTile(L, x, y) {
  if (x <= 0 || x >= L.W - 1) return T.WALL;
  if (y < CFG.SKY_LIMIT) return T.AIR;
  const h = L.heights[x];
  if (y < h) return T.AIR;
  if (y > h + 9 && caveValue(L, x, y) > CFG.CAVE_THRESHOLD && !inNoCave(L, x, y)) return T.AIR;
  return baseMaterial(L, x, y);
}

function layoutTile(L, x, y) {
  const k = sKey(L, x, y);
  return L.structure.has(k) ? L.structure.get(k) : baseTile(L, x, y);
}

function generateLayout(seed) {
  seed = seed >>> 0;
  const W = CFG.WORLD_W;
  const rng = mulberry32(seed ^ 0x9E3779B9);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const L = {
    seed, W,
    heights: new Int32Array(W), dirtDepth: new Int8Array(W),
    structure: new Map(), noCave: [],
    tunnels: [], chests: [], bots: [],
  };
  const S = L.structure;
  const setS = (x, y, t) => { if (x > 0 && x < W - 1) S.set(sKey(L, x, y), t); };

  // ---- Surface ----
  const H = L.heights;
  for (let x = 0; x < W; x++) {
    H[x] = CFG.SURFACE_BASE + Math.round(
      (noise1(x * 0.035, seed + 1) - 0.5) * 14 + (noise1(x * 0.14, seed + 2) - 0.5) * 4);
    L.dirtDepth[x] = 3 + Math.floor(noise1(x * 0.2, seed + 3) * 4);
  }
  const spawnX = W >> 1;
  for (let x = spawnX - 5; x <= spawnX + 5; x++) H[x] = H[spawnX];
  // Keep slopes walkable: neighbouring columns differ by at most 2
  for (let x = spawnX + 6; x < W; x++) H[x] = Math.max(H[x - 1] - 2, Math.min(H[x - 1] + 2, H[x]));
  for (let x = spawnX - 6; x >= 0; x--) H[x] = Math.max(H[x + 1] - 2, Math.min(H[x + 1] + 2, H[x]));
  L.spawn = { x: spawnX, y: H[spawnX] - 1 };
  let minH = Infinity; for (let x = 0; x < W; x++) minH = Math.min(minH, H[x]);
  L.minHeight = minH;

  // ---- Boss cave ----
  const cw = CFG.CAVE_W, ch = CFG.CAVE_H;
  const side = rng() < 0.5 ? -1 : 1;
  let ccx = spawnX + side * ri(50, 100);
  ccx = Math.max(cw + 8, Math.min(W - cw - 8, ccx));
  const top = CFG.SURFACE_BASE + ri(CFG.CAVE_DEPTH_MIN, CFG.CAVE_DEPTH_MAX);
  const cave = {
    x0: ccx - (cw >> 1), y0: top,
    x1: ccx - (cw >> 1) + cw - 1, y1: top + ch - 1,
    cx: ccx,
  };
  cave.floorY = cave.y1 + 1;
  L.cave = cave;
  L.noCave.push({ x0: cave.x0 - 6, y0: cave.y0 - 6, x1: cave.x1 + 6, y1: cave.floorY + 6 });

  // ---- Tunnel entrances ----
  const caveL = cave.x0 - 2 - 16, caveR = cave.x1 + 2 + 16;
  const entrances = [];
  for (let tries = 0; tries < 400 && entrances.length < CFG.TUNNELS_TARGET; tries++) {
    const x = ri(8, W - 10);
    if (x >= caveL && x <= caveR) continue;
    if (Math.abs(x - spawnX) < 12) continue;
    if (entrances.some(e => Math.abs(e - x) < 36)) continue;
    if (H[x] !== H[x + 1]) continue;
    entrances.push(x);
  }
  entrances.sort((a, b) => a - b);

  // Doors: tunnels finish right outside the seal ring at one of three doors
  const doors = {
    left: { gx: cave.x0 - 4, gy: cave.floorY - 1,
      cells: [[cave.x0 - 2, cave.floorY - 2], [cave.x0 - 1, cave.floorY - 2], [cave.x0 - 2, cave.floorY - 1], [cave.x0 - 1, cave.floorY - 1]] },
    right: { gx: cave.x1 + 3, gy: cave.floorY - 1,
      cells: [[cave.x1 + 1, cave.floorY - 2], [cave.x1 + 2, cave.floorY - 2], [cave.x1 + 1, cave.floorY - 1], [cave.x1 + 2, cave.floorY - 1]] },
    top: { gx: ccx, gy: cave.y0 - 3,
      cells: [[ccx, cave.y0 - 2], [ccx + 1, cave.y0 - 2], [ccx, cave.y0 - 1], [ccx + 1, cave.y0 - 1]] },
  };
  let topIdx = -1;
  if (entrances.length >= 4) {
    let best = Infinity;
    entrances.forEach((x, i) => { const d = Math.abs(x - ccx); if (d < best) { best = d; topIdx = i; } });
  }

  // ---- Tunnel paths ----
  // Each tunnel is a chain of points; a 2x2 brush is carved at every point (cells x..x+1, y-1..y).
  // A later tunnel that touches an earlier one merges into it (stops) instead of crossing it,
  // so drop shafts never cut through another tunnel's floor.
  const tunnelAir = new Set();          // carved cells of finished tunnels
  const tunnelZone = new Map();         // carved cells + their floors -> tunnel index
  function touches(x, y) {
    for (let dx = 0; dx <= 1; dx++) for (let dy = -1; dy <= 0; dy++) {
      const t = tunnelZone.get(sKey(L, x + dx, y + dy));
      if (t !== undefined) return t;
    }
    return -1;
  }
  function makePath(pts, gx, gy) {
    let { x, y } = pts[pts.length - 1];
    let merged = -1;
    const push = () => { pts.push({ x, y }); if (merged < 0) merged = touches(x, y); return merged >= 0; };
    const stayBuried = () => { while (y < H[x] + 5 && y < gy) { y++; if (push()) return true; } return false; };
    let guard = 0;
    while ((x !== gx || y !== gy) && merged < 0 && guard++ < 6000) {
      const dir = Math.sign(gx - x), remY = gy - y;
      if (remY <= 0) { x += dir; push(); continue; }
      if (dir === 0) { y++; push(); continue; }
      const r = rng();
      if (r < 0.42) {                        // horizontal run
        const n = ri(3, 9);
        for (let i = 0; i < n && x !== gx; i++) { x += dir; if (push() || stayBuried()) break; }
      } else if (r < 0.85) {                 // diagonal slope (walkable staircase)
        const n = Math.min(ri(2, 6), remY);
        for (let i = 0; i < n; i++) { if (x !== gx) x += dir; y++; if (push() || stayBuried()) break; }
      } else {                               // short drop
        const n = Math.min(ri(2, 4), remY);
        for (let i = 0; i < n; i++) { y++; if (push()) break; }
      }
    }
    return merged;
  }

  entrances.forEach((ex, i) => {
    const hh = H[ex];
    let doorName;
    if (i === topIdx) doorName = 'top';
    else doorName = ex < ccx ? 'left' : 'right';
    const door = doors[doorName];
    const pts = [{ x: ex, y: hh + 3 }, { x: ex, y: hh + 4 }, { x: ex, y: hh + 5 }];
    const merged = makePath(pts, door.gx, door.gy);
    if (merged >= 0) doorName = L.tunnels[merged].door;
    const idx = L.tunnels.length;
    for (const p of pts) {
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = -1; dy <= 0; dy++) {
          const k = sKey(L, p.x + dx, p.y + dy);
          setS(p.x + dx, p.y + dy, T.AIR);
          tunnelAir.add(k); tunnelZone.set(k, idx);
        }
      }
    }
    for (const p of pts) for (let dx = 0; dx <= 1; dx++) {
      const k = sKey(L, p.x + dx, p.y + 1);
      if (!tunnelZone.has(k)) tunnelZone.set(k, idx);
    }
    // Entrance: covered by marker "golden grass" + one dirt row, found by digging
    setS(ex, hh, T.MARKER); setS(ex + 1, hh, T.MARKER);
    setS(ex, hh + 1, T.DIRT); setS(ex + 1, hh + 1, T.DIRT);
    L.tunnels.push({ entrance: { x: ex, y: hh }, door: doorName, mergedInto: merged, pts });
  });
  // Where a tunnel crosses a noise cave, give it a stone floor so it stays walkable
  for (const t of L.tunnels) for (const p of t.pts) for (let dx = 0; dx <= 1; dx++) {
    const x = p.x + dx, y = p.y + 1;
    if (!tunnelAir.has(sKey(L, x, y)) && baseTile(L, x, y) === T.AIR) setS(x, y, T.STONE);
  }

  // Flat stretches of tunnel: good spots for chests, bots, Bob 3
  function flatSpots(t) {
    const out = [];
    const pts = t.pts;
    for (let i = 12; i < pts.length - 6; i++) {
      const a = pts[i - 1], p = pts[i], b = pts[i + 1];
      if (a.y === p.y && b.y === p.y && a.x !== p.x && b.x !== p.x) out.push({ i, x: p.x, y: p.y });
    }
    return out;
  }

  // ---- Bob 3's room ----
  if (L.tunnels.length) {
    const t = L.tunnels[ri(0, L.tunnels.length - 1)];
    const spots = flatSpots(t);
    const n = t.pts.length;
    let pick = spots.filter(s => s.i > n * 0.45 && s.i < n * 0.75);
    if (!pick.length) pick = spots;
    let spot = pick.length ? pick[ri(0, pick.length - 1)] : { x: t.pts[n >> 1].x, y: t.pts[n >> 1].y };
    // carve a small room with a floor (floor only where the tunnel isn't passing through)
    for (let x = spot.x - 2; x <= spot.x + 3; x++) {
      for (let y = spot.y - 2; y <= spot.y; y++) setS(x, y, T.AIR);
      if (!tunnelAir.has(sKey(L, x, spot.y + 1))) setS(x, spot.y + 1, T.STONE);
    }
    L.bob3 = { x: spot.x, y: spot.y, tunnel: L.tunnels.indexOf(t) };
  }

  // ---- Boss cave interior + seal ring ----
  for (let y = cave.y0; y <= cave.y1; y++) for (let x = cave.x0; x <= cave.x1; x++) setS(x, y, T.AIR);
  L.seal = { ring: [], doors: [] };
  const doorSet = new Set();
  for (const d of new Set(L.tunnels.map(t => t.door))) for (const [x, y] of doors[d].cells) doorSet.add(sKey(L, x, y));
  for (let y = cave.y0 - 2; y <= cave.floorY + 1; y++) {
    for (let x = cave.x0 - 2; x <= cave.x1 + 2; x++) {
      if (x >= cave.x0 && x <= cave.x1 && y >= cave.y0 && y <= cave.y1) continue;
      setS(x, y, T.SEAL);
      (doorSet.has(sKey(L, x, y)) ? L.seal.doors : L.seal.ring).push([x, y]);
    }
  }
  L.boss = { x: ccx, y: cave.y1 };

  // ---- Bob 2's mesa (out of jump reach: build stairs or dig up) ----
  let mx = -1;
  for (let tries = 0; tries < 400; tries++) {
    const x = ri(12, W - 14);
    if (Math.abs(x - spawnX) < 45) continue;
    if (entrances.some(e => Math.abs(e - x) < 10)) continue;
    mx = x; break;
  }
  if (mx < 0) mx = spawnX > W / 2 ? 20 : W - 22;
  let localMin = Infinity;
  for (let x = mx - 6; x <= mx + 6; x++) localMin = Math.min(localMin, H[x]);
  const mesaTop = localMin - 4;
  for (let x = mx - 2; x <= mx + 2; x++) for (let y = mesaTop; y < H[x]; y++) setS(x, y, y === mesaTop ? T.GRASS : T.STONE);
  L.mesa = { x0: mx - 2, x1: mx + 2, top: mesaTop };
  L.bob2 = { x: mx, y: mesaTop - 1 };

  // ---- Chests & tunnel bots (validated against final tiles) ----
  const used = [];
  const farFromUsed = (x, y, d) => used.every(u => Math.abs(u.x - x) + Math.abs(u.y - y) >= d);
  const standable = (x, y) => !SOLID[layoutTile(L, x, y)] && SOLID[layoutTile(L, x, y + 1)];
  if (L.bob3) used.push(L.bob3);
  for (const t of L.tunnels) {
    const spots = flatSpots(t).filter(s => standable(s.x, s.y));
    for (let i = spots.length - 1; i > 0; i--) { const j = ri(0, i); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    let chests = 0, bots = 0;
    for (const s of spots) {
      if (chests < CFG.CHESTS_PER_TUNNEL && farFromUsed(s.x, s.y, 8)) {
        L.chests.push({ x: s.x, y: s.y, item: 'health' });
        used.push(s); chests++;
      } else if (bots < CFG.TUNNEL_BOTS && farFromUsed(s.x, s.y, 6)) {
        L.bots.push({ x: s.x, y: s.y });
        used.push(s); bots++;
      }
    }
  }
  // Contents: CHEST_ITEMS in priority order, shuffled across chests; the rest are health
  const order = L.chests.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = ri(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  order.forEach((ci, n) => { L.chests[ci].item = CHEST_ITEMS[n] || 'health'; });

  // ---- Surface bots ----
  for (let n = 0, tries = 0; n < CFG.SURFACE_BOTS && tries < 500; tries++) {
    const x = ri(4, W - 5);
    if (Math.abs(x - spawnX) < 16) continue;
    if (x >= L.mesa.x0 - 3 && x <= L.mesa.x1 + 3) continue;
    if (L.bots.some(b => b.y < CFG.SURFACE_BASE + 12 && Math.abs(b.x - x) < 10)) continue;
    L.bots.push({ x, y: H[x] - 1 });
    n++;
  }
  return L;
}
