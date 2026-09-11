"use client";

import { useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aggregateLifecyclePnl, aggregatePnl, marketReviewWindows, phaseDefinition, reviewPhases, type MetricId, type SectionSevenData, type ReviewPhase } from "./review-section-seven-data";

type MetricDefinition = { id: MetricId; name: string; unit: string; definition: string; source: string; example?: string };
export const stageMetrics: Array<{ id: string; phase: string; range: string; goal: string; metrics: MetricDefinition[] }> = [
  { id: "premarket", phase: "开盘", range: "0–20%", goal: "更少风险、更快准确定价、更快库存中性", metrics: [
    { id: "toxicity", name: "开盘毒性率", unit: "%", definition: "阶段内成交后发生不利漂移的确认成交笔数 / 该阶段确认成交笔数；与盘中毒性率并排比较。不利判定遵循 RecentFillToxicity。只统计做市角色，排除刷量成交。", source: "RecentFillToxicity 逐笔判定 + fills_total，按阶段汇总" },
    { id: "exposureTime", name: "风险承担结构", unit: "% 开盘风险占比", definition: "按时间累加 |YES - NO 净库存| × 持有分钟数，得到风险面积（sh·min）。开盘占比 = 开盘风险面积 / 全生命周期风险面积，同时展示三个阶段面积和占比；采样数据只对已覆盖区间计算。", example: "总风险面积 1200 sh·min，开盘 600，则开盘承担 50%；若开盘时长占 20%，风险集中度为均匀承担的 2.5 倍。", source: "库存 q × 观测间隔，按阶段累计" },
    { id: "requoteLatency", name: "报价更新速度", unit: "ms P95", definition: "成交发生到更新后的报价中心确认挂出的端到端耗时分布，比较开盘和盘中 P50/P95。包含成交处理、决策、对账和挂撤单，不用挂撤单耗时代替全链路。", source: "on_my_fill 时间戳 → _sync_quotes 确认" },
    { id: "firstImbalance", name: "库存不平衡发生时间", unit: "% 生命周期", definition: "市场运行期间首次满足 |净仓| > 15 shares 且单边持仓占比 > 90% 的时间，减市场开始时间，再除以市场开始至计划结束的时间跨度；开始时间缺失时使用创建时间。首版固定使用上述阈值；未观测到触发不是 0，显示无样本。", source: "逐 tick 持仓、首次阈值越界时间、市场起止时间" },
  ] },
  { id: "intraday", phase: "盘中", range: "20–80%", goal: "充足流动性、避免不合理波动、快速跟随定价", metrics: [
    { id: "healthyBook", name: "订单簿健全时间占比", unit: "%", definition: "按市场生命周期分桶：各阶段 NORMAL 模式双边有报价的持续时间 / 该阶段时长，整体用总双边时长 / 总生命周期时长；非 NORMAL 不算双边健全，单独展示。未结束市场只统计已运行部分。不能用快照笔数比例代替时长。", example: "10 小时中双边报价 9.7 小时，整体健全率 97%。", source: "覆盖状态持续时间、生命周期和 NORMAL 模式历史" },
    { id: "levelsConsumed", name: "用户单笔吃单的平均档位数", unit: "档", definition: "逐笔用户吃单穿过的报价档位数的平均值，并展示档位分布。通过成交价、中心 r、档距 delta 与档数推算；排除 TradeVolume 钱包成交。", source: "用户成交记录 + 当时的报价梯度参数" },
    { id: "recross", name: "回摆率", unit: "%", definition: "成交后 60 秒内公允价回穿成交价的成交笔数 / 已完成完整观察窗的成交笔数，按买入、卖出方向拆分。未满观察窗的成交不进入分母。", source: "on_my_fill 成交价、方向 + 公允价逐 tick 观察" },
    { id: "followLatency", name: "盘口跟随延迟", unit: "ms P95", definition: "公允价变化至新报价确认生效的耗时分布，拆分策略层、对账层、挂撤层。authority_age/account_snapshot_age 是新鲜度，只作辅助，不等同于跟随延迟。", source: "公允价变更链路 + operation_duration_seconds" },
    { id: "supplyConversion", name: "供给有效性", unit: "%", definition: "同市场、同阶段的确认做市成交笔数 / 完整做市计划挂单计数，按 market-maker role 过滤；按档位展示成交分布。MM 当前计划计数在语义变化时增加；最近审计有条数上限且可能丢弃，不能直接代替该阶段完整计数。一张订单多次成交按多笔计，不是唯一订单成交率。", example: "同期 1000 笔计划挂单、30 笔确认成交，则为 3%。", source: "同市场阶段 strategy_planned_orders_total + fills_total 增量，排除 TradeVolume" },
  ] },
  { id: "postmarket", phase: "尾盘 / 盘后", range: "80–100%", goal: "低风险流动性、避免长尾反转、反转时控险", metrics: [
    { id: "reversals", name: "反转次数", unit: "次", definition: "尾盘公允价穿越 0.5 的事件数，按向上、向下拆分；连续停留于 0.5 不重复计数。", source: "公允价逐 tick 变化 + 尾盘阶段判定" },
    { id: "reversalExposure", name: "反转时敞口", unit: "sh", definition: "每次尾盘反转发生时的带符号净库存，展示事件序列及最后一次值；观察反转后是否持续增大、是否衰减。没有反转时无样本。", source: "反转事件时刻的净库存快照" },
    { id: "bookStructure", name: "盘口流动性结构", unit: "YES ask / bid", definition: "按 YES/NO 分别计算尾盘已确认订单剩余 Ask/Bid 数量和不同价格档位数，并展示各自在双边合计中的占比。不能混合互补 outcome。零侧代表单边/空盘，比例方向必须结合结算方向，不存在一概越大或越小越好的规则。", example: "同一 outcome Ask 80、Bid 10，则数量比 8:1，占比 88.89%/11.11%；6 个 Ask 价位、1 个 Bid 价位则档位比 6:1。", source: "尾盘确认订单的 outcome、side、price、qty、filled_qty" },
    { id: "reduction", name: "减仓转化 · 持仓残留率", unit: "%", definition: "waiting_result 阶段剩余净库存绝对值 / 生命周期内同方向最大净库存。净 YES 为正、净 NO 为负，按剩余方向选峰值；不是减仓挂单量、卖出成交量或 1 减此比值。越接近 0 残留越少，接近 100% 表示减仓未走通。", example: "剩余 NO 15 shares，同方向峰值 45，残留率 33.33%；剩余 35 则为 77.78%。", source: "waiting_result 库存 + 同账户同市场生命周期库存峰值" },
  ] },
];

