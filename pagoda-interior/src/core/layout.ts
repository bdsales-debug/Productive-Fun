/**
 * The plan of the pagoda, in metres. Y is up, -Z is north (towards the Sacred Hall),
 * +Z is south (towards the garden and the sea of clouds).
 *
 *            ┌──────── Sacred Hall annex (z −20 … −12) ────────┐
 *   ┌────────┴──────── north gallery ──────────────────────────┴────────┐
 *   │ west gallery      ┌──── atrium void (±2.8) ────┐     east gallery │
 *   │ (stair 1, ground  │  dais + heart pillar (0,0) │   (stair 2, L2)  │
 *   │  → L2)            └────────────────────────────┘                  │
 *   └──────────────────── south gallery · sliding screens ──────────────┘
 *                         engawa veranda (z 12 … 14.6) · garden
 */
export const OUT = 12; // outer column line (half size)
export const IN = 4; // inner (atrium) column line
export const VOID = 2.8; // edge of the open atrium; balconies cantilever from IN to VOID
export const SLAB = 0.35;

export const H1 = 6; // second floor
export const H2 = 11.5; // third floor
export const H3 = 15.6; // gallery ceilings on the third floor
export const CLR_BOT = 16; // top of the atrium columns, base of the clerestory
export const CLR_WIN = 18.2; // top of clerestory windows
export const CLR_TOP = 19.6; // coffered lantern ceiling over the atrium

export const EYE = 1.62;
export const PLAYER_R = 0.28;
export const PLAYER_H = 1.75;
export const STEP = 0.45;

export const RISER = 0.25;
export const TREAD = 0.3;

/** Stair 1: ground → second floor, along the west wall, climbing north (−z). */
export const STAIR1 = { x0: -11.7, x1: -10.1, zLow: 5.2, zHigh: 5.2 - 24 * TREAD, yLow: 0, yHigh: H1 };
/** Stair 2: second → third floor, along the east wall, climbing south (+z). */
export const STAIR2 = { x0: 10.1, x1: 11.7, zLow: -5.2, zHigh: -5.2 + 22 * TREAD, yLow: H1, yHigh: H2 };

export const ANNEX = { x0: -6, x1: 6, z0: -20, z1: -OUT, h: 6.4 };
export const ENGAWA = { z0: OUT, z1: 14.6, y: -0.05 };
export const GARDEN = { x0: -18, x1: 18, z0: 14.6, z1: 27.4, y: -0.55 };

/** Outer column positions along one side (every 4 m). */
export const BAYS = [-12, -8, -4, 0, 4, 8, 12];

export interface Rect { x0: number; x1: number; z0: number; z1: number }

/** Splits a rectangle into smaller rectangles that avoid the given holes. */
export function rectMinusHoles(r: Rect, holes: Rect[]): Rect[] {
  const xs = new Set([r.x0, r.x1]);
  const zs = new Set([r.z0, r.z1]);
  for (const h of holes) {
    [h.x0, h.x1].forEach((v) => v > r.x0 && v < r.x1 && xs.add(v));
    [h.z0, h.z1].forEach((v) => v > r.z0 && v < r.z1 && zs.add(v));
  }
  const X = [...xs].sort((a, b) => a - b);
  const Z = [...zs].sort((a, b) => a - b);
  const inHole = (cx: number, cz: number) => holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
  const out: Rect[] = [];
  for (let j = 0; j < Z.length - 1; j++) {
    let run: Rect | null = null;
    for (let i = 0; i < X.length - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      if (inHole(cx, cz)) { if (run) { out.push(run); run = null; } continue; }
      if (run) run.x1 = X[i + 1];
      else run = { x0: X[i], x1: X[i + 1], z0: Z[j], z1: Z[j + 1] };
    }
    if (run) out.push(run);
  }
  return out;
}

/** Subtracts [a,b] intervals from [lo,hi]. */
export function intervalMinus(lo: number, hi: number, cuts: [number, number][]): [number, number][] {
  let parts: [number, number][] = [[lo, hi]];
  for (const [a, b] of cuts) {
    const next: [number, number][] = [];
    for (const [p, q] of parts) {
      if (b <= p || a >= q) { next.push([p, q]); continue; }
      if (a > p) next.push([p, a]);
      if (b < q) next.push([b, q]);
    }
    parts = next;
  }
  return parts.filter(([p, q]) => q - p > 0.05);
}
