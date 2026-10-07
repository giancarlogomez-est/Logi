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

/**
 * Carga automática desde public/data (excluida de git): el archivo indicado en proyecto.json
 * ({ "archivo": "…xml" }) o, si no existe, proyecto.xml
 */
async function findAutoload(): Promise<string> {
  try {
    const r = await fetch('data/proyecto.json');
    if (r.ok) {
      const m = (await r.json()) as { archivo?: string };
      if (m.archivo) return m.archivo;
    }
  } catch {
    // sin manifiesto
  }
  return 'proyecto.xml';
}

export default function App() {
  const site = useStore((s) => s.site);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const showInfo = useStore((s) => s.showInfo);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    findAutoload()
      .then(async (name) => {
        const r = await fetch(`data/${encodeURIComponent(name)}`);
        const blob = r.ok ? await r.blob() : null;
        // el servidor de desarrollo puede responder index.html para rutas inexistentes
        if (blob && (await blob.slice(0, 2000).text()).includes('<LandXML')) {
          setChecking(false);
          await useStore.getState().loadFile(blob, name);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (!site) return <LoadScreen checking={checking} />;

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
          <span className="spinner" /> {loading}
        </div>
      )}
      {error && <div className="toast-error">{error}</div>}
    </div>
  );
}
