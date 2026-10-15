import './style.css';
import { CHAPTERS, DISCOVERIES, type Chapter, type Discovery } from './data';

document.documentElement.classList.remove('no-js');

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// shared state, declared before anything can trigger a render
let openFor: HTMLButtonElement | null = null;
let queued = false;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
motionQuery.addEventListener?.('change', (e) => { reduced = e.matches; schedule(); });

/* ───────────── journal storage (this browser only) ───────────── */
const KEY = 'beyond-horizon:journal:v1';
type Found = Record<string, number>;
function loadFound(): Found {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Found = {};
    for (const d of DISCOVERIES) {
      const v = (raw as Record<string, unknown>)[d.id];
      if (typeof v === 'number') out[d.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}
function saveFound(f: Found) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); return true; } catch { return false; }
}
let found = loadFound();
let storageOk = true;

/* ───────────── plates and discovery marks ───────────── */
interface Plate {
  ch: Chapter;
  frame: HTMLElement;
  img: HTMLImageElement;
  spots: HTMLElement;
  buttons: Map<string, HTMLButtonElement>;
  k: number; // base cover scale for the current stage size
  ok: boolean;
}

const stage = $('stage');
const story = $('story');
const plates: Plate[] = [];
const allButtons = new Map<string, HTMLButtonElement>();
const order = new Map(DISCOVERIES.map((d, i) => [d.id, i + 1]));

function makeSpots(container: HTMLElement, ch: Chapter) {
  const spots = document.createElement('div');
  spots.className = 'spots';
  const buttons = new Map<string, HTMLButtonElement>();
  for (const d of DISCOVERIES.filter((x) => x.chapter === ch.n)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    b.style.left = `${d.x * 100}%`;
    b.style.top = `${d.y * 100}%`;
    b.dataset.id = d.id;
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-controls', 'panel');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = `<span class="ring" aria-hidden="true"></span><span class="label" aria-hidden="true">${d.name}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(d, b); });
    spots.appendChild(b);
    buttons.set(d.id, b);
    allButtons.set(d.id, b);
  }
  container.appendChild(spots);
  return { spots, buttons };
}

function watchImage(frame: HTMLElement, img: HTMLImageElement, label: string, onFail: () => void) {
  const ok = () => frame.classList.add('loaded');
  const fail = () => {
    frame.classList.add('failed');
    frame.dataset.fallback = `${label} could not be loaded`;
    onFail();
  };
  if (img.complete) { if (img.naturalWidth > 0) ok(); else fail(); }
  else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
}

document.querySelectorAll<HTMLElement>('.plate').forEach((el) => {
  const ch = CHAPTERS[Number(el.dataset.ch) - 1];
  const frame = el.querySelector<HTMLElement>('.frame')!;
  const img = frame.querySelector('img')!;
  const { spots, buttons } = makeSpots(frame, ch);
  const plate: Plate = { ch, frame, img, spots, buttons, k: 1, ok: true };
  plates.push(plate);
  watchImage(frame, img, `Chapter ${ch.numeral} artwork`, () => { plate.ok = false; schedule(); });
});

const pano = (() => {
  const ch = CHAPTERS[2];
  const frame = document.querySelector<HTMLElement>('.frame--pano')!;
  const img = frame.querySelector('img')!;
  const { spots, buttons } = makeSpots(frame, ch);
  watchImage(frame, img, 'Chapter III artwork', () => { spots.hidden = true; });
  return { ch, frame, img, spots, buttons, scroller: $('panoScroll') };
})();

/* ───────────── cover-with-focus layout ───────────── */
let W = 0, H = 0;
function measure() {
  W = stage.clientWidth;
  H = stage.clientHeight;
  // the side-by-side layout needs a wide, roomy screen; everything else uses the step-aside timeline
  narrow = !(W >= 1200 && W / H >= 1.4);
  P = narrow ? NARROW : WIDE;
  document.body.classList.toggle('portrait', narrow);
  for (const p of plates) {
    p.k = Math.max(W / p.ch.width, H / p.ch.height);
    p.frame.style.width = `${p.ch.width * p.k}px`;
    p.frame.style.height = `${p.ch.height * p.k}px`;
  }
}

