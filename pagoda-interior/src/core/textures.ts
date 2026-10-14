import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { fbm, mulberry32, vnoise } from './noise';

/** Every texture in the pagoda is painted at load time — no downloaded image files except the sketch. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is unavailable');
  return { c, ctx };
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

type PixelFn = (x: number, y: number) => [number, number, number, number?];
function paint(w: number, h: number, fn: PixelFn) {
  const { c, ctx } = canvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

/** Wood grain running along V. Covers 0.8 m × 2.4 m. Returns colour + roughness/bump. */
export function woodTextures() {
  const W = 256, H = 768;
  const grain = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const warp = fbm(nx * 3, ny * 2, 3, 3, 2, 7);
      const t = nx * 14 + warp * 3.2;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2), 3);
      const fine = vnoise(nx * 96, ny * 3, 96, 3, 3);
      const broad = fbm(nx * 2, ny * 1, 2, 2, 1, 11);
      grain[y * W + x] = ring * 0.6 + fine * 0.3 + broad * 0.25;
    }
  }
  const color = paint(W, H, (x, y) => {
    const g = grain[y * W + x];
    const v = 232 - g * 70;
    return [clamp255(v), clamp255(v * 0.93), clamp255(v * 0.86)];
  });
  const rough = paint(W, H, (x, y) => {
    const v = 150 + grain[y * W + x] * 80;
    return [v, v, v];
  });
  return { map: tex(color.c, true), rough: tex(rough.c, false) };
}

/** Floor boards: 12 planks across 2.4 m, staggered butt joints, per-plank tone. */
export function plankTextures() {
  const W = 768, H = 768, N = 12;
  const r = mulberry32(7);
  const planks = Array.from({ length: N }, () => ({ tone: 0.88 + r() * 0.2, off: r() * 10, joint: r(), seed: Math.floor(r() * 999) }));
  const val = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const pi = Math.floor((x / W) * N), p = planks[pi];
      const lx = ((x / W) * N) % 1, ny = y / H;
      const warp = fbm(lx * 2, ny * 2 + p.off, 2, 0, 2, p.seed);
      const ring = Math.pow(0.5 + 0.5 * Math.sin((lx * 3 + warp * 2.5) * Math.PI * 2), 4);
      const fine = vnoise(lx * 40, ny * 6 + p.off, 0, 6, p.seed);
      let v = p.tone * (0.92 - ring * 0.16 - fine * 0.08);
      if (lx < 0.012 || lx > 0.988) v *= 0.45; // seam
      const jd = Math.abs(ny - p.joint);
      if (jd < 0.0025 || Math.abs(jd - 0.5) < 0.0025) v *= 0.5; // butt joints
      val[y * W + x] = v;
    }
  }
  const color = paint(W, H, (x, y) => {
    const v = val[y * W + x] * 235;
    return [clamp255(v), clamp255(v * 0.9), clamp255(v * 0.8)];
  });
  const rough = paint(W, H, (x, y) => {
    const v = 255 - val[y * W + x] * 150;
    return [v, v, v];
  });
  return { map: tex(color.c, true), rough: tex(rough.c, false) };
}

export function paperTexture() {
  const { c } = paint(256, 256, (x, y) => {
    const n = fbm(x / 32, y / 32, 4, 8, 8, 4) * 0.6 + vnoise(x / 2, y / 9, 128, 28, 9) * 0.4;
    const v = 238 + (n - 0.5) * 22;
    return [v, v - 3, v - 10];
  });
  return tex(c, true);
}

export function plasterTexture() {
  const { c } = paint(256, 256, (x, y) => {
    const n = fbm(x / 64, y / 64, 5, 4, 4, 21);
    const v = 230 + (n - 0.5) * 34;
    return [v, v - 4, v - 12];
  });
  return tex(c, true);
}

export function stoneTexture() {
  const { c } = paint(256, 256, (x, y) => {
    const n = fbm(x / 48, y / 48, 5, 5.333, 5.333, 31);
    const speck = vnoise(x / 1.6, y / 1.6, 160, 160, 3);
    const v = 150 + (n - 0.5) * 70 + (speck > 0.82 ? 30 : speck < 0.12 ? -30 : 0);
    return [v, v - 2, v - 7];
  });
  return tex(c, true);
}

/** One tatami mat, 0.9 × 1.8 m, with dark cloth borders (heri) on the long edges. */
export function tatamiTexture() {
  const W = 256, H = 512;
  const { c } = paint(W, H, (x, y) => {
    const u = x / W;
    if (u < 0.07 || u > 0.93) {
      const t = 38 + vnoise(x / 2, y / 2, 0, 0, 5) * 12;
      return [t, t + 2, t + 10];
    }
    const weave = (y % 4 < 2 ? 0.94 : 1.0) * (0.96 + vnoise(x / 1.5, y / 40, 0, 0, 8) * 0.08);
    const stitch = Math.abs(((u - 0.07) / 0.86) * 6 % 1) < 0.02 ? 0.88 : 1;
    const age = 0.9 + fbm(x / 120, y / 120, 3, 0, 0, 12) * 0.2;
    const k = weave * stitch * age;
    return [clamp255(196 * k), clamp255(176 * k), clamp255(112 * k)];
  });
  return tex(c, true, false);
}

