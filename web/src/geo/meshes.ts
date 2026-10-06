import { BufferAttribute, BufferGeometry, Color } from 'three';
import { interp, type BuiltSection } from './sections';
import type { World } from './world';

const COLORS = {
  terrain: new Color('#9cc48a'),
  terrainDark: new Color('#7fae72'),
  cut: new Color('#d2ab80'),
  fill: new Color('#bfb487'),
  platform: new Color('#d6d9de'),
  skirt: new Color('#b08d6e'),
};

/** Ancho del carril para la demarcación de borde (si la calzada es más ancha, lo demás es berma) */
const LANE_WIDTH = 3.65;

interface Frame {
  e: number;
  n: number;
  s: number; // sin θ
  c: number; // cos θ
}

function frames(world: World): Frame[] {
  return world.sections.map((sec) => {
    const p = world.align.evaluate(sec.sta);
    return { e: p.e, n: p.n, s: Math.sin(p.theta), c: Math.cos(p.theta) };
  });
}

function linspace(a: number, b: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => a + ((b - a) * i) / (count - 1));
}

/** Pequeña variación de color determinística para el acabado low-poly */
function jitter(i: number, j: number) {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

class GridBuilder {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  constructor(
    private world: World,
    private fr: Frame[],
  ) {}

  vertex(i: number, off: number, y: number, color: Color) {
    const f = this.fr[i];
    const { origin } = this.world;
    this.pos.push(f.e + off * f.s - origin.e, y - origin.z, -(f.n - off * f.c - origin.n));
    this.col.push(color.r, color.g, color.b);
  }

  /** Une filas consecutivas de `cols` vértices (filas = secciones, columnas = desplazamiento ascendente) */
  quads(rows: number, cols: number, base: number) {
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = base + r * cols + c;
        const b = a + 1;
        const d = a + cols;
        this.idx.push(a, b, d, b, d + 1, d);
      }
    }
  }

  geometry(withColor = true) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    if (withColor) g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

type Zone = 'terrain' | 'slope' | 'platform';

/** Columnas de un costado: zonas separadas con vértices duplicados en los límites para bordes nítidos */
function sideColumns(sec: BuiltSection, side: 'L' | 'R'): { o: number; zone: Zone }[] {
  const tMin = sec.terrain.o[0];
  const tMax = sec.terrain.o[sec.terrain.o.length - 1];
  const zones: [number, number, number, Zone][] =
    side === 'L'
      ? [
          [tMin, sec.dayL, 14, 'terrain'],
          [sec.dayL, sec.platL, 6, 'slope'],
          [sec.platL, sec.cwL, 4, 'platform'],
        ]
      : [
          [sec.cwR, sec.platR, 4, 'platform'],
          [sec.platR, sec.dayR, 6, 'slope'],
          [sec.dayR, tMax, 14, 'terrain'],
        ];
  return zones.flatMap(([a, b, n, zone]) => linspace(a, b, n).map((o) => ({ o, zone })));
}

export function buildGroundGeometry(world: World): BufferGeometry {
  const fr = frames(world);
  const gb = new GridBuilder(world, fr);
  const rows = world.sections.length;
  const tmp = new Color();
  for (const side of ['L', 'R'] as const) {
    const base = gb.pos.length / 3;
    let cols = 0;
    world.sections.forEach((sec, i) => {
      const columns = sideColumns(sec, side);
      cols = columns.length;
      columns.forEach(({ o, zone }, j) => {
        const z = interp(sec.combined, o);
        if (zone === 'terrain') tmp.copy(COLORS.terrain).lerp(COLORS.terrainDark, jitter(i, j) * 0.55);
        else if (zone === 'platform') tmp.copy(COLORS.platform);
        else tmp.copy(z < interp(sec.terrain, o) - 0.05 ? COLORS.cut : COLORS.fill);
        gb.vertex(i, o, z, tmp);
      });
    });
    gb.quads(rows, cols, base);
  }

  // Faldón inferior en los bordes (efecto maqueta)
  for (const side of ['L', 'R'] as const) {
    const base = gb.pos.length / 3;
    world.sections.forEach((sec, i) => {
      const o = side === 'L' ? sec.combined.o[0] : sec.combined.o[sec.combined.o.length - 1];
      const z = interp(sec.combined, o);
      const pair: [number, number] = side === 'L' ? [z - 8, z] : [z, z - 8];
      for (const y of pair) gb.vertex(i, o, y, COLORS.skirt);
    });
    gb.quads(rows, 2, base);
  }
  return gb.geometry();
}

export function buildRoadGeometry(world: World): BufferGeometry {
  const gb = new GridBuilder(world, frames(world));
  world.sections.forEach((sec, i) => {
    for (const o of [sec.cwL, 0, sec.cwR]) gb.vertex(i, o, interp(sec.combined, o), COLORS.platform);
  });
  gb.quads(world.sections.length, 3, 0);
  return gb.geometry(false);
}

/** Línea de demarcación como cinta sobre la calzada. `pick` da el desplazamiento del eje de la línea por sección. */
export function buildMarkingGeometry(world: World, pick: (sec: BuiltSection) => number, width = 0.15): BufferGeometry {
  const gb = new GridBuilder(world, frames(world));
  world.sections.forEach((sec, i) => {
    const c = pick(sec);
    for (const o of [c - width / 2, c + width / 2]) gb.vertex(i, o, interp(sec.combined, o) + 0.02, COLORS.platform);
  });
  gb.quads(world.sections.length, 2, 0);
  return gb.geometry(false);
}

export const edgeLineLeft = (sec: BuiltSection) => (sec.cwL < -(LANE_WIDTH + 0.5) ? -LANE_WIDTH : sec.cwL + 0.15);
export const edgeLineRight = (sec: BuiltSection) => (sec.cwR > LANE_WIDTH + 0.5 ? LANE_WIDTH : sec.cwR - 0.15);
