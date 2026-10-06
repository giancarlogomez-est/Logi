import type { CrossSection, Flat2D, GeomElement, LandXmlProject, ProfileVertex, Pt, Rotation } from './types';

const MATERIAL_PREFIX = /^Material List\s*-\s*(\(\d+\)\s*-\s*)?/i;

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

export function parseLandXml(text: string, fileName: string): LandXmlProject {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML válido.');
  if (doc.documentElement.localName !== 'LandXML') throw new Error('El archivo no es un LandXML.');

  const alignmentEl = Array.from(doc.getElementsByTagName('Alignment')).find((a) => child(a, 'CoordGeom'));
  if (!alignmentEl) throw new Error('El LandXML no contiene alineamientos con geometría horizontal (CoordGeom).');

  const elements = parseGeometry(child(alignmentEl, 'CoordGeom')!);
  if (!elements.length) throw new Error('El alineamiento no tiene elementos de geometría reconocibles.');

  // Perfiles
  let profile: LandXmlProject['profile'] = null;
  const groundProfiles: LandXmlProject['groundProfiles'] = [];
  const profileEl = child(alignmentEl, 'Profile');
  if (profileEl) {
    const pa = child(profileEl, 'ProfAlign');
    if (pa) profile = { name: pa.getAttribute('name') ?? '', pvis: parseProfAlign(pa) };
    for (const ps of children(profileEl, 'ProfSurf')) {
      const points = nums(child(ps, 'PntList2D')?.textContent);
      if (points.length >= 4) groundProfiles.push({ name: ps.getAttribute('name') ?? '', points });
    }
  }

  // Secciones transversales
  const sections: CrossSection[] = [];
  const surfaceNames = new Set<string>();
  const materialNames = new Set<string>();
  const csEl = child(alignmentEl, 'CrossSects');
  if (csEl) {
    for (const cs of children(csEl, 'CrossSect')) {
      const surfaces = new Map<string, Flat2D>();
      for (const s of children(cs, 'CrossSectSurf')) {
        const name = s.getAttribute('name') ?? '';
        if (MATERIAL_PREFIX.test(name)) {
          materialNames.add(name.replace(MATERIAL_PREFIX, ''));
          continue;
        }
        surfaceNames.add(name);
        surfaces.set(name, nums(child(s, 'PntList2D')?.textContent));
      }
      sections.push({ sta: num(cs.getAttribute('sta')), surfaces });
    }
    sections.sort((a, b) => a.sta - b.sta);
  }

  // Velocidad de diseño (Feature SpeedStation de Civil 3D)
  let designSpeed: number | null = null;
  for (const f of children(alignmentEl, 'Feature')) {
    const sp = children(f, 'Property').find((p) => p.getAttribute('label') === 'speed');
    if (sp) {
      designSpeed = num(sp.getAttribute('value'));
      break;
    }
  }

  const crsEl = doc.getElementsByTagName('CoordinateSystem')[0];
  const appEl = doc.getElementsByTagName('Application')[0];

  return {
    fileName,
    crs: crsEl ? { desc: crsEl.getAttribute('desc') ?? '', epsg: crsEl.getAttribute('epsgCode') ?? '' } : null,
    application: appEl ? `${appEl.getAttribute('name') ?? ''} ${appEl.getAttribute('version') ?? ''}`.trim() : null,
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

/** Elige superficies de terreno y de diseño por nombre (el usuario puede cambiarlas). */
export function guessSurfaces(names: string[]): { terrain: string; design: string } {
  const design = names.find((n) => /pave|top|rasante|final|datum|corona/i.test(n)) ?? '';
  const terrain =
    names.find((n) => n !== design && /dtm|\beg\b|exist|terreno|\btn\b|natural|ground/i.test(n) && !/\(des\)|descapote/i.test(n)) ??
    names.find((n) => n !== design) ??
    '';
  return { terrain, design };
}
