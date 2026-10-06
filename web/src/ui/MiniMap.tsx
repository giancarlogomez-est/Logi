import { useMemo, useRef, type MouseEvent } from 'react';
import { useStore } from '../store';
import { Icon, TYPE_COLOR } from './icons';

/** Vista en planta de todo el eje, para ubicarse y saltar a un tramo */
export function MiniMap() {
  const world = useStore((s) => s.world)!;
  const entities = useStore((s) => s.entities);
  const viewSta = useStore((s) => s.viewSta);
  const viewDist = useStore((s) => s.viewDist);
  const flyTo = useStore((s) => s.flyTo);
  const svgRef = useRef<SVGSVGElement>(null);

  const geo = useMemo(() => {
    const { e, n } = world.samples;
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    for (let i = 0; i < e.length; i++) {
      minE = Math.min(minE, e[i]);
      maxE = Math.max(maxE, e[i]);
      minN = Math.min(minN, n[i]);
      maxN = Math.max(maxN, n[i]);
    }
    const size = Math.max(maxE - minE, maxN - minN);
    const pad = size * 0.06;
    const step = Math.max(1, Math.floor(e.length / 900));
    const pts: string[] = [];
    for (let i = 0; i < e.length; i += step) pts.push(`${(e[i] - minE).toFixed(1)},${(maxN - n[i]).toFixed(1)}`);
    return { minE, maxN, w: maxE - minE, h: maxN - minN, pad, size, path: pts.join(' ') };
  }, [world]);

  const xy = (sta: number, off = 0) => {
    const p = world.align.offsetPoint(sta, off);
    return { x: p.e - geo.minE, y: geo.maxN - p.n };
  };

  const half = Math.max(40, viewDist * 0.75);
  const windowPts: string[] = [];
  const a = Math.max(world.staStart, viewSta - half);
  const b = Math.min(world.staEnd, viewSta + half);
  for (let s = a; s <= b; s += Math.max(2, (b - a) / 60)) {
    const p = xy(s);
    windowPts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  const here = xy(viewSta);
  const start = xy(world.staStart);
  const end = xy(world.staEnd);
  const sw = geo.size / 90;

  const onClick = (ev: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const q = pt.matrixTransform(m.inverse());
    const st = world.projectEN(q.x + geo.minE, geo.maxN - q.y);
    flyTo(st.sta);
  };

  return (
    <section className="card minimap">
      <h2>
        <Icon name="map" /> Planta
      </h2>
      <svg
        ref={svgRef}
        viewBox={`${-geo.pad} ${-geo.pad} ${geo.w + 2 * geo.pad} ${geo.h + 2 * geo.pad}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={onClick}
      >
        <polyline points={geo.path} className="mm-axis" strokeWidth={sw * 2.2} />
        <polyline points={geo.path} className="mm-axis-inner" strokeWidth={sw} />
        <polyline points={windowPts.join(' ')} className="mm-window" strokeWidth={sw * 3} />
        {entities.map((e) => {
          const p = xy(e.sta);
          return <circle key={e.id} cx={p.x} cy={p.y} r={sw * 1.3} fill={TYPE_COLOR[e.type]} stroke="#fff" strokeWidth={sw * 0.4} />;
        })}
        <circle cx={here.x} cy={here.y} r={sw * 2.4} className="mm-here" strokeWidth={sw * 0.8} />
        <text x={start.x} y={start.y - sw * 3} className="mm-label" fontSize={sw * 5}>
          Inicio
        </text>
        <text x={end.x} y={end.y - sw * 3} className="mm-label" fontSize={sw * 5}>
          Fin
        </text>
      </svg>
    </section>
  );
}
