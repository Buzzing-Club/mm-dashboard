import assert from 'node:assert/strict';
import test from 'node:test';
import { endedReviewMarkets, isEndedReviewMarket } from '../app/review-market-scope.ts';

const now = Date.parse('2026-09-13T01:00:00Z');
const market = { id: 'test', endAt: '2026-09-13T02:00:00Z', lifecycle: { closed: false, settlementPhase: 'none' } };

test('running, paused and prematurely archived markets are not eligible', () => {
  for (const extra of [{}, {quoteMode:'paused'}, {isHistorical:true}, {lifecycle:{...market.lifecycle,acceptingOrders:false}}]) {
    assert.equal(isEndedReviewMarket({...market,...extra},now),false);
  }
});
test('end boundary admits markets without waiting for archive or chain settlement', () => {
  const ended = {...market,endAt:new Date(now).toISOString()};
  assert.equal(isEndedReviewMarket(ended,now-1),false);
  assert.equal(isEndedReviewMarket(ended,now),true);
  assert.equal(isEndedReviewMarket(ended,now+1),true);
});
test('explicit closure and settlement phases admit early-ended markets', () => {
  assert.equal(isEndedReviewMarket({...market,lifecycle:{closed:true,settlementPhase:'none'}},now),true);
  for (const settlementPhase of ['announcing','ruling1','dispute1','ruling2','dispute2','claimable']) {
    assert.equal(isEndedReviewMarket({...market,lifecycle:{closed:false,settlementPhase}},now),true);
  }
  assert.equal(isEndedReviewMarket({...market,lifecycle:{closed:false,settlementPhase:'unknown'}},now),false);
});
test('missing source end times never use guessed display timestamps', () => {
  for (const reviewEndAt of [null, '', 'invalid', '1970-01-01T00:00:00Z']) {
    assert.equal(isEndedReviewMarket({...market,endAt:'2026-09-12T00:00:00Z',reviewEndAt},now),false);
  }
  assert.equal(isEndedReviewMarket({...market,reviewEndAt:'2026-09-12T00:00:00Z'},now),true);
});
test('review selector and portfolio share a deduplicated ended-only scope', () => {
  const ended = {...market,id:'ended',endAt:'2026-09-12T00:00:00Z'};
  const rows = [ended,market,ended];
  assert.deepEqual(endedReviewMarkets(rows,now),[ended]);
  assert.equal(rows.length,3);
  assert.deepEqual(endedReviewMarkets([market],now),[]);
});
