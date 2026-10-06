/** 1234.5 → "K1+234.50" */
export function formatSta(sta: number, decimals = 2): string {
  const f = 10 ** decimals;
  const r = Math.round(sta * f) / f;
  const sign = r < 0 ? '-' : '';
  const a = Math.abs(r);
  const km = Math.floor(a / 1000);
  const m = (a - km * 1000).toFixed(decimals).padStart(decimals ? 4 + decimals : 3, '0');
  return `${sign}K${km}+${m}`;
}

/** "K3+500", "3+500.5", "3500" → metros */
export function parseSta(text: string): number | null {
  const t = text.trim().toUpperCase().replace(/^K/, '').replace(',', '.');
  if (!t) return null;
  if (t.includes('+')) {
    const [km, m] = t.split('+');
    const v = Number(km || 0) * 1000 + Number(m || 0);
    return Number.isFinite(v) ? v : null;
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function formatOffset(off: number): string {
  if (Math.abs(off) < 0.05) return 'en el eje';
  return `${Math.abs(off).toFixed(1)} m ${off > 0 ? 'Der.' : 'Izq.'}`;
}

export const fmt = (v: number, d = 0) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
