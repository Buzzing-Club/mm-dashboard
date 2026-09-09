"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CircleDot,
  Database,
  Gauge,
  Layers3,
  LineChart,
  Pause,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TimerReset,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RiskStatus =
  | "normal_quote"
  | "inventory_adjusted_quote"
  | "reduce_only"
  | "endgame_quote"
  | "budget_limited"
  | "size_limited"
  | "price_boundary_limited"
  | "orderbook_missing"
  | "data_delay"
  | "adverse_flow_protection"
  | "negrisk_group_protection"
  | "paused";

type BoardId = "macro" | "experience" | "risk";
type WorkspaceView = "realtime" | "review";
type OutcomeSide = "yes" | "no";
type ExperienceIncidentKind = "single_sided_empty" | "double_sided_empty" | "l1_distance_exceeded";
type SettlementPhase = "none" | "announcing" | "ruling1" | "dispute1" | "ruling2" | "dispute2" | "claimable" | "unknown";

type MarketLifecycleInfo = {
  settlementPhase: SettlementPhase;
  acceptingOrders: boolean;
  closed: boolean;
  currentOutcome: string | null;
  settledOutcome: string | null;
  disputeCount: number;
  phaseEndAt: string | null;
  updatedAt: string | null;
  settledAt: string | null;
};

type ExperienceIncidentMetric = {
  count: number;
  durationSeconds: number;
  durationRatio: number;
};

type ExperienceIncident = {
  ts: number;
  time: string;
  kind: ExperienceIncidentKind;
  durationSeconds: number;
  valuePct?: number | null;
};

type ExperienceHistoryPoint = {
  ts: number;
  time: string;
  slippagePct: number | null;
  impactPct: number | null;
};

type SlippageNotionalBucket = {
  bucket: string;
  tradeCount: number;
  avgSlippagePct: number | null;
  tone: "good" | "warn" | "bad";
};

type Market = {
  id: string;
  event: string;
  market: string;
  category: string;
  tags: string[];
  status: "live" | "degraded" | "paused";
  riskStatus: RiskStatus;
  quoteMode: RiskStatus;
  riskReason: string;
  grossVolume: number;
  netVolume: number | null;
  traderCount: number;
  pnl: number;
  washRatio: number | null;
  inventory: number;
  qMax: number;
  worstCasePnl: number;
  maxLossBudget: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  mid: number;
  askSlope: number | null;
  bidSlope: number | null;
  avgSlippage: number | null;
  staleSeconds: number;
  liquidity: number;
  startAt: string;
  endAt: string;
  endInMinutes: number;
  lifecycle?: MarketLifecycleInfo;
  series: Array<{
    ts?: number;
    time: string;
    volume: number;
    pnl: number;
    spread: number;
    wash: number;
    bidSlope: number;
    askSlope: number;
  }>;
  slippageBuckets: Array<{ bucket: string; count: number; tone: "good" | "warn" | "bad" }>;
  slippageNotionalBuckets?: SlippageNotionalBucket[];
  bidLevels: Array<{ price: number; quantity: number }>;
  askLevels: Array<{ price: number; quantity: number }>;
  noBidLevels?: Array<{ price: number; quantity: number }>;
  noAskLevels?: Array<{ price: number; quantity: number }>;
  events: Array<{ ts?: number; time: string; type: string; detail: string; severity: "ok" | "warn" | "bad" }>;
  liquidityHistory?: LiquidityHistoryPoint[];
  experienceQuality?: {
    observedDurationSeconds: number;
    l1DistanceThresholdPct: number;
    singleSidedEmpty: ExperienceIncidentMetric;
    doubleSidedEmpty: ExperienceIncidentMetric;
    l1DistanceExceeded: ExperienceIncidentMetric;
    incidents: ExperienceIncident[];
    history: ExperienceHistoryPoint[];
  };
  flash?: {
    actualPairsPerHour: number | null;
    actualAvgIntervalS: number | null;
    tier1PairsPerHour: number | null;
    tier1AvgIntervalS: number | null;
    midPairsPerHour: number | null;
    midAvgIntervalS: number | null;
    activePairs: number | null;
    tier1ActivePairs: number | null;
    midActivePairs: number | null;
    maxPairsTotal: number | null;
    l1DistanceTicks: number | null;
    tier1ConfiguredIntervalS?: [number, number] | null;
    midConfiguredIntervalS?: [number, number] | null;
  };
  backendData?: {
    grossVolume: boolean;
    netVolume: boolean;
    traderCount: boolean;
    pnl: boolean;
    washRatio: boolean;
    avgSlippage: boolean;
    slippageDistribution: boolean;
    businessTrend: boolean;
  };
};

type RiskEvent = Market["events"][number];
type LiquidityHistoryPoint = {
  ts: number;
  time: string;
  availableLiquidity: number;
  initialBaseline: number;
  liquidityDelta: number | null;
  liquidityDirection: "increase" | "decrease" | null;
  liquidityReason: string | null;
};

type DashboardRealtimePayload = {
  contract_version: string;
  generated_at?: number;
  items?: DashboardRealtimeItem[];
};

type DashboardRealtimeItem = {
  identity?: {
    condition_id?: string;
    event_id?: string | number;
    title?: string | null;
    event_title?: string | null;
  };
  lifecycle?: {
    create_time?: string | number | null;
    start_time?: string | number | null;
    end_time?: string | number | null;
    runtime_state?: string | null;
    started?: boolean | null;
    accepting_orders?: boolean | null;
    closed?: boolean | null;
    settlement_phase?: string | null;
    current_outcome?: string | null;
    settled_outcome?: string | null;
    dispute_count?: string | number | null;
    phase_end_timestamp?: string | number | null;
    lifecycle_updated_at_ms?: string | number | null;
    settled_at?: string | number | null;
  };
  quote_state?: {
    risk_status?: string | null;
    quote_mode?: string | null;
    label_zh?: string | null;
    detail?: string | null;
  };
  risk?: {
    q?: string | number | null;
    q_max?: string | number | null;
    worst_case_pnl?: string | number | null;
    max_loss_budget?: string | number | null;
  };
  risk_events?: Array<{
    ts?: string | number | null;
    trigger?: string | null;
    risk_status?: string | null;
    label_zh?: string | null;
    reason_code?: string | null;
    severity?: "ok" | "warn" | "bad" | string | null;
  }>;
  orderbook_quality?: {
    best_bid?: string | number | null;
    best_ask?: string | number | null;
    mid?: string | number | null;
    spread?: string | number | null;
    ask_k?: string | number | null;
    bid_k?: string | number | null;
    book_liquidity?: string | number | null;
    yes_book_liquidity?: string | number | null;
    no_book_liquidity?: string | number | null;
    yes?: DashboardBookSide;
    no?: DashboardBookSide;
  };
  liquidity?: {
    current_strategy_liquidity?: string | number | null;
    current_book_liquidity?: string | number | null;
    initial_liquidity?: string | number | null;
    initial_liquidity_source?: string | null;
    history?: Array<{
      ts?: string | number | null;
      liquidity?: string | number | null;
      delta?: string | number | null;
      direction?: "increase" | "decrease" | null;
      reason_code?: string | null;
      reason?: {
        code?: string | null;
        base_code?: string | null;
        direction?: "increase" | "decrease" | null;
        label_zh?: string | null;
        source?: string | null;
        detail?: string | null;
      } | null;
    }>;
  };
  flash?: {
    configured_frequency?: {
      tier1_interval_min_s?: string | number | null;
      tier1_interval_max_s?: string | number | null;
      mid_interval_min_s?: string | number | null;
      mid_interval_max_s?: string | number | null;
    } | null;
    actual_pairs_observed?: string | number | null;
    actual_pairs_per_hour?: string | number | null;
    actual_avg_interval_s?: string | number | null;
    actual_pairs_by_kind?: Record<string, {
      actual_pairs_observed?: string | number | null;
      actual_pairs_per_hour?: string | number | null;
      actual_avg_interval_s?: string | number | null;
    } | undefined> | null;
    tier1_actual_pairs_observed?: string | number | null;
    tier1_actual_pairs_per_hour?: string | number | null;
    tier1_actual_avg_interval_s?: string | number | null;
    mid_actual_pairs_observed?: string | number | null;
    mid_actual_pairs_per_hour?: string | number | null;
    mid_actual_avg_interval_s?: string | number | null;
    active_pairs?: string | number | null;
    active_pairs_by_kind?: Record<string, string | number | null | undefined> | null;
    max_pairs_total?: string | number | null;
    l1_distance_ticks?: string | number | {
      min_distance_ticks?: string | number | null;
      max_distance_ticks?: string | number | null;
      avg_distance_ticks?: string | number | null;
      min_distance_pct?: string | number | null;
      max_distance_pct?: string | number | null;
      avg_distance_pct?: string | number | null;
    } | null;
  };
  dependencies?: {
    runtime_snapshot_age_s?: string | number | null;
    order_snapshot_age_s?: string | number | null;
  };
  strategy_account_metrics?: {
    total_fill_notional?: string | number | null;
    match_count?: string | number | null;
    fill_count?: string | number | null;
  };
  backend_required?: {
    gross_volume?: string | number | null;
    net_volume?: string | number | null;
    trader_count?: string | number | null;
    current_pnl?: string | number | null;
    wash_ratio?: string | number | null;
    avg_slippage?: string | number | null;
    slippage_distribution?: Array<{ bucket: string; count: number; tone?: "good" | "warn" | "bad" }> | null;
    slippage_distribution_by_notional?: Array<{
      bucket?: string | null;
      trade_count?: string | number | null;
      avg_slippage?: string | number | null;
    }> | null;
  };
  experience_quality?: {
    observed_duration_s?: string | number | null;
    l1_distance_threshold_pct?: string | number | null;
    single_sided_empty?: DashboardIncidentMetric | null;
    double_sided_empty?: DashboardIncidentMetric | null;
    l1_distance_exceeded?: DashboardIncidentMetric | null;
    incidents?: Array<{
      ts?: string | number | null;
      type?: ExperienceIncidentKind | string | null;
      duration_s?: string | number | null;
      value_pct?: string | number | null;
    }> | null;
    history?: Array<{
      ts?: string | number | null;
      slippage_pct?: string | number | null;
      impact_pct?: string | number | null;
    }> | null;
  };
};

type DashboardIncidentMetric = {
  count?: string | number | null;
  duration_s?: string | number | null;
  duration_ratio?: string | number | null;
};

type SingleMarketRealtimePayload = {
  code?: number;
  status?: string;
  message?: string;
  data?: {
    business?: {
      gross_volume?: string | number | null;
      net_volume?: string | number | null;
      wash_ratio?: string | number | null;
      trader_count?: string | number | null;
    };
    pnl?: {
      current_pnl?: string | number | null;
    };
    slippage?: {
      avg_trade_slippage?: string | number | null;
      distribution?: Array<{
        bucket?: string | null;
        trade_count?: string | number | null;
      }> | null;
      distribution_by_notional?: Array<{
        bucket?: string | null;
        trade_count?: string | number | null;
        avg_trade_slippage?: string | number | null;
      }> | null;
      history?: Array<{
        ts?: string | number | null;
        slippage_pct?: string | number | null;
        impact_pct?: string | number | null;
      }> | null;
    };
  } | null;
};

type SingleMarketMetrics = Pick<
  Market,
  "avgSlippage" | "grossVolume" | "netVolume" | "pnl" | "slippageBuckets" | "slippageNotionalBuckets" | "traderCount" | "washRatio"
> & {
  experienceHistory: ExperienceHistoryPoint[];
  backendData: NonNullable<Market["backendData"]>;
};

type SingleMarketSlippageDistribution = NonNullable<
  NonNullable<SingleMarketRealtimePayload["data"]>["slippage"]
>["distribution"];

type DashboardBookSide = {
  bids?: Array<{ price?: string | number | null; qty?: string | number | null }>;
  asks?: Array<{ price?: string | number | null; qty?: string | number | null }>;
};

type DataSourceState = {
  mode: "api" | "mock" | "loading";
  label: string;
  detail: string;
};

const statusMeta: Record<
  RiskStatus,
  { label: string; tone: "ok" | "warn" | "bad" | "muted"; short: string }
> = {
  normal_quote: { label: "正常摆单", tone: "ok", short: "NORMAL" },
  inventory_adjusted_quote: { label: "库存倾斜", tone: "warn", short: "SKEW" },
  reduce_only: { label: "只减风险", tone: "bad", short: "REDUCE" },
  endgame_quote: { label: "临期保护", tone: "warn", short: "ENDGAME" },
  budget_limited: { label: "预算受限", tone: "bad", short: "BUDGET" },
  size_limited: { label: "数量受限", tone: "warn", short: "SIZE" },
  price_boundary_limited: { label: "价格边界", tone: "warn", short: "BOUND" },
  orderbook_missing: { label: "盘口缺失", tone: "bad", short: "BOOK" },
  data_delay: { label: "数据延迟", tone: "warn", short: "STALE" },
  adverse_flow_protection: { label: "单边成交保护", tone: "bad", short: "FLOW" },
  negrisk_group_protection: { label: "组级保护", tone: "bad", short: "NEGRISK" },
  paused: { label: "暂停摆单", tone: "muted", short: "PAUSED" },
};

const riskStatusDescriptions: Record<RiskStatus, string> = {
  normal_quote: "行情、盘口和预算均在阈值内，策略按正常参数进行双边报价。",
  inventory_adjusted_quote: "库存偏离目标，策略调整报价中心或两侧数量，以降低库存风险。",
  reduce_only: "库存或风险预算接近限制，仅保留能够降低当前风险敞口的报价。",
  endgame_quote: "市场接近结束或结算，策略收紧档位并降低报价数量。",
  budget_limited: "最坏情形 PnL 接近风险预算，策略限制新增风险与挂单规模。",
  size_limited: "计算出的报价数量低于最小有效数量，部分档位不再下单。",
  price_boundary_limited: "目标报价触及允许价格边界，策略对价格进行截断或停止该档报价。",
  orderbook_missing: "权威订单簿缺失或未收敛，策略无法安全计算报价并暂停摆单。",
  data_delay: "fair value、市场目录或行情超过新鲜度阈值，策略进入降级状态。",
  adverse_flow_protection: "短时间内出现持续增加风险的单边成交，策略主动降低报价暴露。",
  negrisk_group_protection: "关联 bucket 的组级最坏损失达到保护阈值，相关市场共同降级。",
  paused: "运营人员或策略运行时主动暂停当前市场做市。",
};

const MOCK_OBSERVATION_AT = Date.parse("2026-08-28T18:59:30+08:00");
const MINUTE_MS = 60 * 1000;
const DASHBOARD_REFRESH_MS = 30_000;
const MARKET_LIST_LIMIT = 80;
const FINAL_MARKET_RETENTION_MS = 24 * 60 * MINUTE_MS;
const MOCK_STRATEGY_CALIBRATION = {
  askTotalQtyPerOutcome: 30,
  bidTotalCash: 16,
  qMax: 80,
  reduceOnlyRatio: 0.75,
  emptyConfirmSeconds: 4,
  emptyAlertSeconds: 30,
  flashPairsPerMinute: 9.2,
  flashMaxPairsTotal: 5,
  flashTier1DistanceTicks: 1,
  flashMidMinLevel: 2,
  flashMidMaxLevel: 5,
} as const;

function marketWindow(endInMinutes: number, elapsedSinceStartMinutes = 240) {
  const endMs = MOCK_OBSERVATION_AT + endInMinutes * MINUTE_MS;
  const startMs = MOCK_OBSERVATION_AT - elapsedSinceStartMinutes * MINUTE_MS;

  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  };
}

function defaultElapsedSinceStart(endInMinutes: number, index: number) {
  if (endInMinutes <= 360) return 90 + (index % 4) * 30;
  if (endInMinutes <= 1440) return 240 + (index % 3) * 90;
  if (endInMinutes <= 14400) return 720 + (index % 4) * 180;
  if (endInMinutes <= 60000) return 2880 + (index % 5) * 720;
  return 10080 + (index % 4) * 2880;
}

function timestamp(value: string) {
  return new Date(value).getTime();
}

function clampTimestamp(value: number, start: number, end: number) {
  return Math.min(end, Math.max(start, value));
}

function formatAxisTime(value: number, startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = start.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) === end.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: sameDay ? undefined : "2-digit",
    day: sameDay ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(new Date(value)).replace(/\//g, "-");
}

function lifecyclePoints(startAt: string, endAt: string, count: number) {
  const start = timestamp(startAt);
  const end = timestamp(endAt);
  const lastIndex = Math.max(1, count - 1);

  return Array.from({ length: count }, (_, index) => {
    const ts = Math.round(start + ((end - start) * index) / lastIndex);
    return {
      ts,
      time: formatAxisTime(ts, startAt, endAt),
    };
  });
}

function axisTicks(startAt: string, endAt: string, count = 5) {
  return lifecyclePoints(startAt, endAt, count).map((point) => point.ts);
}

function eventProgress(eventItem: RiskEvent, index: number, observedProgress: number) {
  const type = eventItem.type.toLowerCase();
  const riskEventTypes = new Set([
    "risk",
    "reduce",
    "endgame",
    "budget",
    "book",
    "snapshot",
    "cancel",
    "pause",
    "paused",
    "data",
    "stale",
    "negrisk",
  ]);
  const earlyEventTypes = new Set(["catalog", "heartbeat", "normal", "requote"]);
  const inventoryEventTypes = new Set(["inventory", "skew", "depth", "fill"]);
  const baseProgress = riskEventTypes.has(type)
    ? 0.62
    : inventoryEventTypes.has(type)
      ? 0.24
      : earlyEventTypes.has(type)
        ? 0.08
        : 0.18;
  const eventJitter = (index % 3) * 0.035;
  const latestPastProgress = Math.max(0.05, observedProgress - 0.025);

  return Math.min(latestPastProgress, Math.max(0.035, baseProgress + eventJitter));
}

function retimeEvents(market: Market) {
  const start = timestamp(market.startAt);
  const end = timestamp(market.endAt);
  const observedAt = clampTimestamp(MOCK_OBSERVATION_AT, start, end);
  const observedProgress = (observedAt - start) / Math.max(1, end - start);

  return market.events.map((eventItem, index) => {
    const progress = eventProgress(eventItem, index, observedProgress);
    const ts = clampTimestamp(start + (end - start) * progress, start, observedAt);
    return {
      ...eventItem,
      ts,
      time: formatAxisTime(ts, market.startAt, market.endAt),
    };
  });
}

function retimeMarket(market: Market) {
  const points = lifecyclePoints(market.startAt, market.endAt, market.series.length);

  return {
    ...market,
    series: market.series.map((point, index) => ({
      ...point,
      ...points[index],
    })),
    events: retimeEvents(market),
  };
}

function mockLifecycle(market: Market): Market {
  if (market.lifecycle) return market;

  if (market.id === "BLACKWATER-GINEBRA-JUL24") {
    const plannedEnd = MOCK_OBSERVATION_AT - 2 * 60 * MINUTE_MS;
    const start = plannedEnd - 6 * 60 * MINUTE_MS;
    return {
      ...market,
      startAt: new Date(start).toISOString(),
      endAt: new Date(plannedEnd).toISOString(),
      endInMinutes: 0,
      lifecycle: {
        settlementPhase: "dispute1",
        acceptingOrders: true,
        closed: false,
        currentOutcome: "NO",
        settledOutcome: null,
        disputeCount: 1,
        phaseEndAt: new Date(MOCK_OBSERVATION_AT + 22 * 60 * MINUTE_MS).toISOString(),
        updatedAt: new Date(plannedEnd + 45 * MINUTE_MS).toISOString(),
        settledAt: null,
      },
    };
  }

  if (market.id === "MAGNOLIA-MERALCO-JUL24") {
    const plannedEnd = MOCK_OBSERVATION_AT - 8 * 60 * MINUTE_MS;
    const start = plannedEnd - 6 * 60 * MINUTE_MS;
    const settledAt = plannedEnd + 3 * 60 * MINUTE_MS;
    return {
      ...market,
      startAt: new Date(start).toISOString(),
      endAt: new Date(plannedEnd).toISOString(),
      endInMinutes: 0,
      status: "paused",
      riskStatus: "paused",
      quoteMode: "paused",
      riskReason: "market is claimable; quoting stopped and settlement is final",
      lifecycle: {
        settlementPhase: "claimable",
        acceptingOrders: false,
        closed: true,
        currentOutcome: "YES",
        settledOutcome: "YES",
        disputeCount: 0,
        phaseEndAt: null,
        updatedAt: new Date(settledAt).toISOString(),
        settledAt: new Date(settledAt).toISOString(),
      },
    };
  }

  return {
    ...market,
    lifecycle: {
      settlementPhase: "none",
      acceptingOrders: market.status !== "paused",
      closed: false,
      currentOutcome: null,
      settledOutcome: null,
      disputeCount: 0,
      phaseEndAt: null,
      updatedAt: null,
      settledAt: null,
    },
  };
}

