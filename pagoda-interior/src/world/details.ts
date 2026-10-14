import {
  BoxGeometry, BufferAttribute, CylinderGeometry, Group, LatheGeometry, Material, Mesh, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3, Color,
} from 'three';
import { Batch, box, cyl, mat, projectUV } from '../core/geo';
import { ANNEX, CLR_TOP, H1, H2, H3, OUT } from '../core/layout';
import { rand } from '../core/noise';
import type { CollisionWorld } from './collision';

export function lathe(points: [number, number][], seg = 28) {
  return projectUV(new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), seg), 1, 0.6, 0.6);
}
const ellipsoid = (sx: number, sy: number, sz: number, w = 12, h = 8) =>
  projectUV(new SphereGeometry(1, w, h).scale(sx, sy, sz), 1, 0.5, 0.5);

const tatami = (B: Batch, x: number, y: number, z: number, rotated: boolean) =>
  B.add('tatami', projectUV(new BoxGeometry(0.9, 0.05, 1.8), 2, 0.9, 1.8, 0.5, 0.5), mat(x, y + 0.025, z, rotated ? Math.PI / 2 : 0), 1, 0.06);

const zabuton = (B: Batch, x: number, y: number, z: number, ry = 0, key = 'fabricRed', zafu = true) => {
  B.add(key, box(0.74, 0.07, 0.78), mat(x, y + 0.035, z, ry));
  B.add(key, box(0.7, 0.02, 0.74), mat(x, y + 0.075, z, ry), 1.08);
  if (zafu) B.add('fabricBlack', cyl(0.19, 0.21, 0.14, 20), mat(x, y + 0.15, z, ry));
};

/** A selection of pottery profiles (r, y), used around the galleries. */
const POTS: [number, number][][] = [
  [[0, 0], [0.12, 0], [0.2, 0.08], [0.24, 0.22], [0.2, 0.36], [0.1, 0.42], [0.09, 0.46], [0.11, 0.48]], // tsubo jar
  [[0, 0], [0.07, 0], [0.1, 0.1], [0.1, 0.3], [0.05, 0.42], [0.04, 0.55], [0.07, 0.6]], // tall vase
  [[0, 0], [0.05, 0], [0.12, 0.05], [0.14, 0.09]], // tea bowl
];
export function pot(B: Batch, kind: number, x: number, y: number, z: number, s = 1, key = 'ceramic') {
  B.add(key, lathe(POTS[kind], 24), mat(x, y, z, rand(0, 6), 0, 0, s));
}

export function koro(B: Batch, x: number, y: number, z: number, s = 1) {
  B.add('bronze', lathe([[0, 0.06], [0.16, 0.06], [0.2, 0.12], [0.2, 0.2], [0.17, 0.24], [0.18, 0.26]].map(([r, h]) => [r * s, h * s] as [number, number])), mat(x, y, z));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    B.add('bronze', cyl(0.025 * s, 0.035 * s, 0.1 * s, 8), mat(x + Math.cos(a) * 0.13 * s, y + 0.04 * s, z + Math.sin(a) * 0.13 * s));
  }
  B.add('bronze', lathe([[0.17, 0], [0.14, 0.06], [0.06, 0.1], [0.04, 0.14], [0, 0.16]].map(([r, h]) => [r * s, h * s] as [number, number])), mat(x, y + 0.26 * s, z));
  return new Vector3(x, y + 0.4 * s, z);
}

export function candleStand(B: Batch, x: number, y: number, z: number, h: number): Vector3 {
  B.add('bronze', cyl(0.12, 0.16, 0.05, 16), mat(x, y + 0.025, z));
  B.add('bronze', cyl(0.018, 0.025, h, 10), mat(x, y + h / 2, z));
  B.add('bronze', cyl(0.09, 0.05, 0.04, 16), mat(x, y + h, z));
  B.add('candle', cyl(0.028, 0.03, 0.2, 12), mat(x, y + h + 0.12, z));
  return new Vector3(x, y + h + 0.26, z);
}

export function bronzeToro(B: Batch, x: number, y: number, z: number, s = 1) {
  const S = (v: number) => v * s;
  B.add('bronze', cyl(S(0.32), S(0.38), S(0.12), 6), mat(x, y + S(0.06), z));
  B.add('bronze', cyl(S(0.07), S(0.09), S(0.9), 12), mat(x, y + S(0.57), z));
  B.add('bronze', cyl(S(0.28), S(0.18), S(0.1), 6), mat(x, y + S(1.07), z));
  B.add('lanternGlass', cyl(S(0.2), S(0.2), S(0.34), 6), mat(x, y + S(1.29), z));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    B.add('bronze', box(S(0.035), S(0.36), S(0.035)), mat(x + Math.cos(a) * S(0.21), y + S(1.29), z + Math.sin(a) * S(0.21)));
  }
  B.add('bronze', cyl(S(0.05), S(0.42), S(0.24), 6), mat(x, y + S(1.58), z));
  B.add('gold', ellipsoid(S(0.06), S(0.09), S(0.06)), mat(x, y + S(1.76), z));
}

