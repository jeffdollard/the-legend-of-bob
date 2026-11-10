// Axis-separated AABB vs tile collision shared by every entity.
// Entities: { x, y, w, h, vx, vy } in pixels; x,y is the top-left of the collision box.
'use strict';

const EPS = 0.001;

function boxHitsSolid(world, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - EPS) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) return true;
  return false;
}

function moveAndCollide(e, world) {
  e.hitWall = false; e.hitCeil = false; e.onGround = false;
  if (e.vx !== 0) {
    e.x += e.vx;
    const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - EPS) / TILE);
    const tx = e.vx > 0 ? Math.floor((e.x + e.w - EPS) / TILE) : Math.floor(e.x / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (world.solid(tx, ty)) {
        e.x = e.vx > 0 ? tx * TILE - e.w : (tx + 1) * TILE;
        e.vx = 0; e.hitWall = true;
        break;
      }
    }
  }
  if (e.vy !== 0) {
    e.y += e.vy;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - EPS) / TILE);
    const ty = e.vy > 0 ? Math.floor((e.y + e.h - EPS) / TILE) : Math.floor(e.y / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (world.solid(tx, ty)) {
        if (e.vy > 0) { e.y = ty * TILE - e.h; e.onGround = true; }
        else { e.y = (ty + 1) * TILE; e.hitCeil = true; }
        e.vy = 0;
        break;
      }
    }
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rect(x, y, w, h) { return { x, y, w, h }; }
