import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archivedStrategy, captureLiveArchive, listMarketArchives, readMarketArchive, writeMarketArchive } from '../app/market-archive-store.ts';
import { fillArchiveGaps, finalizeMarketArchive } from '../app/market-archive-collector.ts';

const id = '0x' + 'a'.repeat(64), end = Date.parse('2026-09-14T10:00:00Z');
const book = { available: true, book_ts_ms: end - 5000, best_bid: '.4', best_ask: '.5', spread: '.1', ask_k: '5', bid_k: '6' };
const item = { identity: { condition_id: id }, lifecycle: { end_time: end / 1000 }, orderbook_quality: book,
  snapshot_meta: { captured_at: new Date(end + 1000).toISOString() }, experience_quality: { incidents: [{ type: 'test' }] } };
const finalBusiness = () => ({ code: 0, as_of: end / 1000, data: { condition_id: id,
  business: { gross_volume: '1000000' }, pnl: { current_pnl: '250000' }, slippage: { avg_trade_slippage: 0, sample_count: 2 } }, history: { code: 0, data: { points: [{ ts: end / 1000 }] } } });

test('last valid pre-end book survives empty, stale and post-end updates', () => {
  const live = captureLiveArchive(null, item, end - 1000);
  assert.equal(live.lastBook.at, end - 5000);
  for (const bookPatch of [{ best_bid: null, spread: null }, { book_ts_ms: end - 200000 }, { book_ts_ms: end + 1000 }, { ask_k: null }]) {
    const next = captureLiveArchive(live, { ...item, orderbook_quality: { ...book, ...bookPatch } }, end - 500);
    assert.deepEqual(next.lastBook, live.lastBook);
  }
  assert.throws(() => captureLiveArchive(live, item, end));
  const final = { ...live, finalized: true };
  assert.strictEqual(captureLiveArchive(final, item, end + 50000), final);
});

test('archive survives restart, is immutable on repeated finalization and reads without backend', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'market-archive-'));
  try {
    await writeMarketArchive(dir, captureLiveArchive(null, item, end - 1000));
    let calls = 0;
    const saved = await finalizeMarketArchive(dir, item, end + 2000, async () => { calls++; return finalBusiness(); });
    const before = await readFile(join(dir, `${id}.json`), 'utf8');
    await finalizeMarketArchive(dir, item, end + 86400000, async () => { throw new Error('offline'); });
    assert.equal(calls, 1);
    assert.equal(await readFile(join(dir, `${id}.json`), 'utf8'), before);
    const restored = await readMarketArchive(dir, id);
    assert.deepEqual(restored, saved);
    assert.deepEqual(archivedStrategy(restored).orderbook_quality, book);
    assert.equal(archivedStrategy(restored).dashboard_archive.business.data.slippage.sample_count, 2);
    assert.equal((await listMarketArchives(dir)).length, 1);
  } finally { await rm(dir, { recursive: true }); }
});

test('backend loss preserves last live business with explicit pre-end window provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'market-archive-'));
  try {
    const liveData = finalBusiness().data;
    await writeMarketArchive(dir, captureLiveArchive(null, item, end - 1000, liveData, { condition_id: id, points: [] }));
    const saved = await finalizeMarketArchive(dir, item, end + 2000, async () => { throw new Error('offline'); });
    assert.equal(saved.business.fallback, true);
    assert.equal(saved.business.data.pnl.current_pnl, '250000');
    assert.match(saved.business.notes[0], /24小时窗口/);
    assert.deepEqual(saved.lastBook.value, book);
  } finally { await rm(dir, { recursive: true }); }
});

test('backfill fills only missing fields; zero and retained time series are never overwritten', () => {
  assert.deepEqual(fillArchiveGaps({ zero: 0, missing: null, series: [1], nested: { old: 2 } },
    { zero: 10, missing: 3, series: [9], nested: { old: 4, added: 5 } }),
    { zero: 0, missing: 3, series: [1], nested: { old: 2, added: 5 } });
});

test('market identity and size limits protect persisted records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'market-archive-'));
  try {
    const saved = captureLiveArchive(null, item, end - 1000);
    await assert.rejects(writeMarketArchive(dir, { ...saved, id: '../bad' }));
    await assert.rejects(writeMarketArchive(dir, { ...saved, note: 'x'.repeat(2000001) }));
    assert.equal(await readMarketArchive(dir, '../bad'), null);
  } finally { await rm(dir, { recursive: true }); }
});

test('history page no longer calculates on selection; archive API has no backend fetch', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.ok(!page.includes('fetch(`/api/dashboard/historical-business'));
  assert.ok(page.includes('item.dashboard_archive'));
  const route = await readFile(new URL('../app/api/dashboard/historical-business/route.ts', import.meta.url), 'utf8');
  assert.ok(!route.includes('fetch('));
  assert.ok(route.includes('readMarketArchive'));
});
