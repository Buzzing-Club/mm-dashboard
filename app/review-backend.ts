import { marketReviewWindows, reviewPhases, tradeSpreadPnl, type SectionSevenMetric } from './review-section-seven-data.ts';
import { epochMs, finite, map, rows, type Fact } from './review-facts.ts';

export type BackendSource = { items: Fact[]; available: boolean; complete: boolean; versions: string[]; error?: string };
export type BackendReviewInput = { conditionId: string; market: Fact; fills: BackendSource; ledger: BackendSource; now: number };
export type BackendReview = {
  conditionId: string; title: string; asOf: string;
  complete: boolean; notes: string[]; classificationVersions: string[];
  fills: number; userOrders: number; quoteFills: number; selfLegs: number; quotedSelfLegs: number;
  levelsMetric: SectionSevenMetric | null;
  ledger: { rows: number; realized: number | null; fees: number | null; claims: number | null; splits: number | null; merges: number | null };
  phases: Array<{ phase: string; spread: number | null; quotedLegs: number; totalLegs: number; exposure: number | null; realized: number | null }>;
  lots: Array<{ phase: string; outcome: string; quantity: number; entryPrice: number; exitPrice: number; pnl: number }>;
  settlement: { chainId: string; status: string; tx: string; timeline: Array<{ at: string; phase: string; outcome: string; tx: string }> };
};

const text = (value: unknown) => String(value ?? '');
export function raw6(value: unknown): number | null {
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n / 1e6 : null;
}
const ns = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
const at = (row: Fact) => ns(row.timestamp_ns) === null ? null : Number(ns(row.timestamp_ns)! / BigInt(1_000_000));
export function orderedFacts(items: Fact[], key: string): Fact[] {
  const unique = new Map(items.filter(row => row[key] && ns(row.timestamp_ns) !== null).map(row => [text(row[key]), row]));
  return [...unique.values()].sort((a, b) => {
    const left = ns(a.timestamp_ns)!, right = ns(b.timestamp_ns)!;
    return left < right ? -1 : left > right ? 1 : text(a[key]).localeCompare(text(b[key]), 'en', { numeric: true });
  });
}

// Quotes are denominated in the taker's outcome. Complementary maker legs
// must use 1-mid, while price and quantity remain that leg's own values.
export function legSpread(fill: Fact, leg: Fact): number | null {
  const quote = map(fill.quote), taker = map(fill.taker);
  const mid = finite(quote.mid), price = finite(leg.price), quantity = raw6(fill.quantity);
  if (quote.has_quote !== true || quote.reference_timing !== 'pre_batch' || mid === null || mid <= 0 || mid >= 1 || price === null || price < 0 || price > 1 || quantity === null || quantity <= 0) return null;
  if (!['yes', 'no'].includes(text(leg.outcome)) || !['yes', 'no'].includes(text(taker.outcome)) || !['buy', 'sell'].includes(text(leg.side))) return null;
  return tradeSpreadPnl(leg.side === 'buy' ? 'BUY' : 'SELL', price, leg.outcome === taker.outcome ? mid : 1 - mid, quantity);
}

