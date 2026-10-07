import { useMemo, useRef, useState } from 'react';
import { fmt, formatSta } from '../format';
import { useActiveRoad, useStore } from '../store';
import { Icon, TYPE_COLOR } from './icons';

const W = 1000;
const H = 100;

/** Perfil longitudinal (terreno + rasante) como navegador de la obra */
export function ProfileBar() {
  const road = useActiveRoad()!;
  const allEntities = useStore((s) => s.entities);
  const entities = allEntities.filter((e) => e.roadId === road.id);
  const multi = useStore((s) => (s.site?.roads.length ?? 1) > 1);
  const viewSta = useStore((s) => s.viewSta);
  const viewDist = useStore((s) => s.viewDist);
  const selectedId = useStore((s) => s.selectedId);
  const flyTo = useStore((s) => s.flyTo);
  const select = useStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { staStart, staEnd } = road;
  const len = staEnd - staStart;

  const data = useMemo(() => {
    const N = 800;
    const sta: number[] = [];
    const ras: number[] = [];
    const ter: number[] = [];
    for (let i = 0; i <= N; i++) {
      const s = staStart + (len * i) / N;
      sta.push(s);
      ras.push(road.rasante(s));
      ter.push(road.terrainZ(s, 0));
    }
    const min = Math.min(...ras, ...ter);
    const max = Math.max(...ras, ...ter);
    const pad = (max - min) * 0.08 || 1;
    const y = (z: number) => H - 6 - ((z - (min - pad)) / (max - min + 2 * pad)) * (H - 12);
    const x = (s: number) => ((s - staStart) / len) * W;
    const line = (arr: number[]) => arr.map((z, i) => `${i ? 'L' : 'M'}${x(sta[i]).toFixed(1)},${y(z).toFixed(2)}`).join('');
    return { terrainArea: `${line(ter)}L${W},${H}L0,${H}Z`, terrain: line(ter), rasante: line(ras), min, max };
  }, [road, staStart, len]);

  const pct = (s: number) => `${((s - staStart) / len) * 100}%`;
  const staAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return staStart + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * len;
  };
  const half = Math.min(len / 2, Math.max(40, viewDist * 0.75));
  const ticks: number[] = [];
  const tickStep = len > 20000 ? 5000 : len > 6000 ? 1000 : len > 2000 ? 500 : 100;
  for (let s = Math.ceil(staStart / tickStep) * tickStep; s <= staEnd; s += tickStep) ticks.push(s);

  const hz = hover !== null ? { r: road.rasante(hover), t: road.terrainZ(hover, 0) } : null;

  return (
    <section className="card profile">
      <header>
        <h2>
          <Icon name="layers" /> Perfil longitudinal{multi && <span className="profile-road">{road.name}</span>}
        </h2>
        <span className="legend">
          <i className="lg-terrain" /> Terreno natural
          <i className="lg-rasante" /> Rasante
          <i className="lg-view" /> En vista
        </span>
        <span className="profile-range">
          Cotas {fmt(data.min, 0)} – {fmt(data.max, 0)} m
        </span>
      </header>
      <div
        className="profile-plot"
        ref={ref}
        onMouseMove={(e) => setHover(staAt(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => flyTo(road.id, staAt(e.clientX))}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <path d={data.terrainArea} className="p-area" />
          <path d={data.terrain} className="p-terrain" vectorEffect="non-scaling-stroke" />
          <path d={data.rasante} className="p-rasante" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="p-window" style={{ left: pct(Math.max(staStart, viewSta - half)), width: `${((Math.min(staEnd, viewSta + half) - Math.max(staStart, viewSta - half)) / len) * 100}%` }} />
        {entities.map((e) => (
          <button
            key={e.id}
            className={`p-marker${e.id === selectedId ? ' active' : ''}`}
            style={{ left: pct(e.sta), background: TYPE_COLOR[e.type] }}
            title={`${e.code} · ${formatSta(e.sta, 0)}`}
            onClick={(ev) => {
              ev.stopPropagation();
              select(e.id);
              flyTo(e.roadId, e.sta, e.off);
            }}
          />
        ))}
        {hover !== null && hz && (
          <>
            <div className="p-cursor" style={{ left: pct(hover) }} />
            <div className={`p-tip${(hover - staStart) / len > 0.8 ? ' left' : ''}`} style={{ left: pct(hover) }}>
              <strong>{formatSta(hover, 0)}</strong>
              <span>Rasante {fmt(hz.r, 2)}</span>
              <span>Terreno {fmt(hz.t, 2)}</span>
              <span className={hz.r > hz.t ? 'fill' : 'cut'}>
                {hz.r > hz.t ? 'Relleno' : 'Corte'} {fmt(Math.abs(hz.r - hz.t), 2)} m
              </span>
            </div>
          </>
        )}
      </div>
      <div className="p-ticks">
        {ticks.map((s) => (
          <span key={s} style={{ left: pct(s) }}>
            {formatSta(s, 0)}
          </span>
        ))}
      </div>
    </section>
  );
}
