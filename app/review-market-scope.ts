type ReviewLifecycleMarket = {
  id: string;
  endAt: string;
  reviewEndAt?: string | null;
  lifecycle?: { closed: boolean; settlementPhase: string };
};

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
