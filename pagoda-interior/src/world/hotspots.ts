import { PerspectiveCamera, Sprite, SpriteMaterial, Texture, Vector2, Vector3, Group } from 'three';
import type { CollisionWorld } from './collision';

export interface Hotspot {
  id: string;
  jp: string;
  title: string;
  text: string;
  pos: Vector3;
  range?: number;
  action?: { label: string; run: () => void };
}

const _v = new Vector3();

/** Small gilt rings that mark things worth a closer look. Hidden when out of range or behind a wall. */
export class Hotspots {
  group = new Group();
  private sprites: Sprite[] = [];
  private seen: boolean[] = [];
  private alpha: number[] = [];
  private frame = 0;

  constructor(public list: Hotspot[], tex: Texture, private world: CollisionWorld) {
    this.group.name = 'hotspots';
    for (const h of list) {
      const s = new Sprite(new SpriteMaterial({ map: tex, color: '#f3dca8', transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
      s.position.copy(h.pos);
      s.renderOrder = 20;
      this.group.add(s);
      this.sprites.push(s);
      this.seen.push(false);
      this.alpha.push(0);
    }
  }

  setVisible(v: boolean) { this.group.visible = v; }

  update(t: number, cam: PerspectiveCamera, hovered: Hotspot | null) {
    this.frame++;
    this.list.forEach((h, i) => {
      const d = cam.position.distanceTo(h.pos);
      const range = h.range ?? 14;
      if ((this.frame + i) % 8 === 0) this.seen[i] = d < range && !this.world.segmentBlocked(cam.position, h.pos);
      const target = this.seen[i] ? (h === hovered ? 1 : 0.75) * Math.min(1, (range - d) / 3) : 0;
      this.alpha[i] += (target - this.alpha[i]) * 0.12;
      const s = this.sprites[i];
      (s.material as SpriteMaterial).opacity = this.alpha[i];
      const pulse = 1 + Math.sin(t * 2.2 + i) * 0.08 + (h === hovered ? 0.25 : 0);
      s.scale.setScalar(Math.max(0.16, d * 0.028) * pulse);
      s.visible = this.alpha[i] > 0.02;
    });
  }

  /** Nearest visible hotspot to a point in normalised device coordinates. */
  pick(ndc: Vector2, cam: PerspectiveCamera, radius = 0.07): Hotspot | null {
    let best: Hotspot | null = null, bestD = radius;
    this.list.forEach((h, i) => {
      if (this.alpha[i] < 0.2) return;
      _v.copy(h.pos).project(cam);
      if (_v.z > 1) return;
      const d = Math.hypot((_v.x - ndc.x) * cam.aspect, _v.y - ndc.y);
      if (d < bestD) { bestD = d; best = h; }
    });
    return best;
  }
}
