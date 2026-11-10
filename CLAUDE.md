# The Legend of Bob

8-bit browser platformer about digging. Vanilla JS + Canvas, no build step, no dependencies. Game rules are in [DESIGN.md](DESIGN.md); every tuning number is in `js/config.js`.

## Run
- `python3 -m http.server 8765`, then open `http://localhost:8765` (this is the tested path).
- Opening `index.html` directly should also work (classic scripts, no fetches), but `file://` hasn't been verified.
- URL flags: `?seed=123` (fixed world), `?debug=1` (debug keys + overlay), `?touch=1` (force the touch controls on; the mouse drives them).
- Phone testing: the server above listens on all interfaces, so open `http://<mac-lan-ip>:8765` on a phone on the same Wi-Fi.
- Debug keys: `1` next to Bob 2, `2` next to Bob 3, `3` outside a cave door, `4` unseal + into the boss cave, `5` sword/armor/50 blocks, `6` rescue both, `G` god mode, `V` reveal all.
- `window.Game` and `Input.hold(name, bool)` / `Input.tap(name)` are exposed for scripted browser tests.

## Tests (Node, no deps)
- `node tools/test-worldgen.js [seeds]`: playability over many seeds. Tunnels reach their doors, Bob 3 and chests are reachable, the seal is airtight, the cave is reachable after unseal, the mesa is taller than a jump. Reachability models Bob as a 1×2 agent.
- `node tools/test-physics.js`: the real Player code. Jump apex 40px, ledge heights, dig/place behaviors.
- `node tools/test-combat.js`: weak-spot rules, sword, bot kill, damage/armor math.
- `node tools/test-touch.js`: touch layout at phone/tablet sizes (in bounds, no overlaps, finger-sized, clear of the HUD), hit-testing, d-pad wedges, and the Input bridge (one press per button-down, multi-touch, menu taps).
- Browser touch tests: don't use `browser_resize`. In `browser_run_code_unsafe`, make an emulated context (`page.context().browser().newContext({ viewport, isMobile: true, hasTouch: true })`) and send multi-touch with CDP `Input.dispatchTouchEvent`. Close the context afterwards.
- `tools/load.js` concatenates `js/*.js` into a Node vm context. Files must stay DOM-free at load time (sprites build in `buildSprites()`, called from `Game.init`).

## Git
- When asked to commit, commit on a short branch and merge it into `master` right away, then delete the branch (standing approval).
- `origin` is the public repo `github.com/jeffdollard/the-legend-of-bob`. GitHub Pages serves `master` at https://jeffdollard.github.io/the-legend-of-bob/, so pushing `master` deploys. Push only when asked.

## Architecture
Scripts load in the order in `index.html` and share globals.
- `config.js`: constants, tile ids, keymap. `VIEW_W`/`VIEW_H` are `let`s: `Game.fit()` scales a 256×240 box to fit the window, then grows the view in the longer direction so there are never bars (fractional CSS scale). Menus are laid out in a centered 256×240 box (`UI_W`/`UI_H`). Playwright's `browser_resize` forces the page size and can make the real window look wrong.
- `rng.js`: seeded PRNG + value noise.
- `worldgen.js`: `generateLayout(seed)` builds a structure map (tunnels, cave, seal, mesa) over noise terrain (`baseTile`). Also places spawns, chests and bots.
- `world.js`: lazy 32×32 chunks holding live tiles + a reveal mask. Restart = `new World(layout)`.
- `physics.js`: axis-separated AABB vs tiles.
- `player.js`, `enemies.js`, `boss.js`, `entities.js`: gameplay objects. Each has `update(g)` and `draw(ctx, cam)`, where `g` is `Game`.
- `sprites.js`: all art, plus the 5×7 pixel font. Bob, Bob-bot and the boss are drawn in code from the user's sketches (`drawBob`, `drawBoss`, the bot rows); tiles are still placeholder. Everything is looked up through `SPR`. Bob is never mirrored (his chest lettering must read correctly); facing is shown with pupils and the punching arm.
- `audio.js`: WebAudio sfx + a step sequencer (`TRACKS.main`, `TRACKS.boss`).
- `hud.js`, `game.js`: HUD (including the clickable mute button), loop, states, camera, render, debug.
- `input.js`, `touch.js`: keyboard and touch both feed `Input`. `Input.down()` ORs the keyboard's `held` with `Input.touch`. `Touch` tracks pointers by id and sends its whole held set through `Input.setTouch()`, which queues a press only when a control goes from up to down. Mobile is detected with `matchMedia('(pointer: coarse) and (hover: none)')`; nothing else turns the overlay on except `?touch=1`. Touch sizes are CSS px in `TOUCH` (config.js), and `Touch.layout()` converts them with `Game.scale`. Audio unlocks and Android fullscreen run on pointer *release*, because a touch press isn't a user gesture.
