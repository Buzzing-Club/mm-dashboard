import { finite, map, type Fact } from './review-facts.ts';
import { orderedFacts, type BackendSource } from './review-backend.ts';

const accepted = new Set(['init', 'pending', 'success']);
const known = new Set([...accepted, 'failed', 'settlement_abandoned']);
const SCALE = BigInt('1000000000000000000');

function priceUnits(value: unknown): bigint | null {
  const match = /^(\d*)(?:\.(\d{1,18}))?$/.exec(String(value ?? ''));
  if (!match || (!match[1] && !match[2])) return null;
  const units = BigInt(match[1] || '0') * SCALE + BigInt((match[2] ?? '').padEnd(18, '0'));
  return units > BigInt(0) && units <= SCALE ? units : null;
}

export function historicalSlippage(source: BackendSource, end: number) {
  const empty = (note: string) => ({ reference: 'taker_first_fill_l1', avg_trade_slippage: null,
    sample_count: 0, distribution: null, note });
  if (!source.available || !source.complete || source.versions.length !== 1 || source.versions[0] === 'missing') {
    return empty('滑点成交历史或分类未完整读取，不补零');
  }
  const groups = new Map<string, Fact[]>();
  for (const fill of orderedFacts(source.items, 'id')) {
    if (!fill.id || !/^\d+$/.test(String(fill.timestamp_ns ?? '')) || !known.has(String(fill.status))) {
      return empty('滑点成交字段不完整');
    }
    if (BigInt(String(fill.timestamp_ns)) >= BigInt(end) * BigInt(1_000_000_000)) continue;
    if (typeof fill.exclude_from_net_volume !== 'boolean') return empty('滑点成交分类缺失');
    const taker = map(fill.taker);
    if (typeof taker.order_ref !== 'string' || !taker.order_ref) {
      if (accepted.has(String(fill.status)) && !fill.exclude_from_net_volume) return empty('滑点订单归组缺失');
      continue;
    }
    const group = groups.get(taker.order_ref) ?? [];
    group.push(fill);
    groups.set(taker.order_ref, group);
  }
  const samples: bigint[] = [];
  for (const group of groups.values()) {
    const net = group.filter(fill => accepted.has(String(fill.status)) && !fill.exclude_from_net_volume);
    if (!net.length) continue;
    // A cut-off or partial order must not create an artificial first-fill reference.
    const count = finite(group[0].order_fill_count);
    const indexes = group.map(fill => finite(fill.level_index));
    if (count !== group.length || group.some(fill => finite(fill.order_fill_count) !== count)
      || new Set(indexes).size !== count || indexes.some(index => index === null || !Number.isInteger(index) || index < 1 || index > count)) {
      return empty('滑点订单成交未完整覆盖历史截止时刻');
    }
    const valid = group.filter(fill => accepted.has(String(fill.status)));
    const takers = valid.map(fill => map(fill.taker));
    const side = takers[0].side;
    const prices = takers.map(taker => priceUnits(taker.price));
    if (!['buy', 'sell'].includes(String(side)) || takers.some(taker => taker.side !== side || taker.outcome !== takers[0].outcome)
      || prices.some(price => price === null)) return empty('滑点价格或买卖方向缺失');
    // Match trade-service: BUY min / SELL max over all accepted fills, then mean net-fill absolute price gaps.
    const reference = (prices as bigint[]).reduce((best, price) => side === 'sell' ? (price > best ? price : best) : (price < best ? price : best));
    for (const fill of net) {
      const price = priceUnits(map(fill.taker).price)!;
      samples.push(side === 'sell' ? reference - price : price - reference);
    }
  }
  if (!samples.length) return empty('无有效净成交滑点样本；内部流量不计入，不补零');
  const distribution = ['0-1c', '1-3c', '3-5c', '>5c'].map(bucket => ({ bucket, trade_count: 0 }));
  for (const value of samples) distribution[value < SCALE / BigInt(100) ? 0 : value < BigInt(3) * SCALE / BigInt(100) ? 1 : value < BigInt(5) * SCALE / BigInt(100) ? 2 : 3].trade_count++;
  return { reference: 'taker_first_fill_l1', avg_trade_slippage: Number(samples.reduce((sum, value) => sum + value, BigInt(0))) / Number(SCALE) / samples.length,
    sample_count: samples.length, distribution, note: `滑点：截至历史截止时刻的 ${samples.length} 笔净成交，按笔平均第一档成交参考价的不利绝对价差（非相对 mid）` };
}
