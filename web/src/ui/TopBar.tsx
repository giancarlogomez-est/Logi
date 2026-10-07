import { useRef, useState } from 'react';
import { fmt, formatSta, parseSta } from '../format';
import { useActiveRoad, useStore } from '../store';
import { Icon, Logo } from './icons';
import { ROAD_COLORS, shortName } from './roads';

export function TopBar() {
  const site = useStore((s) => s.site)!;
  const road = useActiveRoad()!;
  const entities = useStore((s) => s.entities);
  const viewSta = useStore((s) => s.viewSta);
  const flyTo = useStore((s) => s.flyTo);
  const loadFile = useStore((s) => s.loadFile);
  const setShowInfo = useStore((s) => s.setShowInfo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [invalid, setInvalid] = useState(false);

  const machines = entities.filter((e) => e.type !== 'cuadrilla' && e.type !== 'acopio');
  const active = machines.filter((e) => e.status === 'operando').length;
  const people = entities.reduce((n, e) => n + e.people, 0);
  const totalLength = site.roads.reduce((n, r) => n + r.align.length, 0);
  const speed = road.data.designSpeed;

  const go = () => {
    const sta = parseSta(query);
    if (sta === null || sta < road.staStart || sta > road.staEnd) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 900);
      return;
    }
    flyTo(road.id, sta);
  };

  /** Cambiar de calzada manteniendo la abscisa (si existe en la otra) */
  const switchRoad = (id: number) => {
    const r = site.roads[id];
    flyTo(id, Math.min(Math.max(viewSta, r.staStart), r.staEnd));
  };

  return (
    <header className="topbar card">
      <div className="brand">
        <Logo />
        <span>Logi</span>
      </div>
      <button className="project-pill" onClick={() => setShowInfo(true)} title="Información del proyecto">
        <span className="pill-badge">{site.project.crs?.epsg ? `EPSG ${site.project.crs.epsg}` : site.tin ? 'TIN' : 'LandXML'}</span>
        <span className="pill-text">
          <strong>{site.roads.length > 1 ? site.project.fileName.replace(/\.xml$/i, '') : road.name}</strong>
          <small>
            {site.roads.length > 1 ? `${site.roads.length} calzadas · ` : ''}
            {formatSta(road.staStart, 0)} – {formatSta(road.staEnd, 0)} · {road.sections.length} secciones
          </small>
        </span>
        <Icon name="info" />
      </button>
      {site.roads.length > 1 && (
        <div className="road-switch" role="tablist" aria-label="Calzada activa">
          {site.roads.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === road.id}
              className={r.id === road.id ? 'active' : ''}
              onClick={() => switchRoad(r.id)}
              title={r.name}
            >
              <i style={{ background: ROAD_COLORS[r.id % ROAD_COLORS.length] }} />
              {shortName(r.name, r.id)}
            </button>
          ))}
        </div>
      )}
      <form
        className={`search${invalid ? ' invalid' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <Icon name="search" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ir a abscisa… ej. K3+500" />
        <kbd>↵</kbd>
      </form>
      <div className="kpis">
        <Kpi
          icon="road"
          label="Longitud"
          value={`${fmt(totalLength / 1000, 2)} km`}
          sub={site.roads.length > 1 ? `${site.roads.length} calzadas` : speed ? `Vd ${speed} km/h` : undefined}
        />
        <Kpi icon="people" label="Personal en obra" value={fmt(people)} sub={`${entities.filter((e) => e.type === 'cuadrilla').length} cuadrillas`} />
        <Kpi icon="machine" label="Equipos operando" value={`${active}/${machines.length}`} sub={`${machines.length - active} detenidos`} />
        <Kpi icon="pin" label="En vista" value={formatSta(viewSta, 0)} sub={site.roads.length > 1 ? shortName(road.name, road.id) : undefined} />
      </div>
      <div className="live">
        <span className="live-dot" /> Demo
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.landxml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f, f.name);
          e.target.value = '';
        }}
      />
      <button className="btn primary" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" /> <span>Cargar LandXML</span>
      </button>
    </header>
  );
}

function Kpi({ icon, label, value, sub }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-icon">
        <Icon name={icon} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        {sub && <em>{sub}</em>}
      </span>
    </div>
  );
}
