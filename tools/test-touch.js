// node tools/test-touch.js
// Touch controls: layout at phone/tablet sizes (in bounds, no overlaps, finger-sized, clear of the HUD),
// hit-testing (a touch on a control's face picks that control), d-pad direction wedges,
// and the Input bridge (one press per button-down, multi-touch combos, keyboard not clobbered, menu taps).
'use strict';
const { loadGame } = require('./load');
const G = loadGame(['config.js', 'input.js', 'touch.js'], ['TOUCH', 'UI_W', 'UI_H', 'Input', 'Touch']);
const { TOUCH, UI_W, UI_H, Input, Touch } = G;

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`FAIL  ${msg}`); fails++; } return ok; };
const pass = (msg) => console.log(`PASS  ${msg}`);

// Same math as Game.fit()
function fit(W, H) {
  const s = Math.min(W / UI_W, H / UI_H);
  const vw = Math.max(UI_W, Math.round(W / s)), vh = Math.max(UI_H, Math.round(H / s));
  return { vw, vh, scale: W / vw };
}

const SIZES = [
  ['iPhone landscape', 844, 390], ['iPhone landscape, Safari bars', 750, 340], ['iPhone SE landscape', 667, 320],
  ['Android landscape', 915, 412], ['iPhone portrait', 390, 664], ['iPhone portrait, full', 390, 844],
  ['small portrait', 320, 480], ['iPad landscape', 1024, 700], ['iPad portrait', 768, 954], ['iPad Pro', 1366, 980],
];

const game = { state: 'play', toggleMute() { this.muted = !this.muted; } };

// Detection: not a mobile device (no matchMedia here, like a desktop): off, and a touch doesn't turn it on
Touch.init(game, false);
Touch.enable();
if (check(!Touch.enabled, 'non-mobile: touch does not show the overlay')) pass('non-mobile: overlay stays off after a touch');

Touch.init(game, true);

for (const [name, W, H] of SIZES) {
  const { vw, vh, scale } = fit(W, H);
  Touch.layout(vw, vh, scale);
  const L = Touch.L;
  const circles = [{ name: 'dpad', ...L.dpad }, ...L.buttons];
  let ok = true;
  for (const c of circles) {
    ok &= check(c.x - c.r >= 0 && c.x + c.r <= vw && c.y + c.r <= vh, `${name}: ${c.name} inside the view`);
    ok &= check(c.y - c.r >= TOUCH.TOP_CLEAR, `${name}: ${c.name} clear of the HUD (top ${(c.y - c.r).toFixed(0)})`);
    ok &= check(c.y - c.r >= L.pause.y + L.pause.h, `${name}: ${c.name} below the pause button`);
  }
  for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
    const a = circles[i], b = circles[j];
    ok &= check(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, `${name}: ${a.name} and ${b.name} don't overlap`);
  }
  for (const b of L.buttons) {
    const min = b.name === 'switch' ? 34 : 44;
    ok &= check(2 * b.r * scale >= min, `${name}: ${b.name} is ${(2 * b.r * scale).toFixed(0)} CSS px across (min ${min})`);
  }
  ok &= check(2 * L.dpad.r * scale >= 100, `${name}: d-pad is ${(2 * L.dpad.r * scale).toFixed(0)} CSS px across`);
  // Every point on a control's face picks that control
  for (const c of circles) {
    for (let k = 0; k < 24; k++) for (const f of [0.3, 0.95]) {
      const a = k / 24 * Math.PI * 2, x = c.x + Math.cos(a) * c.r * f, y = c.y + Math.sin(a) * c.r * f;
      const hit = Touch.hitControl(x, y);
      ok &= check(c.name === 'dpad' ? hit === 'dpad' : hit && hit.name === c.name, `${name}: touch on ${c.name}'s face picks it`);
    }
  }
  if (ok) pass(`${name} (${W}x${H} -> view ${vw}x${vh}, d-pad ${(2 * L.dpad.r * scale).toFixed(0)}px, buttons ${(2 * L.buttons[0].r * scale).toFixed(0)}px)`);
}

