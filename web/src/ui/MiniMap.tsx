import { useMemo, useRef, type MouseEvent } from 'react';
import { useActiveRoad, useStore } from '../store';
import { Icon, TYPE_COLOR } from './icons';
import { ROAD_COLORS } from './roads';

/** Vista en planta de todas las vías, para ubicarse y saltar a un tramo */
export function MiniMap() {
  const site = useStore((s) => s.site)!;
  const active = useActiveRoad()!;
  const entities = useStore((s) => s.entities);
  const viewSta = useStore((s) => s.viewSta);
  const viewDist = useStore((s) => s.viewDist);
  const flyTo = useStore((s) => s.flyTo);
  const svgRef = useRef<SVGSVGElement>(null);

  const geo = useMemo(() => {
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    for (const r of site.roads) {
      const { e, n } = r.samples;
      for (let i = 0; i < e.length; i++) {
        minE = Math.min(minE, e[i]);
        maxE = Math.max(maxE, e[i]);
        minN = Math.min(minN, n[i]);
        maxN = Math.max(maxN, n[i]);
      }
    }
    const size = Math.max(maxE - minE, maxN - minN);
    const pad = size * 0.06;
    const paths = site.roads.map((r) => {
      const { e, n } = r.samples;
      const step = Math.max(1, Math.floor(e.length / 900));
      const pts: string[] = [];
      for (let i = 0; i < e.length; i += step) pts.push(`${(e[i] - minE).toFixed(1)},${(maxN - n[i]).toFixed(1)}`);
      return pts.join(' ');
    });
    return { minE, maxN, w: maxE - minE, h: maxN - minN, pad, size, paths };
  }, [site]);

  const xy = (roadId: number, sta: number) => {
    const p = site.roads[roadId].align.evaluate(sta);
    return { x: p.e - geo.minE, y: geo.maxN - p.n };
  };

  const half = Math.max(40, viewDist * 0.75);
  const windowPts: string[] = [];
  const a = Math.max(active.staStart, viewSta - half);
  const b = Math.min(active.staEnd, viewSta + half);
  for (let s = a; s <= b; s += Math.max(2, (b - a) / 60)) {
    const p = xy(active.id, s);
    windowPts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  const here = xy(active.id, viewSta);
  const sw = geo.size / 90;
  const multi = site.roads.length > 1;

  const onClick = (ev: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const q = pt.matrixTransform(m.inverse());
    const e = q.x + geo.minE;
    const n = geo.maxN - q.y;
    let best = { id: 0, sta: 0, d: Infinity };
    for (const r of site.roads) {
      const st = r.projectEN(e, n);
      if (Math.abs(st.off) < best.d) best = { id: r.id, sta: st.sta, d: Math.abs(st.off) };
    }
    flyTo(best.id, best.sta);
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
        {geo.paths.map((d, i) => (
          <g key={i}>
            <polyline points={d} className="mm-axis" strokeWidth={sw * 2.2} />
            <polyline
              points={d}
              className="mm-axis-inner"
              strokeWidth={sw * (i === active.id ? 1.2 : 0.8)}
              style={multi ? { stroke: ROAD_COLORS[i % ROAD_COLORS.length], opacity: i === active.id ? 1 : 0.55 } : undefined}
            />
          </g>
        ))}
        <polyline points={windowPts.join(' ')} className="mm-window" strokeWidth={sw * 3} />
        {entities.map((e) => {
          const p = xy(e.roadId, e.sta);
          return <circle key={e.id} cx={p.x} cy={p.y} r={sw * 1.3} fill={TYPE_COLOR[e.type]} stroke="#fff" strokeWidth={sw * 0.4} />;
        })}
        <circle cx={here.x} cy={here.y} r={sw * 2.4} className="mm-here" strokeWidth={sw * 0.8} />
        {site.roads.map((r) => {
          const s = xy(r.id, r.staStart);
          const f = xy(r.id, r.staEnd);
          return (
            <g key={r.id}>
              <text x={s.x} y={s.y - sw * 3} className="mm-label" fontSize={sw * 5}>
                {r.id === 0 ? 'Inicio' : ''}
              </text>
              <text x={f.x} y={f.y - sw * 3} className="mm-label" fontSize={sw * 5}>
                {r.id === 0 ? 'Fin' : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
