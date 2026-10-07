import type { AlignmentData, CrossSection, Flat2D, GeomElement, LandXmlProject, ProfileVertex, Pt, Rotation, TinSurface } from './types';

const MATERIAL_PREFIX = /^Material List\s*-\s*(\(\d+\)\s*-\s*)?/i;
/** "SL-ORIENTAL - K0+010.00 - COR-ORIENTAL COR-ORIENTAL-TOP(1160)" → "COR-ORIENTAL COR-ORIENTAL-TOP" */
const SAMPLE_LINE_PREFIX = /^.*? - (?:[A-Za-z]+ )?K?\d+\+[\d.]+ - /;
const ID_SUFFIX = /\(\d+\)$/;

function num(s: string | null | undefined): number {
  if (s == null) return NaN;
  const t = s.trim().toUpperCase();
  if (t === 'INF' || t === 'INFINITY') return Infinity;
  return parseFloat(t);
}

function nums(s: string | null | undefined): Float64Array {
  if (!s) return new Float64Array();
  const parts = s.trim().split(/\s+/);
  const out = new Float64Array(parts.length);
  for (let i = 0; i < parts.length; i++) out[i] = parseFloat(parts[i]);
  return out;
}

function children(el: Element, tag?: string): Element[] {
  return Array.from(el.children).filter((c) => !tag || c.localName === tag);
}

function child(el: Element, tag: string): Element | undefined {
  return children(el, tag)[0];
}

/** LandXML: "Norte Este [Cota]" */
function pt(el: Element | undefined): Pt | null {
  if (!el) return null;
  const v = nums(el.textContent);
  if (v.length < 2) return null;
  return { n: v[0], e: v[1] };
}

function rot(el: Element): Rotation {
  return el.getAttribute('rot') === 'ccw' ? 'ccw' : 'cw';
}

function parseGeometry(coordGeom: Element): GeomElement[] {
  const out: GeomElement[] = [];
  for (const el of children(coordGeom)) {
    const start = pt(child(el, 'Start'));
    const end = pt(child(el, 'End'));
    const length = num(el.getAttribute('length'));
    if (!start || !end) continue;
    switch (el.localName) {
      case 'Line':
        out.push({ kind: 'line', start, end, length: Number.isFinite(length) ? length : Math.hypot(end.e - start.e, end.n - start.n) });
        break;
      case 'Curve':
        out.push({
          kind: 'arc',
          start,
          end,
          length,
          pi: pt(child(el, 'PI')),
          center: pt(child(el, 'Center')),
          radius: num(el.getAttribute('radius')),
          rot: rot(el),
        });
        break;
      case 'Spiral':
        out.push({
          kind: 'spiral',
          start,
          end,
          length,
          pi: pt(child(el, 'PI')),
          radiusStart: num(el.getAttribute('radiusStart')),
          radiusEnd: num(el.getAttribute('radiusEnd')),
          rot: rot(el),
        });
        break;
      default:
        console.warn(`[LandXML] Elemento de alineamiento no soportado: ${el.localName}`);
    }
  }
  return out;
}

function parseProfAlign(el: Element): ProfileVertex[] {
  const pvis: ProfileVertex[] = [];
  for (const c of children(el)) {
    const v = nums(c.textContent);
    if (v.length < 2) continue;
    let curveLength = 0;
    if (c.localName === 'ParaCurve' || c.localName === 'CircCurve') curveLength = num(c.getAttribute('length')) || 0;
    else if (c.localName === 'UnsymParaCurve')
      curveLength = (num(c.getAttribute('lengthIn')) || 0) + (num(c.getAttribute('lengthOut')) || 0);
    pvis.push({ sta: v[0], elev: v[1], curveLength });
  }
  return pvis.sort((a, b) => a.sta - b.sta);
}

function parseAlignment(alignmentEl: Element): AlignmentData | null {
  const coordGeom = child(alignmentEl, 'CoordGeom');
  if (!coordGeom) return null;
  const elements = parseGeometry(coordGeom);
  if (!elements.length) return null;

  let profile: AlignmentData['profile'] = null;
  const groundProfiles: AlignmentData['groundProfiles'] = [];
  const profileEl = child(alignmentEl, 'Profile');
  if (profileEl) {
    const pa = child(profileEl, 'ProfAlign');
    if (pa) profile = { name: pa.getAttribute('name') ?? '', pvis: parseProfAlign(pa) };
    for (const ps of children(profileEl, 'ProfSurf')) {
      const points = nums(child(ps, 'PntList2D')?.textContent);
      if (points.length >= 4) groundProfiles.push({ name: ps.getAttribute('name') ?? '', points });
    }
  }

  const sections: CrossSection[] = [];
  const surfaceNames = new Set<string>();
  const materialNames = new Set<string>();
  const csEl = child(alignmentEl, 'CrossSects');
  if (csEl) {
    for (const cs of children(csEl, 'CrossSect')) {
      const surfaces = new Map<string, Flat2D>();
      for (const s of children(cs, 'CrossSectSurf')) {
        const raw = s.getAttribute('name') ?? '';
        if (MATERIAL_PREFIX.test(raw)) {
          materialNames.add(raw.replace(MATERIAL_PREFIX, ''));
          continue;
        }
        const name = raw.replace(SAMPLE_LINE_PREFIX, '').replace(ID_SUFFIX, '').trim();
        surfaceNames.add(name);
        surfaces.set(name, nums(child(s, 'PntList2D')?.textContent));
      }
      if (surfaces.size) sections.push({ sta: num(cs.getAttribute('sta')), surfaces });
    }
    sections.sort((a, b) => a.sta - b.sta);
  }

  let designSpeed: number | null = null;
  for (const f of children(alignmentEl, 'Feature')) {
    const sp = children(f, 'Property').find((p) => p.getAttribute('label') === 'speed');
    if (sp) {
      designSpeed = num(sp.getAttribute('value'));
      break;
    }
  }

  return {
    alignment: {
      name: alignmentEl.getAttribute('name') ?? 'Alineamiento',
      staStart: num(alignmentEl.getAttribute('staStart')) || 0,
      elements,
    },
    profile,
    groundProfiles,
    sections,
    surfaceNames: [...surfaceNames],
    materialNames: [...materialNames],
    designSpeed,
  };
}

