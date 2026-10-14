import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, FogExp2,
  Group, HemisphereLight, Mesh, MeshBasicMaterial, Object3D, PMREMGenerator, Points, Scene, ShaderMaterial, SphereGeometry,
  SpotLight, Texture, Vector3, WebGLRenderer, NormalBlending,
} from 'three';
import { CLR_TOP, H1, H2 } from '../core/layout';
import { rand } from '../core/noise';

export const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

interface Mood {
  sunDir: Vector3; sunColor: Color; sunIntensity: number;
  hemiSky: Color; hemiGround: Color; hemiIntensity: number;
  skyTop: Color; skyHorizon: Color; skyBottom: Color; fog: Color;
  cloudLight: Color; cloudShadow: Color; mountain: Color; shaft: Color; warmth: number; exposure: number; env: number;
}
const MORNING: Mood = {
  sunDir: new Vector3(0.45, 0.62, 1).normalize(), sunColor: new Color('#fff0d6'), sunIntensity: 3.2,
  hemiSky: new Color('#c3cfd9'), hemiGround: new Color('#5a4030'), hemiIntensity: 0.34,
  skyTop: new Color('#6f90b0'), skyHorizon: new Color('#e2e6e3'), skyBottom: new Color('#c3cbcd'), fog: new Color('#cfd6d6'),
  cloudLight: new Color('#f7f4ec'), cloudShadow: new Color('#a3afb8'), mountain: new Color('#ffffff'), shaft: new Color('#ffe9c4'),
  warmth: 0.9, exposure: 0.95, env: 0.3,
};
const EVENING: Mood = {
  sunDir: new Vector3(-0.85, 0.3, 1).normalize(), sunColor: new Color('#ffa463'), sunIntensity: 2.6,
  hemiSky: new Color('#9c8aa0'), hemiGround: new Color('#4a2c20'), hemiIntensity: 0.22,
  skyTop: new Color('#3b4568'), skyHorizon: new Color('#f2b07c'), skyBottom: new Color('#b68a7c'), fog: new Color('#d0a088'),
  cloudLight: new Color('#f8caa0'), cloudShadow: new Color('#7f6676'), mountain: new Color('#e9b8a4'), shaft: new Color('#ffb877'),
  warmth: 1.65, exposure: 1.02, env: 0.18,
};
const lerpMood = (k: number): Mood => {
  const a = MORNING, b = EVENING;
  const c = (x: Color, y: Color) => x.clone().lerp(y, k);
  return {
    sunDir: a.sunDir.clone().lerp(b.sunDir, k).normalize(), sunColor: c(a.sunColor, b.sunColor), sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k,
    hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround), hemiIntensity: a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * k,
    skyTop: c(a.skyTop, b.skyTop), skyHorizon: c(a.skyHorizon, b.skyHorizon), skyBottom: c(a.skyBottom, b.skyBottom), fog: c(a.fog, b.fog),
    cloudLight: c(a.cloudLight, b.cloudLight), cloudShadow: c(a.cloudShadow, b.cloudShadow), mountain: c(a.mountain, b.mountain), shaft: c(a.shaft, b.shaft),
    warmth: a.warmth + (b.warmth - a.warmth) * k, exposure: a.exposure + (b.exposure - a.exposure) * k, env: a.env + (b.env - a.env) * k,
  };
};

/** A window or doorway that sunlight can pour through: centre, width (along x), height, floor below. */
interface Opening { x: number; y: number; z: number; w: number; h: number; floor: number; gate?: () => number }

export interface Atmosphere {
  sun: DirectionalLight;
  update(t: number, camPos: Vector3): void;
  setTime(k: number): Mood;
  cloudUniforms: Record<string, { value: unknown }>[];
  dispose(): void;
}

