import { PLAYER_H, PLAYER_R, STEP } from '../core/layout';
import type { Rect } from '../core/layout';

export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; on?: () => boolean }
export interface Cyl { x: number; z: number; r: number; y0: number; y1: number }
export interface Surface extends Rect { y: number | ((x: number, z: number) => number); holes?: Rect[] }

/**
 * A light-weight collision model: walkable surfaces (flat floors and stair ramps) plus
 * vertical obstacles (boxes and cylinders). The player is a vertical capsule.
 */
export class CollisionWorld {
  boxes: Box[] = [];
  cyls: Cyl[] = [];
  surfaces: Surface[] = [];

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, on?: () => boolean) {
    this.boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), on });
  }
  cyl(x: number, z: number, r: number, y0: number, y1: number) { this.cyls.push({ x, z, r, y0, y1 }); }
  surface(s: Surface) { this.surfaces.push(s); }

  /** Highest walkable surface under (x,z) that the player can reach from `feet`. */
  floorAt(x: number, z: number, feet: number): number | null {
    let best: number | null = null;
    for (const s of this.surfaces) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      if (s.holes && s.holes.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1)) continue;
      const y = typeof s.y === 'number' ? s.y : s.y(x, z);
      if (y <= feet + STEP && (best === null || y > best)) best = y;
    }
    return best;
  }

  /** True when a straight line between two points passes through a wall, column or floor. */
  segmentBlocked(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    for (const bx of this.boxes) {
      if ((bx.on && !bx.on()) || bx.y1 - bx.y0 < 2.5) continue; // rails and furniture don't hide things
      let t0 = 0.02, t1 = 0.95;
      const slab = (o: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let ta = (lo - o) / d, tb = (hi - o) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        return t0 <= t1;
      };
      if (slab(a.x, dx, bx.x0, bx.x1) && slab(a.y, dy, bx.y0, bx.y1) && slab(a.z, dz, bx.z0, bx.z1)) return true;
    }
    for (const s of this.surfaces) {
      if (typeof s.y !== 'number') continue;
      const y = s.y - 0.1; // underside of the floor
      if ((a.y - y) * (b.y - y) >= 0) continue;
      const t = (y - a.y) / dy;
      if (t < 0.03 || t > 0.97) continue;
      const x = a.x + dx * t, z = a.z + dz * t;
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      if (s.holes && s.holes.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1)) continue;
      return true;
    }
    return false;
  }

  /** Pushes the capsule at (p.x, p.z) out of every obstacle it overlaps. */
  resolve(p: { x: number; z: number }, feet: number, r = PLAYER_R) {
    const lo = feet + STEP * 0.9, hi = feet + PLAYER_H;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.boxes) {
        if (b.y1 <= lo || b.y0 >= hi || (b.on && !b.on())) continue;
        const cx = Math.max(b.x0, Math.min(p.x, b.x1));
        const cz = Math.max(b.z0, Math.min(p.z, b.z1));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: leave by the shallowest side.
          const pen = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z];
          const m = Math.min(...pen);
          if (m === pen[0]) p.x = b.x0 - r; else if (m === pen[1]) p.x = b.x1 + r;
          else if (m === pen[2]) p.z = b.z0 - r; else p.z = b.z1 + r;
        }
        moved = true;
      }
      for (const c of this.cyls) {
        if (c.y1 <= lo || c.y0 >= hi) continue;
        const dx = p.x - c.x, dz = p.z - c.z;
        const min = c.r + r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4;
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
        moved = true;
      }
      if (!moved) break;
    }
  }
}
