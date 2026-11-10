// node tools/test-physics.js
// Runs the real Player code against a test platform and checks:
//  jump apex (full = 2.5 blocks), short hop, 2-block ledge climbable / 3-block not,
//  dig down a 1-wide shaft, dig sideways (2 rows), place stairs, pillar up, bridge.
'use strict';
const { loadGame } = require('./load');
const G = loadGame(['config.js', 'rng.js', 'worldgen.js', 'world.js', 'physics.js', 'input.js', 'player.js'],
  ['T', 'TILE', 'CFG', 'generateLayout', 'World', 'Player', 'Input']);
const { T, TILE, generateLayout, World, Player, Input } = G;

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

// Test arena high in the sky: floor at row -20, x 10..80
function arena() {
  const w = new World(generateLayout(1));
  for (let x = 10; x <= 80; x++) for (let y = -20; y <= -10; y++) w.set(x, y, T.DIRT);
  for (let x = 9; x <= 81; x++) for (let y = -40; y < -20; y++) w.set(x, y, T.AIR);
  return w;
}
function fakeGame(world) {
  return { world, input: Input, god: false, stats: { dug: 0, placed: 0 },
    toast() {}, burst() {}, sfx() {}, blockedByEntity: () => false, resolvePunch: () => false };
}
function run(p, g, frames, held = {}) {
  for (let i = 0; i < frames; i++) {
    Input.clear();
    for (const k of Object.keys(held)) if (held[k]) Input.hold(k, true);
    Input.beginStep();
    p.update(g);
  }
}
function settle(p, g) { Input.clear(); run(p, g, 30); }

// ---- Jump height ----
{
  const g = fakeGame(arena());
  const p = new Player(20, -21); settle(p, g);
  const ground = p.y + p.h;
  let minBottom = ground;
  Input.clear(); Input.tap('jump'); Input.hold('jump', true);
  for (let i = 0; i < 60; i++) { Input.beginStep(); Input.held.jump = true; p.update(g); minBottom = Math.min(minBottom, p.y + p.h); }
  const apex = ground - minBottom;
  check(Math.abs(apex - 40) <= 1.5, `full jump apex ${apex.toFixed(1)}px (target 40 = 2.5 blocks)`);

  settle(p, g);
  minBottom = p.y + p.h;
  Input.clear(); Input.tap('jump');
  for (let i = 0; i < 60; i++) { Input.beginStep(); p.update(g); minBottom = Math.min(minBottom, p.y + p.h); }
  const hop = ground - minBottom;
  check(hop < 20 && hop > 5, `tap jump apex ${hop.toFixed(1)}px (short hop)`);
}

// ---- Ledges: 2 blocks climbable, 3 not ----
for (const [hgt, expect] of [[2, true], [3, false]]) {
  const w = arena();
  for (let x = 30; x <= 40; x++) for (let k = 1; k <= hgt; k++) w.set(x, -20 - k, T.STONE);
  const g = fakeGame(w);
  const p = new Player(25, -21); settle(p, g);
  for (let i = 0; i < 120; i++) {
    Input.clear(); Input.hold('right', true);
    if (i % 40 === 5) Input.tap('jump');
    Input.held.jump = true;
    Input.beginStep(); p.update(g);
  }
  const onTop = p.x > 30 * TILE && p.y + p.h <= (-20 - hgt) * TILE + 0.5;
  check(onTop === expect, `${hgt}-block ledge ${expect ? 'climbable' : 'NOT climbable'} (onTop=${onTop})`);
}

// ---- Dig down a 1-wide shaft (from an off-center start) ----
{
  const g = fakeGame(arena());
  const p = new Player(20, -21); settle(p, g);
  p.x += 5; settle(p, g);   // straddle two columns
  run(p, g, 200, { dig: true, down: true });
  const depth = Math.floor((p.y + p.h - 1) / TILE) - (-21);
  check(depth >= 6, `dug down ${depth} tiles in 200 frames, inventory dirt=${p.inv.dirt}`);
  check(p.inv.dirt === g.stats.dug, 'every dug block went to inventory');
}

