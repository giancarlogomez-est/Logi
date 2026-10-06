import { useEffect, useState } from 'react';
import { Scene } from './scene/Scene';
import { useStore } from './store';
import { DetailPanel } from './ui/DetailPanel';
import { LabelsLayer } from './ui/Labels';
import { LoadScreen } from './ui/LoadScreen';
import { MiniMap } from './ui/MiniMap';
import { ProfileBar } from './ui/ProfileBar';
import { ProjectInfo } from './ui/ProjectInfo';
import { ResourcePanel } from './ui/ResourcePanel';
import { TopBar } from './ui/TopBar';

/** Si existe public/data/proyecto.xml (excluido de git) se carga al iniciar */
const AUTOLOAD = 'data/proyecto.xml';

export default function App() {
  const world = useStore((s) => s.world);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const showInfo = useStore((s) => s.showInfo);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(AUTOLOAD)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        // el servidor de desarrollo puede responder index.html para rutas inexistentes
        if (text && text.slice(0, 2000).includes('<LandXML')) useStore.getState().loadText(text, 'proyecto.xml');
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (!world) return <LoadScreen checking={checking} />;

  return (
    <div className="app">
      <Scene />
      <LabelsLayer />
      <div className="hud">
        <TopBar />
        <div className="hud-left">
          <ResourcePanel />
          <MiniMap />
        </div>
        <DetailPanel />
        <ProfileBar />
      </div>
      {showInfo && <ProjectInfo />}
      {loading && (
        <div className="loading-overlay">
          <span className="spinner" /> Leyendo LandXML…
        </div>
      )}
      {error && <div className="toast-error">{error}</div>}
    </div>
  );
}
