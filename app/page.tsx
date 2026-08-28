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
    orderbook_missing: "authority snapshot not converged; quoting paused for this market",
    data_delay: "fair value or catalog update is stale beyond freshness target",
    negrisk_group_protection: "group-level loss guard is active for related buckets",
    paused: "operator or runtime pause is active",
  };
  return reasons[status];
}

function makeProdMarket(seed: ProdMarketSeed, index: number): Market {
  const tone = statusMeta[seed.riskStatus].tone;
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

const markets: Market[] = [...manualMarkets, ...prodMarketSeeds.map((seed, index) => makeProdMarket(seed, index))];

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

function complementaryLevels(levels: Array<{ price: number; quantity: number }>, sort: "bid" | "ask") {
  return levels
    .map((level) => ({
      price: Number((1 - level.price).toFixed(2)),
      quantity: level.quantity,
    }))
    .sort((a, b) => (sort === "bid" ? b.price - a.price : a.price - b.price));
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
  }, [filter, query]);

  const activeMarket = markets.find((marketItem) => marketItem.id === activeId) ?? markets[0];
  const visibleMarket = filteredMarkets.some((marketItem) => marketItem.id === activeMarket.id)
    ? activeMarket
    : filteredMarkets[0] ?? activeMarket;

  const inventoryUsed = Math.min(100, (Math.abs(visibleMarket.inventory) / visibleMarket.qMax) * 100);
  const lossUsed = Math.min(100, (Math.abs(visibleMarket.worstCasePnl) / visibleMarket.maxLossBudget) * 100);
  const selectedTone = statusMeta[visibleMarket.riskStatus].tone;
  const selectedRiskTone = selectedTone === "ok" ? "ok" : selectedTone === "warn" ? "warn" : "bad";
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

        <section className="kpi-grid" aria-label="Realtime dashboard metrics">
          {activeBoard === "macro" && (
            <>
              <MetricCard icon={<BarChart3 size={17} />} label="Market Gross" value={currency(visibleMarket.grossVolume)} tone="ok" />
              <MetricCard icon={<Activity size={17} />} label="Market Net" value={visibleMarket.netVolume === null ? "unknown" : currency(visibleMarket.netVolume)} tone={visibleMarket.netVolume === null ? "warn" : "ok"} />
              <MetricCard icon={<WalletCards size={17} />} label="Market Traders" value={visibleMarket.traderCount.toLocaleString()} tone="ok" />
              <MetricCard icon={<LineChart size={17} />} label="Market PnL" value={signedCurrency(visibleMarket.pnl)} tone={visibleMarket.pnl >= 0 ? "ok" : "bad"} />
              <MetricCard icon={<TimerReset size={17} />} label="Wash Ratio" value={pct(visibleMarket.washRatio)} tone={(visibleMarket.washRatio ?? 1) < 0.2 ? "ok" : "warn"} />
            </>
          )}
          {activeBoard === "experience" && (
            <>
              <MetricCard icon={<Layers3 size={17} />} label="Market Liquidity" value={`${visibleMarket.liquidity.toLocaleString()} sh`} tone={visibleMarket.liquidity > 0 ? "ok" : "bad"} />
              <MetricCard icon={<TimerReset size={17} />} label="Trade Slippage" value={visibleMarket.avgSlippage === null ? "no_trade" : `${visibleMarket.avgSlippage.toFixed(1)}%`} tone={(visibleMarket.avgSlippage ?? 99) < 4 ? "ok" : "bad"} />
              <MetricCard icon={<Activity size={17} />} label="Spread Now" value={visibleMarket.spread ? `${(visibleMarket.spread * 100).toFixed(1)}c` : "missing"} tone={visibleMarket.spread && visibleMarket.spread < 0.06 ? "ok" : "warn"} />
              <MetricCard icon={<Gauge size={17} />} label="Ask K / Bid K" value={`${visibleMarket.askSlope?.toFixed(0) ?? "--"} / ${visibleMarket.bidSlope?.toFixed(0) ?? "--"}`} tone={visibleMarket.askSlope && visibleMarket.bidSlope ? "ok" : "bad"} />
              <MetricCard icon={<Database size={17} />} label="Book Health" value={visibleMarket.bidLevels.length ? "2-sided" : "missing"} tone={visibleMarket.bidLevels.length ? "ok" : "bad"} />
            </>
          )}
          {activeBoard === "risk" && (
            <>
              <MetricCard icon={<ShieldAlert size={17} />} label="Risk Status" value={statusMeta[visibleMarket.riskStatus].short} tone={selectedRiskTone} />
              <MetricCard icon={<Pause size={17} />} label="Quote Mode" value={statusMeta[visibleMarket.quoteMode].short} tone={selectedRiskTone} />
              <MetricCard icon={<Gauge size={17} />} label="Budget Used" value={`${lossUsed.toFixed(0)}%`} tone={lossUsed > 85 ? "bad" : "warn"} />
              <MetricCard icon={<Activity size={17} />} label="Inventory q" value={`${visibleMarket.inventory} / ${visibleMarket.qMax}`} tone={Math.abs(visibleMarket.inventory) >= 64 ? "bad" : "warn"} />
              <MetricCard icon={<Database size={17} />} label="Runtime Delay" value={`${visibleMarket.staleSeconds}s`} tone={visibleMarket.staleSeconds > 60 ? "bad" : "ok"} />
            </>
          )}
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
            <span><Activity size={16} /> Market Snapshot</span>
            <small>selected market</small>
          </div>
          <MarketMetricTable markets={[visibleMarket]} mode="macro" />
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
    bookOutcome === "yes" ? visibleMarket.bidLevels : complementaryLevels(visibleMarket.askLevels, "bid");
  const displayedAskLevels =
    bookOutcome === "yes" ? visibleMarket.askLevels : complementaryLevels(visibleMarket.bidLevels, "ask");
  const bidMax = maxQuantity(displayedBidLevels);
  const askMax = maxQuantity(displayedAskLevels);

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
            <span><ShieldAlert size={16} /> Risk Snapshot</span>
            <small>selected market</small>
          </div>
          <MarketMetricTable markets={[visibleMarket]} mode="risk" />
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