export function buildBackendReview(input: BackendReviewInput): BackendReview {
  const { conditionId, market: detail, now } = input;
  const market = map(detail.market), event = map(detail.event), settlement = map(detail.settlement);
  const start = epochMs(market.start_time) ?? epochMs(event.start_date) ?? epochMs(market.create_time) ?? epochMs(event.create_time);
  const end = epochMs(market.market_end_date) ?? epochMs(event.end_date);
  const windows = start !== null && end !== null ? marketReviewWindows(new Date(start).toISOString(), new Date(end).toISOString()) : null;
  const phaseAt = (ts: number) => windows?.findIndex((window, index) => ts >= window.start && (ts < window.end || index === 2 && ts === window.end)) ?? -1;
  const fills = orderedFacts(input.fills.items, 'id').filter(row => ['init', 'pending', 'success'].includes(text(row.status)) && at(row)! < now);
  const ledger = orderedFacts(input.ledger.items, 'entry_id').filter(row => text(row.condition_id).toLowerCase() === conditionId.toLowerCase() && at(row)! < now && row.status === 'success');
  const ledgerValid = input.ledger.items.every(row => row.entry_id && ns(row.timestamp_ns) !== null && text(row.condition_id).toLowerCase() === conditionId.toLowerCase() && ['success','failed','pending','init','settlement_abandoned'].includes(text(row.status)));
  const phases = reviewPhases.map(phase => ({ phase: String(phase), spread: null as number | null, quotedLegs: 0, totalLegs: 0, exposure: null as number | null, realized: null as number | null }));
  const notes = ['账户收益仅对应当前 OpenAPI Key，包含其内部成交；不等于全市场收益，也不能据此区分该账户的 MM 与刷量角色。', '点差使用 pre_batch 批次落库前盘口；旧成交、单边簿和缺失 mid 不补 0。'];
  if (!windows) notes.push('缺少有效市场起止时间，阶段归因不可用。');
  for (const [label, source] of [['撮合', input.fills], ['账本', input.ledger]] as const) {
    if (!source.available) notes.push(`${label}接口不可用：${source.error ?? '请求失败'}`);
    else if (!source.complete) notes.push(`${label}读取未覆盖完整历史；仅展示已读取样本，不能当作完整生命周期结果。`);
  }
  if (input.fills.versions.length !== 1) notes.push('成交分类版本缺失或分页期间发生变化，用户吃单统计不可用。');
  const sums = phases.map(() => 0);
  let selfLegs = 0, quotedSelfLegs = 0;
  for (const fill of fills) {
    const phase = phaseAt(at(fill)!);
    for (const leg of [map(fill.taker), map(fill.maker)].filter(leg => leg.account_type === 'self')) {
      selfLegs++;
      const spread = legSpread(fill, leg);
      if (spread !== null) quotedSelfLegs++;
      if (phase < 0) continue;
      phases[phase].totalLegs++;
      if (spread !== null) { phases[phase].quotedLegs++; sums[phase] += spread; }
    }
  }
  phases.forEach((phase, i) => { if (phase.quotedLegs > 0) phase.spread = sums[i]; });

  // Count each taker order once, not once per fill. Only its first matching
  // event defines the stage; never move an order to a later stage/page.
  const orders = new Map<string, Fact[]>();
  for (const fill of fills) {
    const taker = map(fill.taker);
    if (fill.exclude_from_net_volume !== false || fill.wash_flag !== 'none' || taker.account_type !== 'user' || !taker.user_ref || !taker.order_ref) continue;
    const key = `${taker.user_ref}:${taker.order_ref}`;
    const group = orders.get(key) ?? [];
    group.push(fill); orders.set(key, group);
  }
  const orderSamples = [...orders.values()].flatMap(group => {
    const first = group.find(row => row.level_index === 1);
    const levels = finite(first?.consumed_levels), count = finite(first?.order_fill_count);
    if (!first || !levels || !count || !Number.isInteger(levels) || !Number.isInteger(count) || levels > count || group.length !== count || new Set(group.map(row => row.level_index)).size !== count || group.some(row => finite(row.consumed_levels) !== levels || finite(row.order_fill_count) !== count)) return [];
    return [{ phase: phaseAt(at(first)!), levels }];
  });
  const intraday = orderSamples.filter(order => order.phase === 1);
  const distribution = new Map<number, number>();
  intraday.forEach(order => distribution.set(order.levels, (distribution.get(order.levels) ?? 0) + 1));
  const levelsMetric: SectionSevenMetric | null = windows && input.fills.versions.length === 1 && intraday.length ? {
    value: intraday.reduce((sum, order) => sum + order.levels, 0) / intraday.length,
    precision: 'sampled', observationUnit: '用户吃单数（每单一次）',
    observations: [...distribution].sort(([a], [b]) => a - b).map(([level, value]) => ({label: `${level} 档`, value})),
    note: `后端 consumed_levels；${intraday.length} 个完整用户 taker 订单，按首笔撮合归入盘中。排除 wash/internal/self；未完整读取的订单不计。`,
    details: [{label:'完整用户吃单',value:intraday.length,unit:'单'}],
  } : null;

  const summary = { rows: ledger.length, realized: null as number | null, fees: null as number | null, claims: null as number | null, splits: null as number | null, merges: null as number | null };
  const realizedRows = ledger.filter(row => ['sell', 'win', 'lose'].includes(text(row.type)));
  const sumRaw = (items: Fact[], field: string) => items.every(row => raw6(row[field]) !== null) ? items.reduce((sum, row) => sum + raw6(row[field])!, 0) : null;
  if (!ledgerValid) notes.push('账本存在缺失身份、时间或未知状态的记录，无法确认完整收益。');
  if (input.ledger.available && input.ledger.complete && ledgerValid) {
    summary.realized = sumRaw(realizedRows, 'realized_pnl');
    summary.fees = sumRaw(ledger.filter(row => ['buy', 'sell'].includes(text(row.type))), 'fee_amount');
    summary.claims = sumRaw(ledger.filter(row => row.type === 'claim'), 'value');
    summary.splits = sumRaw(ledger.filter(row => row.type === 'split'), 'value');
    summary.merges = sumRaw(ledger.filter(row => row.type === 'merge'), 'value');
    if (windows) phases.forEach((phase, index) => { if (windows[index].start < now) phase.realized = sumRaw(realizedRows.filter(row => phaseAt(at(row)!) === index), 'realized_pnl'); });
  }

  const lots: BackendReview['lots'] = [];
  type Lot = { phase: number; outcome: string; quantity: number; price: number };
  const inventory = new Map<string, Lot[]>();
  let reliable = input.ledger.available && input.ledger.complete && ledgerValid && !!windows;
  for (const row of ledger) {
    const type = text(row.type);
    if (type === 'claim') continue;
    if (!['buy', 'sell', 'win', 'lose', 'split', 'merge'].includes(type)) { reliable = false; continue; }
    const quantity = raw6(row.quantity), price = finite(row.price), outcome = text(row.outcome);
    if (!row.position_id || !['yes', 'no'].includes(outcome) || !row.ownership_type || quantity === null || quantity < 0 || price === null || price < 0 || price > 1) { reliable = false; continue; }
    const key = [row.position_id, row.ownership_type, row.funding_account_type ?? '', row.funding_account_id ?? ''].join(':');
    const pool = inventory.get(key) ?? [];
    if (type === 'buy' || type === 'split') {
      pool.push({phase:phaseAt(at(row)!),outcome,quantity,price});
    } else {
      let remaining = quantity;
      while (remaining > 1e-9 && pool.length) {
        const lot = pool[0], used = Math.min(lot.quantity, remaining);
        if (lot.phase < 0) reliable = false;
        else lots.push({phase:reviewPhases[lot.phase],outcome:lot.outcome.toUpperCase(),quantity:used,entryPrice:lot.price,exitPrice:price,pnl:(price-lot.price)*used});
        remaining -= used; lot.quantity -= used;
        if (lot.quantity < 1e-9) pool.shift();
      }
      if (remaining > 1e-9) reliable = false;
    }
    inventory.set(key, pool);
  }
  if (reliable && lots.length) phases.forEach((phase,index) => { if (windows![index].start < now) phase.exposure = lots.filter(lot => lot.phase === phase.phase).reduce((sum, lot) => sum + lot.pnl, 0); });
  if (!reliable) notes.push('敞口 FIFO 批次无法完整配对（历史截断、库存来源或资金归属缺失），不输出伪造归因。');
  notes.push('敞口归因按建仓阶段追踪已平仓/结算批次，使用 FIFO 毛收益，不包含尚未处置库存；后台账本使用含费加权平均成本，两者不是同一口径。', '已实现收益 = sell + win/lose 的 realized_pnl；claim 不重复计收益。阶段已实现按处置发生阶段归属，盘后结算只进入全生命周期合计。尚未实现收益不按阶段估造。');
  return {
    conditionId,title:text(market.question || event.title || conditionId),asOf:new Date(now).toISOString(),
    complete:input.fills.complete && input.ledger.complete, notes,classificationVersions:input.fills.versions,
    fills:fills.length,userOrders:orderSamples.length,quoteFills:fills.filter(row => map(row.quote).has_quote === true && finite(map(row.quote).mid) !== null).length,selfLegs,quotedSelfLegs,
    levelsMetric,ledger:summary,phases,lots:reliable ? lots.slice(0,500) : [],
    settlement:{chainId:text(settlement.chain_id),status:text(settlement.report_status),tx:text(settlement.report_tx_hash),timeline:rows(settlement.timeline).slice(-100).map(row=>({at:text(row.created_at),phase:text(row.to_settlement_phase),outcome:text(row.outcome),tx:text(row.report_tx_hash)}))},
  };
}
