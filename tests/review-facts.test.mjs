import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewFacts, finite } from "../app/review-facts.ts";
import { accountPnlSnapshot, accountPnlTotals } from "../app/review-account-pnl-data.ts";

const id = `0x${"a".repeat(64)}`;
const start = Date.parse("2026-09-11T00:00:00Z");
const minute = n => new Date(start + n * 60_000).toISOString();
const data = rows => ({ rows, available: true, capped: false });
function decision(n, fair = "0.4", q = 20) {
  return { decision_id: n + 1, condition_id: id, job_id: 1, created_at: minute(n), fair_value: fair,
    risk_state: { inventory: { yes: String(q + 1), no: "1" } },
    planned_orders: [{ execution_intent: "MM_QUOTE", qty: "2" }],
    active_orders_after: [{ position_id: "YES", side: "BUY", price: "0.4", qty: "10", filled_qty: "2", status: "ACCEPTED" }, { position_id: "YES", side: "SELL", price: "0.6", qty: "5", filled_qty: "1", status: "PARTIALLY_FILLED" }, { side: "SELL", qty: "1000", status: "SUBMITTED" }],
  };
}
function sources() {
  return {
    jobs: data([{ job_id: 1, account_id: 7, condition_id: id, job_type: "market_maker", enabled: true, config: {} }]),
    catalog: data([{ condition_id: id, start_time: start / 1000, end_time: start / 1000 + 3600, yes_position_id: "YES", no_position_id: "NO" }]),
    decisions: data([decision(0), decision(4), decision(13), decision(16), decision(49), decision(51, "0.6"), decision(53, "0.5"), decision(54, "0.4"), { ...decision(61), risk_state: { inventory: { yes: "6", no: "1" }, strategy_status: { lifecycle_mode: "waiting_result" } } }]),
    actions: data([{ action_id: 1, job_id: 1, condition_id: id, created_at: minute(61), order_id: "reduce", action: "place_result", execution_intent: "MM_QUOTE", request: { side: "SELL", qty: "5", position_id: "YES", audit_reason: "waiting_result_reduce_only_sell" }, result: { ok: true } }]),
    fills: data([{ fill_key: "f1", condition_id: id, account_id: 7, settled_at: minute(14), execution_intent: "MM_QUOTE", qty: "2", side: "BUY" }, { fill_key: "f2", condition_id: id, account_id: 7, settled_at: minute(62), execution_intent: "MM_QUOTE", qty: "2", side: "SELL", order_id: "reduce" }]),
  };
}
test("sampled review follows risk area and residual inventory definitions", () => {
  const source = sources();
  const p = buildReviewFacts(id, source, start + 70 * 60_000);
  const m = p.section_seven.metrics;
  assert.deepEqual(Object.keys(m).sort(), ["exposureTime", "firstImbalance", "reversals", "reversalExposure", "bookStructure", "reduction"].sort());
  assert.equal(m.firstImbalance.value, 0);
  assert.equal(m.supplyConversion, undefined);
  assert.match(p.section_seven.unavailable.supplyConversion, /不能用其总数作分母/);
  assert.equal(m.reversals.value, 2);
  assert.equal(m.bookStructure.value, 0.5);
  assert.equal(m.reduction.value, 25);
  assert.equal(m.reduction.observations[0].value, 5);
  assert.equal(m.reduction.observations[1].value, 20);
  assert.ok(Math.abs(m.exposureTime.value - 4 / 12 * 100) < 1e-9);
  assert.equal(m.exposureTime.details.reduce((sum, row) => sum + row.value, 0), 240);
  assert.equal(m.toxicity, undefined);
  assert.equal(p.section_seven.pnl, null);
});
test("unknown data is not zero; no invented market bounds or gap interpolation", () => {
  const source = sources();
  source.catalog.rows[0].start_time = 0;
  let p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.deepEqual(p.section_seven.metrics, {});
  source.catalog.rows[0].create_time = start / 1000;
  source.decisions.rows = [decision(0), decision(59)];
  p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.equal(p.section_seven.metrics.exposureTime, undefined);
  source.decisions.rows = [];
  p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.deepEqual(p.section_seven.metrics, {});
  assert.equal(finite(""), null);
  assert.equal(finite(null), null);
  assert.equal(finite("0"), 0);
});
test("deduplication and task/account/intent isolation", () => {
  const source = sources();
  source.decisions.rows.push(source.decisions.rows[0], { ...decision(15), job_id: 2 });
  source.fills.rows.push(source.fills.rows[0], { ...source.fills.rows[0], fill_key: "tv", execution_intent: "TRADE_VOLUME_ACTIVE" }, { ...source.fills.rows[0], fill_key: "other", account_id: 8 });
  source.actions.rows.push({ ...source.actions.rows[0], action_id: 2 }, { ...source.actions.rows[0], action_id: 3, order_id: "failed", result: { ok: false } });
  const p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.equal(p.coverage.decisionCount, 9);
  assert.equal(p.coverage.fillCount, 2);
  assert.equal(p.section_seven.metrics.reduction.value, 25);
});
test("phase boundary and truncated fill history do not fabricate conversion", () => {
  const source = sources();
  source.decisions.rows = [decision(12), decision(16), decision(48, "0.6")];
  source.fills.capped = true;
  source.fills.rows = [{ ...source.fills.rows[0], settled_at: minute(50) }];
  const p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.equal(p.section_seven.metrics.supplyConversion, undefined);
  assert.equal(p.section_seven.metrics.reversals, undefined);
  assert.ok(p.coverage.notes.some(note => note.includes("fills 达到")));
});
test("residual inventory does not depend on fills or repeated reduction orders", () => {
  const source = sources();
  source.fills = { rows: [], available: false, capped: false };
  const p = buildReviewFacts(id, source, start + 70 * 60_000);
  assert.equal(p.section_seven.metrics.reduction.value, 25);
  assert.ok(!p.section_seven.metrics.reduction.observations.some(row => row.label === "对应卖出成交"));
  assert.equal(p.section_seven.metrics.supplyConversion, undefined);
});

