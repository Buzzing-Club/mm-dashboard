import assert from 'node:assert/strict';
import test from 'node:test';
import {mergeReviewObservations} from '../app/review-observations.ts';
const payload=()=>({condition_id:'a',section_seven:{metrics:{},pnl:null},coverage:{notes:[]}});
const bounds={start:100000,end:200000};
const job={account_id:1,revision:2};
const capture=()=>({contract_version:'mm-review-observations.v1',items:[{condition_id:'a',account_id:1,revision:2,job_type:'market_maker',observation_failed:false,observations:{contract_version:'mm-review-observations.v1',start_time:100,end_time:200,coverage:{phase_bounds_valid:true,observed_from:110,observed_through:190},phases:{opening:{toxicity_pct:25,toxicity_coverage_pct:100,requote:{p50_ms:100,p95_ms:200,sample_count:8}},intraday:{recross_pct:40,recross_eligible:10,healthy_book_pct:80,observed_seconds:50,book_healthy_seconds:40,supply_conversion_pct:5,planned_orders:100,fills:5,follow:{p50_ms:200,p95_ms:800,sample_count:10}}}}}]});
test('six actor observation metrics map with account/revision and partial coverage semantics',()=>{
  const r=mergeReviewObservations(payload(),capture(),job,bounds).section_seven.metrics;
  assert.equal(r.toxicity.value,25);assert.equal(r.requoteLatency.value,200);assert.equal(r.recross.value,40);
  assert.equal(r.healthyBook.value,80);assert.equal(r.supplyConversion.value,5);assert.equal(r.followLatency.value,800);
  assert.match(r.followLatency.note,/上界/);assert.match(r.healthyBook.note,/不是完整生命周期/);
});
test('missing bounds, failed capture, ambiguous revisions and other accounts are rejected',()=>{
  for(const mutate of [x=>x.items[0].account_id=2,x=>x.items[0].observation_failed=true,x=>x.items.push(x.items[0]),x=>x.items[0].observations.start_time=0]){
    const c=capture();mutate(c);const p=mergeReviewObservations(payload(),c,job,bounds);assert.deepEqual(p.section_seven.metrics,{});assert.ok(p.coverage.notes.length);
  }
});
test('unique active runtime revision remains visible with desired revision drift explicitly marked',()=>{
  const c=capture();c.items[0].revision=1;
  const p=mergeReviewObservations(payload(),c,job,bounds);
  assert.equal(p.section_seven.metrics.toxicity.value,25);
  assert.match(p.coverage.notes[0],/实际运行 revision 1/);
});
test('unclassified toxicity stays null and empty phase is not zero',()=>{
  const c=capture();c.items[0].observations.phases.opening.toxicity_pct=null;
  const p=mergeReviewObservations(payload(),c,job,bounds);assert.equal(p.section_seven.metrics.toxicity.value,null);assert.deepEqual(p.section_seven.metrics.toxicity.observations,[]);assert.match(p.section_seven.unavailable.toxicity,/无成熟样本/);
  assert.equal(p.section_seven.metrics.toxicity.details[0].value,100);
});
test('directional recross and terminal inventory use existing actor counters',()=>{
  const c=capture(),o=c.items[0].observations;
  Object.assign(o.phases.intraday,{recross_buy_count:2,recross_buy_eligible:4,recross_sell_count:1,recross_sell_eligible:5});
  Object.assign(o,{first_imbalance_pct:12,residual_inventory_pct:20,waiting_result_inventory:-4,peak_yes:8,peak_no:20,reversals:[{at:185,direction:'up',inventory:-4,after_30s:-2,after_120s:null}]});
  o.phases.tail={reversals_up:1,reversals_down:0};
  const m=mergeReviewObservations(payload(),c,job,bounds).section_seven.metrics;
  assert.equal(m.recross.details.find(d=>d.label==='盘中 买入回摆率').value,50);
  assert.equal(m.recross.details.find(d=>d.label==='盘中 卖出回摆率').value,20);
  assert.equal(m.firstImbalance.value,12);assert.equal(m.reduction.value,20);
  assert.equal(m.reduction.observations[1].value,20);assert.equal(m.reversals.value,1);
  assert.equal(m.reversalExposure.value,-4);assert.equal(m.reversalExposure.details[1].value,null);
});

test('durable captures show merged coverage and do not mix other jobs',()=>{
  const c=capture();c.items[0].job_id=7;c.items[0].revisions=[1,2];
  Object.assign(c.items[0].observations,{source:'durable_review_aggregates'});
  Object.assign(c.items[0].observations.coverage,{capture_count:2,between_capture_gap_seconds:30,history_capped:true});
  const p=payload();p.section_seven.unavailable={toxicity:'old missing reason'};
  const m=mergeReviewObservations(p,c,{...job,job_id:7},bounds).section_seven;
  assert.match(m.metrics.toxicity.note,/历史累计 2 段/);
  assert.match(m.metrics.toxicity.note,/历史读取已截断/);
  assert.match(m.metrics.requoteLatency.note,/直方图/);
  assert.equal(m.unavailable.toxicity,undefined);
  assert.deepEqual(mergeReviewObservations(payload(),c,{...job,job_id:8},bounds).section_seven.metrics,{});
});

test('available observations distinguish missing counters from absent events',()=>{
  const c=capture(),o=c.items[0].observations;
  Object.assign(o.phases.intraday,{planned_orders:0,supply_conversion_pct:null,recross_pct:null});
  Object.assign(o.coverage,{incomplete_recross_windows:2,unconfirmed_quote_changes:3});
  o.phases.tail={observed_seconds:10,reversals_up:0,reversals_down:0};
  const m=mergeReviewObservations(payload(),c,job,bounds).section_seven.metrics;
  assert.equal(m.supplyConversion.emptyLabel,'计划计数缺失');
  assert.equal(m.recross.emptyLabel,'观察窗不完整');
  assert.equal(m.firstImbalance.value,null);
  assert.equal(m.firstImbalance.emptyLabel,'未观测到触发');
  assert.equal(m.reversalExposure.emptyLabel,'暂无反转样本');
  assert.equal(m.reduction.emptyLabel,'暂无待结算样本');
});
