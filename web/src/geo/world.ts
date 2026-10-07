import { guessSurfaces } from '../landxml/parse';
import type { AlignmentData, LandXmlProject } from '../landxml/types';
import { AlignmentModel } from './alignment';
import { ProfileModel } from './profile';
import { CORRIDOR_MARGIN } from './meshes';
import { buildSection, flatToPoints, interp, syntheticSection, type BuiltSection } from './sections';
import { FootprintMask, TinModel } from './tin';

/** Posición en la escena 3D (Y arriba; X = Este, −Z = Norte, relativas al origen local) */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
  theta: number;
}

export interface Station {
  sta: number;
  /** Desplazamiento, positivo a la derecha del eje */
  off: number;
}

export interface Origin {
  e: number;
  n: number;
  z: number;
}

export interface SurfaceChoice {
  terrain: string;
  design: string;
}

/** Paso del muestreo del terreno TIN a lo largo de cada sección (m) */
const TIN_SAMPLE_STEP = 1;
/** Diferencia máxima admisible entre la cota de diseño en el eje y la rasante (m) */
const MAX_RASANTE_GAP = 5;

/**
 * Una vía (un alineamiento): todo se ubica por abscisa + desplazamiento y se convierte a 3D aquí.
 * Las coordenadas planas son de cientos de miles o millones de metros, así que se trabaja con un
 * origen local común a todo el proyecto para no perder precisión en la GPU.
 */
export class Road {
  readonly id: number;
  readonly data: AlignmentData;
  readonly align: AlignmentModel;
  readonly profile: ProfileModel | null;
  readonly sections: BuiltSection[];
  /** Eje muestreado cada 2 m (para proyectar puntos y para el minimapa) */
  readonly samples: { sta: Float64Array; e: Float64Array; n: Float64Array };
  readonly stats: {
    closureMax: number;
    rasanteDiffMax: number | null;
    generatedSlopes: number;
    synthetic: boolean;
    terrainFromTin: boolean;
    /** Secciones descartadas porque su cota en el eje no corresponde a la rasante */
    discarded: number[];
  };
  origin: Origin;
  private readonly secSta: Float64Array;

  constructor(id: number, data: AlignmentData, choice: SurfaceChoice, tin: TinModel | null) {
    this.id = id;
    this.data = data;
    this.align = new AlignmentModel(data.alignment);
    this.profile = data.profile?.pvis.length ? new ProfileModel(data.profile.pvis) : null;

    const { staStart, staEnd } = this.align;
    const terrainFromTin = !data.sections.some((s) => s.surfaces.has(choice.terrain)) && tin !== null;
    const built: BuiltSection[] = [];
    const discarded: number[] = [];
    for (const s of data.sections) {
      if (s.sta < staStart - 1 || s.sta > staEnd + 1 || !s.surfaces.has(choice.design)) continue;
      if (built.length && s.sta - built[built.length - 1].sta < 0.01) continue;
      const design = flatToPoints(s.surfaces.get(choice.design)!);
      if (design.length < 2) continue;
      const terrain = terrainFromTin ? this.sampleTin(tin!, s.sta, design) : flatToPoints(s.surfaces.get(choice.terrain) ?? new Float64Array());
      if (terrain.length < 2) continue;
      const sec = buildSection(s.sta, terrain, design);
      if (this.profile && Math.abs(this.profile.elevAt(s.sta) - sec.zAxis) > MAX_RASANTE_GAP) {
        discarded.push(s.sta);
        continue;
      }
      built.push(sec);
    }
    let synthetic = false;
    if (built.length < 2) {
      synthetic = true;
      built.length = 0;
      const ground = pickCenterlineGround(data);
      for (let sta = staStart; ; sta = Math.min(sta + 10, staEnd)) {
        const zd = this.profile?.elevAt(sta) ?? (ground ? interp(ground, sta) : 0);
        const p = this.align.evaluate(sta);
        const zt = tin?.z(p.e, p.n);
        const zg = zt !== undefined && Number.isFinite(zt) ? zt : ground ? interp(ground, sta) : zd - 0.5;
        built.push(syntheticSection(sta, zd, zg));
        if (sta >= staEnd) break;
      }
    }
    this.sections = built;
    this.secSta = Float64Array.from(built, (s) => s.sta);

    const p0 = this.align.evaluate(staStart);
    this.origin = { e: p0.e, n: p0.n, z: Math.round(built[0].zAxis) };

    const count = Math.max(2, Math.ceil(this.align.length / 2) + 1);
    const sta = new Float64Array(count);
    const e = new Float64Array(count);
    const n = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      sta[i] = Math.min(staStart + i * 2, staEnd);
      const p = this.align.evaluate(sta[i]);
      e[i] = p.e;
      n[i] = p.n;
    }
    this.samples = { sta, e, n };

