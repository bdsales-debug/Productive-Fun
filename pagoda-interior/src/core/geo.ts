import {
  BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Euler, Group, Material, Matrix4, Mesh,
  Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './noise';

export type Axis = 0 | 1 | 2; // x, y, z

/**
 * Box-projects UVs in the piece's local space so every texture keeps a real-world density
 * (metres) and wood grain runs along the piece's long axis.
 */
export function projectUV(g: BufferGeometry, grain: Axis, su = 0.8, sv = 2.4, ou = rng() * 8, ov = rng() * 8) {
  const p = g.attributes.position.array as ArrayLike<number>;
  const n = g.attributes.normal.array as ArrayLike<number>;
  const count = g.attributes.position.count;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const ax = Math.abs(n[i * 3]), ay = Math.abs(n[i * 3 + 1]), az = Math.abs(n[i * 3 + 2]);
    let pa: Axis, pb: Axis;
    if (ax >= ay && ax >= az) { pa = 1; pb = 2; } else if (ay >= az) { pa = 0; pb = 2; } else { pa = 0; pb = 1; }
    let ua: Axis, va: Axis;
    if (pa === grain) { va = pa; ua = pb; } else if (pb === grain) { va = pb; ua = pa; } else { ua = pa; va = pb; }
    uv[i * 2] = p[i * 3 + ua] / su + ou;
    uv[i * 2 + 1] = p[i * 3 + va] / sv + ov;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

const longest = (w: number, h: number, d: number): Axis => (w >= h && w >= d ? 0 : h >= d ? 1 : 2);

export function box(w: number, h: number, d: number, grain?: Axis, su = 0.8, sv = 2.4) {
  return projectUV(new BoxGeometry(w, h, d), grain ?? longest(w, h, d), su, sv);
}

export function cyl(rt: number, rb: number, h: number, seg = 16, su = 0.8, sv = 2.4, open = false) {
  return projectUV(new CylinderGeometry(rt, rb, h, seg, 1, open), 1, su, sv);
}

/** Square frustum (a cylinder with four sides turned 45°) — used for bearing blocks and hipped roofs. */
export function squareFrustum(halfTop: number, halfBottom: number, h: number, open = false, uvScale?: [number, number]) {
  const g = new CylinderGeometry(halfTop * Math.SQRT2, halfBottom * Math.SQRT2, h, 4, 1, open);
  g.rotateY(Math.PI / 4);
  if (uvScale) {
    // keep the cylinder's own wrap-around UVs so roof tiles run down every slope
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
    return g.toNonIndexed();
  }
  return projectUV(g.toNonIndexed(), 1);
}

const _e = new Euler();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _p = new Vector3();

export function mat(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1): Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(s, s, s);
  return new Matrix4().compose(_p.set(x, y, z), _q, _s);
}

/**
 * Collects many small pieces per material and merges them into a handful of draw calls.
 * Every piece gets a slight tint jitter through vertex colours so repeated timber never looks cloned.
 */
export class Batch {
  private parts = new Map<string, BufferGeometry[]>();

  add(key: string, geo: BufferGeometry, m: Matrix4, tint = 1, jitter = 0.1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const t = tint * (1 - jitter / 2 + rng() * jitter);
    const c = new Float32Array(g.attributes.position.count * 3).fill(t);
    g.setAttribute('color', new BufferAttribute(c, 3));
    let list = this.parts.get(key);
    if (!list) this.parts.set(key, (list = []));
    list.push(g);
    return this;
  }

  /** Convenience: an axis-aligned box centred at (x,y,z). */
  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, tint = 1, grain?: Axis) {
    return this.add(key, box(w, h, d, grain), mat(x, y, z, ry), tint);
  }

  build(mats: Record<string, Material>, cast = true, receive = true): Group {
    const group = new Group();
    for (const [key, list] of this.parts) {
      const material = mats[key];
      if (!material) throw new Error(`Missing material "${key}"`);
      // Merge in chunks to keep buffers a sensible size.
      for (let i = 0; i < list.length; i += 4000) {
        const merged = mergeGeometries(list.slice(i, i + 4000), false);
        if (!merged) throw new Error(`Could not merge geometry for "${key}"`);
        merged.computeBoundingSphere();
        const mesh = new Mesh(merged, material);
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        mesh.name = key;
        group.add(mesh);
      }
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return group;
  }
}

/** Adds a flat vertex-colour attribute so stand-alone meshes can share vertex-coloured materials. */
export function withColor(g: BufferGeometry, t = 1) {
  g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(t), 3));
  return g;
}
