import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverReviewContext } from '../app/review-history-context.ts';
import { buildReviewFacts } from '../app/review-facts.ts';
import { mergeReviewObservations } from '../app/review-observations.ts';

const cid = 'market';
const job = {condition_id:cid,job_type:'market_maker',job_id:7,account_id:1,revision:1};
const source = () => Object.fromEntries(['jobs','catalog','decisions','fills'].map(key=>[key,{rows:key==='jobs'?[job]:[],available:true,capped:false}]));
const history = () => ({contract_version:'mm-dashboard-history.v1',items:[{identity:job,lifecycle:{start_time:0,create_time:100,end_time:200}}]});
const observations = () => ({contract_version:'mm-review-observations.v1',items:[{...job,observations:{contract_version:'mm-review-observations.v1',source:'durable_review_aggregates',start_time:100,end_time:200,coverage:{phase_bounds_valid:true,observed_from:110,observed_through:200,saved_capture_count:1},phases:{opening:{observed_seconds:10,risk_share_minutes:2},intraday:{toxicity_pct:50,observed_seconds:30,book_healthy_seconds:20,risk_share_minutes:6}}}}]});

test('ended market restores bounds from archive without modifying cached sources',()=>{
  const s=source();const recovered=recoverReviewContext(cid,s,history(),undefined);
  assert.equal(s.catalog.rows.length,0);assert.equal(recovered.catalog.rows[0].create_time,100);
  const result=buildReviewFacts(cid,recovered,210000);
  mergeReviewObservations(result,observations(),job,{start:100000,end:200000});
  assert.equal(result.section_seven.metrics.toxicity.observations[0].value,50);
  assert.equal(result.section_seven.metrics.exposureTime.value,25);
  assert.ok(!result.coverage.notes.includes('缺少有效市场起止时间'));
});
test('removed jobs and absent archive can recover unique durable identity and bounds',()=>{
  const s=source();s.jobs.rows=[];
  const recovered=recoverReviewContext(cid,s,undefined,observations());
  assert.equal(recovered.jobs.rows[0].job_id,7);assert.equal(recovered.catalog.rows[0].start_time,100);
});
test('other accounts, ambiguous captures and invalid bounds are not guessed',()=>{
  for(const mutate of [o=>o.items[0].account_id=2,o=>o.items.push(o.items[0]),o=>o.items[0].observations.start_time=0,o=>o.items[0].observations.end_time=50]){
    const s=source(),o=observations();mutate(o);
    assert.equal(recoverReviewContext(cid,s,undefined,o).catalog.rows.length,0);
  }
  const s=source(),h=history();h.items[0].identity={...job,condition_id:'other'};
  assert.equal(recoverReviewContext(cid,s,h,undefined),s);
});
test('valid current boundaries stay authoritative and conflicting capture is rejected',()=>{
  const s=source();s.catalog.rows=[{condition_id:cid,start_time:101,end_time:200}];
  assert.equal(recoverReviewContext(cid,s,history(),observations()),s);
  const result=buildReviewFacts(cid,s,210000);
  mergeReviewObservations(result,observations(),job,{start:101000,end:200000});
  assert.equal(result.section_seven.metrics.toxicity,undefined);
});
