import { fmt, formatSta } from '../format';
import { useStore } from '../store';
import { Icon } from './icons';

export function ProjectInfo() {
  const world = useStore((s) => s.world)!;
  const terrain = useStore((s) => s.terrainSurface);
  const design = useStore((s) => s.designSurface);
  const setSurfaces = useStore((s) => s.setSurfaces);
  const close = () => useStore.getState().setShowInfo(false);
  const { project, align, stats } = world;
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
            <dt>Alineamiento</dt>
            <dd>{align.name}</dd>
          </div>
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
            <dd>{project.profile ? `${project.profile.name} (${project.profile.pvis.length} PVI)` : 'No incluida'}</dd>
          </div>
          <div>
            <dt>Sistema de coordenadas</dt>
            <dd>{project.crs ? `${project.crs.desc} (EPSG ${project.crs.epsg})` : 'No indicado'}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>{project.application ?? '—'}</dd>
          </div>
          {project.materialNames.length > 0 && (
            <div>
              <dt>Capas de material</dt>
              <dd>{project.materialNames.join(' · ')}</dd>
            </div>
          )}
        </dl>

        <h3>Superficies de las secciones</h3>
        {project.surfaceNames.length ? (
          <div className="selects">
            <label>
              Terreno natural
              <select value={terrain} onChange={(e) => setSurfaces(e.target.value, design)}>
                {project.surfaceNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Superficie terminada (diseño)
              <select value={design} onChange={(e) => setSurfaces(terrain, e.target.value)}>
                {project.surfaceNames.map((n) => (
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
          {stats.synthetic ? (
            <li className="warn">Sin secciones transversales: se usa una calzada típica de 7.30 m sobre terreno plano.</li>
          ) : (
            <li className={stats.generatedSlopes ? 'warn' : 'ok'}>
              {stats.generatedSlopes
                ? `${stats.generatedSlopes} de ${world.sections.length} secciones sin talud en el corredor: se dibujó un talud aproximado (corte 1H:1V, relleno 1.5H:1V).`
                : 'Todas las secciones traen sus taludes.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
