# The Legend of Bob — game design

The authority on game rules. Tuning numbers live in `js/config.js`.

## Goal
Rescue **Bob 2** (above ground) and **Bob 3** (in an underground tunnel), then find and defeat the **Bob Boss** in his sealed cave deep underground. The cave seal crumbles only after both Bobs are saved.

## World
- Procedurally generated from a seed: fixed width (384 tiles, walls at the edges), unlimited depth.
- Surface hills; dirt layer, then stone with dirt pockets and noise caves.
- 3–4 hidden tunnels run from the surface to the boss cave (60–80 rows down). Their entrances are covered by **golden grass** plus one dirt row; dig through to find them. Tunnels that touch merge.
- Underground air stays disguised as solid ground until Bob reaches it (flood-fill reveal).
- Bob 2 stands on a stone mesa that is too tall to jump onto, so you build stairs or dig up through it. Bob 3 waits in a small room partway along one tunnel.
- The boss cave is walled by undiggable **seal** blocks. When both Bobs are saved, the door blocks become air and the rest of the seal turns to stone.

## Bob
- 3 hearts (tracked in quarter-hearts). Jump is 2.5 blocks (40px) at full hold; a tap gives a short hop. Mario-like acceleration, friction, coyote time and jump buffer.
- **Dig** (hold D): sideways clears both rows of his body; ↑/↓ digs up/down. Grass and dirt yield dirt; stone yields stone. No inventory cap.
- **Climb**: holding ↑ in any 1-wide shaft (or under one, within reach) climbs it, and he hops out onto the ledge at the top. Without ↑ he hangs; ↓ climbs down. ↑+D digs upward and he climbs into the hole, so he can always tunnel back up. 2-wide shafts can't be climbed; build to get out of those.
- **Place** (E): in front at foot level (stairs). ↓+E drops a block onto the ground below (pillar up by jumping), or bridges forward when he's already standing on ground. ↑+E places above his head.
- **Punch** (F): 1 damage, 1-block reach. ↑+F uppercut (reaches higher), ↓+F in the air for a down-punch that bounces.
- **Q** switches material.

## Items (chests in tunnels)
- **Sword**: 2 damage and 1.5-block reach. Every world has one.
- **Armor**: halves damage and breaks after 10 hits. Up to 2 per world.
- **Health**: +1 heart, capped at 3.

## Enemies
- **Bob-bot**: dies to 1 punch. Patrols and turns at walls and ledges; chases when Bob is near and hops 1-block steps. Contact costs ½ heart.
- **Bob Boss**: 10 HP. Walks, jumps at Bob and throws "BOB" grenades. Grenades explode on terrain or Bob and cost 1 heart; touching the boss costs ½ heart. **Only hits on the glowing weak spot in the arch between his legs count.** The best chance is an uppercut while he jumps over you; a ground punch only reaches it point-blank, and the sword's longer reach makes it easier. Under 5 HP he gets faster and throws doubles.

## Art
Drawn from the sketches (in code, `js/sprites.js`):
- **Bob**: blocky tan figure, square eyes, box mouth, arms up, "B ▲O B" on his chest, "1" on his legs. Bob 2 and Bob 3 have a blue or purple tint and "2"/"3" on their legs.
- **Bob-bot**: stepped gray block body, round eyes, blue antenna.
- **Bob Boss**: red-outlined giant covered in "BOB", holding a "BOB" grenade up in each hand.

## Display and sound
- The game fills the browser window with no bars: at least 16×15 tiles are visible, and wider or taller windows show more world in that direction.
- Mute: M, or click the speaker in the top-right corner.

## Death
Restart the level: same world, terrain reset, inventory lost (materials, sword, armor), rescues reset. A new world comes only from the title screen.
