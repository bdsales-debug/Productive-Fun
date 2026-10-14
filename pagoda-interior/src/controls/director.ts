import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ANNEX, ENGAWA, EYE, H1, H2, IN, OUT, SLAB, VOID } from '../core/layout';
import type { Player } from './player';

export type Mode = 'walk' | 'orbit';

export interface Viewpoint { id: string; label: string; key: string; eye: Vector3; look: Vector3 }

export const VIEWPOINTS: Viewpoint[] = [
  { id: 'atrium', label: 'Atrium', key: '1', eye: new Vector3(0, 0.3 + EYE, 2.78), look: new Vector3(-1.1, 5.7, -2.8) },
  { id: 'upper', label: 'Upper Gallery', key: '2', eye: new Vector3(-1.4, H2 + EYE, 3.7), look: new Vector3(0.8, 8.9, -3.0) },
  { id: 'sacred', label: 'Sacred Hall', key: '3', eye: new Vector3(0, EYE, -13.0), look: new Vector3(0, 1.9, -19) },
  { id: 'lantern', label: 'Lantern Corridor', key: '4', eye: new Vector3(7.2, H1 + EYE, 10.8), look: new Vector3(7.2, H1 + 2.3, -6) },
  { id: 'garden', label: 'Garden View', key: '5', eye: new Vector3(-2.0, ENGAWA.y + EYE, 14.0), look: new Vector3(-14, 1.0, 40) },
];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Owns the camera. In walk mode the player drives it; in orbit mode OrbitControls do, kept
 * inside the room the target is in. Viewpoint changes use a short fade and a slow dolly-in,
 * so the camera never sweeps through floors or walls.
 */
export class Director {
  mode: Mode = 'walk';
  controls: OrbitControls;
  private trans: null | {
    t: number; phase: 'out' | 'in'; view: Viewpoint; from: Vector3; to: Vector3; q0: Quaternion; q1: Quaternion; mode: Mode;
  } = null;
  onModeChange: (m: Mode) => void = () => {};
  onTransitionMid: () => void = () => {};

  constructor(private cam: PerspectiveCamera, dom: HTMLElement, private player: Player, private fade: HTMLElement) {
    this.controls = new OrbitControls(cam, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 12;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.6;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    this.controls.enabled = false;
  }

  get busy() { return this.trans !== null; }

  setMode(m: Mode) {
    if (m === this.mode) return;
    if (m === 'orbit') {
      // keep the current view and orbit around a point a few metres ahead
      const dir = new Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion);
      const target = this.cam.position.clone().addScaledVector(dir, 5);
      this.controls.target.copy(this.clampTarget(target));
      this.mode = 'orbit';
      this.controls.enabled = true;
      this.controls.update();
    } else {
      this.mode = 'walk';
      this.controls.enabled = false;
      // return to where the walker was standing
      const eye = this.player.feet.clone().setY(this.player.feet.y + EYE);
      const look = eye.clone().add(new Vector3(-Math.sin(this.player.yaw), Math.tan(this.player.pitch), -Math.cos(this.player.yaw)));
      this.go({ id: 'return', label: '', key: '', eye, look }, 'walk');
    }
    this.onModeChange(this.mode);
  }

  /** Fade, then dolly gently into the chosen viewpoint. */
  go(view: Viewpoint, mode: Mode = this.mode) {
    const q1 = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(view.eye, view.look, new Vector3(0, 1, 0)));
    const back = view.look.clone().sub(view.eye).normalize().multiplyScalar(-1.3);
    const from = view.eye.clone().add(back).add(new Vector3(0, 0.22, 0));
    this.trans = { t: 0, phase: 'out', view, from, to: view.eye.clone(), q0: q1.clone(), q1, mode };
    this.controls.enabled = false;
    this.player.enabled = false;
  }

  update(dt: number) {
    const tr = this.trans;
    if (tr) {
      if (tr.phase === 'out') {
        tr.t += dt / 0.38;
        this.fade.style.opacity = String(Math.min(1, tr.t));
        if (tr.t >= 1) {
          tr.phase = 'in';
          tr.t = 0;
          this.onTransitionMid();
          // start slightly tilted toward the final framing
          tr.q0 = tr.q1.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.05));
        }
      } else {
        tr.t += dt / 1.7;
        const k = ease(Math.min(1, tr.t));
        this.fade.style.opacity = String(Math.max(0, 1 - tr.t * 2.2));
        this.cam.position.lerpVectors(tr.from, tr.to, k);
        this.cam.quaternion.slerpQuaternions(tr.q0, tr.q1, k);
        if (tr.t >= 1) {
          this.trans = null;
          this.fade.style.opacity = '0';
          if (tr.mode === 'walk') {
            this.mode = 'walk';
            this.player.place(tr.view.eye, tr.view.look);
            this.player.enabled = true;
            this.controls.enabled = false;
          } else {
            this.mode = 'orbit';
            this.player.place(tr.view.eye, tr.view.look);
            this.controls.target.copy(this.clampTarget(tr.view.look.clone().lerp(tr.view.eye, 0.55)));
            this.controls.enabled = true;
            this.controls.update();
          }
          this.player.enabled = true;
          this.onModeChange(this.mode);
        }
      }
      return;
    }
    if (this.mode === 'walk') {
      this.player.update(dt);
      this.player.apply(this.cam);
    } else {
      this.controls.target.copy(this.clampTarget(this.controls.target));
      this.controls.update();
      this.clampCamera();
    }
  }

  private zone(p: Vector3): 'main' | 'annex' | 'garden' {
    if (p.z < -OUT + 0.2 && Math.abs(p.x) < ANNEX.x1) return 'annex';
    if (p.z > OUT - 0.2) return 'garden';
    return 'main';
  }

  private clampTarget(t: Vector3) {
    const z = this.zone(t);
    if (z === 'annex') t.set(clamp(t.x, -5, 5), clamp(t.y, 0.5, 5.2), clamp(t.z, ANNEX.z0 + 0.8, ANNEX.z1 - 0.6));
    else if (z === 'garden') t.set(clamp(t.x, -16, 16), clamp(t.y, 0, 6), clamp(t.z, 12, 27));
    else t.set(clamp(t.x, -11, 11), clamp(t.y, 0.5, 18.5), clamp(t.z, -11, 11.4));
    return t;
  }

  private clampCamera() {
    const c = this.cam.position, z = this.zone(this.controls.target);
    if (z === 'annex') {
      c.set(clamp(c.x, -5.6, 5.6), clamp(c.y, 0.3, ANNEX.h - 0.6), clamp(c.z, ANNEX.z0 + 0.4, ANNEX.z1 + 1.5));
    } else if (z === 'garden') {
      c.y = Math.max(c.y, 0.2);
      c.set(clamp(c.x, -17, 17), c.y, clamp(c.z, 12.4, 27));
    } else {
      c.set(clamp(c.x, -11.5, 11.5), clamp(c.y, 0.3, 19.2), clamp(c.z, -11.5, 13.5));
      // stay out of the floor slabs and their beams when outside the open atrium
      if (Math.abs(c.x) > VOID + 0.1 || Math.abs(c.z) > VOID + 0.1) {
        for (const H of [H1, H2]) {
          const lo = H - SLAB - 0.62, hi = H + 0.12;
          if (c.y > lo && c.y < hi) c.y = c.y - lo < hi - c.y ? lo : hi;
        }
      }
      // and out of the atrium columns
      if (Math.abs(Math.abs(c.x) - IN) < 0.5 && Math.abs(Math.abs(c.z) - IN) < 0.5) c.x += Math.sign(c.x) * 0.5;
    }
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
