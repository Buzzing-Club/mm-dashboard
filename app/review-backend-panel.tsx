"use client";

import type { BackendReview } from './review-backend';

const money = (value: number | null) => value === null ? '无完整数据' : `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}`;
const labels: Record<string,string> = {announcing:'结果提议',dispute1:'第一轮争议',dispute2:'第二轮争议',ruling1:'第一轮裁定',ruling2:'第二轮裁定',claimable:'可领取',none:'交易中'};
function timestamp(value: string) {
  if (!value || value === '0') return '--';
  const ms = /^\d+$/.test(value) ? Number(value)*1000 : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '--';
}

export function ReviewBackendPanel({data}:{data:BackendReview}) {
  return <div className="review-backend-panel">
    <h3>单市场账本与归因 · {data.title}</h3>
    <p className="review-data-coverage">OpenAPI Key 账户 · {data.complete ? '历史分页读取完成' : '部分历史样本'} · {data.fills} 笔撮合 / {data.ledger.rows} 条账本 · {timestamp(data.asOf)} (UTC+8)</p>
    <div className="review-pnl-summary">
      {([['已实现收益',data.ledger.realized,'sell + win/lose 的 realized_pnl；不重复加 claim。已扣费用的收益不再减一次手续费。'],['成交手续费',data.ledger.fees,'buy/sell 账本手续费合计，独立展示，不从已实现收益重复扣除。'],['实际领取',data.ledger.claims,'claim 的 value，表示领取现金，不是新增利润。']] as const).map(([label,value,tip])=><div key={label}><span className="review-seven-definition" title={tip} tabIndex={0}>{label}</span><strong className={value !== null && value < 0 ? 'negative' : ''}>{money(value)}</strong></div>)}
    </div>
    <p className="review-data-coverage">批次前双边盘口 {data.quoteFills} / {data.fills} 笔 · 账户腿盘口覆盖 {data.quotedSelfLegs} / {data.selfLegs} · 分类版本 {data.classificationVersions.join(' / ') || '缺失'}</p>
    <div className="review-seven-table-wrap"><table className="review-seven-table"><caption>阶段归因 · USDB</caption><thead><tr><th>阶段</th><th title="pre_batch mid；仅对有盘口的当前账户成交腿求和，缺少盘口的腿不补 0。">点差 PnL（已覆盖腿）</th><th>盘口覆盖</th><th title="已平仓或结算 FIFO 批次毛收益，按建仓阶段归因；未处置库存不估值。">已处置敞口 PnL</th><th title="按处置时间归入该阶段的账本已实现收益，不是包含浮盈的阶段总 PnL。盘后结算仅计入全生命周期合计。">阶段已实现收益</th></tr></thead><tbody>{data.phases.map(row=><tr key={row.phase}><th>{row.phase}</th><td>{money(row.spread)}</td><td>{row.quotedLegs} / {row.totalLegs}</td><td>{money(row.exposure)}</td><td>{money(row.realized)}</td></tr>)}</tbody></table></div>
    {data.lots.length > 0 && <div className="review-seven-table-wrap review-pnl-lots" role="region" aria-label="已处置敞口批次" tabIndex={0}><table className="review-seven-table"><caption>已处置敞口批次 · FIFO · 最多展示 500 行</caption><thead><tr><th>建仓阶段</th><th>Outcome</th><th>数量 (sh)</th><th>建仓均价</th><th>处置 / 结算价</th><th>毛收益</th></tr></thead><tbody>{data.lots.map((row,i)=><tr key={i}><th>{row.phase}</th><td>{row.outcome}</td><td>{row.quantity.toLocaleString('en-US',{maximumFractionDigits:6})}</td><td>{row.entryPrice.toFixed(4)}</td><td>{row.exitPrice.toFixed(4)}</td><td>{money(row.pnl)}</td></tr>)}</tbody></table></div>}
    <div className="review-settlement"><h3>结算事实</h3><p className="review-data-coverage">Chain ID {data.settlement.chainId || '--'} · 上报状态 {data.settlement.status || '未上报'} · 拆分支出 {money(data.ledger.splits)} · 合并收入 {money(data.ledger.merges)}</p>{data.settlement.tx && <p className="review-settlement-hash">{data.settlement.tx}</p>}
      {data.settlement.timeline.length ? <ol className="review-settlement-events">{data.settlement.timeline.map((event,i)=><li key={i} data-phase={event.phase}><time>{timestamp(event.at)}</time><strong>{labels[event.phase] ?? event.phase}</strong><span>{event.outcome || '--'}</span>{event.tx && <span className="review-settlement-hash">{event.tx}</span>}</li>)}</ol> : <p className="review-data-coverage">暂无结算阶段事件</p>}
    </div>
    <details className="review-data-coverage"><summary>数据口径与覆盖范围</summary>{data.notes.map(note=><p key={note}>{note}</p>)}</details>
  </div>;
}