const metricDescriptions: Record<string, string> = {
  "Market Gross": "当前选中市场的累计双边成交额，包含所有可计入市场交易规模的成交。",
  "Market Net": "当前选中市场剔除刷量或内部成交后的真实成交额；未知时显示 unknown。",
  "Market Traders": "当前选中市场内参与过有效交易或关键交互的用户数量。",
  "Market PnL": "当前选中市场的实时做市盈亏，按当前持仓、现金流和估值口径计算。",
  "Wash Ratio": "当前选中市场刷量成交额占总成交额的比例，用于判断交易质量。",
  "Market Liquidity": "当前选中市场盘口可用流动性，表示当前可被成交的挂单深度。",
  "Trade Slippage": "当前选中市场真实成交相对成交前盘口中间价的平均滑点。",
  "Spread Now": "当前选中市场最优 ask 与最优 bid 的价差，数值越小成交体验通常越好。",
  "Ask K / Bid K": "当前选中市场买入侧和卖出侧盘口冲击斜率，用于衡量吃单对价格的影响。",
  "Book Health": "当前选中市场订单簿是否有双边有效盘口；missing 表示无法确认挂单状态。",
  "Risk Status": "当前选中市场的综合风控状态，由库存、预算、盘口、临期和数据新鲜度共同决定。",
  "Quote Mode": "当前选中市场实际采用的摆单模式，例如正常、库存倾斜、只减风险或暂停。",
  "Budget Used": "当前选中市场最坏情况亏损相对风控预算的占用比例。",
  "Inventory q": "当前选中市场做市账户持仓相对 q_max 的库存敞口。",
  "Runtime Delay": "当前选中市场策略端最近一次计算或心跳距离现在的延迟。",
};

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad";
}) {
  const description = metricDescriptions[label];

  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span
        className={description ? "metric-label has-tooltip" : "metric-label"}
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
  "Wash / Total": "当前选中市场刷量成交额占总成交额的比例，用于判断成交质量。",
  "Brush Status": "当前选中市场是否已配置刷量识别口径；未配置时真实成交、净成交和滑点统计可能不可靠。",
  "K / Book Drift": "策略端 K 线价格与订单簿快照之间的偏移，用于判断定价输入和盘口是否同步。",
  "Initial Liquidity": "本轮监控窗口开始时的盘口可用流动性，作为对比当前流动性的基准。",
  "Current Liquidity": "当前订单簿内可被成交的挂单深度，单位为 shares。",
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
  gross_volume: "当前市场的累计双边成交额，用于观察这个市场本身的交易规模。",
  net_volume: "当前市场剔除刷量或内部成交后的真实交易量；未知时不填 0，避免误导。",
  trader_count: "当前市场内发生过有效交易或交互的用户数量。",
  wash_volume_ratio: "当前市场刷量成交额占总成交额的比例，用于判断成交质量。",
  avg_trade_slippage: "当前市场真实成交相对成交前盘口中间价的平均滑点。",
  ask_impact_slope: "当前市场买入 YES 方向的盘口冲击斜率，数值越低说明 ask 侧越容易被吃穿。",
  bid_impact_slope: "当前市场卖出 YES 方向的盘口冲击斜率，数值越低说明 bid 侧越容易被吃穿。",
  orderbook_history: "当前市场最近的盘口历史是否足够计算深度、点差和冲击斜率。",
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
