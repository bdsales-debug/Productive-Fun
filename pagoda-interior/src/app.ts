import {
  ACESFilmicToneMapping, Material, Mesh, PCFSoftShadowMap, PerspectiveCamera, Scene, ShaderMaterial, SRGBColorSpace, Texture,
  Vector2, Vector3, WebGLRenderer, Object3D,
} from 'three';
import { Ambience } from './audio/ambience';
import { Director, VIEWPOINTS, type Mode, type Viewpoint } from './controls/director';
import { Player } from './controls/player';
import { Batch } from './core/geo';
import { ANNEX, CLR_TOP, ENGAWA, H1, H2, OUT, SLAB } from './core/layout';
import { createPalette } from './core/materials';
import { buildAtmosphere } from './world/atmosphere';
import { CollisionWorld } from './world/collision';
import { buildDetails } from './world/details';
import { buildExterior } from './world/exterior';
import { Hotspots, type Hotspot } from './world/hotspots';
import { buildLanterns, setGlowViewport } from './world/lanterns';
import { buildStructure, wxz } from './world/structure';

export interface Quality { tier: 'high' | 'low'; dpr: number; shadowSize: number; lights: number; particles: number; trees: number }

export function detectQuality(): Quality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const forced = new URLSearchParams(location.search).get('quality');
  const low = forced ? forced === 'low' : coarse || small;
  return low
    ? { tier: 'low', dpr: Math.min(devicePixelRatio, 1.3), shadowSize: 1024, lights: 5, particles: 0.5, trees: 220 }
    : { tier: 'high', dpr: Math.min(devicePixelRatio, 1.75), shadowSize: 2048, lights: 10, particles: 1, trees: 460 };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function startExperience(canvas: HTMLCanvasElement, sketch: HTMLImageElement | null, onProgress: (p: number, label: string) => void) {
  const q = detectQuality();
  const renderer = new WebGLRenderer({ canvas, antialias: q.tier === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(q.tier === 'low' ? 64 : 58, innerWidth / innerHeight, 0.05, 3000);
  camera.position.set(7, 2.2, 0);

  /* ── build the world, reporting progress ── */
  const steps = ['Seasoning the timber', 'Laying the floorboards', 'Making paper and plaster', 'Raising columns and beams', 'Furnishing the halls', 'Planting the garden', 'Hanging the lanterns', 'Lighting the incense'];
  let stepIndex = 0;
  const report = async (label: string) => {
    onProgress(Math.min(0.98, stepIndex++ / steps.length), label);
    await nextFrame();
  };
  await report(steps[0]);
  const { mats, tex } = createPalette(() => undefined, sketch);
  await report(steps[1]);
  await report(steps[2]);
  for (const t of Object.values(tex)) t.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const world = new CollisionWorld();
  const B = new Batch();
  await report(steps[3]);
  const structure = buildStructure(B, world, mats);
  await report(steps[4]);
  const details = buildDetails(B, world, mats);

  await report(steps[5]);
  // Atmosphere first, so the exterior can register its clouds and ridges for time-of-day tinting.
  const slideOpen = (x: number) => structure.sliding.find((s) => Math.abs(s.center.x - x) < 0.5)?.open ?? 0;
  const atmo = buildAtmosphere(scene, renderer, tex, q, details.smoke, slideOpen);
  const exterior = buildExterior(B, world, mats, tex, atmo.cloudUniforms, atmo.mountainMats, q);
  scene.add(B.build(mats));
  scene.add(structure.slidingGroup, structure.shadowShell, details.group, exterior.group);

  await report(steps[6]);
  const lanterns = buildLanterns(mats, tex, details.flames, q.lights);
  scene.add(lanterns.group);

  await report(steps[7]);
  const player = new Player(world);
  const director = new Director(camera, canvas, player, $('fade'));
  const audio = new Ambience();

  /* ── interaction state ── */
  const state = {
    entered: false, uiHidden: false, timeK: 0, timeTarget: 0, hovered: null as Hotspot | null, card: null as Hotspot | null,
    locked: false, mouse: new Vector2(), hasMouse: false, slideHold: 0, view: 'atrium',
  };
  const touch = matchMedia('(pointer: coarse)').matches;

  const bellState = { strikeT: -1 };
  const strikeBell = () => { if (bellState.strikeT < 0) bellState.strikeT = 0; };
  const turnWheel = () => { details.rinzo.spin += 1.5; audio.wheel(); };
  const openScreens = () => {
    const anyClosed = structure.sliding.some((s) => s.target < 0.5);
    structure.sliding.forEach((s) => { s.target = anyClosed ? 1 : 0; });
    state.slideHold = 25;
    audio.slide();
  };

  const L3 = H2;
  const hotspots: Hotspot[] = [
    { id: 'shinbashira', jp: '心柱 · shinbashira', title: 'The heart pillar', pos: new Vector3(0, 2.3, 0.6),
      text: 'A single column of aged cedar rises nineteen metres from the dais to the lantern ceiling. In real pagodas the heart pillar is barely tied to the floors around it, so the tower can sway around it in an earthquake instead of falling.' },
    { id: 'tokyo', jp: '斗栱 · tokyō', title: 'Bracket sets', pos: new Vector3(0, H1 - SLAB - 1.1, 3.25), range: 16,
      text: 'Each balcony is carried on three stepped tiers of arms and bearing blocks. They push the floor 1.2 metres out over the atrium, joined by interlocking timber rather than nails.' },
    { id: 'ceiling', jp: '格天井 · gōtenjō', title: 'The lantern ceiling', pos: new Vector3(0.9, CLR_TOP - 0.5, 0.9), range: 22,
      text: 'Above the clerestory windows, three corbelled tiers step inward to a coffered ceiling of thirty-six lacquered panels, each painted with a gilt lotus.' },
    { id: 'lantern', jp: '釣灯籠 · tsuri-dōrō', title: 'Hanging bronze lanterns', pos: lanterns.atrium[0].clone(), range: 16,
      text: 'Four bronze lanterns hang on chains more than thirteen metres long. Eight smaller ones mark the corners of the balconies above.' },
    { id: 'koro', jp: '香炉 · kōro', title: 'Incense burner', pos: new Vector3(0, 1.25, 0.98), range: 9,
      text: 'A three-legged bronze burner on a lacquer offering table. Its smoke drifts up through the atrium and catches the light from the high windows.' },
    { id: 'shoji', jp: '障子 · shōji', title: 'Sliding screens', pos: new Vector3(6, 1.7, OUT - 0.25), range: 12,
      text: 'Cedar lattice (kumiko) backed with mulberry paper. The screens in the outer south bays slide open as you walk up to them.',
      action: { label: 'Slide the screens', run: openScreens } },
    { id: 'katomado', jp: '火灯窓 · katōmado', title: 'The carved doorway', pos: new Vector3(0, 2.8, -OUT + 0.3), range: 12,
      text: 'A bell-shaped opening borrowed from Zen temple architecture. The indigo curtain parts as you pass into the Sacred Hall beyond.' },
    { id: 'altar', jp: '須弥壇 · shumidan', title: 'The altar', pos: new Vector3(0, 1.95, ANNEX.z0 + 1.6), range: 10,
      text: 'A stepped lacquer altar. A relic jewel rests on a gilt lotus, framed by a bronze halo and a canopy hung with strings of beads.' },
    { id: 'scroll', jp: '掛軸 · kakejiku', title: 'Hanging scroll', pos: new Vector3(11.78, 2.5, -2), range: 9,
      text: 'In the tea alcove hangs a pen-and-ink sketch of a pagoda above a line of trees, mounted in silk brocade. A maple branch stands in the vase below.' },
    { id: 'taiko', jp: '太鼓 · taiko', title: 'Temple drum', pos: new Vector3(8.6, 1.45, -8.6), range: 10,
      text: 'A lacquered drum on a cedar stand, its hide heads fixed with rows of iron tacks. It marks the hours of the day.',
      action: { label: 'Strike the drum', run: () => audio.drum() } },
    { id: 'stairs', jp: '階段 · kaidan', title: 'Steep stairs', pos: new Vector3(-10.9, 1.6, 5.4), range: 10,
      text: 'Open timber stairs rise at about forty degrees, as in many old temple towers. They lead to the second floor; a second flight on the east side continues to the third.' },
    { id: 'rinzo', jp: '輪蔵 · rinzō', title: 'Revolving sutra library', pos: new Vector3(0, H1 + 2.0, -6.75), range: 11,
      text: 'An octagonal cabinet of 168 drawers on a central pivot. Tradition holds that turning it once brings the same merit as reading every sutra inside.',
      action: { label: 'Turn the library', run: turnWheel } },
    { id: 'bell', jp: '梵鐘 · bonshō', title: 'Temple bell', pos: new Vector3(0, L3 + 2.6, -7.35), range: 11,
      text: 'A bronze bell struck from outside by a hanging cedar log. Turn on sound to hear its long, beating hum.',
      action: { label: 'Strike the bell', run: strikeBell } },
    { id: 'toro', jp: '石灯籠 · ishidōrō', title: 'Stone lantern', pos: exterior.stoneLantern, range: 12,
      text: 'A stone lantern in the Kasuga style. Its fire box glows a little brighter at dusk to guide the way across the gravel.' },
    { id: 'unkai', jp: '雲海 · unkai', title: 'The sea of clouds', pos: exterior.overlook, range: 16,
      text: 'The pagoda stands on a summit above a sea of cloud. Neighbouring ridges rise out of it like islands, and cedar forest falls away into the mist below.' },
    { id: 'taki', jp: '滝 · taki', title: 'Waterfall', pos: exterior.waterfall, range: 200,
      text: 'On the neighbouring crag a waterfall drops more than fifty metres before vanishing into the clouds.' },
  ];
  const spots = new Hotspots(hotspots, tex.ring, world);
  scene.add(spots.group);

  /* ── DOM ── */
  const app = $('app');
  const where = $('where'), hint = $('hint'), aim = $('aimLabel'), cross = $('crosshair');
  const card = $('card'), cardJp = $('cardJp'), cardTitle = $('cardTitle'), cardText = $('cardText'), cardAction = $<HTMLButtonElement>('cardAction');
  const walkBtn = $('walkBtn'), orbitBtn = $('orbitBtn'), viewsEl = $('views');
  const timeBtn = $('timeBtn'), soundBtn = $('soundBtn');

  VIEWPOINTS.forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.view = v.id;
    b.innerHTML = `<kbd>${v.key}</kbd>${v.label}`;
    b.addEventListener('click', () => goView(v));
    viewsEl.appendChild(b);
  });
  const markView = (id: string) => {
    state.view = id;
    viewsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === id)));
  };
  const goView = (v: Viewpoint) => {
    if (!state.entered) return;
    markView(v.id);
    director.go(v);
  };

  const setModeUI = (m: Mode) => {
    walkBtn.setAttribute('aria-checked', String(m === 'walk'));
    orbitBtn.setAttribute('aria-checked', String(m === 'orbit'));
    app.classList.toggle('walk', m === 'walk');
    $('joystick').hidden = !(touch && m === 'walk' && state.entered);
    if (m === 'orbit' && document.pointerLockElement) document.exitPointerLock();
    updateHint();
  };
  director.onModeChange = setModeUI;
  walkBtn.addEventListener('click', () => director.setMode('walk'));
  orbitBtn.addEventListener('click', () => director.setMode('orbit'));

  const updateHint = () => {
    if (!state.entered) { hint.textContent = ''; return; }
    if (director.mode === 'orbit') hint.textContent = touch
      ? 'Drag to turn · pinch to zoom · two fingers to pan · tap a ring to inspect'
      : 'Drag to turn · scroll to zoom · right-drag to pan · click a ring to inspect';
    else if (touch) hint.textContent = 'Left pad to walk · drag to look · tap a ring to inspect';
    else if (state.locked) hint.textContent = 'WASD to walk · Shift to hurry · E to inspect · Esc frees the mouse';
    else hint.textContent = 'Click the view to look around (or drag) · WASD to walk · 1–5 for viewpoints';
  };

  const showCard = (h: Hotspot) => {
    state.card = h;
    cardJp.textContent = h.jp;
    cardTitle.textContent = h.title;
    cardText.textContent = h.text;
    cardAction.hidden = !h.action;
    if (h.action) cardAction.textContent = h.action.label;
    card.hidden = false;
  };
  const hideCard = () => { state.card = null; card.hidden = true; };
  $('cardClose').addEventListener('click', hideCard);
  cardAction.addEventListener('click', () => state.card?.action?.run());
  const activate = (h: Hotspot | null) => {
    if (!h) return false;
    showCard(h);
    h.action?.run();
    return true;
  };

  const setTimeTarget = (evening: boolean) => {
    state.timeTarget = evening ? 1 : 0;
    timeBtn.textContent = evening ? 'Morning' : 'Evening';
    timeBtn.setAttribute('aria-pressed', String(evening));
  };
  timeBtn.addEventListener('click', () => setTimeTarget(state.timeTarget < 0.5));
  const toggleSound = async () => {
    const on = !audio.enabled;
    const ok = await audio.setEnabled(on);
    soundBtn.textContent = ok ? (on ? 'Sound on' : 'Sound off') : 'No audio';
    soundBtn.setAttribute('aria-pressed', String(ok && on));
  };
  soundBtn.addEventListener('click', toggleSound);
  const reset = () => goView(VIEWPOINTS[0]);
  $('resetBtn').addEventListener('click', reset);
  const setUiHidden = (h: boolean) => {
    state.uiHidden = h;
    app.classList.toggle('ui-hidden', h);
    $('showUi').hidden = !h;
    spots.setVisible(!h);
  };
  $('hideBtn').addEventListener('click', () => setUiHidden(true));
  $('showUi').addEventListener('click', () => setUiHidden(false));

  /* ── keyboard ── */
  addEventListener('keydown', (e) => {
    if (!state.entered || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    if (typing) return;
    const navKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
    if (navKeys.includes(e.code)) {
      player.keyDown(e.code);
      if (e.code.startsWith('Arrow') && target.tagName !== 'BUTTON') e.preventDefault();
      return;
    }
    if (e.repeat) return;
    const v = VIEWPOINTS.find((vp) => vp.key === e.key);
    if (v) { goView(v); return; }
    switch (e.code) {
      case 'KeyE': case 'Enter': if (target.tagName !== 'BUTTON') activate(state.hovered); break;
      case 'KeyO': director.setMode(director.mode === 'orbit' ? 'walk' : 'orbit'); break;
      case 'KeyR': reset(); break;
      case 'KeyH': setUiHidden(!state.uiHidden); break;
      case 'KeyT': setTimeTarget(state.timeTarget < 0.5); break;
      case 'KeyM': toggleSound(); break;
      case 'Escape': hideCard(); break;
    }
  });
  addEventListener('keyup', (e) => player.keyUp(e.code));
  addEventListener('blur', () => player.clearKeys());

  /* ── pointer: lock, drag-look, hover and click ── */
  let lockedAt = 0;
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    lockedAt = performance.now();
    updateHint();
  });
  const requestLock = () => {
    if (touch || director.mode !== 'walk') return;
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => undefined);
    } catch { /* pointer lock unavailable: drag-to-look still works */ }
  };
  let down: { x: number; y: number; t: number; id: number; type: string; moved: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, type: e.pointerType, moved: 0 };
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      state.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      state.hasMouse = true;
    }
    if (state.locked) {
      // browsers can report one huge jump as the lock engages; ignore it and any similar spikes
      if (performance.now() - lockedAt < 120 || Math.abs(e.movementX) > 280 || Math.abs(e.movementY) > 280) return;
      player.look(e.movementX * 0.0022, e.movementY * 0.0022);
      return;
    }
    if (down && down.id === e.pointerId && director.mode === 'walk' && !director.busy) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (down.moved > 4) {
        const s = down.type === 'touch' ? 0.006 : 0.004;
        player.look(e.movementX * s, e.movementY * s);
      }
      void dx; void dy;
    }
  });
  addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const click = down.moved < 6 && performance.now() - down.t < 450;
    const type = down.type;
    down = null;
    if (!click || !state.entered || director.busy) return;
    if (type === 'touch') {
      const ndc = new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      activate(spots.pick(ndc, camera, 0.1));
      return;
    }
    if (director.mode === 'walk' && !state.locked) {
      if (!activate(state.hovered)) requestLock();
      return;
    }
    activate(state.hovered);
  });

  /* ── touch joystick ── */
  {
    const joy = $('joystick'), knob = joy.querySelector('.knob') as HTMLElement;
    let jid = -1;
    const setStick = (e: PointerEvent) => {
      const r = joy.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      player.stick.x = x; player.stick.y = -y;
      knob.style.transform = `translate(${x * 38}px, ${y * 38}px)`;
    };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(e.pointerId); setStick(e); e.stopPropagation(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setStick(e); });
    const end = () => { jid = -1; player.stick.x = player.stick.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
  }

  /* ── resize & quality ── */
  let dpr = q.dpr;
  const resize = () => {
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const h = renderer.domElement.height;
    setGlowViewport(lanterns.group, h);
    for (const m of atmo.root.userData.viewportMats as ShaderMaterial[]) m.uniforms.uViewport.value = h;
  };
  addEventListener('resize', resize);
  resize();
  let fpsAvg = 60, lowFor = 0, highFor = 0;
  const adapt = (dt: number) => {
    fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.05;
    if (fpsAvg < 40) { lowFor += dt; highFor = 0; } else if (fpsAvg > 57) { highFor += dt; lowFor = 0; } else { lowFor = highFor = 0; }
    if (lowFor > 2.5 && dpr > 0.7) { dpr = Math.max(0.7, dpr - 0.15); lowFor = 0; resize(); }
    if (highFor > 8 && dpr < q.dpr) { dpr = Math.min(q.dpr, dpr + 0.1); highFor = 0; resize(); }
  };

  /* ── place names ── */
  const placeName = (p: Vector3) => {
    if (p.z < -OUT + 0.1 && Math.abs(p.x) < ANNEX.x1) return 'Sacred Hall';
    if (p.z > ENGAWA.z1 + 0.5) return 'Garden';
    if (p.z > OUT) return 'Veranda';
    if (p.y > H2 - 0.3 + 0.2 && Math.max(Math.abs(p.x), Math.abs(p.z)) > 2.8) return 'Third floor gallery';
    if (p.y > H1 + 0.2 && Math.max(Math.abs(p.x), Math.abs(p.z)) > 2.8) return p.x > 4 && Math.abs(p.z) < 11 ? 'Lantern corridor' : 'Second floor gallery';
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < 3.4) return p.y > 6 ? 'Above the atrium' : 'Atrium';
    if (p.x > 6.8 && Math.abs(p.z) < 3.8) return 'Tea alcove';
    return 'Ground floor gallery';
  };

  /* ── animated pieces ── */
  const updateScreens = (dt: number) => {
    let moving = false;
    state.slideHold = Math.max(0, state.slideHold - dt);
    for (const sb of structure.sliding) {
      if (state.slideHold <= 0 && director.mode === 'walk') {
        const d = Math.hypot(player.feet.x - sb.center.x, player.feet.z - sb.center.z);
        if (d < 3.2 && player.feet.y < 1) { if (sb.target < 0.5) audio.slide(); sb.target = 1; }
        else if (d > 6.5) sb.target = 0;
      }
      const before = sb.open;
      sb.open += Math.sign(sb.target - sb.open) * Math.min(Math.abs(sb.target - sb.open), dt * 0.9);
      if (sb.open !== before) {
        moving = true;
        const k = sb.open < 0.5 ? 2 * sb.open * sb.open : 1 - Math.pow(-2 * sb.open + 2, 2) / 2;
        for (const p of sb.panels) {
          const u = p.closedU + (p.openU - p.closedU) * k;
          const [x, z] = wxz(sb.side, u, p.n);
          p.obj.position.x = x;
          p.obj.position.z = z;
        }
      }
    }
    return moving;
  };

  const tmpV = new Vector3();
  const updateCloth = (t: number, dt: number) => {
    for (const b of details.banners) {
      const pos = b.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = b.base[i * 3], y = b.base[i * 3 + 1];
        const f = Math.pow(-y / 4.2, 1.3);
        pos.setZ(i, Math.sin(t * 0.8 + y * 0.9 + b.phase) * b.amp * 2 * f + Math.sin(t * 0.37 + b.phase) * 0.04 * f);
        pos.setX(i, x + Math.sin(t * 0.5 + b.phase + y * 0.4) * 0.02 * f);
      }
      pos.needsUpdate = true;
    }
    const n = details.noren;
    const pf = director.mode === 'walk' ? player.feet : camera.position;
    n.pivots.forEach((p, i) => {
      const dx = pf.x - p.position.x, dz = pf.z - p.position.z;
      let target = Math.sin(t * 0.9 + i) * 0.03;
      if (Math.abs(dx) < 0.62 && Math.abs(dz) < 0.75) target = Math.sign(dz || 1) * 1.15 * (1 - Math.abs(dz) / 0.75 * 0.6);
      n.vel[i] += ((target - n.angle[i]) * 28 - n.vel[i] * 4.5) * dt;
      n.angle[i] += n.vel[i] * dt;
      p.rotation.x = n.angle[i];
    });
    void tmpV;
  };

  const updateBell = (dt: number) => {
    const { bell, striker } = details.bell;
    if (bellState.strikeT >= 0) {
      bellState.strikeT += dt;
      const t = bellState.strikeT;
      if (t < 0.9) striker.angle = 0.42 * (1 - Math.cos((t / 0.9) * Math.PI)) / 2;
      else if (t < 1.15) striker.angle = 0.42 - (0.58 * Math.pow((t - 0.9) / 0.25, 2));
      else {
        bellState.strikeT = -1;
        striker.vel = 0.9;
        bell.vel -= 0.06;
        audio.bell(0.75, 1);
      }
    } else {
      striker.vel += (-9 * striker.angle - 1.4 * striker.vel) * dt;
      striker.angle += striker.vel * dt;
    }
    bell.vel += (-3.2 * bell.angle - 0.35 * bell.vel) * dt;
    bell.angle += bell.vel * dt;
    bell.obj.rotation.z = bell.angle;
    striker.obj.rotation.z = striker.angle;
    details.rinzo.obj.rotation.y += details.rinzo.spin * dt;
    details.rinzo.spin *= Math.exp(-0.32 * dt);
  };

  /* ── first frame & loop ── */
  atmo.setTime(0);
  lanterns.setWarmth(0.9);
  renderer.shadowMap.needsUpdate = true;
  player.place(VIEWPOINTS[0].eye, VIEWPOINTS[0].look);

  let last = performance.now(), elapsed = 0, frame = 0, running = true;
  const camPrev = new Vector3();
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    frame++;

    if (!state.entered) {
      const a = elapsed * 0.045 + 0.6;
      camera.position.set(Math.cos(a) * 7.2, 2.0 + Math.sin(elapsed * 0.08) * 0.5, Math.sin(a) * 7.2);
      camera.lookAt(0, 7.5, 0);
    } else {
      director.update(dt);
    }

    // time of day
    if (Math.abs(state.timeK - state.timeTarget) > 1e-4) {
      state.timeK += Math.sign(state.timeTarget - state.timeK) * Math.min(Math.abs(state.timeTarget - state.timeK), dt / 3.5);
      const m = atmo.setTime(state.timeK);
      lanterns.setWarmth(m.warmth);
    }

    const screensMoving = updateScreens(dt);
    updateCloth(elapsed, dt);
    updateBell(dt);
    lanterns.update(elapsed);
    atmo.update(elapsed, camera.position);
    exterior.update(elapsed);
    audio.update(elapsed, camera.position);

    // aim / hover
    if (state.entered && !director.busy && !state.uiHidden) {
      const ndc = director.mode === 'walk' && (state.locked || !state.hasMouse || touch) ? new Vector2(0, 0) : state.mouse;
      state.hovered = touch && director.mode === 'orbit' ? null : spots.pick(ndc, camera, director.mode === 'walk' && state.locked ? 0.06 : 0.05);
    } else state.hovered = null;
    spots.update(elapsed, camera, state.hovered);
    cross.classList.toggle('hot', !!state.hovered);
    if (state.hovered) {
      aim.innerHTML = `${state.hovered.title}<small>${touch ? 'tap' : state.hovered.action ? 'E · ' + state.hovered.action.label.toLowerCase() : 'E · inspect'}</small>`;
      aim.classList.add('on');
      canvas.style.cursor = state.locked ? 'none' : 'pointer';
    } else {
      aim.classList.remove('on');
      canvas.style.cursor = director.mode === 'orbit' ? 'grab' : state.locked ? 'none' : 'crosshair';
    }
    if (state.card && camera.position.distanceTo(state.card.pos) > (state.card.range ?? 14) + 4) hideCard();
    if (frame % 10 === 0) where.textContent = placeName(director.mode === 'walk' && state.entered ? tmpV.copy(player.feet).setY(player.feet.y + 0.1) : camera.position);

    // shadows: refresh occasionally, or every frame while something big moves
    if (screensMoving || frame % 24 === 0 || camPrev.distanceToSquared(camera.position) > 400) renderer.shadowMap.needsUpdate = true;
    camPrev.copy(camera.position);

    if (state.entered) adapt(dt);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
  onProgress(1, 'Ready');

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__pagoda = {
      renderer, scene, camera, director, player, state, VIEWPOINTS, setTimeTarget, activate, hotspots,
      // test helpers: jump straight to a pose / time of day without transitions
      pose(eye: number[], look: number[]) {
        (director as unknown as { trans: null }).trans = null;
        $('fade').style.opacity = '0';
        player.enabled = true;
        player.place(new Vector3(...(eye as [number, number, number])), new Vector3(...(look as [number, number, number])));
        player.apply(camera);
      },
      timeNow(k: number) { state.timeK = state.timeTarget = k; const m = atmo.setTime(k); lanterns.setWarmth(m.warmth); },
    };
  }

  const enter = () => {
    if (state.entered) return;
    state.entered = true;
    app.classList.add('entered');
    $('intro').classList.add('gone');
    setTimeout(() => { $('intro').hidden = true; }, 1000);
    markView('atrium');
    director.go(VIEWPOINTS[0], 'walk');
    setModeUI('walk');
    requestLock();
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    const err = $('error');
    err.hidden = false;
    err.textContent = 'The graphics card stopped responding. Reload the page to enter again.';
    $('intro').hidden = false;
    $('intro').classList.remove('gone');
  });

  const dispose = () => {
    running = false;
    audio.dispose();
    atmo.dispose();
    const mats = new Set<Material>(), texs = new Set<Texture>();
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mm = m.material as Material | Material[] | undefined;
      (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => mats.add(x));
    });
    mats.forEach((m) => {
      for (const v of Object.values(m)) if (v instanceof Texture) texs.add(v);
      m.dispose();
    });
    texs.forEach((t) => t.dispose());
    director.controls.dispose();
    renderer.dispose();
  };
  addEventListener('pagehide', dispose, { once: true });

  return { enter, dispose };
}
