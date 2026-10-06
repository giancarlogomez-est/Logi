import { create } from 'zustand';
import { createDemoEntities, type Entity } from './data/demo';
import { World } from './geo/world';
import { guessSurfaces, parseLandXml } from './landxml/parse';
import type { LandXmlProject } from './landxml/types';

export interface FlyRequest {
  sta: number;
  off: number;
  /** Recalcular la posición de la cámara según el rumbo de la vía */
  reframe?: boolean;
  instant?: boolean;
  seq: number;
}

interface State {
  project: LandXmlProject | null;
  world: World | null;
  terrainSurface: string;
  designSurface: string;
  entities: Entity[];
  selectedId: string | null;
  viewSta: number;
  viewDist: number;
  flyRequest: FlyRequest | null;
  loading: boolean;
  error: string | null;
  showInfo: boolean;

  loadFile: (file: File) => Promise<void>;
  loadText: (text: string, fileName: string) => void;
  setSurfaces: (terrain: string, design: string) => void;
  select: (id: string | null) => void;
  moveEntity: (id: string, sta: number, off: number) => void;
  flyTo: (sta: number, off?: number, reframe?: boolean) => void;
  setView: (sta: number, dist: number) => void;
  setShowInfo: (v: boolean) => void;
}

let seq = 0;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useStore = create<State>((set, get) => ({
  project: null,
  world: null,
  terrainSurface: '',
  designSurface: '',
  entities: [],
  selectedId: null,
  viewSta: 0,
  viewDist: 200,
  flyRequest: null,
  loading: false,
  error: null,
  showInfo: false,

  async loadFile(file) {
    set({ loading: true, error: null });
    try {
      get().loadText(await file.text(), file.name);
    } catch (e) {
      set({ loading: false, error: errorText(e) });
    }
  },

  loadText(text, fileName) {
    set({ loading: true, error: null });
    // dejar que la interfaz pinte el indicador antes de un parseo largo
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const project = parseLandXml(text, fileName);
        const { terrain, design } = guessSurfaces(project.surfaceNames);
        const world = new World(project, terrain, design);
        console.info(
          `[Logi] ${fileName}: ${project.sections.length} secciones, cierre máx. ${world.stats.closureMax.toFixed(4)} m,` +
            ` rasante vs secciones máx. ${world.stats.rasanteDiffMax?.toFixed(4) ?? '—'} m (${(performance.now() - t0).toFixed(0)} ms)`,
        );
        const entities = createDemoEntities(world);
        const start = Math.min(world.staStart + 520, world.staEnd);
        set({
          project,
          world,
          terrainSurface: terrain,
          designSurface: design,
          entities,
          selectedId: null,
          loading: false,
          viewSta: start,
          flyRequest: { sta: start, off: 0, reframe: true, instant: true, seq: ++seq },
        });
      } catch (e) {
        console.error(e);
        set({ loading: false, error: errorText(e) });
      }
    }, 30);
  },

  setSurfaces(terrain, design) {
    const { project } = get();
    if (!project) return;
    try {
      set({ world: new World(project, terrain, design), terrainSurface: terrain, designSurface: design });
    } catch (e) {
      set({ error: errorText(e) });
    }
  },

  select: (id) => set({ selectedId: id }),

  moveEntity: (id, sta, off) =>
    set((s) => ({ entities: s.entities.map((e) => (e.id === id ? { ...e, sta, off } : e)) })),

  flyTo: (sta, off = 0, reframe = false) => set({ flyRequest: { sta, off, reframe, seq: ++seq } }),

  setView: (sta, dist) => {
    const s = get();
    if (Math.abs(sta - s.viewSta) > 2 || Math.abs(dist - s.viewDist) / s.viewDist > 0.05) set({ viewSta: sta, viewDist: dist });
  },

  setShowInfo: (v) => set({ showInfo: v }),
}));

if (import.meta.env.DEV) (window as unknown as { logi: typeof useStore }).logi = useStore;
