/** Punto en planta. LandXML guarda las coordenadas como "Norte Este". */
export interface Pt {
  e: number;
  n: number;
}

export type Rotation = 'cw' | 'ccw';

export type GeomElement =
  | { kind: 'line'; length: number; start: Pt; end: Pt }
  | { kind: 'arc'; length: number; start: Pt; end: Pt; pi: Pt | null; center: Pt | null; radius: number; rot: Rotation }
  | {
      kind: 'spiral';
      length: number;
      start: Pt;
      end: Pt;
      pi: Pt | null;
      /** Infinity para tangente */
      radiusStart: number;
      radiusEnd: number;
      rot: Rotation;
    };

export interface Alignment {
  name: string;
  staStart: number;
  elements: GeomElement[];
}

export interface ProfileVertex {
  sta: number;
  elev: number;
  /** Longitud de curva vertical en el PVI (0 si no hay curva) */
  curveLength: number;
}

/** Polilínea 2D en arreglo plano [a0, b0, a1, b1, ...] */
export type Flat2D = Float64Array;

export interface CrossSection {
  sta: number;
  /** Superficies por nombre (normalizado, sin abscisa), como pares desplazamiento/cota */
  surfaces: Map<string, Flat2D>;
}

/** Un alineamiento con su rasante y sus secciones */
export interface AlignmentData {
  alignment: Alignment;
  /** Rasante (perfil de diseño) */
  profile: { name: string; pvis: ProfileVertex[] } | null;
  /** Perfiles de terreno (pares abscisa/cota) */
  groundProfiles: { name: string; points: Flat2D }[];
  sections: CrossSection[];
  /** Superficies de sección disponibles (sin listas de materiales) */
  surfaceNames: string[];
  /** Capas de material encontradas en las secciones (para fases posteriores) */
  materialNames: string[];
  designSpeed: number | null;
}

/** Superficie TIN: puntos [e, n, z, ...] y triángulos visibles [i, j, k, ...] (índices 0-based) */
export interface TinSurface {
  name: string;
  points: Float64Array;
  faces: Uint32Array;
}

export interface LandXmlProject {
  fileName: string;
  crs: { desc: string; epsg: string } | null;
  application: string | null;
  alignments: AlignmentData[];
  /** Superficie de terreno natural (TIN), si el archivo la trae */
  terrain: TinSurface | null;
  /** Nombres de todas las superficies TIN del archivo */
  tinNames: string[];
}
