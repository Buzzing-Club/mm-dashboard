"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  WalletCards,
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
  | "orderbook_missing"
  | "data_delay"
  | "negrisk_group_protection"
  | "paused";

type BoardId = "macro" | "experience" | "risk";

type Market = {
  id: string;
  event: string;
  market: string;
  category: string;
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
  endInMinutes: number;
  series: Array<{
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
  events: Array<{ time: string; type: string; detail: string; severity: "ok" | "warn" | "bad" }>;
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
  orderbook_missing: { label: "盘口缺失", tone: "bad", short: "BOOK" },
  data_delay: { label: "数据延迟", tone: "warn", short: "STALE" },
  negrisk_group_protection: { label: "组级保护", tone: "bad", short: "NEGRISK" },
  paused: { label: "暂停摆单", tone: "muted", short: "PAUSED" },
};

const markets: Market[] = [
  {
    id: "BTC-5M-1910",
    event: "BTC Up/Down 5M",
    market: "Bitcoin Up or Down - 19:10-19:15 ET",
    category: "Crypto · Recurring",
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
    market: "Temperature 31C bucket",
    category: "Weather · NegRisk",
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
    id: "ETH-15M-1845",
    event: "ETH Up/Down 15M",
    market: "Ethereum Up or Down - 18:45-19:00 ET",
    category: "Crypto · Recurring",
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
    id: "CS2-MAJOR-LIQUID",
    event: "IEM Cologne Major 2026",
    market: "Will Team Liquid win?",
    category: "Sports · Esports",
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
    id: "DOGE-5M-1915",
    event: "DOGE Up/Down 5M",
    market: "Dogecoin Up or Down - 19:15-19:20 ET",
    category: "Crypto · Recurring",
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

const filterOptions = [
  { id: "all", label: "全部" },
  { id: "attention", label: "异常" },
  { id: "live", label: "Live" },
  { id: "crypto", label: "Crypto" },
  { id: "negrisk", label: "NegRisk" },
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
    subtitle: "交易规模、用户规模、PnL、刷量占比",
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

function pct(value: number | null, decimals = 1) {
  if (value === null) return "unknown";
  return `${(value * 100).toFixed(decimals)}%`;
}

function price(value: number) {
  return value ? value.toFixed(2) : "--";
}

function maxQuantity(levels: Array<{ quantity: number }>) {
  return Math.max(1, ...levels.map((level) => level.quantity));
}

export default function Home() {
  const [activeId, setActiveId] = useState(markets[0].id);
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

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return markets
      .filter((marketItem) => {
        if (filter === "attention") {
          return statusMeta[marketItem.riskStatus].tone !== "ok" || marketItem.staleSeconds > 60;
        }
        if (filter === "live") return marketItem.status === "live";
        if (filter === "crypto") return marketItem.category.toLowerCase().includes("crypto");
        if (filter === "negrisk") return marketItem.category.toLowerCase().includes("negrisk");
        return true;
      })
      .filter((marketItem) => {
        if (!normalizedQuery) return true;
        return `${marketItem.event} ${marketItem.market} ${marketItem.id}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const severity = { bad: 0, warn: 1, muted: 2, ok: 3 };
        return severity[statusMeta[a.riskStatus].tone] - severity[statusMeta[b.riskStatus].tone];
      });
  }, [filter, query]);

  const activeMarket = markets.find((marketItem) => marketItem.id === activeId) ?? markets[0];
  const visibleMarket = filteredMarkets.some((marketItem) => marketItem.id === activeMarket.id)
    ? activeMarket
    : filteredMarkets[0] ?? activeMarket;

  const totals = useMemo(() => {
    const gross = markets.reduce((sum, marketItem) => sum + marketItem.grossVolume, 0);
    const net = markets.reduce((sum, marketItem) => sum + (marketItem.netVolume ?? 0), 0);
    const pnl = markets.reduce((sum, marketItem) => sum + marketItem.pnl, 0);
    const alerts = markets.filter((marketItem) => statusMeta[marketItem.riskStatus].tone !== "ok").length;
    const washKnown = markets.filter((marketItem) => marketItem.washRatio !== null);
    const avgWash =
      washKnown.reduce((sum, marketItem) => sum + (marketItem.washRatio ?? 0), 0) /
      Math.max(1, washKnown.length);
    const avgSlippage =
      markets.reduce((sum, marketItem) => sum + (marketItem.avgSlippage ?? 0), 0) /
      Math.max(1, markets.filter((marketItem) => marketItem.avgSlippage !== null).length);
    const avgSpread =
      markets.reduce((sum, marketItem) => sum + marketItem.spread, 0) / Math.max(1, markets.length);
    const liquidity = markets.reduce((sum, marketItem) => sum + marketItem.liquidity, 0);
    const stale = markets.filter((marketItem) => marketItem.staleSeconds > 60).length;
    const paused = markets.filter((marketItem) => marketItem.status === "paused").length;
    const avgRiskUsed =
      markets.reduce(
        (sum, marketItem) =>
          sum + Math.min(100, (Math.abs(marketItem.worstCasePnl) / marketItem.maxLossBudget) * 100),
        0,
      ) / Math.max(1, markets.length);

    return {
      gross,
      net,
      pnl,
      alerts,
      avgWash,
      avgSlippage,
      avgSpread,
      liquidity,
      stale,
      paused,
      avgRiskUsed,
      traders: markets.reduce((sum, marketItem) => sum + marketItem.traderCount, 0),
    };
  }, []);

  const bidMax = maxQuantity(visibleMarket.bidLevels);
  const askMax = maxQuantity(visibleMarket.askLevels);
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
          <div className="feed-pill" title="Live data heartbeat">
            <Radio size={15} />
            <span>LIVE</span>
            <strong>{liveClock}</strong>
          </div>
          <button className="icon-button" type="button" title="刷新">
            <RefreshCw size={16} />
          </button>
          <button className="icon-button alert" type="button" title="告警">
            <Bell size={16} />
          </button>
        </div>
      </section>

      <section className="kpi-grid" aria-label="Realtime macro metrics">
        {activeBoard === "macro" && (
          <>
            <MetricCard icon={<BarChart3 size={17} />} label="Gross Volume" value={currency(totals.gross)} delta="+18.4%" tone="ok" />
            <MetricCard icon={<Activity size={17} />} label="Net Volume" value={currency(totals.net)} delta="+12.1%" tone="ok" />
            <MetricCard icon={<WalletCards size={17} />} label="Traders" value={totals.traders.toLocaleString()} delta="+64" tone="ok" />
            <MetricCard icon={<LineChart size={17} />} label="Current PnL" value={signedCurrency(totals.pnl)} delta="-0.8%" tone={totals.pnl >= 0 ? "ok" : "bad"} />
            <MetricCard icon={<TimerReset size={17} />} label="Wash Ratio" value={pct(totals.avgWash)} delta="avg" tone={totals.avgWash < 0.2 ? "ok" : "warn"} />
          </>
        )}
        {activeBoard === "experience" && (
          <>
            <MetricCard icon={<Layers3 size={17} />} label="Liquidity" value={`${totals.liquidity.toLocaleString()} sh`} delta="+7.2%" tone="ok" />
            <MetricCard icon={<TimerReset size={17} />} label="Avg Slippage" value={`${totals.avgSlippage.toFixed(1)}%`} delta="-0.4%" tone={totals.avgSlippage < 4 ? "ok" : "bad"} />
            <MetricCard icon={<Activity size={17} />} label="Avg Spread" value={`${(totals.avgSpread * 100).toFixed(1)}c`} delta="+0.7c" tone={totals.avgSpread < 0.06 ? "ok" : "warn"} />
            <MetricCard icon={<Gauge size={17} />} label="Ask K / Bid K" value={`${visibleMarket.askSlope?.toFixed(0) ?? "--"} / ${visibleMarket.bidSlope?.toFixed(0) ?? "--"}`} delta="selected" tone={visibleMarket.askSlope && visibleMarket.bidSlope ? "ok" : "bad"} />
            <MetricCard icon={<Database size={17} />} label="Book Health" value={visibleMarket.bidLevels.length ? "2-sided" : "missing"} delta={`${visibleMarket.staleSeconds}s`} tone={visibleMarket.bidLevels.length ? "ok" : "bad"} />
          </>
        )}
        {activeBoard === "risk" && (
          <>
            <MetricCard icon={<ShieldAlert size={17} />} label="Risk Alerts" value={String(totals.alerts)} delta={`${totals.stale} stale`} tone="bad" />
            <MetricCard icon={<Pause size={17} />} label="Paused" value={String(totals.paused)} delta="markets" tone={totals.paused ? "bad" : "ok"} />
            <MetricCard icon={<Gauge size={17} />} label="Avg Budget Used" value={`${totals.avgRiskUsed.toFixed(0)}%`} delta="worst pnl" tone={totals.avgRiskUsed > 80 ? "bad" : "warn"} />
            <MetricCard icon={<Activity size={17} />} label="Selected q" value={`${visibleMarket.inventory} / ${visibleMarket.qMax}`} delta={statusMeta[visibleMarket.quoteMode].short} tone={Math.abs(visibleMarket.inventory) >= 64 ? "bad" : "warn"} />
            <MetricCard icon={<Database size={17} />} label="Runtime Delay" value={`${visibleMarket.staleSeconds}s`} delta="strategy" tone={visibleMarket.staleSeconds > 60 ? "bad" : "ok"} />
          </>
        )}
      </section>

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

      <section className="workspace">
        <aside className="market-rail">
          <div className="rail-header">
            <div>
              <p className="section-label">Markets</p>
              <strong>{filteredMarkets.length} / {markets.length}</strong>
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
              placeholder="market / event / id"
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
        </aside>

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

          {activeBoard === "macro" && (
            <MacroBoard visibleMarket={visibleMarket} markets={filteredMarkets} timeframe={timeframe} setTimeframe={setTimeframe} />
          )}

          {activeBoard === "experience" && (
            <ExperienceBoard
              visibleMarket={visibleMarket}
              bidMax={bidMax}
              askMax={askMax}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
            />
          )}

          {activeBoard === "risk" && (
            <RiskBoard
              visibleMarket={visibleMarket}
              markets={filteredMarkets}
              inventoryUsed={inventoryUsed}
              lossUsed={lossUsed}
            />
          )}
        </section>
      </section>
    </main>
  );
}

function MacroBoard({
  visibleMarket,
  markets,
  timeframe,
  setTimeframe,
}: {
  visibleMarket: Market;
  markets: Market[];
  timeframe: string;
  setTimeframe: (value: string) => void;
}) {
  return (
    <>
      <div className="subboard-header">
        <div>
          <p className="section-label">Sub Dashboard 01</p>
          <h3>宏观业务指标</h3>
        </div>
        <span>后端统计 · 60s refresh · 双边交易量口径</span>
      </div>

      <div className="detail-grid macro-detail-grid">
        <div className="panel">
          <div className="panel-title">
            <span><BarChart3 size={16} /> 交易规模与用户规模</span>
            <small>selected market</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Gross Volume" value={currency(visibleMarket.grossVolume)} tone="ok" />
            <TinyStat label="Net Volume" value={visibleMarket.netVolume === null ? "unknown" : currency(visibleMarket.netVolume)} tone={visibleMarket.netVolume === null ? "warn" : "ok"} />
            <TinyStat label="Trader Count" value={visibleMarket.traderCount.toLocaleString()} tone="ok" />
            <TinyStat label="Wash / Total" value={pct(visibleMarket.washRatio)} tone={(visibleMarket.washRatio ?? 1) < 0.2 ? "ok" : "warn"} />
          </div>
        </div>

        <div className="panel pnl-tile">
          <div className="panel-title">
            <span><LineChart size={16} /> 当前市场 PnL</span>
            <small>backend / strategy</small>
          </div>
          <strong className={visibleMarket.pnl >= 0 ? "positive" : "negative"}>{signedCurrency(visibleMarket.pnl)}</strong>
          <p>Worst case {signedCurrency(visibleMarket.worstCasePnl)} · budget -{currency(visibleMarket.maxLossBudget)}</p>
        </div>

        <div className="panel">
          <div className="panel-title">
            <span><Database size={16} /> 指标状态</span>
            <small>empty-state aware</small>
          </div>
          <div className="source-list">
            <SourceRow label="gross_volume" value="ready" tone="ok" />
            <SourceRow label="net_volume" value={visibleMarket.netVolume === null ? "unknown" : "ready"} tone={visibleMarket.netVolume === null ? "warn" : "ok"} />
            <SourceRow label="trader_count" value="ready" tone="ok" />
            <SourceRow label="wash_volume_ratio" value={visibleMarket.washRatio === null ? "unknown" : "ready"} tone={visibleMarket.washRatio === null ? "warn" : "ok"} />
          </div>
        </div>
      </div>

      <BoardChartToolbar title="Business Trend" timeframe={timeframe} setTimeframe={setTimeframe} />

      <div className="analytics-grid">
        <div className="panel chart-panel wide">
          <div className="panel-title">
            <span><LineChart size={16} /> Volume / PnL / Wash</span>
            <small>{timeframe}</small>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleMarket.series}>
                <CartesianGrid stroke="#242833" vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
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

        <div className="panel table-panel">
          <div className="panel-title">
            <span><Activity size={16} /> Market Ranking</span>
            <small>filtered scope</small>
          </div>
          <MarketMetricTable markets={markets} mode="macro" />
        </div>
      </div>
    </>
  );
}

function ExperienceBoard({
  visibleMarket,
  bidMax,
  askMax,
  timeframe,
  setTimeframe,
}: {
  visibleMarket: Market;
  bidMax: number;
  askMax: number;
  timeframe: string;
  setTimeframe: (value: string) => void;
}) {
  return (
    <>
      <div className="subboard-header">
        <div>
          <p className="section-label">Sub Dashboard 02</p>
          <h3>用户体验指标</h3>
        </div>
        <span>撮合/后端/策略端 · 剔除刷量交易 · V=10 shares</span>
      </div>

      <div className="detail-grid experience-detail-grid">
        <div className="panel">
          <div className="panel-title">
            <span><Gauge size={16} /> 闪单参数监控</span>
            <small>K line / book sync</small>
          </div>
          <div className="micro-grid">
            <TinyStat label="Brush Status" value={visibleMarket.washRatio === null ? "unknown" : "configured"} tone={visibleMarket.washRatio === null ? "warn" : "ok"} />
            <TinyStat label="K / Book Drift" value={visibleMarket.staleSeconds > 60 ? "stale" : "0.8c"} tone={visibleMarket.staleSeconds > 60 ? "bad" : "ok"} />
            <TinyStat label="Initial Liquidity" value={`${Math.round(visibleMarket.liquidity * 0.72)} sh`} tone={visibleMarket.liquidity ? "ok" : "bad"} />
            <TinyStat label="Current Liquidity" value={`${visibleMarket.liquidity} sh`} tone={visibleMarket.liquidity > 500 ? "ok" : "bad"} />
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

        <div className="panel">
          <div className="panel-title">
            <span><Database size={16} /> 异常原因</span>
            <small>not zero-filled</small>
          </div>
          <div className="source-list">
            <SourceRow label="avg_trade_slippage" value={visibleMarket.avgSlippage === null ? "no_trade" : "ready"} tone={visibleMarket.avgSlippage === null ? "warn" : "ok"} />
            <SourceRow label="ask_impact_slope" value={visibleMarket.askSlope === null ? "insufficient_ask_depth" : "ready"} tone={visibleMarket.askSlope === null ? "bad" : "ok"} />
            <SourceRow label="bid_impact_slope" value={visibleMarket.bidSlope === null ? "insufficient_bid_depth" : "ready"} tone={visibleMarket.bidSlope === null ? "bad" : "ok"} />
            <SourceRow label="orderbook_history" value={visibleMarket.bidLevels.length ? "ready" : "orderbook_missing"} tone={visibleMarket.bidLevels.length ? "ok" : "bad"} />
          </div>
        </div>
      </div>

      <BoardChartToolbar title="Liquidity / Slippage" timeframe={timeframe} setTimeframe={setTimeframe} />

      <div className="analytics-grid">
        <div className="panel chart-panel wide">
          <div className="panel-title">
            <span><LineChart size={16} /> Spread / Impact Slope</span>
            <small>{timeframe}</small>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleMarket.series}>
                <CartesianGrid stroke="#242833" vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} stroke="#798191" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="askSlope" fill="#4cc9f033" stroke="#4cc9f0" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="bidSlope" stroke="#20d49b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="spread" stroke="#ffb020" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">
            <span><TimerReset size={16} /> Slippage Dist</span>
            <small>filled orders</small>
          </div>
          <div className="chart-frame compact-chart">
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

      <div className="bottom-grid single-bottom">
        <div className="panel orderbook-panel">
          <div className="panel-title">
            <span><Activity size={16} /> Order Book History Snapshot</span>
            <small>{visibleMarket.liquidity ? `${visibleMarket.liquidity} shares` : "empty"}</small>
          </div>
          <div className="book-grid">
            <OrderSide title="Bids" side="bid" levels={visibleMarket.bidLevels} max={bidMax} />
            <OrderSide title="Asks" side="ask" levels={visibleMarket.askLevels} max={askMax} />
          </div>
        </div>
      </div>
    </>
  );
}

function RiskBoard({
  visibleMarket,
  markets,
  inventoryUsed,
  lossUsed,
}: {
  visibleMarket: Market;
  markets: Market[];
  inventoryUsed: number;
  lossUsed: number;
}) {
  return (
    <>
      <div className="subboard-header">
        <div>
          <p className="section-label">Sub Dashboard 03</p>
          <h3>市场风控指标</h3>
        </div>
        <span>策略端状态 · 2 tick / 60s freshness · 只展示不下发参数</span>
      </div>

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
          <div className="meter-stack">
            <Meter label="Inventory / q_max" value={inventoryUsed} figure={`${visibleMarket.inventory} / ${visibleMarket.qMax}`} />
            <Meter label="Worst PnL / budget" value={lossUsed} figure={`${visibleMarket.worstCasePnl.toFixed(1)} / -${visibleMarket.maxLossBudget}`} tone={lossUsed > 85 ? "bad" : "warn"} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <span><ShieldAlert size={16} /> 当前摆单策略提示</span>
            <small>strategy runtime</small>
          </div>
          <div className="source-list">
            <SourceRow label="risk_status" value={statusMeta[visibleMarket.riskStatus].short} tone={statusMeta[visibleMarket.riskStatus].tone === "ok" ? "ok" : statusMeta[visibleMarket.riskStatus].tone === "muted" ? "warn" : statusMeta[visibleMarket.riskStatus].tone} />
            <SourceRow label="quote_mode" value={statusMeta[visibleMarket.quoteMode].short} tone={statusMeta[visibleMarket.quoteMode].tone === "ok" ? "ok" : statusMeta[visibleMarket.quoteMode].tone === "muted" ? "warn" : statusMeta[visibleMarket.quoteMode].tone} />
            <SourceRow label="reduce_only_line" value={`${visibleMarket.qMax * 0.8} shares`} tone={Math.abs(visibleMarket.inventory) >= visibleMarket.qMax * 0.8 ? "bad" : "ok"} />
            <SourceRow label="endgame_window" value={`${visibleMarket.endInMinutes}m`} tone={visibleMarket.endInMinutes < 15 ? "warn" : "ok"} />
          </div>
        </div>

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
      </div>

      <div className="bottom-grid">
        <div className="panel table-panel">
          <div className="panel-title">
            <span><ShieldAlert size={16} /> Risk Queue</span>
            <small>filtered scope</small>
          </div>
          <MarketMetricTable markets={markets} mode="risk" />
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

function MarketMetricTable({ markets: rows, mode }: { markets: Market[]; mode: "macro" | "risk" }) {
  return (
    <div className="metric-table">
      <div className="metric-table-head">
        <span>Market</span>
        <span>{mode === "macro" ? "Volume" : "Risk"}</span>
        <span>{mode === "macro" ? "Traders" : "Inv"}</span>
        <span>{mode === "macro" ? "PnL" : "Worst"}</span>
      </div>
      {rows.map((marketItem) => (
        <div key={`${mode}-${marketItem.id}`} className="metric-table-row">
          <span>
            <strong>{marketItem.event}</strong>
            <small>{marketItem.id}</small>
          </span>
          <span>{mode === "macro" ? currency(marketItem.grossVolume) : statusMeta[marketItem.riskStatus].short}</span>
          <span>{mode === "macro" ? marketItem.traderCount.toLocaleString() : `${marketItem.inventory}/${marketItem.qMax}`}</span>
          <span className={(mode === "macro" ? marketItem.pnl : marketItem.worstCasePnl) >= 0 ? "positive" : "negative"}>
            {mode === "macro" ? signedCurrency(marketItem.pnl) : signedCurrency(marketItem.worstCasePnl)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  tone: "ok" | "warn" | "bad";
}) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={tone === "bad" ? "negative" : "positive"}>
        {tone === "bad" ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
        {delta}
      </small>
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

function TinyStat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className={`tiny-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourceRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className="source-row">
      <span>{label}</span>
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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}: {Number(item.value).toFixed(1)}
        </span>
      ))}
    </div>
  );
}