const manualMarkets: Market[] = [
  {
    id: "BSP-USDPHP-FRI",
    event: "BSP USD/PHP Reference Rate",
    market: "Reference rate higher this Friday?",
    category: "Economy · FX",
    tags: ["Economy", "FX", "Philippines"],
    status: "live",
    riskStatus: "normal_quote",
    quoteMode: "normal_quote",
    riskReason: "fair value fresh, abs(q)=18 < 64, worst PnL inside budget",
    grossVolume: 184260,
    netVolume: 152880,
    traderCount: 428,
    pnl: 1260,
    washRatio: 0.17,
    inventory: -18,
    qMax: 80,
    worstCasePnl: -11.4,
    maxLossBudget: 30,
    bestBid: 0.49,
    bestAsk: 0.52,
    spread: 0.03,
    mid: 0.505,
    askSlope: 132.4,
    bidSlope: 118.7,
    avgSlippage: 1.8,
    staleSeconds: 12,
    liquidity: 1420,
    ...marketWindow(4, 236),
    endInMinutes: 4,
    series: [
      { time: "18:25", volume: 42, pnl: 520, spread: 4.1, wash: 14, bidSlope: 92, askSlope: 101 },
      { time: "18:30", volume: 54, pnl: 610, spread: 3.8, wash: 15, bidSlope: 98, askSlope: 112 },
      { time: "18:35", volume: 49, pnl: 760, spread: 3.6, wash: 16, bidSlope: 104, askSlope: 118 },
      { time: "18:40", volume: 68, pnl: 940, spread: 3.1, wash: 17, bidSlope: 111, askSlope: 126 },
      { time: "18:45", volume: 63, pnl: 1040, spread: 3.2, wash: 18, bidSlope: 116, askSlope: 131 },
      { time: "18:50", volume: 71, pnl: 1120, spread: 3.0, wash: 17, bidSlope: 119, askSlope: 132 },
      { time: "18:55", volume: 76, pnl: 1260, spread: 3.0, wash: 17, bidSlope: 119, askSlope: 132 },
    ],
    slippageBuckets: [
      { bucket: "0-1%", count: 82, tone: "good" },
      { bucket: "1-2%", count: 116, tone: "good" },
      { bucket: "2-4%", count: 44, tone: "warn" },
      { bucket: "4-8%", count: 11, tone: "bad" },
      { bucket: ">8%", count: 2, tone: "bad" },
    ],
    bidLevels: [
      { price: 0.49, quantity: 62 },
      { price: 0.48, quantity: 54 },
      { price: 0.47, quantity: 41 },
      { price: 0.46, quantity: 36 },
      { price: 0.45, quantity: 26 },
      { price: 0.44, quantity: 18 },
      { price: 0.43, quantity: 11 },
      { price: 0.42, quantity: 7 },
    ],
    askLevels: [
      { price: 0.52, quantity: 58 },
      { price: 0.53, quantity: 47 },
      { price: 0.54, quantity: 45 },
      { price: 0.55, quantity: 34 },
      { price: 0.56, quantity: 26 },
      { price: 0.57, quantity: 16 },
      { price: 0.58, quantity: 9 },
      { price: 0.59, quantity: 6 },
    ],
    events: [
      { time: "18:59:12", type: "requote", detail: "center +0.01, spread unchanged", severity: "ok" },
      { time: "18:58:46", type: "fill", detail: "YES buy 24 shares at 0.52", severity: "ok" },
      { time: "18:57:03", type: "heartbeat", detail: "strategy tick 10s", severity: "ok" },
    ],
  },
  {
    id: "MANILA-TEMP-31",
    event: "Manila RPLL Temperature",
    market: "At or above 88°F at 2 PM bucket",
    category: "Weather · Temperature",
    tags: ["Weather", "Temperature", "Philippines", "NegRisk"],
    status: "degraded",
    riskStatus: "negrisk_group_protection",
    quoteMode: "negrisk_group_protection",
    riskReason: "group worst-case loss reached soft ratio; bucket mapping complete",
    grossVolume: 32480,
    netVolume: 30240,
    traderCount: 86,
    pnl: -18.2,
    washRatio: 0.07,
    inventory: 58,
    qMax: 80,
    worstCasePnl: -27.6,
    maxLossBudget: 30,
    bestBid: 0.18,
    bestAsk: 0.25,
    spread: 0.07,
    mid: 0.215,
    askSlope: 62.1,
    bidSlope: 48.8,
    avgSlippage: 4.6,
    staleSeconds: 41,
    liquidity: 610,
    ...marketWindow(132, 228),
    endInMinutes: 132,
    series: [
      { time: "18:25", volume: 8, pnl: 4, spread: 5.2, wash: 4, bidSlope: 72, askSlope: 88 },
      { time: "18:30", volume: 11, pnl: 1, spread: 5.9, wash: 5, bidSlope: 68, askSlope: 82 },
      { time: "18:35", volume: 14, pnl: -6, spread: 6.4, wash: 6, bidSlope: 60, askSlope: 74 },
      { time: "18:40", volume: 12, pnl: -9, spread: 7.0, wash: 6, bidSlope: 52, askSlope: 69 },
      { time: "18:45", volume: 13, pnl: -13, spread: 7.1, wash: 7, bidSlope: 50, askSlope: 65 },
      { time: "18:50", volume: 16, pnl: -16, spread: 7.0, wash: 7, bidSlope: 49, askSlope: 63 },
      { time: "18:55", volume: 19, pnl: -18, spread: 7.0, wash: 7, bidSlope: 49, askSlope: 62 },
    ],
    slippageBuckets: [
      { bucket: "0-1%", count: 8, tone: "good" },
      { bucket: "1-2%", count: 17, tone: "good" },
      { bucket: "2-4%", count: 28, tone: "warn" },
      { bucket: "4-8%", count: 19, tone: "bad" },
      { bucket: ">8%", count: 8, tone: "bad" },
    ],
    bidLevels: [
      { price: 0.18, quantity: 18 },
      { price: 0.17, quantity: 16 },
      { price: 0.16, quantity: 13 },
      { price: 0.15, quantity: 10 },
      { price: 0.14, quantity: 6 },
      { price: 0.13, quantity: 4 },
      { price: 0.12, quantity: 2 },
      { price: 0.11, quantity: 1 },
    ],
    askLevels: [
      { price: 0.25, quantity: 21 },
      { price: 0.26, quantity: 16 },
      { price: 0.27, quantity: 13 },
      { price: 0.28, quantity: 9 },
      { price: 0.29, quantity: 6 },
      { price: 0.3, quantity: 4 },
      { price: 0.31, quantity: 2 },
      { price: 0.32, quantity: 1 },
    ],
    events: [
      { time: "18:58:55", type: "risk", detail: "group soft loss ratio triggered", severity: "bad" },
      { time: "18:58:10", type: "inventory", detail: "bucket q +17 in 60s", severity: "warn" },
      { time: "18:56:40", type: "requote", detail: "depth -35%, group overround +0.04", severity: "warn" },
    ],
  },
  {
    id: "SARA-SENATE-CONVICT",
    event: "Philippine Senate Conviction",
    market: "Will the Senate convict Sara Duterte?",
    category: "Politics · Government",
    tags: ["Politics", "Government", "Philippines"],
    status: "live",
    riskStatus: "inventory_adjusted_quote",
    quoteMode: "inventory_adjusted_quote",
    riskReason: "flow skew toward YES, center shifted -0.02 to invite de-risk fills",
    grossVolume: 91240,
    netVolume: 66510,
    traderCount: 211,
    pnl: 342,
    washRatio: 0.27,
    inventory: 46,
    qMax: 80,
    worstCasePnl: -21.1,
    maxLossBudget: 30,
    bestBid: 0.43,
    bestAsk: 0.48,
    spread: 0.05,
    mid: 0.455,
    askSlope: 91.2,
    bidSlope: 86.5,
    avgSlippage: 2.9,
    staleSeconds: 18,
    liquidity: 870,
    ...marketWindow(13, 227),
    endInMinutes: 13,
    series: [
      { time: "18:25", volume: 18, pnl: 220, spread: 4.2, wash: 19, bidSlope: 98, askSlope: 102 },
      { time: "18:30", volume: 22, pnl: 260, spread: 4.4, wash: 21, bidSlope: 95, askSlope: 100 },
      { time: "18:35", volume: 28, pnl: 305, spread: 4.7, wash: 24, bidSlope: 91, askSlope: 96 },
      { time: "18:40", volume: 31, pnl: 318, spread: 5.0, wash: 25, bidSlope: 87, askSlope: 93 },
      { time: "18:45", volume: 38, pnl: 328, spread: 5.1, wash: 26, bidSlope: 86, askSlope: 92 },
      { time: "18:50", volume: 42, pnl: 335, spread: 5.0, wash: 27, bidSlope: 87, askSlope: 91 },
      { time: "18:55", volume: 47, pnl: 342, spread: 5.0, wash: 27, bidSlope: 87, askSlope: 91 },
    ],
    slippageBuckets: [
      { bucket: "0-1%", count: 35, tone: "good" },
      { bucket: "1-2%", count: 51, tone: "good" },
      { bucket: "2-4%", count: 48, tone: "warn" },
      { bucket: "4-8%", count: 19, tone: "bad" },
      { bucket: ">8%", count: 4, tone: "bad" },
    ],
    bidLevels: [
      { price: 0.43, quantity: 34 },
      { price: 0.42, quantity: 31 },
      { price: 0.41, quantity: 24 },
      { price: 0.4, quantity: 20 },
      { price: 0.39, quantity: 15 },
      { price: 0.38, quantity: 11 },
      { price: 0.37, quantity: 7 },
      { price: 0.36, quantity: 4 },
    ],
    askLevels: [
      { price: 0.48, quantity: 36 },
      { price: 0.49, quantity: 32 },
      { price: 0.5, quantity: 27 },
      { price: 0.51, quantity: 18 },
      { price: 0.52, quantity: 14 },
      { price: 0.53, quantity: 10 },
      { price: 0.54, quantity: 7 },
      { price: 0.55, quantity: 4 },
    ],
    events: [
      { time: "18:59:02", type: "skew", detail: "gamma shift -0.018", severity: "warn" },
      { time: "18:58:19", type: "fill", detail: "YES buy 31 shares at 0.48", severity: "warn" },
      { time: "18:56:02", type: "requote", detail: "center 0.455, spread 0.05", severity: "ok" },
    ],
  },
  {
    id: "MPLPH-S18-TLPH",
    event: "Team Liquid PH Four-Peat",
    market: "MPL PH S18 title market",
    category: "Sports · Esports",
    tags: ["Sports", "Esports", "Games"],
    status: "paused",
    riskStatus: "orderbook_missing",
    quoteMode: "paused",
    riskReason: "authority snapshot not converged after cancel barrier window",
    grossVolume: 12870,
    netVolume: null,
    traderCount: 42,
    pnl: -4.7,
    washRatio: null,
    inventory: -7,
    qMax: 80,
    worstCasePnl: -6.2,
    maxLossBudget: 30,
    bestBid: 0,
    bestAsk: 0,
    spread: 0,
    mid: 0,
    askSlope: null,
    bidSlope: null,
    avgSlippage: null,
    staleSeconds: 96,
    liquidity: 0,
    ...marketWindow(18420, 10080),
    endInMinutes: 18420,
    series: [
      { time: "18:25", volume: 2, pnl: -2, spread: 8.0, wash: 0, bidSlope: 40, askSlope: 46 },
      { time: "18:30", volume: 2, pnl: -2, spread: 8.0, wash: 0, bidSlope: 38, askSlope: 44 },
      { time: "18:35", volume: 3, pnl: -3, spread: 8.4, wash: 0, bidSlope: 31, askSlope: 39 },
      { time: "18:40", volume: 3, pnl: -4, spread: 8.9, wash: 0, bidSlope: 22, askSlope: 27 },
      { time: "18:45", volume: 4, pnl: -4, spread: 0, wash: 0, bidSlope: 0, askSlope: 0 },
      { time: "18:50", volume: 4, pnl: -5, spread: 0, wash: 0, bidSlope: 0, askSlope: 0 },
      { time: "18:55", volume: 4, pnl: -5, spread: 0, wash: 0, bidSlope: 0, askSlope: 0 },
    ],
    slippageBuckets: [
      { bucket: "0-1%", count: 0, tone: "good" },
      { bucket: "1-2%", count: 0, tone: "good" },
      { bucket: "2-4%", count: 0, tone: "warn" },
      { bucket: "4-8%", count: 0, tone: "bad" },
      { bucket: ">8%", count: 0, tone: "bad" },
    ],
    bidLevels: [],
    askLevels: [],
    events: [
      { time: "18:58:02", type: "snapshot", detail: "openapi order snapshot missing", severity: "bad" },
      { time: "18:57:48", type: "cancel", detail: "cancel barrier timeout 10s", severity: "bad" },
      { time: "18:56:20", type: "pause", detail: "runtime paused quoting", severity: "warn" },
    ],
  },
  {
    id: "VOICE-KIDS-RATINGS",
    event: "The Voice Kids Philippines 2026",
    market: "Premiere episode wins weekend TV ratings?",
    category: "Media · TV Ratings",
    tags: ["Media", "Entertainment", "TV", "Philippines"],
    status: "degraded",
    riskStatus: "data_delay",
    quoteMode: "budget_limited",
    riskReason: "fair value age 74s; bid cash budget clipped by max loss guard",
    grossVolume: 24320,
    netVolume: 19860,
    traderCount: 74,
    pnl: -29.4,
    washRatio: 0.18,
    inventory: 63,
    qMax: 80,
    worstCasePnl: -29.1,
    maxLossBudget: 30,
    bestBid: 0.57,
    bestAsk: 0.65,
    spread: 0.08,
    mid: 0.61,
    askSlope: 37.2,
    bidSlope: 34.8,
    avgSlippage: 7.7,
    staleSeconds: 74,
    liquidity: 280,
    ...marketWindow(9, 231),
    endInMinutes: 9,
    series: [
      { time: "18:25", volume: 6, pnl: -11, spread: 5.9, wash: 11, bidSlope: 65, askSlope: 69 },
      { time: "18:30", volume: 7, pnl: -14, spread: 6.1, wash: 12, bidSlope: 61, askSlope: 62 },
      { time: "18:35", volume: 8, pnl: -18, spread: 6.8, wash: 14, bidSlope: 54, askSlope: 57 },
      { time: "18:40", volume: 9, pnl: -22, spread: 7.2, wash: 16, bidSlope: 45, askSlope: 48 },
      { time: "18:45", volume: 11, pnl: -25, spread: 7.8, wash: 17, bidSlope: 39, askSlope: 42 },
      { time: "18:50", volume: 13, pnl: -28, spread: 8.0, wash: 18, bidSlope: 35, askSlope: 38 },
      { time: "18:55", volume: 14, pnl: -29, spread: 8.0, wash: 18, bidSlope: 35, askSlope: 37 },
    ],
    slippageBuckets: [
      { bucket: "0-1%", count: 3, tone: "good" },
      { bucket: "1-2%", count: 6, tone: "good" },
      { bucket: "2-4%", count: 12, tone: "warn" },
      { bucket: "4-8%", count: 24, tone: "bad" },
      { bucket: ">8%", count: 18, tone: "bad" },
    ],
    bidLevels: [
      { price: 0.57, quantity: 9 },
      { price: 0.56, quantity: 7 },
      { price: 0.55, quantity: 6 },
      { price: 0.54, quantity: 4 },
      { price: 0.53, quantity: 2 },
      { price: 0.52, quantity: 1 },
    ],
    askLevels: [
      { price: 0.65, quantity: 8 },
      { price: 0.66, quantity: 7 },
      { price: 0.67, quantity: 5 },
      { price: 0.68, quantity: 4 },
      { price: 0.69, quantity: 3 },
      { price: 0.7, quantity: 1 },
    ],
    events: [
      { time: "18:59:31", type: "data", detail: "fair value stale 74s", severity: "bad" },
      { time: "18:58:44", type: "budget", detail: "worst pnl -29.1 / -30", severity: "bad" },
      { time: "18:57:16", type: "depth", detail: "min level qty clipped", severity: "warn" },
    ],
  },
];

type ProdMarketSeed = {
  id: string;
  event: string;
  market: string;
  category: string;
  tags: string[];
  riskStatus: RiskStatus;
  volume: number;
  pnl: number;
  inventory: number;
  staleSeconds: number;
  traders: number;
  endInMinutes: number;
};

