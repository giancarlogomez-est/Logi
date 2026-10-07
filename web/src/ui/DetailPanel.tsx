import { STATUS_LABEL, TYPE_LABEL } from '../data/demo';
import { fmt, formatOffset, formatSta } from '../format';
import { useStore } from '../store';
import { Icon, TypeBadge } from './icons';

export function DetailPanel() {
  const ent = useStore((s) => s.entities.find((e) => e.id === s.selectedId));
  const site = useStore((s) => s.site)!;
  const select = useStore((s) => s.select);
  const flyTo = useStore((s) => s.flyTo);
  if (!ent) return null;
  const road = site.roads[ent.roadId];

  const z = road.surfaceZ(ent.sta, ent.off);
  const zt = road.terrainZ(ent.sta, ent.off);
  const p = road.align.offsetPoint(ent.sta, ent.off);

  return (
    <aside className="card detail">
      <header>
        <TypeBadge type={ent.type} />
        <div className="detail-title">
          <small>
            {TYPE_LABEL[ent.type]} · {ent.code}
          </small>
          <strong>{ent.name}</strong>
        </div>
        <button className="icon-btn" title="Centrar en el mapa" onClick={() => flyTo(ent.roadId, ent.sta, ent.off)}>
          <Icon name="focus" />
        </button>
        <button className="icon-btn" title="Cerrar" onClick={() => select(null)}>
          <Icon name="close" />
        </button>
      </header>

      <div className={`status-chip ${ent.status}`}>
        <span className={`dot ${ent.status}`} />
        {STATUS_LABEL[ent.status]}
        <span className="status-activity">{ent.activity}</span>
      </div>

      <div className="station-box">
        <div>
          <small>Abscisa</small>
          <strong>{formatSta(ent.sta, 2)}</strong>
        </div>
        <div>
          <small>Desplazamiento</small>
          <strong>{formatOffset(ent.off)}</strong>
        </div>
        <div>
          <small>Cota</small>
          <strong>{fmt(z, 2)}</strong>
        </div>
      </div>
      {Math.abs(z - zt) > 0.3 && (
        <p className="hint-line">
          {z > zt ? 'Relleno' : 'Corte'} de {fmt(Math.abs(z - zt), 2)} m respecto al terreno natural
        </p>
      )}

      {ent.level && (
        <div className="level">
          <div className="level-head">
            <small>{ent.level.label}</small>
            <small>{Math.round(ent.level.value * 100)} %</small>
          </div>
          <div className="bar">
            <span style={{ width: `${ent.level.value * 100}%` }} className={ent.level.value < 0.3 ? 'low' : ''} />
          </div>
        </div>
      )}

      <dl>
        {ent.details.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {site.roads.length > 1 && (
          <div>
            <dt>Calzada</dt>
            <dd>{road.name}</dd>
          </div>
        )}
        <div>
          <dt>Coordenadas</dt>
          <dd>
            N {fmt(p.n, 2)} · E {fmt(p.e, 2)}
          </dd>
        </div>
      </dl>

      <p className="hint">
        <Icon name="move" size={14} /> Arrastra la ficha en el mapa para moverla a otro frente: la abscisa se calcula sobre el eje.
      </p>
    </aside>
  );
}
