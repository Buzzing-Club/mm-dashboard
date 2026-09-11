"use client";

import { useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aggregateLifecyclePnl, aggregatePnl, phaseDefinition, reviewPhases, type MetricId, type SectionSevenData, type ReviewPhase } from "./review-section-seven-data";

type MetricDefinition = { id: MetricId; name: string; unit: string; definition: string; source: string };
export const stageMetrics: Array<{ id: string; phase: string; range: string; goal: string; metrics: MetricDefinition[] }> = [
  { id: "premarket", phase: "开盘", range: "0–20%", goal: "更少风险、更快准确定价、更快库存中性", metrics: [
    { id: "toxicity", name: "开盘毒性率", unit: "%", definition: "阶段内成交后发生不利漂移的确认成交笔数 / 该阶段确认成交笔数；与盘中毒性率并排比较。不利判定遵循 RecentFillToxicity。只统计做市角色，排除刷量成交。", source: "RecentFillToxicity 逐笔判定 + fills_total，按阶段汇总" },
    { id: "exposureTime", name: "风险承担结构", unit: "sh·h", definition: "逐 tick 累加 |净敞口| × 持有时长，按开盘、盘中、尾盘分桶；单位为股·小时。开盘占比 = 开盘敞口时间 / 全生命周期敞口时间。", source: "库存 q × tick 时间差，按阶段累计" },
    { id: "requoteLatency", name: "报价更新速度", unit: "ms P95", definition: "成交发生到更新后的报价中心确认挂出的端到端耗时分布，比较开盘和盘中 P50/P95。包含成交处理、决策、对账和挂撤单，不用挂撤单耗时代替全链路。", source: "on_my_fill 时间戳 → _sync_quotes 确认" },
    { id: "firstImbalance", name: "库存不平衡发生时间", unit: "% 生命周期", definition: "首次满足 |净仓| > 15 shares 且单边持仓占比 > 90% 的时间，减首笔成交时间，再除以首末成交时间跨度。阈值可配置；未触发不是 0，显示无样本。", source: "逐 tick 持仓、首次阈值越界时间、首末成交时间" },
  ] },
  { id: "intraday", phase: "盘中", range: "20–80%", goal: "充足流动性、避免不合理波动、快速跟随定价", metrics: [
    { id: "healthyBook", name: "订单簿健全时间占比", unit: "%", definition: "NORMAL 模式下双边有单的累计时长 / 盘中总时长；同时展示单边、空盘和非 NORMAL 时间。不是盘口快照数量占比。", source: "覆盖状态持续时间，按生命周期分桶" },
    { id: "levelsConsumed", name: "用户单笔吃单的平均档位数", unit: "档", definition: "逐笔用户吃单穿过的报价档位数的平均值，并展示档位分布。通过成交价、中心 r、档距 delta 与档数推算；排除 TradeVolume 钱包成交。", source: "用户成交记录 + 当时的报价梯度参数" },
    { id: "recross", name: "回摆率", unit: "%", definition: "成交后 60 秒内公允价回穿成交价的成交笔数 / 已完成完整观察窗的成交笔数，按买入、卖出方向拆分。未满观察窗的成交不进入分母。", source: "on_my_fill 成交价、方向 + 公允价逐 tick 观察" },
    { id: "followLatency", name: "盘口跟随延迟", unit: "ms P95", definition: "公允价变化至新报价确认生效的耗时分布，拆分策略层、对账层、挂撤层。authority_age/account_snapshot_age 是新鲜度，只作辅助，不等同于跟随延迟。", source: "公允价变更链路 + operation_duration_seconds" },
    { id: "supplyConversion", name: "供给有效性", unit: "%", definition: "确认做市成交笔数 / 做市计划挂单笔数，必须按 market-maker role 过滤；按报价档位展示成交笔数占比。不是订单成交率：一张订单可能多次成交。", source: "strategy_planned_orders_total + fills_total（role 过滤）" },
  ] },
  { id: "postmarket", phase: "尾盘 / 盘后", range: "80–100%", goal: "低风险流动性、避免长尾反转、反转时控险", metrics: [
    { id: "reversals", name: "反转次数", unit: "次", definition: "尾盘公允价穿越 0.5 的事件数，按向上、向下拆分；连续停留于 0.5 不重复计数。", source: "公允价逐 tick 变化 + 尾盘阶段判定" },
    { id: "reversalExposure", name: "反转时敞口", unit: "sh", definition: "每次尾盘反转发生时的带符号净库存，展示事件序列及最后一次值；观察反转后是否持续增大、是否衰减。没有反转时无样本。", source: "反转事件时刻的净库存快照" },
    { id: "bookStructure", name: "盘口流动性结构", unit: "ask / bid", definition: "尾盘报价确认时 ask 数量 / bid 数量及 ask 档位数 / bid 档位数，分别展示双边数量和档位占比。分母为 0 时不可算比例，必须标为单边/空盘，不能当成风控有效。", source: "尾盘 _sync_quotes 确认盘口" },
    { id: "reduction", name: "减仓转化", unit: "%", definition: "waiting_result 保守减仓挂单数量 / 生命周期同方向最大净库存，另外展示同期卖向实际成交量。依文档展示挂单比值，不把计划挂单当成实际减仓成功；重复挂单可能使比值 > 100%。", source: "reduce_only_quantity_total、sell fill_quantity_total + 最大净库存" },
  ] },
];