    let rasanteDiffMax: number | null = null;
    if (this.profile && !synthetic) {
      rasanteDiffMax = 0;
      for (const s of built) rasanteDiffMax = Math.max(rasanteDiffMax, Math.abs(this.profile.elevAt(s.sta) - s.zAxis));
    }
    this.stats = {
      closureMax: Math.max(...this.align.closure),
      rasanteDiffMax,
      generatedSlopes: built.filter((s) => s.generated).length,
      synthetic,
      terrainFromTin,
      discarded,
    };
  }

  /** Terreno de una sección leído del TIN a lo ancho de la línea de muestreo */
  private sampleTin(tin: TinModel, sta: number, design: { o: number }[]) {
    const halfW = Math.max(Math.abs(design[0].o), Math.abs(design[design.length - 1].o), 10);
    const pts: { o: number; z: number }[] = [];
    for (let o = -halfW; o <= halfW + 1e-6; o += TIN_SAMPLE_STEP) {
      const p = this.align.offsetPoint(sta, o);
      const z = tin.z(p.e, p.n);
      if (Number.isFinite(z)) pts.push({ o, z });
    }
    return pts;
  }

  get name() {
    return this.align.name;
  }
  get staStart() {
    return this.align.staStart;
  }
  get staEnd() {
    return this.align.staEnd;
  }

  /** Índice de la sección anterior y factor de interpolación hacia la siguiente */
  private bracket(sta: number): [number, number] {
    const s = this.secSta;
    if (sta <= s[0]) return [0, 0];
    if (sta >= s[s.length - 1]) return [s.length - 2, 1];
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= sta) lo = mid;
      else hi = mid;
    }
    return [lo, (sta - s[lo]) / (s[hi] - s[lo])];
  }

  /** Cota de la superficie final (diseño + taludes + terreno) */
  surfaceZ(sta: number, off: number): number {
    const [i, t] = this.bracket(sta);
    const a = interp(this.sections[i].combined, off);
    const b = interp(this.sections[i + 1].combined, off);
    return a + (b - a) * t;
  }

  terrainZ(sta: number, off: number): number {
    const [i, t] = this.bracket(sta);
    const a = interp(this.sections[i].terrain, off);
    const b = interp(this.sections[i + 1].terrain, off);
    return a + (b - a) * t;
  }

  rasante(sta: number): number {
    if (this.profile) return this.profile.elevAt(sta);
    const [i, t] = this.bracket(sta);
    return this.sections[i].zAxis + (this.sections[i + 1].zAxis - this.sections[i].zAxis) * t;
  }

  roadEdges(sta: number): { cwL: number; cwR: number } {
    const [i, t] = this.bracket(sta);
    const a = this.sections[i];
    const b = this.sections[i + 1];
    return { cwL: a.cwL + (b.cwL - a.cwL) * t, cwR: a.cwR + (b.cwR - a.cwR) * t };
  }

  /** Abscisa + desplazamiento → escena 3D, apoyado sobre la superficie */
  toWorld(sta: number, off: number, lift = 0): WorldPoint {
    const p = this.align.offsetPoint(sta, off);
    return {
      x: p.e - this.origin.e,
      y: this.surfaceZ(sta, off) - this.origin.z + lift,
      z: -(p.n - this.origin.n),
      theta: p.theta,
    };
  }

  /** Coordenadas planas (E, N) → abscisa + desplazamiento */
  projectEN(e: number, n: number, hint?: number, window = 400): Station {
    const { sta, e: se, n: sn } = this.samples;
    let i0 = 0;
    let i1 = sta.length - 2;
    if (hint !== undefined) {
      const c = Math.round((hint - this.staStart) / 2);
      const w = Math.ceil(window / 2);
      i0 = Math.max(0, c - w);
      i1 = Math.min(sta.length - 2, c + w);
    }
    let best = { d: Infinity, sta: this.staStart, off: 0 };
    for (let i = i0; i <= i1; i++) {
      const ax = se[i];
      const ay = sn[i];
      const dx = se[i + 1] - ax;
      const dy = sn[i + 1] - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) continue;
      const t = Math.min(1, Math.max(0, ((e - ax) * dx + (n - ay) * dy) / len2));
      const qx = ax + dx * t;
      const qy = ay + dy * t;
      const d = (e - qx) ** 2 + (n - qy) ** 2;
      if (d < best.d) {
        const len = Math.sqrt(len2);
        // normal derecha de (dx, dy) = (dy, −dx)
        const off = ((e - qx) * dy - (n - qy) * dx) / len;
        best = { d, sta: sta[i] + (sta[i + 1] - sta[i]) * t, off };
      }
    }
    return { sta: best.sta, off: best.off };
  }

  /** Escena 3D (x, z) → abscisa + desplazamiento */
  locate(x: number, z: number, hint?: number, window?: number): Station {
    return this.projectEN(x + this.origin.e, -z + this.origin.n, hint, window);
  }

  /** Polígonos (E, N) de la huella entre chaflanes (ampliada en `margin`), por tramo entre secciones */
  footprintQuads(margin = 0): number[][] {
    const quads: number[][] = [];
    for (let i = 0; i < this.sections.length - 1; i++) {
      const a = this.sections[i];
      const b = this.sections[i + 1];
      const pts = [
        this.align.offsetPoint(a.sta, a.dayL - margin),
        this.align.offsetPoint(a.sta, a.dayR + margin),
        this.align.offsetPoint(b.sta, b.dayR + margin),
        this.align.offsetPoint(b.sta, b.dayL - margin),
      ];
      quads.push(pts.flatMap((p) => [p.e, p.n]));
    }
    return quads;
  }
}

