import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalListKey, historicalMissingLabel, loadHistoricalList } from '../app/historical-list-loader.ts';

const targets = ['a', 'b', 'c'].map(id => ({ id, snapshotAt: '2026-09-13T11:00:00Z', startAt: '2026-09-13T10:00:00Z' }));
function setup(overrides = {}) {
  return { timeframe: '1h', signal: new AbortController().signal, cache: new Map(), refresh: false,
    load: async target => target.id, onStart() {}, onResult() {}, onError() {}, ...overrides };
}

test('all list markets load without selecting them; requests are serial and deduplicated', async () => {
  let active = 0, peak = 0;
  const results = [];
  const options = setup({ load: async target => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--; return target.id;
  }, onResult: (key, result) => results.push(result) });
  await loadHistoricalList([...targets, targets[0]], options);
  assert.equal(peak, 1);
  assert.deepEqual(results, ['a', 'b', 'c']);
  assert.equal(options.cache.size, 3);
});

test('reopening uses cache; explicit refresh reloads; timeframe and snapshot have separate keys', async () => {
  let loads = 0;
  const options = setup({ load: async () => ++loads });
  await loadHistoricalList(targets, options);
  await loadHistoricalList(targets, options);
  assert.equal(loads, 3);
  await loadHistoricalList(targets, { ...options, refresh: true });
  assert.equal(loads, 6);
  await loadHistoricalList(targets, { ...options, timeframe: '4h' });
  assert.equal(loads, 9);
  assert.notEqual(historicalListKey(targets[0], '1h'), historicalListKey({ ...targets[0], snapshotAt: 'later' }, '1h'));
});

test('one failure does not stop the list or erase cached values; failed entries can retry', async () => {
  const errors = [];
  const options = setup({ load: async target => { if (target.id === 'b') throw new Error('offline'); return target.id; }, onError: key => errors.push(key) });
  await loadHistoricalList(targets, options);
  assert.equal(errors.length, 1);
  assert.equal(options.cache.size, 2);
  await loadHistoricalList(targets, { ...options, load: async target => target.id });
  assert.equal(options.cache.size, 3);
  await loadHistoricalList(targets, { ...options, refresh: true });
  assert.equal(options.cache.get(historicalListKey(targets[1], '1h')), 'b');
});

test('leaving the list stops queued work and ignores late responses', async () => {
  const controller = new AbortController();
  let loads = 0, results = 0;
  const options = setup({ signal: controller.signal, load: async () => { loads++; controller.abort(); return 'late'; }, onResult: () => results++ });
  await loadHistoricalList(targets, options);
  assert.equal(loads, 1);
  assert.equal(results, 0);
  assert.equal(options.cache.size, 0);
});

test('loading, missing data and fetch failure are distinct and never fabricated zeros', () => {
  assert.equal(historicalMissingLabel('成交额'), '成交额加载中');
  assert.equal(historicalMissingLabel('成交额', 'loading'), '成交额加载中');
  assert.equal(historicalMissingLabel('成交额', 'ready'), '成交额暂无数据');
  assert.equal(historicalMissingLabel('PnL ', 'error'), 'PnL 读取失败');
});
