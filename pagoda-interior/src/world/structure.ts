import { ExtrudeGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, Shape, BoxGeometry, Object3D } from 'three';
import { Batch, box, cyl, mat, projectUV, squareFrustum } from '../core/geo';
import {
  ANNEX, BAYS, CLR_BOT, CLR_TOP, CLR_WIN, ENGAWA, H1, H2, H3, IN, OUT, RISER, SLAB, STAIR1, STAIR2, TREAD, VOID,
  intervalMinus, rectMinusHoles, type Rect,
} from '../core/layout';
import type { CollisionWorld } from './collision';

export type Side = 'N' | 'S' | 'E' | 'W';
type BayType = 'window' | 'door' | 'open' | 'openWindow' | 'slide' | 'fusuma' | 'plaster' | 'katomado';

interface Storey { y0: number; yt: number; ws: number; wt: number; renji: boolean }
const G: Storey = { y0: 0, yt: 5.1, ws: 0.9, wt: 2.75, renji: true };
const L2: Storey = { y0: H1, yt: H2 - SLAB - 0.55, ws: 1.3, wt: 2.9, renji: false };
const L3: Storey = { y0: H2, yt: H3 - 0.5, ws: 1.2, wt: 2.5, renji: false };

const SIDE_RY: Record<Side, number> = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };
/** Wall-local (u along wall, n inward) → world x/z. */
export function wxz(side: Side, u: number, n: number): [number, number] {
  switch (side) {
    case 'S': return [u, OUT - n];
    case 'N': return [u, -OUT + n];
    case 'E': return [OUT - n, u];
    case 'W': return [-OUT + n, u];
  }
}
function frame(side: Side, u: number, y: number, n: number): Matrix4 {
  const [x, z] = wxz(side, u, n);
  return mat(x, y, z, SIDE_RY[side]);
}

export interface SlidingBay {
  side: Side;
  center: { x: number; z: number };
  panels: { obj: Object3D; closedU: number; openU: number; n: number }[];
  open: number;
  target: number;
  auto: boolean;
}

export interface StructureResult {
  sliding: SlidingBay[];
  slidingGroup: Group;
  shadowShell: Group;
}

const PANEL_W = 0.86;