const prodMarketSeeds: ProdMarketSeed[] = [
  { id: "FREYA-BAN-S18", event: "Freya most banned hero in S18 regular season?", market: "Freya most banned hero in S18 regular season?", category: "Sports · Esports", tags: ["Sports", "Esports", "Games"], riskStatus: "normal_quote", volume: 18640, pnl: 74, inventory: -12, staleSeconds: 14, traders: 58, endInMinutes: 18420 },
  { id: "TOP-PICKED-HERO-S18", event: "Top picked hero chosen 80+ times in S18 regular season?", market: "Top picked hero chosen 80+ times in S18 regular season?", category: "Sports · Esports", tags: ["Sports", "Esports", "Games"], riskStatus: "inventory_adjusted_quote", volume: 20420, pnl: 122, inventory: 39, staleSeconds: 21, traders: 63, endInMinutes: 18420 },
  { id: "HERO-BANNED-100-S18", event: "Any hero banned 100+ times in S18 regular season?", market: "Any hero banned 100+ times in S18 regular season?", category: "Sports · Esports", tags: ["Sports", "Esports", "Games"], riskStatus: "data_delay", volume: 19280, pnl: -16, inventory: 25, staleSeconds: 69, traders: 52, endInMinutes: 18420 },
  { id: "REVERSE-SWEEPS-S18", event: "At least 8 reverse sweeps in S18 regular season?", market: "At least 8 reverse sweeps in S18 regular season?", category: "Sports · Esports", tags: ["Sports", "Esports", "Games"], riskStatus: "normal_quote", volume: 16750, pnl: 48, inventory: 8, staleSeconds: 17, traders: 41, endInMinutes: 18420 },
  { id: "FALCONS-ABOVE-TLPH", event: "Falcons above TLPH in S18 regular season?", market: "Falcons above TLPH in S18 regular season?", category: "Sports · Esports", tags: ["Sports", "Esports", "Games"], riskStatus: "inventory_adjusted_quote", volume: 22110, pnl: -8, inventory: -44, staleSeconds: 26, traders: 68, endInMinutes: 18420 },
  { id: "HB-9859-REPORT", event: "HB 9859 report by Sep. 16?", market: "HB 9859 report by Sep. 16?", category: "Politics · Legislation", tags: ["Politics", "Government", "Philippines"], riskStatus: "normal_quote", volume: 9270, pnl: 34, inventory: 11, staleSeconds: 19, traders: 33, endInMinutes: 27360 },
  { id: "ANGELICA-CONTENTASIA", event: "Angelica Panganiban wins ContentAsia Gold?", market: "Angelica Panganiban wins ContentAsia Gold?", category: "Media · Awards", tags: ["Media", "Entertainment", "Philippines"], riskStatus: "normal_quote", volume: 11640, pnl: 46, inventory: -9, staleSeconds: 16, traders: 36, endInMinutes: 10220 },
  { id: "DAGUPAN-CALAMITY-LIFTED", event: "Will the state of calamity in Dagupan City be lifted on August 31?", market: "Will the state of calamity in Dagupan City be lifted on August 31?", category: "Weather · Government", tags: ["Weather", "Government", "Philippines"], riskStatus: "endgame_quote", volume: 14180, pnl: -21, inventory: 51, staleSeconds: 34, traders: 42, endInMinutes: 4260 },
  { id: "BSP-HIKES-25BP", event: "BSP hikes over 25bp in August?", market: "BSP hikes over 25bp in August?", category: "Economy · Rates", tags: ["Economy", "Rates", "Philippines"], riskStatus: "normal_quote", volume: 28760, pnl: 188, inventory: -18, staleSeconds: 12, traders: 74, endInMinutes: 5180 },
  { id: "EALA-USOPEN-R16", event: "Eala to Reach US Open Round of 16?", market: "Eala to Reach US Open Round of 16?", category: "Sports · Tennis", tags: ["Sports", "Tennis", "Philippines"], riskStatus: "reduce_only", volume: 34720, pnl: -42, inventory: 66, staleSeconds: 29, traders: 91, endInMinutes: 9440 },
  { id: "SABALENKA-USOPEN-2026", event: "Sabalenka Wins 2026 US Open?", market: "Sabalenka Wins 2026 US Open?", category: "Sports · Tennis", tags: ["Sports", "Tennis"], riskStatus: "normal_quote", volume: 31380, pnl: 96, inventory: -16, staleSeconds: 18, traders: 86, endInMinutes: 9440 },
  { id: "AYUNGIN-DFA-2026", event: "China-Philippines Ayungin Shoal confrontation reported by DFA in 2026?", market: "China-Philippines Ayungin Shoal confrontation reported by DFA in 2026?", category: "Politics · Geopolitics", tags: ["Politics", "Geopolitics", "Philippines"], riskStatus: "budget_limited", volume: 17860, pnl: -28, inventory: 62, staleSeconds: 55, traders: 49, endInMinutes: 126840 },
  { id: "CHINA-DAILY-APOLOGY", event: "China Daily issues apology or correction over disputed Philippines video?", market: "China Daily issues apology or correction over disputed Philippines video?", category: "Politics · Media", tags: ["Politics", "Media", "Geopolitics"], riskStatus: "normal_quote", volume: 13210, pnl: 57, inventory: 7, staleSeconds: 24, traders: 38, endInMinutes: 104940 },
  { id: "RUBIO-WANG-MANILA", event: "Rubio and Wang Yi hold a meeting in Manila?", market: "Rubio and Wang Yi hold a meeting in Manila?", category: "Politics · Geopolitics", tags: ["Politics", "Geopolitics", "Philippines"], riskStatus: "data_delay", volume: 15580, pnl: -11, inventory: 23, staleSeconds: 73, traders: 44, endInMinutes: 52920 },
  { id: "TROPICAL-CYCLONE-200KPH", event: "Tropical Cyclone in the Philippines reaches 200+ km/h in 2026?", market: "Tropical Cyclone in the Philippines reaches 200+ km/h in 2026?", category: "Weather · Cyclone", tags: ["Weather", "Cyclone", "Philippines"], riskStatus: "normal_quote", volume: 16840, pnl: 63, inventory: -14, staleSeconds: 20, traders: 47, endInMinutes: 180440 },
  { id: "CAYETANO-NBI-SUBPOENA", event: "Cayetano responds to NBI subpoena?", market: "Cayetano responds to NBI subpoena?", category: "Politics · Legal", tags: ["Politics", "Government", "Philippines"], riskStatus: "inventory_adjusted_quote", volume: 11970, pnl: 22, inventory: -37, staleSeconds: 22, traders: 35, endInMinutes: 18840 },
  { id: "NCR-WAGE-HIKE", event: "NCR minimum wage hike suspended or blocked?", market: "NCR minimum wage hike suspended or blocked?", category: "Economy · Labor", tags: ["Economy", "Labor", "Philippines"], riskStatus: "normal_quote", volume: 22450, pnl: 118, inventory: 13, staleSeconds: 15, traders: 61, endInMinutes: 46820 },
  { id: "PH-ITBPM-EMPLOYMENT", event: "Philippines IT-BPM employment increases", market: "Philippines IT-BPM employment increases", category: "Economy · Labor", tags: ["Economy", "Labor", "Philippines"], riskStatus: "data_delay", volume: 18720, pnl: -18, inventory: 33, staleSeconds: 82, traders: 54, endInMinutes: 104960 },
  { id: "MERALCO-ELECTRICITY-RATE", event: "Meralco Electricity Rate", market: "Meralco Electricity Rate", category: "Economy · Utilities", tags: ["Economy", "Energy", "Philippines"], riskStatus: "normal_quote", volume: 24680, pnl: 161, inventory: -21, staleSeconds: 18, traders: 66, endInMinutes: 37240 },
  { id: "MARCOS-CABINET-OUT", event: "Will another Marcos Cabinet secretary be out by the end of 2026?", market: "Will another Marcos Cabinet secretary be out by the end of 2026?", category: "Politics · Government", tags: ["Politics", "Government", "Philippines"], riskStatus: "reduce_only", volume: 25940, pnl: -35, inventory: 68, staleSeconds: 31, traders: 72, endInMinutes: 180860 },
  { id: "PACQUIAO-MAYWEATHER-2027", event: "Pacquiao vs. Mayweather rematch held in January 2027?", market: "Pacquiao vs. Mayweather rematch held in January 2027?", category: "Sports · Boxing", tags: ["Sports", "Boxing", "Philippines"], riskStatus: "normal_quote", volume: 29480, pnl: 142, inventory: -25, staleSeconds: 13, traders: 81, endInMinutes: 219420 },
  { id: "ODYSSEY-PH-BOXOFFICE", event: "The Odyssey becomes the No. 1 Philippine box office film of 2026", market: "The Odyssey becomes the No. 1 Philippine box office film of 2026", category: "Media · Box Office", tags: ["Media", "Entertainment", "Philippines"], riskStatus: "normal_quote", volume: 17360, pnl: 68, inventory: 10, staleSeconds: 20, traders: 46, endInMinutes: 126200 },
  { id: "SARA-APPROVAL-SEPT", event: "Sara Duterte's approval rating higher in the September survey?", market: "Sara Duterte's approval rating higher in the September survey?", category: "Politics · Polling", tags: ["Politics", "Polling", "Philippines"], riskStatus: "inventory_adjusted_quote", volume: 23880, pnl: -5, inventory: 42, staleSeconds: 28, traders: 70, endInMinutes: 48740 },
  { id: "TRUMP-PH-2026", event: "Trump visits the Philippines in 2026", market: "Trump visits the Philippines in 2026", category: "Politics · Geopolitics", tags: ["Politics", "Geopolitics", "Philippines"], riskStatus: "normal_quote", volume: 19670, pnl: 89, inventory: -17, staleSeconds: 22, traders: 58, endInMinutes: 181420 },
  { id: "SEVERE-TYPHOON-PH-AUG", event: "Severe Typhoon makes landfall in the Philippines in August?", market: "Severe Typhoon makes landfall in the Philippines in August?", category: "Weather · Typhoon", tags: ["Weather", "Typhoon", "Philippines"], riskStatus: "budget_limited", volume: 33120, pnl: -47, inventory: 64, staleSeconds: 48, traders: 94, endInMinutes: 5120 },
  { id: "MINORS-SOCIAL-MEDIA-LAW", event: "Philippines passes national law regulating minors' social media use", market: "Philippines passes national law regulating minors' social media use", category: "Politics · Legislation", tags: ["Politics", "Government", "Philippines"], riskStatus: "normal_quote", volume: 16430, pnl: 54, inventory: 9, staleSeconds: 17, traders: 43, endInMinutes: 127600 },
  { id: "BBM-SWS-SATISFACTION", event: "BBM SWS Net Satisfaction up/down", market: "BBM SWS Net Satisfaction up/down", category: "Politics · Polling", tags: ["Politics", "Polling", "Philippines"], riskStatus: "normal_quote", volume: 21230, pnl: 97, inventory: -12, staleSeconds: 19, traders: 62, endInMinutes: 49360 },
  { id: "RICE-PRICE-PSA", event: "Rice prices up, PSA says?", market: "Rice price increases (PSA)", category: "Economy · Inflation", tags: ["Economy", "Inflation", "Philippines"], riskStatus: "inventory_adjusted_quote", volume: 22790, pnl: -14, inventory: 43, staleSeconds: 25, traders: 65, endInMinutes: 22140 },
  { id: "EGG-PRICE-PSA", event: "PSA chicken egg average retail price increase", market: "Egg price increases (PSA)", category: "Economy · Inflation", tags: ["Economy", "Inflation", "Philippines"], riskStatus: "normal_quote", volume: 17620, pnl: 73, inventory: -11, staleSeconds: 16, traders: 47, endInMinutes: 22140 },
  { id: "AUG-CPI-GT-JUL", event: "August 2026 CPI > July 2026 CPI", market: "August 2026 CPI > July 2026 CPI", category: "Economy · Inflation", tags: ["Economy", "Inflation", "Philippines"], riskStatus: "data_delay", volume: 25830, pnl: -24, inventory: 31, staleSeconds: 78, traders: 76, endInMinutes: 19820 },
  { id: "MARCOS-OUT-2026", event: "Marcos out in 2026?", market: "Marcos out in 2026?", category: "Politics · Government", tags: ["Politics", "Government", "Philippines"], riskStatus: "normal_quote", volume: 36640, pnl: 218, inventory: -23, staleSeconds: 12, traders: 111, endInMinutes: 181520 },
  { id: "MAGNOLIA-MERALCO-JUL24", event: "Magnolia over Meralco on Jul 24?", market: "Magnolia over Meralco on Jul 24?", category: "Sports · Basketball", tags: ["Sports", "Basketball", "Philippines"], riskStatus: "endgame_quote", volume: 14210, pnl: 31, inventory: 54, staleSeconds: 39, traders: 39, endInMinutes: 340 },
  { id: "BLACKWATER-GINEBRA-JUL24", event: "Blackwater over Ginebra on Jul 24?", market: "Blackwater over Ginebra on Jul 24?", category: "Sports · Basketball", tags: ["Sports", "Basketball", "Philippines"], riskStatus: "orderbook_missing", volume: 12890, pnl: -19, inventory: -6, staleSeconds: 96, traders: 36, endInMinutes: 330 },
  { id: "MANILA-10PM-COOLER", event: "Manila 10 PM cooler than 9 PM on Jul 24?", market: "Manila 10 PM cooler than 9 PM on Jul 24?", category: "Weather · Temperature", tags: ["Weather", "Temperature", "Philippines"], riskStatus: "normal_quote", volume: 10860, pnl: 39, inventory: -8, staleSeconds: 22, traders: 31, endInMinutes: 190 },
  { id: "MANILA-6PM-COOLER", event: "Manila 6 PM cooler than 5 PM on Jul 24?", market: "Manila 6 PM cooler than 5 PM on Jul 24?", category: "Weather · Temperature", tags: ["Weather", "Temperature", "Philippines"], riskStatus: "data_delay", volume: 10480, pnl: -9, inventory: 18, staleSeconds: 74, traders: 30, endInMinutes: 180 },
  { id: "MANILA-2PM-EQUAL", event: "Manila 2 PM temperature equals 1 PM on Jul 24?", market: "Manila 2 PM temperature equals 1 PM on Jul 24?", category: "Weather · Temperature", tags: ["Weather", "Temperature", "Philippines"], riskStatus: "normal_quote", volume: 11270, pnl: 44, inventory: 7, staleSeconds: 21, traders: 32, endInMinutes: 170 },
];

function buildSeries(index: number, volume: number, pnl: number, spread: number, washRatio: number | null) {
  const points = ["18:25", "18:30", "18:35", "18:40", "18:45", "18:50", "18:55"];
  const baseVolume = Math.max(2, Math.round(volume / 4200));
  const washPct = Math.round((washRatio ?? 0) * 100);
  return points.map((time, point) => {
    const progress = (point + 1) / points.length;
    return {
      time,
      volume: Math.round(baseVolume * (0.62 + progress + ((index + point) % 3) * 0.08)),
      pnl: Math.round(pnl * progress),
      spread: Number(((spread || 0.07) * 100 + Math.max(0, 3 - point) * 0.18).toFixed(1)),
      wash: Math.max(0, washPct + ((index + point) % 3) - 1),
      bidSlope: Math.max(0, 42 + index * 2 + point * 5),
      askSlope: Math.max(0, 49 + index * 2 + point * 6),
    };
  });
}

function buildLevels(bestPrice: number, side: "bid" | "ask", liquidity: number) {
  if (!bestPrice) return [];
  const direction = side === "bid" ? -1 : 1;
  return Array.from({ length: 8 }, (_, level) => ({
    price: Number(Math.min(0.99, Math.max(0.01, bestPrice + direction * level * 0.01)).toFixed(2)),
    quantity: Math.max(1, Math.round(liquidity / (18 + level * 5))),
  }));
}

function buildSlippageBuckets(avgSlippage: number | null, sampleSize = 80) {
  if (avgSlippage === null) {
    return [
      { bucket: "0-1%", count: 0, tone: "good" as const },
      { bucket: "1-2%", count: 0, tone: "good" as const },
      { bucket: "2-4%", count: 0, tone: "warn" as const },
      { bucket: "4-8%", count: 0, tone: "bad" as const },
      { bucket: ">8%", count: 0, tone: "bad" as const },
    ];
  }

  const load = Math.max(8, Math.round(sampleSize * 1.35));
  const badShare = Math.min(0.26, Math.max(0.03, avgSlippage / 34));
  const warnShare = Math.min(0.34, Math.max(0.14, avgSlippage / 22));
  const goodShare = 1 - badShare - warnShare;
  return [
    { bucket: "0-1%", count: Math.max(1, Math.round(load * goodShare * 0.42)), tone: "good" as const },
    { bucket: "1-2%", count: Math.max(1, Math.round(load * goodShare * 0.58)), tone: "good" as const },
    { bucket: "2-4%", count: Math.max(1, Math.round(load * warnShare)), tone: "warn" as const },
    { bucket: "4-8%", count: Math.max(1, Math.round(load * badShare * 0.72)), tone: "bad" as const },
    { bucket: ">8%", count: Math.max(0, Math.round(load * badShare * 0.28)), tone: "bad" as const },
  ];
}

function slippageTone(value: number | null): "good" | "warn" | "bad" {
  if (value === null) return "warn";
  if (value < 2) return "good";
  if (value < 4) return "warn";
  return "bad";
}

function buildSlippageNotionalBuckets(
  avgSlippage: number | null,
  marketItem: Market,
  index: number,
): SlippageNotionalBucket[] {
  if (avgSlippage === null) return [];
  const observedTrades = Math.max(12, Math.round(marketItem.traderCount * (1.45 + (index % 4) * 0.12)));
  const depthPressure = Math.min(1.9, Math.max(0.85, 520 / Math.max(180, marketItem.liquidity)));
  return [
    { bucket: "$0-25", tradeCount: Math.round(observedTrades * 0.56), avgSlippagePct: Number((avgSlippage * 0.58).toFixed(1)) },
    { bucket: "$25-100", tradeCount: Math.round(observedTrades * 0.29), avgSlippagePct: Number((avgSlippage * 0.88).toFixed(1)) },
    { bucket: "$100-500", tradeCount: Math.max(1, Math.round(observedTrades * 0.12)), avgSlippagePct: Number((avgSlippage * 1.34 * depthPressure).toFixed(1)) },
    { bucket: "$500+", tradeCount: Math.max(1, Math.round(observedTrades * 0.03)), avgSlippagePct: Number((avgSlippage * 2.05 * depthPressure).toFixed(1)) },
  ].map((bucket) => ({ ...bucket, tone: slippageTone(bucket.avgSlippagePct) }));
}

function deriveMockSlippage(marketItem: Market, index: number) {
  if (!marketItem.mid || !marketItem.spread || marketItem.riskStatus === "orderbook_missing") return null;
  const halfSpreadPct = (marketItem.spread / (2 * marketItem.mid)) * 100;
  const liquidityPressure = Math.min(1.55, Math.max(0.72, 480 / Math.max(180, marketItem.liquidity)));
  const statePressure: Partial<Record<RiskStatus, number>> = {
    inventory_adjusted_quote: 1.08,
    reduce_only: 1.28,
    endgame_quote: 1.18,
    budget_limited: 1.32,
    data_delay: 1.24,
    adverse_flow_protection: 1.38,
    negrisk_group_protection: 1.3,
  };
  const sampleNoise = 0.94 + (index % 5) * 0.025;
  return Number(Math.min(18, Math.max(0.35, halfSpreadPct * liquidityPressure * (statePressure[marketItem.riskStatus] ?? 1) * sampleNoise)).toFixed(1));
}

function withMockExperienceQuality(marketItem: Market, index: number): Market {
  const start = timestamp(marketItem.startAt);
  const end = timestamp(marketItem.endAt);
  const observedEnd = clampTimestamp(MOCK_OBSERVATION_AT, start, end);
  const observedDurationSeconds = Math.max(60, Math.round((observedEnd - start) / 1000));
  const avgSlippage = deriveMockSlippage(marketItem, index);
  const singleSideRisk = new Set<RiskStatus>(["size_limited", "price_boundary_limited", "reduce_only"]);
  const flashDistanceRisk = new Set<RiskStatus>(["data_delay", "budget_limited", "adverse_flow_protection", "negrisk_group_protection"]);
  const isMissing = marketItem.riskStatus === "orderbook_missing";
  const inventoryNearReduceOnly = Math.abs(marketItem.inventory) >= MOCK_STRATEGY_CALIBRATION.qMax * MOCK_STRATEGY_CALIBRATION.reduceOnlyRatio;
  const singleCount = isMissing ? 1 : singleSideRisk.has(marketItem.riskStatus) || inventoryNearReduceOnly ? 1 + (index % 2) : index % 7 === 0 ? 1 : 0;
  const doubleCount = isMissing ? 1 : 0;
  const distanceCount = flashDistanceRisk.has(marketItem.riskStatus) ? 1 + (index % 3) : index % 5 === 0 ? 1 : 0;
  const singleDuration = singleCount * (MOCK_STRATEGY_CALIBRATION.emptyConfirmSeconds + 2 + (index % 5) * 2);
  const doubleDuration = doubleCount
    ? Math.max(MOCK_STRATEGY_CALIBRATION.emptyAlertSeconds, marketItem.staleSeconds)
    : 0;
  const distanceDuration = distanceCount * (5 + (index % 4) * 3);
  const incidentSpecs: Array<{ kind: ExperienceIncidentKind; count: number; duration: number; progress: number }> = [
    { kind: "single_sided_empty", count: singleCount, duration: singleDuration, progress: 0.22 },
    { kind: "double_sided_empty", count: doubleCount, duration: doubleDuration, progress: 0.48 },
    { kind: "l1_distance_exceeded", count: distanceCount, duration: distanceDuration, progress: 0.72 },
  ];
  const incidents = incidentSpecs.flatMap((spec, specIndex) => (
    Array.from({ length: Math.min(spec.count, 3) }, (_, eventIndex) => {
      const progress = Math.min(0.94, spec.progress + eventIndex * 0.075 + specIndex * 0.025);
      const ts = Math.round(start + (observedEnd - start) * progress);
      return {
        ts,
        time: formatAxisTime(ts, marketItem.startAt, marketItem.endAt),
        kind: spec.kind,
        durationSeconds: Math.max(3, Math.round(spec.duration / Math.max(1, spec.count))),
        valuePct: spec.kind === "l1_distance_exceeded" ? Number((1.1 + (index % 5) * 0.24).toFixed(2)) : null,
      } satisfies ExperienceIncident;
    })
  ));
  const history = lifecyclePoints(marketItem.startAt, marketItem.endAt, marketItem.series.length).map((point, pointIndex) => {
    const baseSlippage = avgSlippage ?? 0;
    const wave = ((pointIndex + index) % 4 - 1.5) * 0.16;
    return {
      ...point,
      slippagePct: avgSlippage === null ? null : Number(Math.max(0, baseSlippage * (0.72 + pointIndex * 0.045 + wave)).toFixed(2)),
      impactPct: marketItem.askSlope === null || marketItem.bidSlope === null
        ? null
        : Number(Math.max(0, marketItem.spread * 100 * (0.62 + pointIndex * 0.08 + wave)).toFixed(2)),
    };
  });
  const metric = (count: number, durationSeconds: number): ExperienceIncidentMetric => ({
    count,
    durationSeconds,
    durationRatio: durationSeconds / observedDurationSeconds,
  });

  return {
    ...marketItem,
    avgSlippage,
    slippageBuckets: buildSlippageBuckets(avgSlippage, marketItem.traderCount),
    slippageNotionalBuckets: buildSlippageNotionalBuckets(avgSlippage, marketItem, index),
    experienceQuality: {
      observedDurationSeconds,
      l1DistanceThresholdPct: 0.01,
      singleSidedEmpty: metric(singleCount, singleDuration),
      doubleSidedEmpty: metric(doubleCount, doubleDuration),
      l1DistanceExceeded: metric(distanceCount, distanceDuration),
      incidents,
      history,
    },
  };
}

function riskReasonFor(status: RiskStatus) {
  const reasons: Record<RiskStatus, string> = {
    normal_quote: "fair value fresh, two-sided book healthy, budget inside guardrails",
    inventory_adjusted_quote: "inventory skew detected; quote center shifted to invite de-risk fills",
    reduce_only: "inventory near reduce-only threshold; only risk-reducing side is quoted",
    endgame_quote: "market is near end time; levels tightened and quote size reduced",
    budget_limited: "worst-case PnL close to configured budget guard",
    size_limited: "quote quantity is below the configured minimum viable size",
    price_boundary_limited: "planned quote price hit the allowed market price boundary",
    orderbook_missing: "authority snapshot not converged; quoting paused for this market",
    data_delay: "fair value or catalog update is stale beyond freshness target",
    adverse_flow_protection: "short-window risk-increasing fills triggered adverse-flow protection",
    negrisk_group_protection: "group-level loss guard is active for related buckets",
    paused: "operator or runtime pause is active",
  };
  return reasons[status];
}

const riskEventTypeLabels: Record<string, string> = {
  normal: "正常摆单",
  requote: "重新定价",
  catalog: "市场目录同步",
  heartbeat: "策略心跳",
  fill: "成交回报",
  inventory: "库存倾斜",
  skew: "库存倾斜",
  reduce: "只减风险",
  endgame: "临期保护",
  budget: "预算保护",
  book: "盘口缺失",
  snapshot: "盘口快照异常",
  cancel: "撤单保护",
  pause: "暂停摆单",
  paused: "暂停摆单",
  data: "数据延迟",
  stale: "数据延迟",
  negrisk: "组级保护",
  depth: "深度收紧",
  flow: "单边成交保护",
  size: "数量受限",
  bound: "价格边界",
};

