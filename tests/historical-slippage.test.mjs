import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalSlippage } from '../app/historical-slippage.ts';
import { historicalBusiness } from '../app/historical-market-data.ts';

const end = 1789297200;
const source = items => ({ items, available: true, complete: true, versions: ['v1'] });
const fill = (id, price, patch = {}) => ({ id, timestamp_ns: String(BigInt(end - 10) * 1000000000n),
  status: 'success', exclude_from_net_volume: false, order_fill_count: 2, level_index: Number(id),
  taker: { order_ref: 'order', side: 'buy', outcome: 'yes', price, quote_amount: '1000000' }, ...patch });

test('matches backend first-fill L1, averages by fill rather than size, no quote snapshot needed', () => {
  const a = fill('1', '.4'), b = fill('2', '.44');
  b.taker.quote_amount = '99000000';
  const result = historicalSlippage(source([a, b, a]), end);
  assert.equal(result.avg_trade_slippage, .02);
  assert.equal(result.sample_count, 2);
  assert.deepEqual(result.distribution.map(x => x.trade_count), [1, 0, 1, 0]);
  assert.equal(historicalBusiness('c', end, null, source([a, b])).data.slippage.avg_trade_slippage, .02);
});

test('sell uses highest taker price in its own outcome, never maker price', () => {
  const a = fill('1', '.6'), b = fill('2', '.55');
  for (const row of [a, b]) { row.taker.side = 'sell'; row.taker.outcome = 'no'; row.maker = { price: '.01' }; }
  const result = historicalSlippage(source([a, b]), end);
  assert.equal(result.avg_trade_slippage, .025);
  assert.deepEqual(result.distribution.map(x => x.trade_count), [1, 0, 0, 1]);
});

test('internal fills may define the order reference but never enter the net mean', () => {
  const result = historicalSlippage(source([fill('1', '.4', { exclude_from_net_volume: true }), fill('2', '.44')]), end);
  assert.equal(result.avg_trade_slippage, .04);
  assert.equal(result.sample_count, 1);
});

test('valid single-level zero differs from no external samples', () => {
  const single = fill('1', '.4', { order_fill_count: 1 });
  assert.equal(historicalSlippage(source([single]), end).avg_trade_slippage, 0);
  assert.equal(historicalSlippage(source([{ ...single, exclude_from_net_volume: true }]), end).avg_trade_slippage, null);
  assert.equal(historicalSlippage(source([]), end).avg_trade_slippage, null);
});

test('incomplete history, classification, order groups and invalid fields do not fabricate values', () => {
  const rows = [fill('1', '.4'), fill('2', '.44')];
  for (const patch of [{ complete: false }, { available: false }, { versions: [] }, { versions: ['v1', 'v2'] }]) {
    assert.equal(historicalSlippage({ ...source(rows), ...patch }, end).avg_trade_slippage, null);
  }
  assert.equal(historicalSlippage(source(rows.slice(0, 1)), end).avg_trade_slippage, null);
  for (const patch of [{ timestamp_ns: 'bad' }, { level_index: 1 }, { status: 'unknown' }, { exclude_from_net_volume: undefined },
    { taker: { ...rows[1].taker, price: '' } }, { taker: { ...rows[1].taker, order_ref: '' } }]) {
    assert.equal(historicalSlippage(source([rows[0], { ...rows[1], ...patch }]), end).avg_trade_slippage, null);
  }
});

test('never includes trades after cutoff or falsely treats a split order as one-level', () => {
  const late = fill('2', '.44', { timestamp_ns: String(BigInt(end) * 1000000000n) });
  assert.equal(historicalSlippage(source([fill('1', '.4'), late]), end).avg_trade_slippage, null);
  const single = fill('1', '.4', { order_fill_count: 1 });
  late.taker.order_ref = 'later';
  assert.equal(historicalSlippage(source([single, late]), end).avg_trade_slippage, 0);
});
