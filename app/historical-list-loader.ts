export type HistoricalListTarget = { id: string; snapshotAt?: string | null; startAt: string };
export type HistoricalLoadState = 'loading' | 'ready' | 'error';

export function historicalListKey(target: HistoricalListTarget, timeframe: string): string {
  return `${target.id}:${target.snapshotAt}:${timeframe}`;
}

// Serial requests respect the historical API's two-query global concurrency cap.
export async function loadHistoricalList<T>(targets: HistoricalListTarget[], options: {
  timeframe: string;
  signal: AbortSignal;
  cache: Map<string, T>;
  refresh: boolean;
  load: (target: HistoricalListTarget) => Promise<T>;
  onStart: (key: string) => void;
  onResult: (key: string, result: T) => void;
  onError: (key: string) => void;
}) {
  const seen = new Set<string>();
  for (const target of targets) {
    if (options.signal.aborted) break;
    const key = historicalListKey(target, options.timeframe);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!options.refresh && options.cache.has(key)) {
      options.onResult(key, options.cache.get(key)!);
      continue;
    }
    options.onStart(key);
    try {
      const result = await options.load(target);
      if (options.signal.aborted) break;
      options.cache.set(key, result);
      options.onResult(key, result);
    } catch {
      if (options.signal.aborted) break;
      options.onError(key);
    }
  }
}

export function historicalMissingLabel(field: string, state?: HistoricalLoadState): string {
  if (state === 'ready') return `${field}暂无数据`;
  if (state === 'error') return `${field}读取失败`;
  return `${field}加载中`;
}
