import { createHash } from 'node:crypto';
import { openApiConfig, pathWithSortedQuery, signedHeaders } from '../openapi.ts';
import { map, rows, type Fact } from '../../../review-facts.ts';
import { buildBackendReview, type BackendReview, type BackendSource } from '../../../review-backend.ts';

const MAX_PAGES = 8;
const MAX_BYTES = 2_000_000;
const cache = new Map<string, { expires: number; value: BackendReview }>();
const pending = new Map<string, Promise<BackendReview>>();
type Api = (path: string, query: Record<string, string | undefined>) => Promise<Fact>;

export async function readBoundedJson(response: Response): Promise<Fact> {
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '', bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('response size limit');
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally { await reader.cancel(); }
  const json = map(JSON.parse(body));
  if (json.code !== 0 || !json.data || typeof json.data !== 'object') throw new Error(`OpenAPI code ${String(json.code)}`);
  return map(json.data);
}

export async function readBackendPages(api: Api, path: string, query: Record<string, string>, field: 'fills' | 'entries'): Promise<BackendSource> {
  const result: BackendSource = { items: [], available: false, complete: false, versions: [] };
  const seen = new Set<string>();
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await api(path, { ...query, cursor, limit: '500' });
      // Empty protobuf repeated fields may be omitted, but pagination flags may not.
      if (typeof payload.has_more !== 'boolean' || payload[field] !== undefined && !Array.isArray(payload[field])) throw new Error('invalid page schema');
      if (payload.amount_unit !== 'usdb_raw6') throw new Error('unsupported amount unit');
      if (field === 'fills' && typeof payload.condition_id !== 'string') throw new Error('missing condition');
      if (field === 'fills' && !path.includes(`/${payload.condition_id}/`)) throw new Error('condition mismatch');
      const items = rows(payload[field]);
      if (items.length > 500) throw new Error('page size limit');
      result.items.push(...items);
      result.available = true;
      const version = map(payload.quality).classification_version;
      if (field === 'fills') {
        const value = typeof version === 'string' && version ? version : 'missing';
        if (!result.versions.includes(value)) result.versions.push(value);
      }
      if (!payload.has_more) { result.complete = true; break; }
      if (!payload.next_cursor || typeof payload.next_cursor !== 'string' || seen.has(payload.next_cursor)) throw new Error('invalid/repeated cursor');
      cursor = payload.next_cursor;
      seen.add(cursor);
    }
  } catch (error) { result.error = error instanceof Error ? error.message : 'source unavailable'; }
  if (result.versions.includes('missing')) result.versions = [];
  return result;
}

export async function loadBackendReview(conditionId: string): Promise<BackendReview> {
  const config = openApiConfig();
  if (!config) throw new Error('OpenAPI credentials are not configured');
  const identity = createHash('sha256').update(`${config.baseUrl}|${config.apiKey}|${config.apiSecret}`).digest('hex');
  const key = `${identity}:${conditionId}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const active = pending.get(key);
  if (active) return active;
  if (pending.size >= 2) throw new Error('Review queries busy; retry shortly');
  const promise = (async () => {
    const now = Math.floor(Date.now() / 1000) * 1000;
    const deadline = AbortSignal.timeout(45_000);
    const api: Api = async (path, query) => {
      const target = pathWithSortedQuery(path, query);
      const response = await fetch(config.baseUrl + target, {headers:signedHeaders('GET',target,config.apiKey,config.apiSecret),cache:'no-store',redirect:'manual',signal:AbortSignal.any([deadline,AbortSignal.timeout(12_000)])});
      return readBoundedJson(response);
    };
    const market = await api('/openapi/v1/markets', { condition_id: conditionId });
    if (map(market.market).condition_id !== conditionId) throw new Error('Market identity mismatch');
    const to = String(now / 1000);
    // Read the two histories sequentially: no bursts or unbounded all-market fan-out.
    const fills = await readBackendPages(api, `/openapi/v1/dashboard/markets/${conditionId}/fills`, {to}, 'fills');
    const ledger = await readBackendPages(api, '/openapi/v1/account/activities', {condition_id:conditionId,to,ownership_type:'all'}, 'entries');
    const result = buildBackendReview({conditionId,market,fills,ledger,now});
    while (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, {expires:Date.now()+60_000,value:result});
    return result;
  })();
  pending.set(key,promise);
  try { return await promise; } finally { pending.delete(key); }
}