function getRiskEventLabel(eventItem: RiskEvent) {
  if (eventItem.type === "risk") {
    const detail = eventItem.detail.toLowerCase();
    if (detail.includes("group") || detail.includes("negrisk") || detail.includes("soft loss")) {
      return "组级损失保护";
    }
    if (detail.includes("budget") || detail.includes("pnl") || detail.includes("loss")) {
      return "预算损失保护";
    }
    if (detail.includes("inventory") || detail.includes("q ")) {
      return "库存风险保护";
    }
    if (detail.includes("stale") || detail.includes("delay") || detail.includes("freshness")) {
      return "数据延迟保护";
    }
    if (detail.includes("book") || detail.includes("snapshot") || detail.includes("depth")) {
      return "盘口异常保护";
    }
    return "风控保护触发";
  }

  return riskEventTypeLabels[eventItem.type] ?? eventItem.type;
}

function toSourceTone(tone: "ok" | "warn" | "bad" | "muted"): "ok" | "warn" | "bad" {
  return tone === "muted" ? "warn" : tone;
}

function getLiquidityChangeReason(market: Market, delta: number, index: number) {
  if (delta > 0) {
    if (market.riskStatus === "normal_quote") {
      return index % 2 === 0 ? "盘口双边稳定，恢复一档与中间档闪单深度" : "成交滑点低于阈值，补回被动侧挂单量";
    }
    if (market.riskStatus === "inventory_adjusted_quote") {
      return "库存压力回落，策略补回去风险侧流动性";
    }
    if (market.riskStatus === "negrisk_group_protection") {
      return "组级保护未继续扩大，恢复部分安全 bucket 深度";
    }
    if (market.riskStatus === "budget_limited") {
      return "预算占用下降，恢复非风险侧 quote size";
    }
    if (market.riskStatus === "data_delay") {
      return "数据新鲜度恢复，重新打开部分挂单档位";
    }
    if (market.riskStatus === "endgame_quote") {
      return "临期成交压力缓解，小幅补回近端流动性";
    }
    if (market.riskStatus === "reduce_only") {
      return "风险侧成交后库存下降，补充只减风险方向挂单";
    }
    return "策略健康检查通过，恢复部分市场深度";
  }

  if (market.riskStatus === "orderbook_missing") {
    return "盘口快照缺失或未收敛，撤掉策略挂单";
  }
  if (market.riskStatus === "negrisk_group_protection") {
    return "组级损失保护触发，削减相关 bucket 深度";
  }
  if (market.riskStatus === "budget_limited") {
    return "最坏情形 PnL 接近预算，减少风险侧挂单";
  }
  if (market.riskStatus === "data_delay") {
    return "fair value 超过 freshness 目标，撤掉远端档位";
  }
  if (market.riskStatus === "endgame_quote") {
    return "进入临期窗口，降低 quote size 并收紧档位";
  }
  if (market.riskStatus === "reduce_only") {
    return "库存接近 reduce-only 阈值，撤掉会增加风险的一侧";
  }
  if (market.riskStatus === "inventory_adjusted_quote") {
    return "库存偏离目标，削减累积库存方向的挂单";
  }

  return "滑点或价差短时恶化，策略减少中间档闪单";
}

function buildLiquidityHistory(market: Market): LiquidityHistoryPoint[] {
  if (market.liquidityHistory?.length) {
    return market.liquidityHistory;
  }

  const baselineRatio: Partial<Record<RiskStatus, number>> = {
    normal_quote: 0.96,
    inventory_adjusted_quote: 1.12,
    reduce_only: 1.42,
    endgame_quote: 1.36,
    budget_limited: 1.48,
    data_delay: 1.3,
    adverse_flow_protection: 1.55,
    negrisk_group_protection: 1.45,
    orderbook_missing: 1,
  };
  const initialLiquidity = market.liquidity
    ? Math.round(market.liquidity * (baselineRatio[market.riskStatus] ?? 1.08))
    : market.riskStatus === "orderbook_missing"
      ? Math.max(45, Math.round(market.grossVolume / 260))
      : Math.max(140, Math.round(market.grossVolume / 64));
  const liquidityChange = market.liquidity - initialLiquidity;
  const stressed = statusMeta[market.riskStatus].tone !== "ok";
  const points = market.series;

  return points.map((point, index) => {
    const lastIndex = Math.max(1, points.length - 1);
    const progress = index / lastIndex;
    const stressPulse = stressed && index > 0 && index < lastIndex && index % 2 === 0
      ? Math.max(8, Math.round(Math.max(market.liquidity, initialLiquidity) * 0.08))
      : 0;
    const wiggle = index === 0 || index === lastIndex
      ? 0
      : ((index % 3) - 1) * Math.max(1, Math.round(Math.max(market.liquidity, initialLiquidity) * 0.015));
    const directionalShock = liquidityChange >= 0 ? -stressPulse : stressPulse;
    const availableLiquidity = Math.max(0, Math.round(initialLiquidity + liquidityChange * progress + wiggle + directionalShock));
    const previousPoint = index === 0 ? null : points[index - 1];
    const previousProgress = index === 0 ? 0 : (index - 1) / lastIndex;
    const previousStressPulse = stressed && index - 1 > 0 && index - 1 < lastIndex && (index - 1) % 2 === 0
      ? Math.max(8, Math.round(Math.max(market.liquidity, initialLiquidity) * 0.08))
      : 0;
    const previousWiggle = index <= 1 || index - 1 === lastIndex
      ? 0
      : (((index - 1) % 3) - 1) * Math.max(1, Math.round(Math.max(market.liquidity, initialLiquidity) * 0.015));
    const previousShock = liquidityChange >= 0 ? -previousStressPulse : previousStressPulse;
    const previousLiquidity = previousPoint
      ? Math.max(0, Math.round(initialLiquidity + liquidityChange * previousProgress + previousWiggle + previousShock))
      : availableLiquidity;
    const liquidityDelta = index === 0 ? null : availableLiquidity - previousLiquidity;

    return {
      ts: point.ts ?? timestamp(market.startAt),
      time: point.time,
      availableLiquidity,
      initialBaseline: initialLiquidity,
      liquidityDelta,
      liquidityDirection: liquidityDelta === null || liquidityDelta === 0 ? null : liquidityDelta > 0 ? "increase" : "decrease",
      liquidityReason: liquidityDelta === null || liquidityDelta === 0 ? null : getLiquidityChangeReason(market, liquidityDelta, index),
    };
  });
}

function getRiskTimelineEvents(market: Market) {
  if (market.events.length) {
    return [...market.events]
      .sort((a, b) => (a.ts ?? timestamp(market.startAt)) - (b.ts ?? timestamp(market.startAt)));
  }

  const tone = statusMeta[market.riskStatus].tone;
  const start = timestamp(market.startAt);
  const end = timestamp(market.endAt);
  const ts = clampTimestamp(MOCK_OBSERVATION_AT, start, end);

  return [{
    ts,
    time: formatAxisTime(ts, market.startAt, market.endAt),
    type: statusMeta[market.riskStatus].short.toLowerCase(),
    detail: market.riskReason,
    severity: tone === "bad" ? "bad" : tone === "warn" ? "warn" : "ok",
  } satisfies RiskEvent];
}

function makeProdMarket(seed: ProdMarketSeed, index: number): Market {
  const tone = statusMeta[seed.riskStatus].tone;
  const window = marketWindow(seed.endInMinutes, defaultElapsedSinceStart(seed.endInMinutes, index));
  const status = seed.riskStatus === "orderbook_missing" || seed.riskStatus === "paused"
    ? "paused"
    : tone === "ok"
      ? "live"
      : "degraded";
  const qMax = MOCK_STRATEGY_CALIBRATION.qMax;
  const maxLossBudget = 30;
  const spread = seed.riskStatus === "orderbook_missing"
    ? 0
    : seed.riskStatus === "normal_quote"
      ? 0.03 + (index % 3) * 0.005
      : seed.riskStatus === "data_delay" || seed.riskStatus === "budget_limited"
        ? 0.075
        : 0.055;
  const mid = seed.riskStatus === "orderbook_missing"
    ? 0
    : Math.min(0.82, Math.max(0.18, 0.47 + ((index % 11) - 5) * 0.027));
  const strategyLiquidityFloor = mid
    ? MOCK_STRATEGY_CALIBRATION.askTotalQtyPerOutcome * 2
      + (MOCK_STRATEGY_CALIBRATION.bidTotalCash / 2) / mid
      + (MOCK_STRATEGY_CALIBRATION.bidTotalCash / 2) / (1 - mid)
    : 0;
  const liquidity = seed.riskStatus === "orderbook_missing"
    ? 0
    : Math.max(Math.round(strategyLiquidityFloor * (2.1 + (index % 4) * 0.45)), Math.round(seed.volume / 31));
  const bestBid = mid ? Number(Math.max(0.01, mid - spread / 2).toFixed(2)) : 0;
  const bestAsk = mid ? Number(Math.min(0.99, mid + spread / 2).toFixed(2)) : 0;
  const washRatio = index % 9 === 0 ? null : Number((0.06 + (index % 6) * 0.025).toFixed(2));
  const avgSlippage = seed.riskStatus === "orderbook_missing" ? null : Number((1.4 + (index % 7) * 0.7).toFixed(1));
  const quoteMode = seed.riskStatus === "orderbook_missing" ? "paused" : seed.riskStatus;
  const bidLevels = buildLevels(bestBid, "bid", liquidity);
  const askLevels = buildLevels(bestAsk, "ask", liquidity);
  const series = buildSeries(index, seed.volume, seed.pnl, spread, washRatio);

  return {
    id: seed.id,
    event: seed.event,
    market: seed.market,
    category: seed.category,
    tags: seed.tags,
    status,
    riskStatus: seed.riskStatus,
    quoteMode,
    riskReason: riskReasonFor(seed.riskStatus),
    grossVolume: seed.volume,
    netVolume: Math.round(seed.volume * (0.72 + (index % 5) * 0.035)),
    traderCount: seed.traders,
    pnl: seed.pnl,
    washRatio,
    inventory: seed.inventory,
    qMax,
    worstCasePnl: Number(Math.min(-2.4, -Math.abs(seed.inventory) * 0.43).toFixed(1)),
    maxLossBudget,
    bestBid,
    bestAsk,
    spread,
    mid: Number(mid.toFixed(3)),
    askSlope: seed.riskStatus === "orderbook_missing" ? null : series.at(-1)?.askSlope ?? null,
    bidSlope: seed.riskStatus === "orderbook_missing" ? null : series.at(-1)?.bidSlope ?? null,
    avgSlippage,
    staleSeconds: seed.staleSeconds,
    liquidity,
    ...window,
    endInMinutes: seed.endInMinutes,
    series,
    slippageBuckets: buildSlippageBuckets(avgSlippage),
    bidLevels,
    askLevels,
    events: [
      { time: "18:59:12", type: statusMeta[seed.riskStatus].short.toLowerCase(), detail: riskReasonFor(seed.riskStatus), severity: tone === "bad" ? "bad" : tone === "warn" ? "warn" : "ok" },
      { time: "18:58:20", type: "catalog", detail: "prod market sample mirrored into dashboard mock", severity: "ok" },
      { time: "18:57:06", type: "heartbeat", detail: `last market data age ${seed.staleSeconds}s`, severity: seed.staleSeconds > 60 ? "warn" : "ok" },
    ],
  };
}

function withMockFlash(marketItem: Market, index: number): Market {
  if (marketItem.flash) {
    return marketItem;
  }
  const quoteBlocked = new Set<RiskStatus>([
    "orderbook_missing",
    "paused",
    "endgame_quote",
    "budget_limited",
    "adverse_flow_protection",
    "negrisk_group_protection",
  ]).has(marketItem.riskStatus);
  const recentlyBlocked = quoteBlocked || marketItem.riskStatus === "data_delay" || marketItem.riskStatus === "reduce_only";
  const measuredPairsPerHour = MOCK_STRATEGY_CALIBRATION.flashPairsPerMinute * 60;
  const throughputFactor = recentlyBlocked ? 0.38 + (index % 3) * 0.08 : 0.9 + (index % 4) * 0.035;
  const totalPairsPerHour = Math.round(measuredPairsPerHour * throughputFactor);
  const tier1Share = 0.48 + (index % 3) * 0.02;
  const tier1PairsPerHour = Math.round(totalPairsPerHour * tier1Share);
  const midPairsPerHour = totalPairsPerHour - tier1PairsPerHour;
  const tier1ActivePairs = quoteBlocked ? 0 : index % 3 === 0 ? 2 : 1;
  const midActivePairs = quoteBlocked ? 0 : Math.min(3, 1 + (index % 3));
  const latestWasTier1 = index % 3 !== 1;
  const l1DistanceTicks = latestWasTier1
    ? MOCK_STRATEGY_CALIBRATION.flashTier1DistanceTicks
    : MOCK_STRATEGY_CALIBRATION.flashMidMinLevel + (index % (MOCK_STRATEGY_CALIBRATION.flashMidMaxLevel - MOCK_STRATEGY_CALIBRATION.flashMidMinLevel + 1));
  return {
    ...marketItem,
    flash: {
      actualPairsPerHour: tier1PairsPerHour + midPairsPerHour,
      actualAvgIntervalS: Number((3600 / (tier1PairsPerHour + midPairsPerHour)).toFixed(1)),
      tier1PairsPerHour,
      tier1AvgIntervalS: Number((3600 / tier1PairsPerHour).toFixed(1)),
      midPairsPerHour,
      midAvgIntervalS: Number((3600 / midPairsPerHour).toFixed(1)),
      activePairs: tier1ActivePairs + midActivePairs,
      tier1ActivePairs,
      midActivePairs,
      maxPairsTotal: MOCK_STRATEGY_CALIBRATION.flashMaxPairsTotal,
      l1DistanceTicks,
    },
  };
}

const mockMarkets: Market[] = [...manualMarkets, ...prodMarketSeeds.map((seed, index) => makeProdMarket(seed, index))]
  .map((marketItem, index) => {
    const lifecycleMarket = mockLifecycle(marketItem);
    return withMockExperienceQuality(retimeMarket(withMockFlash(lifecycleMarket, index)), index);
  });

const filterOptions = [
  { id: "all", label: "全部", tag: null },
  { id: "attention", label: "异常", tag: null },
  { id: "weather", label: "Weather", tag: "Weather" },
  { id: "economy", label: "Economy", tag: "Economy" },
  { id: "politics", label: "Politics", tag: "Politics" },
  { id: "sports", label: "Sports", tag: "Sports" },
  { id: "media", label: "Media", tag: "Media" },
];

const timeframes = ["15m", "1h", "4h"];

const boardOptions: Array<{
  id: BoardId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  {
    id: "macro",
    title: "宏观业务指标",
    subtitle: "交易规模、用户规模、PnL、业务趋势",
    icon: <BarChart3 size={16} />,
  },
  {
    id: "experience",
    title: "用户体验指标",
    subtitle: "闪单状态、流动性、滑点、点差、盘口斜率",
    icon: <Layers3 size={16} />,
  },
  {
    id: "risk",
    title: "市场风控指标",
    subtitle: "策略状态、库存、预算、数据延迟、暂停原因",
    icon: <ShieldAlert size={16} />,
  },
];

function currency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(value % 1 ? 1 : 0)}`;
}

function signedCurrency(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${currency(value)}`;
}

function price(value: number) {
  return value ? value.toFixed(2) : "--";
}

function maxQuantity(levels: Array<{ quantity: number }>) {
  return Math.max(1, ...levels.map((level) => level.quantity));
}

function complementaryLevels(levels: Array<{ price: number; quantity: number }>, sort: "bid" | "ask") {
  return levels
    .map((level) => ({
      price: Number((1 - level.price).toFixed(2)),
      quantity: level.quantity,
    }))
    .sort((a, b) => (sort === "bid" ? b.price - a.price : a.price - b.price));
}

function numberValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function raw6ToUsdb(value: string | number | null | undefined) {
  return (numberValue(value) ?? 0) / 1_000_000;
}

function statusValue(value: string | null | undefined): RiskStatus {
  const normalized = String(value ?? "paused") as RiskStatus;
  return normalized in statusMeta ? normalized : "paused";
}

function severityValue(value: string | null | undefined): "ok" | "warn" | "bad" {
  return value === "ok" || value === "warn" || value === "bad" ? value : "warn";
}

function looksLikeOpaqueIdentifier(value: string) {
  const text = value.trim();
  return /^(\d+:)?0x[a-f0-9]{24,}$/i.test(text) || /^[a-f0-9]{40,}$/i.test(text);
}

function readableLabel(value: string | null | undefined) {
  const text = value?.trim();
  if (!text || looksLikeOpaqueIdentifier(text)) return null;
  return text;
}

function compactIdentifier(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "--";
  const prefixMatch = text.match(/^(\d+:)(0x[a-f0-9]+)$/i);
  const prefix = prefixMatch?.[1] ?? "";
  const body = prefixMatch?.[2] ?? text;
  if (body.length <= 18) return text;
  return `${prefix}${body.slice(0, 8)}...${body.slice(-6)}`;
}

function isoTime(value: string | number | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return isoTime(numeric, fallback);
  }
  return new Date(fallback).toISOString();
}

function optionalIsoTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = numberValue(value);
  if (numeric !== null && numeric <= 0) return null;
  const millis = apiTimestamp(value, Number.NaN);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function settlementPhase(value: string | null | undefined): SettlementPhase {
  const normalized = String(value ?? "none").trim().toLowerCase();
  if (["none", "announcing", "ruling1", "dispute1", "ruling2", "dispute2", "claimable"].includes(normalized)) {
    return normalized as SettlementPhase;
  }
  return normalized ? "unknown" : "none";
}

function apiTimestamp(value: string | number | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
    const parsedNumber = Number(value);
    if (Number.isFinite(parsedNumber)) return apiTimestamp(parsedNumber, fallback);
  }
  return fallback;
}

function endMinutes(endAt: string) {
  return Math.max(0, Math.round((timestamp(endAt) - Date.now()) / MINUTE_MS));
}

function isExpiredDashboardItem(item: DashboardRealtimeItem, now: number) {
  const phase = settlementPhase(item.lifecycle?.settlement_phase);
  if (["announcing", "ruling1", "dispute1", "ruling2", "dispute2"].includes(phase)) {
    return false;
  }
  if (phase === "claimable" || item.lifecycle?.closed || item.lifecycle?.settled_outcome) {
    const finalAt = apiTimestamp(
      item.lifecycle?.settled_at ?? item.lifecycle?.lifecycle_updated_at_ms,
      Number.NEGATIVE_INFINITY,
    );
    return !Number.isFinite(finalAt) || now - finalAt > FINAL_MARKET_RETENTION_MS;
  }
  if (item.lifecycle?.end_time === null || item.lifecycle?.end_time === undefined || item.lifecycle.end_time === "") {
    return false;
  }
  return apiTimestamp(item.lifecycle.end_time, now + MINUTE_MS) <= now;
}

function hasReadableDashboardTitle(item: DashboardRealtimeItem) {
  return Boolean(readableLabel(item.identity?.event_title) || readableLabel(item.identity?.title));
}

function marketStatus(status: RiskStatus, runtimeState?: string | null): Market["status"] {
  if (runtimeState && runtimeState !== "running") return "paused";
  const tone = statusMeta[status].tone;
  if (status === "orderbook_missing" || status === "paused") return "paused";
  return tone === "ok" ? "live" : "degraded";
}

function apiLevels(side?: DashboardBookSide, key: "bids" | "asks" = "bids") {
  return (side?.[key] ?? [])
    .map((level) => ({
      price: numberValue(level.price) ?? 0,
      quantity: numberValue(level.qty) ?? 0,
    }))
    .filter((level) => level.price > 0 && level.quantity > 0);
}

function apiSlippageBuckets(
  buckets: Array<{ bucket: string; count: number; tone?: "good" | "warn" | "bad" }> | null | undefined,
) {
  if (!Array.isArray(buckets)) return [];
  return buckets.map((bucket) => ({
    bucket: String(bucket.bucket),
    count: Number.isFinite(Number(bucket.count)) ? Number(bucket.count) : 0,
    tone: bucket.tone ?? (
      String(bucket.bucket).includes(">") || String(bucket.bucket).includes("8")
        ? "bad"
        : String(bucket.bucket).includes("4")
          ? "warn"
          : "good"
    ),
  }));
}

function singleMarketSlippageBuckets(buckets: SingleMarketSlippageDistribution) {
  if (!Array.isArray(buckets)) return [];
  return buckets.map((bucket) => {
    const label = String(bucket.bucket ?? "");
    return {
      bucket: label,
      count: numberValue(bucket.trade_count) ?? 0,
      tone: label.includes(">") || label.includes("5c")
        ? "bad" as const
        : label.includes("3-5")
          ? "warn" as const
          : "good" as const,
    };
  });
}