/** Round clay roof tiles running down the slope, with course lines. */
export function tileTexture() {
  const { c } = paint(256, 256, (x, y) => {
    const u = (x / 256) * 6 % 1;
    const ridge = Math.sin(u * Math.PI);
    const course = y % 64 < 6 ? 0.55 : 1;
    const n = 0.9 + vnoise(x / 8, y / 8, 32, 32, 4) * 0.2;
    const v = (60 + ridge * 70) * course * n;
    return [v, v + 2, v + 6];
  });
  return tex(c, true);
}

/** Raked gravel: parallel furrows along U with grainy stones. */
export function gravelTexture() {
  const { c } = paint(512, 512, (x, y) => {
    const rake = 0.5 + 0.5 * Math.sin((y / 512) * Math.PI * 2 * 24 + vnoise(x / 60, y / 60, 8.53, 8.53, 2) * 1.2);
    const g = vnoise(x / 1.8, y / 1.8, 284, 284, 6);
    const v = 168 + rake * 46 + (g - 0.5) * 60;
    return [v, v - 3, v - 10];
  });
  return tex(c, true);
}

/** Asanoha (hemp-leaf) kumiko pattern as an alpha mask for the transom panels. */
export function asanohaTexture() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.2;
  const s = S / 4; // triangle side
  const h = (s * Math.sqrt(3)) / 2;
  const tris: [number, number][][] = [];
  for (let row = -1; row < S / h + 1; row++) {
    for (let col = -1; col < S / s + 2; col++) {
      const x = col * s + (row % 2 ? s / 2 : 0), y = row * h;
      tris.push([[x, y], [x + s, y], [x + s / 2, y + h]]);
      tris.push([[x + s / 2, y + h], [x + s * 1.5, y + h], [x + s, y]]);
    }
  }
  ctx.beginPath();
  for (const t of tris) {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    ctx.moveTo(t[0][0], t[0][1]); ctx.lineTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]); ctx.closePath();
    for (const v of t) { ctx.moveTo(cx, cy); ctx.lineTo(v[0], v[1]); }
  }
  ctx.stroke();
  // frame
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, S, S);
  return tex(c, false);
}

/** Coffer panel: dark lacquer field, gilt frame, lotus roundel. */
export function cofferTexture() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, '#3a1d14');
  g.addColorStop(1, '#1d0d09');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#b08d4e';
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, S - 28, S - 28);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, S - 48, S - 48);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = 'rgba(176,141,78,0.85)';
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, -46, 16, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a140e';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9a35d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.stroke();
  return tex(c, true, false);
}

/** Silk temple banner: ivory field, gilt borders, a single ring motif. */
export function bannerTexture() {
  const W = 128, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#e9dfc8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7a2c1f';
  ctx.fillRect(0, 0, W, 34);
  ctx.fillRect(0, H - 60, W, 60);
  ctx.strokeStyle = '#b8924f'; ctx.lineWidth = 4;
  ctx.strokeRect(10, 40, W - 20, H - 110);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(W / 2, 170, 30, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, 170, 18, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#9c7b45';
    ctx.fillRect(W / 2 - 3, 240 + i * 48, 6, 30);
  }
  ctx.fillStyle = '#e9dfc8';
  for (let x = 4; x < W; x += 12) ctx.fillRect(x, H - 14, 6, 14); // fringe
  return tex(c, true, false);
}