function Definition({ children, text }: { children: React.ReactNode; text: string }) {
  return <span className="review-seven-definition" title={text} aria-description={text} tabIndex={0}>{children}</span>;
}

export function ReviewStageMetrics({ data }: { data: SectionSevenData | null }) {
  return <div className="review-phases">
    {stageMetrics.map((stage, index) => <section className="review-stage-section" id={`review-${stage.id}`} key={stage.id} aria-labelledby={`stage-${stage.id}`}>
      <header className="review-phase-header">
        <span className="review-phase-index">{String(index + 1).padStart(2, "0")}</span>
        <div><small><Definition text={phaseDefinition}>{stage.range} · 交易生命周期</Definition></small><h3 id={`stage-${stage.id}`}>{stage.phase}</h3><p>{stage.goal}</p></div>
      </header>
      <div className="review-seven-grid">
        {stage.metrics.map((metric) => {
          const sample = data?.metrics[metric.id];
          return <article className="review-seven-metric" key={metric.id}>
            <h4><Definition text={`${metric.definition}\n数据来源：${metric.source}`}>{metric.name}</Definition></h4>
            <div className="review-seven-value"><strong>{sample ? Number(sample.value.toFixed(2)) : "待接入"}</strong><small>{sample ? metric.unit : "缺少阶段统计"}</small></div>
            {sample?.observations.length ? <><small className="review-chart-unit">{sample.observationUnit}</small><div className="review-seven-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sample.observations} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#252a33" vertical={false} />
                  <XAxis dataKey="label" stroke="#939daa" tickLine={false} interval={0} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#939daa" tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#11151a", border: "1px solid #39414d", color: "#e4e9ef" }} />
                  <Bar dataKey="value" name={metric.name} fill={index === 0 ? "#ffb020" : index === 1 ? "#4cc9f0" : "#20d49b"} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div></> : <p className="review-seven-empty">{metric.source}</p>}
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}

const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantity = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
type PnlMeasure = "spreadPnl" | "exposurePnl" | "totalPnl";
const pnlLabels: Record<PnlMeasure, string> = { spreadPnl: "点差 PnL", exposurePnl: "敞口 PnL", totalPnl: "总 PnL" };
const pnlDefinitions = {
  spreadPnl: "按已平仓数量匹配买卖均价差的价差收益；不能将全部买卖名义金额相减直接当成已实现点差 PnL。",
  exposurePnl: "按建仓阶段追踪敞口批次的盈亏。多头为（平仓均价或结算价 - 建仓均价）× 数量，反向按相反符号计算。未结算时需一致的估值基准；建仓均价 × 数量本身是成本，不是 PnL。",
  totalPnl: "此表总 PnL = 点差 PnL + 敞口 PnL，按第 7 条两项拆分。费用未单列，不能与不同费用口径的净 PnL 混用。",
};

export function ReviewPnlAnalysis({ data, marketCount }: { data: SectionSevenData | null; marketCount: number }) {
  const [selected, setSelected] = useState<{ phase: ReviewPhase | "合计"; measure: PnlMeasure }>({ phase: "开盘", measure: "totalPnl" });
  const rows = data?.pnl ?? [];
  const total = aggregateLifecyclePnl(rows);
  const filtered = rows.filter((row) => selected.phase === "合计" || row.phase === selected.phase);
  const marketIds = [...new Set(filtered.map((row) => row.marketId))];
  const contributions = marketIds.map((id) => {
    const entries = filtered.filter((row) => row.marketId === id);
    return { id, market: entries[0].market, ...aggregatePnl(entries) };
  }).sort((a, b) => Math.abs(b[selected.measure]) - Math.abs(a[selected.measure]));
  const sumAbsolute = contributions.reduce((sum, row) => sum + Math.abs(row[selected.measure]), 0);
  return <section className="review-domain review-domain-pnl" aria-labelledby="review-pnl-title">
    <div className="review-domain-header">
      <span className="review-domain-icon"><LineChart size={19} /></span>
      <div><p className="section-label">Review Area 03</p><h2 id="review-pnl-title">PnL 分析</h2><small>全部市场 · {rows.length ? new Set(rows.map((row) => row.marketId)).size : marketCount} 个市场</small></div>
    </div>
    <div className="review-pnl-summary">
      {(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <div key={key}><Definition text={pnlDefinitions[key]}>{pnlLabels[key]}</Definition><strong className={rows.length && total[key] < 0 ? "negative" : "positive"}>{rows.length ? money(total[key]) : "待接入"}</strong></div>)}
    </div>
    <div className="review-seven-table-wrap">
      <table className="review-seven-table"><caption><Definition text={phaseDefinition}>阶段 PnL 拆分 · 全部市场</Definition></caption>
        <thead><tr><th>阶段</th>{(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <th key={key}><Definition text={pnlDefinitions[key]}>{pnlLabels[key]}</Definition></th>)}<th>成交量 (USDB)</th><th><Definition text="阶段末每个市场的带符号净敞口之和；合计行取各市场最后阶段，而非相加各阶段。不同市场风险不能互相抵消。">期末净敞口 (sh)</Definition></th><th><Definition text="阶段内各市场最大绝对净敞口之和。合计取各市场全生命周期峰值之和，不是同一时刻的组合风险峰值。">最大敞口 (sh)</Definition></th></tr></thead>
        <tbody>{[...reviewPhases, "合计" as const].map((phase) => {
          const value = phase === "合计" ? total : aggregatePnl(rows.filter((row) => row.phase === phase));
          return <tr key={phase}><th>{phase}</th>{(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <td key={key}><button type="button" disabled={!rows.length} aria-pressed={selected.phase === phase && selected.measure === key} onClick={() => setSelected({ phase, measure: key })} className={`review-pnl-drill ${value[key] < 0 ? "negative" : "positive"}`} aria-label={`查看${phase}${pnlLabels[key]}市场贡献`}>{rows.length ? money(value[key]) : "待接入"}<ChevronDown size={13} /></button></td>)}<td>{rows.length ? quantity(value.volume) : "--"}</td><td>{rows.length ? quantity(value.endingExposure) : "--"}</td><td>{rows.length ? quantity(value.maxExposure) : "--"}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <h3 className="review-pnl-detail-title">{selected.phase} · {pnlLabels[selected.measure]} · 市场贡献</h3>
    {rows.length ? <>
      <div className="review-pnl-contributions">{contributions.map((row) => <div key={row.id}><span title={row.market}>{row.market}</span><div className="review-pnl-bar"><i style={{ width: `${sumAbsolute ? Math.abs(row[selected.measure]) / sumAbsolute * 100 : 0}%`, background: row[selected.measure] < 0 ? "#ff536b" : "#20d49b" }} /></div><strong className={row[selected.measure] < 0 ? "negative" : "positive"}>{money(row[selected.measure])}</strong></div>)}</div>
      <div className="review-seven-table-wrap"><table className="review-seven-table"><caption>敞口来源 · {selected.phase}</caption><thead><tr>{["市场", "建仓阶段", "Outcome", "方向", "数量 (sh)", "建仓均价", "平仓均价 / 结算价", "敞口 PnL"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.flatMap((row) => row.lots.map((lot, index) => <tr key={`${row.marketId}-${row.phase}-${index}`}><th>{row.market}</th><td>{row.phase}</td><td>{lot.outcome}</td><td>{lot.side}</td><td>{quantity(lot.quantity)}</td><td>{lot.entryPrice.toFixed(4)}</td><td>{lot.exitPrice.toFixed(4)}</td><td className={lot.exposurePnl < 0 ? "negative" : "positive"}>{money(lot.exposurePnl)}</td></tr>))}</tbody></table></div>
    </> : <p className="review-seven-empty">待接入全部市场成交历史、阶段归因和敞口批次。当前市场 PnL 不能替代历史阶段拆分。</p>}
  </section>;
}
