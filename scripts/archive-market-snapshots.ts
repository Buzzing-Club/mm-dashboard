import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkpointMarket, finalizeMarketArchive } from '../app/market-archive-collector.ts';
import { marketArchiveDirectory } from '../app/market-archive-store.ts';
import { scopeDashboardMarkets } from '../app/dashboard-test-scope.ts';
import { map, rows } from '../app/review-facts.ts';

const source = process.env.STRATEGY_DASHBOARD_API;
if (!source || !process.env.REVIEW_SUMMARY_DIR) throw new Error('Persistent archive directory and strategy API are required');
const directory = marketArchiveDirectory();
await mkdir(directory, { recursive: true, mode: 0o700 });
const lock = join(directory, '.collector-lock');
try { await mkdir(lock); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  const pid = await readFile(join(lock, 'pid'), 'utf8').catch(() => '');
  if (!/^\d+$/.test(pid)) throw new Error('Collector lock has no valid owner; inspect before retry');
  const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
  if (cmdline.includes('archive-market-snapshots.ts')) process.exit(0);
  await rm(lock, { recursive: true });
  await mkdir(lock);
}
await writeFile(join(lock, 'pid'), String(process.pid), { mode: 0o600 });
try {
  const headers: Record<string, string> = { accept: 'application/json' };
  const client = process.env.CF_ACCESS_CLIENT_ID ?? process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET ?? process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  if (client && secret) { headers['CF-Access-Client-Id'] = client; headers['CF-Access-Client-Secret'] = secret; }
  async function read(url: URL, contract: string) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error(`Strategy HTTP ${response.status}`);
    const reader = response.body.getReader(); let bytes = 0, content = '';
    const decoder = new TextDecoder();
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length;
      if (bytes > 8_000_000) throw new Error('Strategy response too large'); content += decoder.decode(chunk.value, { stream: true }); } }
    finally { await reader.cancel(); }
    const payload = JSON.parse(content + decoder.decode());
    if (payload.contract_version !== contract || !Array.isArray(payload.items)) throw new Error('Invalid strategy contract');
    return rows(scopeDashboardMarkets(payload, process.env.DASHBOARD_TEST_CONDITION_IDS).items);
  }
  const historyUrl = new URL(process.env.STRATEGY_DASHBOARD_HISTORY_API ?? source);
  if (!process.env.STRATEGY_DASHBOARD_HISTORY_API) historyUrl.pathname = '/api/dashboard/history';
  historyUrl.searchParams.set('limit', '500');
  const historical = await read(historyUrl, 'mm-dashboard-history.v1');
  const endedIds = new Set(historical.map(item => map(item.identity).condition_id));
  const live = await read(new URL(source), 'mm-dashboard-realtime.v1');
  let checkpoints = 0, finalized = 0, failures = 0;
  // One market at a time; no raw fills are retained after each iteration.
  for (const item of historical) {
    try { await finalizeMarketArchive(directory, item, Date.now()); finalized++; }
    catch (error) { failures++; console.error('archive failure', map(item.identity).condition_id, String(error)); }
  }
  for (const item of live) {
    if (endedIds.has(map(item.identity).condition_id)) continue;
    try { await checkpointMarket(directory, item, Date.now()); checkpoints++; }
    catch (error) { failures++; console.error('checkpoint failure', map(item.identity).condition_id, String(error)); }
  }
  console.log(JSON.stringify({ checkpoints, finalized, failures }));
  if (failures) process.exitCode = 1;
} finally { await rm(lock, { recursive: true }); }
