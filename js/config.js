// The Legend of Bob — tuning constants. All gameplay numbers live here.
'use strict';

const TILE = 16;
// The view fills the window: at least UI_W x UI_H game pixels, growing in whichever
// direction the window is longer (Game.fit). Menus are laid out in a centered UI_W x UI_H box.
const UI_W = 256, UI_H = 240;
let VIEW_W = UI_W, VIEW_H = UI_H;

// Tile ids
const T = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SEAL: 4, MARKER: 5, WALL: 6 };
const SOLID = [false, true, true, true, true, true, true];
const DIGGABLE = [false, true, true, true, false, true, false];

// Frames to dig each tile type (60 frames = 1s)
const DIG_TIME = { [T.GRASS]: 6, [T.DIRT]: 7, [T.MARKER]: 7, [T.STONE]: 14 };
// What material each dug tile adds to the inventory
const DIG_YIELD = { [T.GRASS]: 'dirt', [T.DIRT]: 'dirt', [T.MARKER]: 'dirt', [T.STONE]: 'stone' };

const MATERIALS = [
  { key: 'dirt', tile: T.DIRT, name: 'DIRT' },
  { key: 'stone', tile: T.STONE, name: 'STONE' },
];

const CFG = {
  // World
  WORLD_W: 384,          // tiles; walls at x=0 and x=W-1. Depth is unlimited.
  SURFACE_BASE: 32,      // average surface row
  SKY_LIMIT: -64,        // rows above this are always air
  CAVE_W: 26,            // boss cave interior size (tiles)
  CAVE_H: 10,
  CAVE_DEPTH_MIN: 58,    // boss cave interior top, rows below SURFACE_BASE
  CAVE_DEPTH_MAX: 80,
  CAVE_THRESHOLD: 0.7,   // noise caves: higher = fewer
  TUNNELS_TARGET: 4,
  SURFACE_BOTS: 10,
  TUNNEL_BOTS: 2,        // per tunnel
  CHESTS_PER_TUNNEL: 2,
  REVEAL_RADIUS: 12,     // min flood-fill reveal half-size (tiles); grows to cover the view
  REVEAL_MARGIN: 4,      // extra tiles past the view edge (camera lag)

  // Player physics (px per frame at 60fps)
  P_W: 12, P_H: 22,
  ACCEL_GROUND: 0.18, ACCEL_AIR: 0.12,
  MAX_SPEED: 1.7,
  FRICTION_GROUND: 0.22, FRICTION_AIR: 0.04,
  JUMP_V: 4.3,           // with G_HOLD gives a 40px (2.5 block) apex
  G_HOLD: 0.22,          // gravity while rising with jump held
  G_RELEASE: 0.7,        // gravity while rising with jump released (short hop)
  G_FALL: 0.45,
  MAX_FALL: 6,
  COYOTE: 6, JUMP_BUFFER: 6,
  CLIMB_SPEED: 1.2,      // climbing 1-wide shafts (hold ↑)

  // Health is in quarter-hearts: 3 hearts = 12
  MAX_HEALTH: 12,
  DMG_BOT: 2,            // 1/2 heart
  DMG_GRENADE: 4,        // 1 heart
  DMG_BOSS_TOUCH: 2,     // 1/2 heart
  HEAL: 4,               // 1 heart
  ARMOR_HITS: 10,
  IFRAMES: 60,

  // Combat
  PUNCH_REACH: 16, SWORD_REACH: 24,
  UPPERCUT_REACH: 28, SWORD_UPPERCUT_REACH: 36,   // uppercut reaches higher: the boss is hit from below
  PUNCH_DMG: 1, SWORD_DMG: 2,
  BOT_HP: 1,
  BOSS_HP: 10,
  BOSS_W: 32, BOSS_H: 48,
  WEAK_SPOT: 8,          // weak spot square size, in the arch between the boss's legs
};

// Touch controls (phones/tablets). Sizes are CSS px; Touch.layout converts them to game px.
const TOUCH = {
  DPAD_R: 64,            // d-pad radius
  DPAD_HIT: 1.5,         // a touch within this many radii of the center grabs the d-pad
  DPAD_DEAD: 0.2,        // center dead zone, as a fraction of the radius
  DPAD_V_MIN: 35,        // degrees above horizontal where up/down engage (higher = fewer accidental ups)
  DPAD_H_MAX: 60,        // degrees above horizontal where left/right drop out
  BTN_R: 30,             // action button radius
  BTN_SPREAD: 1.5,       // diamond offset from the cluster center, in button radii
  BTN_HIT: 1.3,          // button hit radius, in button radii
  SMALL_R: 20,           // SWAP button radius
  MARGIN: 20,            // from the left/right screen edges
  MARGIN_BOTTOM: 24,     // from the bottom edge (clear of the home indicator)
  CORNER: 44,            // mute/pause corner hit size
  TOP_CLEAR: 48,         // game px kept clear at the top for the HUD, pause button and toasts
  ALPHA: 0.55,           // control opacity (pressed controls are brighter)
  FULLSCREEN: true,      // Android: go fullscreen when a tap starts the game
};

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Space: 'jump', KeyD: 'dig', KeyE: 'place', KeyF: 'punch', KeyQ: 'switch',
  Escape: 'pause', KeyM: 'mute', Enter: 'start',
  Digit1: 'dbg1', Digit2: 'dbg2', Digit3: 'dbg3', Digit4: 'dbg4', Digit5: 'dbg5', Digit6: 'dbg6',
  KeyG: 'dbgGod', KeyV: 'dbgReveal',
};
