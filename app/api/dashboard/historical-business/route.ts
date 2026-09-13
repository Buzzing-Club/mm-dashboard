import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { historicalBusiness, historicalQuery } from '../../../historical-market-data.ts';
import { openApiConfig, pathWithSortedQuery, signedHeaders, validConditionId } from '../openapi.ts';
import { readBackendPages, readBoundedJson } from '../review-backend/loader.ts';
import type { Fact } from '../../../review-facts.ts';

export const runtime = 'nodejs';
const cache = new Map<string, { expires: number; value: ReturnType<typeof historicalBusiness> }>();
const pending = new Map<string, Promise<ReturnType<typeof historicalBusiness>>>();

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const conditionId = validConditionId(incoming.searchParams.get('condition_id'));
  if (!conditionId) return NextResponse.json({ error: 'valid condition_id is required' }, { status: 400 });
  let query: ReturnType<typeof historicalQuery>;
  try { query = historicalQuery(incoming.searchParams.get('as_of'), incoming.searchParams.get('window'), Date.now(), incoming.searchParams.get('market_start')); }
  catch { return NextResponse.json({ error: 'valid historical as_of is required' }, { status: 400 }); }
  const config = openApiConfig();
  if (!config) return NextResponse.json({ error: 'OpenAPI credentials are not configured' }, { status: 503 });
  const identity = createHash('sha256').update(`${config.baseUrl}|${config.apiKey}|${config.apiSecret}`).digest('hex');
  const key = `${identity}:${conditionId}:${query.start}:${query.end}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value, { headers: { 'cache-control': 'no-store' } });
  let job = pending.get(key);
  if (!job) {
    if (pending.size >= 2) return NextResponse.json({ error: 'Historical queries busy; retry shortly' }, { status: 503 });
    job = (async () => {
      const deadline = AbortSignal.timeout(35_000);
      const api = async (path: string, params: Record<string, string | undefined>) => {
        const target = pathWithSortedQuery(path, params);
        return readBoundedJson(await fetch(config.baseUrl + target, {
          headers: signedHeaders('GET', target, config.apiKey, config.apiSecret),
          cache: 'no-store', redirect: 'manual',
          signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]),
        }));
      };
      let history: Fact | null = null;
      try {
        history = await api(`/openapi/v1/dashboard/markets/${conditionId}/history`, {
          start_time: String(query.start), end_time: String(query.end), interval: query.interval, include_pnl: 'true',
        });
      } catch { /* The independent fills source can still provide trader count. */ }
      const fills = await readBackendPages(api, `/openapi/v1/dashboard/markets/${conditionId}/fills`, { to: String(query.end) }, 'fills');
      if (!history && !fills.available) throw new Error('Historical sources unavailable');
      const value = historicalBusiness(conditionId, query.end, history, fills);
      while (cache.size >= 24) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 60_000, value });
      return value;
    })();
    pending.set(key, job);
  }
  try { return NextResponse.json(await job, { headers: { 'cache-control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Historical sources unavailable; retry shortly' }, { status: 502 }); }
  finally { if (pending.get(key) === job) pending.delete(key); }
}