/**
 * The pan route for a chapter: if every mark fits on screen the crop simply centres on them;
 * otherwise it travels from the right-most mark to the left-most one.
 */
function route(p: Plate): [number, number] {
  const rw = p.ch.width * p.k;
  const v = W / rw;
  const xs = DISCOVERIES.filter((d) => d.chapter === p.ch.n).map((d) => d.x);
  const a = Math.min(...xs), b = Math.max(...xs);
  const left = 60 / rw, right = (W > 760 ? 96 : 44) / rw;
  if (b - a + left + right <= v) {
    const c = (a - left + b + right) / 2;
    return [c, c];
  }
  return [b + right - v / 2, a - left + v / 2];
}

/** Positions a plate so the image point `fx` sits as near the centre as the crop allows. */
function place(p: Plate, fx: number, scale: number, active: boolean) {
  const rw = p.ch.width * p.k * scale, rh = p.ch.height * p.k * scale;
  const tx = clamp(W / 2 - fx * rw, W - rw, 0);
  const ty = clamp(H / 2 - p.ch.focusY * rh, H - rh, 0);
  p.frame.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
  const usable = active && p.ok;
  if (usable) p.spots.removeAttribute('inert'); else p.spots.setAttribute('inert', '');
  for (const d of DISCOVERIES.filter((x) => x.chapter === p.ch.n)) {
    const b = p.buttons.get(d.id)!;
    const sx = tx + d.x * rw, sy = ty + d.y * rh;
    const off = sx < 26 || sx > W - (W > 760 ? 76 : 30) || sy < 70 || sy > H - 48;
    b.classList.toggle('offstage', off);
    b.tabIndex = off || !usable ? -1 : 0;
    b.classList.toggle('flip', sx > W - 230);
    if ((off || !usable) && openFor === b) closePanel(false);
  }
}

/* ───────────── the story timeline ───────────── */
const hero = $('hero'), note1 = $('note1'), note2 = $('note2');
const veil = document.querySelector<HTMLElement>('.veil')!;
const edgeCh = $('edgeCh'), edgePlace = $('edgePlace'), edgeCo = $('edgeCo'), edgeCue = $('edgeCue');
const railFill = $('railFill');
const railButtons = [...document.querySelectorAll<HTMLButtonElement>('.rail button')];
const epilogue = $('epilogue');

/*
  The story timeline, as fractions of the story's scroll length. On landscape screens the field
  notes sit beside the marks; on portrait screens a note shows first, then steps aside so the
  whole painting is free to explore while the crop pans across it.
*/
const WIDE = {
  begin: 0.17, chapter2: 0.7,
  heroOut: [0.012, 0.075], note1In: [0.09, 0.14], note1Out: [0.34, 0.4], spots1: [0.085, 0.42],
  pan1: [0.1, 0.38], mix: [0.42, 0.56], note2In: [0.56, 0.63], note2Out: [2, 3], spots2: [0.575, 1.01], pan2: [0.62, 0.96],
};
const NARROW: typeof WIDE = {
  begin: 0.15, chapter2: 0.64,
  heroOut: [0.012, 0.075], note1In: [0.09, 0.13], note1Out: [0.2, 0.24], spots1: [0.243, 0.42],
  pan1: [0.27, 0.4], mix: [0.42, 0.56], note2In: [0.56, 0.62], note2Out: [0.68, 0.72], spots2: [0.723, 1.01], pan2: [0.75, 0.95],
};
let P = WIDE;
let narrow = false;

const storyProgress = () => {
  const span = story.offsetHeight - innerHeight;
  return span > 0 ? clamp((scrollY - story.offsetTop) / span, 0, 1) : 0;
};
const scrollForProgress = (p: number) => story.offsetTop + p * (story.offsetHeight - innerHeight);

function setLayer(el: HTMLElement, opacity: number, lift = 0) {
  el.style.opacity = opacity.toFixed(3);
  el.style.transform = reduced || !lift ? '' : `translate3d(0, ${lift.toFixed(1)}px, 0)`;
  el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
  el.classList.toggle('live', opacity > 0.6);
}

let shownChapter = 0;
function showEdge(n: 1 | 2) {
  if (shownChapter === n) return;
  shownChapter = n;
  const ch = CHAPTERS[n - 1];
  edgeCh.textContent = `Ch. ${ch.numeral}`;
  edgePlace.textContent = ch.place;
  edgeCo.textContent = ch.coords;
}