// D-pad wedges: wide cardinals, narrow diagonals, dead center
{
  const r = 40, dirs = (deg, f = 0.8) => {
    const a = deg * Math.PI / 180, o = Touch.dpadDirs(Math.cos(a) * r * f, -Math.sin(a) * r * f, r);
    return Object.keys(o).sort().join('+') || 'none';
  };
  const cases = [[0, 'right'], [25, 'right'], [34, 'right'], [45, 'right+up'], [55, 'right+up'], [65, 'up'], [90, 'up'],
    [180, 'left'], [150, 'left'], [135, 'left+up'], [225, 'down+left'], [270, 'down'], [295, 'down'], [310, 'down+right'], [330, 'right']];
  let ok = true;
  for (const [deg, want] of cases) ok &= check(dirs(deg) === want, `d-pad at ${deg} deg -> ${dirs(deg)}, want ${want}`);
  ok &= check(dirs(45, 0.1) === 'none', 'd-pad dead zone');
  ok &= check(dirs(0, 3) === 'right', 'd-pad still reads past its edge');
  if (ok) pass('d-pad wedges and dead zone');
}

// Input bridge
{
  const { vw, vh, scale } = fit(844, 390);
  Touch.layout(vw, vh, scale);
  const L = Touch.L, btn = (n) => L.buttons.find(b => b.name === n);
  const step = () => Input.beginStep();
  Input.clear(); Touch.reset(); game.state = 'play';
  let ok = true;

  Touch.down(1, btn('jump').x, btn('jump').y); step();
  ok &= check(Input.pressed('jump') && Input.down('jump'), 'jump: press edge + held');
  step();
  ok &= check(!Input.pressed('jump') && Input.down('jump'), 'jump: edge fires once while held');
  Touch.down(2, btn('jump').x + 2, btn('jump').y); step();
  ok &= check(!Input.pressed('jump'), 'second finger on a held button: no second press');
  Touch.up(2); Touch.up(1); step();
  ok &= check(!Input.down('jump'), 'jump released');

  // combo: d-pad up + DIG held together
  Touch.down(3, L.dpad.x, L.dpad.y - L.dpad.r * 0.8);
  Touch.down(4, btn('dig').x, btn('dig').y); step();
  ok &= check(Input.down('up') && Input.down('dig') && !Input.down('left') && !Input.down('right'), 'up + dig held together');
  // roll the button thumb from DIG onto PLACE
  Touch.move(4, btn('place').x, btn('place').y); step();
  ok &= check(!Input.down('dig') && Input.down('place') && Input.pressed('place'), 'rolling onto PLACE releases DIG and presses PLACE');
  // the d-pad thumb slides left, past the d-pad's edge
  Touch.move(3, L.dpad.x - L.dpad.r * 2, L.dpad.y + 2); step();
  ok &= check(Input.down('left') && !Input.down('up'), 'd-pad thumb slides to left, even past the edge');
  Touch.up(3); Touch.up(4, true); step();
  ok &= check(!Input.down('left') && !Input.down('place'), 'release + cancel clear everything');

  // keyboard and touch don't clobber each other
  Input.held.right = true;
  Touch.down(5, L.dpad.x + L.dpad.r * 0.8, L.dpad.y); step();
  ok &= check(!Input.pressed('right'), 'touch right while the key is held: no extra press');
  Touch.up(5); step();
  ok &= check(Input.down('right'), 'releasing touch right keeps the keyboard right held');
  Input.held.right = false;

  // menus: a tap anywhere (even on the d-pad) is "start" on release, never a held control
  game.state = 'pause';
  Touch.down(6, L.dpad.x, L.dpad.y); step();
  ok &= check(!Input.down('left') && !Input.down('right') && !Input.pressed('start'), 'menu: finger down holds nothing');
  game.state = 'play';   // resumed by another finger while this one is still down
  Touch.move(6, L.dpad.x - 20, L.dpad.y); step();
  ok &= check(!Input.down('left'), 'menu finger stays inert after the state flips to play');
  Touch.up(6); step();
  ok &= check(Input.pressed('start'), 'menu tap fires start on release');

  // corner buttons
  Touch.down(7, vw - 2, L.pause.y + 2); Touch.up(7); step();
  ok &= check(Input.pressed('pause'), 'pause button');
  game.muted = false;
  Touch.down(8, vw - 2, 3); Touch.up(8); step();
  ok &= check(game.muted && !Input.pressed('start'), 'mute button');
  Touch.down(9, vw - 2, 3); Touch.up(9, true); step();
  ok &= check(game.muted, 'cancelled tap does nothing');

  // mobile: keyboard use hides the overlay, the next touch brings it back
  Touch.forced = false; Touch.mobile = true; Touch.enabled = true;
  Touch.down(10, btn('dig').x, btn('dig').y);
  Touch.keyboardUsed(); step();
  ok &= check(!Touch.enabled && !Input.down('dig'), 'a key press hides the overlay and releases its buttons');
  Touch.enable();
  ok &= check(Touch.enabled, 'mobile: a touch brings the overlay back');
  if (ok) pass('input bridge: edges, multi-touch, rolling, keyboard, menus, corners');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
