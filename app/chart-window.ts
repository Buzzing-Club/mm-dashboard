export function chartWindow<T extends { ts: number }>(points: T[], timeframe: string, start: number, end: number, now = Date.now()) {
  const valid = points.filter(point => Number.isFinite(point.ts) && point.ts >= start && point.ts <= Math.min(end, now)).sort((a, b) => a.ts - b.ts);
  const duration = ({ '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000 } as Record<string, number>)[timeframe] ?? 3_600_000;
  const through = valid.at(-1)?.ts ?? Math.min(end, now);
  const from = Math.max(start, through - duration);
  return { points: valid.filter(point => point.ts >= from), from, through: Math.max(from + 1000, through) };
}

export function sampledSlippage(value: unknown, samples: unknown): number | null {
  if (samples !== undefined && samples !== null && Number(samples) <= 0) return null;
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;
  return Number(value) * 100;
}
