/**
 * Headless navigation check: builds the real collision model and walks a simulated player
 * along routes that must work (stairs, doorways, veranda) and ones that must not (walls, voids).
 * Run with: npm run test:nav
 */
import { MeshBasicMaterial, Texture, Vector3 } from 'three';
import { Batch } from '../src/core/geo';
import { EYE, H1, H2 } from '../src/core/layout';
import { VIEWPOINTS } from '../src/controls/director';
import { Player } from '../src/controls/player';
import { CollisionWorld } from '../src/world/collision';
import { buildDetails } from '../src/world/details';
import { buildExterior } from '../src/world/exterior';
import { buildStructure } from '../src/world/structure';

const anyMat = new MeshBasicMaterial();
const mats = new Proxy({}, { get: () => anyMat }) as Record<string, MeshBasicMaterial>;
const tex = new Proxy({}, { get: () => new Texture() }) as Record<string, Texture>;
const world = new CollisionWorld();
const B = new Batch();
const structure = buildStructure(B, world, mats);
buildDetails(B, world, mats);
buildExterior(B, world, mats, tex, [], [], { trees: 10 });

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

/** Walks toward each waypoint in turn, holding W, for at most `seconds`. */
function walk(start: [number, number, number], route: [number, number][], seconds = 40) {
  const p = new Player(world);
  p.place(new Vector3(start[0], start[1] + EYE, start[2]), new Vector3(route[0][0], start[1] + EYE, route[0][1]));
  let i = 0;
  p.keyDown('KeyW');
  for (let t = 0; t < seconds && i < route.length; t += 1 / 60) {
    const [tx, tz] = route[i];
    const dx = tx - p.feet.x, dz = tz - p.feet.z;
    if (Math.hypot(dx, dz) < 0.35) { i++; continue; }
    p.yaw = Math.atan2(-dx, -dz);
    p.update(1 / 60);
  }
  return { p, reached: i >= route.length };
}

// Every viewpoint must stand on a floor and not inside anything.
for (const v of VIEWPOINTS) {
  const feet = v.eye.y - EYE;
  const f = world.floorAt(v.eye.x, v.eye.z, feet + 0.3);
  const q = { x: v.eye.x, z: v.eye.z };
  world.resolve(q, f ?? feet);
  check(`viewpoint ${v.label} is standable`, f !== null && Math.abs(f - feet) < 0.2 && Math.hypot(q.x - v.eye.x, q.z - v.eye.z) < 0.01, `floor ${f}`);
}

// Ground → second floor by the west stair.
{
  const r = walk([-8, 0, 8], [[-10.9, 6.3], [-10.9, -3.2], [-8, -6]]);
  check('climb stair 1 to the second floor', r.reached && Math.abs(r.p.feet.y - H1) < 0.05, `ended at y=${r.p.feet.y.toFixed(2)}`);
}
// Second → third floor by the east stair.
{
  const r = walk([8, H1, -9], [[10.9, -6.4], [10.9, 2.6], [8, 6]]);
  check('climb stair 2 to the third floor', r.reached && Math.abs(r.p.feet.y - H2) < 0.05, `ended at y=${r.p.feet.y.toFixed(2)}`);
}
// And back down.
{
  const r = walk([8, H2, 6], [[10.9, 2.6], [10.9, -6.4], [8, -9]]);
  check('descend stair 2', r.reached && Math.abs(r.p.feet.y - H1) < 0.05, `ended at y=${r.p.feet.y.toFixed(2)}`);
}
// Through the carved doorway into the Sacred Hall.
{
  const r = walk([0, 0, -6], [[0, -11], [0, -14.5]]);
  check('walk through the katōmado into the Sacred Hall', r.reached, `at z=${r.p.feet.z.toFixed(2)}`);
}
// Out through the open screens, across the veranda, down the step stone into the garden.
{
  const r = walk([2, 0, 8], [[2, 11], [2, 13.6], [0, 14.2], [0, 16.5], [3, 20]]);
  check('walk out to the garden', r.reached && r.p.feet.y < -0.5, `at y=${r.p.feet.y.toFixed(2)}`);
}
// Blocked routes.
{
  const r = walk([-8, 0, 8], [[-8, 14]], 8);
  check('closed screens in the outer bay block the way', r.p.feet.z < 12.1, `stopped at z=${r.p.feet.z.toFixed(2)}`);
}
{
  const r = walk([-1, H1, 5], [[-1, 0]], 8);
  check('balcony rail stops a fall into the atrium', r.p.feet.y === H1 && r.p.feet.z > 2.8, `z=${r.p.feet.z.toFixed(2)} y=${r.p.feet.y}`);
}
{
  const r = walk([-6, 0, -8], [[-6, -16]], 8);
  check('the north wall is solid beside the doorway', r.p.feet.z > -12, `stopped at z=${r.p.feet.z.toFixed(2)}`);
}
{
  const r = walk([4, 0, 6], [[0, 0]], 10);
  check('the heart pillar is solid', Math.hypot(r.p.feet.x, r.p.feet.z) > 0.9, `distance ${Math.hypot(r.p.feet.x, r.p.feet.z).toFixed(2)}`);
}
{
  const r = walk([6, 0, 13.5], [[16, 13.5]], 8);
  check('the veranda ends at the building edge', r.p.feet.x < 12.5, `stopped at x=${r.p.feet.x.toFixed(2)}`);
}
// The sliding bay opens when approached (the open flag drives its collision box).
check('sliding bays were built', structure.sliding.length === 2 && structure.sliding.every((s) => s.panels.length === 2));

console.log(failures ? `\n${failures} navigation check(s) failed` : '\nAll navigation checks passed');
process.exit(failures ? 1 : 0);
