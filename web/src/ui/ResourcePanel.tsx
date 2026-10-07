import { STATUS_LABEL, type Entity, type EntityType } from '../data/demo';
import { formatSta } from '../format';
import { useStore } from '../store';
import { TypeBadge } from './icons';
import { roadShortName } from './roads';

const GROUPS: { title: string; types: EntityType[] }[] = [
  { title: 'Equipos', types: ['excavadora', 'volqueta', 'motoniveladora', 'vibrocompactador'] },
  { title: 'Cuadrillas', types: ['cuadrilla'] },
  { title: 'Materiales', types: ['acopio'] },
];

export function ResourcePanel() {
  const entities = useStore((s) => s.entities);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const flyTo = useStore((s) => s.flyTo);
  const roadCount = useStore((s) => s.site?.roads.length ?? 1);

  const pick = (e: Entity) => {
    select(e.id);
    flyTo(e.roadId, e.sta, e.off);
  };

  return (
    <section className="card resources">
      <h2>Recursos en obra</h2>
      {GROUPS.map((g) => {
        const items = entities.filter((e) => g.types.includes(e.type));
        if (!items.length) return null;
        return (
          <div key={g.title} className="res-group">
            <h3>
              {g.title} <span>{items.length}</span>
            </h3>
            {items.map((e) => (
              <button key={e.id} className={`res-item${e.id === selectedId ? ' active' : ''}`} onClick={() => pick(e)}>
                <TypeBadge type={e.type} size={28} />
                <span className="res-text">
                  <strong>{e.code}</strong>
                  <small>{e.name}</small>
                </span>
                <span className="res-meta">
                  <span className={`dot ${e.status}`} title={STATUS_LABEL[e.status]} />
                  <small>
                    {roadCount > 1 && <b className="road-chip">{roadShortName(e.roadId)}</b>}
                    {formatSta(e.sta, 0)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
