import { reviewPhases, type ReviewMarketInput, type SectionSevenData, type SectionSevenMetric } from "./review-section-seven-data";

const round = (value: number) => Math.round(value * 100) / 100;
const sample = (value: number, unit: string, observations: Array<[string, number]>): SectionSevenMetric => ({ value, observationUnit: unit, observations: observations.map(([label, amount]) => ({ label, value: amount })) });

// Vercel-only deterministic fixtures. Never shipped as Preview measurements.
export function buildSectionSevenDemo(market: ReviewMarketInput, markets: ReviewMarketInput[]): SectionSevenData {
  const seed = [...market.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const shift = seed % 5;
  const openingExposure = 7 + shift;
  const middleExposure = 18 + shift * 2;
  const lateExposure = 3 + shift;
  const consumed = [55 - shift * 3, 32 + shift, 10 + shift, 3 + shift];
  const pnl = markets.flatMap((item, index) => {
    const weights = [0.2, 0.6, 0.2];
    const spread = Math.max(2, round(item.grossVolume * 0.001));
    let usedPnl = 0;
    let usedVolume = 0;
    let usedSpread = 0;
    return reviewPhases.map((phase, phaseIndex) => {
      const totalPnl = phaseIndex === 2 ? round(item.pnl - usedPnl) : round(item.pnl * weights[phaseIndex]);
      const volume = phaseIndex === 2 ? round(item.grossVolume - usedVolume) : round(item.grossVolume * weights[phaseIndex]);
      const spreadPnl = phaseIndex === 2 ? round(spread - usedSpread) : round(spread * weights[phaseIndex]);
      const exposurePnl = round(totalPnl - spreadPnl);
      usedPnl += totalPnl;
      usedVolume += volume;
      usedSpread += spreadPnl;
      const side = index % 2 ? "ask" as const : "bid" as const;
      const quantity = Math.max(1, Math.ceil(Math.abs(exposurePnl) / 0.08));
      const entryPrice = 0.5;
      const exitPrice = entryPrice + exposurePnl / quantity * (side === "bid" ? 1 : -1);
      return { marketId: item.id, market: item.event, phase, spreadPnl, exposurePnl, volume,
        endingExposure: round(quantity * [0.6, 0.3, 0.05][phaseIndex]) * (side === "bid" ? 1 : -1),
        maxExposure: quantity,
        lots: [{ outcome: index % 2 ? "NO" : "YES", side, quantity, entryPrice, exitPrice, exposurePnl }],
      };
    });
  });
  return {
    metrics: {
      toxicity: sample(18 + shift, "不利成交 / 确认成交 (%)", [["开盘", 18 + shift], ["盘中", 14 + shift]]),
      exposureTime: sample(openingExposure, `股·小时；开盘占比 ${round(openingExposure / (openingExposure + middleExposure + lateExposure) * 100)}%`, [["开盘", openingExposure], ["盘中", middleExposure], ["尾盘", lateExposure]]),
      requoteLatency: sample(360 + shift * 20, "成交 → 报价确认 (ms)", [["开盘 P50", 140 + shift * 10], ["开盘 P95", 360 + shift * 20], ["盘中 P50", 110 + shift * 10], ["盘中 P95", 280 + shift * 20]]),
      firstImbalance: sample(12 + shift * 2, "首次触发位置 / 成交生命周期 (%)", [["首次越界", 12 + shift * 2], ["开盘边界", 20]]),
      healthyBook: sample(94 - shift, "盘中时长占比 (%)", [["双边", 94 - shift], ["单边", 3 + shift], ["空盘", 1], ["非 NORMAL", 2]]),
      levelsConsumed: sample(round(consumed.reduce((sum, count, index) => sum + count * (index + 1), 0) / 100), "用户吃单档位分布 (%)", consumed.map((count, index) => [`${index + 1}档`, count])),
      recross: sample(11 + shift, "完整 60 秒观察窗回摆率 (%)", [["买入", 12 + shift], ["卖出", 10 + shift]]),
      followLatency: sample(420 + shift * 20, "公允价变更 → 确认；各层 P95 (ms)", [["策略", 100 + shift * 5], ["对账", 150 + shift * 5], ["挂撤", 220 + shift * 10], ["端到端", 420 + shift * 20]]),
      supplyConversion: sample(19 + shift, "确认做市成交的档位占比 (%)", [["第1档", 62 - shift], ["第2档", 28 + shift], ["第3档", 10]]),
      reversals: sample(3, "公允价穿越 0.5 的次数", [["向上", 2], ["向下", 1]]),
      reversalExposure: sample(8 + shift, "反转时净库存 (sh)，按时间排列", [["83% ↑", 28 + shift], ["89% ↓", 18 + shift], ["94% ↑", 8 + shift]]),
      bookStructure: sample(0.25, "数量与档位的双边占比 (%)", [["ask 数量", 20], ["bid 数量", 80], ["ask 档位", 25], ["bid 档位", 75]]),
      reduction: sample(60, "waiting_result 数量 (sh)；实际卖出 / 峰值 = 40%", [["同向峰值", 60], ["减仓挂单", 36], ["实际卖出", 24]]),
    },
    pnl,
  };
}