export function andon(B: Batch, x: number, y: number, z: number, ry = 0) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('black', box(0.035, 0.9, 0.035), mat(x + sx * 0.17, y + 0.45, z + sz * 0.17));
  B.add('lanternPaper', box(0.32, 0.5, 0.32), mat(x, y + 0.55, z, ry));
  B.add('black', box(0.38, 0.03, 0.38), mat(x, y + 0.82, z, ry));
  B.add('black', box(0.38, 0.03, 0.38), mat(x, y + 0.29, z, ry));
}

export interface Swinging {
  obj: Group;
  angle: number;
  vel: number;
}
export interface FlowingCloth {
  mesh: Mesh;
  base: Float32Array;
  phase: number;
  amp: number;
}

export interface DetailsResult {
  group: Group;
  smoke: Vector3[];
  flames: Vector3[];
  rinzo: { obj: Group; spin: number };
  bell: { bell: Swinging; striker: Swinging };
  banners: FlowingCloth[];
  noren: { pivots: Group[]; angle: number[]; vel: number[] };
}

export function buildDetails(B: Batch, W: CollisionWorld, mats: Record<string, Material>): DetailsResult {
  const group = new Group();
  group.name = 'details';
  const smoke: Vector3[] = [];
  const flames: Vector3[] = [];

  /* ── central dais with the heart pillar (shinbashira) ── */
  B.add('stone', box(6.4, 0.15, 6.4, 0, 1, 1), mat(0, 0.075, 0));
  B.add('stone', box(5.8, 0.15, 5.8, 0, 1, 1), mat(0, 0.225, 0), 0.92);
  B.add('lacquer', box(5.44, 0.12, 5.44), mat(0, 0.36, 0));
  B.add('gold', box(5.46, 0.02, 5.46), mat(0, 0.31, 0), 0.9);
  W.surface({ x0: -3.2, x1: 3.2, z0: -3.2, z1: 3.2, y: 0.15 });
  W.surface({ x0: -2.9, x1: 2.9, z0: -2.9, z1: 2.9, y: 0.3 });
  W.surface({ x0: -2.72, x1: 2.72, z0: -2.72, z1: 2.72, y: 0.47 });
  // tatami in a classic alternating layout: long row · short rows · long row
  const ty = 0.42;
  for (let i = 0; i < 6; i++) { tatami(B, -2.25 + i * 0.9, ty, -1.8, false); tatami(B, -2.25 + i * 0.9, ty, 1.8, false); }
  for (let i = 0; i < 3; i++) { tatami(B, -1.8 + i * 1.8, ty, -0.45, true); tatami(B, -1.8 + i * 1.8, ty, 0.45, true); }

  const pillarTop = CLR_TOP;
  B.add('walnut', cyl(0.5, 0.54, pillarTop - ty, 32), mat(0, (pillarTop + ty) / 2, 0), 1.25);
  for (const y of [2.6, 5.3, 8.7, 12.2, 15.2, 18.4]) {
    B.add('gold', cyl(0.55, 0.55, 0.06, 32), mat(0, y, 0));
    B.add('gold', cyl(0.545, 0.545, 0.025, 32), mat(0, y + 0.14, 0));
  }
  B.add('bronze', cyl(0.6, 0.62, 0.3, 32), mat(0, ty + 0.15, 0));
  // gilt lotus around the base
  for (let row = 0; row < 2; row++) {
    const n = row ? 12 : 16;
    for (let k = 0; k < n; k++) {
      const a = ((k + row * 0.5) / n) * Math.PI * 2;
      const r = row ? 0.62 : 0.7;
      const g = ellipsoid(0.13, 0.32, 0.06);
      B.add('gold', g, mat(Math.cos(a) * r, ty + 0.38 - row * 0.05, Math.sin(a) * r, -a + Math.PI / 2, 0, 0).multiply(mat(0, 0, 0, 0, 0.45)), row ? 1 : 0.85);
    }
  }
  W.cyl(0, 0, 0.78, 0, pillarTop);
  B.add('gold', cyl(0.75, 0.6, 0.3, 32), mat(0, pillarTop - 0.3, 0));

  // cushions facing the pillar
  zabuton(B, 0, ty + 0.05, -1.65, 0); zabuton(B, 1.65, ty + 0.05, 0, Math.PI / 2); zabuton(B, -1.65, ty + 0.05, 0, Math.PI / 2);
  zabuton(B, 0, ty + 0.05, 1.75, 0);
  // offering table south of the pillar, with incense burner and candles
  const tt = ty + 0.05 + 0.3;
  B.add('lacquer', box(0.96, 0.05, 0.44), mat(0, tt, 0.98));
  B.add('gold', box(0.97, 0.012, 0.45), mat(0, tt - 0.03, 0.98));
  for (const s of [-1, 1]) B.add('lacquer', box(0.05, 0.3, 0.4), mat(s * 0.43, tt - 0.17, 0.98));
  smoke.push(koro(B, 0, tt + 0.025, 0.98, 0.85));
  flames.push(candleStand(B, -0.33, tt + 0.025, 0.98, 0.16), candleStand(B, 0.33, tt + 0.025, 0.98, 0.16));
  B.add('bronze', lathe([[0, 0], [0.07, 0], [0.11, 0.04], [0.12, 0.09]], 24), mat(1.15, ty + 0.13, 0.6)); // rin bowl bell
  B.add('fabricRed', cyl(0.13, 0.14, 0.06, 18), mat(1.15, ty + 0.1, 0.6));
  W.box(-0.5, 0.5, ty, ty + 1.2, 0.74, 1.22);

  /* ── banners hanging into the atrium from the third-floor balcony ── */
  const banners: FlowingCloth[] = [];
  const bTop = H2 - 0.9;
  for (const [x, z, ry] of [[0, -2.5, 0], [0, 2.5, Math.PI], [2.5, 0, -Math.PI / 2], [-2.5, 0, Math.PI / 2]] as [number, number, number][]) {
    const g = new PlaneGeometry(0.62, 4.2, 1, 16);
    g.translate(0, -2.1, 0);
    const mesh = new Mesh(g, mats.banner);
    mesh.geometry.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    mesh.position.set(x, bTop, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    group.add(mesh);
    banners.push({ mesh, base: Float32Array.from(g.attributes.position.array as Float32Array), phase: rand(0, 6), amp: 0.05 });
    B.add('black', cyl(0.025, 0.025, 0.8, 8), mat(x, bTop + 0.04, z, ry, 0, Math.PI / 2));
    B.add('gold', ellipsoid(0.04, 0.04, 0.04), mat(x + (ry === 0 || ry === Math.PI ? 0.4 : 0), bTop + 0.04, z + (ry === 0 || ry === Math.PI ? 0 : 0.4)));
  }

  /* ── noren curtain in the carved doorway ── */
  const noren = { pivots: [] as Group[], angle: [0, 0, 0], vel: [0, 0, 0] };
  {
    const rodY = 2.02, z = -OUT + 0.24;
    B.add('black', cyl(0.025, 0.025, 2.2, 8), mat(0, rodY + 0.02, z, 0, 0, Math.PI / 2));
    for (let k = 0; k < 3; k++) {
      const g = new PlaneGeometry(0.68, 1.0, 1, 6);
      g.translate(0, -0.5, 0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 3);
      const m = new Mesh(g, mats.noren);
      m.castShadow = true;
      const pivot = new Group();
      pivot.position.set((k - 1) * 0.7, rodY, z);
      pivot.add(m);
      group.add(pivot);
      noren.pivots.push(pivot);
    }
  }

  /* ── flanking bronze lanterns at the doorway, and the taiko drum ── */
  bronzeToro(B, -2.1, 0, -10.7, 1.1);
  bronzeToro(B, 2.1, 0, -10.7, 1.1);
  W.cyl(-2.1, -10.7, 0.4, 0, 2); W.cyl(2.1, -10.7, 0.4, 0, 2);
  flames.push(new Vector3(-2.1, 1.42, -10.7), new Vector3(2.1, 1.42, -10.7));
  {
    const x = 8.6, z = -8.6;
    const drum = projectUV(new CylinderGeometry(0.62, 0.62, 0.72, 32), 1, 1.2, 0.6);
    B.add('lacquer', drum, mat(x, 1.25, z, Math.PI / 4, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
      const ox = Math.cos(Math.PI / 4) * 0.37 * s, oz = -Math.sin(Math.PI / 4) * 0.37 * s;
      B.add('paper', cyl(0.6, 0.6, 0.012, 32), mat(x + ox, 1.25, z + oz, Math.PI / 4, 0, Math.PI / 2));
      // iron tacks around each drum head, in the plane perpendicular to the drum's axis
      const e2x = -Math.SQRT1_2, e2z = -Math.SQRT1_2;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        B.add('iron', ellipsoid(0.02, 0.02, 0.02, 6, 4), mat(x + ox * 0.97 + e2x * Math.cos(a) * 0.57, 1.25 + Math.sin(a) * 0.57, z + oz * 0.97 + e2z * Math.cos(a) * 0.57));
      }
    }
    for (const s of [-1, 1]) {
      const dx = -Math.SQRT1_2 * 0.55 * s, dz = Math.SQRT1_2 * 0.55 * s; // along the drum's axis
      B.add('cedar', box(0.1, 1.1, 0.1), mat(x + dx, 0.55, z + dz));
      B.add('cedar', box(0.5, 0.08, 0.1), mat(x + dx, 0.06, z + dz, -Math.PI / 4));
    }
    B.add('cedar', box(1.3, 0.08, 0.1), mat(x, 0.62, z, Math.PI / 4));
    for (const s of [-1, 1]) B.add('cedar', cyl(0.025, 0.03, 0.42, 8), mat(x + 0.6 + s * 0.05, 0.12, z + 0.6, 0, 0, Math.PI / 2 - 0.1));
    W.cyl(x, z, 0.75, 0, 2);
  }

  /* ── east gallery: tea alcove with the hanging scroll ── */
  {
    const x0 = 7.0, x1 = 11.6, z0 = -3.6, z1 = 3.6, y = 0.12;
    B.add('lacquer', box(x1 - x0 + 0.08, y, z1 - z0 + 0.08), mat((x0 + x1) / 2, y / 2 - 0.02, 0));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) tatami(B, x0 + 0.45 + i * 0.9 + 0.05, y - 0.05, z0 + 0.9 + j * 1.8, false);
    W.surface({ x0, x1, z0, z1, y });
    const TZ = -2; // the alcove sits in the middle of its bay, clear of the wall column
    // tokonoma: raised alcove floor, a natural-wood post, the scroll and an arrangement
    B.add('black', box(0.7, 0.2, 3.0), mat(11.42, y + 0.1, TZ));
    B.add('honey', box(0.66, 0.02, 2.94, 2, 2.4, 2.4), mat(11.43, y + 0.21, TZ));
    W.box(11.05, 11.8, 0, 1.4, TZ - 1.5, TZ + 1.5);
    const post = new CylinderGeometry(0.11, 0.14, 5.0, 10, 8);
    const pp = post.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const yy = pp.getY(i), a = Math.atan2(pp.getZ(i), pp.getX(i));
      const k = 1 + 0.12 * Math.sin(yy * 2.1 + a * 3) + 0.06 * Math.sin(yy * 5.3);
      pp.setXYZ(i, pp.getX(i) * k + Math.sin(yy * 0.9) * 0.03, yy, pp.getZ(i) * k);
    }
    post.computeVertexNormals();
    B.add('cedar', projectUV(post, 1), mat(11.12, 2.5, TZ + 1.62), 1.15);
    const sw = 0.9, sh = 2.02;
    const scroll = new Mesh(withColorGeo(new PlaneGeometry(sw, sh)), mats.scroll);
    scroll.position.set(11.88, 2.3, TZ);
    scroll.rotation.y = -Math.PI / 2;
    scroll.receiveShadow = true;
    group.add(scroll);
    B.add('black', cyl(0.022, 0.022, 1.0, 10), mat(11.86, 2.3 + sh / 2 + 0.01, TZ, 0, Math.PI / 2));
    B.add('black', cyl(0.028, 0.028, 1.04, 10), mat(11.86, 2.3 - sh / 2 - 0.02, TZ, 0, Math.PI / 2));
    for (const s of [-1, 1]) B.add('ceramicDark', ellipsoid(0.03, 0.03, 0.03, 8, 6), mat(11.86, 2.3 - sh / 2 - 0.02, TZ + s * 0.54));
    B.add('fabricBlack', cyl(0.004, 0.004, 0.5, 4), mat(11.88, 3.52, TZ - 0.17, Math.PI / 2, 0.62));
    B.add('fabricBlack', cyl(0.004, 0.004, 0.5, 4), mat(11.88, 3.52, TZ + 0.17, Math.PI / 2, -0.62));
    pot(B, 1, 11.45, y + 0.22, TZ + 0.95, 1.2, 'ceramicDark');
    // a maple branch in the vase
    for (let b = 0; b < 3; b++) {
      const a = -0.5 + b * 0.5;
      B.add('walnut', cyl(0.008, 0.014, 0.7, 6), mat(11.45, y + 0.22 + 0.95, TZ + 0.95 + a * 0.2, 0, a * 0.8, 0.2));
      for (let l = 0; l < 7; l++) {
        const t = 0.4 + l * 0.09;
        B.add('fabricRed', box(0.07, 0.005, 0.06), mat(11.45 - 0.1 + rand(-0.1, 0.1), y + 0.22 + 0.6 + t * 0.7, TZ + 0.95 + a * 0.45 + rand(-0.12, 0.12), rand(0, 3), rand(-0.6, 0.6)), 1.5);
      }
    }
    // tea: low table, brazier and kettle, bowls, cushions
    B.add('lacquer', box(1.0, 0.05, 0.7), mat(9.1, y + 0.3, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('lacquer', box(0.05, 0.28, 0.05), mat(9.1 + sx * 0.44, y + 0.14, sz * 0.29));
    pot(B, 2, 8.85, y + 0.325, -0.15, 1, 'ceramicDark');
    pot(B, 2, 9.3, y + 0.325, 0.1, 1, 'ceramic');
    W.box(8.55, 9.65, 0, 1.5, -0.4, 0.4);
    B.add('walnut', box(0.5, 0.3, 0.5), mat(9.1, y + 0.15, 1.15));
    B.add('stone', box(0.42, 0.02, 0.42, 0, 0.5, 0.5), mat(9.1, y + 0.3, 1.15), 0.7);
    B.add('iron', lathe([[0, 0], [0.12, 0.01], [0.17, 0.08], [0.15, 0.17], [0.07, 0.21], [0.05, 0.24], [0, 0.25]], 24), mat(9.1, y + 0.33, 1.15));
    smoke.push(new Vector3(9.1, y + 0.6, 1.15));
    W.box(8.8, 9.4, 0, 1.5, 0.85, 1.45);
    zabuton(B, 8.1, y, 0, Math.PI / 2, 'fabricIndigo', false);
    zabuton(B, 9.1, y, -1.0, 0, 'fabricIndigo', false);
    zabuton(B, 10.1, y, 0, Math.PI / 2, 'fabricIndigo', false);
    andon(B, 7.5, y, 3.1);
    andon(B, 7.5, y, -3.1);
  }

  /* ── west ground gallery: sutra chests ── */
  for (let k = 0; k < 3; k++) {
    B.add('lacquer', box(0.9, 0.45, 0.6), mat(-8.6, 0.23 + k * 0.47, -10.9), 1 - k * 0.05);
    B.add('gold', box(0.92, 0.03, 0.62), mat(-8.6, 0.44 + k * 0.47, -10.9));
  }
  W.box(-9.1, -8.1, 0, 2, -11.3, -10.5);
  pot(B, 0, -6.9, 0, -11.0, 1.6, 'ceramicDark');
  pot(B, 1, -6.3, 0, -11.2, 1.4);

  /* ── second floor: the rotating sutra library (rinzō) ── */
  const rinzoGroup = new Group();
  {
    const x = 0, z = -8, y = H1;
    B.add('stone', cyl(1.45, 1.55, 0.25, 8, 1, 1), mat(x, y + 0.125, z, Math.PI / 8));
    W.cyl(x, z, 1.5, y, y + 3);
    const R = new Batch();
    const r = 1.15, faces = 8;
    R.add('lacquer', cyl(r * 1.08, r * 1.08, 0.18, faces), mat(0, 0.36, 0, Math.PI / 8));
    R.add('lacquer', cyl(r, r, 2.4, faces), mat(0, 1.65, 0, Math.PI / 8));
    const apothem = r * Math.cos(Math.PI / faces), side = 2 * r * Math.sin(Math.PI / faces);
    for (let f = 0; f < faces; f++) {
      const a = (f / faces) * Math.PI * 2;
      const cx = Math.cos(a) * (apothem + 0.012), cz = Math.sin(a) * (apothem + 0.012), ry = -a + Math.PI / 2;
      for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) {
        const u = (col - 1) * (side / 3), v = 0.62 + row * 0.32;
        const px = cx + Math.cos(a + Math.PI / 2) * u, pz = cz + Math.sin(a + Math.PI / 2) * u;
        R.add('cedar', box(side / 3 - 0.04, 0.28, 0.03, 0), mat(px, v + 0.1, pz, ry), 1 + (row % 2) * 0.06);
        R.add('bronze', box(0.05, 0.03, 0.03, 0), mat(px + Math.cos(a) * 0.02, v + 0.1, pz + Math.sin(a) * 0.02, ry));
      }
      R.add('gold', box(0.04, 2.4, 0.04), mat(Math.cos(a + Math.PI / faces) * r, 1.65, Math.sin(a + Math.PI / faces) * r));
    }
    R.add('lacquer', cyl(r * 1.25, r * 1.05, 0.2, faces), mat(0, 2.95, 0, Math.PI / 8));
    R.add('tile', cyl(0.15, r * 1.32, 0.55, faces), mat(0, 3.33, 0, Math.PI / 8));
    R.add('gold', ellipsoid(0.1, 0.16, 0.1), mat(0, 3.7, 0));
    rinzoGroup.add(R.build(mats));
    rinzoGroup.position.set(x, y + 0.25, z);
    group.add(rinzoGroup);
  }
  // second floor reading desks and cushions
  for (const z of [-1.6, 1.6]) {
    B.add('lacquer', box(1.1, 0.04, 0.4), mat(-7.2, H1 + 0.3, z));
    for (const s of [-1, 1]) B.add('lacquer', box(0.04, 0.28, 0.36), mat(-7.2 + s * 0.5, H1 + 0.14, z));
    B.add('paper', box(0.5, 0.01, 0.3), mat(-7.25, H1 + 0.33, z), 1);
    zabuton(B, -6.3, H1, z, Math.PI / 2, 'fabricIndigo', false);
    W.box(-7.8, -6.6, H1, H1 + 1.2, z - 0.25, z + 0.25);
  }
  andon(B, -7.2, H1, 0);
  for (const x of [-6, -2, 2, 6]) zabuton(B, x, H1, 9.8, 0, 'fabricRed', false);
  // scroll racks along the lantern corridor
  for (const z of [-9, 9]) {
    B.add('walnut', box(0.5, 1.6, 2.4), mat(11.35, H1 + 0.8, z));
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      B.add(k % 3 ? 'paper' : 'fabricIndigo', cyl(0.045, 0.045, 0.45, 8), mat(11.1, H1 + 0.25 + r * 0.38, z - 1 + k * 0.4, 0, 0, Math.PI / 2));
    }
    W.box(11.0, 11.8, H1, H1 + 2, z - 1.3, z + 1.3);
  }

  /* ── third floor: the temple bell (bonshō) and its striker ── */
  const bellGroup = new Group();
  const strikerGroup = new Group();
  {
    const x = 0, z = -8, hook = H3 - 0.1;
    B.add('cedar', box(0.5, 0.4, 3.0), mat(x, H3 - 0.2, z));
    B.add('iron', box(0.12, 0.3, 0.12), mat(x, hook - 0.25, z));
    const Bb = new Batch();
    // profile from the open mouth up to the domed crown (kasa)
    const bellProfile: [number, number][] = [
      [0.5, -1.55], [0.6, -1.62], [0.655, -1.6], [0.66, -1.52], [0.615, -1.42], [0.6, -1.2], [0.585, -0.8], [0.575, -0.45],
      [0.56, -0.3], [0.53, -0.2], [0.47, -0.12], [0.37, -0.06], [0.24, -0.025], [0.1, -0.01], [0, 0],
    ];
    Bb.add('bellBronze', lathe(bellProfile, 48), mat(0, 0, 0));
    // horizontal bands and the four vertical bands that divide the bell into panels
    for (const [y, r] of [[-1.47, 0.625], [-1.12, 0.6], [-1.06, 0.6], [-0.46, 0.583], [-0.4, 0.58]] as [number, number][]) {
      Bb.add('bellBronze', projectUV(new TorusGeometry(r, 0.02, 6, 48).rotateX(Math.PI / 2), 1), mat(0, y, 0), 1.15);
    }
    for (let q = 0; q < 4; q++) {
      const a0 = (q / 4) * Math.PI * 2;
      for (const off of [-0.035, 0.035]) {
        const a = a0 + off;
        Bb.add('bellBronze', box(0.025, 0.66, 0.03), mat(Math.cos(a) * 0.585, -0.76, Math.sin(a) * 0.585, -a), 1.15);
      }
      // a grid of raised bosses (chi) in each upper panel
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
        const a = a0 + 0.3 + i * 0.235;
        Bb.add('bellBronze', ellipsoid(0.026, 0.026, 0.026, 8, 6), mat(Math.cos(a) * 0.583, -0.54 - j * 0.11, Math.sin(a) * 0.583), 1.2);
      }
      // striking pad (tsukiza) as a lotus boss on the lower band, facing the striker
      if (q === 0 || q === 2) {
        Bb.add('bellBronze', projectUV(new CylinderGeometry(0.11, 0.12, 0.03, 16).rotateZ(Math.PI / 2), 1), mat(Math.cos(a0) * 0.6, -1.28, Math.sin(a0) * 0.6), 1.2);
        for (let k = 0; k < 8; k++) {
          const t = (k / 8) * Math.PI * 2;
          Bb.add('bellBronze', ellipsoid(0.012, 0.035, 0.012, 6, 4), mat(Math.cos(a0) * 0.625, -1.28 + Math.sin(t) * 0.07, Math.sin(a0) * 0.625 + Math.cos(t) * 0.07 * (q === 0 ? 1 : -1)), 1.25);
        }
      }
    }
    // dragon-head hanging loop (ryūzu)
    Bb.add('bellBronze', projectUV(new TorusGeometry(0.13, 0.045, 10, 24), 1), mat(0, 0.13, 0), 1.1);
    Bb.add('bellBronze', ellipsoid(0.09, 0.07, 0.16), mat(0, 0.05, 0), 1.1);
    bellGroup.add(Bb.build(mats));
    bellGroup.position.set(x, hook - 0.35, z);
    group.add(bellGroup);
    // striker log hung on two ropes beside the bell
    const Sb = new Batch();
    Sb.add('cedar', projectUV(new CylinderGeometry(0.11, 0.11, 1.6, 14).rotateZ(Math.PI / 2), 0, 0.8, 0.8), mat(0, -1.05, 0), 1.1);
    for (const s of [-0.5, 0.5]) Sb.add('fabricBlack', cyl(0.012, 0.012, 1.05, 6), mat(s, -0.52, 0));
    strikerGroup.add(Sb.build(mats));
    strikerGroup.position.set(x + 1.55, hook, z);
    group.add(strikerGroup);
    B.add('cedar', box(1.4, 0.12, 0.12), mat(x + 1.55, hook + 0.03, z));
    W.cyl(x, z, 0.75, H2, H2 + 5);
    W.box(x + 0.7, x + 2.4, H2, H2 + 5, z - 0.2, z + 0.2);
  }
  for (const x of [-5, 5]) zabuton(B, x, H2, 9.6, 0, 'fabricRed', false);
  B.add('lacquer', box(1.2, 0.04, 0.5), mat(0, H2 + 0.3, 9.6));
  for (const s of [-1, 1]) B.add('lacquer', box(0.04, 0.28, 0.46), mat(s * 0.55, H2 + 0.14, 9.6));
  pot(B, 2, -0.2, H2 + 0.32, 9.6); pot(B, 2, 0.25, H2 + 0.32, 9.65, 1, 'ceramicDark');
  W.box(-0.7, 0.7, H2, H2 + 1.2, 9.3, 9.9);
  for (const [x, z] of [[-10.6, -10.6], [-9.7, -10.9], [10.6, 10.6], [10.9, 9.6], [-10.8, 6.5]] as [number, number][]) {
    pot(B, 0, x, H2, z, 2.2, Math.random() > 0.5 ? 'ceramicDark' : 'ceramic');
    W.cyl(x, z, 0.5, H2, H2 + 1.5);
  }

  /* ── the Sacred Hall ── */
  {
    const az = ANNEX.z0;
    // stepped altar (shumidan)
    const alt = (w: number, h: number, d: number, y: number, key = 'lacquer') => B.add(key, box(w, h, d), mat(0, y + h / 2, az + 1.5));
    alt(5.4, 0.25, 2.3, 0);
    alt(4.8, 0.45, 1.9, 0.25);
    alt(5.4, 0.16, 2.3, 0.7);
    for (const y of [0.25, 0.7, 0.86]) B.add('gold', box(5.42, 0.025, 2.32), mat(0, y, az + 1.5));
    for (let k = 0; k < 6; k++) B.add('gold', box(0.3, 0.3, 0.01), mat(-2.0 + k * 0.8, 0.475, az + 1.5 + 0.955));
    W.box(-2.8, 2.8, 0, 3, az + 0.2, az + 2.75);
    // lotus pedestal and relic jewel
    const ly = 0.86;
    B.add('gold', cyl(0.55, 0.65, 0.18, 32), mat(0, ly + 0.09, az + 1.4));
    B.add('lacquer', cyl(0.42, 0.5, 0.2, 32), mat(0, ly + 0.28, az + 1.4));
    for (let row = 0; row < 3; row++) {
      const n = 14 - row * 2;
      for (let k = 0; k < n; k++) {
        const a = ((k + row * 0.5) / n) * Math.PI * 2;
        const r = 0.62 - row * 0.14;
        B.add('gold', ellipsoid(0.12 - row * 0.015, 0.26 - row * 0.03, 0.05), mat(Math.cos(a) * r, ly + 0.5 + row * 0.08, az + 1.4 + Math.sin(a) * r, -a + Math.PI / 2).multiply(mat(0, 0, 0, 0, 0.55 - row * 0.12)), 1 - row * 0.05);
      }
    }
    const relic = new Mesh(withColorGeo(new SphereGeometry(0.3, 40, 24)), new MeshStandardMaterial({
      color: '#f3e6cb', emissive: new Color('#ffcf8f'), emissiveIntensity: 0.45, roughness: 0.18, metalness: 0, vertexColors: true,
    }));
    relic.position.set(0, ly + 0.92, az + 1.4);
    group.add(relic);
    B.add('gold', projectUV(new TorusGeometry(0.33, 0.02, 8, 40).rotateX(Math.PI / 2), 1), mat(0, ly + 0.7, az + 1.4));
    // halo (kōhai) with radiating rays
    const hz = az + 0.62, hy = ly + 1.25;
    B.add('bronze', projectUV(new CylinderGeometry(1.25, 1.25, 0.04, 48).rotateX(Math.PI / 2), 1), mat(0, hy, hz), 0.55);
    B.add('gold', projectUV(new TorusGeometry(1.25, 0.04, 8, 64), 1), mat(0, hy, hz + 0.03));
    B.add('gold', projectUV(new TorusGeometry(0.62, 0.025, 8, 48), 1), mat(0, hy, hz + 0.03));
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      B.add('gold', box(0.025, 0.5, 0.02), mat(Math.cos(a) * 0.93, hy + Math.sin(a) * 0.93, hz + 0.03, 0, 0, a - Math.PI / 2));
    }
    B.add('bronze', box(0.08, hy - ly, 0.08), mat(0, (hy + ly) / 2 - 0.3, hz - 0.05));
    // canopy (tengai) with strings of gilt beads
    const cy = ANNEX.h - 1.25;
    B.add('gold', cyl(1.3, 1.3, 0.22, 8, 2, 2, true), mat(0, cy, az + 1.6, Math.PI / 8));
    B.add('lacquer', cyl(1.28, 1.28, 0.04, 8), mat(0, cy + 0.1, az + 1.6, Math.PI / 8));
    B.add('black', cyl(0.02, 0.02, 0.9, 6), mat(0, cy + 0.55, az + 1.6));
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const len = k % 2 ? 0.55 : 0.85;
      for (let b = 0; b < len / 0.08; b++) B.add('gold', ellipsoid(0.022, 0.03, 0.022, 6, 4), mat(Math.cos(a) * 1.22, cy - 0.15 - b * 0.08, az + 1.6 + Math.sin(a) * 1.22));
    }
    // candle stands, standing lanterns, offering table, incense
    flames.push(candleStand(B, -2.2, 0.86, az + 1.2, 0.5), candleStand(B, 2.2, 0.86, az + 1.2, 0.5));
    flames.push(candleStand(B, -3.3, 0, az + 3.4, 1.15), candleStand(B, 3.3, 0, az + 3.4, 1.15));
    W.cyl(-3.3, az + 3.4, 0.25, 0, 2); W.cyl(3.3, az + 3.4, 0.25, 0, 2);
    bronzeToro(B, -4.6, 0, az + 1.0, 1.25); bronzeToro(B, 4.6, 0, az + 1.0, 1.25);
    flames.push(new Vector3(-4.6, 1.62, az + 1.0), new Vector3(4.6, 1.62, az + 1.0));
    W.cyl(-4.6, az + 1.0, 0.5, 0, 2); W.cyl(4.6, az + 1.0, 0.5, 0, 2);
    const ot = az + 3.55;
    B.add('lacquer', box(1.8, 0.05, 0.6), mat(0, 0.62, ot));
    for (const s of [-1, 1]) B.add('lacquer', box(0.06, 0.6, 0.56), mat(s * 0.84, 0.3, ot));
    B.add('gold', box(1.82, 0.015, 0.62), mat(0, 0.6, ot));
    smoke.push(koro(B, 0, 0.645, ot, 1.25));
    for (const s of [-1, 1]) {
      pot(B, 1, s * 0.6, 0.645, ot, 1, 'ceramic');
      for (let b = 0; b < 4; b++) B.add('walnut', cyl(0.006, 0.01, 0.6, 5), mat(s * 0.6 + rand(-0.05, 0.05), 0.645 + 0.85, ot + rand(-0.05, 0.05), rand(0, 6), rand(-0.3, 0.3), rand(-0.3, 0.3)));
    }
    W.box(-1, 1, 0, 1.5, ot - 0.35, ot + 0.35);
    // tatami field and cushions for the hall
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) tatami(B, -4.5 + i * 1.8, 0, -12.85 - j * 0.9, true);
    for (const x of [-1.5, 0, 1.5]) zabuton(B, x, 0.05, -13.7, 0, 'fabricRed', true);
    andon(B, -5.3, 0, -12.8); andon(B, 5.3, 0, -12.8);
  }

  // andon lamps in the corners of the south gallery and the upper floors
  andon(B, -10.8, 0, 10.8); andon(B, 10.8, 0, 10.8);
  andon(B, 10.6, H1, -10.6); andon(B, -10.6, H2, 10.6);

  return {
    group, smoke, flames,
    rinzo: { obj: rinzoGroup, spin: 0 },
    bell: { bell: { obj: bellGroup, angle: 0, vel: 0 }, striker: { obj: strikerGroup, angle: 0, vel: 0 } },
    banners, noren,
  };
}

function withColorGeo<T extends import('three').BufferGeometry>(g: T): T {
  g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}