function Definition({ children, text }: { children: React.ReactNode; text: string }) {
  return <span className="review-seven-definition" title={text} aria-description={text} tabIndex={0}>{children}</span>;
}

export function ReviewStageMetrics({ data, startAt, endAt }: { data: SectionSevenData | null; startAt: string; endAt: string }) {
  const windows = marketReviewWindows(startAt, endAt);
  const formatTime = (value: number) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  return <div className="review-phases">
    {stageMetrics.map((stage, index) => <section className="review-stage-section" id={`review-${stage.id}`} key={stage.id} aria-labelledby={`stage-${stage.id}`}>
      <header className="review-phase-header">
        <span className="review-phase-index">{String(index + 1).padStart(2, "0")}</span>
        <div><small><Definition text={`${phaseDefinition}\n${windows ? `阶段时间（UTC+8）：${formatTime(windows[index].start)} 至 ${formatTime(windows[index].end)}` : "市场起止时间待补充"}`}>{stage.range} · 市场生命周期</Definition></small><h3 id={`stage-${stage.id}`}>{stage.phase}</h3><p>{stage.goal}</p></div>
      </header>
      <div className="review-seven-grid">
        {stage.metrics.map((metric) => {
          const sample = data?.metrics[metric.id];
          return <article className="review-seven-metric" key={metric.id}>
            <div className="review-metric-heading">
            <h4><Definition text={`${metric.definition}${metric.example ? `\n举例：${metric.example}` : ""}\n数据来源：${metric.source}`}>{metric.name}</Definition></h4>
            <div className="review-seven-value"><strong>{sample?.value != null ? Number(sample.value.toFixed(2)) : sample ? "不可计算" : "待接入"}</strong><small>{sample ? metric.unit : "缺少阶段统计"}</small></div>
            {sample?.note && <p className="review-data-coverage" title={sample.note}>{sample.precision === "sampled" ? "采样估算 · " : ""}{sample.note}</p>}
            </div>
            <div className={`review-metric-plots${sample?.exposureSeries?.length ? " paired" : ""}`}>
            {sample?.exposureSeries?.length ? <><small className="review-chart-unit">|净敞口| (shares) · 空缺区间不连线</small><div className="review-seven-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={sample.exposureSeries} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}><CartesianGrid stroke="#252a33" vertical={false} /><XAxis dataKey="at" type="number" domain={windows ? [windows[0].start, windows[2].end] : ["dataMin", "dataMax"]} tickFormatter={value => new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })} stroke="#939daa" tickLine={false} minTickGap={20} tick={{ fontSize: 11 }} /><YAxis width={42} stroke="#939daa" axisLine={false} tickLine={false} tickCount={4} tick={{ fontSize: 11 }} /><Tooltip labelFormatter={value => formatTime(Number(value))} contentStyle={{ background: "#11151a", border: "1px solid #39414d" }} /><Area type="stepAfter" dataKey="value" name="净敞口绝对值" stroke="#ffb020" fill="#ffb020" fillOpacity={0.16} connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></> : null}
            {sample?.observations.length ? <><small className="review-chart-unit">{sample.observationUnit}</small><div className="review-seven-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sample.observations} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barCategoryGap="28%" maxBarSize={40}>
                  <CartesianGrid stroke="#252a33" vertical={false} />
                  <XAxis dataKey="label" stroke="#939daa" tickLine={false} interval="preserveStartEnd" minTickGap={12} tick={{ fontSize: 11 }} />
                  <YAxis width={42} stroke="#939daa" axisLine={false} tickLine={false} tickCount={4} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "#ffffff", fillOpacity: 0.04 }} contentStyle={{ background: "#11151a", border: "1px solid #39414d", color: "#e4e9ef" }} />
                  <Bar dataKey="value" name={metric.name} fill={index === 0 ? "#ffb020" : index === 1 ? "#4cc9f0" : "#20d49b"} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div></> : <p className="review-seven-empty">{data?.unavailable?.[metric.id] ?? metric.source}</p>}
            </div>
            {sample?.details?.length ? <dl className="review-metric-details">{sample.details.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value === null ? "无样本" : `${Number(item.value.toFixed(2))} ${item.unit}`}</dd></div>)}</dl> : null}
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}

const money = (value: number | null) => value === null ? "待接入" : `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantity = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
type PnlMeasure = "spreadPnl" | "exposurePnl" | "totalPnl";
const pnlLabels: Record<PnlMeasure, string> = { spreadPnl: "点差 PnL", exposurePnl: "敞口 PnL", totalPnl: "总 PnL" };
const pnlDefinitions = {
  spreadPnl: "按成交时同 outcome 的 mid 计算：买入 (mid - 成交价) × 数量，卖出 (成交价 - mid) × 数量，再按成交所在市场阶段相加。例：买入 10 shares，成交价 0.48、mid 0.50，点差 PnL 为 +0.20 USDB。不是已平仓买卖均价差；缺成交时 mid 不估造。",
  exposurePnl: "按建仓阶段追踪敞口批次的盈亏。多头为（平仓均价或结算价 - 建仓均价）× 数量，反向按相反符号计算。未结算时需一致的估值基准；建仓均价 × 数量本身是成本，不是 PnL。",
  totalPnl: "总 PnL 由成交现金流、费用与结算记录独立还原，不能将点差捕获和按成本计算的敞口收益直接相加，二者可能重叠。展示归因差额 = 总 PnL - 点差 PnL - 敞口 PnL，避免强行凑平。当前账户 PnL 不代替阶段历史。",
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
  }).sort((a, b) => Math.abs(b[selected.measure] ?? 0) - Math.abs(a[selected.measure] ?? 0));
  const maxAbsolute = Math.max(0, ...contributions.map((row) => Math.abs(row[selected.measure] ?? 0)));
  return <section className="review-domain review-domain-pnl" aria-labelledby="review-pnl-title">
    <div className="review-domain-header">
      <span className="review-domain-icon"><LineChart size={19} /></span>
      <div><p className="section-label">Review Area 03</p><h2 id="review-pnl-title">PnL 分析</h2><small>全部市场 · {rows.length ? new Set(rows.map((row) => row.marketId)).size : marketCount} 个市场</small></div>
    </div>
    <div className="review-pnl-summary">
      {(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <div key={key}><Definition text={pnlDefinitions[key]}>{pnlLabels[key]}</Definition><strong className={rows.length && (total[key] ?? 0) < 0 ? "negative" : "positive"}>{rows.length ? money(total[key]) : "待接入"}</strong></div>)}
    </div>
    {rows.length > 0 && total.totalPnl !== null && <p className="review-data-coverage"><Definition text={pnlDefinitions.totalPnl}>归因差额</Definition> {money(total.totalPnl - total.spreadPnl - total.exposurePnl)}</p>}
    <div className="review-seven-table-wrap">
      <table className="review-seven-table"><caption><Definition text={phaseDefinition}>阶段 PnL 拆分 · 全部市场</Definition></caption>
        <thead><tr><th>阶段</th>{(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <th key={key}><Definition text={pnlDefinitions[key]}>{pnlLabels[key]}</Definition></th>)}<th><Definition text="从市场开始累计到本阶段截止的成交额；合计取每个市场最后阶段值，不能把三阶段累计值再相加。">截至阶段成交量 (USDB)</Definition></th><th><Definition text="阶段末每个市场的带符号净敞口之和；合计行取各市场最后阶段，而非相加各阶段。不同市场风险不能互相抵消。">期末净敞口 (sh)</Definition></th><th><Definition text="各市场从开始累计到本阶段截止的最大绝对净敞口之和。合计取各市场生命周期峰值之和，不是同一时刻的组合风险峰值。">截至阶段最大敞口 (sh)</Definition></th></tr></thead>
        <tbody>{[...reviewPhases, "合计" as const].map((phase) => {
          const value = phase === "合计" ? total : aggregatePnl(rows.filter((row) => row.phase === phase));
          return <tr key={phase}><th>{phase}</th>{(Object.keys(pnlLabels) as PnlMeasure[]).map((key) => <td key={key}><button type="button" disabled={!rows.length || value[key] === null} aria-pressed={selected.phase === phase && selected.measure === key} onClick={() => setSelected({ phase, measure: key })} className={`review-pnl-drill ${(value[key] ?? 0) < 0 ? "negative" : "positive"}`} aria-label={`查看${phase}${pnlLabels[key]}市场贡献`}>{rows.length ? money(value[key]) : "待接入"}<ChevronDown size={13} /></button></td>)}<td>{rows.length ? quantity(value.volume) : "--"}</td><td>{rows.length ? quantity(value.endingExposure) : "--"}</td><td>{rows.length ? quantity(value.maxExposure) : "--"}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <h3 className="review-pnl-detail-title">{selected.phase} · {pnlLabels[selected.measure]} · 市场贡献</h3>
    {rows.length ? <>
      <div className="review-pnl-contributions">{contributions.map((row) => <div key={row.id}><span title={row.market}>{row.market}</span><div className="review-pnl-bar" title={`零轴居中；左右共用刻度 ±${money(maxAbsolute)}，按当前列表最大绝对值缩放`}><i style={{ width: `${maxAbsolute ? Math.abs(row[selected.measure] ?? 0) / maxAbsolute * 50 : 0}%`, left: (row[selected.measure] ?? 0) < 0 ? undefined : "50%", right: (row[selected.measure] ?? 0) < 0 ? "50%" : undefined, background: (row[selected.measure] ?? 0) < 0 ? "#ff536b" : "#20d49b" }} /></div><strong className={(row[selected.measure] ?? 0) < 0 ? "negative" : "positive"}>{money(row[selected.measure])}</strong></div>)}</div>
      <div className="review-seven-table-wrap review-pnl-lots" role="region" aria-label={`敞口来源 · ${selected.phase}`} tabIndex={0}><table className="review-seven-table"><caption>敞口来源 · {selected.phase}</caption><thead><tr>{["市场", "建仓阶段", "Outcome", "方向", "数量 (sh)", "建仓均价", "平仓均价 / 结算价", "敞口 PnL"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.flatMap((row) => row.lots.map((lot, index) => <tr key={`${row.marketId}-${row.phase}-${index}`}><th>{row.market}</th><td>{row.phase}</td><td>{lot.outcome}</td><td>{lot.side}</td><td>{quantity(lot.quantity)}</td><td>{lot.entryPrice.toFixed(4)}</td><td>{lot.exitPrice.toFixed(4)}</td><td className={lot.exposurePnl < 0 ? "negative" : "positive"}>{money(lot.exposurePnl)}</td></tr>))}</tbody></table></div>
    </> : <p className="review-seven-empty">待接入全部市场成交历史、阶段归因和敞口批次。当前市场 PnL 不能替代历史阶段拆分。</p>}
  </section>;
}
