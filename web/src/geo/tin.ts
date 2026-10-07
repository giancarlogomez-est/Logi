import { BufferAttribute, BufferGeometry, Color } from 'three';
import type { TinSurface } from '../landxml/types';

const CELL = 10; // m, celda del índice espacial

/** Superficie TIN con índice espacial por celdas para consultar cotas */
export class TinModel {
  readonly name: string;
  readonly points: Float64Array;
  readonly faces: Uint32Array;
  readonly minE: number;
  readonly minN: number;
  readonly maxE: number;
  readonly maxN: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cellStart: Uint32Array;
  private readonly cellTris: Uint32Array;

  constructor(tin: TinSurface) {
    this.name = tin.name;
    this.points = tin.points;
    this.faces = tin.faces;
    const p = tin.points;
    let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minE) minE = p[i];
      if (p[i] > maxE) maxE = p[i];
      if (p[i + 1] < minN) minN = p[i + 1];
      if (p[i + 1] > maxN) maxN = p[i + 1];
    }
    this.minE = minE;
    this.minN = minN;
    this.maxE = maxE;
    this.maxN = maxN;
    this.cols = Math.max(1, Math.ceil((maxE - minE) / CELL) + 1);
    this.rows = Math.max(1, Math.ceil((maxN - minN) / CELL) + 1);

    // Índice en formato CSR: primero contar, luego llenar
    const f = tin.faces;
    const nTri = f.length / 3;
    const counts = new Uint32Array(this.cols * this.rows + 1);
    const range = (t: number) => {
      const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3;
      const c0 = this.col(Math.min(p[a], p[b], p[c]));
      const c1 = this.col(Math.max(p[a], p[b], p[c]));
      const r0 = this.row(Math.min(p[a + 1], p[b + 1], p[c + 1]));
      const r1 = this.row(Math.max(p[a + 1], p[b + 1], p[c + 1]));
      return [c0, c1, r0, r1] as const;
    };
    for (let t = 0; t < nTri; t++) {
      const [c0, c1, r0, r1] = range(t);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) counts[r * this.cols + c + 1]++;
    }
    for (let i = 1; i < counts.length; i++) counts[i] += counts[i - 1];
    this.cellStart = counts;
    this.cellTris = new Uint32Array(counts[counts.length - 1]);
    const fill = counts.slice(0, -1);
    for (let t = 0; t < nTri; t++) {
      const [c0, c1, r0, r1] = range(t);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.cellTris[fill[r * this.cols + c]++] = t;
    }
  }

  private col(e: number) {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((e - this.minE) / CELL)));
  }
  private row(n: number) {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((n - this.minN) / CELL)));
  }

  /** Cota del TIN en (E, N); NaN fuera de la superficie */
  z(e: number, n: number): number {
    if (e < this.minE || e > this.maxE || n < this.minN || n > this.maxN) return NaN;
    const cell = this.row(n) * this.cols + this.col(e);
    const p = this.points;
    const f = this.faces;
    for (let k = this.cellStart[cell]; k < this.cellStart[cell + 1]; k++) {
      const t = this.cellTris[k] * 3;
      const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
      const d = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((p[b + 1] - p[c + 1]) * (e - p[c]) + (p[c] - p[b]) * (n - p[c + 1])) / d;
      const l2 = ((p[c + 1] - p[a + 1]) * (e - p[c]) + (p[a] - p[c]) * (n - p[c + 1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * p[a + 2] + l2 * p[b + 2] + l3 * p[c + 2];
    }
    return NaN;
  }

  /** Malla del terreno; omite los triángulos cuyo centroide cae dentro de `mask` (huella de los corredores) */
  buildGeometry(origin: { e: number; n: number; z: number }, mask?: FootprintMask): BufferGeometry {
    const p = this.points;
    const f = this.faces;
    const pos = new Float32Array((p.length / 3) * 3);
    const col = new Float32Array((p.length / 3) * 3);
    const base = new Color('#9cc48a');
    const dark = new Color('#7fae72');
    const tmp = new Color();
    for (let i = 0, v = 0; i < p.length; i += 3, v++) {
      pos[i] = p[i] - origin.e;
      pos[i + 1] = p[i + 2] - origin.z;
      pos[i + 2] = -(p[i + 1] - origin.n);
      const h = Math.sin(v * 127.1) * 43758.5453;
      tmp.copy(base).lerp(dark, (h - Math.floor(h)) * 0.55);
      col[i] = tmp.r;
      col[i + 1] = tmp.g;
      col[i + 2] = tmp.b;
    }
    const idx: number[] = [];
    for (let t = 0; t < f.length; t += 3) {
      const a = f[t], b = f[t + 1], c = f[t + 2];
      // quitar solo si el centroide está en la huella y el triángulo queda cubierto por la huella + margen
      if (
        mask &&
        mask.has((p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3) &&
        mask.covered(p[a * 3], p[a * 3 + 1]) &&
        mask.covered(p[b * 3], p[b * 3 + 1]) &&
        mask.covered(p[c * 3], p[c * 3 + 1])
      )
        continue;
      // orientar hacia arriba: antihorario en (E, N)
      const cross = (p[b * 3] - p[a * 3]) * (p[c * 3 + 1] - p[a * 3 + 1]) - (p[b * 3 + 1] - p[a * 3 + 1]) * (p[c * 3] - p[a * 3]);
      if (cross >= 0) idx.push(a, b, c);
      else idx.push(a, c, b);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Rejilla de 1 m: 1 = huella del corredor (entre chaflanes), 2 = franja de margen que el corredor
 * también dibuja con terreno muestreado
 */
export class FootprintMask {
  private readonly cols: number;
  private readonly rows: number;
  private readonly grid: Uint8Array;

  constructor(
    private readonly minE: number,
    private readonly minN: number,
    maxE: number,
    maxN: number,
    private readonly res = 1,
  ) {
    this.cols = Math.ceil((maxE - minE) / res) + 1;
    this.rows = Math.ceil((maxN - minN) / res) + 1;
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  private at(e: number, n: number): number {
    const c = Math.floor((e - this.minE) / this.res);
    const r = Math.floor((n - this.minN) / this.res);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.grid[r * this.cols + c];
  }

  /** Dentro de la huella del corredor */
  has(e: number, n: number): boolean {
    return this.at(e, n) === 1;
  }

  /** Dentro de la huella o de su franja de margen */
  covered(e: number, n: number): boolean {
    return this.at(e, n) > 0;
  }

  /** Marca con `value` las celdas cuyo centro cae dentro del polígono [e0, n0, e1, n1, ...] (la huella prevalece sobre el margen) */
  fillPolygon(poly: number[], value: 1 | 2 = 1) {
    let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      e0 = Math.min(e0, poly[i]);
      e1 = Math.max(e1, poly[i]);
      n0 = Math.min(n0, poly[i + 1]);
      n1 = Math.max(n1, poly[i + 1]);
    }
    const c0 = Math.max(0, Math.floor((e0 - this.minE) / this.res));
    const c1 = Math.min(this.cols - 1, Math.floor((e1 - this.minE) / this.res));
    const r0 = Math.max(0, Math.floor((n0 - this.minN) / this.res));
    const r1 = Math.min(this.rows - 1, Math.floor((n1 - this.minN) / this.res));
    const m = poly.length / 2;
    for (let r = r0; r <= r1; r++) {
      const y = this.minN + (r + 0.5) * this.res;
      for (let c = c0; c <= c1; c++) {
        const x = this.minE + (c + 0.5) * this.res;
        let inside = false;
        for (let i = 0, j = m - 1; i < m; j = i++) {
          const xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        const k = r * this.cols + c;
        if (inside && (value === 1 || this.grid[k] === 0)) this.grid[k] = value;
      }
    }
  }
}
