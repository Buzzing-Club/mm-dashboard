import assert from 'node:assert/strict';
import test from 'node:test';
import { recentReviewDates, filterReviewMarkets, reviewDateBounds, endedReviewMarkets, isEndedReviewMarket } from '../app/review-market-scope.ts';

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

test('recent seven days look backwards across Monday and year boundaries in UTC+8', () => {
  assert.deepEqual(recentReviewDates(Date.parse('2026-09-13T15:59:59Z')), {from:'2026-09-06',to:'2026-09-13'});
  assert.deepEqual(recentReviewDates(Date.parse('2026-09-13T16:00:00Z')), {from:'2026-09-07',to:'2026-09-14'});
  assert.deepEqual(recentReviewDates(Date.parse('2027-01-01T00:00:00Z')), {from:'2026-12-25',to:'2027-01-01'});
});

test('rolling window covers exactly 168 hours through now, including both boundaries', () => {
  const current = Date.parse('2026-09-14T06:23:45Z');
  const start = current - 7 * 86_400_000;
  const filter = {mode:'week',from:'2000-01-01',to:'2099-01-01'};
  assert.deepEqual(reviewDateBounds(filter,current),{from:start,through:current});
  const rows = [start-1,start,current-1,current,current+1].map((at,i)=>({
    ...market,id:String(i),endAt:new Date(at).toISOString(),lifecycle:{closed:true,settlementPhase:'none'},
  }));
  assert.deepEqual(filterReviewMarkets(rows,filter,current),rows.slice(1,4));
  assert.deepEqual(reviewDateBounds(filter,current+1000),{from:start+1000,through:current+1000});
});

test('range admits by source end, retaining full long-running market data', () => {
  const old = {...market,id:'old',endAt:'2026-09-06T15:59:59Z'};
  const first = {...market,id:'first',startAt:'2026-08-01T00:00:00Z',endAt:'2026-09-06T16:00:00Z',series:[{at:'2026-08-01T00:00:00Z'}]};
  const last = {...market,id:'last',endAt:'2026-09-13T15:59:59Z'};
  const next = {...market,id:'next',endAt:'2026-09-13T16:00:00Z'};
  const rows = [old,first,last,next];
  const selected = filterReviewMarkets(rows,{mode:'custom',from:'2026-09-07',to:'2026-09-13'},Date.parse('2026-09-15T00:00:00Z'));
  assert.deepEqual(selected,[first,last]);
  assert.strictEqual(selected[0],first);
  assert.equal(selected[0].series.length,1);
  assert.equal(rows.length,4);
});

test('empty/invalid ranges fail closed; all history is not deleted by date selection', () => {
  for (const [from,to] of [['','2026-09-13'],['2026-02-30','2026-09-13'],['2026-09-14','2026-09-13']]) {
    assert.equal(reviewDateBounds({mode:'custom',from,to},now),null);
  }
  const old = {...market,endAt:'2025-01-01T00:00:00Z'};
  assert.deepEqual(filterReviewMarkets([old],{mode:'week',from:'',to:''},now),[]);
  assert.deepEqual(filterReviewMarkets([old],{mode:'all',from:'',to:''},now),[old]);
  const unknown = {...market,reviewEndAt:null,lifecycle:{closed:true,settlementPhase:'none'}};
  assert.deepEqual(filterReviewMarkets([unknown],{mode:'week',from:'',to:''},now),[]);
  assert.deepEqual(filterReviewMarkets([unknown],{mode:'all',from:'',to:''},now),[unknown]);
});