export function buildAtmosphere(
  scene: Scene, renderer: WebGLRenderer, tex: Record<string, Texture>, quality: { particles: number; shadowSize: number },
  smokeSources: Vector3[], openGate: (x: number) => number,
): Atmosphere & { mountainMats: MeshBasicMaterial[]; root: Group } {
  const root = new Group();
  root.name = 'atmosphere';
  scene.add(root);

  /* ── sky dome ── */
  const skyMat = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new Color() }, uHorizon: { value: new Color() }, uBottom: { value: new Color() },
      uSunDir: { value: new Vector3() }, uSunColor: { value: new Color() }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor; uniform float uTime; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHorizon, uBottom, pow(clamp(-h * 3.0, 0.0, 1.0), 0.5));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
        if (h > 0.0) {
          vec2 p = d.xz / (h + 0.15) * 1.6 + vec2(uTime * 0.004, 0.0);
          float c = smoothstep(0.5, 0.85, fbm(p));
          col = mix(col, mix(uHorizon, vec3(1.0), 0.5) + uSunColor * pow(s, 4.0) * 0.4, c * 0.45 * smoothstep(0.0, 0.25, h));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(new SphereGeometry(1400, 48, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  root.add(sky);
  scene.fog = new FogExp2(new Color(), 0.0026);

  /* ── lights ── */
  const hemi = new HemisphereLight(0xffffff, 0x000000, 1);
  root.add(hemi);
  const sun = new DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 34; sc.bottom = -30; sc.near = 5; sc.far = 190;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  const sunTarget = new Object3D();
  sunTarget.position.set(0, 0, 5);
  root.add(sunTarget);
  sun.target = sunTarget;
  root.add(sun);

  // A high clerestory beam that falls on the heart pillar and the dais.
  const spot = new SpotLight('#fff0d8', 520, 34, 0.17, 0.85, 2);
  spot.position.set(0.9, CLR_TOP - 1.2, 2.4);
  const spotTarget = new Object3D();
  spotTarget.position.set(-0.1, 0.45, -0.5);
  root.add(spotTarget);
  spot.target = spotTarget;
  root.add(spot);

  /* ── environment for subtle reflections ── */
  const pmrem = new PMREMGenerator(renderer);
  const envFor = (m: Mood) => {
    const s = new Scene();
    const g = new Mesh(new SphereGeometry(10, 32, 16), new ShaderMaterial({
      side: BackSide,
      uniforms: { a: { value: m.skyTop }, b: { value: m.skyHorizon }, c: { value: m.hemiGround.clone().multiplyScalar(1.4) } },
      vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 a,b,c; varying vec3 v; void main(){ vec3 col = v.y > 0.0 ? mix(b, a, v.y) : mix(b, c, min(1.0, -v.y * 3.0)); gl_FragColor = vec4(col, 1.0); }',
    }));
    s.add(g);
    const rt = pmrem.fromScene(s, 0.04);
    g.geometry.dispose();
    (g.material as ShaderMaterial).dispose();
    return rt;
  };
  const envs = [envFor(MORNING), envFor(EVENING)];
  scene.environment = envs[0].texture;

  /* ── light shafts ── */
  const shaftMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uTime: { value: 0 }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float gate; varying vec2 vUv; varying float vGate; varying vec3 vWorld;
      void main(){ vUv = uv; vGate = gate; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 uColor; uniform float uTime, uIntensity; varying vec2 vUv; varying float vGate; varying vec3 vWorld;
      void main(){
        float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
        float along = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.4);
        float streak = 0.65 + 0.35 * vnoise(vec2(vUv.x * 9.0 + uTime * 0.05, vUv.y * 1.5 - uTime * 0.03));
        float a = edge * along * streak * vGate * uIntensity * 0.032;
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const openings: Opening[] = [];
  for (const x of [-6, -2, 2, 6]) openings.push({ x, y: 1.4, z: 12, w: 1.7, h: 2.5, floor: 0, gate: Math.abs(x) > 4 ? () => openGate(x) : undefined });
  for (const x of [-10, -6, -2, 2, 6, 10]) openings.push({ x, y: 4.17, z: 12, w: 3.3, h: 0.8, floor: 0 });
  for (const x of [-6, -2, 2, 6]) openings.push({ x, y: H1 + 2.1, z: 12, w: 1.7, h: 1.5, floor: H1 });
  for (const x of [-6, 6]) openings.push({ x, y: H2 + 1.85, z: 12, w: 1.7, h: 1.2, floor: H2 });
  let shafts: Mesh | null = null;
  const buildShafts = (dir: Vector3) => {
    if (shafts) { root.remove(shafts); shafts.geometry.dispose(); }
    const pos: number[] = [], uv: number[] = [], gate: number[] = [];
    const d = dir.clone().negate(); // direction light travels
    // three crossing planes per opening give the shaft a believable volume from any angle
    const across = new Vector3(1, 0, 0).addScaledVector(d, -d.x).normalize();
    const up = new Vector3().crossVectors(d, across).normalize();
    openings.forEach((o) => {
      const len = Math.min(16, (o.y - o.floor) / Math.max(0.05, -d.y) + 0.6);
      const halves = [
        across.clone().multiplyScalar(o.w / 2),
        up.clone().multiplyScalar(o.h / 2),
        across.clone().multiplyScalar(o.w * 0.35).addScaledVector(up, o.h * 0.35),
      ];
      for (const half of halves) {
        const c0 = new Vector3(o.x, o.y, o.z), c1 = c0.clone().addScaledVector(d, len);
        const quad = [c0.clone().sub(half), c0.clone().add(half), c1.clone().add(half), c1.clone().sub(half)];
        const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(quad[i].x, quad[i].y, quad[i].z); uv.push(uvs[i][0], uvs[i][1]); gate.push(1); }
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.setAttribute('gate', new BufferAttribute(new Float32Array(gate), 1));
    shafts = new Mesh(g, shaftMat);
    shafts.frustumCulled = false;
    shafts.renderOrder = 5;
    root.add(shafts);
  };
  const updateGates = () => {
    if (!shafts) return;
    const g = shafts.geometry.attributes.gate as BufferAttribute;
    openings.forEach((o, i) => {
      if (!o.gate) return;
      const v = o.gate();
      for (let k = 0; k < 18; k++) g.setX(i * 18 + k, v);
    });
    g.needsUpdate = true;
  };

  // The clerestory beam: a soft cone along the spotlight.
  const beamLen = spot.position.distanceTo(spotTarget.position);
  const beamGeo = new CylinderGeometry(0.45, 1.5, beamLen, 32, 1, true);
  beamGeo.translate(0, -beamLen / 2, 0);
  const beamMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#fff0d8') }, uTime: { value: 0 }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY = -position.y / ${beamLen.toFixed(2)}; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float a = f * smoothstep(0.0, 0.15, vY) * (1.0 - vY * 0.7) * 0.05 * uIntensity; gl_FragColor = vec4(uColor * a, 1.0);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const beam = new Mesh(beamGeo, beamMat);
  beam.position.copy(spot.position);
  beam.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), spotTarget.position.clone().sub(spot.position).normalize());
  beam.renderOrder = 5;
  root.add(beam);

  /* ── floating dust ── */
  const dustN = Math.round(1600 * quality.particles);
  const dp = new Float32Array(dustN * 3), dph = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    const r = Math.random();
    if (r < 0.45) dp.set([rand(-2.6, 2.6), rand(0.4, 18.5), rand(-2.6, 2.6)], i * 3);
    else if (r < 0.8) dp.set([rand(-9, 9), rand(0.1, 4.6), rand(5, 11.8)], i * 3);
    else dp.set([rand(-11, 11), rand(H1, H2 + 3), rand(-11, 11)], i * 3);
    dph[i] = rand(0, 100);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(dp, 3));
  dustGeo.setAttribute('phase', new BufferAttribute(dph, 1));
  const dustMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uViewport: { value: 800 }, uColor: { value: new Color('#ffe2b8') }, uMap: { value: tex.glow } },
    vertexShader: /* glsl */ `attribute float phase; uniform float uTime, uViewport; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.11 + phase) * 0.35, sin(uTime * 0.07 + phase * 1.7) * 0.5, cos(uTime * 0.09 + phase * 0.6) * 0.35);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.008 + 0.009 * fract(phase)) * projectionMatrix[1][1] * uViewport * 0.5 / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = (0.5 + 0.5 * sin(uTime * 0.6 + phase * 3.0)) * smoothstep(0.2, 2.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * a * vA * 0.6, 1.0);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  root.add(dust);

  /* ── incense smoke and kettle steam, animated entirely on the GPU ── */
  const perSource = Math.round(36 * quality.particles) + 8;
  const sp = new Float32Array(smokeSources.length * perSource * 3), ss = new Float32Array(smokeSources.length * perSource);
  smokeSources.forEach((src, si) => {
    for (let k = 0; k < perSource; k++) {
      sp.set([src.x, src.y, src.z], (si * perSource + k) * 3);
      ss[si * perSource + k] = k / perSource + rand(0, 0.02);
    }
  });
  const smokeGeo = new BufferGeometry();
  smokeGeo.setAttribute('position', new BufferAttribute(sp, 3));
  smokeGeo.setAttribute('seed', new BufferAttribute(ss, 1));
  const smokeMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uViewport: { value: 800 }, uMap: { value: tex.smoke }, uColor: { value: new Color('#d9d4cc') } },
    vertexShader: /* glsl */ `attribute float seed; uniform float uTime, uViewport; varying float vA; varying float vRot;
      void main(){
        float life = 7.0; float age = mod(uTime + seed * life, life); float k = age / life;
        vec3 p = position + vec3(sin(age * 0.8 + seed * 40.0) * 0.06 * age, age * 0.22, cos(age * 0.6 + seed * 25.0) * 0.06 * age);
        p.x += sin(uTime * 0.3 + p.y * 2.0) * 0.05 * k;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.05 + k * 0.55) * projectionMatrix[1][1] * uViewport * 0.5 / max(0.2, -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.12, k) * (1.0 - k) * 0.32; vRot = seed * 6.28 + age * 0.3;
      }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform vec3 uColor; varying float vA; varying float vRot;
      void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot); c = mat2(co, -s, s, co) * c;
        float a = texture2D(uMap, c + 0.5).a * vA; gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: NormalBlending,
  });
  const smoke = new Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 6;
  root.add(smoke);

  const mountainMats: MeshBasicMaterial[] = [];
  const cloudUniforms: Record<string, { value: unknown }>[] = [];
  let currentEnv = 0;
  let baseSun = MORNING.sunIntensity;

  function setTime(k: number): Mood {
    const m = lerpMood(k);
    sun.color.copy(m.sunColor);
    baseSun = m.sunIntensity;
    sun.intensity = baseSun;
    sun.position.copy(sunTarget.position).addScaledVector(m.sunDir, 90);
    hemi.color.copy(m.hemiSky); hemi.groundColor.copy(m.hemiGround); hemi.intensity = m.hemiIntensity;
    skyMat.uniforms.uTop.value.copy(m.skyTop);
    skyMat.uniforms.uHorizon.value.copy(m.skyHorizon);
    skyMat.uniforms.uBottom.value.copy(m.skyBottom);
    skyMat.uniforms.uSunDir.value.copy(m.sunDir);
    skyMat.uniforms.uSunColor.value.copy(m.sunColor);
    (scene.fog as FogExp2).color.copy(m.fog);
    shaftMat.uniforms.uColor.value.copy(m.shaft);
    shaftMat.uniforms.uIntensity.value = 1 - k * 0.2;
    spot.color.copy(m.shaft).lerp(new Color('#ffffff'), 0.3);
    spot.intensity = 520 * (1 - k * 0.45);
    beamMat.uniforms.uIntensity.value = 1 - k * 0.5;
    beamMat.uniforms.uColor.value.copy(spot.color);
    mountainMats.forEach((mm) => mm.color.copy(m.mountain));
    cloudUniforms.forEach((u) => { (u.uLight.value as Color).copy(m.cloudLight); (u.uShadow.value as Color).copy(m.cloudShadow); (u.uFog.value as Color).copy(m.fog); });
    renderer.toneMappingExposure = m.exposure;
    const want = k > 0.5 ? 1 : 0;
    if (want !== currentEnv) { currentEnv = want; scene.environment = envs[want].texture; }
    scene.environmentIntensity = m.env;
    buildShafts(m.sunDir);
    updateGates();
    renderer.shadowMap.needsUpdate = true;
    return m;
  }

  function update(t: number, camPos: Vector3) {
    skyMat.uniforms.uTime.value = t;
    shaftMat.uniforms.uTime.value = t;
    dustMat.uniforms.uTime.value = t;
    smokeMat.uniforms.uTime.value = t;
    sky.position.copy(camPos);
    updateGates();
    // passing clouds: the sun dims and returns very slowly
    const cloud = 0.88 + 0.12 * Math.sin(t * 0.05) * Math.sin(t * 0.031 + 1.3);
    sun.intensity = baseSun * cloud;
  }

  function dispose() {
    envs.forEach((e) => e.dispose());
    pmrem.dispose();
  }

  // the glow-size shaders need the viewport height
  root.userData.viewportMats = [dustMat, smokeMat];
  return { sun, update, setTime, cloudUniforms, dispose, mountainMats, root };
}
