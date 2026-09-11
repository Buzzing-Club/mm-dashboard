import test from "node:test";
import assert from "node:assert/strict";
import { buildSectionSevenDemo } from "../app/review-section-seven-demo.ts";
import { aggregateLifecyclePnl } from "../app/review-section-seven-data.ts";

test("document examples remain numerically consistent", () => {
  const market = { id: "a", event: "Example", pnl: 0, grossVolume: 0, startAt: "2026-09-11T00:00:00Z", endAt: "2026-09-11T01:00:00Z" };
  const { metrics: m, pnl } = buildSectionSevenDemo(market, [market]);
  assert.equal(Object.keys(m).length, 13);
  for (const [id, metric] of Object.entries(m)) {
    assert.ok(Number.isFinite(metric.value), `${id} must have a numeric example`);
    assert.ok(metric.observations.length > 0, `${id} must have chart samples`);
    assert.ok(metric.observations.every(row => Number.isFinite(row.value)), `${id} chart must be complete`);
  }
  assert.equal(m.toxicity.value, 30);
  assert.equal(m.exposureTime.value, 50);
  assert.equal(m.supplyConversion.value, 3);
  assert.equal(m.reduction.value, 15 / 45 * 100);
  assert.equal(m.bookStructure.value, 8);
  assert.equal(m.levelsConsumed.observations.reduce((sum, row) => sum + row.value, 0), 100);
  assert.equal(m.levelsConsumed.observations.reduce((sum, row, i) => sum + row.value * (i + 1), 0) / 100, m.levelsConsumed.value);
  const series = m.exposureTime.exposureSeries;
  const area = series.slice(0, -1).reduce((sum, row, i) => sum + row.value * (series[i + 1].at - row.at) / 60_000, 0);
  assert.equal(area, 1200);
  for (const row of pnl) {
    assert.equal(row.lots.reduce((sum, lot) => sum + (lot.exitPrice - lot.entryPrice) * lot.quantity, 0), row.exposurePnl);
    assert.notEqual(row.totalPnl, row.spreadPnl + row.exposurePnl);
  }
  assert.equal(aggregateLifecyclePnl(pnl).volume, pnl.at(-1).volume);
});

test("all demo markets have every metric, all three PnL phases and populated lots", () => {
  const markets = Array.from({ length: 12 }, (_, index) => ({ id: String(index), event: `Example ${index}`, pnl: 0, grossVolume: 0, startAt: "2026-09-11T00:00:00Z", endAt: "2026-09-11T10:00:00Z" }));
  for (const market of markets) {
    const data = buildSectionSevenDemo(market, markets);
    assert.equal(Object.keys(data.metrics).length, 13);
    assert.ok(Object.values(data.metrics).every(metric => Number.isFinite(metric.value) && metric.observations.length));
    assert.equal(data.metrics.exposureTime.exposureSeries.length, 4);
    assert.equal(data.pnl.length, markets.length * 3);
    for (const row of data.pnl) {
      for (const key of ["spreadPnl", "exposurePnl", "totalPnl", "volume", "endingExposure", "maxExposure"]) assert.ok(Number.isFinite(row[key]));
      assert.ok(row.lots.length);
    }
    assert.ok(data.pnl.some(row => row.totalPnl > 0));
    assert.ok(data.pnl.some(row => row.totalPnl < 0));
  }
});
