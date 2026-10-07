import { fmt, formatSta } from '../format';
import { useActiveRoad, useStore } from '../store';
import { Icon } from './icons';

export function ProjectInfo() {
  const site = useStore((s) => s.site)!;
  const road = useActiveRoad()!;
  const setSurfaces = useStore((s) => s.setSurfaces);
  const close = () => useStore.getState().setShowInfo(false);
  const { project, tin } = site;
  const { align, stats, data } = road;
  const choice = site.choices[road.id];
  const c = align.counts();

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Proyecto</h2>
          <button className="icon-btn" onClick={close} title="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <dl>
          <div>
            <dt>Archivo</dt>
            <dd>{project.fileName}</dd>
          </div>
          <div>
            <dt>Sistema de coordenadas</dt>
            <dd>{project.crs?.desc ? `${project.crs.desc}${project.crs.epsg ? ` (EPSG ${project.crs.epsg})` : ''}` : 'No indicado'}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>{project.application ?? '—'}</dd>
          </div>
          <div>
            <dt>Alineamientos</dt>
            <dd>{site.roads.map((r) => `${r.name} (${fmt(r.align.length, 1)} m)`).join(' · ')}</dd>
          </div>
          <div>
            <dt>Terreno natural</dt>
            <dd>
              {tin
                ? `TIN ${tin.name}: ${fmt(tin.points.length / 3)} puntos, ${fmt(tin.faces.length / 3)} triángulos`
                : 'Desde las secciones transversales'}
            </dd>
          </div>
        </dl>

        <h3>{site.roads.length > 1 ? `Calzada activa: ${road.name}` : 'Alineamiento'}</h3>
        <dl>
          <div>
            <dt>Abscisado</dt>
            <dd>
              {formatSta(align.staStart)} – {formatSta(align.staEnd)} ({fmt(align.length, 2)} m)
            </dd>
          </div>
          <div>
            <dt>Geometría en planta</dt>
            <dd>
              {c.line} tangentes · {c.arc} curvas circulares · {c.spiral} espirales
            </dd>
          </div>
          <div>
            <dt>Rasante</dt>
            <dd>{data.profile ? `${data.profile.name} (${data.profile.pvis.length} PVI)` : 'No incluida'}</dd>
          </div>
          <div>
            <dt>Secciones</dt>
            <dd>{road.sections.length}</dd>
          </div>
          {data.materialNames.length > 0 && (
            <div>
              <dt>Capas de material</dt>
              <dd>{data.materialNames.join(' · ')}</dd>
            </div>
          )}
        </dl>

        <h3>Superficies de las secciones</h3>
        {data.surfaceNames.length ? (
          <div className="selects">
            <label>
              Terreno natural
              <select value={stats.terrainFromTin ? '' : choice.terrain} onChange={(e) => setSurfaces(road.id, { ...choice, terrain: e.target.value })}>
                {tin && <option value="">TIN: {tin.name}</option>}
                {data.surfaceNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Superficie terminada (diseño)
              <select value={choice.design} onChange={(e) => setSurfaces(road.id, { ...choice, design: e.target.value })}>
                {data.surfaceNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="muted">El archivo no trae secciones transversales.</p>
        )}

        <h3>Validación geométrica</h3>
        <ul className="checks">
          <li className={stats.closureMax < 0.01 ? 'ok' : 'warn'}>
            Cierre del eje calculado contra el LandXML: máx. {fmt(stats.closureMax * 1000, 1)} mm
          </li>
          {stats.rasanteDiffMax !== null && (
            <li className={stats.rasanteDiffMax < 0.01 ? 'ok' : 'warn'}>
              Rasante calculada contra secciones: máx. {fmt(stats.rasanteDiffMax * 1000, 1)} mm
            </li>
          )}
          {stats.discarded.length > 0 && (
            <li className="warn">
              {stats.discarded.length === 1 ? 'Se descartó la sección' : `Se descartaron ${stats.discarded.length} secciones`}{' '}
              {stats.discarded.slice(0, 5).map((s) => formatSta(s)).join(', ')}
              {stats.discarded.length > 5 ? '…' : ''}: su cota en el eje se aleja más de 5 m de la rasante (posible error de exportación del corredor).
            </li>
          )}
          {stats.synthetic ? (
            <li className="warn">Sin secciones transversales: se usa una calzada típica de 7.30 m.</li>
          ) : (
            <li className={stats.generatedSlopes ? 'warn' : 'ok'}>
              {stats.generatedSlopes
                ? `${stats.generatedSlopes} de ${road.sections.length} secciones sin talud hasta el terreno: se dibujó un talud aproximado (corte 1H:1V, relleno 1.5H:1V).`
                : 'Todas las secciones traen sus taludes hasta el terreno.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