function render() {
  queued = false;
  const p = storyProgress();
  const [p1, p2] = plates;

  // opening title lifts away
  const out = ease(seg(p, P.heroOut[0], P.heroOut[1]));
  setLayer(hero, 1 - out, -36 * out);
  edgeCue.style.opacity = String(1 - out);
  // on portrait screens the location line would crowd the title, so it arrives after it
  (edgeCh.parentElement as HTMLElement).style.opacity = narrow ? String(out) : '1';
  document.body.classList.toggle('underway', scrollY > innerHeight * 0.05);

  // chapter I
  const n1 = ease(seg(p, P.note1In[0], P.note1In[1])) * (1 - ease(seg(p, P.note1Out[0], P.note1Out[1])));
  setLayer(note1, n1, (1 - seg(p, P.note1In[0], P.note1In[1])) * 22);
  const mix = ease(seg(p, P.mix[0], P.mix[1]));
  const s1 = reduced ? 1 : 1.07 - 0.07 * ease(seg(p, 0, 0.4)) + 0.06 * mix;
  const r1 = route(p1);
  const f1 = p < P.pan1[0]
    ? lerp(p1.ch.hero, r1[0], ease(seg(p, P.heroOut[1], P.pan1[0])))
    : lerp(r1[0], r1[1], ease(seg(p, P.pan1[0], P.pan1[1])));
  place(p1, f1, s1, p >= P.spots1[0] && p < P.spots1[1]);
  p1.frame.parentElement!.style.visibility = mix > 0.999 ? 'hidden' : 'visible';

  // the crossing: a pass through mist, then chapter II settles into focus
  const plate2 = p2.frame.parentElement!;
  plate2.style.opacity = mix.toFixed(3);
  plate2.style.visibility = mix < 0.001 ? 'hidden' : 'visible';
  veil.style.opacity = (Math.sin(Math.PI * mix) * 0.55).toFixed(3);
  const s2 = reduced ? 1 : 1.08 - 0.08 * ease(seg(p, P.mix[0], 0.72));
  const r2 = route(p2);
  const f2 = p < P.pan2[0]
    ? lerp(p2.ch.hero, r2[0], ease(seg(p, P.mix[1], P.pan2[0])))
    : lerp(r2[0], r2[1], ease(seg(p, P.pan2[0], P.pan2[1])));
  place(p2, f2, s2, p >= P.spots2[0] && p < P.spots2[1]);
  const in2 = ease(seg(p, P.note2In[0], P.note2In[1]));
  const n2 = in2 * (1 - ease(seg(p, P.note2Out[0], P.note2Out[1])));
  setLayer(note2, n2, (1 - in2) * 26);
  showEdge(mix > 0.5 ? 2 : 1);

  // which chapter are we in?
  const epTop = epilogue.getBoundingClientRect().top;
  const current: 1 | 2 | 3 = epTop < innerHeight * 0.55 ? 3 : mix > 0.5 ? 2 : 1;
  if (document.body.dataset.chapter !== String(current)) document.body.dataset.chapter = String(current);
  railButtons.forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.go) === current)));
  const doc = document.documentElement.scrollHeight - innerHeight;
  railFill.style.height = `${doc > 0 ? (scrollY / doc) * 100 : 0}%`;

  if (openFor) positionPanel();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(render);
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', () => { measure(); schedule(); });

/* ───────────── navigation ───────────── */
function goTo(y: number, then?: () => void) {
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  scrollTo({ top: y, behavior });
  if (!then) return;
  if (behavior === 'auto') { requestAnimationFrame(then); return; }
  let done = false;
  const finish = () => { if (done) return; done = true; removeEventListener('scrollend', finish); then(); };
  addEventListener('scrollend', finish, { once: true });
  setTimeout(finish, 1400);
}
const focusHeading = (el: HTMLElement) => {
  const h = el.querySelector<HTMLElement>('h2');
  if (!h) return;
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
};
$('begin').addEventListener('click', () => goTo(scrollForProgress(P.begin), () => focusHeading(note1)));
railButtons.forEach((b) => b.addEventListener('click', () => {
  const n = Number(b.dataset.go);
  if (n === 1) goTo(scrollForProgress(P.begin), () => focusHeading(note1));
  else if (n === 2) goTo(scrollForProgress(P.chapter2), () => focusHeading(note2));
  else goTo(epilogue.offsetTop, () => focusHeading(epilogue));
}));
$('toTop').addEventListener('click', () => goTo(0, () => $('begin').focus({ preventScroll: true })));

