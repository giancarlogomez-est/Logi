import type { Flat2D } from '../landxml/types';

/** Polilínea de sección: desplazamientos ascendentes y cotas */
export interface Poly {
  o: Float64Array;
  z: Float64Array;
}

/** Sección lista para dibujar: perfil combinado terreno + taludes + diseño */
export interface BuiltSection {
  sta: number;
  combined: Poly;
  terrain: Poly;
  /** Bordes de calzada */
  cwL: number;
  cwR: number;
  /** Fin de la plataforma (berma/cuneta) antes del talud */
  platL: number;
  platR: number;
  /** Chaflanes (donde el talud toca el terreno) */
  dayL: number;
  dayR: number;
  /** Cota de diseño en el eje */
  zAxis: number;
  /** El talud se generó aquí porque el corredor no lo trae */
  generated: boolean;
}

/** Pendientes por defecto para taludes generados (V por H) */
const CUT_SLOPE = 1 / 1; // corte 1H:1V
const FILL_SLOPE = 1 / 1.5; // relleno 1.5H:1V
const DAYLIGHT_TOL = 0.15;
const PLATFORM_MAX = 1.6;
const DESIGN_LIMIT = 59.5;

interface P2 {
  o: number;
  z: number;
}

export function toPoly(pts: P2[]): Poly {
  return { o: Float64Array.from(pts, (p) => p.o), z: Float64Array.from(pts, (p) => p.z) };
}

export function flatToPoints(flat: Flat2D): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (Number.isFinite(flat[i]) && Number.isFinite(flat[i + 1])) pts.push({ o: flat[i], z: flat[i + 1] });
  }
  // sort estable: conserva el orden de puntos con igual desplazamiento (escalones verticales)
  return pts.sort((a, b) => a.o - b.o);
}

export function interp(p: Poly, o: number): number {
  const { o: x, z } = p;
  const n = x.length;
  if (n === 0) return 0;
  if (o <= x[0]) return z[0];
  if (o >= x[n - 1]) return z[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid] <= o) lo = mid;
    else hi = mid;
  }
  const dx = x[hi] - x[lo];
  return dx > 1e-9 ? z[lo] + ((z[hi] - z[lo]) * (o - x[lo])) / dx : z[hi];
}

/**
 * Prolonga el diseño desde su último punto hasta cortar el terreno.
 * `des` va ordenado del borde de calzada hacia afuera; `dir` = +1 derecha, −1 izquierda.
 */
function extendSide(des: P2[], terrain: Poly, dir: 1 | -1, limit: number): { pts: P2[]; day: number; generated: boolean } {
  const last = des[des.length - 1];
  const dz = last.z - interp(terrain, last.o);
  if (Math.abs(dz) <= DAYLIGHT_TOL || dir * (limit - last.o) <= 0.5) return { pts: des, day: last.o, generated: false };

  const slope = dz > 0 ? -FILL_SLOPE : CUT_SLOPE;
  const zAt = (o: number) => last.z + slope * Math.abs(o - last.o);
  let prevO = last.o;
  let prevD = dz;
  for (let d = 0.25; ; d += 0.25) {
    const o = dir * (limit - (last.o + dir * d)) <= 0 ? limit : last.o + dir * d;
    const diff = zAt(o) - interp(terrain, o);
    if (Math.sign(diff) !== Math.sign(prevD)) {
      const t = prevD / (prevD - diff);
      const day = prevO + (o - prevO) * t;
      return { pts: [...des, { o: day, z: zAt(day) }], day, generated: true };
    }
    if (o === limit) return { pts: [...des, { o, z: zAt(o) }], day: o, generated: true };
    prevO = o;
    prevD = diff;
  }
}

export function buildSection(sta: number, terrainPts: P2[], designPts: P2[]): BuiltSection {
  const terrain = toPoly(terrainPts);
  const tMin = terrain.o[0];
  const tMax = terrain.o[terrain.o.length - 1];

  // Civil 3D extrapola la superficie del corredor hasta ±60 m: esos extremos no son diseño real
  const design = designPts.filter((p) => Math.abs(p.o) < DESIGN_LIMIT && p.o > tMin && p.o < tMax);
  const designPoly = toPoly(design);
  const zAxis = interp(designPoly, 0);

  const right = design.filter((p) => p.o > 0.5);
  const left = design.filter((p) => p.o < -0.5);
  const cwR = right.length ? right[0].o : 3.65;
  const cwL = left.length ? left[left.length - 1].o : -3.65;

  const rightDes = design.filter((p) => p.o >= cwR);
  const leftDes = design.filter((p) => p.o <= cwL).reverse();
  if (!rightDes.length) rightDes.push({ o: cwR, z: zAxis });
  if (!leftDes.length) leftDes.push({ o: cwL, z: zAxis });

  const extR = extendSide(rightDes, terrain, 1, tMax);
  const extL = extendSide(leftDes, terrain, -1, tMin);

  const platR = Math.min(extR.day, rightDes.filter((p) => p.o - cwR <= PLATFORM_MAX).at(-1)!.o);
  const platL = Math.max(extL.day, leftDes.filter((p) => cwL - p.o <= PLATFORM_MAX).at(-1)!.o);

  const combined: P2[] = [
    ...terrainPts.filter((p) => p.o < extL.day),
    ...extL.pts.slice().reverse(),
    ...design.filter((p) => p.o > cwL && p.o < cwR),
    ...extR.pts,
    ...terrainPts.filter((p) => p.o > extR.day),
  ];

  return {
    sta,
    combined: toPoly(combined),
    terrain,
    cwL,
    cwR,
    platL,
    platR,
    dayL: extL.day,
    dayR: extR.day,
    zAxis,
    generated: extL.generated || extR.generated,
  };
}

/** Sección sintética cuando el LandXML no trae secciones: calzada 7.3 m con bombeo 2 % y terreno plano */
export function syntheticSection(sta: number, zDesign: number, zGround: number): BuiltSection {
  const design: P2[] = [
    { o: -4.85, z: zDesign - 0.1 },
    { o: -3.65, z: zDesign - 0.073 },
    { o: 0, z: zDesign },
    { o: 3.65, z: zDesign - 0.073 },
    { o: 4.85, z: zDesign - 0.1 },
  ];
  return buildSection(sta, [{ o: -40, z: zGround }, { o: 40, z: zGround }], design);
}
