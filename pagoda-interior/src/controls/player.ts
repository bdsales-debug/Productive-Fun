import { PerspectiveCamera, Vector3 } from 'three';
import { EYE } from '../core/layout';
import type { CollisionWorld } from '../world/collision';

/** First-person walker: capsule collision, stair climbing, gentle head bob. */
export class Player {
  feet = new Vector3();
  yaw = 0;
  pitch = 0;
  private vel = new Vector3();
  private vy = 0;
  private eyeY = 0;
  private bob = 0;
  private keys = new Set<string>();
  /** analogue input from the touch joystick, -1…1 */
  stick = { x: 0, y: 0 };
  enabled = true;

  constructor(private world: CollisionWorld) {}

  keyDown(code: string) { this.keys.add(code); }
  keyUp(code: string) { this.keys.delete(code); }
  clearKeys() { this.keys.clear(); this.stick.x = this.stick.y = 0; }
  get moving() { return this.vel.lengthSq() > 0.04; }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy));
  }

  /** Places the walker at an eye position, looking at a target. */
  place(eye: Vector3, target: Vector3) {
    const feet = eye.y - EYE;
    const f = this.world.floorAt(eye.x, eye.z, feet + 0.3);
    this.feet.set(eye.x, f ?? feet, eye.z);
    this.eyeY = this.feet.y + EYE;
    const d = target.clone().sub(eye);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.vel.set(0, 0, 0);
    this.vy = 0;
  }

  update(dt: number) {
    const k = this.keys;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.stick.y;
    let str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.stick.x;
    if (!this.enabled) fwd = str = 0;
    const len = Math.hypot(fwd, str);
    if (len > 1) { fwd /= len; str /= len; }
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 4.4 : 2.2;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const want = new Vector3((-sy * fwd + cy * str) * speed, 0, (-cy * fwd - sy * str) * speed);
    this.vel.lerp(want, 1 - Math.exp(-dt * 9));

    const step = this.vel.clone().multiplyScalar(dt);
    const n = Math.max(1, Math.ceil(step.length() / 0.12));
    step.divideScalar(n);
    for (let i = 0; i < n; i++) this.tryMove(step.x, step.z);

    // vertical: snap to stairs and small steps, fall from anything taller
    const floor = this.world.floorAt(this.feet.x, this.feet.z, this.feet.y);
    if (floor !== null && floor >= this.feet.y - 0.5) {
      this.feet.y = floor;
      this.vy = 0;
    } else if (floor !== null) {
      this.vy -= 18 * dt;
      this.feet.y = Math.max(floor, this.feet.y + this.vy * dt);
      if (this.feet.y === floor) this.vy = 0;
    }
    this.eyeY += (this.feet.y + EYE - this.eyeY) * (1 - Math.exp(-dt * 12));
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * sp * 3.4;
  }

  private tryMove(dx: number, dz: number) {
    const attempt = (ax: number, az: number) => {
      const p = { x: this.feet.x + ax, z: this.feet.z + az };
      this.world.resolve(p, this.feet.y);
      const f = this.world.floorAt(p.x, p.z, this.feet.y);
      if (f === null) return false;
      this.feet.x = p.x;
      this.feet.z = p.z;
      return true;
    };
    if (!attempt(dx, dz) && !attempt(dx, 0)) attempt(0, dz);
  }

  apply(cam: PerspectiveCamera) {
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2.2);
    cam.position.set(this.feet.x, this.eyeY + Math.sin(this.bob * 2) * 0.022 * sp, this.feet.z);
    cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * sp, 'YXZ');
  }
}
