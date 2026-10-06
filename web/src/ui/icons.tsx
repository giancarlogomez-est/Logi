import type { EntityType } from '../data/demo';

const PATHS = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4.3-4.3',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 8v5m0-8.5v.5',
  road: 'M8 3 4 21m12-18 4 18M12 4v2m0 4v3m0 4v3',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6m1-9a3 3 0 1 0 0-6m2 15c0-2.6-1.4-4.8-3.5-5.6',
  machine: 'M3 17h18M5 17V9h7l3 4h4v4M7 13h4M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  upload: 'M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  close: 'M6 6l12 12M18 6 6 18',
  focus: 'M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4m0 6v4a1 1 0 0 1-1 1h-4m-6 0H5a1 1 0 0 1-1-1v-4m8-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  move: 'M12 3v18M3 12h18M12 3l-3 3m3-3 3 3m-3 15-3-3m3 3 3-3M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3',
  layers: 'M12 3 2 8l10 5 10-5-10-5zm-10 9 10 5 10-5M2 16l10 5 10-5',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="#3557e0" />
      <path d="M16 2 29 9.5 16 17 3 9.5z" fill="#6f8cff" />
      <path d="M9 25c3-4 4-8 7-8s4 4 7 8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const TYPE_COLOR: Record<EntityType, string> = {
  volqueta: '#3557e0',
  excavadora: '#e9a800',
  motoniveladora: '#e9a800',
  vibrocompactador: '#e9a800',
  cuadrilla: '#ff7a1a',
  acopio: '#9b8a6c',
};

const TYPE_SHORT: Record<EntityType, string> = {
  volqueta: 'VQ',
  excavadora: 'EX',
  motoniveladora: 'MN',
  vibrocompactador: 'VC',
  cuadrilla: 'CQ',
  acopio: 'AC',
};

export function TypeBadge({ type, size = 34 }: { type: EntityType; size?: number }) {
  return (
    <span className="type-badge" style={{ background: TYPE_COLOR[type], width: size, height: size }}>
      {TYPE_SHORT[type]}
    </span>
  );
}

export { TYPE_COLOR };
