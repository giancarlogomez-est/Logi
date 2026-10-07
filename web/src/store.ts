import { create } from 'zustand';
import { createDemoEntities, type Entity } from './data/demo';
import { Site, type SurfaceChoice } from './geo/world';
import { parseLandXml, type SplitLandXml } from './landxml/parse';
import SplitWorker from './landxml/split.worker?worker';

export interface FlyRequest {
  roadId: number;
  sta: number;
  off: number;
  /** Recalcular la posición de la cámara según el rumbo de la vía */
  reframe?: boolean;
  instant?: boolean;
  seq: number;
}

interface State {
  site: Site | null;
  /** Vía activa: la de la abscisa en vista, el perfil y la búsqueda */
  activeRoad: number;
  entities: Entity[];
  selectedId: string | null;
  viewSta: number;
  viewDist: number;
  flyRequest: FlyRequest | null;
  loading: string | null;
  error: string | null;
  showInfo: boolean;

  loadFile: (file: Blob, fileName: string) => Promise<void>;
  setSurfaces: (roadId: number, choice: SurfaceChoice) => void;
  setActiveRoad: (roadId: number) => void;
  select: (id: string | null) => void;
  moveEntity: (id: string, sta: number, off: number) => void;
  flyTo: (roadId: number, sta: number, off?: number, reframe?: boolean) => void;
  setView: (sta: number, dist: number) => void;
  setShowInfo: (v: boolean) => void;
}

let seq = 0;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Parte pesada en un Web Worker: lectura del archivo, separación de bloques y TIN */
function splitInWorker(file: Blob): Promise<SplitLandXml> {
  return new Promise((resolve, reject) => {
    const worker = new SplitWorker();
    worker.onmessage = (ev: MessageEvent<{ ok: boolean; result?: SplitLandXml; error?: string }>) => {
      worker.terminate();
      if (ev.data.ok) resolve(ev.data.result!);
      else reject(new Error(ev.data.error));
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'Error leyendo el archivo'));
    };
    worker.postMessage(file);
  });
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export const useStore = create<State>((set, get) => ({
  site: null,
  activeRoad: 0,
  entities: [],
  selectedId: null,
  viewSta: 0,
  viewDist: 200,
  flyRequest: null,
  loading: null,
  error: null,
  showInfo: false,

  async loadFile(file, fileName) {
    set({ loading: 'Leyendo el archivo…', error: null });
    try {
      const t0 = performance.now();
      const split = await splitInWorker(file);
      set({ loading: 'Construyendo la vía…' });
      await nextFrame();
      const project = parseLandXml(split, fileName);
      const site = new Site(project);
      for (const r of site.roads) {
        console.info(
          `[Logi] ${r.name}: ${r.sections.length} secciones, cierre máx. ${r.stats.closureMax.toFixed(4)} m,` +
            ` rasante vs secciones máx. ${r.stats.rasanteDiffMax?.toFixed(4) ?? '—'} m, terreno ${r.stats.terrainFromTin ? 'TIN' : 'secciones'}`,
        );
      }
      console.info(`[Logi] ${fileName} cargado en ${(performance.now() - t0).toFixed(0)} ms`);
      const entities = createDemoEntities(site);
      const road = site.roads[0];
      const start = Math.min(road.staStart + 520, road.staEnd);
      set({
        site,
        activeRoad: 0,
        entities,
        selectedId: null,
        loading: null,
        viewSta: start,
        flyRequest: { roadId: 0, sta: start, off: 0, reframe: true, instant: true, seq: ++seq },
      });
    } catch (e) {
      console.error(e);
      set({ loading: null, error: errorText(e) });
    }
  },

  setSurfaces(roadId, choice) {
    const { site } = get();
    if (!site) return;
    try {
      const choices = site.choices.map((c, i) => (i === roadId ? choice : c));
      set({ site: new Site(site.project, choices, site.tin) });
    } catch (e) {
      set({ error: errorText(e) });
    }
  },

  setActiveRoad: (roadId) => {
    if (get().activeRoad !== roadId) set({ activeRoad: roadId });
  },

  select: (id) => set({ selectedId: id }),

  moveEntity: (id, sta, off) =>
    set((s) => ({ entities: s.entities.map((e) => (e.id === id ? { ...e, sta, off } : e)) })),

  flyTo: (roadId, sta, off = 0, reframe = false) =>
    set({ activeRoad: roadId, flyRequest: { roadId, sta, off, reframe, seq: ++seq } }),

  setView: (sta, dist) => {
    const s = get();
    if (Math.abs(sta - s.viewSta) > 2 || Math.abs(dist - s.viewDist) / s.viewDist > 0.05) set({ viewSta: sta, viewDist: dist });
  },

  setShowInfo: (v) => set({ showInfo: v }),
}));

/** Vía activa (atajo para los componentes) */
export const useActiveRoad = () => useStore((s) => s.site?.roads[s.activeRoad] ?? s.site?.roads[0] ?? null);

if (import.meta.env.DEV) (window as unknown as { logi: typeof useStore }).logi = useStore;
