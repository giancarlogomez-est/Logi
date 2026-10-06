import type { Alignment, GeomElement, Pt } from '../landxml/types';

/**
 * Punto del eje. `theta` es el rumbo como ángulo matemático (radianes, antihorario desde el Este),
 * así la dirección de avance es (cos θ, sin θ) en (Este, Norte) y la normal derecha es (sin θ, −cos θ).
 */
export interface AxisPoint {
  e: number;
  n: number;
  theta: number;
}

const headingOf = (a: Pt, b: Pt) => Math.atan2(b.n - a.n, b.e - a.e);
const curvature = (r: number) => (Number.isFinite(r) && r !== 0 ? 1 / r : 0);
/** Girar en sentido horario (cw) reduce el ángulo matemático */
const turnSign = (rot: 'cw' | 'ccw') => (rot === 'cw' ? -1 : 1);

interface SpiralTable {
  step: number;
  e: Float64Array;
  n: Float64Array;
}

/** Evalúa el alineamiento horizontal por abscisa. Cada elemento arranca en sus propias coordenadas de inicio. */
export class AlignmentModel {
  readonly name: string;
  readonly staStart: number;
  readonly staEnd: number;
  readonly elements: GeomElement[];
  /** Error de cierre por elemento: distancia entre el final calculado y el final del LandXML (m) */
  readonly closure: number[] = [];
  private readonly starts: number[] = [];
  private readonly theta0: number[] = [];
  private readonly spirals = new Map<number, SpiralTable>();

  constructor(al: Alignment) {
    this.name = al.name;
    this.staStart = al.staStart;
    this.elements = al.elements;
    let sta = al.staStart;
    let prevTheta = 0;
    al.elements.forEach((el, i) => {
      this.starts.push(sta);
      const t0 = this.startHeading(el, prevTheta);
      this.theta0.push(t0);
      if (el.kind === 'spiral') this.spirals.set(i, this.integrateSpiral(el, t0));
      const end = this.evalElement(i, el.length);
      this.closure.push(Math.hypot(end.e - el.end.e, end.n - el.end.n));
      prevTheta = end.theta;
      sta += el.length;
    });
    this.staEnd = sta;
  }

  get length() {
    return this.staEnd - this.staStart;
  }

  private startHeading(el: GeomElement, prev: number): number {
    if (el.kind === 'line') return headingOf(el.start, el.end);
    if (el.pi) return headingOf(el.start, el.pi);
    if (el.kind === 'arc' && el.center) {
      // Tangente = radio girado ±90°
      const r = Math.atan2(el.start.n - el.center.n, el.start.e - el.center.e);
      return r + (turnSign(el.rot) * Math.PI) / 2;
    }
    return prev;
  }

  private spiralTheta(el: Extract<GeomElement, { kind: 'spiral' }>, t0: number, s: number) {
    const k0 = curvature(el.radiusStart);
    const k1 = curvature(el.radiusEnd);
    return t0 + turnSign(el.rot) * (k0 * s + ((k1 - k0) * s * s) / (2 * el.length));
  }

  /** Clotoide: curvatura lineal; posición por integración de Simpson cada ~0.5 m */
  private integrateSpiral(el: Extract<GeomElement, { kind: 'spiral' }>, t0: number): SpiralTable {
    const count = Math.max(8, Math.ceil(el.length / 0.5));
    const step = el.length / count;
    const e = new Float64Array(count + 1);
    const n = new Float64Array(count + 1);
    e[0] = el.start.e;
    n[0] = el.start.n;
    for (let j = 0; j < count; j++) {
      const s = j * step;
      const ta = this.spiralTheta(el, t0, s);
      const tm = this.spiralTheta(el, t0, s + step / 2);
      const tb = this.spiralTheta(el, t0, s + step);
      e[j + 1] = e[j] + (step / 6) * (Math.cos(ta) + 4 * Math.cos(tm) + Math.cos(tb));
      n[j + 1] = n[j] + (step / 6) * (Math.sin(ta) + 4 * Math.sin(tm) + Math.sin(tb));
    }
    return { step, e, n };
  }

  private evalElement(i: number, s: number): AxisPoint {
    const el = this.elements[i];
    const t0 = this.theta0[i];
    switch (el.kind) {
      case 'line':
        return { e: el.start.e + s * Math.cos(t0), n: el.start.n + s * Math.sin(t0), theta: t0 };
      case 'arc': {
        const d = (turnSign(el.rot) * s) / el.radius;
        const chord = 2 * el.radius * Math.sin(s / (2 * el.radius));
        const a = t0 + d / 2;
        return { e: el.start.e + chord * Math.cos(a), n: el.start.n + chord * Math.sin(a), theta: t0 + d };
      }
      case 'spiral': {
        const tbl = this.spirals.get(i)!;
        const x = s / tbl.step;
        const j = Math.min(Math.max(Math.floor(x), 0), tbl.e.length - 2);
        const f = x - j;
        return {
          e: tbl.e[j] + (tbl.e[j + 1] - tbl.e[j]) * f,
          n: tbl.n[j] + (tbl.n[j + 1] - tbl.n[j]) * f,
          theta: this.spiralTheta(el, t0, s),
        };
      }
    }
  }

  evaluate(sta: number): AxisPoint {
    const s = Math.min(Math.max(sta, this.staStart), this.staEnd);
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    const local = Math.min(s - this.starts[lo], this.elements[lo].length);
    return this.evalElement(lo, local);
  }

  /** Punto desplazado: offset positivo a la derecha del eje (sentido de abscisado) */
  offsetPoint(sta: number, offset: number): AxisPoint {
    const p = this.evaluate(sta);
    return { e: p.e + offset * Math.sin(p.theta), n: p.n - offset * Math.cos(p.theta), theta: p.theta };
  }

  counts() {
    const c = { line: 0, arc: 0, spiral: 0 };
    for (const el of this.elements) c[el.kind]++;
    return c;
  }
}
