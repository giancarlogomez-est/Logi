import type { ProfileVertex } from '../landxml/types';

/** Rasante por PVI con curvas verticales parabólicas simétricas. */
export class ProfileModel {
  private readonly v: ProfileVertex[];
  private readonly g: number[] = [];

  constructor(pvis: ProfileVertex[]) {
    this.v = pvis;
    for (let i = 0; i < pvis.length - 1; i++) {
      this.g.push((pvis[i + 1].elev - pvis[i].elev) / (pvis[i + 1].sta - pvis[i].sta));
    }
  }

  elevAt(sta: number): number {
    const v = this.v;
    if (v.length === 0) return 0;
    if (v.length === 1) return v[0].elev;
    for (let j = 1; j < v.length - 1; j++) {
      const L = v[j].curveLength;
      if (L <= 0) continue;
      const bvc = v[j].sta - L / 2;
      if (sta >= bvc && sta <= v[j].sta + L / 2) {
        const g1 = this.g[j - 1];
        const g2 = this.g[j];
        const x = sta - bvc;
        return v[j].elev - (g1 * L) / 2 + g1 * x + ((g2 - g1) * x * x) / (2 * L);
      }
    }
    let i = 0;
    while (i < v.length - 2 && sta > v[i + 1].sta) i++;
    return v[i].elev + this.g[i] * (sta - v[i].sta);
  }
}