/** Quita un bloque <tag>…</tag> del texto (para no construir un DOM de cientos de MB) */
function cutBlock(text: string, tag: string): { rest: string; block: string } {
  const a = text.indexOf(`<${tag}`);
  if (a < 0) return { rest: text, block: '' };
  const closeTag = `</${tag}>`;
  const b = text.indexOf(closeTag, a);
  if (b < 0) return { rest: text, block: '' };
  return { rest: text.slice(0, a) + text.slice(b + closeTag.length), block: text.slice(a, b + closeTag.length) };
}

/** Lee una superficie TIN con expresiones regulares (mucho más rápido que el DOM para cientos de miles de puntos) */
function parseTin(block: string, name: string): TinSurface {
  const ids = new Map<number, number>();
  const pts: number[] = [];
  const pRe = /<P id="(\d+)"[^>]*>([^<]*)<\/P>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(block))) {
    const v = m[2].trim().split(/\s+/);
    ids.set(Number(m[1]), pts.length / 3);
    pts.push(parseFloat(v[1]), parseFloat(v[0]), parseFloat(v[2])); // N E Z → e, n, z
  }
  const faces: number[] = [];
  const fRe = /<F([^>]*)>([^<]*)<\/F>/g;
  while ((m = fRe.exec(block))) {
    if (/\bi="1"/.test(m[1])) continue; // cara invisible (fuera del borde)
    const v = m[2].trim().split(/\s+/);
    const a = ids.get(Number(v[0]));
    const b = ids.get(Number(v[1]));
    const c = ids.get(Number(v[2]));
    if (a !== undefined && b !== undefined && c !== undefined) faces.push(a, b, c);
  }
  return { name, points: Float64Array.from(pts), faces: Uint32Array.from(faces) };
}

/** Superficie de terreno natural entre las TIN del archivo (las de corredor se ignoran) */
export function guessTerrainTin(names: string[]): string | null {
  const isCorridor = (n: string) => /top|datum|cor-|corredor|pave|rasante/i.test(n);
  return (
    names.find((n) => !isCorridor(n) && /\btn\b|tn-|terreno|exist|\beg\b|dtm|natural|ground|topo/i.test(n)) ??
    names.find((n) => !isCorridor(n)) ??
    null
  );
}

/** Parte pesada y sin DOM (apta para Web Worker): separa superficies y corredores, y lee el TIN de terreno */
export interface SplitLandXml {
  /** XML reducido: sin <Surfaces>, <Roadways> ni capas de diseño por sección */
  xml: string;
  terrain: TinSurface | null;
  tinNames: string[];
}

export function splitLandXml(text: string): SplitLandXml {
  const surfacesCut = cutBlock(text, 'Surfaces');
  const xml = cutBlock(surfacesCut.rest, 'Roadways').rest.replace(/<DesignCrossSectSurf[\s\S]*?<\/DesignCrossSectSurf>/g, '');

  const tinNames: string[] = [];
  const tinBlocks = new Map<string, string>();
  const sRe = /<Surface\s[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/Surface>/g;
  let m: RegExpExecArray | null;
  while ((m = sRe.exec(surfacesCut.block))) {
    tinNames.push(m[1]);
    tinBlocks.set(m[1], m[2]);
  }
  const terrainName = guessTerrainTin(tinNames);
  const terrain = terrainName ? parseTin(tinBlocks.get(terrainName)!, terrainName) : null;
  return { xml, terrain: terrain && terrain.faces.length ? terrain : null, tinNames };
}

export function parseLandXml(split: SplitLandXml, fileName: string): LandXmlProject {
  const { xml, terrain, tinNames } = split;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML válido.');
  if (doc.documentElement.localName !== 'LandXML') throw new Error('El archivo no es un LandXML.');

  const alignments = Array.from(doc.getElementsByTagName('Alignment'))
    .map(parseAlignment)
    .filter((a): a is AlignmentData => a !== null);
  if (!alignments.length) throw new Error('El LandXML no contiene alineamientos con geometría horizontal (CoordGeom).');

  const crsEl = doc.getElementsByTagName('CoordinateSystem')[0];
  const appEl = doc.getElementsByTagName('Application')[0];

  return {
    fileName,
    crs: crsEl ? { desc: crsEl.getAttribute('desc') ?? '', epsg: crsEl.getAttribute('epsgCode') ?? '' } : null,
    application: appEl ? `${appEl.getAttribute('name') ?? ''} ${appEl.getAttribute('version') ?? ''}`.trim() : null,
    alignments,
    terrain,
    tinNames,
  };
}

/** Elige superficies de terreno y de diseño de las secciones por nombre (el usuario puede cambiarlas). */
export function guessSurfaces(names: string[]): { terrain: string; design: string } {
  const design = names.find((n) => /pave|top|rasante|final|corona/i.test(n)) ?? names.find((n) => /datum/i.test(n)) ?? '';
  const terrain =
    names.find(
      (n) =>
        n !== design &&
        /dtm|\beg\b|exist|terreno|\btn\b|natural|ground/i.test(n) &&
        !/\(des\)|descapote|datum|top|pave/i.test(n),
    ) ?? '';
  return { terrain, design };
}
