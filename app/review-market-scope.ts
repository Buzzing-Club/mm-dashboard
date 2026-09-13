type ReviewLifecycleMarket = {
  id: string;
  endAt: string;
  reviewEndAt?: string | null;
  lifecycle?: { closed: boolean; settlementPhase: string };
};

export type ReviewDateFilter = { mode: 'week' | 'custom' | 'all'; from: string; to: string };
const DAY_MS = 86_400_000;
const OFFSET_MS = 8 * 3_600_000;

// Review dates use the business timezone, independently of the viewer's device.
export function recentReviewDates(now: number): { from: string; to: string } {
  return {
    from: new Date(now - 7 * DAY_MS + OFFSET_MS).toISOString().slice(0, 10),
    to: new Date(now + OFFSET_MS).toISOString().slice(0, 10),
  };
}

function dateBoundary(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const utc = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(utc) && new Date(utc).toISOString().slice(0, 10) === value ? utc - OFFSET_MS : null;
}

export function reviewDateBounds(filter: ReviewDateFilter, now: number): { from: number; through: number } | null {
  if (filter.mode === 'all') return { from: -Infinity, through: Infinity };
  if (filter.mode === 'week') return { from: now - 7 * DAY_MS, through: now };
  const from = dateBoundary(filter.from), end = dateBoundary(filter.to);
  return from === null || end === null || end < from ? null : { from, through: end + DAY_MS };
}

export function filterReviewMarkets<T extends ReviewLifecycleMarket>(markets: T[], filter: ReviewDateFilter, now: number): T[] {
  const bounds = reviewDateBounds(filter, now);
  if (!bounds) return [];
  return endedReviewMarkets(markets, now).filter(market => {
    if (filter.mode === 'all') return true;
    const end = Date.parse(market.reviewEndAt === undefined ? market.endAt : market.reviewEndAt ?? '');
    return Number.isFinite(end) && end > 0 && end >= bounds.from
      && (filter.mode === 'week' ? end <= bounds.through : end < bounds.through);
  });
}

const settlementPhases = new Set(['announcing', 'ruling1', 'dispute1', 'ruling2', 'dispute2', 'claimable']);

export function isEndedReviewMarket(market: ReviewLifecycleMarket, now: number): boolean {
  if (market.lifecycle?.closed || settlementPhases.has(market.lifecycle?.settlementPhase ?? '')) return true;
  // API markets must use the source end time, never the display fallback.
  const end = Date.parse(market.reviewEndAt === undefined ? market.endAt : market.reviewEndAt ?? '');
  return Number.isFinite(end) && end > 0 && end <= now;
}

export function endedReviewMarkets<T extends ReviewLifecycleMarket>(markets: T[], now: number): T[] {
  return [...new Map(markets.map(market => [market.id, market])).values()]
    .filter(market => isEndedReviewMarket(market, now));
}
