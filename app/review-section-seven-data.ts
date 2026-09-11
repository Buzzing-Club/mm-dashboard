export const reviewPhases = ["开盘", "盘中", "尾盘"] as const;
export type ReviewPhase = typeof reviewPhases[number];
export type MetricId = "toxicity" | "exposureTime" | "requoteLatency" | "firstImbalance" | "healthyBook" | "levelsConsumed" | "recross" | "followLatency" | "supplyConversion" | "reversals" | "reversalExposure" | "bookStructure" | "reduction";

export type ReviewObservation = { label: string; value: number };
export type SectionSevenMetric = {
  value: number;
  observationUnit?: string;
  observations: ReviewObservation[];
};
export type PnlContribution = {
  marketId: string;
  market: string;
  phase: ReviewPhase;
  spreadPnl: number;
  exposurePnl: number;
  volume: number;
  endingExposure: number;
  maxExposure: number;
  lots: Array<{ outcome: string; side: "bid" | "ask"; quantity: number; entryPrice: number; exitPrice: number; exposurePnl: number }>;
};
export type SectionSevenData = {
  metrics: Partial<Record<MetricId, SectionSevenMetric>>;
  pnl: PnlContribution[] | null;
};
export type ReviewMarketInput = { id: string; event: string; pnl: number; grossVolume: number };

export const phaseDefinition = "按每个市场第一笔至最后一笔成交的时间跨度分段：前 20% 开盘、中间 60% 盘中、后 20% 尾盘。按时间而非成交笔数分组；未结束市场为暂定分段。遵循第 7 条正文，表格开盘行的 10% clamp 另待确认。无成交或首末成交同刻时，不计算阶段指标。";

export function aggregatePnl(rows: PnlContribution[]) {
  return {
    spreadPnl: rows.reduce((sum, row) => sum + row.spreadPnl, 0),
    exposurePnl: rows.reduce((sum, row) => sum + row.exposurePnl, 0),
    totalPnl: rows.reduce((sum, row) => sum + row.spreadPnl + row.exposurePnl, 0),
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
  for (const marketRows of markets.values()) {
    const ordered = [...marketRows].sort((a, b) => reviewPhases.indexOf(a.phase) - reviewPhases.indexOf(b.phase));
    result.endingExposure += ordered.at(-1)?.endingExposure ?? 0;
    result.maxExposure += Math.max(...ordered.map((row) => row.maxExposure));
  }
  return result;
}