/** Ink-wash mountains for fusuma (sliding wall) paintings — a nod to the pen sketch. */
export function inkPaintingTexture(seed = 3) {
  const W = 1024, H = 512;
  const { c, ctx } = canvas(W, H);
  const r = mulberry32(seed);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#e8dcc0');
  bg.addColorStop(1, '#dccfb0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // gold-leaf clouds
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(190,152,80,${0.18 + r() * 0.12})`;
    const x = r() * W, y = 40 + r() * 140;
    ctx.beginPath();
    ctx.ellipse(x, y, 90 + r() * 120, 14 + r() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let layer = 0; layer < 4; layer++) {
    const base = 230 + layer * 70;
    const alpha = 0.18 + layer * 0.17;
    const grad = ctx.createLinearGradient(0, base - 160, 0, base + 60);
    grad.addColorStop(0, `rgba(30,28,26,${alpha})`);
    grad.addColorStop(1, 'rgba(30,28,26,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const off = r() * 100;
    for (let x = 0; x <= W; x += 6) {
      const n = fbm(x / 260 + off, layer * 3.1, 4, 0, 0, layer);
      const peak = Math.pow(n, 1.6) * 260;
      ctx.lineTo(x, base - peak + layer * 10);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  }
  // a tiny pagoda on the far ridge
  ctx.fillStyle = 'rgba(25,22,20,0.65)';
  const px = 690, py = 205;
  for (let i = 0; i < 5; i++) {
    const w = 26 - i * 4, y = py - i * 11;
    ctx.beginPath(); ctx.moveTo(px - w, y); ctx.lineTo(px + w, y); ctx.lineTo(px + w * 0.5, y - 5); ctx.lineTo(px - w * 0.5, y - 5); ctx.fill();
    ctx.fillRect(px - w * 0.35, y, w * 0.7, 7);
  }
  ctx.fillRect(px - 1, py - 82, 2, 30);
  return tex(c, true, false);
}

export function glowTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return tex(c, true, false);
}

export function smokeTexture() {
  const S = 128;
  const { c } = paint(S, S, (x, y) => {
    const dx = x / S - 0.5, dy = y / S - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2;
    const n = fbm(x / 24, y / 24, 4, 0, 0, 5);
    const a = Math.max(0, 1 - d) ** 1.6 * (0.4 + n * 0.9);
    return [255, 255, 255, clamp255(a * 255)];
  });
  return tex(c, false, false);
}

/** A thin ring used for the inspection hotspots. */
export function ringTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.strokeStyle = 'rgba(255,240,210,0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,210,0.95)';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 9, 0, Math.PI * 2); ctx.fill();
  return tex(c, true, false);
}

/** Indigo noren curtain with a pale crest split across three strips. */
export function norenTexture() {
  const W = 384, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#1f2a44';
  ctx.fillRect(0, 0, W, H);
  const n = paint(W, H, (x, y) => {
    const v = vnoise(x / 2, y / 30, 0, 0, 3);
    return [255, 255, 255, v * 26];
  });
  ctx.drawImage(n.c, 0, 0);
  ctx.strokeStyle = '#e8dfcc';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(W / 2, 112, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(W / 2, 70); ctx.lineTo(W / 2, 154); ctx.moveTo(W / 2 - 40, 112); ctx.lineTo(W / 2 + 40, 112); ctx.stroke();
  return tex(c, true, false);
}

/** Mounts the user's pen sketch of the pagoda as a hanging scroll (kakejiku). */
export function scrollTexture(img: HTMLImageElement | null): Texture {
  const W = 512, H = 1152;
  const { c, ctx } = canvas(W, H);
  // brocade mounting
  ctx.fillStyle = '#5a4a2e';
  ctx.fillRect(0, 0, W, H);
  const brocade = paint(W, H, (x, y) => {
    const v = ((x >> 3) + (y >> 3)) % 2 ? 18 : 0;
    return [255, 230, 170, v];
  });
  ctx.drawImage(brocade.c, 0, 0);
  ctx.fillStyle = '#3d4a3a';
  ctx.fillRect(40, 150, W - 80, H - 330);
  ctx.fillStyle = '#efe6d0';
  ctx.fillRect(58, 170, W - 116, H - 370);
  if (img) {
    const iw = W - 140, ih = (iw * img.height) / img.width;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(img, 70, 190 + (H - 410 - ih) / 2, iw, ih);
    ctx.globalCompositeOperation = 'source-over';
  }
  // seal
  ctx.fillStyle = '#9b2d20';
  ctx.fillRect(W - 120, H - 270, 34, 34);
  ctx.fillStyle = '#efe6d0';
  ctx.fillRect(W - 114, H - 264, 8, 22);
  ctx.fillRect(W - 102, H - 254, 10, 8);
  return tex(c, true, false);
}

/** A scatter of seven-lobed maple leaves on transparency, painted pale so vertex colours tint them. */
export function mapleLeafTexture() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const r = mulberry32(17);
  for (let i = 0; i < 34; i++) {
    const x = 20 + r() * (S - 40), y = 20 + r() * (S - 40), R = 14 + r() * 12, rot = r() * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const shade = 200 + Math.floor(r() * 55);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    for (let k = 0; k <= 70; k++) {
      const a = (k / 70) * Math.PI * 2;
      const lobe = Math.pow(Math.abs(Math.cos(3.5 * a)), 0.7);
      const rr = R * (0.42 + 0.58 * lobe) * (a > Math.PI * 0.85 && a < Math.PI * 1.15 ? 0.6 : 1);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,60,0.55)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85); ctx.stroke();
    }
    ctx.restore();
  }
  return tex(c, true, false);
}

/** Sprays of narrow bamboo leaves. */
export function bambooLeafTexture() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const r = mulberry32(23);
  for (let s = 0; s < 9; s++) {
    const x = 30 + r() * (S - 60), y = 30 + r() * (S - 60), base = r() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const a = base + (k - 2.5) * 0.32, L = 34 + r() * 26, W = 4 + r() * 2.5;
      const shade = 190 + Math.floor(r() * 65);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(L * 0.4, -W, L, 0);
      ctx.quadraticCurveTo(L * 0.4, W, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  return tex(c, true, false);
}
