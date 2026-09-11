import { marketReviewWindows, type SectionSevenData, type SectionSevenMetric } from "./review-section-seven-data.ts";

export type Fact = Record<string, unknown>;
export type FactSource = { rows: Fact[]; available: boolean; capped: boolean };
export type ReviewFacts = {
  jobs: FactSource; catalog: FactSource; decisions: FactSource; actions: FactSource; fills: FactSource;
};
export type ReviewFactsPayload = {
  contract_version: "mm-dashboard-review.v2";
  condition_id: string;
  section_seven: SectionSevenData;
  coverage: { decisionCount: number; fillCount: number; from: number | null; through: number | null; notes: string[] };
};

export const map = (value: unknown): Fact => value && typeof value === "object" && !Array.isArray(value) ? value as Fact : {};
export const rows = (value: unknown): Fact[] => Array.isArray(value) ? value.map(map) : [];
export function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function epochMs(value: unknown): number | null {
  const n = finite(value);
  if (n !== null) return n > 0 ? (n < 1e11 ? n * 1000 : n) : null;
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
const upper = (value: unknown) => String(value ?? "").toUpperCase();
const same = (a: unknown, b: unknown) => a !== undefined && b !== undefined && String(a) === String(b);
const mmOrder = (row: Fact) => upper(row.execution_intent) === "MM_QUOTE";
const unique = (items: Fact[], key: string) => [...new Map(items.filter(row => row[key] !== null && row[key] !== undefined && row[key] !== "").map(row => [String(row[key]), row])).values()];

// Only integrate between nearby observed decisions. Never carry a stale snapshot
// across an outage or extrapolate it to the scheduled end of a market.
const MAX_GAP_MS = 5 * 60_000;
export function buildReviewFacts(conditionId: string, source: ReviewFacts, now: number): ReviewFactsPayload {
  const market = source.catalog.rows.find(row => same(row.condition_id, conditionId)) ?? {};
  const jobs = source.jobs.rows.filter(row => same(row.condition_id, conditionId) && row.job_type === "market_maker");
  const job = [...jobs].sort((a, b) => Number(Boolean(b.enabled)) - Number(Boolean(a.enabled)) || Number(b.job_id) - Number(a.job_id))[0];
  const start = epochMs(market.start_time) ?? epochMs(market.create_time);
  const end = epochMs(market.end_time);
  const windows = start !== null && end !== null ? marketReviewWindows(new Date(start).toISOString(), new Date(end).toISOString()) : null;
  const metrics: SectionSevenData["metrics"] = {};
  const notes = ["历史采样，非完整逐 tick 复盘；决策取选中做市任务，成交取同账户同市场 MM_QUOTE，不包含刷量成交。"];
  for (const [name, result] of Object.entries(source)) {
    if (!result.available) notes.push(`${name} 数据源不可用`);
    else if (result.capped) notes.push(`${name} 达到最近记录上限，历史可能截断`);
  }
  if (!job) notes.push("未找到可确认归属的做市任务");
  if (!windows) notes.push("缺少有效市场起止时间");
  if (jobs.length > 1) notes.push("同市场存在多个做市任务，本页仅统计当前优先任务");
  const decisions = job ? unique(source.decisions.rows.filter(row => same(row.condition_id, conditionId) && same(row.job_id, job.job_id)), "decision_id")
    .map(row => {
      const inventory = map(map(row.risk_state).inventory);
      const yes = finite(inventory.yes), no = finite(inventory.no);
      return { row, ts: epochMs(row.created_at), yes, no, q: yes !== null && no !== null ? yes - no : null, fair: finite(row.fair_value) };
    }).filter(row => row.ts !== null && row.ts <= now).sort((a, b) => a.ts! - b.ts!) : [];
  const fills = job ? unique(source.fills.rows.filter(row => same(row.condition_id, conditionId) && same(row.account_id, job.account_id) && mmOrder(row)), "fill_key") : [];
  const coverage = { decisionCount: decisions.length, fillCount: fills.length, from: decisions[0]?.ts ?? null, through: decisions.at(-1)?.ts ?? null, notes };
  if (!windows || !job) return { contract_version: "mm-dashboard-review.v2", condition_id: conditionId, section_seven: { metrics, pnl: null }, coverage };
  const inWindow = (ts: number, index: number) => ts >= windows[index].start && ts < Math.min(windows[index].end, now);
  const metric = (value: number, observations: SectionSevenMetric["observations"], note: string, observationUnit?: string): SectionSevenMetric => ({ value, observations, observationUnit, note, precision: "sampled" });
  const sampled = decisions.filter(row => row.ts! >= start! && row.ts! < Math.min(end!, now));
  const exposure = windows.map(window => {
    let integral = 0, duration = 0;
    for (let i = 0; i + 1 < decisions.length; i++) {
      const a = decisions[i], b = decisions[i + 1];
      const gap = b.ts! - a.ts!;
      if (a.q === null || gap <= 0 || gap > MAX_GAP_MS) continue;
      const overlap = Math.max(0, Math.min(b.ts!, window.end, now) - Math.max(a.ts!, window.start));
      integral += Math.abs(a.q) * overlap / 3_600_000;
      duration += overlap;
    }
    return { label: window.phase, value: integral, duration };
  });
  if (exposure.some(row => row.duration > 0)) metrics.exposureTime = metric(
    exposure.reduce((sum, row) => sum + row.value, 0), exposure.filter(row => row.duration > 0).map(({ label, value }) => ({ label, value })),
    `采样覆盖 ${(exposure.reduce((sum, row) => sum + row.duration, 0) / 60_000).toFixed(1)} 分钟；相邻记录超过 5 分钟的区间不计。`, "sh·h",
  );
  const imbalance = sampled.find(row => row.q !== null && Math.abs(row.q) > 15 && row.yes! >= 0 && row.no! >= 0 && Math.max(row.yes!, row.no!) / (row.yes! + row.no!) > 0.9);
  if (imbalance) {
    const value = (imbalance.ts! - start!) / (end! - start!) * 100;
    metrics.firstImbalance = metric(value, [{ label: "首次观测", value }], "已返回采样中的首次越界，不保证是生命周期首次。", "% 生命周期");
  }
  // Do not equate independent process counters with a single-market ratio.
  // Both facts must cover the same bounded observation interval.
  if (source.decisions.available && source.fills.available && decisions.length > 1) {
    const fillFloor = source.fills.capped ? Math.min(...source.fills.rows.map(row => epochMs(row.settled_at) ?? Infinity)) : 0;
    const from = Math.max(windows[1].start, decisions[0].ts!, fillFloor);
    const through = Math.min(windows[1].end, decisions.at(-1)!.ts!, now);
    const planned = decisions.filter(row => row.ts! >= from && row.ts! < through).flatMap(row => rows(row.row.planned_orders)).filter(mmOrder).length;
    const count = fills.filter(row => { const ts = epochMs(row.settled_at); return ts !== null && ts >= from && ts < through; }).length;
    if (from < through && planned > 0) metrics.supplyConversion = metric(count / planned * 100, [{ label: "计划订单", value: planned }, { label: "确认成交", value: count }], "同一采样窗口内同账户、同市场的 MM_QUOTE 成交笔数 / 当前任务语义变化决策中的计划订单笔数；不是订单成交率。", "笔");
  }
  const reversalEvents: Array<{ label: string; value: number; direction: number }> = [];
  let comparisons = 0;
  let anchor: typeof sampled[number] | undefined;
  for (const point of sampled.filter(row => inWindow(row.ts!, 2))) {
    if (point.fair === null || point.fair <= 0 || point.fair >= 1) { anchor = undefined; continue; }
    if (anchor && point.ts! - anchor.ts! <= MAX_GAP_MS) {
      comparisons++;
      if (point.fair !== 0.5 && (point.fair - 0.5) * (anchor.fair! - 0.5) < 0) {
        reversalEvents.push({ label: new Date(point.ts!).toISOString(), value: point.q ?? NaN, direction: point.fair > 0.5 ? 1 : -1 });
      }
    }
    if (point.fair !== 0.5) anchor = point;
  }
  if (comparisons > 0) metrics.reversals = metric(reversalEvents.length, [{ label: "向上", value: reversalEvents.filter(row => row.direction > 0).length }, { label: "向下", value: reversalEvents.filter(row => row.direction < 0).length }], `尾盘 ${comparisons} 次有效采样比较；间隔超过 5 分钟不推断跨越，可能漏计。`, "次");
  const withInventory = reversalEvents.filter(row => Number.isFinite(row.value));
  if (withInventory.length) metrics.reversalExposure = metric(withInventory.at(-1)!.value, withInventory.map(({ label, value }) => ({ label: label.slice(11, 19) + "Z", value })), "采样首次发现反转时的净库存，不是精确穿越时刻。", "shares");
  const latestTail = sampled.filter(row => inWindow(row.ts!, 2) && Array.isArray(row.row.active_orders_after)).at(-1);
  if (latestTail) {
    const orders = rows(latestTail.row.active_orders_after).filter(row => ["ACCEPTED", "PARTIALLY_FILLED"].includes(upper(row.status)));
    const remaining = (side: string) => orders.filter(row => upper(row.side) === side).reduce((sum, row) => sum + Math.max(0, (finite(row.qty) ?? 0) - (finite(row.filled_qty) ?? 0)), 0);
    const ask = remaining("SELL"), bid = remaining("BUY");
    if (bid > 0) metrics.bookStructure = metric(ask / bid, [{ label: "Ask", value: ask }, { label: "Bid", value: bid }], "尾盘最近一份决策中已确认订单的剩余数量，两种 outcome 合计；不含在途订单。", "shares");
    else notes.push("尾盘订单采样无有效 Bid 数量，盘口比例不可计算");
  }
  const config = map(job.config);
  const yesId = String(market.yes_position_id ?? config.yes_position_id ?? "");
  const noId = String(market.no_position_id ?? config.no_position_id ?? "");
  const actions = unique(source.actions.rows.filter(row => {
    const ts = epochMs(row.created_at);
    return ts !== null && ts >= start! && ts <= now && same(row.condition_id, conditionId) && same(row.job_id, job.job_id) && row.action === "place_result" && map(row.result).ok === true && map(row.request).audit_reason === "waiting_result_reduce_only_sell" && upper(map(row.request).side) === "SELL" && mmOrder(row);
  }), "action_id");
  const byOrder = unique(actions.map(row => ({ ...row, identity: row.order_id || row.client_order_id })), "identity");
  let numerator = 0, denominator = 0;
  for (const [position, sign] of [[yesId, 1], [noId, -1]] as const) {
    if (!position) continue;
    const quantity = byOrder.filter(row => same(map(row.request).position_id, position)).reduce((sum, row) => sum + Math.max(0, finite(map(row.request).qty) ?? 0), 0);
    const peak = Math.max(0, ...sampled.map(row => (row.q ?? 0) * sign));
    if (quantity > 0 && peak > 0) { numerator += quantity; denominator += peak; }
  }
  if (denominator > 0) {
    const orderIds = new Set(byOrder.filter(row => row.order_id).map(row => String(row.order_id)));
    const sold = fills.filter(row => upper(row.side) === "SELL" && orderIds.has(String(row.order_id))).reduce((sum, row) => sum + Math.max(0, finite(row.qty) ?? 0), 0);
    metrics.reduction = metric(numerator / denominator * 100, [{ label: "确认减仓挂单", value: numerator }, ...(source.fills.available ? [{ label: "对应卖出成交", value: sold }] : []), { label: "观测方向峰值", value: denominator }], "已接受减仓订单量 / 采样同方向峰值净库存；仅展示分母可观测的方向，不等于实际减仓率。", "shares");
  }
  return { contract_version: "mm-dashboard-review.v2", condition_id: conditionId, section_seven: { metrics, pnl: null }, coverage };
}
