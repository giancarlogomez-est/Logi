import type { World } from '../geo/world';

export type EntityType = 'volqueta' | 'excavadora' | 'motoniveladora' | 'vibrocompactador' | 'cuadrilla' | 'acopio';
export type EntityStatus = 'operando' | 'espera' | 'mantenimiento';

export interface Entity {
  id: string;
  code: string;
  type: EntityType;
  name: string;
  sta: number;
  off: number;
  /** 1 = mira en sentido del abscisado, −1 = en contra */
  facing: 1 | -1;
  status: EntityStatus;
  activity: string;
  /** Personas asociadas (operador o integrantes de la cuadrilla) */
  people: number;
  /** Nivel de combustible o de inventario 0–1 */
  level?: { label: string; value: number };
  details: [string, string][];
}

export const TYPE_LABEL: Record<EntityType, string> = {
  volqueta: 'Volqueta',
  excavadora: 'Excavadora',
  motoniveladora: 'Motoniveladora',
  vibrocompactador: 'Vibrocompactador',
  cuadrilla: 'Cuadrilla',
  acopio: 'Acopio',
};

export const STATUS_LABEL: Record<EntityStatus, string> = {
  operando: 'Operando',
  espera: 'En espera',
  mantenimiento: 'Mantenimiento',
};

/** Radio de la huella para el anillo de selección (m) */
export const FOOTPRINT: Record<EntityType, number> = {
  volqueta: 5.5,
  excavadora: 5.5,
  motoniveladora: 5.5,
  vibrocompactador: 3.8,
  cuadrilla: 3.5,
  acopio: 8,
};

/** Datos de ejemplo para la Fase 0. En la Fase 1 vendrán de la base de datos. */
export function createDemoEntities(world: World): Entity[] {
  const at = (d: number) => Math.min(world.staStart + d, world.staEnd - 1);
  return [
    {
      id: 'exc-01',
      code: 'EXC-01',
      type: 'excavadora',
      name: 'Excavadora CAT 320',
      sta: at(430),
      off: -9,
      facing: 1,
      status: 'operando',
      activity: 'Corte en talud y cargue de material',
      people: 1,
      level: { label: 'Combustible', value: 0.64 },
      details: [
        ['Operador', 'Andrés Peña'],
        ['Horómetro', '6.218 h'],
        ['Producción hoy', '184 m³'],
        ['Propiedad', 'Propia'],
      ],
    },
    {
      id: 'vol-01',
      code: 'VOL-01',
      type: 'volqueta',
      name: 'Volqueta doble troque 14 m³',
      sta: at(395),
      off: -2,
      facing: -1,
      status: 'operando',
      activity: 'Retiro de material de corte a ZODME',
      people: 1,
      level: { label: 'Combustible', value: 0.72 },
      details: [
        ['Operador', 'Carlos Rojas'],
        ['Placa', 'SXT-482'],
        ['Viajes hoy', '6'],
        ['Propiedad', 'Alquilada'],
      ],
    },
    {
      id: 'vol-02',
      code: 'VOL-02',
      type: 'volqueta',
      name: 'Volqueta sencilla 7 m³',
      sta: at(560),
      off: 2,
      facing: 1,
      status: 'mantenimiento',
      activity: 'Cambio de llantas traseras',
      people: 1,
      level: { label: 'Combustible', value: 0.21 },
      details: [
        ['Operador', 'Luis Mora'],
        ['Placa', 'TKP-915'],
        ['Viajes hoy', '0'],
        ['Propiedad', 'Alquilada'],
      ],
    },
    {
      id: 'mot-01',
      code: 'MOT-01',
      type: 'motoniveladora',
      name: 'Motoniveladora CAT 140K',
      sta: at(640),
      off: 2,
      facing: 1,
      status: 'espera',
      activity: 'Espera de material para extender subbase',
      people: 1,
      level: { label: 'Combustible', value: 0.55 },
      details: [
        ['Operador', 'Diego Castro'],
        ['Horómetro', '9.874 h'],
        ['Producción hoy', '0 m²'],
        ['Propiedad', 'Propia'],
      ],
    },
    {
      id: 'vib-01',
      code: 'VIB-01',
      type: 'vibrocompactador',
      name: 'Vibrocompactador 12 t',
      sta: at(690),
      off: -2,
      facing: 1,
      status: 'operando',
      activity: 'Compactación de subrasante',
      people: 1,
      level: { label: 'Combustible', value: 0.83 },
      details: [
        ['Operador', 'Jorge Silva'],
        ['Horómetro', '3.402 h'],
        ['Producción hoy', '1.150 m²'],
        ['Propiedad', 'Alquilada'],
      ],
    },
    {
      id: 'cua-01',
      code: 'CUA-01',
      type: 'cuadrilla',
      name: 'Cuadrilla de topografía',
      sta: at(330),
      off: 7,
      facing: 1,
      status: 'operando',
      activity: 'Replanteo de chaflanes',
      people: 4,
      details: [
        ['Encargado', 'Topógrafo M. Gómez'],
        ['Integrantes', '4'],
        ['Equipo', 'Estación total + GNSS'],
        ['SISO', 'Al día'],
      ],
    },
    {
      id: 'cua-02',
      code: 'CUA-02',
      type: 'cuadrilla',
      name: 'Cuadrilla de drenaje',
      sta: at(760),
      off: 7,
      facing: 1,
      status: 'operando',
      activity: 'Construcción de cuneta en concreto',
      people: 6,
      details: [
        ['Encargado', 'Maestro R. Vargas'],
        ['Integrantes', '6'],
        ['Avance hoy', '24 m'],
        ['SISO', '1 pendiente'],
      ],
    },
    {
      id: 'aco-01',
      code: 'ACO-01',
      type: 'acopio',
      name: 'Acopio base granular BG-A',
      sta: at(250),
      off: 16,
      facing: 1,
      status: 'operando',
      activity: 'Disponible para extendido',
      people: 0,
      level: { label: 'Inventario', value: 0.38 },
      details: [
        ['Material', 'Base granular BG-A'],
        ['Existencia', '320 m³'],
        ['Capacidad', '850 m³'],
        ['Consumo diario', '~140 m³'],
      ],
    },
  ];
}