// ---- Dig sideways clears both body rows ----
{
  const w = arena();
  for (let y = -22; y <= -21; y++) w.set(24, y, T.STONE);
  const g = fakeGame(w);
  const p = new Player(22, -21); settle(p, g); p.facing = 1;
  run(p, g, 60, { dig: true, right: true });
  check(!w.solid(24, -21) && !w.solid(24, -22) && p.inv.stone === 2, `side dig cleared 2 rows, stone=${p.inv.stone}`);
  run(p, g, 40, { right: true });
  check(p.x > 24 * TILE, 'walked into the dug hole');
}

// ---- Place: stairs, pillar, bridge ----
{
  const w = arena();
  const g = fakeGame(w);
  const p = new Player(20, -21); settle(p, g); p.inv.dirt = 10; p.facing = 1;
  Input.clear(); Input.tap('place'); Input.beginStep(); p.update(g);
  check(w.get(21, -21) === T.DIRT, 'E places a step in front at foot level');

  // pillar: jump then place below at apex
  const p2 = new Player(40, -21); settle(p2, g); p2.inv.dirt = 10;
  Input.clear(); Input.tap('jump'); Input.held.jump = true;
  for (let i = 0; i < 18; i++) { Input.beginStep(); Input.held.jump = true; p2.update(g); }
  Input.clear(); Input.hold('down', true); Input._queued.place = true; Input.beginStep(); p2.update(g);
  settle(p2, g);
  check(w.get(40, -21) === T.DIRT && p2.y + p2.h <= -21 * TILE + 0.5, 'jump + down+E builds a pillar under Bob');

  // bridge: at a ledge edge, down+E places at ground level in front
  for (let y = -20; y <= -10; y++) w.set(61, y, T.AIR);
  const p3 = new Player(60, -21); settle(p3, g); p3.inv.dirt = 5; p3.facing = 1;
  Input.clear(); Input.hold('down', true); Input._queued.place = true; Input.beginStep(); p3.update(g);
  check(w.get(61, -20) === T.DIRT, 'down+E on ground bridges the gap in front');
}

// ---- Climbing ----
const surfaceFeet = -20 * TILE;
const onSurface = p => p.onGround && Math.abs(p.y + p.h - surfaceFeet) < 0.5;

// 1) dig down a 1-wide shaft, then hold ↑ to climb back out
{
  const g = fakeGame(arena());
  const p = new Player(20, -21); settle(p, g);
  run(p, g, 70, { dig: true, down: true });
  const depth = Math.floor((p.y + p.h - 1) / TILE) - (-21);
  run(p, g, 240, { up: true, right: true });
  check(depth >= 4 && onSurface(p), `climbed out of a ${depth}-deep dug shaft (on surface: ${onSurface(p)})`);
}
// 2) dig-climb: sealed pocket underground, hold ↑+D to tunnel up to the surface
{
  const w = arena();
  for (let x = 30; x <= 33; x++) for (let y = -14; y <= -13; y++) w.set(x, y, T.AIR);
  const g = fakeGame(w);
  const p = new Player(31, -13); settle(p, g);
  run(p, g, 320, { up: true, dig: true });
  const top = p.y + p.h;
  run(p, g, 60, { up: true, right: true });
  check(onSurface(p), `↑+D tunnels up 6 blocks and hops out (feet ${(top / TILE).toFixed(1)} -> surface ${onSurface(p)})`);
}
// 3) the reported case: 2-tall tunnel with a 1-wide shaft up to the surface, 3 blocks above the floor
{
  const w = arena();
  for (let x = 20; x <= 40; x++) for (let y = -15; y <= -14; y++) w.set(x, y, T.AIR);
  for (let y = -20; y <= -16; y++) w.set(30, y, T.AIR);
  w.set(30, -13, T.AIR);   // the 1-deep pit under the shaft
  const g = fakeGame(w);
  const p = new Player(25, -14); settle(p, g);
  run(p, g, 300, { up: true, right: true });
  check(onSurface(p), `walk under the shaft holding ↑ -> climb out (tile ${p.tileX()},${p.tileY()})`);
}
// 4) climbing does not grab 2-wide shafts (those need building)
{
  const w = arena();
  for (let x = 30; x <= 31; x++) for (let y = -20; y <= -14; y++) w.set(x, y, T.AIR);
  const g = fakeGame(w);
  const p = new Player(30, -14); settle(p, g);
  run(p, g, 120, { up: true });
  check(p.tileY() === -14, '2-wide shaft is not climbable');
}

console.log(fails ? `\n${fails} FAILED` : '\nall physics checks passed');
process.exit(fails ? 1 : 0);
