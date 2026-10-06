import type { LandXmlProject } from '../landxml/types';
import { AlignmentModel } from './alignment';
import { ProfileModel } from './profile';
import { buildSection, flatToPoints, interp, syntheticSection, type BuiltSection } from './sections';

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

/**
 * El "mundo" de la obra: todo se ubica por abscisa + desplazamiento y se convierte a 3D aquí.
 * Las coordenadas MAGNA-SIRGAS son de millones de metros, así que se trabaja con un origen local
 * en el inicio del eje para no perder precisión en la GPU.
 */
export class World {
  readonly project: LandXmlProject;
  readonly align: AlignmentModel;
  readonly profile: ProfileModel | null;
  readonly sections: BuiltSection[];
  readonly origin: { e: number; n: number; z: number };
  /** Eje muestreado cada 2 m (para proyectar puntos y para el minimapa) */
  readonly samples: { sta: Float64Array; e: Float64Array; n: Float64Array };
  readonly stats: {
    closureMax: number;
    rasanteDiffMax: number | null;
    generatedSlopes: number;
    synthetic: boolean;
  };
  private readonly secSta: Float64Array;

  constructor(project: LandXmlProject, terrainName: string, designName: string) {
    this.project = project;
    this.align = new AlignmentModel(project.alignment);
    this.profile = project.profile?.pvis.length ? new ProfileModel(project.profile.pvis) : null;

    const { staStart, staEnd } = this.align;
    const raw = project.sections.filter(
      (s) => s.sta >= staStart - 1 && s.sta <= staEnd + 1 && s.surfaces.has(terrainName) && s.surfaces.has(designName),
    );
    const built: BuiltSection[] = [];
    let synthetic = false;
    if (raw.length >= 2) {
      for (const s of raw) {
        if (built.length && s.sta - built[built.length - 1].sta < 0.01) continue;
        const terrain = flatToPoints(s.surfaces.get(terrainName)!);
        const design = flatToPoints(s.surfaces.get(designName)!);
        if (terrain.length < 2 || design.length < 2) continue;
        built.push(buildSection(s.sta, terrain, design));
      }
    }
    if (built.length < 2) {
      synthetic = true;
      built.length = 0;
      const ground = pickCenterlineGround(project);
      for (let sta = staStart; ; sta = Math.min(sta + 10, staEnd)) {
        const zd = this.profile?.elevAt(sta) ?? (ground ? interp(ground, sta) : 0);
        const zg = ground ? interp(ground, sta) : zd - 0.5;
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
    };
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
}

/** Perfil de terreno sobre el eje (descarta los perfiles desplazados tipo "… - 5.450") */
function pickCenterlineGround(project: LandXmlProject) {
  const g = project.groundProfiles;
  const pick = g.find((p) => !/-\s*-?\d+(\.\d+)?\s*$/.test(p.name)) ?? g[0];
  if (!pick) return null;
  const pts = flatToPoints(pick.points);
  return { o: Float64Array.from(pts, (p) => p.o), z: Float64Array.from(pts, (p) => p.z) };
}
