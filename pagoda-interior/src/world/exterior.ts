import {
  BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DodecahedronGeometry, DoubleSide, Group,
  IcosahedronGeometry, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry,
  Quaternion, ShaderMaterial, Shape, ShapeGeometry, SphereGeometry, Sprite, SpriteMaterial, Texture, Vector3, ConeGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, box, cyl, mat, projectUV, withColor } from '../core/geo';
import { GARDEN } from '../core/layout';
import { fbm, mulberry32, rand } from '../core/noise';
import { GLSL_NOISE } from './atmosphere';
import type { CollisionWorld } from './collision';

const PLATEAU = 31;
export function terrainHeight(x: number, z: number) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  if (r < PLATEAU) return -0.62;
  const t = (r - PLATEAU) / 62;
  return -0.62 - Math.pow(t, 1.3) * 58 + (fbm(a * 3 + 10, r * 0.04, 3) - 0.5) * 9 * Math.min(1, t * 3);
}

/** Adds a time uniform and a gentle height-weighted sway to a standard material. */
function swaying(m: MeshStandardMaterial, uniforms: { uTime: { value: number } }, amount: number, instanced = false) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      ${instanced ? 'vec3 org = instanceMatrix[3].xyz; float hgt = position.y;' : 'vec3 org = vec3(0.0); float hgt = max(0.0, position.y + 0.5);'}
      float ph = uTime * 1.1 + (position.x + org.x) * 0.35 + (position.z + org.z) * 0.27;
      transformed.x += sin(ph) * ${amount.toFixed(3)} * hgt;
      transformed.z += cos(ph * 0.83) * ${(amount * 0.7).toFixed(3)} * hgt;`);
  };
  m.customProgramCacheKey = () => `sway${amount}${instanced}`;
}

/**
 * Clusters of crossed leaf cards. Normals point away from each cluster's centre so the
 * foliage shades like a soft volume rather than a set of flat planes.
 */
function leafCards(clusters: { c: Vector3; r: number; n: number; size: number; colors: Color[] }[], rnd: () => number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [];
  const q = new Quaternion(), e = new Vector3(), corner = new Vector3();
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (const cl of clusters) {
    for (let i = 0; i < cl.n; i++) {
      const p = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(cl.r * Math.cbrt(rnd()));
      p.y *= 0.6;
      p.add(cl.c);
      q.setFromAxisAngle(e.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), rnd() * Math.PI);
      const color = cl.colors[Math.floor(rnd() * cl.colors.length)];
      const k = 0.8 + rnd() * 0.35;
      const s = cl.size * (0.7 + rnd() * 0.6);
      const u0 = Math.floor(rnd() * 2) * 0.5, v0 = Math.floor(rnd() * 2) * 0.5;
      for (const [a, b] of corners) {
        corner.set(a * s, b * s, 0).applyQuaternion(q).add(p);
        pos.push(corner.x, corner.y, corner.z);
        const n = corner.clone().sub(cl.c).normalize();
        nor.push(n.x, n.y + 0.3, n.z);
        uv.push(u0 + (a + 0.5) * 0.5, v0 + (b + 0.5) * 0.5);
        col.push(color.r * k, color.g * k, color.b * k);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.normalizeNormals();
  return g;
}

export interface Exterior {
  group: Group;
  update(t: number): void;
  waterfall: Vector3;
  stoneLantern: Vector3;
  overlook: Vector3;
}

export function buildExterior(
  B: Batch, W: CollisionWorld, mats: Record<string, Material>, tex: Record<string, Texture>,
  cloudUniforms: Record<string, { value: unknown }>[], mountainMats: MeshBasicMaterial[], quality: { trees: number },
): Exterior {
  const group = new Group();
  group.name = 'exterior';
  const time = { uTime: { value: 0 } };
  const r = mulberry32(99);

  /* ── the mountaintop ── */
  {
    const rings = [0, 14, 22, 27, 30, 31.5, 33, 36, 40, 46, 54, 64, 76, 90, 110, 140, 180];
    const seg = 160;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const moss = new Color('#56622f'), rock = new Color('#5d554b'), forest = new Color('#2d3a26');
    rings.forEach((rr) => {
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const jitter = rr > PLATEAU ? 1 + (fbm(a * 5, rr * 0.1, 2) - 0.5) * 0.12 : 1;
        const x = Math.cos(a) * rr * jitter, z = Math.sin(a) * rr * jitter;
        const y = terrainHeight(x, z);
        pos.push(x, y, z);
        const t = Math.min(1, Math.max(0, (rr - PLATEAU) / 12));
        const c = moss.clone().lerp(fbm(a * 8, rr * 0.2, 2) > 0.52 ? rock : forest, t);
        col.push(c.r, c.g, c.b);
      }
    });
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i, b = a + seg + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.receiveShadow = true;
    group.add(m);
  }

  /* ── raked gravel with the pond cut out ── */
  const pond = { x: -8.5, z: 21.4, rx: 4.0, rz: 2.5 };
  {
    const s = new Shape();
    s.moveTo(GARDEN.x0, -GARDEN.z0); s.lineTo(GARDEN.x1, -GARDEN.z0); s.lineTo(GARDEN.x1, -GARDEN.z1); s.lineTo(GARDEN.x0, -GARDEN.z1); s.closePath();
    const hole = new Path();
    hole.absellipse(pond.x, -pond.z, pond.rx, pond.rz, 0, Math.PI * 2, true, 0);
    s.holes.push(hole);
    const g = new ShapeGeometry(s, 32);
    g.rotateX(-Math.PI / 2);
    B.add('gravel', projectUV(g, 2, 3.5, 3.5), mat(0, GARDEN.y, 0));
    W.surface({ x0: GARDEN.x0, x1: GARDEN.x1, z0: GARDEN.z0, z1: GARDEN.z1, y: GARDEN.y });
    // the pond: dark basin, glassy water, koi, and a rim of stones
    const basin = new Mesh(withColor(new CircleGeometry(1, 48).scale(pond.rx, pond.rz, 1).rotateX(-Math.PI / 2)), new MeshStandardMaterial({ color: '#1c2120', roughness: 1, vertexColors: true }));
    basin.position.set(pond.x, GARDEN.y - 0.5, pond.z);
    group.add(basin);
    const water = new Mesh(new CircleGeometry(1, 64).scale(pond.rx, pond.rz, 1).rotateX(-Math.PI / 2), new MeshStandardMaterial({
      color: '#2a3b38', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.78, envMapIntensity: 1.4,
    }));
    water.position.set(pond.x, GARDEN.y - 0.14, pond.z);
    water.receiveShadow = true;
    group.add(water);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      const sz = 0.25 + r() * 0.3;
      const g2 = new DodecahedronGeometry(1, 0).scale(sz * 1.4, sz * 0.6, sz);
      B.add('darkStone', projectUV(g2, 1, 1, 1), mat(pond.x + Math.cos(a) * pond.rx * 1.02, GARDEN.y - 0.05, pond.z + Math.sin(a) * pond.rz * 1.04, r() * 6));
    }
    W.cyl(pond.x - 1.6, pond.z, 2.5, -2, 2); W.cyl(pond.x + 1.6, pond.z, 2.5, -2, 2);
  }
  const koi: Mesh[] = [];
  {
    const km = [new Color('#e8622c'), new Color('#f2efe6'), new Color('#d9a33a')];
    for (let k = 0; k < 4; k++) {
      const m = new Mesh(new SphereGeometry(1, 10, 6).scale(0.2, 0.05, 0.07), new MeshStandardMaterial({ color: km[k % 3], roughness: 0.5 }));
      m.userData = { phase: k * 1.7, speed: 0.18 + k * 0.04, rad: 0.5 + k * 0.17 };
      koi.push(m);
      group.add(m);
    }
  }

  /* ── garden furniture: stepping stones, moss, rocks ── */
  for (let z = 15.7; z < 26.6; z += 0.85) {
    const s = 0.32 + r() * 0.12;
    B.add('darkStone', projectUV(new CylinderGeometry(s, s * 1.05, 0.12, 7), 1, 1, 1), mat(Math.sin(z * 1.3) * 0.25, GARDEN.y + 0.02, z, r() * 6), 1.1);
  }
  for (const [x, z, sx, sz] of [[-13, 17, 2.2, 1.6], [12, 21, 1.8, 1.3], [-3, 25, 1.4, 1.0], [8, 26, 2.4, 1.1], [-15, 23, 1.6, 2.6], [15.2, 15.6, 1.2, 0.9]]) {
    B.add('moss', projectUV(new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(sx, 0.35, sz), 1), mat(x, GARDEN.y - 0.04, z));
  }
  const rockGroup = (x: number, z: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const s = (k ? 0.45 : 0.8) + r() * 0.3;
      const g = new IcosahedronGeometry(1, 1).scale(s * 1.1, s * (k ? 0.7 : 1.3), s);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.85 + r() * 0.3), p.getY(i) * (0.85 + r() * 0.3), p.getZ(i) * (0.85 + r() * 0.3));
      g.computeVertexNormals();
      B.add('darkStone', projectUV(g, 1, 1.5, 1.5), mat(x + (k ? (r() - 0.5) * 2.2 : 0), GARDEN.y + s * 0.35, z + (k ? (r() - 0.5) * 1.6 : 0), r() * 6), 0.9 + r() * 0.2);
    }
    W.cyl(x, z, 1.2, -1, 2);
  };
  rockGroup(-12.4, 18.6, 3);
  rockGroup(13.4, 25.3, 3);
  rockGroup(-5.6, 22.8, 2);

  /* ── stone lantern (kasuga-dōrō) ── */
  const lx = -3.6, lz = 18.4, ly = GARDEN.y;
  {
    B.add('stone', cyl(0.42, 0.5, 0.2, 6, 1, 1), mat(lx, ly + 0.1, lz));
    B.add('stone', cyl(0.13, 0.15, 0.95, 12, 1, 1), mat(lx, ly + 0.67, lz));
    B.add('stone', cyl(0.36, 0.22, 0.18, 6, 1, 1), mat(lx, ly + 1.23, lz));
    B.add('stone', box(0.42, 0.4, 0.42, 1, 1, 1), mat(lx, ly + 1.52, lz, 0.3), 1);
    B.add('lanternGlass', box(0.3, 0.26, 0.44), mat(lx, ly + 1.52, lz, 0.3));
    B.add('lanternGlass', box(0.44, 0.26, 0.3), mat(lx, ly + 1.52, lz, 0.3));
    B.add('stone', cyl(0.12, 0.58, 0.26, 6, 1, 1), mat(lx, ly + 1.86, lz));
    B.add('stone', projectUV(new SphereGeometry(0.11, 10, 8).scale(1, 1.3, 1), 1, 1, 1), mat(lx, ly + 2.06, lz));
    W.cyl(lx, lz, 0.5, -1, 3);
  }
  /* ── stone water basin (tsukubai) with a bamboo spout ── */
  {
    const x = 5.6, z = 17.3;
    B.add('stone', cyl(0.42, 0.48, 0.45, 18, 1, 1), mat(x, GARDEN.y + 0.2, z));
    const wtr = new Mesh(withColor(new CircleGeometry(0.3, 24).rotateX(-Math.PI / 2)), new MeshStandardMaterial({ color: '#334542', roughness: 0.05, metalness: 0.2, vertexColors: true }));
    wtr.position.set(x, GARDEN.y + 0.4, z);
    group.add(wtr);
    B.add('moss', cyl(0.04, 0.04, 1.2, 10), mat(x + 0.9, GARDEN.y + 0.65, z + 0.1, 0, 0, 1.45), 1.4);
    B.add('cedar', cyl(0.025, 0.025, 0.7, 6), mat(x + 1.4, GARDEN.y + 0.32, z + 0.1));
    for (const [dx, dz] of [[-0.8, 0.3], [0.5, -0.7], [-0.4, -0.75]]) B.add('darkStone', projectUV(new DodecahedronGeometry(0.28, 0).scale(1.3, 0.6, 1), 1, 1, 1), mat(x + dx, GARDEN.y + 0.08, z + dz, r() * 6));
    W.cyl(x, z, 0.75, -1, 2);
  }

  /* ── garden walls (tsuiji) and the overlook ── */
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.add('darkStone', box(len, 0.4, 0.55, 0, 1, 1), mat(cx, GARDEN.y + 0.2, cz, ry));
    B.add('plaster', box(len, 1.4, 0.4, 0, 1.2, 1.2), mat(cx, GARDEN.y + 1.1, cz, ry));
    for (const s of [-1, 1]) B.add('tile', box(len + 0.3, 0.08, 0.42, 0, 1.8, 1.4), mat(cx + Math.sin(ry) * s * 0.17, GARDEN.y + 1.9, cz + Math.cos(ry) * s * 0.17, ry, s * 0.45));
    B.add('tile', cyl(0.07, 0.07, len + 0.3, 8).rotateZ(Math.PI / 2), mat(cx, GARDEN.y + 1.98, cz, ry), 0.6);
    W.box(Math.min(x0, x1) - 0.3, Math.max(x0, x1) + 0.3, -2, 3, Math.min(z0, z1) - 0.3, Math.max(z0, z1) + 0.3);
  };
  wall(GARDEN.x0, GARDEN.z1, -2.2, GARDEN.z1);
  wall(2.2, GARDEN.z1, GARDEN.x1, GARDEN.z1);
  wall(GARDEN.x0, GARDEN.z0 - 0.2, GARDEN.x0, GARDEN.z1);
  wall(GARDEN.x1, GARDEN.z0 - 0.2, GARDEN.x1, GARDEN.z1);
  {
    for (let x = -2.1; x <= 2.11; x += 0.7) B.add('stone', box(0.16, 0.8, 0.16, 1, 1, 1), mat(x, GARDEN.y + 0.4, GARDEN.z1 + 0.1));
    B.add('stone', box(4.4, 0.12, 0.22, 0, 1, 1), mat(0, GARDEN.y + 0.8, GARDEN.z1 + 0.1));
    W.box(-2.3, 2.3, -2, 3, GARDEN.z1 - 0.1, GARDEN.z1 + 0.3);
  }

  /* ── trees ── */
  const foliageMat = new MeshStandardMaterial({ roughness: 0.85, vertexColors: true, side: DoubleSide });
  swaying(foliageMat, time, 0.03);
  const barkMat = mats.walnut;
  const leafParts: BufferGeometry[] = [];
  const mapleClusters: { c: Vector3; r: number; n: number; size: number; colors: Color[] }[] = [];
  const maple = (x: number, z: number, hue: Color[], scale = 1) => {
    const base = new Vector3(x, GARDEN.y, z);
    const trunkH = 2.4 * scale;
    B.add('walnut', cyl(0.12 * scale, 0.2 * scale, trunkH, 10), mat(x, base.y + trunkH / 2, z, 0, 0, 0.08), 0.8);
    W.cyl(x, z, 0.3, -1, 3);
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + r();
      const len = (1.6 + r()) * scale, tilt = 0.7 + r() * 0.4;
      const tip = new Vector3(x + Math.cos(a) * Math.sin(tilt) * len, base.y + trunkH + Math.cos(tilt) * len, z + Math.sin(a) * Math.sin(tilt) * len);
      const mid = new Vector3(x, base.y + trunkH - 0.2, z).lerp(tip, 0.5);
      const dir = tip.clone().sub(new Vector3(x, base.y + trunkH - 0.2, z));
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
      const m4 = new Matrix4().compose(mid, q, new Vector3(1, 1, 1));
      B.add('walnut', cyl(0.035 * scale, 0.09 * scale, dir.length(), 7), m4, 0.8);
      for (let c = 0; c < 3; c++) {
        const s = (0.75 + r() * 0.5) * scale;
        mapleClusters.push({
          c: new Vector3(tip.x + (r() - 0.5) * 1.2 * scale, tip.y + (r() - 0.3) * 0.8 * scale, tip.z + (r() - 0.5) * 1.2 * scale),
          r: s * 1.15, n: 70, size: 0.62 * scale, colors: hue,
        });
      }
    }
  };
  const autumn = [new Color('#a8321e'), new Color('#c4561f'), new Color('#d98a2b'), new Color('#8c2a1c')];
  const green = [new Color('#3f5a26'), new Color('#4d6b2c'), new Color('#5d7a33')];
  maple(-13.2, 25.2, autumn, 1.15);
  maple(11.2, 23.6, autumn, 1.0);
  maple(14.4, 17.4, [autumn[2], autumn[1], green[2]], 0.85);
  maple(-15.6, 16.2, green, 0.8);
  // a low, cloud-pruned pine leaning toward the overlook
  {
    const x = 4.6, z = 25.2;
    const pts = [new Vector3(x, GARDEN.y, z), new Vector3(x - 0.4, GARDEN.y + 1.2, z + 0.2), new Vector3(x - 1.4, GARDEN.y + 2.0, z + 0.5), new Vector3(x - 2.8, GARDEN.y + 2.3, z + 0.7)];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pts[i + 1].clone().sub(pts[i]);
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
      B.add('walnut', cyl(0.13 - i * 0.03, 0.17 - i * 0.03, d.length() + 0.1, 9), new Matrix4().compose(pts[i].clone().lerp(pts[i + 1], 0.5), q, new Vector3(1, 1, 1)), 0.65);
    }
    W.cyl(x, z, 0.3, -1, 3);
    for (const [px, py, pz, s] of [[x - 0.3, 1.6, z + 0.2, 1.1], [x - 1.5, 2.4, z + 0.6, 1.3], [x - 2.9, 2.6, z + 0.8, 1.2], [x + 0.4, 2.2, z - 0.1, 0.8]]) {
      const g = new SphereGeometry(1, 14, 8).scale(s, 0.32 * s, s * 0.85).translate(px, GARDEN.y + py, pz).toNonIndexed();
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < c.length; i += 3) { const k = 0.85 + r() * 0.25; c[i] = 0.12 * k; c[i + 1] = 0.2 * k; c[i + 2] = 0.1 * k; }
      g.setAttribute('color', new BufferAttribute(c, 3));
      g.deleteAttribute('uv');
      leafParts.push(g);
    }
  }
  const leaves = new Mesh(mergeGeometries(leafParts)!, foliageMat);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  const mapleMat = new MeshStandardMaterial({ map: tex.maple, alphaTest: 0.45, side: DoubleSide, vertexColors: true, roughness: 0.8 });
  swaying(mapleMat, time, 0.025);
  const mapleMesh = new Mesh(leafCards(mapleClusters, r), mapleMat);
  mapleMesh.castShadow = true;
  mapleMesh.receiveShadow = true;
  group.add(mapleMesh);
  void barkMat;

  // bamboo groves along the side walls
  {
    const culms: Matrix4[] = [];
    const tufts: Matrix4[] = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 46; k++) {
        const x = side * (15.6 + r() * 2.1), z = 15.2 + r() * 11.8;
        const h = 6 + r() * 3.5, rr = 0.035 + r() * 0.02;
        culms.push(new Matrix4().compose(new Vector3(x, GARDEN.y, z), new Quaternion().setFromAxisAngle(new Vector3(r() - 0.5, 0, r() - 0.5).normalize(), r() * 0.06), new Vector3(rr / 0.04, h, rr / 0.04)));
        for (let t = 0; t < 3; t++) tufts.push(new Matrix4().compose(new Vector3(x + (r() - 0.5) * 0.8, GARDEN.y + h * (0.65 + t * 0.12), z + (r() - 0.5) * 0.8), new Quaternion(), new Vector3(0.6 + r() * 0.4, 0.3, 0.6 + r() * 0.4)));
      }
    }
    const culmGeo = new CylinderGeometry(0.04, 0.04, 1, 7).translate(0, 0.5, 0);
    const culmMat = new MeshStandardMaterial({ color: '#7d8c3e', roughness: 0.55 });
    swaying(culmMat, time, 0.025, true);
    const cim = new InstancedMesh(culmGeo, culmMat, culms.length);
    culms.forEach((m, i) => cim.setMatrixAt(i, m));
    cim.castShadow = true;
    group.add(cim);
    const bambooClusters = tufts.map((m) => {
      const p = new Vector3().setFromMatrixPosition(m);
      return { c: p, r: 0.75, n: 9, size: 0.7, colors: [new Color('#4f6b2c'), new Color('#5d7a33'), new Color('#3f5a26')] };
    });
    const bmat = new MeshStandardMaterial({ map: tex.bambooLeaf, alphaTest: 0.45, side: DoubleSide, vertexColors: true, roughness: 0.75 });
    swaying(bmat, time, 0.018);
    const bmesh = new Mesh(leafCards(bambooClusters, r), bmat);
    bmesh.castShadow = true;
    group.add(bmesh);
  }

  // cedar forest on the slopes
  {
    const parts: BufferGeometry[] = [];
    const trunk = new CylinderGeometry(0.12, 0.2, 3, 6).translate(0, 1.5, 0);
    parts.push(paint(trunk, new Color('#3b2a1e')));
    for (let k = 0; k < 4; k++) {
      const c = new ConeGeometry(1.6 - k * 0.32, 3.2, 7).translate(0, 2.6 + k * 1.7, 0);
      parts.push(paint(c, new Color('#2c3b26').multiplyScalar(0.9 + k * 0.07)));
    }
    const treeGeo = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
    const n = quality.trees;
    const tim = new InstancedMesh(treeGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), n);
    const m4 = new Matrix4(), q = new Quaternion();
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 6; tries++) {
      const a = r() * Math.PI * 2, rr = 33 + Math.pow(r(), 0.8) * 70;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (z > 12 && Math.abs(x) < 20 && rr < 40) continue;
      const s = 1.1 + r() * 1.4;
      m4.compose(new Vector3(x, terrainHeight(x, z) - 0.4, z), q.setFromAxisAngle(new Vector3(0, 1, 0), r() * 6), new Vector3(s, s * (0.9 + r() * 0.4), s));
      tim.setMatrixAt(placed, m4);
      tim.setColorAt(placed, new Color().setScalar(0.8 + r() * 0.35));
      placed++;
    }
    tim.count = placed;
    tim.castShadow = false;
    tim.receiveShadow = true;
    group.add(tim);
  }

  /* ── distant ridges ── */
  const ridge = (R: number, base: number, amp: number, near: Color, seed: number, seg = 220) => {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const fogC = new Color('#d5dbdb');
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2 + seed, 5);
      const peak = base + Math.pow(Math.max(0, n - 0.28), 1.5) * amp * 3.2;
      const rr = R * (1 + (fbm(a * 3, seed, 2) - 0.5) * 0.25);
      pos.push(Math.cos(a) * rr, peak, Math.sin(a) * rr, Math.cos(a) * rr, -90, Math.sin(a) * rr);
      col.push(near.r, near.g, near.b, fogC.r, fogC.g, fogC.b);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    const m = new MeshBasicMaterial({ vertexColors: true, fog: true, side: DoubleSide });
    mountainMats.push(m);
    const mesh = new Mesh(g, m);
    group.add(mesh);
  };
  ridge(330, -40, 95, new Color('#4f5f63'), 3);
  ridge(520, -30, 150, new Color('#73848b'), 7);
  ridge(780, -20, 210, new Color('#98a8ae'), 13);

  /* ── waterfall on a neighbouring crag ── */
  const fallPos = new Vector3(-64, -14, 108);
  {
    const g = new CylinderGeometry(15, 26, 96, 48, 32);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + (fbm(a * 3, y * 0.05, 4) - 0.5) * 0.5;
      p.setXYZ(i, x * k, y + (y > 40 ? fbm(a * 4, 3, 2) * 6 : 0), z * k);
      const top = y > 38;
      const moss = fbm(a * 6, y * 0.08, 3);
      cols.set(top || moss > 0.62 ? [0.17, 0.22, 0.13] : [0.22 + fbm(a, y * 0.1, 2) * 0.08, 0.21, 0.2], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const crag = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    crag.position.copy(fallPos).add(new Vector3(0, 30, 0));
    group.add(crag);
    const toPagoda = new Vector3(0, 0, 20).sub(fallPos).setY(0).normalize();
    const fallMat = new ShaderMaterial({
      uniforms: { uTime: time.uTime, uFog: { value: new Color('#d0d7d7') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `${GLSL_NOISE}
        uniform float uTime; uniform vec3 uFog; varying vec2 vUv;
        void main(){
          float s = vnoise(vec2(vUv.x * 18.0, vUv.y * 3.0 + uTime * 1.6)) * 0.6 + vnoise(vec2(vUv.x * 40.0, vUv.y * 8.0 + uTime * 2.4)) * 0.4;
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          float a = edge * (0.45 + s * 0.55) * smoothstep(0.0, 0.12, vUv.y);
          vec3 col = mix(vec3(0.82, 0.88, 0.9), vec3(1.0), s);
          gl_FragColor = vec4(mix(col, uFog, 0.35), a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: DoubleSide,
    });
    const fall = new Mesh(new PlaneGeometry(7, 70, 1, 1), fallMat);
    fall.position.copy(fallPos).addScaledVector(toPagoda, 20.5).add(new Vector3(0, 30, 0));
    fall.lookAt(fall.position.clone().add(toPagoda));
    group.add(fall);
    cloudUniforms.push({ uLight: { value: new Color() }, uShadow: { value: new Color() }, uFog: fallMat.uniforms.uFog });
  }

  /* ── sea of clouds (unkai) ── */
  const cloudLayer = (y: number, density: number, scale: number, speed: number) => {
    const u = {
      uTime: time.uTime, uLight: { value: new Color('#f7f4ec') }, uShadow: { value: new Color('#a3afb8') }, uFog: { value: new Color('#cfd6d6') },
      uDensity: { value: density }, uScale: { value: scale }, uSpeed: { value: speed },
    };
    cloudUniforms.push(u);
    const m = new ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, side: DoubleSide,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `${GLSL_NOISE}
        uniform float uTime, uDensity, uScale, uSpeed; uniform vec3 uLight, uShadow, uFog; varying vec3 vW;
        void main(){
          vec2 p = vW.xz * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.4);
          float n = fbm(p); float n2 = fbm(p * 2.3 - uTime * uSpeed * 0.6);
          float d = smoothstep(0.62 - uDensity * 0.35, 0.95 - uDensity * 0.2, n * 0.75 + n2 * 0.4);
          vec3 col = mix(uShadow, uLight, smoothstep(0.25, 0.85, n2));
          float dist = length(vW.xz - cameraPosition.xz);
          float f = smoothstep(150.0, 1300.0, dist);
          gl_FragColor = vec4(mix(col, uFog, f), mix(d, uDensity, f));
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new Mesh(new PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2), m);
    mesh.position.y = y;
    mesh.renderOrder = 2;
    group.add(mesh);
  };
  cloudLayer(-34, 1.0, 0.0045, 0.003);
  cloudLayer(-19, 0.35, 0.008, 0.005);

  // mist wisps drifting past the mountaintop
  const wisps: Sprite[] = [];
  for (let k = 0; k < 18; k++) {
    const sm = new SpriteMaterial({ map: tex.smoke, color: '#eef0ee', opacity: 0.32, depthWrite: false, fog: true });
    const s = new Sprite(sm);
    const a = r() * Math.PI * 2, rr = 42 + r() * 60;
    s.position.set(Math.cos(a) * rr, -6 - r() * 16, Math.sin(a) * rr);
    s.scale.setScalar(26 + r() * 30);
    s.userData = { a, rr, speed: 0.004 + r() * 0.006, y: s.position.y };
    wisps.push(s);
    group.add(s);
  }

  void rand;
  function update(t: number) {
    time.uTime.value = t;
    koi.forEach((m) => {
      const { phase, speed, rad } = m.userData as { phase: number; speed: number; rad: number };
      const a = t * speed + phase;
      m.position.set(pond.x + Math.cos(a) * pond.rx * rad * 0.6, GARDEN.y - 0.32, pond.z + Math.sin(a * 1.3) * pond.rz * rad * 0.5);
      m.rotation.y = -a - Math.PI / 2 + Math.sin(t * 3 + phase) * 0.2;
    });
    wisps.forEach((s) => {
      const u = s.userData as { a: number; rr: number; speed: number; y: number };
      const a = u.a + t * u.speed;
      s.position.set(Math.cos(a) * u.rr, u.y + Math.sin(t * 0.05 + u.a) * 2, Math.sin(a) * u.rr);
    });
  }

  return {
    group, update, waterfall: fallPos.clone().add(new Vector3(0, 20, 0)),
    stoneLantern: new Vector3(lx, ly + 1.55, lz), overlook: new Vector3(0, GARDEN.y + 1, GARDEN.z1 + 0.1),
  };
}

function paint(g: BufferGeometry, c: Color) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
