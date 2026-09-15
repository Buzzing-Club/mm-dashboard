import { openApiConfig, pathWithSortedQuery, signedHeaders } from '../openapi.ts';
import { readBoundedJson } from '../review-backend/loader.ts';
import { epochMs, map } from '../../../review-facts.ts';
import { buildEngagement, ENGAGEMENT_STAGES, exportDate, type EngagementEnvironment, type ReviewEngagement } from '../../../review-engagement.ts';

const MAX_WINDOW_MS = 31 * 86_400_000;
const MAX_EXPORT_BYTES = 20_000_000;
// Raw Export 限额约 60 次/小时，且与其他使用同一 Service Account 的查询共享；本进程最多用一半。
const HOURLY_EXPORT_BUDGET = 30;
const exportCalls: number[] = [];
const cache = new Map<string, { expires: number; value: ReviewEngagement }>();
const pending = new Map<string, Promise<ReviewEngagement>>();

export function mixpanelConfig() {
  const user = process.env.MIXPANEL_SA_USER, secret = process.env.MIXPANEL_SA_SECRET, projectId = process.env.MIXPANEL_PROJECT_ID;
  const environment = (process.env.MIXPANEL_ENVIRONMENT ?? 'preview') as EngagementEnvironment;
  const exportBase = (process.env.MIXPANEL_EXPORT_BASE ?? 'https://data-eu.mixpanel.com').replace(/\/+$/, '');
  if (!user || !secret || !projectId || !/^\d+$/.test(projectId)) return null;
  if (environment !== 'preview' && environment !== 'prod') return null;
  return { user, secret, projectId, environment, exportBase };
}

export function takeExportBudget(now = Date.now(), calls = exportCalls, budget = HOURLY_EXPORT_BUDGET) {
  while (calls.length && calls[0] <= now - 3600_000) calls.shift();
  if (calls.length >= budget) return false;
  calls.push(now);
  return true;
}

export function parseExportLines(body: string) {
  const rows: Array<{ event?: unknown; properties?: Record<string, unknown> }> = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  return rows;
}

async function readExport(response: Response) {
  if (!response.ok || !response.body) throw new Error(`Mixpanel export HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '', bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_EXPORT_BYTES) throw new Error('Mixpanel export size limit');
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally { await reader.cancel(); }
  return parseExportLines(body);
}

// 市场窗口 = 创建时间 → 结束时间（未结束则到现在），最长 31 天，超出时保留靠近结束的一段并标记不完整。
export function engagementWindow(startMs: number | null, endMs: number | null, now: number) {
  const through = Math.min(endMs ?? now, now);
  const start = startMs ?? through - MAX_WINDOW_MS;
  const from = Math.max(start, through - MAX_WINDOW_MS);
  return { fromMs: from, throughMs: through, complete: startMs !== null && from === start && (endMs ?? Infinity) <= now };
}

export async function loadReviewEngagement(conditionId: string): Promise<ReviewEngagement> {
  const openapi = openApiConfig();
  if (!openapi) throw new Error('OpenAPI credentials are not configured');
  const mixpanel = mixpanelConfig();
  if (!mixpanel) throw new Error('Mixpanel credentials are not configured');
  const key = `${mixpanel.projectId}:${mixpanel.environment}:${conditionId}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const active = pending.get(key);
  if (active) return active;
  if (pending.size >= 2) throw new Error('Engagement queries busy; retry shortly');
  const promise = (async () => {
    const target = pathWithSortedQuery('/openapi/v1/markets', { condition_id: conditionId });
    const detail = await readBoundedJson(await fetch(openapi.baseUrl + target, {
      headers: signedHeaders('GET', target, openapi.apiKey, openapi.apiSecret), cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(12_000),
    }));
    const market = map(detail.market), event = map(detail.event);
    if (market.condition_id !== conditionId) throw new Error('Market identity mismatch');
    const marketId = String(market.id ?? '');
    if (!/^\d+$/.test(marketId)) throw new Error('Market id missing');
    const now = Date.now();
    const window = engagementWindow(epochMs(market.create_time) ?? epochMs(event.create_time), epochMs(market.market_end_date) ?? epochMs(event.end_date), now);
    if (!takeExportBudget(now)) throw new Error('Mixpanel hourly query budget reached; retry later');
    const query = new URLSearchParams({
      project_id: mixpanel.projectId,
      from_date: exportDate(window.fromMs),
      to_date: exportDate(window.throughMs),
      event: JSON.stringify(ENGAGEMENT_STAGES.map((stage) => stage.event)),
      where: `string(properties["market_id"]) == "${marketId}"`,
    });
    const response = await fetch(`${mixpanel.exportBase}/api/2.0/export?${query.toString()}`, {
      headers: { authorization: `Basic ${Buffer.from(`${mixpanel.user}:${mixpanel.secret}`).toString('base64')}`, accept: 'application/x-ndjson' },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(40_000),
    });
    const rows = await readExport(response);
    const notes = window.complete ? [] : ['市场未结束或窗口超过 31 天，漏斗只覆盖展示的时间段。'];
    const result = buildEngagement({ rows, conditionId, marketId, environment: mixpanel.environment, ...window, notes });
    while (cache.size >= 64) cache.delete(cache.keys().next().value!);
    // 已结束市场的埋点基本不再变化，缓存更久以节省 Raw Export 配额。
    cache.set(key, { expires: Date.now() + (window.complete ? 6 * 3600_000 : 10 * 60_000), value: result });
    return result;
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