/* ───────────── field-note panel ───────────── */
const panel = $('panel');
const panelEyebrow = $('panelEyebrow'), panelTitle = $('panelTitle'), panelCoords = $('panelCoords');
const panelNote = $('panelNote'), panelRecorded = $('panelRecorded');
const live = $('live');

function togglePanel(d: Discovery, b: HTMLButtonElement) {
  if (openFor === b) { closePanel(true); return; }
  if (openFor) closePanel(false);
  const isNew = !found[d.id];
  if (isNew) {
    found[d.id] = Date.now();
    storageOk = saveFound(found);
  }
  const ch = CHAPTERS[d.chapter - 1];
  panelEyebrow.textContent = `Discovery ${String(order.get(d.id)).padStart(2, '0')} / ${DISCOVERIES.length} · Chapter ${ch.numeral}`;
  panelTitle.textContent = d.name;
  panelCoords.textContent = d.coords;
  panelNote.textContent = d.note;
  panelRecorded.textContent = !storageOk
    ? 'Recorded for this visit (this browser is not saving the journal)'
    : isNew ? 'New entry recorded in your journal' : 'Already in your journal';
  panel.hidden = false;
  openFor = b;
  b.setAttribute('aria-expanded', 'true');
  positionPanel();
  requestAnimationFrame(() => panel.classList.add('open'));
  refreshFound(isNew ? d : null);
  $<HTMLButtonElement>('panelClose').focus({ preventScroll: true });
}

