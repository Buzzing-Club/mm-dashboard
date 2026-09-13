import test from 'node:test';
import assert from 'node:assert/strict';
import { chartWindow, sampledSlippage } from '../app/chart-window.ts';

test('liquidity window follows observations, not the future market end', () => {
  const now = 100_000_000;
  const points = [now - 7200000, now - 1200000, now - 600000, now, now + 3600000].map(ts => ({ ts }));
  const view = chartWindow(points, '15m', now - 86400000, now + 86400000, now);
  assert.equal(view.from, now - 900000);
  assert.equal(view.through, now);
  assert.equal(view.points.length, 2);
  assert.equal(chartWindow(points, '4h', now - 86400000, now + 86400000, now).points.length, 4);
});

test('historical and single-point domains are bounded without inventing points', () => {
  const view = chartWindow([{ ts: 10000 }], '15m', 10000, 20000, 30000);
  assert.ok(view.through > view.from);
  assert.equal(view.points.length, 1);
  assert.deepEqual(chartWindow([], '1h', 10000, 20000, 30000).points, []);
});

test('zero samples differs from measured zero slippage', () => {
  assert.equal(sampledSlippage('0', 0), null);
  assert.equal(sampledSlippage('0', 3), 0);
  assert.equal(sampledSlippage('0.0025', 4), 0.25);
  assert.equal(sampledSlippage('', 1), null);
});
