import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Group, InstancedMesh,
  LatheGeometry, Material, Matrix4, Mesh, MeshBasicMaterial, Points, PointLight, Quaternion, ShaderMaterial, Texture,
  TorusGeometry, Vector2, Vector3,
} from 'three';
import { Batch, cyl, mat, projectUV, withColor } from '../core/geo';
import { CLR_TOP, H1, H2, H3, SLAB, VOID } from '../core/layout';
import { rand } from '../core/noise';

interface Hanging { pivot: Vector3; len: number; s: number; phase: number; amp: number }

const _m = new Matrix4(), _m2 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _one = new Vector3(1, 1, 1);

function swing(h: Hanging, t: number) {
  _e.set(Math.sin(t * 0.62 + h.phase) * h.amp, 0, Math.cos(t * 0.47 + h.phase * 1.3) * h.amp);
  _q.setFromEuler(_e);
  return _m.compose(h.pivot, _q, _one);
}

export interface LanternSystem {
  group: Group;
  lights: PointLight[];
  update(t: number): void;
  setWarmth(k: number): void;
  /** world positions of the big atrium lanterns, used for hotspots */
  atrium: Vector3[];
}

export function buildLanterns(mats: Record<string, Material>, tex: Record<string, Texture>, flames: Vector3[], lightBudget: number): LanternSystem {
  const group = new Group();
  group.name = 'lanterns';

  /* ── paper chōchin ── */
  const paper: Hanging[] = [];
  const addPaper = (x: number, y: number, z: number, len: number, s = 1) =>
    paper.push({ pivot: new Vector3(x, y, z), len, s, phase: rand(0, 6), amp: 0.025 });
  const joist2 = H2 - SLAB - 0.24, joist1 = H1 - SLAB - 0.24;
  for (let z = -10; z <= 10.01; z += 2.5) addPaper(7.2, joist2, z, 1.25 + (Math.abs(z) % 5 ? 0.15 : 0), 1);
  for (const [x, z] of [[-8, 8.5], [8, 8.5], [-8, -8.5], [-4.5, 8.5], [4.5, 8.5], [-9, 0.5]] as [number, number][]) addPaper(x, joist1, z, 1.7, 1.1);
  for (const [x, z] of [[-8, 8], [8, 8], [-8, -8], [8, -4], [-6, 2]] as [number, number][]) addPaper(x, H3 - 0.05, z, 1.15, 1);
  for (const x of [-6, 0, 6]) addPaper(x, 5.3, 13.7, 1.7, 1.15);

  const H = 0.6;
  const prof: Vector2[] = [];
  for (let i = 0; i <= 48; i++) {
    const v = i / 48;
    const r = 0.27 * Math.sin(Math.PI * (0.08 + v * 0.84)) * (1 - 0.035 * Math.abs(Math.sin(v * Math.PI * 16)));
    prof.push(new Vector2(r, -v * H));
  }
  const bodyGeo = withColor(projectUV(new LatheGeometry(prof, 24), 1, 0.8, 0.8));
  const capGeo = withColor(new CylinderGeometry(0.13, 0.13, 0.06, 20));
  const cordGeo = withColor(new CylinderGeometry(0.006, 0.006, 1, 5).translate(0, -0.5, 0));
  const bodies = new InstancedMesh(bodyGeo, mats.lanternPaper, paper.length);
  const caps = new InstancedMesh(capGeo, mats.black, paper.length * 2);
  const cords = new InstancedMesh(cordGeo, mats.fabricBlack, paper.length);
  for (const im of [bodies, caps, cords]) { im.frustumCulled = false; group.add(im); }

  /* ── bronze tsuri-dōrō ── */
  const bronze: Hanging[] = [];
  const bigHeights = [4.9, 6.1, 4.9, 6.1];
  [[1.55, 1.55], [1.55, -1.55], [-1.55, -1.55], [-1.55, 1.55]].forEach(([x, z], i) => {
    const hook = bigHeights[i];
    bronze.push({ pivot: new Vector3(x, CLR_TOP - 0.2, z), len: CLR_TOP - 0.2 - hook, s: 1.3, phase: rand(0, 6), amp: 0.004 });
  });
  for (const yb of [H1 - SLAB - 0.55, H2 - SLAB - 0.55]) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      bronze.push({ pivot: new Vector3(sx * (VOID - 0.35), yb, sz * (VOID - 0.35)), len: 0.5, s: 0.85, phase: rand(0, 6), amp: 0.02 });
    }
  }
  const LB = new Batch();
  LB.add('bronze', projectUV(new TorusGeometry(0.06, 0.015, 6, 14), 1), mat(0, -0.04, 0));
  LB.add('bronze', cyl(0.05, 0.42, 0.28, 6), mat(0, -0.24, 0));
  LB.add('bronze', cyl(0.44, 0.44, 0.03, 6), mat(0, -0.39, 0));
  LB.add('gold', projectUV(new CylinderGeometry(0.03, 0.03, 0.1, 8), 1), mat(0, -0.1, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    LB.add('gold', projectUV(new CylinderGeometry(0.035, 0.02, 0.09, 8), 1), mat(Math.cos(a) * 0.44, -0.36, Math.sin(a) * 0.44));
    LB.add('bronze', cyl(0.018, 0.018, 0.56, 6), mat(Math.cos(a + Math.PI / 6) * 0.25, -0.68, Math.sin(a + Math.PI / 6) * 0.25));
    // pendant chimes (yōraku)
    LB.add('bronze', cyl(0.004, 0.004, 0.16, 4), mat(Math.cos(a) * 0.44, -0.47, Math.sin(a) * 0.44));
    LB.add('gold', cyl(0.03, 0.03, 0.05, 6), mat(Math.cos(a) * 0.44, -0.57, Math.sin(a) * 0.44));
  }
  for (const y of [-0.42, -0.6, -0.78, -0.96]) LB.add('bronze', cyl(0.265, 0.265, 0.018, 6, 0.8, 0.8, true), mat(0, y, 0, Math.PI / 6));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    for (const y of [-0.51, -0.69, -0.87]) {
      LB.add('bronze', cyl(0.006, 0.006, 0.17, 4), mat(Math.cos(a) * 0.26 + Math.cos(a + Math.PI / 2) * 0.06, y, Math.sin(a) * 0.26 + Math.sin(a + Math.PI / 2) * 0.06, 0, 0, 0.45));
    }
  }
  LB.add('lanternGlass', cyl(0.24, 0.24, 0.54, 6), mat(0, -0.69, 0, Math.PI / 6));
  LB.add('bronze', cyl(0.3, 0.2, 0.06, 6), mat(0, -0.99, 0, Math.PI / 6));
  LB.add('gold', projectUV(new ConeGeometry(0.05, 0.12, 8).rotateX(Math.PI), 1), mat(0, -1.08, 0));
  const lanternParts = LB.build(mats, false, false);
  const bronzeIMs: InstancedMesh[] = [];
  lanternParts.children.forEach((c) => {
    const m = c as Mesh;
    const im = new InstancedMesh(m.geometry, m.material as Material, bronze.length);
    im.frustumCulled = false;
    bronzeIMs.push(im);
    group.add(im);
  });
  const LINK = 0.088;
  const linkCount = bronze.reduce((n, b) => n + Math.ceil(b.len / LINK), 0);
  const links = new InstancedMesh(withColor(projectUV(new TorusGeometry(0.045, 0.011, 5, 10), 1)), mats.bronze, linkCount);
  links.frustumCulled = false;
  group.add(links);

  /* ── candle flames ── */
  const flameMat = new MeshBasicMaterial({ color: new Color('#ffcf7a').multiplyScalar(2.2), toneMapped: false });
  const flameIM = new InstancedMesh(new ConeGeometry(0.018, 0.07, 8).translate(0, 0.035, 0), flameMat, flames.length);
  flameIM.frustumCulled = false;
  group.add(flameIM);

  /* ── glow sprites (one draw call) ── */
  const glowCount = paper.length + bronze.length + flames.length + 6;
  const gPos = new Float32Array(glowCount * 3), gSize = new Float32Array(glowCount), gPhase = new Float32Array(glowCount);
  for (let i = 0; i < glowCount; i++) gPhase[i] = rand(0, 20);
  const glowGeo = new BufferGeometry();
  glowGeo.setAttribute('position', new BufferAttribute(gPos, 3));
  glowGeo.setAttribute('size', new BufferAttribute(gSize, 1));
  glowGeo.setAttribute('phase', new BufferAttribute(gPhase, 1));
  const glowMat = new ShaderMaterial({
    uniforms: { map: { value: tex.glow }, uTime: { value: 0 }, uViewport: { value: 800 }, uColor: { value: new Color('#ffb46a') }, uIntensity: { value: 0.55 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase;
      uniform float uTime; uniform float uViewport;
      varying float vFlicker;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * projectionMatrix[1][1] * uViewport * 0.5 / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
        vFlicker = 0.9 + 0.06 * sin(uTime * 7.3 + phase) + 0.04 * sin(uTime * 13.1 + phase * 2.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uColor; uniform float uIntensity;
      varying float vFlicker;
      void main() {
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(uColor * a * uIntensity * vFlicker, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const glows = new Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  group.add(glows);

  // static glow sizes; positions for the fixed ones (flames, standing lamps)
  let gi = 0;
  paper.forEach(() => { gSize[gi++] = 1.1; });
  bronze.forEach((b) => { gSize[gi++] = 1.25 * b.s; });
  flames.forEach((f) => { gPos.set([f.x, f.y + 0.03, f.z], gi * 3); gSize[gi++] = 0.26; });
  const fixedGlows: [number, number, number, number][] = [
    [-2.1, 1.42, -10.7, 1.4], [2.1, 1.42, -10.7, 1.4], [0, 1.78, -18.6, 2.2], [7.5, 0.67, 3.1, 1], [7.5, 0.67, -3.1, 1], [-7.2, H1 + 0.55, 0, 1],
  ];
  fixedGlows.forEach(([x, y, z, s]) => { gPos.set([x, y, z], gi * 3); gSize[gi++] = s; });

  /* ── point lights, in priority order ── */
  const lightDefs: [number, number, number, number, number][] = [
    // x, y, z, intensity (cd), range
    [1.55, 4.3, 1.55, 9, 16],
    [-1.55, 5.4, -1.55, 9, 16],
    [0, 2.4, -16.4, 7, 12],
    [7.2, 8.9, 0, 6, 13],
    [0.8, 14.2, -6.2, 6, 10],
    [0, 3.3, 8.6, 7, 14],
    [-1.55, 4.3, 1.55, 6, 14],
    [1.55, 5.4, -1.55, 6, 14],
    [10.1, 2.1, -1.4, 5, 8],
    [7.2, 8.9, -7.5, 4, 10],
  ];
  const lights: PointLight[] = [];
  const baseIntensity: number[] = [];
  lightDefs.slice(0, lightBudget).forEach(([x, y, z, i, d]) => {
    const l = new PointLight('#ffc184', i * (lightBudget < 8 ? 1.25 : 1), d, 1.7);
    l.position.set(x, y, z);
    l.castShadow = false;
    lights.push(l);
    baseIntensity.push(l.intensity);
    group.add(l);
  });

  let warmth = 1;
  const posAttr = glowGeo.attributes.position as BufferAttribute;

  function update(t: number) {
    let g = 0;
    paper.forEach((h, i) => {
      const P = swing(h, t);
      _m2.makeTranslation(0, -h.len, 0).scale(_v.set(h.s, h.s, h.s));
      bodies.setMatrixAt(i, _m2.premultiply(P));
      caps.setMatrixAt(i * 2, _m2);
      _m2.makeTranslation(0, -h.len - H * h.s, 0).scale(_v.set(h.s, h.s, h.s)).premultiply(P);
      caps.setMatrixAt(i * 2 + 1, _m2);
      _m2.makeScale(1, h.len, 1).premultiply(P);
      cords.setMatrixAt(i, _m2);
      _v.set(0, -h.len - H * 0.5 * h.s, 0).applyMatrix4(P);
      posAttr.setXYZ(g++, _v.x, _v.y, _v.z);
    });
    let li = 0;
    bronze.forEach((h, i) => {
      const P = swing(h, t);
      _m2.makeTranslation(0, -h.len, 0).scale(_v.set(h.s, h.s, h.s)).premultiply(P);
      for (const im of bronzeIMs) im.setMatrixAt(i, _m2);
      const n = Math.ceil(h.len / LINK);
      for (let k = 0; k < n; k++) {
        _m2.makeRotationY(k % 2 ? Math.PI / 2 : 0).setPosition(0, -k * LINK - LINK / 2, 0).premultiply(P);
        links.setMatrixAt(li++, _m2);
      }
      _v.set(0, -h.len - 0.69 * h.s, 0).applyMatrix4(P);
      posAttr.setXYZ(g++, _v.x, _v.y, _v.z);
    });
    flames.forEach((f, i) => {
      const k = 1 + 0.18 * Math.sin(t * 11 + i * 3.1) + 0.1 * Math.sin(t * 23 + i);
      _m2.makeScale(1, k, 1).setPosition(f.x + Math.sin(t * 3 + i) * 0.003, f.y - 0.04, f.z);
      flameIM.setMatrixAt(i, _m2);
    });
    for (const im of [bodies, caps, cords, links, flameIM, ...bronzeIMs]) im.instanceMatrix.needsUpdate = true;
    posAttr.needsUpdate = true;
    glowMat.uniforms.uTime.value = t;
    lights.forEach((l, i) => {
      l.intensity = baseIntensity[i] * warmth * (1 + 0.035 * Math.sin(t * 6.1 + i * 2) + 0.02 * Math.sin(t * 14.3 + i));
    });
  }

  function setWarmth(k: number) {
    warmth = k;
    glowMat.uniforms.uIntensity.value = 0.3 * (0.6 + k * 0.5);
    (mats.lanternPaper as unknown as { emissiveIntensity: number }).emissiveIntensity = 1.3 * k;
    (mats.lanternGlass as unknown as { emissiveIntensity: number }).emissiveIntensity = 1.9 * k;
  }

  update(0);
  group.userData.glowMat = glowMat; // needs the viewport height, see setGlowViewport
  return {
    group, lights, update, setWarmth,
    atrium: bronze.slice(0, 4).map((b) => new Vector3(b.pivot.x, b.pivot.y - b.len - 0.7 * b.s, b.pivot.z)),
  };
}

export function setGlowViewport(group: Group, h: number) {
  const m = group.userData.glowMat as ShaderMaterial | undefined;
  if (m) m.uniforms.uViewport.value = h;
}