function percentValue(value: string | number | null | undefined): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function apiSlippageNotionalBuckets(
  buckets: Array<{
    bucket?: string | null;
    trade_count?: string | number | null;
    avg_slippage?: string | number | null;
    avg_trade_slippage?: string | number | null;
  }> | null | undefined,
): SlippageNotionalBucket[] {
  if (!Array.isArray(buckets)) return [];
  return buckets.map((bucket) => {
    const avgSlippagePct = percentValue(bucket.avg_trade_slippage ?? bucket.avg_slippage);
    return {
      bucket: String(bucket.bucket ?? "unknown"),
      tradeCount: numberValue(bucket.trade_count) ?? 0,
      avgSlippagePct,
      tone: slippageTone(avgSlippagePct),
    };
  });
}

function mapSingleMarketMetrics(payload: SingleMarketRealtimePayload): SingleMarketMetrics | null {
  if (payload.code !== 0 || !payload.data) return null;
  const business = payload.data.business;
  const slippage = payload.data.slippage;
  return {
    grossVolume: raw6ToUsdb(business?.gross_volume),
    netVolume: raw6ToUsdb(business?.net_volume),
    traderCount: numberValue(business?.trader_count) ?? 0,
    pnl: raw6ToUsdb(payload.data.pnl?.current_pnl),
    washRatio: numberValue(business?.wash_ratio),
    avgSlippage: slippage?.avg_trade_slippage === null || slippage?.avg_trade_slippage === undefined
      ? null
      : (numberValue(slippage.avg_trade_slippage) ?? 0) * 100,
    slippageBuckets: singleMarketSlippageBuckets(slippage?.distribution),
    slippageNotionalBuckets: apiSlippageNotionalBuckets(slippage?.distribution_by_notional),
    backendData: {
      grossVolume: business?.gross_volume !== null && business?.gross_volume !== undefined,
      netVolume: business?.net_volume !== null && business?.net_volume !== undefined,
      traderCount: business?.trader_count !== null && business?.trader_count !== undefined,
      pnl: payload.data.pnl?.current_pnl !== null && payload.data.pnl?.current_pnl !== undefined,
      washRatio: business?.wash_ratio !== null && business?.wash_ratio !== undefined,
      avgSlippage: slippage?.avg_trade_slippage !== null && slippage?.avg_trade_slippage !== undefined,
      slippageDistribution: Array.isArray(slippage?.distribution),
      businessTrend: false,
    },
    experienceHistory: (slippage?.history ?? []).flatMap((point) => {
      const pointTs = apiTimestamp(point.ts, Number.NaN);
      if (!Number.isFinite(pointTs)) return [];
      return [{
        ts: pointTs,
        time: "",
        slippagePct: percentValue(point.slippage_pct),
        impactPct: percentValue(point.impact_pct),
      }];
    }),
  };
}

function applySingleMarketMetrics(marketItem: Market, metrics: SingleMarketMetrics | undefined) {
  if (!metrics) return marketItem;
  const { experienceHistory, ...marketMetrics } = metrics;
  const boundedExperienceHistory = experienceHistory.map((point) => {
    const pointTs = clampTimestamp(point.ts, timestamp(marketItem.startAt), timestamp(marketItem.endAt));
    return {
      ...point,
      ts: pointTs,
      time: formatAxisTime(pointTs, marketItem.startAt, marketItem.endAt),
    };
  });
  return {
    ...marketItem,
    ...marketMetrics,
    experienceQuality: boundedExperienceHistory.length
      ? {
          ...(marketItem.experienceQuality ?? {
            observedDurationSeconds: 0,
            l1DistanceThresholdPct: 0.01,
            singleSidedEmpty: { count: 0, durationSeconds: 0, durationRatio: 0 },
            doubleSidedEmpty: { count: 0, durationSeconds: 0, durationRatio: 0 },
            l1DistanceExceeded: { count: 0, durationSeconds: 0, durationRatio: 0 },
            incidents: [],
            history: [],
          }),
          history: boundedExperienceHistory,
        }
      : marketItem.experienceQuality,
  };
}

function reasonLabel(reasonCode: string | null | undefined, direction?: "increase" | "decrease" | null) {
  const raw = String(reasonCode ?? "");
  if (raw.includes("inventory")) return direction === "increase" ? "库存压力回落，补回做市深度" : "库存偏离目标，削减风险侧深度";
  if (raw.includes("budget") || raw.includes("loss")) return direction === "increase" ? "预算占用下降，恢复 quote size" : "最坏情形 PnL 接近预算，减少挂单";
  if (raw.includes("fresh") || raw.includes("stale") || raw.includes("delay")) return direction === "increase" ? "数据新鲜度恢复，重新打开挂单" : "数据延迟，撤掉远端档位";
  if (raw.includes("negrisk") || raw.includes("group")) return direction === "increase" ? "组级保护压力缓解，恢复安全 bucket" : "组级损失保护触发，削减相关 bucket";
  if (raw.includes("endgame") || raw.includes("tail")) return direction === "increase" ? "临期压力缓解，小幅补回近端流动性" : "进入临期窗口，降低 quote size";
  return direction === "increase" ? "策略恢复部分市场深度" : "策略减少市场深度";
}

function liquidityReasonLabel(
  point: NonNullable<NonNullable<DashboardRealtimeItem["liquidity"]>["history"]>[number],
) {
  const delta = numberValue(point.delta);
  if (delta === null || delta === 0) return null;
  return (
    point.reason?.label_zh
    ?? point.reason?.detail
    ?? reasonLabel(point.reason?.code ?? point.reason_code, point.direction)
  );
}

function flashKindStats(
  flash: DashboardRealtimeItem["flash"] | undefined,
  kind: "tier1" | "mid",
) {
  const nested = flash?.actual_pairs_by_kind?.[kind];
  const prefix = kind === "tier1" ? "tier1" : "mid";
  return {
    pairsPerHour:
      numberValue(flash?.[`${prefix}_actual_pairs_per_hour`])
      ?? numberValue(nested?.actual_pairs_per_hour),
    avgIntervalS:
      numberValue(flash?.[`${prefix}_actual_avg_interval_s`])
      ?? numberValue(nested?.actual_avg_interval_s),
    observed:
      numberValue(flash?.[`${prefix}_actual_pairs_observed`])
      ?? numberValue(nested?.actual_pairs_observed),
    activePairs: numberValue(flash?.active_pairs_by_kind?.[kind]),
  };
}

function dashboardIncidentMetric(
  metric: DashboardIncidentMetric | null | undefined,
  observedDurationSeconds: number,
): ExperienceIncidentMetric {
  const durationSeconds = numberValue(metric?.duration_s) ?? 0;
  return {
    count: numberValue(metric?.count) ?? 0,
    durationSeconds,
    durationRatio: numberValue(metric?.duration_ratio) ?? durationSeconds / Math.max(1, observedDurationSeconds),
  };
}

function isExperienceIncidentKind(value: string | null | undefined): value is ExperienceIncidentKind {
  return value === "single_sided_empty" || value === "double_sided_empty" || value === "l1_distance_exceeded";
}

function mapExperienceQuality(
  quality: DashboardRealtimeItem["experience_quality"],
  startAt: string,
  endAt: string,
) {
  if (!quality) return undefined;
  const start = timestamp(startAt);
  const end = timestamp(endAt);
  const observedDurationSeconds = numberValue(quality.observed_duration_s) ?? Math.max(60, Math.round((Math.min(Date.now(), end) - start) / 1000));
  const incidents = (quality.incidents ?? []).flatMap((incident) => {
    if (!isExperienceIncidentKind(incident.type)) return [];
    const incidentTs = clampTimestamp(apiTimestamp(incident.ts, start), start, end);
    return [{
      ts: incidentTs,
      time: formatAxisTime(incidentTs, startAt, endAt),
      kind: incident.type,
      durationSeconds: numberValue(incident.duration_s) ?? 0,
      valuePct: percentValue(incident.value_pct),
    } satisfies ExperienceIncident];
  });
  const history = (quality.history ?? []).map((point) => {
    const pointTs = clampTimestamp(apiTimestamp(point.ts, start), start, end);
    return {
      ts: pointTs,
      time: formatAxisTime(pointTs, startAt, endAt),
      slippagePct: percentValue(point.slippage_pct),
      impactPct: percentValue(point.impact_pct),
    } satisfies ExperienceHistoryPoint;
  });

  return {
    observedDurationSeconds,
    l1DistanceThresholdPct: numberValue(quality.l1_distance_threshold_pct) ?? 0.01,
    singleSidedEmpty: dashboardIncidentMetric(quality.single_sided_empty, observedDurationSeconds),
    doubleSidedEmpty: dashboardIncidentMetric(quality.double_sided_empty, observedDurationSeconds),
    l1DistanceExceeded: dashboardIncidentMetric(quality.l1_distance_exceeded, observedDurationSeconds),
    incidents,
    history,
  };
}

function mapDashboardItem(item: DashboardRealtimeItem, index: number): Market | null {
  const conditionId = item.identity?.condition_id;
  if (!conditionId) return null;

  const now = Date.now();
  const configuredStart = numberValue(item.lifecycle?.start_time);
  const startAt = isoTime(
    configuredStart !== null && configuredStart > 0
      ? item.lifecycle?.start_time
      : item.lifecycle?.create_time,
    now - 4 * 60 * MINUTE_MS,
  );
  const endAt = isoTime(item.lifecycle?.end_time, now + 2 * 60 * MINUTE_MS);
  const riskStatus = statusValue(item.quote_state?.risk_status);
  const quoteMode = statusValue(item.quote_state?.quote_mode ?? item.quote_state?.risk_status);
  const bestBid = numberValue(item.orderbook_quality?.best_bid) ?? 0;
  const bestAsk = numberValue(item.orderbook_quality?.best_ask) ?? 0;
  const mid = numberValue(item.orderbook_quality?.mid) ?? (bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0);
  const spread = numberValue(item.orderbook_quality?.spread) ?? (bestBid && bestAsk ? bestAsk - bestBid : 0);
  const grossVolumeValue = numberValue(item.backend_required?.gross_volume);
  const pnlValue = numberValue(item.backend_required?.current_pnl);
  const traderCountValue = numberValue(item.backend_required?.trader_count);
  const grossVolume = grossVolumeValue ?? 0;
  const pnl = pnlValue ?? 0;
  const washRatio = numberValue(item.backend_required?.wash_ratio);
  const traderCount = traderCountValue ?? 0;
  const liquidity =
    numberValue(item.liquidity?.current_strategy_liquidity)
    ?? numberValue(item.liquidity?.current_book_liquidity)
    ?? 0;
  const startMs = timestamp(startAt);
  const endMs = timestamp(endAt);
  const qMax = numberValue(item.risk?.q_max) ?? 80;
  const worstCasePnl = numberValue(item.risk?.worst_case_pnl) ?? 0;
  const maxLossBudget = numberValue(item.risk?.max_loss_budget) ?? 30;
  const staleSeconds =
    Math.round(
      numberValue(item.dependencies?.runtime_snapshot_age_s)
      ?? numberValue(item.dependencies?.order_snapshot_age_s)
      ?? 0,
    );
  const series = buildSeries(index, Math.max(grossVolume, 1), pnl, spread, washRatio).map((point, pointIndex) => ({
    ...point,
    ...lifecyclePoints(startAt, endAt, 7)[pointIndex],
  }));
  const initialBaseline =
    numberValue(item.liquidity?.initial_liquidity)
    ?? numberValue(item.liquidity?.history?.[0]?.liquidity)
    ?? liquidity;
  const liquidityHistory = (item.liquidity?.history ?? []).map((point) => {
    const pointTs = apiTimestamp(point.ts, startMs);
    const delta = numberValue(point.delta);
    return {
      ts: clampTimestamp(pointTs, startMs, endMs),
      time: formatAxisTime(pointTs, startAt, endAt),
      availableLiquidity: numberValue(point.liquidity) ?? 0,
      initialBaseline,
      liquidityDelta: delta,
      liquidityDirection: point.direction ?? null,
      liquidityReason: liquidityReasonLabel(point),
    };
  });
  const events = (item.risk_events ?? []).map((eventItem) => {
    const eventTs = apiTimestamp(eventItem.ts, startMs);
    const status = statusValue(eventItem.risk_status);
    return {
      ts: clampTimestamp(eventTs, startMs, endMs),
      time: formatAxisTime(eventTs, startAt, endAt),
      type: statusMeta[status].short.toLowerCase(),
      detail: eventItem.label_zh ?? eventItem.reason_code ?? eventItem.trigger ?? statusMeta[status].label,
      severity: severityValue(eventItem.severity),
    };
  });

  const tier1Flash = flashKindStats(item.flash, "tier1");
  const midFlash = flashKindStats(item.flash, "mid");
  const rawL1Distance = item.flash?.l1_distance_ticks;
  const l1DistanceTicks = typeof rawL1Distance === "object" && rawL1Distance !== null
    ? numberValue(rawL1Distance.max_distance_ticks)
    : numberValue(rawL1Distance);
  const phase = settlementPhase(item.lifecycle?.settlement_phase);
  const tier1ConfiguredMin = numberValue(item.flash?.configured_frequency?.tier1_interval_min_s);
  const tier1ConfiguredMax = numberValue(item.flash?.configured_frequency?.tier1_interval_max_s);
  const midConfiguredMin = numberValue(item.flash?.configured_frequency?.mid_interval_min_s);
  const midConfiguredMax = numberValue(item.flash?.configured_frequency?.mid_interval_max_s);

  return {
    id: conditionId,
    event: readableLabel(item.identity?.event_title) ?? readableLabel(item.identity?.title) ?? `Market ${index + 1}`,
    market: readableLabel(item.identity?.title) ?? readableLabel(item.identity?.event_title) ?? `Condition ${compactIdentifier(conditionId)}`,
    category: "Strategy · Runtime",
    tags: ["Strategy"],
    status: marketStatus(riskStatus, item.lifecycle?.runtime_state),
    riskStatus,
    quoteMode,
    riskReason: item.quote_state?.detail ?? riskReasonFor(riskStatus),
    grossVolume,
    netVolume: numberValue(item.backend_required?.net_volume),
    traderCount,
    pnl,
    washRatio,
    inventory: numberValue(item.risk?.q) ?? 0,
    qMax,
    worstCasePnl,
    maxLossBudget,
    bestBid,
    bestAsk,
    spread,
    mid: Number(mid.toFixed(3)),
    askSlope: numberValue(item.orderbook_quality?.ask_k),
    bidSlope: numberValue(item.orderbook_quality?.bid_k),
    avgSlippage: numberValue(item.backend_required?.avg_slippage),
    staleSeconds,
    liquidity,
    startAt,
    endAt,
    endInMinutes: endMinutes(endAt),
    lifecycle: {
      settlementPhase: phase,
      acceptingOrders: item.lifecycle?.accepting_orders ?? phase !== "claimable",
      closed: Boolean(item.lifecycle?.closed),
      currentOutcome: readableLabel(item.lifecycle?.current_outcome),
      settledOutcome: readableLabel(item.lifecycle?.settled_outcome),
      disputeCount: Math.max(0, Math.round(numberValue(item.lifecycle?.dispute_count) ?? 0)),
      phaseEndAt: optionalIsoTime(item.lifecycle?.phase_end_timestamp),
      updatedAt: optionalIsoTime(item.lifecycle?.lifecycle_updated_at_ms),
      settledAt: optionalIsoTime(item.lifecycle?.settled_at),
    },
    series,
    slippageBuckets: apiSlippageBuckets(item.backend_required?.slippage_distribution),
    slippageNotionalBuckets: apiSlippageNotionalBuckets(item.backend_required?.slippage_distribution_by_notional),
    bidLevels: apiLevels(item.orderbook_quality?.yes, "bids"),
    askLevels: apiLevels(item.orderbook_quality?.yes, "asks"),
    noBidLevels: apiLevels(item.orderbook_quality?.no, "bids"),
    noAskLevels: apiLevels(item.orderbook_quality?.no, "asks"),
    events,
    liquidityHistory: liquidityHistory.length ? liquidityHistory : undefined,
    experienceQuality: mapExperienceQuality(item.experience_quality, startAt, endAt),
    flash: {
      actualPairsPerHour: numberValue(item.flash?.actual_pairs_per_hour),
      actualAvgIntervalS: numberValue(item.flash?.actual_avg_interval_s),
      tier1PairsPerHour: tier1Flash.pairsPerHour,
      tier1AvgIntervalS: tier1Flash.avgIntervalS,
      midPairsPerHour: midFlash.pairsPerHour,
      midAvgIntervalS: midFlash.avgIntervalS,
      activePairs: numberValue(item.flash?.active_pairs),
      tier1ActivePairs: tier1Flash.activePairs,
      midActivePairs: midFlash.activePairs,
      maxPairsTotal: numberValue(item.flash?.max_pairs_total),
      l1DistanceTicks,
      tier1ConfiguredIntervalS: tier1ConfiguredMin !== null && tier1ConfiguredMax !== null
        ? [tier1ConfiguredMin, tier1ConfiguredMax]
        : null,
      midConfiguredIntervalS: midConfiguredMin !== null && midConfiguredMax !== null
        ? [midConfiguredMin, midConfiguredMax]
        : null,
    },
    backendData: {
      grossVolume: grossVolumeValue !== null,
      netVolume: numberValue(item.backend_required?.net_volume) !== null,
      traderCount: traderCountValue !== null,
      pnl: pnlValue !== null,
      washRatio: washRatio !== null,
      avgSlippage: numberValue(item.backend_required?.avg_slippage) !== null,
      slippageDistribution: Array.isArray(item.backend_required?.slippage_distribution),
      businessTrend: false,
    },
  };
}

