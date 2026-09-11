import { reviewPhases, tradeSpreadPnl, type ReviewMarketInput, type SectionSevenData, type SectionSevenMetric } from "./review-section-seven-data.ts";

const sample = (value: number, unit: string, observations: Array<[string, number]>): SectionSevenMetric => ({ value, observationUnit: unit, observations: observations.map(([label, amount]) => ({ label, value: amount })) });

// Vercel-only hypothetical fills and inventories, never Preview measurements.
export function buildSectionSevenDemo(market: ReviewMarketInput, markets: ReviewMarketInput[]): SectionSevenData {
  const pnl = markets.flatMap((item, index) => {
    let volume = 0, inventory = 0;
    const settlement = index % 2 ? 0 : 1;
    return reviewPhases.map((phase, phaseIndex) => {
      const quantity = 10 + index % 5;
      const entryPrice = 0.48 + phaseIndex * 0.01;
      const mid = entryPrice + 0.02;
      const roundTripQuantity = 20;
      const spreadPnl = tradeSpreadPnl("BUY", entryPrice, mid, quantity)
        + tradeSpreadPnl("BUY", 0.49, 0.5, roundTripQuantity)
        + tradeSpreadPnl("SELL", 0.51, 0.5, roundTripQuantity);
      const exposurePnl = quantity * (settlement - entryPrice);
      const totalPnl = quantity * settlement - quantity * entryPrice
        + roundTripQuantity * 0.51 - roundTripQuantity * 0.49 - 0.01;
      volume += quantity * entryPrice + roundTripQuantity * (0.49 + 0.51);
      inventory += quantity;
      return { marketId: item.id, market: item.event, phase, spreadPnl, exposurePnl, totalPnl, volume,
        endingExposure: inventory, maxExposure: inventory + roundTripQuantity,
        lots: [{ outcome: "YES", side: "bid" as const, quantity, entryPrice, exitPrice: settlement, exposurePnl }],
      };
    });
  });
  const risk = sample(50, "% 风险面积", [["开盘", 50], ["盘中", 40], ["尾盘", 10]]);
  risk.details = [{ label: "开盘风险面积", value: 600, unit: "sh·min" }, { label: "盘中风险面积", value: 480, unit: "sh·min" }, { label: "尾盘风险面积", value: 120, unit: "sh·min" }];
  const start = Date.parse(market.startAt ?? ""), end = Date.parse(market.endAt ?? "");
  if (Number.isFinite(start) && end > start) {
    const durationMinutes = (end - start) / 60_000;
    risk.exposureSeries = [[0, 600 / (durationMinutes * 0.2)], [0.2, 480 / (durationMinutes * 0.6)], [0.8, 120 / (durationMinutes * 0.2)], [1, 120 / (durationMinutes * 0.2)]].map(([fraction, value]) => ({ at: start + fraction * (end - start), value }));
  }
  const reversal = sample(55, "shares · 最近一次 DOWN 反转", [["反转时", 55], ["+30 秒", 70], ["+120 秒", 65]]);
  reversal.note = "示例：YES 公允价 0.73 下穿 0.50 后，YES 净多仓持续扩大。";
  const book = sample(8, "% YES 双边占比", [["Ask量", 80 / 90 * 100], ["Bid量", 10 / 90 * 100], ["Ask档", 6 / 7 * 100], ["Bid档", 1 / 7 * 100]]);
  book.details = [{ label: "YES Ask 数量", value: 80, unit: "shares" }, { label: "YES Bid 数量", value: 10, unit: "shares" }, { label: "YES Ask 档位", value: 6, unit: "档" }, { label: "YES Bid 档位", value: 1, unit: "档" }];
  return {
    metrics: {
      toxicity: sample(30, "% 不利成交 / 阶段成交", [["开盘 12/40", 30], ["盘中 8/100", 8]]),
      exposureTime: risk,
      requoteLatency: sample(800, "成交 → 报价确认 (ms)", [["开盘 P50", 400], ["开盘 P95", 800], ["盘中 P50", 350], ["盘中 P95", 700]]),
      firstImbalance: sample(5, "% 市场生命周期", [["首次越界", 5], ["开盘边界", 20]]),
      healthyBook: sample(97, "% 生命周期时长", [["双边", 97], ["单边", 1], ["空盘", 1], ["非 NORMAL", 1]]),
      levelsConsumed: sample(1.75, "% 用户单笔吃单档位分布", [["1档", 55], ["2档", 25], ["3档", 10], ["4档", 10]]),
      recross: sample(15, "% 已完成60秒观察窗", [["买入 10/50", 20], ["卖出 5/50", 10]]),
      followLatency: sample(1500, "公允价变更 → 确认；各层 P95 (ms)", [["策略", 300], ["对账", 200], ["挂撤", 1000], ["端到端", 1500]]),
      supplyConversion: { ...sample(3, "% 确认做市成交的档位占比", [["1档 24笔", 80], ["2档 6笔", 20]]), details: [{ label: "计划挂单计数", value: 1000, unit: "笔" }, { label: "确认成交计数", value: 30, unit: "笔" }] },
      reversals: sample(6, "次", [["UP", 4], ["DOWN", 2]]),
      reversalExposure: reversal,
      bookStructure: book,
      reduction: sample(15 / 45 * 100, "shares · NO 同方向", [["waiting_result 剩余", 15], ["生命周期峰值", 45]]),
    },
    pnl,
  };
}
