import { historicalBusiness, historicalQuery } from './historical-market-data.ts';
import { finite, map, type Fact } from './review-facts.ts';
import { readBackendPages, readBoundedJson } from './api/dashboard/review-backend/loader.ts';
import { openApiConfig, pathWithSortedQuery, signedHeaders } from './api/dashboard/openapi.ts';
import { archiveTime, captureLiveArchive, readMarketArchive, writeMarketArchive, type MarketArchive } from './market-archive-store.ts';

function apiClient() {
  const config = openApiConfig();
  if (!config) throw new Error('OpenAPI credentials unavailable');
  const deadline = AbortSignal.timeout(45_000);
  return async (path: string, params: Record<string, string | undefined>) => {
    const target = pathWithSortedQuery(path, params);
    return readBoundedJson(await fetch(config.baseUrl + target, {
      headers: signedHeaders('GET', target, config.apiKey, config.apiSecret), cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]),
    }));
  };
}

export async function loadFinalBusiness(item: Fact, endAt: number): Promise<Fact> {
  const id = String(map(item.identity).condition_id), lifecycle = map(item.lifecycle);
  const start = archiveTime(lifecycle.start_time || lifecycle.create_time);
  const q = historicalQuery(String(Math.floor(endAt / 1000)), '4h', Date.now(), Number.isFinite(start) ? String(Math.floor(start / 1000)) : null);
  const api = apiClient();
  let history: Fact | null = null;
  try { history = await api(`/openapi/v1/dashboard/markets/${id}/history`, { start_time: String(q.start), end_time: String(q.end), interval: q.interval, include_pnl: 'true' }); }
  catch { /* Fills can independently recover counts and slippage. */ }
  const fills = await readBackendPages(api, `/openapi/v1/dashboard/markets/${id}/fills`, { to: String(q.end) }, 'fills');
  if (!history && !fills.available) throw new Error('Final historical sources unavailable');
  return historicalBusiness(id, q.end, history, fills);
}

// A failed enrichment cannot erase an already retained field or historical series.
export function fillArchiveGaps(previous: unknown, incoming: unknown): unknown {
  if (previous === null || previous === undefined) return incoming;
  if (Array.isArray(previous)) return previous.length ? previous : incoming ?? previous;
  if (typeof previous === 'object' && typeof incoming === 'object' && incoming !== null && !Array.isArray(incoming)) {
    const result = { ...map(previous) };
    for (const [key, value] of Object.entries(map(incoming))) result[key] = fillArchiveGaps(result[key], value);
    return result;
  }
  return previous;
}

export async function finalizeMarketArchive(directory: string, item: Fact, now: number, load = loadFinalBusiness): Promise<MarketArchive> {
  const id = String(map(item.identity).condition_id), previous = await readMarketArchive(directory, id);
  if (previous?.finalized && (previous.complete || previous.attempts >= 3 || (previous.nextAttemptAt ?? 0) > now)) return previous;
  const scheduled = archiveTime(map(item.lifecycle).end_time);
  const captured = archiveTime(map(item.snapshot_meta).captured_at);
  const endAt = Math.min(Number.isFinite(scheduled) ? scheduled : Infinity, Number.isFinite(captured) ? captured : now);
  if (!Number.isFinite(endAt) || endAt > now) throw new Error('Not ended');
  const result: MarketArchive = previous?.finalized ? { ...previous } : {
    ...previous, version: 1, id, finalized: true, capturedAt: Number.isFinite(captured) ? captured : now,
    endAt, strategy: item, attempts: 0,
  };
  result.attempts++;
  result.nextAttemptAt = now + 300_000;
  try {
    const business = await load(item, endAt);
    if (map(business.data).condition_id !== id) throw new Error('Wrong market');
    result.business = map(result.business?.fallback === true ? business : fillArchiveGaps(result.business, business));
    const data = map(business.data), slip = map(data.slippage);
    result.complete = finite(map(data.business).gross_volume) !== null && finite(map(data.pnl).current_pnl) !== null
      && Boolean(business.history) && (finite(slip.avg_trade_slippage) !== null || String(slip.note).startsWith('无有效净成交'));
    result.note = `结束归档已落盘；业务截至 ${new Date(Number(business.as_of) * 1000).toISOString()}，图表保存最后4小时。${result.lastBook ? '盘口取结束前最后有效观测。' : '结束前有效盘口未留存，不能从今天盘口重建。'}`;
  } catch (error) {
    result.note = `结束归档已落盘；业务补全失败，保留已保存字段：${error instanceof Error ? error.message : '后端不可用'}`;
  }
  // The last live observation is a separate, timestamped fallback, never a claimed end-of-market total.
  if (!result.business && result.liveBusiness) {
    result.business = { code: 0, data: result.liveBusiness.value, as_of: Math.floor(result.liveBusiness.at / 1000),
      history: result.liveHistory ? { code: 0, data: result.liveHistory.value } : null,
      notes: ['结束后接口不可用；使用结束前保存的24小时窗口统计，不代表完整生命周期累计值'], fallback: true };
  }
  await writeMarketArchive(directory, result);
  return result;
}

export async function checkpointMarket(directory: string, item: Fact, now: number) {
  const id = String(map(item.identity).condition_id), previous = await readMarketArchive(directory, id);
  if (previous?.finalized) return previous;
  let business: Fact | undefined, history: Fact | undefined;
  try {
    const api = apiClient();
    const fetchedBusiness = await api(`/openapi/v1/dashboard/markets/${id}/realtime`, { window: '24h', include_slippage_distribution: 'true', include_trades: 'false' });
    if (fetchedBusiness.condition_id !== id) throw new Error('Wrong market');
    business = fetchedBusiness;
    const end = Math.floor(now / 60_000) * 60;
    const fetchedHistory = await api(`/openapi/v1/dashboard/markets/${id}/history`, { start_time: String(end - 14400), end_time: String(end), interval: '1m', include_pnl: 'true' });
    if (fetchedHistory.condition_id !== id) throw new Error('Wrong market');
    history = fetchedHistory;
  } catch { /* Strategy and previous valid business snapshots remain usable. */ }
  const result = captureLiveArchive(previous, item, now, business, history);
  await writeMarketArchive(directory, result);
  return result;
}
