import { useStore } from '../store';

/** "CRBN-DG-ALINEAMIENTO-ORIENTAL" → "ORIENTAL" */
export function shortName(name: string, id: number): string {
  const last = name.split(/[-_\s]+/).filter(Boolean).pop();
  return last && last.length <= 14 ? last : `Vía ${id + 1}`;
}

export function roadShortName(id: number): string {
  const road = useStore.getState().site?.roads[id];
  return road ? shortName(road.name, id) : `Vía ${id + 1}`;
}

/** Color por vía en el minimapa y los selectores */
export const ROAD_COLORS = ['#3557e0', '#0e9f8a', '#c2410c', '#7c3aed'];
