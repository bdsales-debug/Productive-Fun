# Unkai-ji · an explorable pagoda interior

A real-time 3D interior of an imagined three-storey timber pagoda on a mountaintop above a sea of clouds. Everything is modelled procedurally in Three.js: no downloaded models or textures. The one image used is the pen sketch of a pagoda from this repo, which hangs as a scroll in the tea alcove.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # one self-contained file: dist/index.html
npm run test:nav   # headless walk-through of stairs, doorways, rails and walls
```

URL options: `?quality=low` or `?quality=high` overrides the automatic choice. `?debug` exposes `window.__pagoda` for inspection.

## The building

| | |
|---|---|
| Plan | 24 × 24 m. Outer columns every 4 m, an inner ring of eight 16 m atrium columns, and a 5.6 m open atrium in the centre. |
| Levels | Ground floor (0 m), second floor (6 m), third floor (11.5 m), gallery ceilings (15.6 m), clerestory and coffered lantern ceiling (19.6 m). |
| Centre | A stone and lacquer dais with tatami and cushions around the heart pillar (shinbashira), which runs from the dais to the ceiling. |
| Balconies | Cantilevered 1.2 m into the atrium on three-stepped bracket sets (tokyō), with lacquered fascias and lattice balustrades. |
| Stairs | Steep open timber stairs (about 40°): west side ground → second, east side second → third. |
| Rooms | Tea alcove with a tokonoma (east), sutra chests and a taiko drum (ground), revolving sutra library (second), lantern corridor (second, east), temple bell (third), Sacred Hall annex behind a bell-shaped katōmado doorway (north). |
| Outside | Engawa veranda, raked-gravel garden with a pond, koi, stone lantern, water basin, maples, pine and bamboo; cedar forest, distant ridges, a waterfall crag and two layers of moving cloud. |

## Controls

- **Walk:** WASD or arrows, mouse to look (click the view to lock the pointer, Esc to release, or drag). Shift walks faster. On touch screens, use the left pad to walk and drag to look.
- **Orbit:** drag to turn, scroll or pinch to zoom, right-drag or two fingers to pan. The camera stays inside whichever room it is orbiting.
- **Viewpoints:** 1 Atrium · 2 Upper Gallery · 3 Sacred Hall · 4 Lantern Corridor · 5 Garden View.
- **Inspect:** look at a gilt ring and press E (or click/tap it). The bell, drum, sutra library and screens respond.
- **Other keys:** O toggles orbit, R resets the view, T switches morning/evening, M toggles sound, H hides the interface.

## How it is built

```
src/
  core/      layout constants, noise, geometry batching + UV projection, painted textures, materials
  world/     structure (frame, floors, walls, stairs, roofs), details (furnishings, focal pieces),
             lanterns (instanced + point lights), atmosphere (sky, sun, shafts, dust, smoke),
             exterior (terrain, garden, forest, clouds, waterfall), collision, hotspots
  controls/  first-person player, camera director (walk/orbit, viewpoint transitions)
  audio/     synthesised wind, water, bell, drum and sliding-screen sounds (Web Audio)
  app.ts     assembly, input, interaction, time of day, adaptive quality, render loop
```

- **Draw calls:** static pieces are merged per material through `Batch` (about 75 draw calls for roughly 380k triangles). Lanterns, chains, flames and bamboo use instancing; glows, dust and smoke are single GPU-animated point systems.
- **Textures:** wood grain, floorboards, tatami, paper, plaster, stone, roof tiles, raked gravel, asanoha lattice, coffer panels, ink-wash fusuma paintings and leaf sprays are all painted on canvas at load time. UVs are box-projected in metres, so grain runs along each timber.
- **Collision:** walkable surfaces (flat floors with stairwell holes, ramped stairs) plus box and cylinder obstacles. The same model hides hotspots that are behind walls.
- **Quality:** phones and small screens get fewer lights, smaller shadow maps and fewer particles. Pixel ratio adapts to the measured frame rate. Shadows refresh periodically, or every frame only while something large moves.
- **Fallbacks:** a clear message appears if WebGL 2 is unavailable, if the scene fails to build, or if the graphics context is lost.
