# The Legend of Bob — game design

The authority on game rules. Tuning numbers live in `js/config.js`.

## Goal
Rescue **Bob 2** (above ground) and **Bob 3** (in an underground tunnel), then find and defeat the **Bob Boss** in his sealed cave deep underground. The cave seal crumbles only after both Bobs are saved. Touching Bob 2 or Bob 3 rescues them: they sprout wings and fly to safety.

## World
- Procedurally generated from a seed: fixed width (384 tiles, walls at the edges), unlimited depth.
- Surface hills; dirt layer, then stone with dirt pockets and noise caves.
- 3–4 hidden tunnels run from the surface to the boss cave (60–80 rows down). Their entrances are covered by **golden grass** plus one dirt row; dig through to find them. Tunnels that touch merge.
- Underground air stays disguised as solid ground until Bob reaches it (flood-fill reveal).
- Bob 2 stands on a stone mesa that is too tall to jump onto, so you build stairs or dig up through it. With jumping juice he can jump straight up onto it. Bob 3 waits in a small room partway along one tunnel.
- The boss cave is walled by undiggable **seal** blocks. When both Bobs are saved, the door blocks become air and the rest of the seal turns to stone.

## Bob
- Controls are left-hand-centric because the right hand is on the arrows: D dig, Space jump, E place, F punch, Q switch material, Esc pause, M mute.
- **Touch** (phones and tablets): a d-pad on the left. On the right is a diamond of JUMP (bottom), PUNCH (left), PLACE (right) and DIG (top), with a small SWAP for materials. Pause sits under the mute speaker, and in menus you tap anywhere. The d-pad favors straight directions so walking doesn't leak an ↑, which would start a climb or turn a dig upward. The overlay shows only on mobile devices (touch is the main input and nothing hovers), never on desktops or touchscreen laptops. On mobile, a key press hides it and the next touch brings it back. Both orientations work.
- 3 hearts (tracked in quarter-hearts). Jump is 2.5 blocks (40px) at full hold; a tap gives a short hop. Mario-like acceleration, friction, coyote time and jump buffer.
- **Dig** (hold D): sideways clears both rows of his body; ↑/↓ digs up/down. Grass and dirt yield dirt; stone yields stone. No inventory cap.
- **Climb**: holding ↑ in any 1-wide shaft (or under one, within reach) climbs it, and he hops out onto the ledge at the top. Without ↑ he hangs; ↓ climbs down. ↑+D digs upward and he climbs into the hole, so he can always tunnel back up. 2-wide shafts can't be climbed; build to get out of those.
- **Place** (E): in front at foot level (stairs). ↓+E drops a block onto the ground below (pillar up by jumping), or bridges forward when he's already standing on ground. ↑+E places above his head.
- **Punch** (F): 1 damage, 1-block reach. ↑+F uppercut (reaches higher), ↓+F in the air for a down-punch that bounces.
- **Q** switches material.

## Items (chests in tunnels)
About 3 chests per tunnel. Every world has the sword, one of each powerup, 1 armor and 1 health; bigger worlds add a second armor and more health.
- **Sword**: 2 damage and 1.5-block reach.
- **Armor**: halves damage and breaks after 10 hits. Up to 2 per world.
- **Health**: +1 heart, capped at 3.
- **Golden shovel** (powerup): digs twice as fast. It shows gold while he digs.
- **Jumping juice** (powerup): jumps twice as high (5 blocks at full hold).
- **Light-up shoes** (powerup): runs 1.5x as fast. The soles flash while he runs.
- Powerups last until death and show as icons in the HUD.

## Enemies
- **Bob-bot**: dies to 1 punch. Patrols and turns at walls and ledges; chases when Bob is near and hops 1-block steps. Contact costs ½ heart.
- **Bob Boss**: 10 HP. Walks, jumps at Bob and throws "BOB" grenades. Grenades explode on terrain or Bob and cost 1 heart; touching the boss costs ½ heart. **Only hits on the glowing weak spot in the arch between his legs count.** The best chance is an uppercut while he jumps over you; a ground punch only reaches it point-blank, and the sword's longer reach makes it easier. Under 5 HP he gets faster and throws doubles.

## Art
Drawn from the sketches (in code, `js/sprites.js`):
- **Bob**: blocky tan figure, square eyes, box mouth, arms up, "B ▲O B" on his chest, "1" on his legs. Bob 2 and Bob 3 have a blue or purple tint and "2"/"3" on their legs.
- **Bob-bot**: stepped gray block body, round eyes, blue antenna.
- **Bob Boss**: red-outlined giant covered in "BOB", holding a "BOB" grenade up in each hand.

## Display and sound
- 8-bit look: 16px tiles, NES-style palette, 256×240 base view. No forced scrolling; the camera follows Bob.
- Original synthesized chiptune (a main theme and a faster boss theme) and sound effects. No audio files.
- The game fills the browser window with no bars: at least 16×15 tiles are visible, and wider or taller windows show more world in that direction.
- Mute: M, or click the speaker in the top-right corner.

## Death
Restart the level: same world, terrain reset, inventory lost (materials, sword, armor, powerups), rescues reset. A new world comes only from the title screen.

## Later / open
- More enemy types later. The bob-bot is the only enemy for now.
- Tile art (grass, dirt, stone) is still placeholder; no sketches yet.
