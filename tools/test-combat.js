// node tools/test-combat.js
// Checks punch rules against the real Boss/BobBot/Player code:
//  ground punch misses the boss's weak spot, jump-punch / uppercut-from-below hit it,
//  sword doubles damage, 10 HP boss, bot dies in 1 punch, damage + armor math.
'use strict';
const { loadGame } = require('./load');
const G = loadGame(
  ['config.js', 'rng.js', 'worldgen.js', 'world.js', 'physics.js', 'input.js', 'player.js', 'enemies.js', 'boss.js', 'entities.js', 'game.js'],
  ['T', 'TILE', 'CFG', 'generateLayout', 'World', 'Player', 'Boss', 'BobBot', 'Input', 'Game', 'Particles']);
const { T, TILE, CFG, generateLayout, World, Player, Boss, BobBot, Input, Game } = G;
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

function setup() {
  const L = generateLayout(4242);
  const g = Object.create(Game);
  Object.assign(g, {
    layout: L, world: new World(L), bots: [], grenades: [], particles: new G.Particles(), toasts: [],
    stats: { dug: 0, placed: 0, bots: 0, frames: 0 }, rescued: { 2: true, 3: true }, god: false, shake: 0, input: Input,
  });
  g.sfx = () => {};
  g.world.unseal();
  g.boss = new Boss(L);
  g.boss.awake = true;
  const c = L.cave;
  g.player = new Player(c.cx - 3, c.y1);
  return g;
}
function punch(g, dir, opts = {}) {
  const p = g.player;
  p.punch = { t: 5, dir, hit: new Set() };
  if (opts.sword) p.sword = true;
  const dmg = p.sword ? CFG.SWORD_DMG : CFG.PUNCH_DMG;
  const before = g.boss.hp;
  g.boss.iframes = 0;
  g.resolvePunch(p, p.punchBox(), dmg);
  return before - g.boss.hp;
}
// Put Bob right next to the boss (facing it), feet `lift` px above the floor
function besideBoss(g, gap, lift = 0) {
  const p = g.player, b = g.boss;
  p.facing = 1;
  p.x = b.x - gap - p.w;
  p.y = b.y + b.h - p.h - lift;
}

{
  // weak spot = glowing core in the arch between his legs
  const g = setup();
  g.boss.update = () => {};
  besideBoss(g, 8, 0);
  check(punch(g, 'side') === 0, 'ground punch from 8px away misses the core between his legs');
  besideBoss(g, 1, 0);
  check(punch(g, 'side') === 1, 'point-blank ground punch reaches between his legs: 1 damage');
  besideBoss(g, 1, 14);
  check(punch(g, 'side') === 0, 'jump punch to his chest does no damage (only the core counts)');
  besideBoss(g, 10, 0);
  check(punch(g, 'side', { sword: true }) === 2, 'sword from 10px away reaches the core: 2 damage');
}
{
  const g = setup();
  const p = g.player, b = g.boss;
  // boss mid-jump directly above Bob, Bob jumping with an uppercut
  p.x = b.x + (b.w - p.w) / 2; p.y = b.y + b.h - p.h;
  b.y -= 40;  // boss feet 40px up
  p.y -= 10;
  check(punch(g, 'up') === 1, 'uppercut from below hits the weak spot while boss is overhead');
  p.punch = { t: 5, dir: 'up', hit: new Set() };
}
{
  const g = setup();
  g.boss.update = () => {};
  g.player.sword = true;
  let hits = 0;
  while (g.boss.hp > 0 && hits < 40) { besideBoss(g, 4, 0); punch(g, 'side'); hits++; }
  check(hits === CFG.BOSS_HP / CFG.SWORD_DMG && g.boss.dying > 0, `sword kills the ${CFG.BOSS_HP} HP boss in ${hits} hits`);
}
{
  const g = setup();
  const p = g.player;
  const bot = new BobBot(Math.floor((p.x + p.w) / TILE) + 1, Math.floor((p.y + p.h - 1) / TILE));
  bot.x = p.x + p.w + 4; bot.y = p.y + p.h - bot.h;
  g.bots = [bot];
  p.facing = 1; p.punch = { t: 5, dir: 'side', hit: new Set() };
  g.resolvePunch(p, p.punchBox(), 1);
  check(bot.dead, 'one punch destroys a bob-bot');
}
{
  const g = setup();
  const p = g.player;
  p.hurt(CFG.DMG_BOT, p.cx + 10, g);
  check(p.health === 10, `bob-bot hit = half heart (health ${p.health}/12 quarters)`);
  p.iframes = 0; p.armor = CFG.ARMOR_HITS;
  p.hurt(CFG.DMG_GRENADE, p.cx + 10, g);
  check(p.health === 8 && p.armor === 9, `armored grenade hit = half heart instead of 1 (health ${p.health}, armor ${p.armor})`);
  for (let i = 0; i < 9; i++) { p.iframes = 0; p.health = 12; p.hurt(CFG.DMG_BOT, p.cx, g); }
  check(p.armor === 0, 'armor breaks after 10 hits');
}

console.log(fails ? `\n${fails} FAILED` : '\nall combat checks passed');
process.exit(fails ? 1 : 0);