function mapDashboardPayload(payload: DashboardRealtimePayload): Market[] {
  if (payload.contract_version !== "mm-dashboard-realtime.v1") return [];
  const now = Date.now();
  return (payload.items ?? [])
    .filter((item) => !isExpiredDashboardItem(item, now))
    .filter(hasReadableDashboardTitle)
    .map((item, index) => mapDashboardItem(item, index))
    .filter((marketItem): marketItem is Market => Boolean(marketItem));
}

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>(mockMarkets);
  const [dataSource, setDataSource] = useState<DataSourceState>({
    mode: "loading",
    label: "LOADING",
    detail: "正在请求策略端 dashboard API",
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeId, setActiveId] = useState(mockMarkets[0].id);
  const [filter, setFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("1h");
  const [query, setQuery] = useState("");
  const [liveClock, setLiveClock] = useState("--:--:--");
  const [activeBoard, setActiveBoard] = useState<BoardId>("macro");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("realtime");
  const [singleMarketMetrics, setSingleMarketMetrics] = useState<Record<string, SingleMarketMetrics>>({});

  useEffect(() => {
    const updateClock = () => {
      setLiveClock(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function loadDashboard() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/dashboard/realtime", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`dashboard API ${response.status}`);
        }
        const payload = await response.json() as DashboardRealtimePayload;
        const nextMarkets = mapDashboardPayload(payload);
        if (!nextMarkets.length) {
          throw new Error("dashboard API returned no markets");
        }
        if (cancelled) return;
        setMarkets(nextMarkets);
        setActiveId((current) => nextMarkets.some((marketItem) => marketItem.id === current) ? current : nextMarkets[0].id);
        setDataSource({
          mode: "api",
          label: "API",
          detail: "策略端 /api/dashboard/realtime",
        });
      } catch (error) {
        if (cancelled) return;
        setMarkets(mockMarkets);
        setActiveId((current) => mockMarkets.some((marketItem) => marketItem.id === current) ? current : mockMarkets[0].id);
        setDataSource({
          mode: "mock",
          label: "MOCK",
          detail: error instanceof Error ? error.message : "dashboard API unavailable",
        });
      } finally {
        inFlight = false;
      }
    }

    loadDashboard();
    const timer = window.setInterval(loadDashboard, DASHBOARD_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshTick]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedFilter = filterOptions.find((option) => option.id === filter);

    return markets
      .filter((marketItem) => {
        if (filter === "attention") {
          return statusMeta[marketItem.riskStatus].tone !== "ok" || marketItem.staleSeconds > 60;
        }
        if (selectedFilter?.tag) return marketItem.tags.includes(selectedFilter.tag);
        return true;
      })
      .filter((marketItem) => {
        if (!normalizedQuery) return true;
        return `${marketItem.event} ${marketItem.market} ${marketItem.category} ${marketItem.tags.join(" ")} ${marketItem.id}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const severity = { bad: 0, warn: 1, muted: 2, ok: 3 };
        return severity[statusMeta[a.riskStatus].tone] - severity[statusMeta[b.riskStatus].tone];
      });
  }, [filter, markets, query]);

  const activeMarket = markets.find((marketItem) => marketItem.id === activeId) ?? markets[0];
  const visibleMarketBase = filteredMarkets.some((marketItem) => marketItem.id === activeMarket.id)
    ? activeMarket
    : filteredMarkets[0] ?? activeMarket;
  const visibleMarket = applySingleMarketMetrics(visibleMarketBase, singleMarketMetrics[visibleMarketBase.id]);

  useEffect(() => {
    if (!visibleMarketBase?.id) return undefined;
    const controller = new AbortController();

    async function loadSingleMarketMetrics() {
      try {
        const params = new URLSearchParams({
          condition_id: visibleMarketBase.id,
          window: timeframe,
        });
        const response = await fetch(`/api/dashboard/market-realtime?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json() as SingleMarketRealtimePayload;
        const metrics = mapSingleMarketMetrics(payload);
        if (!metrics || controller.signal.aborted) return;
        setSingleMarketMetrics((current) => ({
          ...current,
          [visibleMarketBase.id]: metrics,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("single market metrics unavailable", error);
      }
    }

    loadSingleMarketMetrics();
    return () => controller.abort();
  }, [refreshTick, timeframe, visibleMarketBase?.id]);

  const inventoryUsed = Math.min(100, (Math.abs(visibleMarket.inventory) / visibleMarket.qMax) * 100);
  const lossUsed = Math.min(100, (Math.abs(visibleMarket.worstCasePnl) / visibleMarket.maxLossBudget) * 100);
  return (
    <main className="terminal-shell">
      <section className="topbar">
        <nav className="console-workspaces" aria-label="切换实时看板与做市复盘">
          <button className={workspaceView === "realtime" ? "active" : ""} type="button" onClick={() => setWorkspaceView("realtime")}>
            <span className="brand-mark">MM</span>
            <span className="workspace-label">
              <small>Market Making Console</small>
              <strong>实时市场看板</strong>
            </span>
          </button>
          <button className={workspaceView === "review" ? "active" : ""} type="button" onClick={() => setWorkspaceView("review")}>
            <span className="workspace-mark"><LineChart size={19} /></span>
            <span className="workspace-label">
              <small>Strategy Review</small>
              <strong>做市 Review</strong>
            </span>
          </button>
        </nav>

        <div className="topbar-actions">
          <div className={`feed-pill data-source-${workspaceView === "review" ? "mock" : dataSource.mode}`} title={workspaceView === "review" ? "Review 首版使用与策略参数一致的演示数据" : dataSource.detail}>
            <Radio size={15} />
            <span>{workspaceView === "review" ? "REVIEW MOCK" : dataSource.label}</span>
            <strong>{liveClock}</strong>
          </div>
          <button className="icon-button" type="button" title="刷新" onClick={() => setRefreshTick((value) => value + 1)}>
            <RefreshCw size={16} />
          </button>
          <button className="icon-button alert" type="button" title="告警">
            <Bell size={16} />
          </button>
        </div>
      </section>

      {workspaceView === "review" ? (
        <ReviewDashboard
          markets={markets}
          visibleMarket={visibleMarket}
          setActiveId={setActiveId}
        />
      ) : (
        <>
      <MarketOverview
        markets={markets}
        filteredMarkets={filteredMarkets}
        marketCount={markets.length}
        visibleMarket={visibleMarket}
        filter={filter}
        setFilter={setFilter}
        query={query}
        setQuery={setQuery}
        setActiveId={setActiveId}
      />

      <div className="scope-divider" aria-label="市场筛选与单市场信息分割">
        <span>总体市场筛选</span>
        <i />
        <span>单市场信息</span>
      </div>

      <section className="market-main">
        <div className="detail-header">
          <div>
            <div className="title-line">
              <h2>{visibleMarket.event}</h2>
              <span className={`state-chip ${statusMeta[visibleMarket.riskStatus].tone}`}>
                {statusMeta[visibleMarket.riskStatus].label}
              </span>
            </div>
            <p>{visibleMarket.market} · {visibleMarket.category} · {compactIdentifier(visibleMarket.id)}</p>
          </div>

          <div className="quote-box">
            <div>
              <span>Bid</span>
              <strong className="bid">{price(visibleMarket.bestBid)}</strong>
            </div>
            <div>
              <span>Mid</span>
              <strong>{price(visibleMarket.mid)}</strong>
            </div>
            <div>
              <span>Ask</span>
              <strong className="ask">{price(visibleMarket.bestAsk)}</strong>
            </div>
            <div>
              <span>Spr</span>
              <strong>{visibleMarket.spread ? `${(visibleMarket.spread * 100).toFixed(1)}c` : "--"}</strong>
            </div>
          </div>
        </div>

        <section className="board-switcher" aria-label="Dashboard categories">
          {boardOptions.map((board) => (
            <button
              key={board.id}
              className={activeBoard === board.id ? "active" : ""}
              type="button"
              onClick={() => setActiveBoard(board.id)}
            >
              <span>{board.icon}</span>
              <strong>{board.title}</strong>
              <small>{board.subtitle}</small>
            </button>
          ))}
        </section>

        {activeBoard === "macro" && (
          <MacroBoard visibleMarket={visibleMarket} timeframe={timeframe} setTimeframe={setTimeframe} />
        )}

        {activeBoard === "experience" && (
          <ExperienceBoard
            visibleMarket={visibleMarket}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
          />
        )}

        {activeBoard === "risk" && (
          <RiskBoard
            visibleMarket={visibleMarket}
            inventoryUsed={inventoryUsed}
            lossUsed={lossUsed}
          />
        )}
      </section>
        </>
      )}
    </main>
  );
}

type ReviewData = {
  funnel: Array<{ stage: string; count: number; conversion: number }>;
  toxicity: Array<{ kind: string; count: number; color: string }>;
  pnlAttribution: Array<{ name: string; value: number; color: string }>;
  pricing: Array<{ tradeIndex: number; price: number; openingPrice: number }>;
  quoteAttempts: Array<{ bucket: string; count: number }>;
  averageScore: number;
  favorableRate: number;
  openingPrice: number;
  mae10: number;
  mae30: number;
  mae100: number;
};

function reviewSeed(market: Market) {
  return market.id.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function buildReviewData(market: Market): ReviewData {
  const seed = reviewSeed(market);
  const visits = 420 + (seed % 170);
  const interactions = Math.round(visits * (0.54 + (seed % 7) / 100));
  const quoteAttempts = Math.round(interactions * (0.7 + (seed % 5) / 100));
  const submitted = Math.round(quoteAttempts * (0.58 + (seed % 9) / 100));
  const completed = Math.max(18, Math.round(submitted * (0.68 + (seed % 6) / 100)));
  const favorable = Math.round(completed * (0.46 + (seed % 5) / 100));
  const adverse = Math.round(completed * (0.27 + (seed % 6) / 100));
  const neutral = Math.max(0, completed - favorable - adverse);
  const spreadIncome = Number(Math.max(8, market.grossVolume * 0.0012).toFixed(1));
  const slippageLoss = Number(-Math.max(3, market.grossVolume * 0.00034).toFixed(1));
  const fees = Number(-Math.max(1.2, market.grossVolume * 0.00008).toFixed(1));
  const inventoryIncome = Number((market.pnl - spreadIncome - slippageLoss - fees).toFixed(1));
  const openingPrice = Number(Math.min(0.92, Math.max(0.08, market.mid || 0.5)).toFixed(3));
  const amplitude = 0.014 + (seed % 6) * 0.0015;
  const openingBias = ((seed % 5) - 2) * 0.0012;
  const pricing = Array.from({ length: 100 }, (_, index) => {
    const tradeIndex = index + 1;
    const centeredMove = Math.sin(tradeIndex * 1.47 + seed * 0.01)
      * amplitude
      * (1 + 0.24 * Math.cos(tradeIndex * 0.23));
    const price = Math.min(0.99, Math.max(0.01, openingPrice + centeredMove + openingBias * Math.exp(-index / 28)));
    return { tradeIndex, price: Number(price.toFixed(4)), openingPrice };
  });
  const mae = (sampleSize: number) => Number((pricing
    .slice(0, sampleSize)
    .reduce((total, point) => total + Math.abs(point.price - openingPrice), 0) / sampleSize * 100).toFixed(2));

  return {
    funnel: [
      { stage: "进入市场", count: visits, conversion: 100 },
      { stage: "交易互动", count: interactions, conversion: (interactions / visits) * 100 },
      { stage: "尝试报价", count: quoteAttempts, conversion: (quoteAttempts / visits) * 100 },
      { stage: "提交订单", count: submitted, conversion: (submitted / visits) * 100 },
      { stage: "完成成交", count: completed, conversion: (completed / visits) * 100 },
    ],
    toxicity: [
      { kind: "有利成交", count: favorable, color: "#20d49b" },
      { kind: "中性成交", count: neutral, color: "#7e8796" },
      { kind: "不利成交", count: adverse, color: "#ff5c6c" },
    ],
    pnlAttribution: [
      { name: "价差收入", value: spreadIncome, color: "#20d49b" },
      { name: "库存收益", value: inventoryIncome, color: inventoryIncome >= 0 ? "#4cc9f0" : "#ff5c6c" },
      { name: "滑点损失", value: slippageLoss, color: "#ff5c6c" },
      { name: "费用", value: fees, color: "#ffb020" },
    ],
    pricing,
    quoteAttempts: [
      { bucket: "2-10u", count: Math.round(quoteAttempts * 0.68) },
      { bucket: "10-100u", count: Math.round(quoteAttempts * 0.24) },
      { bucket: ">100u", count: Math.round(quoteAttempts * 0.08) },
    ],
    averageScore: Number(((favorable - adverse) / completed * 1.8).toFixed(2)),
    favorableRate: Number((favorable / completed * 100).toFixed(1)),
    openingPrice,
    mae10: mae(10),
    mae30: mae(30),
    mae100: mae(100),
  };
}

function ReviewDashboard({
  markets,
  visibleMarket,
  setActiveId,
}: {
  markets: Market[];
  visibleMarket: Market;
  setActiveId: (value: string) => void;
}) {
  const review = useMemo(() => buildReviewData(visibleMarket), [visibleMarket]);
  const [reviewFocus, setReviewFocus] = useState<"all" | "opening" | "intraday" | "endgame">("all");
  const completedTrades = review.funnel.at(-1)?.count ?? 0;
  const cancellationRate = ((review.funnel[2].count - review.funnel[3].count) / review.funnel[2].count) * 100;
  const effectiveInterval = visibleMarket.flash?.actualAvgIntervalS ?? 12;
  const liquidityChanges = visibleMarket.liquidityHistory?.filter((point) => point.liquidityReason).length ?? 0;
  const focusReviewSection = (focus: "all" | "opening" | "intraday" | "endgame", targetId: string) => {
    setReviewFocus(focus);
    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section className="review-workspace" id="review-all">
      <div className="review-toolbar">
        <div>
          <p className="section-label">Post-trade Strategy Review</p>
          <strong>单市场全生命周期复盘</strong>
        </div>
        <label className="review-market-select">
          <span>复盘市场</span>
          <select value={visibleMarket.id} onChange={(event) => setActiveId(event.target.value)}>
            {markets.map((market) => <option key={market.id} value={market.id}>{market.event}</option>)}
          </select>
        </label>
        <div className="review-period" aria-label="Review 阶段快速定位">
          <button className={reviewFocus === "all" ? "active" : ""} type="button" onClick={() => focusReviewSection("all", "review-all")}>全部</button>
          <button className={reviewFocus === "opening" ? "active" : ""} type="button" onClick={() => focusReviewSection("opening", "review-opening")}>开盘定价</button>
          <button className={reviewFocus === "intraday" ? "active" : ""} type="button" onClick={() => focusReviewSection("intraday", "review-intraday")}>盘中调整</button>
          <button className={reviewFocus === "endgame" ? "active" : ""} type="button" onClick={() => focusReviewSection("endgame", "review-endgame")}>尾盘挂单</button>
        </div>
      </div>

      <div className="review-market-heading">
        <div>
          <div className="title-line">
            <h2>{visibleMarket.event}</h2>
            <span className="state-chip warn">演示复盘</span>
          </div>
          <p>{visibleMarket.market} · {visibleMarket.category} · {compactIdentifier(visibleMarket.id)}</p>
        </div>
        <MarketLifecycle market={visibleMarket} />
      </div>

      <section className="review-domain review-domain-activity" aria-labelledby="review-activity-title">
        <div className="review-domain-header">
          <span className="review-domain-icon"><BarChart3 size={19} /></span>
          <div>
            <p className="section-label">Review Area 01</p>
            <h2 id="review-activity-title">市场活跃度复盘</h2>
            <small>用户访问、交易意向、试价与成交转化</small>
          </div>
        </div>

        <div className="review-summary-grid review-summary-activity">
          <ReviewMetric label="访问到成交" value={`${review.funnel.at(-1)?.conversion.toFixed(1)}%`} note={`${review.funnel[0].count} 次访问 / ${completedTrades} 笔成交`} tone="ok" />
          <ReviewMetric label="取消率" value={`${cancellationRate.toFixed(1)}%`} note="尝试报价后未提交订单" tone={cancellationRate <= 35 ? "ok" : "warn"} />
        </div>

        <div className="review-grid review-grid-activity">
          <div className="panel review-panel">
            <div className="panel-title">
              <span><BarChart3 size={16} /> 市场活跃度与成交漏斗</span>
              <small>需要前端行为埋点</small>
            </div>
            <div className="review-funnel">
              {review.funnel.map((item) => (
                <div key={item.stage}>
                  <span>{item.stage}</span>
                  <div><i style={{ width: `${item.conversion}%` }} /></div>
                  <strong>{item.count}</strong>
                  <em>{item.conversion.toFixed(1)}%</em>
                </div>
              ))}
            </div>
          </div>

          <div className="panel review-panel">
            <div className="panel-title">
              <span><Gauge size={16} /> 试价金额分布</span>
              <small>quote attempts</small>
            </div>
            <div className="review-bar-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={review.quoteAttempts} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#252a33" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#7e8796" tickLine={false} axisLine={false} />
                  <YAxis stroke="#7e8796" tickLine={false} axisLine={false} />
                  <Tooltip content={<ReviewTooltip />} />
                  <Bar dataKey="count" name="尝试次数" fill="#4cc9f0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="review-footnote">大额试价需结合用户余额分层判断，不能直接视为异常。</p>
          </div>
        </div>
      </section>

      <section className="review-domain review-domain-strategy" aria-labelledby="review-strategy-title">
        <div className="review-domain-header">
          <span className="review-domain-icon"><ShieldAlert size={19} /></span>
          <div>
            <p className="section-label">Review Area 02</p>
            <h2 id="review-strategy-title">策略合理性复盘</h2>
            <small>成交质量、盈亏来源、开盘定价与阶段策略</small>
          </div>
        </div>

        <div className="review-summary-grid review-summary-strategy">
          <ReviewMetric label="有利成交占比" value={`${review.favorableRate}%`} note="1 分钟后继成交 Score 口径" tone={review.favorableRate >= 50 ? "ok" : "warn"} />
          <ReviewMetric label="净 PnL" value={signedCurrency(visibleMarket.pnl)} note="价差 + 库存 - 滑点 - 费用" tone={visibleMarket.pnl >= 0 ? "ok" : "bad"} />
          <ReviewMetric label="开盘 MAE100" value={`${review.mae100.toFixed(2)}c`} note="前 100 笔成交相对开盘价" tone={review.mae100 <= 3 ? "ok" : "warn"} />
        </div>

        <div className="review-grid">
          <div className="panel review-panel">
            <div className="panel-title">
              <span><Activity size={16} /> 订单流毒性</span>
              <small>成交后 1 分钟观察窗</small>
            </div>
            <div className="review-kpi-row">
              <span><small>平均 Score</small><strong className={review.averageScore >= 0 ? "positive" : "negative"}>{review.averageScore > 0 ? "+" : ""}{review.averageScore}c</strong></span>
              <span><small>有利成交</small><strong>{review.favorableRate}%</strong></span>
              <span><small>样本</small><strong>{completedTrades}</strong></span>
            </div>
            <div className="review-bar-frame compact">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={review.toxicity} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#252a33" vertical={false} />
                  <XAxis dataKey="kind" stroke="#7e8796" tickLine={false} axisLine={false} />
                  <YAxis stroke="#7e8796" tickLine={false} axisLine={false} />
                  <Tooltip content={<ReviewTooltip />} />
                  <Bar dataKey="count" name="成交笔数" radius={[3, 3, 0, 0]}>{review.toxicity.map((item) => <Cell key={item.kind} fill={item.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel review-panel">
            <div className="panel-title">
              <span><LineChart size={16} /> 盈亏归因</span>
              <small>PnL attribution</small>
            </div>
            <div className="review-attribution-list">
              {review.pnlAttribution.map((item) => (
                <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><strong className={item.value >= 0 ? "positive" : "negative"}>{signedCurrency(item.value)}</strong></div>
              ))}
              <div className="total"><i /><span>净 PnL</span><strong className={visibleMarket.pnl >= 0 ? "positive" : "negative"}>{signedCurrency(visibleMarket.pnl)}</strong></div>
            </div>
          </div>
        </div>

        <div className="review-phases">
          <div className="panel review-phase-card review-phase-opening" id="review-opening">
            <ReviewPhaseHeader index="01" eyebrow="Opening Pricing" title="开盘定价合理性" description="判断前 100 笔成交是否持续围绕开盘价格" tone={review.mae100 <= 3 ? "ok" : "warn"} result={review.mae100 <= 3 ? "合理" : "需复核"} />
            <div className="review-opening-layout">
              <div className="review-mae-summary">
                <div className="review-opening-price"><span>开盘价格</span><strong>{review.openingPrice.toFixed(3)}</strong></div>
                <div className="review-mae-grid">
                  <ReviewEvidence label="MAE10" value={`${review.mae10.toFixed(2)}c`} note="前 10 笔" />
                  <ReviewEvidence label="MAE30" value={`${review.mae30.toFixed(2)}c`} note="前 30 笔" />
                  <ReviewEvidence label="MAE100" value={`${review.mae100.toFixed(2)}c`} note="前 100 笔" />
                </div>
                <p>MAE N = 前 N 笔成交价与开盘价绝对偏差的均值。首版演示判断线为 3c。</p>
              </div>
              <div className="review-pricing-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={review.pricing} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#252a33" vertical={false} />
                    <XAxis dataKey="tradeIndex" ticks={[1, 10, 30, 60, 100]} tickFormatter={(value) => `#${value}`} stroke="#7e8796" tickLine={false} axisLine={false} />
                    <YAxis domain={["dataMin - 0.02", "dataMax + 0.02"]} tickFormatter={(value) => Number(value).toFixed(3)} stroke="#7e8796" tickLine={false} axisLine={false} />
                    <Tooltip content={<ReviewTooltip />} />
                    <Line type="monotone" dataKey="openingPrice" name="开盘价" stroke="#ffb020" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="price" name="成交价" stroke="#4cc9f0" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="review-phase-pair">
            <div className="panel review-phase-card" id="review-intraday">
              <ReviewPhaseHeader index="02" eyebrow="Intraday Adjustment" title="盘中调整合理性" description="观察调整节奏与流动性变化" tone="ok" result="正常" />
              <div className="review-evidence-grid">
                <ReviewEvidence label="MarketLifecycleMode" value="NORMAL" note="完整双边梯度" />
                <ReviewEvidence label="effective_interval" value={`${effectiveInterval.toFixed(1)}s`} note="有效刷量间隔" />
                <ReviewEvidence label="流动性调整" value={`${liquidityChanges} 次`} note="结构化原因事件" />
              </div>
            </div>

            <div className="panel review-phase-card" id="review-endgame">
              <ReviewPhaseHeader index="03" eyebrow="Endgame Quoting" title="尾盘挂单合理性" description="检查结算前生命周期模式与挂单状态" tone={visibleMarket.endInMinutes < 60 ? "warn" : "ok"} result={statusMeta[visibleMarket.quoteMode].label} />
              <div className="review-evidence-grid">
                <ReviewEvidence label="MarketLifecycleMode" value={visibleMarket.endInMinutes < 60 ? "WAITING_RESULT" : "NORMAL"} note="尾盘生命周期模式" />
                <ReviewEvidence label="距离结束" value={`${visibleMarket.endInMinutes}m`} note="计划结束时间口径" />
                <ReviewEvidence label="当前挂单模式" value={statusMeta[visibleMarket.quoteMode].short} note="策略端 quote_mode" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="panel review-readiness">
        <div className="panel-title">
          <span><Database size={16} /> Review 数据准备度</span>
          <small>首版接口规划</small>
        </div>
        <div className="review-readiness-grid">
          <ReviewSource name="页面访问 / 交易互动 / 试价 / 取消" owner="前端行为埋点" state="待接入" tone="warn" />
          <ReviewSource name="逐笔成交与下一笔成交价格" owner="后端成交历史" state="待接入" tone="warn" />
          <ReviewSource name="价差 / 库存 / 滑点 PnL 分解" owner="后端 + 策略" state="待接入" tone="warn" />
          <ReviewSource name="MarketLifecycleMode 历史" owner="策略端" state="待接入" tone="warn" />
          <ReviewSource name="effective_interval 历史" owner="策略端" state="已有当前值" tone="ok" />
          <ReviewSource name="订单簿与流动性调整历史" owner="策略端" state="部分已有" tone="ok" />
        </div>
      </div>
    </section>
  );
}

function ReviewMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: "ok" | "warn" | "bad" }) {
  return <div className={`review-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function ReviewPhaseHeader({ index, eyebrow, title, description, tone, result }: { index: string; eyebrow: string; title: string; description: string; tone: "ok" | "warn"; result: string }) {
  return (
    <div className="review-phase-header">
      <span className="review-phase-index">{index}</span>
      <div><small>{eyebrow}</small><h3>{title}</h3><p>{description}</p></div>
      <span className={`state-chip ${tone}`}>{result}</span>
    </div>
  );
}

function ReviewEvidence({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="review-evidence"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function ReviewSource({ name, owner, state, tone }: { name: string; owner: string; state: string; tone: "ok" | "warn" }) {
  return <div className="review-source"><div><strong>{name}</strong><small>{owner}</small></div><span className={`state-chip ${tone}`}>{state}</span></div>;
}

function ReviewTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item, index) => <span key={`${item.name}-${index}`}><i style={{ background: item.color ?? "#4cc9f0" }} />{item.name}: {item.value}</span>)}</div>;
}

function MarketOverview({
  markets,
  filteredMarkets,
  marketCount,
  visibleMarket,
  filter,
  setFilter,
  query,
  setQuery,
  setActiveId,
}: {
  markets: Market[];
  filteredMarkets: Market[];
  marketCount: number;
  visibleMarket: Market;
  filter: string;
  setFilter: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  setActiveId: (value: string) => void;
}) {
  const displayedMarkets = useMemo(() => {
    if (!filteredMarkets.length) return [];
    const limitedMarkets = filteredMarkets.slice(0, MARKET_LIST_LIMIT);
    if (limitedMarkets.some((marketItem) => marketItem.id === visibleMarket.id)) return limitedMarkets;
    return [visibleMarket, ...limitedMarkets.slice(0, MARKET_LIST_LIMIT - 1)];
  }, [filteredMarkets, visibleMarket]);

  return (
    <section className="market-rail market-overview">
      <div className="rail-header">
        <div>
          <p className="section-label">Market Overview</p>
          <strong>{filteredMarkets.length} / {marketCount}</strong>
          {filteredMarkets.length > displayedMarkets.length && (
            <small>显示 {displayedMarkets.length}</small>
          )}
        </div>
        <button className="icon-button compact" type="button" title="筛选">
          <SlidersHorizontal size={15} />
        </button>
      </div>

      <div className="search-box">
        <Search size={15} />
        <input
          aria-label="Search markets"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="market / event / tag / id"
        />
      </div>

      <div className="segmented">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            className={filter === option.id ? "active" : ""}
            type="button"
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="market-list">
        {displayedMarkets.map((marketItem) => {
          const meta = statusMeta[marketItem.riskStatus];
          return (
            <button
              key={marketItem.id}
              className={`market-row ${visibleMarket.id === marketItem.id ? "selected" : ""}`}
              type="button"
              title={`${marketItem.event} / ${marketItem.market} / ${marketItem.id}`}
              onClick={() => setActiveId(marketItem.id)}
            >
              <div className="market-row-top">
                <span className={`status-dot ${meta.tone}`} />
                <strong>{marketItem.event}</strong>
                <small className={`state-chip ${meta.tone}`}>{meta.short}</small>
              </div>
              <p>{marketItem.market} · {compactIdentifier(marketItem.id)}</p>
              <div className="market-row-metrics">
                <span>{marketItem.backendData?.grossVolume === false ? "成交额待接入" : currency(marketItem.grossVolume)}</span>
                <span className={marketItem.backendData?.pnl === false ? "" : marketItem.pnl >= 0 ? "positive" : "negative"}>
                  {marketItem.backendData?.pnl === false ? "PnL 待接入" : signedCurrency(marketItem.pnl)}
                </span>
                <span>{marketItem.staleSeconds}s</span>
              </div>
            </button>
          );
        })}
      </div>

      <MarketOverviewSummary markets={markets} setActiveId={setActiveId} />
    </section>
  );
}

type OverviewRankMetric = "grossVolume" | "avgSlippage" | "singleSidedEmpty" | "l1DistanceExceeded";

const overviewRankOptions: Array<{ id: OverviewRankMetric; label: string }> = [
  { id: "grossVolume", label: "成交额" },
  { id: "avgSlippage", label: "平均滑点" },
  { id: "singleSidedEmpty", label: "单边空" },
  { id: "l1DistanceExceeded", label: "L1 超距" },
];

function overviewMetricValue(marketItem: Market, metric: OverviewRankMetric) {
  if (metric === "grossVolume") return marketItem.backendData?.grossVolume === false ? -1 : marketItem.grossVolume;
  if (metric === "avgSlippage") return marketItem.avgSlippage ?? -1;
  if (metric === "singleSidedEmpty") return marketItem.experienceQuality?.singleSidedEmpty.count ?? -1;
  return marketItem.experienceQuality?.l1DistanceExceeded.count ?? -1;
}

function overviewMetricLabel(value: number, metric: OverviewRankMetric) {
  if (value < 0) return "待接入";
  if (metric === "grossVolume") return currency(value);
  if (metric === "avgSlippage") return `${value.toFixed(1)}%`;
  return `${Math.round(value)} 次`;
}

function MarketOverviewSummary({ markets, setActiveId }: { markets: Market[]; setActiveId: (value: string) => void }) {
  const [rankMetric, setRankMetric] = useState<OverviewRankMetric>("avgSlippage");
  const abnormalMarkets = markets.filter((marketItem) => statusMeta[marketItem.riskStatus].tone !== "ok");
  const singleSidedEvents = markets.reduce((total, marketItem) => total + (marketItem.experienceQuality?.singleSidedEmpty.count ?? 0), 0);
  const l1DistanceEvents = markets.reduce((total, marketItem) => total + (marketItem.experienceQuality?.l1DistanceExceeded.count ?? 0), 0);
  const rankings = [...markets]
    .sort((left, right) => overviewMetricValue(right, rankMetric) - overviewMetricValue(left, rankMetric))
    .slice(0, 5);
  const statusCounts = Object.entries(
    markets.reduce<Partial<Record<RiskStatus, number>>>((counts, marketItem) => ({
      ...counts,
      [marketItem.riskStatus]: (counts[marketItem.riskStatus] ?? 0) + 1,
    }), {}),
  ).sort(([, left], [, right]) => (right ?? 0) - (left ?? 0));

  return (
    <div className="overview-diagnostics" aria-label="总体市场指标与排名">
      <div className="overview-summary-grid">
        <TinyStat label="Live Markets" value={`${markets.length}`} tone="ok" />
        <TinyStat label="Attention Markets" value={`${abnormalMarkets.length}`} tone={abnormalMarkets.length ? "warn" : "ok"} />
        <TinyStat label="Single-side Empty" value={`${singleSidedEvents} 次`} tone={singleSidedEvents ? "warn" : "ok"} />
        <TinyStat label="L1 Distance > 1%" value={`${l1DistanceEvents} 次`} tone={l1DistanceEvents ? "bad" : "ok"} />
      </div>
      <div className="overview-ranking">
        <div className="overview-ranking-head">
          <div>
            <p className="section-label">Cross-market Ranking</p>
            <strong>市场排名</strong>
          </div>
          <div className="rank-tabs" aria-label="切换总体指标排名">
            {overviewRankOptions.map((option) => (
              <button key={option.id} className={rankMetric === option.id ? "active" : ""} type="button" onClick={() => setRankMetric(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ranking-list">
          {rankings.map((marketItem, index) => {
            const value = overviewMetricValue(marketItem, rankMetric);
            return (
              <button key={marketItem.id} type="button" onClick={() => setActiveId(marketItem.id)}>
                <span>{index + 1}</span>
                <strong>{marketItem.event}</strong>
                <em>{overviewMetricLabel(value, rankMetric)}</em>
              </button>
            );
          })}
        </div>
      </div>
      <div className="overview-statuses" aria-label="当前市场风控状态分布">
        {statusCounts.map(([status, count]) => {
          const meta = statusMeta[status as RiskStatus];
          return <span key={status} className={meta.tone} title={riskStatusDescriptions[status as RiskStatus]}>{meta.label} <b>{count}</b></span>;
        })}
      </div>
    </div>
  );
}

function durationLabel(totalSeconds: number) {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours} 小时 ${remainder} 分` : `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天 ${hours % 24} 小时`;
}

const settlementPhaseMeta: Record<SettlementPhase, { label: string; tone: string }> = {
  none: { label: "交易中", tone: "open" },
  announcing: { label: "结果公布中", tone: "provisional" },
  ruling1: { label: "第一次裁定", tone: "provisional" },
  dispute1: { label: "第一次质疑", tone: "dispute" },
  ruling2: { label: "第二次裁定", tone: "provisional" },
  dispute2: { label: "第二次质疑", tone: "dispute" },
  claimable: { label: "链上结算完成", tone: "final" },
  unknown: { label: "未知结算阶段", tone: "scheduled" },
};

function lifecycleStatusText(market: Market) {
  const lifecycle = market.lifecycle;
  if (!lifecycle) return "交易中";
  const base = settlementPhaseMeta[lifecycle.settlementPhase].label;
  if (lifecycle.settlementPhase === "dispute1" || lifecycle.settlementPhase === "dispute2") {
    return `${base}${lifecycle.currentOutcome ? ` · ${lifecycle.currentOutcome} 暂定` : ""}`;
  }
  if (lifecycle.settlementPhase === "claimable") {
    return `${base}${lifecycle.settledOutcome ? ` · ${lifecycle.settledOutcome}` : ""}`;
  }
  return base;
}

function MarketLifecycle({ market }: { market: Market }) {
  const totalSeconds = Math.max(0, Math.round((timestamp(market.endAt) - timestamp(market.startAt)) / 1000));
  const remainingSeconds = Math.max(0, market.endInMinutes * 60);
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const phaseMeta = settlementPhaseMeta[market.lifecycle?.settlementPhase ?? "none"];
  const milestoneAt = market.lifecycle?.settledAt ?? market.lifecycle?.phaseEndAt;
  return (
    <div className="market-lifecycle" aria-label="市场生命周期">
      <span><small>开盘时间</small><strong>{formatAxisTime(timestamp(market.startAt), market.startAt, market.endAt)}</strong></span>
      <span><small>计划结束</small><strong>{formatAxisTime(timestamp(market.endAt), market.startAt, market.endAt)}</strong></span>
      <span><small>当前阶段</small><strong className={`lifecycle-${phaseMeta.tone}`}>{lifecycleStatusText(market)}</strong></span>
      <span>
        <small>{market.lifecycle?.settledAt ? "结算完成时间" : market.lifecycle?.phaseEndAt ? "当前阶段截止" : remainingSeconds ? "已运行 / 距离结束" : "运行时长"}</small>
        <strong>{milestoneAt ? formatAxisTime(timestamp(milestoneAt), market.startAt, milestoneAt) : remainingSeconds ? `${durationLabel(elapsedSeconds)} / ${durationLabel(remainingSeconds)}` : durationLabel(elapsedSeconds)}</strong>
      </span>
    </div>
  );
}

const experienceIncidentLabels: Record<ExperienceIncidentKind, string> = {
  single_sided_empty: "单边空盘",
  double_sided_empty: "双边空盘",
  l1_distance_exceeded: "L1 距离超限",
};

function incidentMetricText(metric: ExperienceIncidentMetric | undefined) {
  if (!metric) return "待接入";
  return `${metric.count} 次 · ${metric.durationSeconds}s · ${(metric.durationRatio * 100).toFixed(1)}%`;
}

function ExperienceIncidentTimeline({ market }: { market: Market }) {
  const start = timestamp(market.startAt);
  const end = timestamp(market.endAt);
  const duration = Math.max(1, end - start);
  const incidents = market.experienceQuality?.incidents ?? [];
  return (
    <div className="experience-incident-panel panel">
      <div className="panel-title">
        <span><Activity size={16} /> 体验异常时间轴</span>
        <small>{incidents.length ? `${incidents.length} events` : "等待策略埋点"}</small>
      </div>
      <div className="experience-incident-timeline">
        <div className="experience-incident-boundary">
          <span>{formatAxisTime(start, market.startAt, market.endAt)}</span>
          <span>{formatAxisTime(end, market.startAt, market.endAt)}</span>
        </div>
        {incidents.map((incident, index) => (
          <div
            key={`${incident.kind}-${incident.ts}-${index}`}
            className={`experience-incident-node ${incident.kind} ${index % 2 === 0 ? "label-top" : "label-bottom"}`}
            style={{ left: `${Math.min(94, Math.max(5, ((incident.ts - start) / duration) * 100))}%` }}
            title={`${experienceIncidentLabels[incident.kind]} · 持续 ${incident.durationSeconds}s${incident.valuePct ? ` · ${incident.valuePct.toFixed(2)}%` : ""}`}
          >
            <span />
            <strong>{experienceIncidentLabels[incident.kind]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroBoard({
  visibleMarket,
  timeframe,
  setTimeframe,
}: {
  visibleMarket: Market;
  timeframe: string;
  setTimeframe: (value: string) => void;
}) {
  return (
    <>
      <BoardChartToolbar title="Business Trend" timeframe={timeframe} setTimeframe={setTimeframe} />
      <MarketLifecycle market={visibleMarket} />

      <div className="macro-business-grid">
        <div className="panel">
          <div className="panel-title">
            <span><BarChart3 size={16} /> 交易规模与用户规模</span>
            <small>selected market</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Gross Volume" value={visibleMarket.backendData?.grossVolume === false ? "unknown" : currency(visibleMarket.grossVolume)} tone={visibleMarket.backendData?.grossVolume === false ? "warn" : "ok"} />
            <TinyStat label="Net Volume" value={visibleMarket.netVolume === null ? "unknown" : currency(visibleMarket.netVolume)} tone={visibleMarket.netVolume === null ? "warn" : "ok"} />
            <TinyStat label="Trader Count" value={visibleMarket.backendData?.traderCount === false ? "unknown" : visibleMarket.traderCount.toLocaleString()} tone={visibleMarket.backendData?.traderCount === false ? "warn" : "ok"} />
            <TinyStat label="Current PnL" value={visibleMarket.backendData?.pnl === false ? "unknown" : signedCurrency(visibleMarket.pnl)} tone={visibleMarket.backendData?.pnl === false ? "warn" : visibleMarket.pnl >= 0 ? "ok" : "bad"} />
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">
            <span><LineChart size={16} /> Volume / PnL / Wash</span>
            <small>{timeframe}</small>
          </div>
          <div className="chart-frame macro-chart-frame">
            {visibleMarket.backendData?.businessTrend === false ? (
              <div className="chart-empty">等待后端提供按市场、按时间窗口聚合的成交额 / PnL / Wash 时序</div>
            ) : <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleMarket.series}>
                <CartesianGrid stroke="#242833" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={[timestamp(visibleMarket.startAt), timestamp(visibleMarket.endAt)]}
                  ticks={axisTicks(visibleMarket.startAt, visibleMarket.endAt)}
                  tickFormatter={(value) => formatAxisTime(Number(value), visibleMarket.startAt, visibleMarket.endAt)}
                  tickLine={false}
                  axisLine={false}
                  stroke="#798191"
                  fontSize={11}
                />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="volume" fill="#1f7a5f55" stroke="#20d49b" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="pnl" stroke="#d7f75b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="wash" stroke="#4cc9f0" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>}
          </div>
        </div>
      </div>
    </>
  );
}

function ExperienceBoard({
  visibleMarket,
  timeframe,
  setTimeframe,
}: {
  visibleMarket: Market;
  timeframe: string;
  setTimeframe: (value: string) => void;
}) {
  const [bookOutcome, setBookOutcome] = useState<OutcomeSide>("yes");
  const displayedBidLevels =
    bookOutcome === "yes" ? visibleMarket.bidLevels : visibleMarket.noBidLevels?.length ? visibleMarket.noBidLevels : complementaryLevels(visibleMarket.askLevels, "bid");
  const displayedAskLevels =
    bookOutcome === "yes" ? visibleMarket.askLevels : visibleMarket.noAskLevels?.length ? visibleMarket.noAskLevels : complementaryLevels(visibleMarket.bidLevels, "ask");
  const bidMax = maxQuantity(displayedBidLevels);
  const askMax = maxQuantity(displayedAskLevels);
  const liquidityHistory = buildLiquidityHistory(visibleMarket);
  const liquidityEvents = liquidityHistory.filter((point) => point.liquidityReason);
  const tier1FlashFreq = visibleMarket.flash?.tier1PairsPerHour ?? visibleMarket.flash?.actualPairsPerHour;
  const midFlashFreq = visibleMarket.flash?.midPairsPerHour;
  const activePairs = visibleMarket.flash?.activePairs;
  const tier1ActivePairs = visibleMarket.flash?.tier1ActivePairs;
  const midActivePairs = visibleMarket.flash?.midActivePairs;
  const maxPairs = visibleMarket.flash?.maxPairsTotal;
  const l1Distance = visibleMarket.flash?.l1DistanceTicks;
  const tier1ConfiguredInterval = visibleMarket.flash?.tier1ConfiguredIntervalS;
  const midConfiguredInterval = visibleMarket.flash?.midConfiguredIntervalS;
  const flashFrequencyText = (
    actual: number | null | undefined,
    configured: [number, number] | null | undefined,
  ) => {
    if (actual !== null && actual !== undefined) return `${Math.round(actual)} / h`;
    if (!configured) return "missing";
    return `${configured[0]}-${configured[1]}s target`;
  };

  return (
    <>
      <BoardChartToolbar title="Experience Quality" timeframe={timeframe} setTimeframe={setTimeframe} />
      <MarketLifecycle market={visibleMarket} />

      <div className="detail-grid experience-detail-grid">
        <div className="panel experience-quality-panel">
          <div className="panel-title">
            <span><AlertTriangle size={16} /> 盘口可用性</span>
            <small>次数 · 时长 · 运行占比</small>
          </div>
          <div className="micro-grid experience-quality-grid">
            <TinyStat label="Single-side Empty" value={incidentMetricText(visibleMarket.experienceQuality?.singleSidedEmpty)} tone={(visibleMarket.experienceQuality?.singleSidedEmpty.count ?? 0) > 0 ? "warn" : "ok"} />
            <TinyStat label="Double-side Empty" value={incidentMetricText(visibleMarket.experienceQuality?.doubleSidedEmpty)} tone={(visibleMarket.experienceQuality?.doubleSidedEmpty.count ?? 0) > 0 ? "bad" : "ok"} />
            <TinyStat label="L1 Distance > 1%" value={incidentMetricText(visibleMarket.experienceQuality?.l1DistanceExceeded)} tone={(visibleMarket.experienceQuality?.l1DistanceExceeded.count ?? 0) > 0 ? "bad" : "ok"} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <span><Gauge size={16} /> 闪单参数监控</span>
            <small>tier-1 / mid insertion</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Tier-1 Freq" value={flashFrequencyText(tier1FlashFreq, tier1ConfiguredInterval)} tone={tier1FlashFreq || tier1ConfiguredInterval ? "ok" : "warn"} />
            <TinyStat label="Mid Freq" value={flashFrequencyText(midFlashFreq, midConfiguredInterval)} tone={midFlashFreq || midConfiguredInterval ? "ok" : "warn"} />
            <TinyStat label="L1 Distance" value={l1Distance === null || l1Distance === undefined ? "missing" : `${l1Distance} ticks`} tone={l1Distance !== null && l1Distance !== undefined ? "ok" : "warn"} />
            <TinyStat label="Active Pairs" value={activePairs === null || activePairs === undefined ? "missing" : `${activePairs}${maxPairs ? ` / ${maxPairs}` : ""}`} tone={activePairs !== null && activePairs !== undefined ? "ok" : "warn"} />
          </div>
          {(tier1ActivePairs !== null && tier1ActivePairs !== undefined) || (midActivePairs !== null && midActivePairs !== undefined) ? (
            <div className="flash-kind-strip" aria-label="闪单活跃 pair 拆分">
              <span>Tier-1 active <b>{tier1ActivePairs ?? 0}</b></span>
              <span>Mid active <b>{midActivePairs ?? 0}</b></span>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span><Layers3 size={16} /> 单市场成交平均滑点</span>
            <small>true trades</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Avg Slippage" value={visibleMarket.avgSlippage === null ? "no_trade" : `${visibleMarket.avgSlippage.toFixed(1)}%`} tone={(visibleMarket.avgSlippage ?? 99) < 4 ? "ok" : "bad"} />
            <TinyStat label="Spread Now" value={visibleMarket.spread ? `${(visibleMarket.spread * 100).toFixed(1)}c` : "missing"} tone={visibleMarket.spread && visibleMarket.spread < 0.06 ? "ok" : "warn"} />
            <TinyStat label="Ask K" value={visibleMarket.askSlope?.toFixed(1) ?? "insufficient"} tone={visibleMarket.askSlope ? "ok" : "bad"} />
            <TinyStat label="Bid K" value={visibleMarket.bidSlope?.toFixed(1) ?? "insufficient"} tone={visibleMarket.bidSlope ? "ok" : "bad"} />
          </div>
        </div>

        <div className="panel chart-panel slippage-count-panel">
          <div className="panel-title">
            <span><TimerReset size={16} /> Slippage Dist</span>
            <small>filled orders</small>
          </div>
          <div className="chart-frame mini-chart">
            {visibleMarket.slippageBuckets.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleMarket.slippageBuckets}>
                <CartesianGrid stroke="#242833" vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {visibleMarket.slippageBuckets.map((entry) => (
                    <Cell
                      key={entry.bucket}
                      fill={entry.tone === "good" ? "#20d49b" : entry.tone === "warn" ? "#ffb020" : "#ff5c6c"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer> : <div className="chart-empty">等待后端提供真实成交滑点分布</div>}
          </div>
        </div>
      </div>

      <ExperienceIncidentTimeline market={visibleMarket} />

      <div className="experience-analytics-grid">
        <div className="panel chart-panel">
          <div className="panel-title">
            <span><LineChart size={16} /> 滑点与交易冲击变化</span>
            <small>{visibleMarket.experienceQuality?.history.length ? timeframe : "等待时序数据"}</small>
          </div>
          <div className="chart-frame compact-chart">
            {visibleMarket.experienceQuality?.history.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visibleMarket.experienceQuality.history}>
                  <CartesianGrid stroke="#242833" vertical={false} />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={[timestamp(visibleMarket.startAt), timestamp(visibleMarket.endAt)]}
                    ticks={axisTicks(visibleMarket.startAt, visibleMarket.endAt)}
                    tickFormatter={(value) => formatAxisTime(Number(value), visibleMarket.startAt, visibleMarket.endAt)}
                    tickLine={false}
                    axisLine={false}
                    stroke="#798191"
                    fontSize={11}
                  />
                  <YAxis tickLine={false} axisLine={false} stroke="#798191" fontSize={11} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  {(visibleMarket.experienceQuality.incidents ?? []).map((incident) => (
                    <ReferenceLine key={`${incident.kind}-${incident.ts}`} x={incident.ts} stroke={incident.kind === "l1_distance_exceeded" ? "#ff5c6c" : "#ffb020"} strokeDasharray="3 3" />
                  ))}
                  <Line type="monotone" dataKey="slippagePct" name="Slippage" stroke="#ffb020" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="impactPct" name="Impact" stroke="#4cc9f0" strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="chart-empty">等待后端提供成交时刻基准价与滑点时序</div>}
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">
            <span><TimerReset size={16} /> 按单笔金额分层滑点</span>
            <small>{visibleMarket.slippageNotionalBuckets?.length ? "notional buckets" : "等待后端数据"}</small>
          </div>
          <div className="chart-frame compact-chart">
            {visibleMarket.slippageNotionalBuckets?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleMarket.slippageNotionalBuckets}>
                  <CartesianGrid stroke="#242833" vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} stroke="#798191" fontSize={11} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="avgSlippagePct" name="Avg Slippage" radius={[3, 3, 0, 0]}>
                    {visibleMarket.slippageNotionalBuckets.map((entry) => (
                      <Cell key={entry.bucket} fill={entry.tone === "good" ? "#20d49b" : entry.tone === "warn" ? "#ffb020" : "#ff5c6c"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="chart-empty">等待后端按成交金额区间返回滑点分布</div>}
          </div>
        </div>
      </div>

      <BoardChartToolbar title="Liquidity History" timeframe={timeframe} setTimeframe={setTimeframe} />

      <div className="analytics-grid single-bottom">
        <div className="panel chart-panel wide">
          <div className="panel-title">
            <span><LineChart size={16} /> 历史流动性变化</span>
            <small>{timeframe}</small>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={liquidityHistory}>
                <CartesianGrid stroke="#242833" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={[timestamp(visibleMarket.startAt), timestamp(visibleMarket.endAt)]}
                  ticks={axisTicks(visibleMarket.startAt, visibleMarket.endAt)}
                  tickFormatter={(value) => formatAxisTime(Number(value), visibleMarket.startAt, visibleMarket.endAt)}
                  tickLine={false}
                  axisLine={false}
                  stroke="#798191"
                  fontSize={11}
                />
                <YAxis tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                {(visibleMarket.experienceQuality?.incidents ?? []).map((incident) => (
                  <ReferenceLine key={`${incident.kind}-${incident.ts}`} x={incident.ts} stroke={incident.kind === "l1_distance_exceeded" ? "#ff5c6c" : "#ffb020"} strokeDasharray="3 3" />
                ))}
                <Area type="monotone" dataKey="availableLiquidity" name="Liquidity" fill="#20d49b33" stroke="#20d49b" strokeWidth={2} dot={<LiquidityEventDot />} />
                <Line type="monotone" dataKey="initialBaseline" name="Initial Baseline" stroke="#4cc9f0" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="liquidity-event-strip" aria-label="流动性变化原因">
            {liquidityEvents.slice(-4).map((point) => (
              <div key={`${point.time}-${point.liquidityDelta}`} className={`liquidity-event-pill ${point.liquidityDirection ?? ""}`}>
                <time>{point.time}</time>
                <strong>{point.liquidityDelta && point.liquidityDelta > 0 ? "+" : ""}{point.liquidityDelta} sh</strong>
                <span>{point.liquidityReason}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="bottom-grid single-bottom">
        <div className="panel orderbook-panel">
          <div className="panel-title">
            <span><Activity size={16} /> Order Book History Snapshot</span>
            <div className="orderbook-title-actions">
              <div className="outcome-toggle" aria-label="切换订单簿结果方向">
                {(["yes", "no"] as OutcomeSide[]).map((outcome) => (
                  <button
                    key={outcome}
                    className={bookOutcome === outcome ? "active" : ""}
                    type="button"
                    onClick={() => setBookOutcome(outcome)}
                  >
                    {outcome.toUpperCase()}
                  </button>
                ))}
              </div>
              <small>{visibleMarket.liquidity ? `${visibleMarket.liquidity} shares` : "empty"}</small>
            </div>
          </div>
          <div className="book-grid">
            <OrderSide title={`${bookOutcome.toUpperCase()} Bids`} side="bid" levels={displayedBidLevels} max={bidMax} />
            <OrderSide title={`${bookOutcome.toUpperCase()} Asks`} side="ask" levels={displayedAskLevels} max={askMax} />
          </div>
        </div>
      </div>
    </>
  );
}

function RiskBoard({
  visibleMarket,
  inventoryUsed,
  lossUsed,
}: {
  visibleMarket: Market;
  inventoryUsed: number;
  lossUsed: number;
}) {
  const timelineEvents = getRiskTimelineEvents(visibleMarket);

  return (
    <>
      <MarketLifecycle market={visibleMarket} />
      <div className="detail-grid risk-detail-grid">
        <div className="panel risk-panel">
          <div className="panel-title">
            <span><Gauge size={16} /> 市场风控状态监控</span>
            <small>{visibleMarket.staleSeconds}s stale</small>
          </div>
          <div className="risk-state">
            <div className={`risk-icon ${statusMeta[visibleMarket.riskStatus].tone}`}>
              {statusMeta[visibleMarket.riskStatus].tone === "ok" ? <CircleDot size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <strong
                className="status-label has-tooltip"
                data-tooltip={riskStatusDescriptions[visibleMarket.quoteMode]}
                tabIndex={0}
                title={riskStatusDescriptions[visibleMarket.quoteMode]}
              >
                {statusMeta[visibleMarket.quoteMode].label}
              </strong>
              <p>{visibleMarket.riskReason}</p>
            </div>
          </div>
          <RiskStatusTimeline market={visibleMarket} events={timelineEvents} />
          <div className="meter-stack">
            <Meter label="Inventory / q_max" value={inventoryUsed} figure={`${visibleMarket.inventory} / ${visibleMarket.qMax}`} />
            <Meter label="Worst PnL / budget" value={lossUsed} figure={`${visibleMarket.worstCasePnl.toFixed(1)} / -${visibleMarket.maxLossBudget}`} tone={lossUsed > 85 ? "bad" : "warn"} />
          </div>
        </div>

        <div className="panel strategy-hint-panel">
          <div className="panel-title">
            <span><ShieldAlert size={16} /> 当前摆单策略提示</span>
            <small>strategy runtime</small>
          </div>
          <div className="source-list">
            <SourceRow label="risk_status" value={statusMeta[visibleMarket.riskStatus].short} tone={toSourceTone(statusMeta[visibleMarket.riskStatus].tone)} />
            <SourceRow label="quote_mode" value={statusMeta[visibleMarket.quoteMode].short} tone={toSourceTone(statusMeta[visibleMarket.quoteMode].tone)} />
            <SourceRow label="reduce_only_line" value={`${visibleMarket.qMax * 0.8} shares`} tone={Math.abs(visibleMarket.inventory) >= visibleMarket.qMax * 0.8 ? "bad" : "ok"} />
            <SourceRow label="endgame_window" value={`${visibleMarket.endInMinutes}m`} tone={visibleMarket.endInMinutes < 15 ? "warn" : "ok"} />
          </div>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="panel source-panel">
          <div className="panel-title">
            <span><Database size={16} /> 数据与依赖状态</span>
            <small>heartbeat</small>
          </div>
          <div className="source-list">
            <SourceRow label="Backend metrics" value="12s" tone="ok" />
            <SourceRow label="Strategy runtime" value={`${visibleMarket.staleSeconds}s`} tone={visibleMarket.staleSeconds > 60 ? "bad" : "ok"} />
            <SourceRow label="Order snapshot" value={visibleMarket.bidLevels.length ? "18s" : "missing"} tone={visibleMarket.bidLevels.length ? "ok" : "bad"} />
            <SourceRow label="Runtime health" value={visibleMarket.status} tone={visibleMarket.status === "live" ? "ok" : visibleMarket.status === "degraded" ? "warn" : "bad"} />
          </div>
        </div>

        <div className="panel event-panel">
          <div className="panel-title">
            <span><Pause size={16} /> Strategy Events</span>
            <small>{visibleMarket.endInMinutes}m to end</small>
          </div>
          <div className="event-list">
            {visibleMarket.events.map((eventItem) => (
              <div key={`${eventItem.time}-${eventItem.type}`} className="event-row">
                <span className={`event-dot ${eventItem.severity}`} />
                <time>{eventItem.time}</time>
                <strong>{eventItem.type}</strong>
                <p>{eventItem.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

type StatusTimelineNode = {
  ts: number;
  label: string;
  detail: string;
  tone: "open" | "scheduled" | "provisional" | "dispute" | "final" | "ok" | "warn" | "bad";
};

function lifecycleTimelineNodes(market: Market): StatusTimelineNode[] {
  const lifecycle = market.lifecycle;
  const nodes: StatusTimelineNode[] = [
    { ts: timestamp(market.startAt), label: "市场开盘", detail: "市场开始接受交易", tone: "open" },
    { ts: timestamp(market.endAt), label: "计划结束", detail: "市场计划停止常规交易", tone: "scheduled" },
  ];
  if (!lifecycle || lifecycle.settlementPhase === "none") return nodes;

  const phaseMeta = settlementPhaseMeta[lifecycle.settlementPhase];
  const phaseAt = optionalIsoTime(lifecycle.updatedAt) ?? market.endAt;
  if (lifecycle.settlementPhase === "claimable") {
    nodes.push({
      ts: timestamp(lifecycle.settledAt ?? phaseAt),
      label: "链上结算完成",
      detail: lifecycle.settledOutcome ? `最终结果 ${lifecycle.settledOutcome}` : "市场已进入 claimable/closed 终态",
      tone: "final",
    });
  } else {
    nodes.push({
      ts: timestamp(phaseAt),
      label: phaseMeta.label,
      detail: `${lifecycle.currentOutcome ? `暂定结果 ${lifecycle.currentOutcome}` : "暂无暂定结果"}${lifecycle.disputeCount ? `，累计质疑 ${lifecycle.disputeCount} 次` : ""}`,
      tone: lifecycle.settlementPhase.startsWith("dispute") ? "dispute" : "provisional",
    });
  }
  return nodes;
}

function RiskStatusTimeline({ events, market }: { events: RiskEvent[]; market: Market }) {
  const start = timestamp(market.startAt);
  const lifecycle = market.lifecycle;
  const lifecycleEndCandidates = [
    timestamp(market.endAt),
    lifecycle?.phaseEndAt ? timestamp(lifecycle.phaseEndAt) : 0,
    lifecycle?.settledAt ? timestamp(lifecycle.settledAt) : 0,
    ...events.map((eventItem) => eventItem.ts ?? start),
  ];
  const end = Math.max(start + 1, ...lifecycleEndCandidates);
  const duration = end - start;
  const nodes = [
    ...lifecycleTimelineNodes(market),
    ...events.map((eventItem) => ({
      ts: eventItem.ts ?? start,
      label: getRiskEventLabel(eventItem),
      detail: eventItem.detail,
      tone: eventItem.severity,
    } satisfies StatusTimelineNode)),
  ].sort((left, right) => left.ts - right.ts);

  return (
    <div className="risk-timeline-wrap">
      <div className="risk-timeline-header">
        <span>市场生命周期与状态时间轴</span>
        <div className="timeline-legend" aria-label="生命周期颜色说明">
          <span className="open">开盘</span>
          <span className="scheduled">计划结束</span>
          <span className="dispute">质疑</span>
          <span className="final">完成结算</span>
        </div>
      </div>
      <div className="risk-timeline" aria-label="市场生命周期与风控状态变化时间轴">
        <div className="risk-timeline-boundary">
          <span>{formatAxisTime(start, market.startAt, new Date(end).toISOString())}</span>
          <span>{formatAxisTime(end, market.startAt, new Date(end).toISOString())}</span>
        </div>
        {nodes.map((node, index) => (
          <div
            key={`${node.ts}-${node.label}-${index}`}
            className={`risk-timeline-node ${node.tone} ${index % 2 === 0 ? "label-top" : "label-bottom"}`}
            style={{ left: `${Math.min(96, Math.max(3, ((node.ts - start) / duration) * 100))}%` }}
            title={`${node.label} · ${node.detail}`}
          >
            <span className="risk-timeline-dot" />
            <div className="risk-timeline-label">
              <strong>{node.label}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardChartToolbar({
  title,
  timeframe,
  setTimeframe,
}: {
  title: string;
  timeframe: string;
  setTimeframe: (value: string) => void;
}) {
  return (
    <div className="chart-toolbar">
      <div className="section-label">{title}</div>
      <div className="timeframe-tabs">
        {timeframes.map((item) => (
          <button key={item} className={timeframe === item ? "active" : ""} type="button" onClick={() => setTimeframe(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Meter({ label, value, figure, tone = "warn" }: { label: string; value: number; figure: string; tone?: "warn" | "bad" }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{figure}</strong>
      </div>
      <div className="meter-track">
        <span className={tone} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

const tinyStatDescriptions: Record<string, string> = {
  "Live Markets": "当前仍在实时看板范围内的市场数量。",
  "Attention Markets": "当前风控状态不是正常摆单，或数据新鲜度异常的市场数量。",
  "Single-side Empty": "观察窗口内 YES 或 NO 仅一侧订单簿为空的次数、累计持续秒数，以及占市场已运行时长的比例。",
  "Double-side Empty": "观察窗口内 YES 与 NO 两侧订单簿同时为空的次数、累计持续秒数，以及占市场已运行时长的比例。",
  "L1 Distance > 1%": "闪单价格与当时订单簿一档价格距离超过 1% 的次数、累计持续秒数，以及占市场已运行时长的比例。",
  "Gross Volume": "当前选中市场的累计双边成交额，用于观察这个市场本身的交易规模。",
  "Net Volume": "当前选中市场剔除刷量或内部成交后的真实成交额；未知时显示 unknown。",
  "Trader Count": "当前选中市场内参与过有效交易或关键交互的用户数量。",
  "Current PnL": "当前选中市场的实时 PnL，反映后端成交与策略持仓在这个市场上的当前盈亏。",
  "Actual Flash Freq": "策略端最近 5 分钟内实际成功发起的闪单 pair 频率，按平均间隔折算为每小时次数。",
  "Avg Flash Interval": "策略端最近观测到的闪单 pair 平均间隔，用于判断闪单是否按预期 cadence 运行。",
  "Active Pairs": "当前市场正在存活的闪单挂单对数，以及配置允许的最大挂单对数。",
  "Tier-1 Freq": "一档贴近操作的目标触发频率，文档口径约为每 12 秒一次，即 300 次/小时。",
  "Mid Freq": "中间档位插入的实际触发频率，按观测窗口折算为每小时次数。",
  "L1 Distance": "闪单生成价格相对当前订单簿一档位置的距离；策略端尚未提供时显示 missing。",
  "Max Live Pairs": "同一市场同一时刻允许存在的最大 Bot 挂单对数，用于控制并发挂单和保证金占用。",
  "Avg Slippage": "当前选中市场真实成交相对成交前盘口中间价的平均滑点。",
  "Spread Now": "当前选中市场最优 ask 与最优 bid 的实时价差，数值越小成交体验通常越好。",
  "Ask K": "买入 YES 方向的盘口冲击斜率，衡量吃 ask 时价格随成交量上移的速度。",
  "Bid K": "卖出 YES 方向的盘口冲击斜率，衡量吃 bid 时价格随成交量下移的速度。",
};

function TinyStat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  const description = tinyStatDescriptions[label];

  return (
    <div className={`tiny-stat ${tone}`}>
      <span
        className={description ? "tiny-stat-label has-tooltip" : "tiny-stat-label"}
        data-tooltip={description}
        tabIndex={description ? 0 : undefined}
        title={description}
      >
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

const parameterDescriptions: Record<string, string> = {
  risk_status: "当前市场的风控状态，由库存、预算、盘口、临期和数据新鲜度等条件共同决定。",
  quote_mode: "当前市场实际采用的摆单模式，例如正常摆单、库存倾斜、只减风险或暂停摆单。",
  reduce_only_line: "触发只减风险模式的库存阈值；超过后只允许能降低库存风险的一侧继续报价。",
  endgame_window: "距离当前市场结束的剩余时间；进入临期窗口后报价会更保守或减少档位。",
  "Backend metrics": "后端统计指标的最近更新时间，包含成交量、用户数、PnL 等单市场统计。",
  "Strategy runtime": "策略端对当前市场的最近一次计算或心跳延迟，过久表示 fair value 或报价可能变旧。",
  "Order snapshot": "后端权威订单快照的新鲜度；缺失时不能确认当前挂单状态。",
  "Runtime health": "当前市场运行状态，区分正常做市、降级做市和暂停做市。",
};

function SourceRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  const description = parameterDescriptions[label];

  return (
    <div className="source-row">
      <span
        className={description ? "param-label has-tooltip" : "param-label"}
        data-tooltip={description}
        tabIndex={description ? 0 : undefined}
        title={description}
      >
        {label}
      </span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function OrderSide({
  title,
  side,
  levels,
  max,
}: {
  title: string;
  side: "bid" | "ask";
  levels: Array<{ price: number; quantity: number }>;
  max: number;
}) {
  return (
    <div className={`book-side ${side}`}>
      <div className="book-head">
        <span>{title}</span>
        <span>Px</span>
        <span>Qty</span>
      </div>
      {levels.length === 0 ? (
        <div className="book-empty">orderbook_missing</div>
      ) : (
        levels.map((level) => (
          <div key={`${side}-${level.price}`} className="book-level">
            <div className="depth-bar" style={{ width: `${(level.quantity / max) * 100}%` }} />
            <span>{side.toUpperCase()}</span>
            <strong>{level.price.toFixed(2)}</strong>
            <em>{level.quantity.toFixed(1)}</em>
          </div>
        ))
      )}
    </div>
  );
}

function LiquidityEventDot(props: { cx?: number; cy?: number; payload?: LiquidityHistoryPoint }) {
  const { cx, cy, payload } = props;
  if (typeof cx !== "number" || typeof cy !== "number" || !payload?.liquidityReason) return null;

  const color = payload.liquidityDirection === "increase" ? "#20d49b" : "#ff5c6c";

  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#080a0d" stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color?: string;
    payload?: Partial<LiquidityHistoryPoint & { time: string }>;
  }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const liquidityPoint = payload.find((item) => item.payload?.liquidityReason)?.payload;
  const displayLabel = payload[0]?.payload?.time ?? label;

  return (
    <div className="chart-tooltip">
      <strong>{displayLabel}</strong>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color ?? "#7e8796" }} />
          {item.name}: {typeof item.value === "number" ? item.value.toFixed(1) : item.value}
        </span>
      ))}
      {liquidityPoint?.liquidityReason ? (
        <p className={liquidityPoint.liquidityDirection === "increase" ? "positive" : "negative"}>
          {liquidityPoint.liquidityDelta && liquidityPoint.liquidityDelta > 0 ? "+" : ""}
          {liquidityPoint.liquidityDelta} sh · {liquidityPoint.liquidityReason}
        </p>
      ) : null}
    </div>
  );
}
