import { BackSide, Color, DoubleSide, Material, MeshStandardMaterial, type MeshStandardMaterialParameters, Texture } from 'three';
import * as T from './textures';

/**
 * The pagoda's material palette. Timber is tinted from one neutral grain texture so the
 * walnut, cedar and honey woods share a single family of figure.
 */
export interface Palette {
  mats: Record<string, Material>;
  tex: Record<string, Texture>;
}

export function createPalette(onStep: (label: string) => void, sketch: HTMLImageElement | null): Palette {
  onStep('Seasoning the timber');
  const wood = T.woodTextures();
  onStep('Laying the floorboards');
  const planks = T.plankTextures();
  onStep('Making paper and plaster');
  const tex: Record<string, Texture> = {
    wood: wood.map, woodRough: wood.rough, planks: planks.map, planksRough: planks.rough,
    paper: T.paperTexture(), plaster: T.plasterTexture(), stone: T.stoneTexture(), tatami: T.tatamiTexture(),
    tile: T.tileTexture(), gravel: T.gravelTexture(), asanoha: T.asanohaTexture(), coffer: T.cofferTexture(),
    banner: T.bannerTexture(), ink: T.inkPaintingTexture(3), ink2: T.inkPaintingTexture(11), glow: T.glowTexture(),
    smoke: T.smokeTexture(), ring: T.ringTexture(), maple: T.mapleLeafTexture(), bambooLeaf: T.bambooLeafTexture(), noren: T.norenTexture(), scroll: T.scrollTexture(sketch),
  };

  const timber = (color: string, roughness: number, extra: MeshStandardMaterialParameters = {}) =>
    new MeshStandardMaterial({
      color, roughness, map: tex.wood, roughnessMap: tex.woodRough, bumpMap: tex.woodRough, bumpScale: 1.2,
      vertexColors: true, ...extra,
    });

  const mats: Record<string, Material> = {
    walnut: timber('#3f291c', 0.7),
    cedar: timber('#7a5336', 0.78),
    honey: new MeshStandardMaterial({
      color: '#b08a5e', roughness: 0.55, map: tex.planks, roughnessMap: tex.planksRough, bumpMap: tex.planksRough,
      bumpScale: 0.6, vertexColors: true,
    }),
    board: timber('#98754f', 0.74), // ceiling boards and panels
    boardBack: timber('#6f4c30', 0.85, { side: BackSide }), // eave soffits seen from below
    lacquer: timber('#2c1410', 0.38, { bumpScale: 0.2 }),
    black: timber('#1b1512', 0.5, { bumpScale: 0.2 }),
    bronze: new MeshStandardMaterial({ color: '#7d6040', metalness: 0.85, roughness: 0.42, vertexColors: true }),
    bellBronze: new MeshStandardMaterial({ color: '#86683f', metalness: 0.35, roughness: 0.48, map: tex.stone, vertexColors: true }),
    gold: new MeshStandardMaterial({ color: '#c09a55', metalness: 1, roughness: 0.34, vertexColors: true }),
    iron: new MeshStandardMaterial({ color: '#2c2a28', metalness: 0.7, roughness: 0.6, vertexColors: true }),
    stone: new MeshStandardMaterial({ color: '#9d978b', roughness: 0.93, map: tex.stone, bumpMap: tex.stone, bumpScale: 2, vertexColors: true }),
    darkStone: new MeshStandardMaterial({ color: '#6c6860', roughness: 0.95, map: tex.stone, bumpMap: tex.stone, bumpScale: 2, vertexColors: true }),
    plaster: new MeshStandardMaterial({ color: '#efe8d8', roughness: 0.96, map: tex.plaster, vertexColors: true }),
    paper: new MeshStandardMaterial({
      color: '#efe6d2', roughness: 0.92, map: tex.paper, emissive: new Color('#f0e2c4'), emissiveIntensity: 0.1,
      emissiveMap: tex.paper, side: DoubleSide, vertexColors: true,
    }),
    // Paper in outer walls: daylight glows through it.
    paperLit: new MeshStandardMaterial({
      color: '#f3ead6', roughness: 0.92, map: tex.paper, emissive: new Color('#fff1d6'), emissiveIntensity: 0.55,
      emissiveMap: tex.paper, side: DoubleSide, vertexColors: true,
    }),
    tatami: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, map: tex.tatami, vertexColors: true }),
    fabricRed: new MeshStandardMaterial({ color: '#6e2a20', roughness: 0.96, vertexColors: true }),
    fabricIndigo: new MeshStandardMaterial({ color: '#25304a', roughness: 0.96, vertexColors: true }),
    fabricBlack: new MeshStandardMaterial({ color: '#1c1a19', roughness: 0.96, vertexColors: true }),
    ceramic: new MeshStandardMaterial({ color: '#8a9a86', roughness: 0.32, vertexColors: true }),
    ceramicDark: new MeshStandardMaterial({ color: '#3b2f28', roughness: 0.4, vertexColors: true }),
    asanoha: new MeshStandardMaterial({
      color: '#4a2f20', roughness: 0.7, alphaMap: tex.asanoha, alphaTest: 0.5, side: DoubleSide, vertexColors: true,
    }),
    coffer: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.15, map: tex.coffer, vertexColors: true }),
    tile: new MeshStandardMaterial({ color: '#8a8f94', roughness: 0.68, map: tex.tile, bumpMap: tex.tile, bumpScale: 3, vertexColors: true }),
    ink: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: tex.ink, vertexColors: true }),
    ink2: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: tex.ink2, vertexColors: true }),
    scroll: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, map: tex.scroll, vertexColors: true }),
    noren: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, map: tex.noren, side: DoubleSide }),
    banner: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, map: tex.banner, side: DoubleSide, vertexColors: true }),
    candle: new MeshStandardMaterial({ color: '#efe5cf', roughness: 0.6, emissive: new Color('#ffcf8a'), emissiveIntensity: 0.25, vertexColors: true }),
    lanternPaper: new MeshStandardMaterial({
      color: '#f2dcb0', roughness: 0.9, emissive: new Color('#ffa850'), emissiveIntensity: 1.6, map: tex.paper,
      side: DoubleSide, vertexColors: true,
    }),
    lanternGlass: new MeshStandardMaterial({ color: '#f6d9a6', emissive: new Color('#ffb15e'), emissiveIntensity: 2.2, roughness: 0.6, vertexColors: true }),
    moss: new MeshStandardMaterial({ color: '#4d5a2c', roughness: 1, vertexColors: true }),
    gravel: new MeshStandardMaterial({ color: '#d6cfbf', roughness: 1, map: tex.gravel, bumpMap: tex.gravel, bumpScale: 2, vertexColors: true }),
  };
  return { mats, tex };
}
