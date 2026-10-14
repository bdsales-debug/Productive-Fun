import './style.css';
import sketchUrl from './assets/pagoda-sketch.jpg';
import { startExperience } from './app';

const $ = (id: string) => document.getElementById(id)!;

function showError(message: string) {
  $('loader').hidden = true;
  $('enterBtn').hidden = true;
  $('keys').hidden = true;
  const e = $('error');
  e.hidden = false;
  e.textContent = message;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function loadSketch(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // the scroll falls back to blank paper
    img.src = sketchUrl;
  });
}

async function boot() {
  if (matchMedia('(pointer: coarse)').matches) {
    $('keys').innerHTML = '<li>Left pad to walk</li><li>Drag to look around</li><li>Tap a ring to inspect</li>';
  }
  if (!webglAvailable()) {
    showError('This experience needs WebGL 2, which this browser or device does not provide. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.');
    return;
  }
  const bar = $('loadBar') as HTMLElement, text = $('loadText');
  try {
    const sketch = await loadSketch();
    const exp = await startExperience($('scene') as HTMLCanvasElement, sketch, (p, label) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      text.textContent = label;
    });
    $('loader').hidden = true;
    const btn = $('enterBtn') as HTMLButtonElement;
    btn.hidden = false;
    btn.focus();
    btn.addEventListener('click', () => exp.enter());
  } catch (err) {
    console.error(err);
    showError(`The pagoda could not be built on this device (${err instanceof Error ? err.message : String(err)}). Reloading sometimes helps; otherwise try another browser.`);
  }
}

boot();
