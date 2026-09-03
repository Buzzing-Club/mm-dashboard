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
type OutcomeSide = "yes" | "no";

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
  bidLevels: Array<{ price: number; quantity: number }>;
  askLevels: Array<{ price: number; quantity: number }>;
  noBidLevels?: Array<{ price: number; quantity: number }>;
  noAskLevels?: Array<{ price: number; quantity: number }>;
  events: Array<{ ts?: number; time: string; type: string; detail: string; severity: "ok" | "warn" | "bad" }>;
  liquidityHistory?: LiquidityHistoryPoint[];
  flash?: {
    actualPairsPerHour: number | null;
    actualAvgIntervalS: number | null;
    activePairs: number | null;
    maxPairsTotal: number | null;
    l1DistanceTicks: number | null;
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
    start_time?: string | number | null;
    end_time?: string | number | null;
    runtime_state?: string | null;
    started?: boolean | null;
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
    yes?: DashboardBookSide;
    no?: DashboardBookSide;
  };
  liquidity?: {
    current_strategy_liquidity?: string | number | null;
    current_book_liquidity?: string | number | null;
    initial_liquidity?: string | number | null;
    history?: Array<{
      ts?: string | number | null;
      liquidity?: string | number | null;
      delta?: string | number | null;
      direction?: "increase" | "decrease" | null;
      reason_code?: string | null;
    }>;
  };
  flash?: {
    actual_pairs_per_hour?: string | number | null;
    actual_avg_interval_s?: string | number | null;
    active_pairs?: string | number | null;
    max_pairs_total?: string | number | null;
    l1_distance_ticks?: string | number | null;
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
  };
};

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

const MOCK_OBSERVATION_AT = Date.parse("2026-08-28T18:59:30+08:00");
const MINUTE_MS = 60 * 1000;

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

