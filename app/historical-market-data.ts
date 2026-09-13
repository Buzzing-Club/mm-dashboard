import { finite, map, rows, type Fact } from './review-facts.ts';
import { orderedFacts, raw6, type BackendSource } from './review-backend.ts';

export function historicalQuery(asOf: string | null, window: string | null, now = Date.now()) {
  if (!asOf || !/^\d+$/.test(asOf)) throw new Error('as_of Unix seconds is required');
  const requested = Number(asOf);
  if (!Number.isSafeInteger(requested) || requested < 60 || requested > Math.floor(now / 1000)) throw new Error('invalid historical cutoff');
  // The upstream rounds OUTWARD. End on a completed minute to avoid future data.
  const end = Math.floor(requested / 60) * 60;
  const seconds = window === '15m' ? 900 : window === '4h' ? 14400 : 3600;
  return { requested, end, start: Math.max(1, end - seconds), interval: '1m' };
}

export function historicalTraderCount(source: BackendSource, end: number): number | null {
  if (!source.available || !source.complete || source.versions.length !== 1 || source.versions[0] === 'missing') return null;
  if (source.items.some(row => !row.id || !/^\d+$/.test(String(row.timestamp_ns ?? '')))) return null;
  const users = new Set<string>();
  for (const fill of orderedFacts(source.items, 'id')) {
    if (BigInt(String(fill.timestamp_ns)) >= BigInt(end) * BigInt(1_000_000_000)) continue;
    if (!['init', 'pending', 'success', 'failed', 'settlement_abandoned'].includes(String(fill.status))) return null;
    if (!['init', 'pending', 'success'].includes(String(fill.status))) continue;
    if (typeof fill.exclude_from_net_volume !== 'boolean') return null;
    if (fill.exclude_from_net_volume) continue;
    for (const leg of [map(fill.maker), map(fill.taker)]) {
      if (!['user', 'self', 'internal'].includes(String(leg.account_type))) return null;
      if (leg.account_type !== 'user') continue;
      if (typeof leg.user_ref !== 'string' || !leg.user_ref) return null;
      users.add(leg.user_ref);
    }
  }
  return users.size;
}

export function historicalBusiness(conditionId: string, end: number, history: Fact | null, fills: BackendSource) {
  const valid = history?.condition_id === conditionId && history.amount_unit === 'usdb_raw6';
  const points = valid ? rows(history.points).filter(point => {
    const ts = finite(point.ts);
    return ts !== null && ts > 0 && ts <= end;
  }).sort((a, b) => Number(a.ts) - Number(b.ts)) : [];
  const last = points.at(-1);
  // No final bucket is not a zero balance, nor permission to show a stale total.
  const atCutoff = last && Number(last.ts) === end;
  const gross = atCutoff ? raw6(last.gross_volume_cumulative) : null;
  const net = atCutoff ? raw6(last.net_volume_cumulative) : null;
  const quality = map(history?.quality);
  const pnl = atCutoff && quality.pnl_included === true && quality.truncated !== true ? raw6(last.current_pnl) : null;
  const traderCount = historicalTraderCount(fills, end);
  const washRatio = gross !== null && net !== null && gross > 0 && net >= 0 && net <= gross ? (gross - net) / gross : null;
  const notes = [];
  if (!atCutoff) notes.push('结束时刻历史桶未读取到');
  if (pnl === null) notes.push('历史 PnL 未返回或账本历史不完整');
  if (traderCount === null) notes.push(fills.complete ? '用户身份或成交分类不完整' : '成交历史未完整读取，人数不补零');
  return {
    code: 0, as_of: end, notes,
    data: {
      condition_id: conditionId,
      business: {
        gross_volume: gross === null ? null : last!.gross_volume_cumulative,
        net_volume: net === null ? null : last!.net_volume_cumulative,
        wash_ratio: washRatio, trader_count: traderCount,
      },
      pnl: { current_pnl: pnl === null ? null : last!.current_pnl },
    },
    history: valid ? { code: 0, data: { ...history, points, covered_through: String(end) } } : null,
  };
}
