import { marketReviewWindows, type SectionSevenData, type SectionSevenMetric } from "./review-section-seven-data.ts";

export type Fact = Record<string, unknown>;
export type FactSource = { rows: Fact[]; available: boolean; capped: boolean };
export type ReviewFacts = {
  jobs: FactSource; catalog: FactSource; decisions: FactSource; fills: FactSource;
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
export function selectReviewJob(conditionId: string, source: ReviewFacts) {
  return source.jobs.rows.filter(row => same(row.condition_id, conditionId) && row.job_type === "market_maker")
    .sort((a,b) => Number(Boolean(b.enabled))-Number(Boolean(a.enabled)) || Number(b.job_id)-Number(a.job_id))[0];
}
export function buildReviewFacts(conditionId: string, source: ReviewFacts, now: number): ReviewFactsPayload {
  const market = source.catalog.rows.find(row => same(row.condition_id, conditionId)) ?? {};
  const jobs = source.jobs.rows.filter(row => same(row.condition_id, conditionId) && row.job_type === "market_maker");
  const job = selectReviewJob(conditionId, source);
  const start = epochMs(market.start_time) ?? epochMs(market.create_time);
  const end = epochMs(market.end_time);
  const windows = start !== null && end !== null ? marketReviewWindows(new Date(start).toISOString(), new Date(end).toISOString()) : null;
  const metrics: SectionSevenData["metrics"] = {};
  const unavailable: NonNullable<SectionSevenData["unavailable"]> = {
    toxicity: "缺少按阶段逐笔毒性判定，不能用滑点或当前毒性分数代替。",
    requoteLatency: "缺少成交与新报价确认的关联时间戳。",
    healthyBook: "缺少按阶段保留的双边、单边、空盘持续时间。",
    levelsConsumed: "缺少用户吃单身份、同笔吃单归组及成交时梯度。",
    recross: "缺少成交后完整 60 秒公允价观察窗。",
    followLatency: "缺少公允价变更与报价确认链路，接口新鲜度不是跟随延迟。",
    supplyConversion: "缺少同市场同阶段可确认完整的计划计数；最近审计可能截断或丢弃，不能用其总数作分母。",
  };
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
      return { row, ts: epochMs(map(map(row.risk_state).strategy_status).worst_case_pnl_observed_at) ?? epochMs(row.created_at), yes, no, q: yes !== null && no !== null ? yes - no : null, fair: finite(row.fair_value) };
    }).filter(row => row.ts !== null && row.ts <= now).sort((a, b) => a.ts! - b.ts!) : [];
  const fills = job ? unique(source.fills.rows.filter(row => same(row.condition_id, conditionId) && same(row.account_id, job.account_id) && mmOrder(row)), "fill_key") : [];
  const coverage = { decisionCount: decisions.length, fillCount: fills.length, from: decisions[0]?.ts ?? null, through: decisions.at(-1)?.ts ?? null, notes };
  if (!windows || !job) return { contract_version: "mm-dashboard-review.v2", condition_id: conditionId, section_seven: { metrics, unavailable, pnl: null }, coverage };
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
      integral += Math.abs(a.q) * overlap / 60_000;
      duration += overlap;
    }
    return { label: window.phase, value: integral, duration };
  });
  const riskMinutes = exposure.reduce((sum, row) => sum + row.value, 0);
  if (exposure.some(row => row.duration > 0)) {
    const value = metric(0, exposure.filter(row => row.duration > 0).map(({ label, value }) => ({ label, value: riskMinutes > 0 ? value / riskMinutes * 100 : 0 })),
      `已观测区间风险面积的阶段占比；覆盖 ${(exposure.reduce((sum, row) => sum + row.duration, 0) / 60_000).toFixed(1)} 分钟，间隔超过 5 分钟不计，不外推到市场结束。`, "% 风险面积");
    value.value = riskMinutes > 0 && exposure[0].duration > 0 ? exposure[0].value / riskMinutes * 100 : null;
    value.details = exposure.filter(row => row.duration > 0).map(row => ({ label: `${row.label}风险面积`, value: row.value, unit: "sh·min" }));
    value.exposureSeries = [];
    for (let i = 0; i + 1 < decisions.length; i++) {
      const a = decisions[i], b = decisions[i + 1];
      const from = Math.max(a.ts!, start!), through = Math.min(b.ts!, end!, now);
      if (through <= from) continue;
      if (a.q === null || b.ts! - a.ts! > MAX_GAP_MS) {
        value.exposureSeries.push({ at: from, value: null }, { at: through, value: null });
      } else {
        value.exposureSeries.push({ at: from, value: Math.abs(a.q) }, { at: through, value: Math.abs(a.q) });
      }
    }
    metrics.exposureTime = value;
  }
  const imbalance = sampled.find(row => row.q !== null && Math.abs(row.q) > 15 && row.yes! >= 0 && row.no! >= 0 && Math.max(row.yes!, row.no!) / (row.yes! + row.no!) > 0.9);
  if (imbalance) {
    const value = (imbalance.ts! - start!) / (end! - start!) * 100;
    metrics.firstImbalance = metric(value, [{ label: "首次观测", value }], "已返回采样中的首次越界，不保证是生命周期首次。", "% 生命周期");
  }
  // The counter counts semantic plans, but retained audits may be capped/dropped.
  const reversalEvents: Array<{ label: string; value: number; direction: number; at: number }> = [];
  let comparisons = 0;
  let anchor: typeof sampled[number] | undefined;
  for (const point of sampled) {
    if (point.fair === null || point.fair <= 0 || point.fair >= 1) { anchor = undefined; continue; }
    if (inWindow(point.ts!, 2) && anchor && point.ts! - anchor.ts! <= MAX_GAP_MS) {
      comparisons++;
      if (point.fair !== 0.5 && (point.fair - 0.5) * (anchor.fair! - 0.5) < 0) {
        reversalEvents.push({ label: new Date(point.ts!).toISOString(), value: point.q ?? NaN, direction: point.fair > 0.5 ? 1 : -1, at: point.ts! });
      }
    }
    if (point.fair !== 0.5) anchor = point;
  }
  if (comparisons > 0) metrics.reversals = metric(reversalEvents.length, [{ label: "向上", value: reversalEvents.filter(row => row.direction > 0).length }, { label: "向下", value: reversalEvents.filter(row => row.direction < 0).length }], `尾盘 ${comparisons} 次有效采样比较；间隔超过 5 分钟不推断跨越，可能漏计。`, "次");
  const withInventory = reversalEvents.filter(row => Number.isFinite(row.value));
  if (withInventory.length) {
    metrics.reversalExposure = metric(withInventory.at(-1)!.value, withInventory.map(({ label, value, direction }) => ({ label: label.slice(11, 19) + `Z ${direction > 0 ? "UP" : "DOWN"}`, value })), "采样发现反转时的净库存；后续取目标时刻之后 30 秒内首个库存样本，无样本不填 0。", "shares");
    metrics.reversalExposure.details = withInventory.flatMap(event => [30, 120].map(seconds => {
      const target = event.at + seconds * 1000;
      const observed = decisions.find(row => row.ts! >= target && row.ts! <= target + 30_000 && row.q !== null);
      return { label: `${event.label.slice(11, 19)}Z ${event.direction > 0 ? "UP" : "DOWN"} +${seconds}s`, value: observed?.q ?? null, unit: "shares" };
    }));
  }
  const config = map(job.config);
  const yesId = String(market.yes_position_id ?? config.yes_position_id ?? "");
  const noId = String(market.no_position_id ?? config.no_position_id ?? "");
  const latestTail = sampled.filter(row => inWindow(row.ts!, 2) && Array.isArray(row.row.active_orders_after)).at(-1);
  if (latestTail) {
    const orders = rows(latestTail.row.active_orders_after).filter(row => ["ACCEPTED", "PARTIALLY_FILLED"].includes(upper(row.status)));
    const details: NonNullable<SectionSevenMetric["details"]> = [];
    const observations: SectionSevenMetric["observations"] = [];
    let yesRatio: number | null = null;
    for (const [outcome, position] of [["YES", yesId], ["NO", noId]]) {
      if (!position) continue;
      const sideOrders = (side: string) => orders.filter(row => same(row.position_id, position) && upper(row.side) === side && finite(row.qty) !== null && finite(row.filled_qty) !== null && Number(row.qty) > Number(row.filled_qty));
      const asks = sideOrders("SELL"), bids = sideOrders("BUY");
      const quantity = (items: Fact[]) => items.reduce((sum, row) => sum + Number(row.qty) - Number(row.filled_qty), 0);
      const levels = (items: Fact[]) => items.every(row => finite(row.price) !== null) ? new Set(items.map(row => Number(row.price))).size : null;
      const ask = quantity(asks), bid = quantity(bids), askLevels = levels(asks), bidLevels = levels(bids);
      const total = ask + bid, levelTotal = askLevels !== null && bidLevels !== null ? askLevels + bidLevels : null;
      if (outcome === "YES" && bid > 0) yesRatio = ask / bid;
      details.push({ label: `${outcome} Ask 数量`, value: ask, unit: "shares" }, { label: `${outcome} Bid 数量`, value: bid, unit: "shares" }, { label: `${outcome} Ask 档位`, value: askLevels, unit: "档" }, { label: `${outcome} Bid 档位`, value: bidLevels, unit: "档" });
      if (total > 0) observations.push({ label: `${outcome} Ask量`, value: ask / total * 100 }, { label: `${outcome} Bid量`, value: bid / total * 100 });
      if (levelTotal) observations.push({ label: `${outcome} Ask档`, value: askLevels! / levelTotal * 100 }, { label: `${outcome} Bid档`, value: bidLevels! / levelTotal * 100 });
    }
    if (details.length && orders.every(row => row.position_id && finite(row.qty) !== null && finite(row.filled_qty) !== null)) {
      metrics.bookStructure = { ...metric(0, observations, "尾盘最近确认订单，YES/NO 分开统计剩余数量与不同价格档位；零侧是单边/空盘，不据此判定风控成功。", "% 同 outcome 占比"), value: yesRatio, details };
    } else unavailable.bookStructure = "订单采样缺少 outcome 或剩余数量，不能混合 YES/NO 计算盘口比例。";
  }
  const waiting = decisions.filter(row => row.ts! >= end! && upper(map(map(row.row.risk_state).strategy_status).lifecycle_mode) === "WAITING_RESULT").at(-1);
  if (waiting?.q !== null && waiting?.q !== undefined) {
    const sign = Math.sign(waiting.q);
    const peak = Math.max(0, ...sampled.map(row => row.q === null ? 0 : sign === 0 ? Math.abs(row.q) : row.q * sign));
    if (peak > 0) {
      const outcome = sign > 0 ? "YES" : sign < 0 ? "NO" : "中性";
      metrics.reduction = metric(Math.abs(waiting.q) / peak * 100, [{ label: `${outcome}剩余净库存`, value: Math.abs(waiting.q) }, { label: "同方向观测峰值", value: peak }], `waiting_result 最近库存 / 交易期同方向采样峰值；${new Date(waiting.ts!).toISOString()}，越低表示残留越少。历史缺口可能低估峰值，不是最终链上结算持仓。`, "shares");
    } else unavailable.reduction = "缺少同方向有效峰值净库存，残留率分母不可用。";
  } else {
    unavailable.reduction = "缺少 waiting_result 阶段库存；减仓挂单量或市场最新库存不能代替。";
  }
  return { contract_version: "mm-dashboard-review.v2", condition_id: conditionId, section_seven: { metrics, unavailable, pnl: null }, coverage };
}
