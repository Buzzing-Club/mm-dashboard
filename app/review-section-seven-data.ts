import type { BackendReview } from './review-backend';

export const reviewPhases = ["开盘", "盘中", "尾盘"] as const;
export type ReviewPhase = typeof reviewPhases[number];
export type MetricId = "toxicity" | "exposureTime" | "requoteLatency" | "firstImbalance" | "healthyBook" | "levelsConsumed" | "recross" | "followLatency" | "supplyConversion" | "reversals" | "reversalExposure" | "bookStructure" | "reduction";

export type ReviewObservation = { label: string; value: number };
export type SectionSevenMetric = {
  value: number | null;
  precision?: "sampled";
  note?: string;
  observationUnit?: string;
  observations: ReviewObservation[];
  details?: Array<{ label: string; value: number | null; unit: string }>;
  exposureSeries?: Array<{ at: number; value: number | null }>;
  emptyLabel?: string;
};
export type PnlContribution = {
  marketId: string;
  market: string;
  phase: ReviewPhase;
  spreadPnl: number;
  exposurePnl: number;
  totalPnl: number | null;
  volume: number;
  endingExposure: number;
  maxExposure: number;
  lots: Array<{ outcome: string; side: "bid" | "ask"; quantity: number; entryPrice: number; exitPrice: number; exposurePnl: number }>;
};
export type SectionSevenData = {
  backend?: BackendReview;
  metrics: Partial<Record<MetricId, SectionSevenMetric>>;
  unavailable?: Partial<Record<MetricId, string>>;
  pnl: PnlContribution[] | null;
};
export type ReviewMarketInput = { id: string; event: string; pnl: number; grossVolume: number; startAt?: string; endAt?: string };

export const phaseDefinition = "按市场开始时间至计划结束时间分段：前 20% 开盘、中间 60% 盘中、后 20% 尾盘。开始时间缺失时使用创建时间；不使用首末成交时间、成交笔数或刷新时间。无成交也有阶段边界，但无样本指标不记为 0。盘后结算和减仓单独观察，不延长尾盘区间。缺少有效起止时间时不计算阶段指标。";

export function marketReviewWindows(startAt: string, endAt: string) {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const duration = end - start;
  const boundaries = [start, start + duration * 0.2, start + duration * 0.8, end];
  return reviewPhases.map((phase, index) => ({ phase, start: boundaries[index], end: boundaries[index + 1] }));
}

export function aggregatePnl(rows: PnlContribution[]) {
  return {
    spreadPnl: rows.reduce((sum, row) => sum + row.spreadPnl, 0),
    exposurePnl: rows.reduce((sum, row) => sum + row.exposurePnl, 0),
    totalPnl: rows.every(row => row.totalPnl !== null && Number.isFinite(row.totalPnl)) ? rows.reduce((sum, row) => sum + row.totalPnl!, 0) : null,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
    endingExposure: rows.reduce((sum, row) => sum + row.endingExposure, 0),
    maxExposure: rows.reduce((sum, row) => sum + row.maxExposure, 0),
  };
}

// Phase exposures are snapshots, not flows: use the last phase and per-market peak.
export function aggregateLifecyclePnl(rows: PnlContribution[]) {
  const result = aggregatePnl(rows);
  const markets = new Map<string, PnlContribution[]>();
  for (const row of rows) markets.set(row.marketId, [...(markets.get(row.marketId) ?? []), row]);
  result.endingExposure = 0;
  result.maxExposure = 0;
  result.volume = 0;
  for (const marketRows of markets.values()) {
    const ordered = [...marketRows].sort((a, b) => reviewPhases.indexOf(a.phase) - reviewPhases.indexOf(b.phase));
    result.endingExposure += ordered.at(-1)?.endingExposure ?? 0;
    result.volume += ordered.at(-1)?.volume ?? 0;
    result.maxExposure += Math.max(...ordered.map((row) => row.maxExposure));
  }
  return result;
}

// Spread capture is measured against the quote at execution, not a later mid.
export function tradeSpreadPnl(side: "BUY" | "SELL", price: number, mid: number, quantity: number) {
  return (side === "BUY" ? mid - price : price - mid) * quantity;
}
