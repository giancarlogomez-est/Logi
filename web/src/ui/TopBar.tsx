import { useRef, useState } from 'react';
import { fmt, formatSta, parseSta } from '../format';
import { useStore } from '../store';
import { Icon, Logo } from './icons';

export function TopBar() {
  const world = useStore((s) => s.world)!;
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

  const go = () => {
    const sta = parseSta(query);
    if (sta === null || sta < world.staStart || sta > world.staEnd) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 900);
      return;
    }
    flyTo(sta);
  };

  return (
    <header className="topbar card">
      <div className="brand">
        <Logo />
        <span>Logi</span>
      </div>
      <button className="project-pill" onClick={() => setShowInfo(true)} title="Información del proyecto">
        <span className="pill-badge">{world.project.crs?.epsg ? `EPSG ${world.project.crs.epsg}` : 'LandXML'}</span>
        <span className="pill-text">
          <strong>{world.align.name}</strong>
          <small>
            {formatSta(world.staStart, 0)} – {formatSta(world.staEnd, 0)} · {world.sections.length} secciones
          </small>
        </span>
        <Icon name="info" />
      </button>
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
        <Kpi icon="road" label="Longitud" value={`${fmt(world.align.length / 1000, 2)} km`} sub={world.project.designSpeed ? `Vd ${world.project.designSpeed} km/h` : undefined} />
        <Kpi icon="people" label="Personal en obra" value={fmt(people)} sub={`${entities.filter((e) => e.type === 'cuadrilla').length} cuadrillas`} />
        <Kpi icon="machine" label="Equipos operando" value={`${active}/${machines.length}`} sub={`${machines.length - active} detenidos`} />
        <Kpi icon="pin" label="En vista" value={formatSta(viewSta, 0)} />
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
          if (f) loadFile(f);
          e.target.value = '';
        }}
      />
      <button className="btn primary" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" /> Cargar LandXML
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