function buildSlippageBuckets(avgSlippage: number | null) {
  if (avgSlippage === null) {
    return [
      { bucket: "0-1%", count: 0, tone: "good" as const },
      { bucket: "1-2%", count: 0, tone: "good" as const },
      { bucket: "2-4%", count: 0, tone: "warn" as const },
      { bucket: "4-8%", count: 0, tone: "bad" as const },
      { bucket: ">8%", count: 0, tone: "bad" as const },
    ];
  }

  const load = Math.max(8, Math.round(40 + avgSlippage * 7));
  return [
    { bucket: "0-1%", count: Math.max(2, Math.round(load * 0.24)), tone: "good" as const },
    { bucket: "1-2%", count: Math.max(4, Math.round(load * 0.34)), tone: "good" as const },
    { bucket: "2-4%", count: Math.max(2, Math.round(load * 0.23)), tone: "warn" as const },
    { bucket: "4-8%", count: Math.max(1, Math.round(load * 0.13)), tone: "bad" as const },
    { bucket: ">8%", count: Math.max(0, Math.round(load * 0.06)), tone: "bad" as const },
  ];
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

  const initialLiquidity = market.liquidity
    ? Math.round(market.liquidity * 0.72)
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
  const qMax = 80;
  const maxLossBudget = 30;
  const liquidity = seed.riskStatus === "orderbook_missing" ? 0 : Math.max(160, Math.round(seed.volume / 31));
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

const mockMarkets: Market[] = [...manualMarkets, ...prodMarketSeeds.map((seed, index) => makeProdMarket(seed, index))]
  .map((marketItem) => retimeMarket(marketItem));

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

function statusValue(value: string | null | undefined): RiskStatus {
  const normalized = String(value ?? "paused") as RiskStatus;
  return normalized in statusMeta ? normalized : "paused";
}

function severityValue(value: string | null | undefined): "ok" | "warn" | "bad" {
  return value === "ok" || value === "warn" || value === "bad" ? value : "warn";
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
  if (!Array.isArray(buckets)) return buildSlippageBuckets(null);
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

function reasonLabel(reasonCode: string | null | undefined, direction?: "increase" | "decrease" | null) {
  const raw = String(reasonCode ?? "");
  if (raw.includes("inventory")) return direction === "increase" ? "库存压力回落，补回做市深度" : "库存偏离目标，削减风险侧深度";
  if (raw.includes("budget") || raw.includes("loss")) return direction === "increase" ? "预算占用下降，恢复 quote size" : "最坏情形 PnL 接近预算，减少挂单";
  if (raw.includes("fresh") || raw.includes("stale") || raw.includes("delay")) return direction === "increase" ? "数据新鲜度恢复，重新打开挂单" : "数据延迟，撤掉远端档位";
  if (raw.includes("negrisk") || raw.includes("group")) return direction === "increase" ? "组级保护压力缓解，恢复安全 bucket" : "组级损失保护触发，削减相关 bucket";
  if (raw.includes("endgame") || raw.includes("tail")) return direction === "increase" ? "临期压力缓解，小幅补回近端流动性" : "进入临期窗口，降低 quote size";
  return direction === "increase" ? "策略恢复部分市场深度" : "策略减少市场深度";
}

function mapDashboardItem(item: DashboardRealtimeItem, index: number): Market | null {
  const conditionId = item.identity?.condition_id;
  if (!conditionId) return null;

  const now = Date.now();
  const startAt = isoTime(item.lifecycle?.start_time, now - 4 * 60 * MINUTE_MS);
  const endAt = isoTime(item.lifecycle?.end_time, now + 2 * 60 * MINUTE_MS);
  const riskStatus = statusValue(item.quote_state?.risk_status);
  const quoteMode = statusValue(item.quote_state?.quote_mode ?? item.quote_state?.risk_status);
  const bestBid = numberValue(item.orderbook_quality?.best_bid) ?? 0;
  const bestAsk = numberValue(item.orderbook_quality?.best_ask) ?? 0;
  const mid = numberValue(item.orderbook_quality?.mid) ?? (bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0);
  const spread = numberValue(item.orderbook_quality?.spread) ?? (bestBid && bestAsk ? bestAsk - bestBid : 0);
  const strategyNotional = numberValue(item.strategy_account_metrics?.total_fill_notional);
  const grossVolume = numberValue(item.backend_required?.gross_volume) ?? strategyNotional ?? 0;
  const pnl = numberValue(item.backend_required?.current_pnl) ?? 0;
  const washRatio = numberValue(item.backend_required?.wash_ratio);
  const traderCount =
    numberValue(item.backend_required?.trader_count)
    ?? numberValue(item.strategy_account_metrics?.match_count)
    ?? 0;
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
      liquidityReason: delta === null || delta === 0 ? null : reasonLabel(point.reason_code, point.direction),
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

  return {
    id: conditionId,
    event: item.identity?.event_title ?? item.identity?.title ?? conditionId,
    market: item.identity?.title ?? item.identity?.event_title ?? conditionId,
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
    series,
    slippageBuckets: apiSlippageBuckets(item.backend_required?.slippage_distribution),
    bidLevels: apiLevels(item.orderbook_quality?.yes, "bids"),
    askLevels: apiLevels(item.orderbook_quality?.yes, "asks"),
    noBidLevels: apiLevels(item.orderbook_quality?.no, "bids"),
    noAskLevels: apiLevels(item.orderbook_quality?.no, "asks"),
    events,
    liquidityHistory: liquidityHistory.length ? liquidityHistory : undefined,
    flash: {
      actualPairsPerHour: numberValue(item.flash?.actual_pairs_per_hour),
      actualAvgIntervalS: numberValue(item.flash?.actual_avg_interval_s),
      activePairs: numberValue(item.flash?.active_pairs),
      maxPairsTotal: numberValue(item.flash?.max_pairs_total),
      l1DistanceTicks: numberValue(item.flash?.l1_distance_ticks),
    },
  };
}

function mapDashboardPayload(payload: DashboardRealtimePayload): Market[] {
  if (payload.contract_version !== "mm-dashboard-realtime.v1") return [];
  return (payload.items ?? [])
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
  const [filter, setFilter] = useState("attention");
  const [timeframe, setTimeframe] = useState("1h");
  const [query, setQuery] = useState("");
  const [liveClock, setLiveClock] = useState("--:--:--");
  const [activeBoard, setActiveBoard] = useState<BoardId>("macro");

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

    async function loadDashboard() {
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
      }
    }

    loadDashboard();
    const timer = window.setInterval(loadDashboard, 10000);
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
  const visibleMarket = filteredMarkets.some((marketItem) => marketItem.id === activeMarket.id)
    ? activeMarket
    : filteredMarkets[0] ?? activeMarket;

  const inventoryUsed = Math.min(100, (Math.abs(visibleMarket.inventory) / visibleMarket.qMax) * 100);
  const lossUsed = Math.min(100, (Math.abs(visibleMarket.worstCasePnl) / visibleMarket.maxLossBudget) * 100);
  return (
    <main className="terminal-shell">
      <section className="topbar">
        <div className="brand-block">
          <div className="brand-mark">MM</div>
          <div>
            <p className="eyebrow">Market Making Console</p>
            <h1>实时市场看板</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className={`feed-pill data-source-${dataSource.mode}`} title={dataSource.detail}>
            <Radio size={15} />
            <span>{dataSource.label}</span>
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

      <MarketOverview
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
            <p>{visibleMarket.market} · {visibleMarket.category} · {visibleMarket.id}</p>
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
    </main>
  );
}

function MarketOverview({
  filteredMarkets,
  marketCount,
  visibleMarket,
  filter,
  setFilter,
  query,
  setQuery,
  setActiveId,
}: {
  filteredMarkets: Market[];
  marketCount: number;
  visibleMarket: Market;
  filter: string;
  setFilter: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  setActiveId: (value: string) => void;
}) {
  return (
    <section className="market-rail market-overview">
      <div className="rail-header">
        <div>
          <p className="section-label">Market Overview</p>
          <strong>{filteredMarkets.length} / {marketCount}</strong>
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
        {filteredMarkets.map((marketItem) => {
          const meta = statusMeta[marketItem.riskStatus];
          return (
            <button
              key={marketItem.id}
              className={`market-row ${visibleMarket.id === marketItem.id ? "selected" : ""}`}
              type="button"
              onClick={() => setActiveId(marketItem.id)}
            >
              <div className="market-row-top">
                <span className={`status-dot ${meta.tone}`} />
                <strong>{marketItem.event}</strong>
                <small className={`state-chip ${meta.tone}`}>{meta.short}</small>
              </div>
              <p>{marketItem.market}</p>
              <div className="market-row-metrics">
                <span>{currency(marketItem.grossVolume)}</span>
                <span className={marketItem.pnl >= 0 ? "positive" : "negative"}>
                  {signedCurrency(marketItem.pnl)}
                </span>
                <span>{marketItem.staleSeconds}s</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
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

      <div className="macro-business-grid">
        <div className="panel">
          <div className="panel-title">
            <span><BarChart3 size={16} /> 交易规模与用户规模</span>
            <small>selected market</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Gross Volume" value={currency(visibleMarket.grossVolume)} tone="ok" />
            <TinyStat label="Net Volume" value={visibleMarket.netVolume === null ? "unknown" : currency(visibleMarket.netVolume)} tone={visibleMarket.netVolume === null ? "warn" : "ok"} />
            <TinyStat label="Trader Count" value={visibleMarket.traderCount.toLocaleString()} tone="ok" />
            <TinyStat label="Current PnL" value={signedCurrency(visibleMarket.pnl)} tone={visibleMarket.pnl >= 0 ? "ok" : "bad"} />
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">
            <span><LineChart size={16} /> Volume / PnL / Wash</span>
            <small>{timeframe}</small>
          </div>
          <div className="chart-frame macro-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
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
            </ResponsiveContainer>
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
  const flashFreq = visibleMarket.flash?.actualPairsPerHour;
  const flashInterval = visibleMarket.flash?.actualAvgIntervalS;
  const activePairs = visibleMarket.flash?.activePairs;
  const maxPairs = visibleMarket.flash?.maxPairsTotal;
  const l1Distance = visibleMarket.flash?.l1DistanceTicks;

  return (
    <>
      <div className="detail-grid experience-detail-grid">
        <div className="panel">
          <div className="panel-title">
            <span><Gauge size={16} /> 闪单参数监控</span>
            <small>tier-1 / mid insertion</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Actual Flash Freq" value={flashFreq === null || flashFreq === undefined ? "missing" : `${Math.round(flashFreq)} / h`} tone={flashFreq ? "ok" : "warn"} />
            <TinyStat label="Avg Flash Interval" value={flashInterval === null || flashInterval === undefined ? "missing" : `${flashInterval.toFixed(1)}s`} tone={flashInterval && flashInterval < 20 ? "ok" : "warn"} />
            <TinyStat label="Active Pairs" value={activePairs === null || activePairs === undefined ? "missing" : `${activePairs}${maxPairs ? ` / ${maxPairs}` : ""}`} tone={activePairs !== null && activePairs !== undefined ? "ok" : "warn"} />
            <TinyStat label="L1 Distance" value={l1Distance === null || l1Distance === undefined ? "missing" : `${l1Distance} ticks`} tone={l1Distance !== null && l1Distance !== undefined ? "ok" : "warn"} />
          </div>
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

        <div className="panel chart-panel">
          <div className="panel-title">
            <span><TimerReset size={16} /> Slippage Dist</span>
            <small>filled orders</small>
          </div>
          <div className="chart-frame mini-chart">
            <ResponsiveContainer width="100%" height="100%">
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
            </ResponsiveContainer>
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
              <strong>{statusMeta[visibleMarket.quoteMode].label}</strong>
              <p>{visibleMarket.riskReason}</p>
            </div>
          </div>
          <RiskStatusTimeline events={timelineEvents} startAt={visibleMarket.startAt} endAt={visibleMarket.endAt} />
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

function RiskStatusTimeline({ events, startAt, endAt }: { events: RiskEvent[]; startAt: string; endAt: string }) {
  const start = timestamp(startAt);
  const end = timestamp(endAt);
  const duration = Math.max(1, end - start);

  return (
    <div className="risk-timeline-wrap">
      <div className="risk-timeline-header">
        <span>状态变化时间轴</span>
        <small>events</small>
      </div>
      <div className="risk-timeline" aria-label="风控状态变化时间轴">
        <div className="risk-timeline-boundary">
          <span>{formatAxisTime(start, startAt, endAt)}</span>
          <span>{formatAxisTime(end, startAt, endAt)}</span>
        </div>
        {events.map((eventItem, index) => (
          <div
            key={`${eventItem.time}-${eventItem.type}-${index}`}
            className={`risk-timeline-node ${eventItem.severity} ${index % 2 === 0 ? "label-top" : "label-bottom"}`}
            style={{ left: `${Math.min(88, Math.max(8, (((eventItem.ts ?? start) - start) / duration) * 100))}%` }}
            title={`${getRiskEventLabel(eventItem)} · ${eventItem.detail}`}
          >
            <span className="risk-timeline-dot" />
            <div className="risk-timeline-label">
              <strong>{getRiskEventLabel(eventItem)}</strong>
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
  "Gross Volume": "当前选中市场的累计双边成交额，用于观察这个市场本身的交易规模。",
  "Net Volume": "当前选中市场剔除刷量或内部成交后的真实成交额；未知时显示 unknown。",
  "Trader Count": "当前选中市场内参与过有效交易或关键交互的用户数量。",
  "Current PnL": "当前选中市场的实时 PnL，反映后端成交与策略持仓在这个市场上的当前盈亏。",
  "Actual Flash Freq": "策略端最近 5 分钟内实际成功发起的闪单 pair 频率，按平均间隔折算为每小时次数。",
  "Avg Flash Interval": "策略端最近观测到的闪单 pair 平均间隔，用于判断闪单是否按预期 cadence 运行。",
  "Active Pairs": "当前市场正在存活的闪单挂单对数，以及配置允许的最大挂单对数。",
  "Tier-1 Freq": "一档贴近操作的目标触发频率，文档口径约为每 12 秒一次，即 300 次/小时。",
  "Mid Insert Freq": "中间档位插入的目标触发频率，文档口径约为每 10 秒随机插入一次，即 360 次/小时。",
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
