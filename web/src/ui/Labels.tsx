import { formatSta } from '../format';
import type { Road } from '../geo/world';
import { useActiveRoad, useStore } from '../store';

export const LABELS_LAYER_ID = 'labels-layer';

/** Abscisas a mostrar alrededor de la vista: cada 100, 500 o 1000 m según el zoom */
export function visibleStations(road: Road, viewSta: number, viewDist: number): number[] {
  const step = viewDist > 2500 ? 1000 : viewDist > 900 ? 500 : 100;
  const span = Math.max(500, viewDist * 2.5);
  const list: number[] = [];
  for (let s = Math.ceil((viewSta - span) / step) * step; s <= viewSta + span; s += step) {
    if (s >= road.staStart && s <= road.staEnd) list.push(s);
  }
  return list;
}

export const stationLabelOffset = (road: Road, sta: number) => road.roadEdges(sta).cwL - 2.5;

/**
 * Etiquetas HTML sobre la escena. Cada una lleva su posición 3D en data-x/y/z y
 * `LabelProjector` (dentro del Canvas) las ubica en pantalla en cada cuadro.
 */
export function LabelsLayer() {
  const site = useStore((s) => s.site)!;
  const road = useActiveRoad()!;
  const entities = useStore((s) => s.entities);
  const selectedId = useStore((s) => s.selectedId);
  const viewSta = useStore((s) => s.viewSta);
  const viewDist = useStore((s) => s.viewDist);

  const anchor = (r: Road, sta: number, off: number, lift: number) => {
    const p = r.toWorld(sta, off, lift);
    return { 'data-x': p.x, 'data-y': p.y, 'data-z': p.z };
  };

  return (
    <div className="labels-layer" id={LABELS_LAYER_ID}>
      {visibleStations(road, viewSta, viewDist).map((s) => (
        <div key={`sta-${road.id}-${s}`} className="anchor" {...anchor(road, s, stationLabelOffset(road, s), 3.6)}>
          <div className={`sta-tag${s % 1000 === 0 ? ' km' : ''}`}>{formatSta(s, 0)}</div>
        </div>
      ))}
      {viewDist < 1400 &&
        entities.map((e) => {
          const selected = e.id === selectedId;
          return (
            <div
              key={e.id}
              className={`anchor${selected ? ' front' : ''}`}
              {...anchor(site.roads[e.roadId], e.sta, e.off, e.type === 'acopio' ? 6 : 6.5)}
            >
              <div className={`unit-tag${selected ? ' selected' : ''}`}>
                <span className={`dot ${e.status}`} />
                {e.code}
                {selected && <span className="unit-tag-sub">{formatSta(e.sta, 1)}</span>}
              </div>
            </div>
          );
        })}
    </div>
  );
}
