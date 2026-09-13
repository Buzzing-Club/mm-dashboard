import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalBusiness, historicalQuery, historicalTraderCount } from '../app/historical-market-data.ts';

const end = 1789231500;
const source = items => ({ items, available: true, complete: true, versions: ['v1'] });
const fill = (id, patch = {}) => ({ id, timestamp_ns: String(BigInt(end - 10) * 1000000000n), status: 'success', exclude_from_net_volume: false,
  maker: { account_type: 'user', user_ref: 'a' }, taker: { account_type: 'user', user_ref: 'b' }, ...patch });
const history = () => ({ condition_id: 'c', amount_unit: 'usdb_raw6', covered_from: String(end - 3600),
  quality: { pnl_included: true, truncated: false, mark_price_source: 'last_trade_price' },
  points: [{ ts: String(end), gross_volume_cumulative: '12500000', net_volume_cumulative: '10000000', current_pnl: '-500000' }] });

test('historical requests never round forward or use the current clock as cutoff', () => {
  const q = historicalQuery(String(end + 12), '4h', (end + 86400) * 1000);
  assert.equal(q.end, end); assert.equal(q.start, end - 14400); assert.equal(q.interval, '1m');
  for (const value of [null, '', 'NaN', '-1', '0', String(end + 100000)]) assert.throws(() => historicalQuery(value, '1h', end * 1000));
});
test('net traders include both sides, deduplicate users, exclude internal and future rows', () => {
  const s = source([fill('1'), fill('1'), fill('2', { taker: { account_type: 'self' } }),
    fill('3', { exclude_from_net_volume: true }), fill('4', { timestamp_ns: String(BigInt(end) * 1000000000n), maker: { account_type: 'user', user_ref: 'future' } })]);
  assert.equal(historicalTraderCount(s, end), 2);
  assert.equal(historicalTraderCount(source([fill('1', { exclude_from_net_volume: true })]), end), 0);
  for (const patch of [{ complete: false }, { available: false }, { versions: [] }, { versions: ['v1', 'v2'] }]) assert.equal(historicalTraderCount({ ...s, ...patch }, end), null);
  assert.equal(historicalTraderCount(source([fill('1', { maker: { account_type: 'user' } })]), end), null);
  assert.equal(historicalTraderCount(source([fill('1', { timestamp_ns: 'bad' })]), end), null);
});
test('business data uses the final historical bucket, not latest realtime PnL', () => {
  const h = history(); h.points.push({ ...h.points[0], ts: String(end + 60), current_pnl: '99000000' });
  const r = historicalBusiness('c', end, h, source([fill('1')]));
  assert.equal(r.data.business.gross_volume, '12500000'); assert.equal(r.data.business.net_volume, '10000000');
  assert.equal(r.data.business.wash_ratio, .2); assert.equal(r.data.business.trader_count, 2);
  assert.equal(r.data.pnl.current_pnl, '-500000'); assert.equal(r.history.data.points.length, 1);
});
test('missing and truncated histories never become zero or stale totals', () => {
  for (const mutate of [h => h.quality.truncated = true, h => h.quality.pnl_included = false, h => h.points[0].current_pnl = '']) {
    const h = history(); mutate(h); assert.equal(historicalBusiness('c', end, h, source([])).data.pnl.current_pnl, null);
  }
  const h = history(); h.points[0].ts = String(end - 60);
  assert.equal(historicalBusiness('c', end, h, source([])).data.business.gross_volume, null);
  for (const patch of [{ condition_id: 'other' }, { amount_unit: 'shares' }]) assert.equal(historicalBusiness('c', end, { ...history(), ...patch }, source([])).history, null);
  const zero = history(); zero.points[0].gross_volume_cumulative = '0'; zero.points[0].net_volume_cumulative = '0';
  const r = historicalBusiness('c', end, zero, source([]));
  assert.equal(r.data.business.gross_volume, '0'); assert.equal(r.data.business.wash_ratio, null);
  assert.equal(r.data.business.trader_count, 0);
});