test("document NO inventory example: 15/45 and 35/45, never accepted order volume", () => {
  for (const residual of [15, 35]) {
    const source = sources();
    source.decisions.rows = [
      { ...decision(1), risk_state: { inventory: { yes: "1", no: "46" } } },
      { ...decision(61), risk_state: { inventory: { yes: "1", no: String(residual + 1) }, strategy_status: { lifecycle_mode: "waiting_result" } } },
    ];
    source.actions.rows[0].request.qty = "10000";
    const m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics;
    assert.equal(m.reduction.value, residual / 45 * 100);
    assert.match(m.reduction.observations[0].label, /NO/);
    source.decisions.rows[1].risk_state.strategy_status.lifecycle_mode = "final";
    assert.equal(buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.reduction, undefined);
  }
});

test("book structure separates complementary outcomes and counts distinct prices", () => {
  const source = sources();
  const order = (position_id, side, qty, price) => ({ position_id, side, qty, price, filled_qty: 0, status: "ACCEPTED" });
  source.decisions.rows = [{ ...decision(50), active_orders_after: [
    order("YES", "SELL", 40, 0.7), order("YES", "SELL", 40, "0.70"), order("YES", "BUY", 10, 0.6),
    order("NO", "BUY", 500, 0.3), order("NO", "SELL", 1, 0.4),
  ] }];
  let m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.bookStructure;
  assert.equal(m.value, 8);
  assert.equal(m.details.find(row => row.label === "YES Ask 档位").value, 1);
  assert.ok(Math.abs(m.observations.find(row => row.label === "YES Ask量").value - 80 / 90 * 100) < 1e-9);
  source.decisions.rows[0].active_orders_after = [order("YES", "SELL", 80, 0.7)];
  m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.bookStructure;
  assert.equal(m.value, null);
  assert.equal(m.details.find(row => row.label === "YES Bid 数量").value, 0);
});

test("reversal follow-ups retain signed exposure and distinguish missing samples", () => {
  const source = sources();
  source.decisions.rows = [decision(49, "0.73", 50), decision(50, "0.49", 55), decision(50.5, "0.48", 70), decision(52, "0.47", 65)];
  const m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics;
  assert.equal(m.reversals.value, 1);
  assert.equal(m.reversalExposure.value, 55);
  assert.deepEqual(m.reversalExposure.details.map(row => row.value), [70, 65]);
  source.decisions.rows.pop();
  assert.equal(buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.reversalExposure.details[1].value, null);
});

test("risk area splits market-time boundaries; unavailable opening area is not zero", () => {
  const source = sources();
  source.decisions.rows = [decision(10, "0.4", 30), decision(14, "0.4", 30)];
  let m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.exposureTime;
  assert.equal(m.value, 50);
  assert.deepEqual(m.details.map(row => row.value), [60, 60]);
  source.decisions.rows = [decision(14), decision(16)];
  m = buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.exposureTime;
  assert.equal(m.value, null);
});

test("crossing into the tail counts with a nearby pre-tail anchor", () => {
  const source = sources();
  source.decisions.rows = [decision(47.9, "0.6"), decision(48.1, "0.4")];
  assert.equal(buildReviewFacts(id, source, start + 70 * 60_000).section_seven.metrics.reversals.value, 1);
});
test("portfolio PnL deduplicates markets, handles raw6 and exposes partial failures", () => {
  const b = `0x${"b".repeat(64)}`, c = `0x${"c".repeat(64)}`;
  const item = (condition_id, realized_pnl, unrealized_pnl, current_pnl) => ({ condition_id, pnl: { realized_pnl, unrealized_pnl, current_pnl } });
  const payload = { code: 0, data: { amount_unit: "usdb_raw6", items: [item(id, "2000000", "-500000", "1500000"), item(b, "1000000", "0", "1000000"), item(c, "", "", "")] } };
  const snapshot = accountPnlSnapshot([id, id, b, c], [payload, payload], "now");
  assert.equal(snapshot.expected, 3);
  assert.equal(snapshot.rows.length, 2);
  assert.deepEqual(snapshot.missing, [c]);
  assert.deepEqual(accountPnlTotals(snapshot), { realized: 3, unrealized: -0.5, total: 2.5 });
  assert.equal(accountPnlTotals(accountPnlSnapshot([id], [{ code: 1, data: payload.data }], "now")), null);
  assert.equal(accountPnlTotals(accountPnlSnapshot([id], [{ ...payload, data: { ...payload.data, amount_unit: "usdb" } }], "now")), null);
});