export function buildStructure(B: Batch, W: CollisionWorld, mats: Record<string, import('three').Material>): StructureResult {
  const wb = (key: string, side: Side, u0: number, u1: number, y0: number, y1: number, n0: number, n1: number, tint = 1) =>
    B.add(key, box(u1 - u0, y1 - y0, n1 - n0), frame(side, (u0 + u1) / 2, (y0 + y1) / 2, (n0 + n1) / 2), tint);

  /* ───────────────────────── foundation & ground floor ───────────────────────── */
  B.add('stone', box(25.4, 0.62, 25.4, 0, 1.2, 1.2), mat(0, -0.32, 0));
  B.add('honey', box(24, 0.06, 24, 2, 2.4, 2.4), mat(0, -0.03, 0));
  W.surface({ x0: -OUT, x1: OUT, z0: -OUT, z1: OUT, y: 0 });

  /* ───────────────────────── columns ───────────────────────── */
  const column = (x: number, z: number, y0: number, y1: number, r: number, key: string, ground: boolean, bands: number[] = []) => {
    let base = y0;
    if (ground) {
      B.add('stone', cyl(r * 1.75, r * 1.9, 0.2, 8, 1, 1), mat(x, y0 + 0.1, z, Math.PI / 8));
      B.add('stone', cyl(r * 1.12, r * 1.45, 0.12, 24, 1, 1), mat(x, y0 + 0.26, z));
      base = y0 + 0.32;
    }
    B.add('bronze', cyl(r * 1.05, r * 1.07, 0.16, 24), mat(x, base + 0.08, z));
    B.add('gold', cyl(r * 1.075, r * 1.075, 0.025, 24), mat(x, base + 0.17, z));
    B.add(key, cyl(r * 0.94, r, y1 - base, 24), mat(x, (base + y1) / 2, z));
    for (const b of bands) B.add('gold', cyl(r * 1.03, r * 1.03, 0.05, 24), mat(x, b, z));
    // bearing block (daito) as a capital
    B.add('cedar', squareFrustum(r * 1.45, r * 1.15, 0.3), mat(x, y1 - 0.15, z));
    W.cyl(x, z, r, y0, y1);
  };

  const outerCols: [number, number][] = [];
  for (const u of BAYS) {
    outerCols.push([u, -OUT], [u, OUT]);
    if (Math.abs(u) !== OUT) outerCols.push([-OUT, u], [OUT, u]);
  }
  const storeys = [G, L2, L3];
  storeys.forEach((s, i) => {
    for (const [x, z] of outerCols) {
      if (i === 0 && x === 0 && z === -OUT) continue; // the carved doorway spans this bay
      column(x, z, s.y0, s.yt, 0.28, 'walnut', i === 0);
    }
  });
  const innerCols: [number, number][] = [[-IN, -IN], [0, -IN], [IN, -IN], [-IN, 0], [IN, 0], [-IN, IN], [0, IN], [IN, IN]];
  for (const [x, z] of innerCols) column(x, z, 0, CLR_BOT, 0.42, 'walnut', true, [H1 + 0.22, H2 + 0.22, 4.4, 10.0, 14.6]);
  // Annex columns
  for (const [x, z] of [[-6, -16], [6, -16], [-6, -20], [6, -20], [0, -20]] as [number, number][]) column(x, z, 0, ANNEX.h - 0.5, 0.26, 'walnut', true);

  /* ───────────────────────── beams ───────────────────────── */
  const beamX = (x0: number, x1: number, z: number, yTop: number, h = 0.55, d = 0.32, key = 'cedar') =>
    B.add(key, box(x1 - x0, h, d), mat((x0 + x1) / 2, yTop - h / 2, z));
  const beamZ = (z0: number, z1: number, x: number, yTop: number, h = 0.55, d = 0.32, key = 'cedar') =>
    B.add(key, box(d, h, z1 - z0), mat(x, yTop - h / 2, (z0 + z1) / 2));

  const ringBeams = (yTop: number, half: number, ext = 0.3) => {
    beamX(-half - ext, half + ext, -half, yTop); beamX(-half - ext, half + ext, half, yTop);
    beamZ(-half - ext, half + ext, -half, yTop); beamZ(-half - ext, half + ext, half, yTop);
  };
  const levelBeams = (yTop: number) => {
    ringBeams(yTop, OUT);
    ringBeams(yTop, IN);
    for (const g of [-IN, 0, IN]) {
      beamZ(-OUT, -IN, g, yTop, 0.5, 0.3); beamZ(IN, OUT, g, yTop, 0.5, 0.3);
      beamX(-OUT, -IN, g, yTop, 0.5, 0.3); beamX(IN, OUT, g, yTop, 0.5, 0.3);
    }
  };
  levelBeams(H1 - SLAB);
  levelBeams(H2 - SLAB);
  levelBeams(H3);
  // Penetrating tie beams (nuki) on the tall atrium columns.
  for (const y of [3.4, 9.1, 14.0]) ringBeams(y, IN, 0.25);

  /* ───────────────────────── upper floors ───────────────────────── */
  const voidRect: Rect = { x0: -VOID, x1: VOID, z0: -VOID, z1: VOID };
  const hole1: Rect = { x0: -OUT, x1: STAIR1.x1, z0: STAIR1.zHigh, z1: STAIR1.zLow };
  const hole2: Rect = { x0: STAIR2.x0, x1: OUT, z0: STAIR2.zLow, z1: STAIR2.zHigh };

  const floorSlab = (H: number, hole: Rect) => {
    for (const r of rectMinusHoles({ x0: -OUT, x1: OUT, z0: -OUT, z1: OUT }, [voidRect, hole])) {
      B.add('honey', box(r.x1 - r.x0, SLAB, r.z1 - r.z0, 2, 2.4, 2.4), mat((r.x0 + r.x1) / 2, H - SLAB / 2, (r.z0 + r.z1) / 2));
    }
    W.surface({ x0: -OUT, x1: OUT, z0: -OUT, z1: OUT, y: H, holes: [voidRect, hole] });
    const yj = H - SLAB - 0.12;
    // Joists: N/S bands run along z, E/W bands along x; cut around the stairwell.
    for (let x = -11.5; x <= 11.5; x += 1) {
      const cuts: [number, number][] = x > hole.x0 && x < hole.x1 ? [[hole.z0, hole.z1]] : [];
      for (const [a, b] of intervalMinus(-OUT, -VOID, cuts)) B.add('cedar', box(0.16, 0.24, b - a), mat(x, yj, (a + b) / 2));
      for (const [a, b] of intervalMinus(VOID, OUT, cuts)) B.add('cedar', box(0.16, 0.24, b - a), mat(x, yj, (a + b) / 2));
    }
    for (let z = -2.5; z <= 2.5; z += 1) {
      const cuts: [number, number][] = z > hole.z0 && z < hole.z1 ? [[hole.x0, hole.x1]] : [];
      for (const [a, b] of intervalMinus(-OUT, -VOID, cuts)) B.add('cedar', box(b - a, 0.24, 0.16), mat((a + b) / 2, yj, z));
      for (const [a, b] of intervalMinus(VOID, OUT, cuts)) B.add('cedar', box(b - a, 0.24, 0.16), mat((a + b) / 2, yj, z));
    }
    // Trimmers around the stairwell.
    const inner = hole.x0 < 0 ? hole.x1 : hole.x0;
    beamZ(hole.z0, hole.z1, inner, H - SLAB, 0.4, 0.2);
    beamX(hole.x0, hole.x1, hole.z0, H - SLAB, 0.4, 0.2);
    beamX(hole.x0, hole.x1, hole.z1, H - SLAB, 0.4, 0.2);

    // Cantilevered balcony: beams from the atrium columns to the void edge…
    for (const g of [0]) {
      beamZ(-IN, -VOID, g, H - SLAB); beamZ(VOID, IN, g, H - SLAB);
      beamX(-IN, -VOID, g, H - SLAB); beamX(VOID, IN, g, H - SLAB);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const len = (IN - VOID) * Math.SQRT2;
      B.add('cedar', box(len, 0.55, 0.32), mat(sx * (IN + VOID) / 2, H - SLAB - 0.275, sz * (IN + VOID) / 2, Math.atan2(-sz, sx)));
    }
    // …a lacquered fascia that wraps the slab edge, with gilt corner fittings…
    for (const s of [-1, 1]) {
      B.add('lacquer', box(2 * VOID + 0.28, SLAB + 0.5, 0.14), mat(0, H - (SLAB + 0.5) / 2 + 0.02, s * (VOID + 0.07)));
      B.add('lacquer', box(0.14, SLAB + 0.5, 2 * VOID), mat(s * (VOID + 0.07), H - (SLAB + 0.5) / 2 + 0.02, 0));
      B.add('gold', box(2 * VOID + 0.3, 0.03, 0.16), mat(0, H - SLAB - 0.47, s * (VOID + 0.07)));
      B.add('gold', box(0.16, 0.03, 2 * VOID + 0.3), mat(s * (VOID + 0.07), H - SLAB - 0.47, 0));
      for (const t of [-1, 1]) B.add('gold', box(0.18, SLAB + 0.52, 0.18), mat(s * (VOID + 0.07), H - (SLAB + 0.5) / 2 + 0.02, t * (VOID + 0.07)), 0.9);
    }
    // …carried on three-stepped bracket sets (mitesaki tokyō) at every atrium column.
    for (const [cx, cz] of innerCols) {
      const dx = -Math.sign(cx), dz = -Math.sign(cz);
      const len = Math.hypot(dx, dz);
      bracketSet(cx, cz, dx / len, dz / len, H - SLAB - 0.55, len > 1.1 ? 1.35 : 1);
    }
  };

  const bracketSet = (cx: number, cz: number, ux: number, uz: number, yTop: number, reach: number) => {
    const ry = Math.atan2(-uz, ux);
    const place = (key: string, w: number, h: number, d: number, along: number, y: number, side = 0) => {
      const x = cx + ux * along + uz * side, z = cz + uz * along - ux * side;
      B.add(key, box(w, h, d, 0), mat(x, y, z, ry));
    };
    const arms = [1.25 * reach, 0.9 * reach, 0.55 * reach];
    for (let k = 0; k < 3; k++) {
      const top = yTop - k * 0.36;
      const len = arms[k];
      // small bearing blocks (makito) under the tier above
      for (const a of [len - 0.12, len * 0.55, 0.15]) place('cedar', 0.24, 0.14, 0.26, a, top - 0.07);
      // the arm (hijiki), running from the column to the tip
      place('walnut', len + 0.1, 0.22, 0.22, len / 2, top - 0.25);
      // a crossing arm parallel to the balcony edge
      if (k < 2) {
        place('walnut', 0.22, 0.2, 1.0 - k * 0.25, 0.1, top - 0.24);
        for (const s of [-1, 1]) place('cedar', 0.22, 0.13, 0.22, 0.1, top - 0.07, s * (0.42 - k * 0.12));
      }
      // gilt end caps on the arm tips
      place('gold', 0.04, 0.2, 0.2, len + 0.07, top - 0.25);
    }
    place('cedar', 0.62, 0.3, 0.62, 0, yTop - 3 * 0.36 + 0.08); // bearing block on the column
  };

  floorSlab(H1, hole1);
  floorSlab(H2, hole2);

  /* ───────────────────────── outer walls ───────────────────────── */
  const sliding: SlidingBay[] = [];
  const slidingGroup = new Group();
  slidingGroup.name = 'sliding-screens';

  const shojiPanel = (Bt: Batch, M: Matrix4, pw: number, ph: number, paperKey: string, door: boolean) => {
    const add = (key: string, w: number, h: number, d: number, x: number, y: number, z: number) =>
      Bt.add(key, box(w, h, d), M.clone().multiply(mat(x, y, z)));
    add('board', 0.045, ph, 0.04, -pw / 2 + 0.0225, ph / 2, 0);
    add('board', 0.045, ph, 0.04, pw / 2 - 0.0225, ph / 2, 0);
    add('board', pw, 0.05, 0.04, 0, ph - 0.025, 0);
    const bottom = door ? 0.3 : 0.06;
    add('board', pw, bottom, 0.04, 0, bottom / 2, 0);
    for (let k = 1; k < 4; k++) add('board', 0.014, ph - bottom, 0.022, -pw / 2 + (pw * k) / 4, bottom + (ph - bottom) / 2, 0.006);
    const rows = Math.max(3, Math.round((ph - bottom) / 0.3));
    for (let k = 1; k < rows; k++) add('board', pw - 0.06, 0.014, 0.022, 0, bottom + ((ph - bottom) * k) / rows, 0.006);
    const paper = projectUV(new BoxGeometry(pw - 0.05, ph - bottom - 0.03, 0.003), 1, 0.9, 0.9);
    Bt.add(paperKey, paper, M.clone().multiply(mat(0, bottom + (ph - bottom) / 2, -0.012)));
  };

  const fusumaPanels = (side: Side, a: number, b: number, y0: number, h: number, key: string) => {
    const w = b - a;
    const g = projectUV(new BoxGeometry(w, h, 0.03), 1, w, h, 0.5, 0.5);
    B.add(key, g, frame(side, (a + b) / 2, y0 + h / 2, 0));
    for (let k = 0; k <= 4; k++) wb('black', side, a + (w * k) / 4 - 0.02, a + (w * k) / 4 + 0.02, y0, y0 + h, -0.03, 0.03, 1);
    wb('black', side, a, b, y0 + h - 0.04, y0 + h, -0.035, 0.035);
    for (let k = 0; k < 4; k++) {
      const u = a + (w * (k + 0.5)) / 4 + (k % 2 ? -0.32 : 0.32);
      B.add('bronze', cyl(0.045, 0.045, 0.01, 16), frame(side, u, y0 + h * 0.42, 0.02).multiply(mat(0, 0, 0, 0, Math.PI / 2)));
    }
  };

  const bay = (side: Side, a: number, b: number, s: Storey, type: BayType, outerPaper = 'paperLit') => {
    const c = (a + b) / 2, i0 = a + 0.28, i1 = b - 0.28;
    const y0 = s.y0, wt = y0 + s.wt;
    const isDoor = type === 'door' || type === 'open' || type === 'slide';
    const ws = isDoor ? y0 + 0.08 : y0 + s.ws;
    wb('cedar', side, a, b, y0, y0 + 0.08, -0.13, 0.13); // threshold (shikii)
    if (!isDoor && type !== 'fusuma' && type !== 'plaster') {
      wb('board', side, i0, i1, y0 + 0.08, ws - 0.06, -0.03, 0.03);
      for (let u = i0 + 0.43; u < i1 - 0.1; u += 0.43) wb('cedar', side, u - 0.025, u + 0.025, y0 + 0.08, ws - 0.06, 0.03, 0.055);
      wb('cedar', side, a, b, ws - 0.06, ws, -0.1, 0.1);
    }
    const ph = wt - ws;
    if (type === 'fusuma') {
      fusumaPanels(side, i0, i1, y0 + 0.08, wt - y0 - 0.08, side === 'N' ? 'ink' : 'ink2');
    } else if (type === 'plaster') {
      wb('plaster', side, i0, i1, y0 + 0.08, wt, -0.08, 0.08);
      wb('board', side, i0, i1, y0 + 0.08, y0 + 0.5, -0.09, 0.09);
    } else {
      const closedU = [-1.5, -0.5, 0.5, 1.5].map((k) => c + k * PANEL_W);
      const track = [-0.03, 0.03, 0.03, -0.03];
      const openFrac = type === 'open' || type === 'openWindow' ? 1 : 0;
      const movable = type === 'slide';
      const sb: SlidingBay | null = movable
        ? { side, center: (() => { const [x, z] = wxz(side, c, 0); return { x, z }; })(), panels: [], open: 0, target: 0, auto: true }
        : null;
      closedU.forEach((u0, k) => {
        const inner = k === 1 || k === 2;
        const openU = inner ? c + (k === 1 ? -1.5 : 1.5) * PANEL_W : u0;
        if (movable && inner) {
          const Bt = new Batch();
          shojiPanel(Bt, new Matrix4(), PANEL_W + 0.02, ph, outerPaper, isDoor);
          const g = Bt.build(mats, true, true);
          g.matrixAutoUpdate = true;
          const [x, z] = wxz(side, u0, track[k] + 0.02);
          g.position.set(x, ws, z);
          g.rotation.y = SIDE_RY[side];
          slidingGroup.add(g);
          sb!.panels.push({ obj: g, closedU: u0, openU, n: track[k] + 0.02 });
        } else {
          const u = u0 + (openU - u0) * openFrac;
          shojiPanel(B, frame(side, u, ws, track[k] + (inner ? 0.02 : 0)), PANEL_W + 0.02, ph, outerPaper, isDoor);
        }
      });
      if (sb) sliding.push(sb);
    }
    if (type === 'plaster') {
      wb('plaster', side, i0, i1, wt, wt + 0.8, -0.08, 0.08); // a plain alcove wall for the hanging scroll
    } else {
      wb('cedar', side, a, b, wt, wt + 0.12, -0.1, 0.1); // head rail (kamoi)
      // carved transom (ranma) in the asanoha pattern
      const rg = projectUV(new BoxGeometry(i1 - i0, 0.6, 0.03), 0, 0.6, 0.6, 0, 0.5);
      B.add('asanoha', rg, frame(side, c, wt + 0.42, 0));
      wb('cedar', side, a, b, wt + 0.72, wt + 0.8, -0.08, 0.08);
    }
    wb('cedar', side, a - 0.3, b + 0.3, wt + 0.8, wt + 0.98, -0.11, 0.11); // nuki
    let top = wt + 0.98;
    if (s.renji) {
      const r1 = top + 0.87;
      for (let u = i0 + 0.06; u < i1; u += 0.12) wb('cedar', side, u - 0.025, u + 0.025, top, r1, -0.04, 0.04);
      wb('cedar', side, a, b, r1, r1 + 0.1, -0.09, 0.09);
      top = r1 + 0.1;
    }
    wb('plaster', side, i0, i1, top, s.yt, -0.08, 0.08);
  };

  const groundPlan: Record<Side, BayType[]> = {
    S: ['window', 'slide', 'open', 'open', 'slide', 'window'],
    N: ['window', 'fusuma', 'katomado', 'katomado', 'fusuma', 'window'],
    E: ['window', 'window', 'plaster', 'plaster', 'window', 'window'],
    W: ['window', 'window', 'window', 'window', 'window', 'window'],
  };
  const l2Plan: Record<Side, BayType[]> = {
    S: ['window', 'openWindow', 'openWindow', 'openWindow', 'openWindow', 'window'],
    N: ['window', 'window', 'window', 'window', 'window', 'window'],
    E: ['window', 'window', 'openWindow', 'window', 'window', 'window'],
    W: ['window', 'window', 'window', 'window', 'openWindow', 'window'],
  };
  const l3Plan: Record<Side, BayType[]> = {
    S: ['window', 'openWindow', 'window', 'window', 'openWindow', 'window'],
    N: ['window', 'window', 'window', 'window', 'window', 'window'],
    E: ['window', 'openWindow', 'window', 'window', 'window', 'window'],
    W: ['window', 'window', 'window', 'openWindow', 'window', 'window'],
  };
  const sides: Side[] = ['N', 'S', 'E', 'W'];
  for (const [plan, s] of [[groundPlan, G], [l2Plan, L2], [l3Plan, L3]] as [Record<Side, BayType[]>, Storey][]) {
    for (const side of sides) {
      plan[side].forEach((t, i) => {
        if (t === 'katomado') return;
        bay(side, BAYS[i], BAYS[i + 1], s, t);
      });
    }
  }

  // Wall collision. Ground floor keeps its openings; upper walls are solid.
  const wallBox = (side: Side, u0: number, u1: number, y0: number, y1: number, on?: () => boolean) => {
    const [xa, za] = wxz(side, u0, -0.3), [xb, zb] = wxz(side, u1, 0.25);
    W.box(xa, xb, y0, y1, za, zb, on);
  };
  for (const side of sides) {
    groundPlan[side].forEach((t, i) => {
      const a = BAYS[i], b = BAYS[i + 1], c = (a + b) / 2;
      if (t === 'katomado') return;
      if (t === 'open' || t === 'slide') {
        wallBox(side, a, c - PANEL_W, 0, 5.2);
        wallBox(side, c + PANEL_W, b, 0, 5.2);
        if (t === 'slide') {
          const sb = sliding.find((s) => Math.abs((side === 'S' || side === 'N' ? s.center.x : s.center.z) - c) < 0.1 && s.side === side)!;
          wallBox(side, c - PANEL_W, c + PANEL_W, 0, 5.2, () => sb.open < 0.6);
        }
      } else wallBox(side, a, b, 0, 5.2);
    });
    wallBox(side, -OUT - 0.3, OUT + 0.3, H1, H1 + 5);
    wallBox(side, -OUT - 0.3, OUT + 0.3, H2, H2 + 4.5);
  }

  /* ───────────────────────── carved doorway (katōmado) ───────────────────────── */
  const bellRight: [string, number[]][] = [
    ['L', [1.15, 0]], ['L', [1.06, 1.85]], ['Q', [1.24, 2.02, 1.12, 2.3]], ['Q', [0.96, 2.46, 0.98, 2.64]],
    ['Q', [1.0, 2.92, 0.7, 3.06]], ['Q', [0.3, 3.16, 0, 3.58]],
  ];
  const traceBell = (s: Shape, sx: number, sy: number, up: boolean, mirror: boolean) => {
    const m = mirror ? -1 : 1;
    if (up) {
      for (const [cmd, p] of bellRight) {
        if (cmd === 'L') s.lineTo(p[0] * sx * m, p[1] * sy);
        else s.quadraticCurveTo(p[0] * sx * m, p[1] * sy, p[2] * sx * m, p[3] * sy);
      }
    } else {
      for (let i = bellRight.length - 1; i > 0; i--) {
        const [cmd, p] = bellRight[i];
        const prev = bellRight[i - 1][1];
        const px = prev.length === 2 ? prev[0] : prev[2], py = prev.length === 2 ? prev[1] : prev[3];
        if (cmd === 'L') s.lineTo(px * sx * m, py * sy);
        else s.quadraticCurveTo(p[0] * sx * m, p[1] * sy, px * sx * m, py * sy);
      }
    }
  };
  {
    const wall = new Shape();
    wall.moveTo(-IN, 0);
    wall.lineTo(-1.15, 0);
    traceBell(wall, 1, 1, true, true);
    traceBell(wall, 1, 1, false, false);
    wall.lineTo(IN, 0);
    wall.lineTo(IN, G.yt);
    wall.lineTo(-IN, G.yt);
    wall.closePath();
    const wg = new ExtrudeGeometry(wall, { depth: 0.24, bevelEnabled: false, curveSegments: 14 });
    wg.translate(0, 0, -0.12);
    B.add('plaster', projectUV(wg, 1, 1.2, 1.2), mat(0, 0, -OUT));

    const ring = new Shape();
    const S = 1.14, SY = 1.05;
    ring.moveTo(-1.15 * S, 0);
    traceBell(ring, S, SY, true, true);
    traceBell(ring, S, SY, false, false);
    ring.lineTo(1.15, 0);
    traceBell(ring, 1, 1, true, false);
    traceBell(ring, 1, 1, false, true);
    ring.closePath();
    const rg = new ExtrudeGeometry(ring, { depth: 0.4, bevelEnabled: false, curveSegments: 14 });
    rg.translate(0, 0, -0.2);
    B.add('lacquer', projectUV(rg, 1), mat(0, 0, -OUT));
    // wainscot either side of the doorway, threshold stone, and a carved lintel band
    for (const s of [-1, 1]) {
      B.add('board', box(2.5, 0.85, 0.06), mat(s * 2.6, 0.5, -OUT + 0.15));
      B.add('board', box(2.5, 0.85, 0.06), mat(s * 2.6, 0.5, -OUT - 0.15));
    }
    B.add('stone', box(2.6, 0.06, 0.6, 0, 1, 1), mat(0, 0.03, -OUT));
    B.add('cedar', box(8.6, 0.18, 0.26), mat(0, 3.83, -OUT));
    B.add('asanoha', projectUV(new BoxGeometry(7.4, 0.6, 0.03), 0, 0.6, 0.6, 0, 0.5), mat(0, 4.3, -OUT));
    B.add('cedar', box(8.6, 0.1, 0.24), mat(0, 4.65, -OUT));
    wallBox('N', -IN, -1.2, 0, 5.2);
    wallBox('N', 1.2, IN, 0, 5.2);
  }

  /* ───────────────────────── sacred hall annex shell ───────────────────────── */
  {
    const { x0, x1, z0, z1, h } = ANNEX;
    B.add('stone', box(x1 - x0 + 0.8, 0.62, z1 - z0 + 0.4, 0, 1.2, 1.2), mat(0, -0.32, (z0 + z1) / 2 - 0.2));
    B.add('honey', box(x1 - x0, 0.06, z1 - z0, 2, 2.4, 2.4), mat(0, -0.03, (z0 + z1) / 2));
    W.surface({ x0, x1, z0, z1, y: 0 });
    const panelWall = (x: number, za: number, zb: number, key: string) => {
      B.add('board', box(0.06, 0.9, zb - za), mat(x, 0.5, (za + zb) / 2));
      B.add('cedar', box(0.18, 0.1, zb - za), mat(x, 0.95, (za + zb) / 2));
      B.add(key, projectUV(new BoxGeometry(0.03, 2.4, zb - za - 0.6), 1, zb - za - 0.6, 2.4, 0.5, 0.5), mat(x, 2.2, (za + zb) / 2));
      B.add('plaster', box(0.16, h - 3.4, zb - za), mat(x, 3.4 + (h - 3.4) / 2, (za + zb) / 2));
      B.add('cedar', box(0.22, 0.16, zb - za + 0.4), mat(x, 3.4, (za + zb) / 2));
      B.add('cedar', box(0.24, 0.4, zb - za + 0.4), mat(x, h - 0.7, (za + zb) / 2));
    };
    for (const s of [-1, 1]) {
      panelWall(s * 6, z0, -16, 'ink2');
      panelWall(s * 6, -16, z1, 'ink');
      W.box(s * 6 - 0.25, s * 6 + 0.25, 0, h, z0, z1);
    }
    // Rear wall: vertical walnut boarding behind the altar.
    for (let x = x0 + 0.15; x < x1; x += 0.3) B.add('walnut', box(0.29, h - 0.4, 0.06), mat(x, (h - 0.4) / 2, z0 + 0.12), 0.95);
    W.box(x0, x1, 0, h, z0 - 0.3, z0 + 0.25);
    // ceiling: coffered grid
    const cy = h - 0.3;
    for (let x = x0; x <= x1 + 0.01; x += 1) B.add('lacquer', box(0.09, 0.14, z1 - z0), mat(x, cy - 0.07, (z0 + z1) / 2));
    for (let z = z0; z <= z1 + 0.01; z += 1) B.add('lacquer', box(x1 - x0, 0.14, 0.09), mat(0, cy - 0.07, z));
    for (let x = x0 + 0.5; x < x1; x += 1) {
      for (let z = z0 + 0.5; z < z1; z += 1) {
        B.add('coffer', projectUV(new BoxGeometry(0.92, 0.02, 0.92), 0, 0.92, 0.92, 0.5, 0.5), mat(x, cy + 0.04, z));
      }
    }
    beamX(x0 - 0.2, x1 + 0.2, z0 + 0.1, cy - 0.12, 0.45, 0.3);
    beamZ(z0, z1, x0, cy - 0.12, 0.45, 0.3); beamZ(z0, z1, x1, cy - 0.12, 0.45, 0.3);
    beamX(x0, x1, -16, cy - 0.12, 0.4, 0.26);
    // exterior roof of the annex (gabled, tiled)
    for (const s of [-1, 1]) {
      const g = box(7.6, 0.18, z1 - z0 + 1.6, 0, 0.6, 0.6);
      B.add('tile', g, mat(s * 3.3, h + 1.0, (z0 + z1) / 2 - 0.4, 0, 0, s * -0.38));
    }
  }

  /* ───────────────────────── stairs ───────────────────────── */
  const stair = (spec: typeof STAIR1, dir: number, holeEdgeX: number, upperFloor: number, steps: number) => {
    const { x0, x1, zLow, yLow } = spec;
    const w = x1 - x0, xc = (x0 + x1) / 2;
    for (let i = 0; i < steps; i++) {
      const zf = zLow + dir * i * TREAD, zb = zLow + dir * (i + 1) * TREAD;
      const y = yLow + (i + 1) * RISER;
      B.add('honey', box(w - 0.1, 0.055, TREAD + 0.04, 0, 2.4, 2.4), mat(xc, y - 0.028, (zf + zb) / 2));
    }
    const run = steps * TREAD, rise = steps * RISER;
    const len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    const zMid = zLow + (dir * run) / 2, yMid = yLow + rise / 2;
    for (const x of [x0 + 0.05, x1 - 0.05]) {
      B.add('cedar', box(0.08, 0.34, len + 0.3, 2), mat(x, yMid + 0.05, zMid, 0, -dir * ang));
    }
    // handrail on the open side, with posts and bronze giboshi
    const hx = holeEdgeX;
    B.add('cedar', box(0.07, 0.07, len, 2), mat(hx, yMid + 0.95, zMid, 0, -dir * ang));
    for (let i = 0; i <= steps; i += 6) {
      const z = zLow + dir * i * TREAD, y = yLow + i * RISER;
      B.add('cedar', box(0.09, 0.98, 0.09), mat(hx, y + 0.49 + 0.06, z));
    }
    for (const i of [0, steps]) {
      const z = zLow + dir * i * TREAD, y = yLow + i * RISER;
      B.add('bronze', cyl(0.001, 0.07, 0.16, 16), mat(hx, y + 1.17, z));
    }
    W.surface({
      x0, x1, z0: Math.min(zLow, zLow + dir * run), z1: Math.max(zLow, zLow + dir * run),
      y: (_x, z) => Math.max(yLow, Math.min(yLow + rise, yLow + ((z - zLow) * dir) / TREAD * RISER + RISER / 2)),
    });
    W.box(hx - 0.06, hx + 0.06, yLow - 0.1, upperFloor + 1.05, Math.min(zLow, zLow + dir * run), Math.max(zLow, zLow + dir * run));
  };
  stair(STAIR1, -1, STAIR1.x1, H1, 24);
  stair(STAIR2, 1, STAIR2.x0, H2, 22);

  /* ───────────────────────── balustrades ───────────────────────── */
  const railing = (ax: number, az: number, bx: number, bz: number, y: number, key = 'lacquer', finials = true, solid = true) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(-(bz - az), bx - ax);
    const at = (t: number, yy: number) => mat(ax + (bx - ax) * t, yy, az + (bz - az) * t, ry);
    B.add(key, box(len + 0.06, 0.07, 0.12, 0), at(0.5, y + 1.0));
    B.add('gold', box(len + 0.07, 0.012, 0.125, 0), at(0.5, y + 0.96));
    B.add(key, box(len, 0.06, 0.1, 0), at(0.5, y + 0.55));
    B.add(key, box(len, 0.08, 0.12, 0), at(0.5, y + 0.12));
    const nb = Math.max(2, Math.round(len / 0.34));
    for (let k = 1; k < nb; k++) B.add('cedar', box(0.045, 0.4, 0.045), at(k / nb, y + 0.78));
    // lower lattice: diagonal kumiko
    if (solid) {
      const nl = Math.max(2, Math.round(len / 0.28));
      for (let k = 0; k < nl; k++) {
        const g = box(0.035, 0.46, 0.03);
        B.add('cedar', g, at((k + 0.5) / nl, y + 0.335).multiply(mat(0, 0, 0, 0, 0, 0.55)));
        B.add('cedar', box(0.035, 0.46, 0.03), at((k + 0.5) / nl, y + 0.335).multiply(mat(0, 0, 0, 0, 0, -0.55)));
      }
    }
    for (const t of [0, 1]) {
      B.add(key, box(0.13, 1.08, 0.13), at(t, y + 0.54));
      if (finials) {
        B.add('bronze', cyl(0.075, 0.075, 0.12, 16), at(t, y + 1.14));
        B.add('bronze', cyl(0.001, 0.08, 0.18, 16), at(t, y + 1.29));
      }
    }
  };
  for (const H of [H1, H2]) {
    const v = VOID;
    railing(-v, -v, v, -v, H); railing(v, -v, v, v, H); railing(v, v, -v, v, H); railing(-v, v, -v, -v, H);
    const r = v + 0.06;
    W.box(-r, r, H, H + 1.1, -r - 0.06, -r + 0.06); W.box(-r, r, H, H + 1.1, r - 0.06, r + 0.06);
    W.box(-r - 0.06, -r + 0.06, H, H + 1.1, -r, r); W.box(r - 0.06, r + 0.06, H, H + 1.1, -r, r);
  }
  // stairwell guards on the upper floors
  railing(STAIR1.x1, STAIR1.zLow, STAIR1.x1, STAIR1.zHigh + 1.2, H1, 'cedar', true, false);
  railing(-OUT + 0.3, STAIR1.zLow, STAIR1.x1, STAIR1.zLow, H1, 'cedar', false, false);
  W.box(-OUT, STAIR1.x1, H1, H1 + 1.1, STAIR1.zLow - 0.06, STAIR1.zLow + 0.08);
  railing(STAIR2.x0, STAIR2.zLow, STAIR2.x0, STAIR2.zHigh - 1.2, H2, 'cedar', true, false);
  railing(STAIR2.x0, STAIR2.zLow, OUT - 0.3, STAIR2.zLow, H2, 'cedar', false, false);
  W.box(STAIR2.x0, OUT, H2, H2 + 1.1, STAIR2.zLow - 0.08, STAIR2.zLow + 0.06);

  /* ───────────────────────── gallery ceilings (third floor) ───────────────────────── */
  {
    const y = H3;
    for (const r of rectMinusHoles({ x0: -OUT, x1: OUT, z0: -OUT, z1: OUT }, [{ x0: -IN, x1: IN, z0: -IN, z1: IN }])) {
      B.add('board', box(r.x1 - r.x0, 0.05, r.z1 - r.z0, 0, 1.2, 1.2), mat((r.x0 + r.x1) / 2, y + 0.16, (r.z0 + r.z1) / 2));
    }
    for (let k = -11; k <= 11; k++) {
      for (const [a, b] of intervalMinus(-OUT, OUT, Math.abs(k) < IN ? [[-IN, IN]] : [])) {
        B.add('cedar', box(0.09, 0.13, b - a), mat(k, y + 0.07, (a + b) / 2));
        B.add('cedar', box(b - a, 0.13, 0.09), mat((a + b) / 2, y + 0.07, k));
      }
      for (let j = -11; j <= 11; j++) {
        if (Math.abs(k) < IN && Math.abs(j) < IN) continue;
        B.add('gold', box(0.16, 0.012, 0.16, 0), mat(k, y + 0.0, j), 0.9);
      }
    }
    // cornice of small blocks along the outer walls
    for (const side of sides) {
      for (let u = -11.8; u <= 11.8; u += 0.5) {
        const [x, z] = wxz(side, u, 0.3);
        B.add('cedar', box(0.2, 0.16, 0.22), mat(x, y - 0.58, z, SIDE_RY[side]));
      }
    }
  }

  /* ───────────────────────── clerestory & lantern ceiling over the atrium ───────────────────────── */
  {
    const winBot = 16.9, winTop = CLR_WIN;
    for (const side of sides) {
      const at = (u: number, y: number) => {
        const x = side === 'N' || side === 'S' ? u : side === 'E' ? IN : -IN;
        const z = side === 'N' ? -IN : side === 'S' ? IN : u;
        return mat(x, y, z, SIDE_RY[side]);
      };
      B.add('plaster', box(2 * IN, winBot - H3, 0.16), at(0, (H3 + winBot) / 2));
      B.add('cedar', box(2 * IN + 0.3, 0.12, 0.24), at(0, winBot + 0.06));
      for (let u = -IN + 0.1; u <= IN - 0.1; u += 0.13) B.add('cedar', box(0.05, winTop - winBot - 0.2, 0.08), at(u, (winBot + winTop) / 2));
      for (let u = -IN; u <= IN + 0.01; u += 2) B.add('walnut', box(0.22, winTop - CLR_BOT, 0.22), at(u, (CLR_BOT + winTop) / 2));
      B.add('cedar', box(2 * IN + 0.4, 0.3, 0.3), at(0, winTop - 0.05));
    }
    // corbelled tiers stepping inward, each with a row of small brackets
    let half = IN, y = CLR_WIN + 0.1;
    for (let t = 0; t < 3; t++) {
      const nh = half - 0.45;
      for (const s of [-1, 1]) {
        B.add('lacquer', box(2 * half + 0.1, 0.3, 0.3), mat(0, y + 0.15, s * (half - 0.1)));
        B.add('lacquer', box(0.3, 0.3, 2 * half + 0.1), mat(s * (half - 0.1), y + 0.15, 0));
        B.add('gold', box(2 * half + 0.11, 0.025, 0.31), mat(0, y + 0.005, s * (half - 0.1)));
        B.add('gold', box(0.31, 0.025, 2 * half + 0.11), mat(s * (half - 0.1), y + 0.005, 0));
        for (let u = -half + 0.3; u <= half - 0.3; u += 0.42) {
          B.add('cedar', box(0.16, 0.14, 0.2), mat(u, y - 0.07, s * (half - 0.22)));
          B.add('cedar', box(0.2, 0.14, 0.16), mat(s * (half - 0.22), y - 0.07, u));
        }
        // sloped cove boards between tiers
        B.add('board', box(2 * nh, 0.04, 0.62), mat(0, y + 0.42, s * (nh + 0.12), 0, s * 0.85));
        B.add('board', box(0.62, 0.04, 2 * nh), mat(s * (nh + 0.12), y + 0.42, 0, 0, 0, -s * 0.85));
      }
      half = nh;
      y += 0.5;
    }
    // coffered lantern ceiling (gōtenjō) with gilt lotus panels
    const top = CLR_TOP, n = 6, cell = (2 * half) / n;
    for (let i = 0; i <= n; i++) {
      const p = -half + i * cell;
      B.add('lacquer', box(0.1, 0.16, 2 * half), mat(p, top - 0.08, 0));
      B.add('lacquer', box(2 * half, 0.16, 0.1), mat(0, top - 0.08, p));
      B.add('gold', box(0.11, 0.015, 2 * half), mat(p, top - 0.16, 0));
      B.add('gold', box(2 * half, 0.015, 0.11), mat(0, top - 0.16, p));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const g = projectUV(new BoxGeometry(cell - 0.02, 0.02, cell - 0.02), 0, cell - 0.02, cell - 0.02, 0.5, 0.5);
      B.add('coffer', g, mat(-half + (i + 0.5) * cell, top + 0.02, -half + (j + 0.5) * cell));
    }
    B.add('board', box(2 * IN + 0.6, 0.1, 2 * IN + 0.6), mat(0, top + 0.12, 0));
  }

  /* ───────────────────────── exterior roof tiers ───────────────────────── */
  const roofTier = (topY: number, halfTop: number, halfBot: number, h: number, rafters: boolean) => {
    const cy = topY - h / 2;
    const slant = Math.hypot(halfBot - halfTop, h);
    B.add('tile', squareFrustum(halfTop, halfBot, h, true, [(halfBot * 8) / 1.8, slant / 1.4]), mat(0, cy, 0));
    B.add('boardBack', squareFrustum(halfTop, halfBot, h, true), mat(0, cy - 0.3, 0));
    B.add('black', squareFrustum(halfBot + 0.02, halfBot + 0.02, 0.3, true), mat(0, topY - h - 0.05, 0));
    B.add('gold', squareFrustum(halfBot + 0.035, halfBot + 0.035, 0.03, true), mat(0, topY - h - 0.19, 0));
    const run = halfBot - halfTop, ang = Math.atan2(h, run), len = Math.hypot(run, h);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const d = Math.hypot(run * Math.SQRT2, h);
      B.add('tile', box(d, 0.26, 0.3), mat(sx * (halfTop + halfBot) / 2, cy + 0.12, sz * (halfTop + halfBot) / 2, Math.atan2(-sz, sx), 0, -Math.atan2(h, run * Math.SQRT2)), 0.7);
      // eave bell (fūtaku) at each corner
      B.add('bronze', cyl(0.07, 0.12, 0.26, 12), mat(sx * (halfBot - 0.1), topY - h - 0.45, sz * (halfBot - 0.1)));
    }
    if (rafters) {
      for (const side of sides) {
        for (let u = -halfTop + 0.2; u <= halfTop - 0.2; u += 0.36) {
          const [x, z] = wxz(side, u, -run / 2 - 0.1);
          B.add('cedar', box(0.1, 0.12, len, 2), mat(x, cy - 0.42, z, SIDE_RY[side], -ang));
        }
      }
    }
  };
  roofTier(H1 + 1.25, OUT + 0.25, OUT + 3.9, 1.75, true);
  roofTier(H2 + 1.2, OUT + 0.25, OUT + 3.3, 1.65, true);
  roofTier(H3 + 1.3, IN + 0.3, OUT + 2.6, 1.5, false);
  // crowning roof over the clerestory and the sōrin spire, as in the pen sketch
  B.add('tile', squareFrustum(0.6, IN + 2.4, 3.6, true, [((IN + 2.4) * 8) / 1.8, 6.6 / 1.4]), mat(0, CLR_TOP + 2.1, 0));
  B.add('black', squareFrustum(IN + 2.42, IN + 2.42, 0.3, true), mat(0, CLR_TOP + 0.15, 0));
  B.add('bronze', cyl(0.12, 0.16, 9, 12), mat(0, CLR_TOP + 8, 0));
  for (let k = 0; k < 9; k++) B.add('bronze', cyl(0.62 - k * 0.025, 0.62 - k * 0.025, 0.1, 24), mat(0, CLR_TOP + 5.3 + k * 0.62, 0));
  B.add('gold', cyl(0.001, 0.3, 0.7, 12), mat(0, CLR_TOP + 11.6, 0));

  /* ───────────────────────── engawa veranda ───────────────────────── */
  {
    const { z0, z1, y } = ENGAWA;
    B.add('honey', box(24.8, 0.07, z1 - z0, 0, 2.4, 2.4), mat(0, y - 0.035, (z0 + z1) / 2));
    B.add('cedar', box(24.9, 0.18, 0.14), mat(0, y - 0.12, z1 - 0.07));
    for (let x = -12; x <= 12.01; x += 2) {
      B.add('cedar', box(0.14, 0.42, 0.14), mat(x, y - 0.3, z1 - 0.2));
      B.add('stone', cyl(0.16, 0.2, 0.14, 8, 1, 1), mat(x, y - 0.52, z1 - 0.2));
    }
    W.surface({ x0: -12.4, x1: 12.4, z0: OUT, z1: z1, y });
    // shoe-removal stone at the centre step
    B.add('stone', box(1.3, 0.28, 0.7, 0, 1, 1), mat(0, -0.42, z1 + 0.35), 0.95);
    W.surface({ x0: -0.65, x1: 0.65, z0: z1 - 0.01, z1: z1 + 0.7, y: -0.28 });
  }

  /* ───────────────────────── invisible shadow shell ───────────────────────── */
  const shadowShell = new Group();
  const shellMat = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shell = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new Mesh(new BoxGeometry(w, h, d), shellMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = false;
    shadowShell.add(m);
  };
  shell(2 * OUT + 1, 0.3, 2 * OUT + 1, 0, H3 + 0.45, 0);
  shell(2 * IN + 1, 0.3, 2 * IN + 1, 0, CLR_TOP + 0.35, 0);
  shell(ANNEX.x1 - ANNEX.x0 + 1, 0.3, ANNEX.z1 - ANNEX.z0 + 1, 0, ANNEX.h + 0.2, (ANNEX.z0 + ANNEX.z1) / 2);

  return { sliding, slidingGroup, shadowShell };
}