function positionPanel() {
  if (!openFor) return;
  if (innerWidth <= 760) { panel.style.left = ''; panel.style.top = ''; return; }
  const r = openFor.getBoundingClientRect();
  const pw = panel.offsetWidth, ph = panel.offsetHeight;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let left = cx + 34;
  if (left + pw > innerWidth - 70) left = cx - 34 - pw;
  left = clamp(left, 16, innerWidth - pw - 16);
  const top = clamp(cy - ph / 2, 72, innerHeight - ph - 20);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function closePanel(returnFocus: boolean) {
  if (!openFor) return;
  const b = openFor;
  openFor = null;
  b.setAttribute('aria-expanded', 'false');
  panel.classList.remove('open');
  setTimeout(() => { if (!openFor) panel.hidden = true; }, reduced ? 0 : 320);
  if (returnFocus && b.tabIndex >= 0) b.focus({ preventScroll: true });
}
$('panelClose').addEventListener('click', () => closePanel(true));
document.addEventListener('pointerdown', (e) => {
  const t = e.target as Node;
  if (openFor && !panel.contains(t) && !(t instanceof Element && t.closest('.spot'))) closePanel(false);
});
pano.scroller.addEventListener('scroll', () => { if (openFor && pano.spots.contains(openFor)) positionPanel(); }, { passive: true });

/* ───────────── journal ───────────── */
const journal = $('journal'), journalBtn = $<HTMLButtonElement>('journalBtn'), entries = $('entries');
const count = $('count'), journalCount = $('journalCount'), tally = $('tally'), status = $('journalStatus');
let journalOpener: HTMLElement | null = null;

function renderJournal() {
  entries.innerHTML = '';
  for (const ch of CHAPTERS) {
    const mark = document.createElement('li');
    mark.className = 'chapter-mark';
    mark.textContent = `Chapter ${ch.numeral} · ${ch.place}`;
    entries.appendChild(mark);
    for (const d of DISCOVERIES.filter((x) => x.chapter === ch.n)) {
      const li = document.createElement('li');
      const n = String(order.get(d.id)).padStart(2, '0');
      if (found[d.id]) {
        li.innerHTML = `<span class="num">${n}</span><h3></h3><p class="coords"></p><p class="entry-note"></p>`;
        li.querySelector('h3')!.textContent = d.name;
        li.querySelector('.coords')!.textContent = d.coords;
        li.querySelector('.entry-note')!.textContent = d.note;
      } else {
        li.className = 'missing';
        li.innerHTML = `<span class="num">${n}</span><h3>Not yet recorded</h3><p class="entry-note"></p>`;
        li.querySelector('.entry-note')!.textContent = `Somewhere on ${ch.place}.`;
      }
      entries.appendChild(li);
    }
  }
}

function refreshFound(newlyFound: Discovery | null) {
  const n = Object.keys(found).length, total = DISCOVERIES.length;
  count.textContent = `${n} / ${total}`;
  journalCount.textContent = n === total ? `All ${total} discoveries recorded` : `${n} of ${total} recorded`;
  tally.textContent = n === total ? `You have recorded all ${total} discoveries.` : `You have recorded ${n} of ${total} discoveries.`;
  for (const [id, b] of allButtons) {
    const d = DISCOVERIES.find((x) => x.id === id)!;
    const isFound = !!found[id];
    b.classList.toggle('found', isFound);
    b.setAttribute('aria-label', `${d.name}. Discovery ${order.get(id)} of ${total}${isFound ? ', recorded' : ''}`);
  }
  $<HTMLElement>('resetBtn').hidden = n === 0;
  if (!journal.hidden) renderJournal();
  if (newlyFound) {
    live.textContent = `Recorded ${newlyFound.name}. ${n} of ${total} discoveries.`;
    journalBtn.classList.remove('bump');
    void journalBtn.offsetWidth;
    journalBtn.classList.add('bump');
  }
}

function openJournal(opener: HTMLElement) {
  closePanel(false);
  journalOpener = opener;
  renderJournal();
  status.textContent = storageOk ? '' : 'This browser is not saving the journal, so it will be empty next visit.';
  journal.hidden = false;
  journalBtn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => journal.classList.add('open'));
  $<HTMLButtonElement>('journalClose').focus({ preventScroll: true });
}
function closeJournal() {
  if (journal.hidden) return;
  journal.classList.remove('open');
  journalBtn.setAttribute('aria-expanded', 'false');
  hideConfirm();
  setTimeout(() => { if (!journal.classList.contains('open')) journal.hidden = true; }, reduced ? 0 : 460);
  journalOpener?.focus({ preventScroll: true });
}
journalBtn.addEventListener('click', () => (journal.hidden ? openJournal(journalBtn) : closeJournal()));
$('endJournal').addEventListener('click', (e) => openJournal(e.currentTarget as HTMLElement));
$('journalClose').addEventListener('click', closeJournal);

const resetBtn = $<HTMLButtonElement>('resetBtn'), resetConfirm = $('resetConfirm');
function hideConfirm() { resetConfirm.hidden = true; resetBtn.hidden = Object.keys(found).length === 0; }
resetBtn.addEventListener('click', () => {
  $('resetN').textContent = String(Object.keys(found).length);
  resetBtn.hidden = true;
  resetConfirm.hidden = false;
  $<HTMLButtonElement>('resetNo').focus();
});
$('resetNo').addEventListener('click', () => { hideConfirm(); resetBtn.focus(); });
$('resetYes').addEventListener('click', () => {
  found = {};
  storageOk = saveFound(found);
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable: nothing to remove */ }
  hideConfirm();
  refreshFound(null);
  renderJournal();
  status.textContent = 'Journal cleared. The marks in the paintings are new again.';
  $<HTMLButtonElement>('journalClose').focus();
});

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!journal.hidden) closeJournal();
  else if (openFor) closePanel(true);
});

/* ───────────── epilogue: reveals and the street panorama ───────────── */
const reveals = document.querySelectorAll<HTMLElement>('.ep-head, .pano, .end > *');
reveals.forEach((el) => el.classList.add('reveal'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((list) => {
    for (const en of list) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  reveals.forEach((el) => io.observe(el));
  // On narrow screens, start the panorama on the whale rather than the left edge.
  const po = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    const s = pano.scroller;
    if (s.scrollWidth > s.clientWidth + 4 && s.scrollLeft === 0) s.scrollLeft = 0.6 * s.scrollWidth - s.clientWidth / 2;
    po.disconnect();
  }, { rootMargin: '200px 0px' });
  po.observe(pano.scroller);
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

refreshFound(null);
measure();
render();