/** El proyecto completo: una o varias vías y, si viene, el terreno TIN */
export class Site {
  readonly project: LandXmlProject;
  readonly roads: Road[];
  readonly tin: TinModel | null;
  readonly origin: Origin;
  readonly mask: FootprintMask | null;
  readonly choices: SurfaceChoice[];

  constructor(project: LandXmlProject, choices?: SurfaceChoice[], tin?: TinModel | null) {
    this.project = project;
    this.tin = tin !== undefined ? tin : project.terrain ? new TinModel(project.terrain) : null;
    this.choices = project.alignments.map((a, i) => choices?.[i] ?? guessSurfaces(a.surfaceNames));
    this.roads = project.alignments.map((a, i) => new Road(i, a, this.choices[i], this.tin));
    this.origin = this.roads[0].origin;
    for (const r of this.roads) r.origin = this.origin;

    if (this.tin) {
      const t = this.tin;
      this.mask = new FootprintMask(t.minE, t.minN, t.maxE, t.maxN);
      for (const r of this.roads) for (const q of r.footprintQuads(CORRIDOR_MARGIN)) this.mask.fillPolygon(q, 2);
      for (const r of this.roads) for (const q of r.footprintQuads()) this.mask.fillPolygon(q, 1);
    } else {
      this.mask = null;
    }
  }

  /** Vía más cercana a un punto de la escena */
  nearest(x: number, z: number, hints?: number[]): { road: Road; st: Station } {
    let best: { road: Road; st: Station } | null = null;
    for (const road of this.roads) {
      let st = road.locate(x, z, hints?.[road.id], 600);
      if (Math.abs(st.off) > 150) st = road.locate(x, z);
      if (!best || Math.abs(st.off) < Math.abs(best.st.off)) best = { road, st };
    }
    return best!;
  }
}

/** Perfil de terreno sobre el eje (descarta los perfiles desplazados tipo "… - 5.450") */
function pickCenterlineGround(data: AlignmentData) {
  const g = data.groundProfiles;
  const pick = g.find((p) => !/-\s*-?\d+(\.\d+)?\s*$/.test(p.name)) ?? g[0];
  if (!pick) return null;
  const pts = flatToPoints(pick.points);
  return { o: Float64Array.from(pts, (p) => p.o), z: Float64Array.from(pts, (p) => p.z) };
}
