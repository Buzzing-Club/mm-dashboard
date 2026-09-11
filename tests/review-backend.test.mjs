import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackendReview, buildPhaseValuations, legSpread, orderedFacts, raw6 } from '../app/review-backend.ts';
import { phasePortfolioTotals } from '../app/review-phase-portfolio-data.ts';
import { readBackendPages, readBoundedJson } from '../app/api/dashboard/review-backend/loader.ts';
import { pathWithSortedQuery } from '../app/api/dashboard/openapi.ts';

const cid = `0x${'a'.repeat(64)}`;
const start = Date.parse('2026-09-11T00:00:00Z');
const ns = minutes => String(BigInt(start + minutes*60000)*1000000n);
const source = items => ({items,available:true,complete:true,versions:['v1']});
const input = (fills=[],ledger=[]) => ({conditionId:cid,now:start+120*60000,market:{event:{},market:{condition_id:cid,question:'Test',create_time:new Date(start).toISOString(),market_end_date:new Date(start+60*60000).toISOString()},settlement:{chain_id:'84532',timeline:[]}},fills:source(fills),ledger:source(ledger)});
function fill(id, minute=20, patch={}) {
  return {id:String(id),timestamp_ns:ns(minute),status:'success',quantity:'10000000',wash_flag:'none',exclude_from_net_volume:false,level_index:1,order_fill_count:1,consumed_levels:1,taker:{user_ref:'user',order_ref:String(id),account_type:'user',side:'buy',outcome:'yes',price:'0.48'},maker:{account_type:'self',side:'buy',outcome:'no',price:'0.52'},quote:{has_quote:true,reference_timing:'pre_batch',mid:'0.5'},...patch};
}
function activity(id,type,minute,patch={}) {
  return {entry_id:`activity:${id}`,timestamp_ns:ns(minute),condition_id:cid,status:'success',type,outcome:'yes',position_id:'yes',ownership_type:'user',funding_account_type:'user',quantity:'10000000',price:'0.4',value:'4000000',fee_amount:'0',realized_pnl:'0',...patch};
}
test('raw6 handles units, decimals and unknown values',()=>{
  assert.equal(raw6('4900000'),4.9); assert.equal(raw6('-96385.6'),-0.0963856);
  for(const value of ['',null,'NaN','9007199254740992']) assert.equal(raw6(value),null);
});
test('phase cashflow PnL includes fees, marks residual inventory and separates post-close settlement',()=>{
  const i=input([fill(1,55,{taker:{...fill(1).taker,price:'0.8'},quote:{has_quote:false}})],[
    activity(1,'buy',1,{fee_amount:'100000'}),
    activity(2,'sell',20,{quantity:'5000000',price:'0.6',value:'3000000',fee_amount:'100000'}),
    activity(3,'win',70,{quantity:'5000000',price:'1',value:'5000000',realized_pnl:'2950000'}),
    activity(4,'claim',80,{quantity:'5000000',value:'5000000'}),
  ]);
  const v=buildPhaseValuations(i);
  assert.deepEqual(v.map(row=>row.phase),['开盘','盘中','尾盘','盘后']);
  for(const [index,expected] of [-.1,1.9,1,1].entries()) assert.ok(Math.abs(v[index].phasePnl-expected)<1e-8);
  assert.equal(v[1].yes,5);assert.ok(Math.abs(v[1].unrealized-.95)<1e-8);
  assert.equal(v[0].markYes,.4);assert.equal(v[2].markYes,.8);
  assert.ok(Math.abs(v[3].cumulativePnl-3.8)<1e-8);
});
test('valuation refuses missing source inventory, future prices, and truncated ledger',()=>{
  const i=input([fill(1,20)], [activity(1,'buy',1,{price:undefined})]);
  assert.equal(buildPhaseValuations(i)[0].phasePnl,null);
  assert.equal(buildPhaseValuations(i)[0].markAt,null);
  i.ledger.complete=false;assert.equal(buildPhaseValuations(i)[1].cumulativePnl,null);
  i.ledger=source([activity(1,'sell',2)]);assert.match(buildPhaseValuations(i)[0].reason,/库存/);
});
test('neutral split pairs need no historical price and portfolio sums flows, not cumulative PnL',()=>{
  const i=input([],['yes','no'].map((outcome,index)=>activity(index+1,'split',1,{outcome,position_id:outcome,price:'0.5',value:'5000000'})));
  const v=buildPhaseValuations(i);assert.equal(v[0].phasePnl,0);assert.equal(v[0].holdingsValue,10);
  const rows=[{id:'a',valuations:v,spread:[]},{id:'b',valuations:[{phase:'开盘',phasePnl:2,cumulativePnl:99}],spread:[]},{id:'c',valuations:[],spread:[]}];
  assert.deepEqual(phasePortfolioTotals(rows,'开盘'),{pnl:2,count:2,spread:null,spreadCount:0,exposure:null,exposureCount:0});
  assert.equal(phasePortfolioTotals([],'盘中').pnl,null);
});
test('pre-batch reference complements the taker outcome; missing quote is not zero',()=>{
  const f=fill(1); assert.ok(Math.abs(legSpread(f,f.maker)+0.2)<1e-10);
  f.maker.price='0.48'; assert.ok(Math.abs(legSpread(f,f.maker)-0.2)<1e-10);
  f.quote.mid='0.6'; assert.ok(Math.abs(legSpread(f,f.maker)+0.8)<1e-10);
  for(const quote of [{has_quote:false,mid:'0'},{has_quote:true,mid:'',reference_timing:'pre_batch'},{has_quote:true,mid:'0.5',reference_timing:'post_batch'}]) assert.equal(legSpread({...f,quote},f.maker),null);
});
test('nanosecond sorting precedes IDs and deduplicates fills',()=>{
  const a=fill(9), b=fill(1); b.timestamp_ns=String(BigInt(a.timestamp_ns)+1n);
  assert.deepEqual(orderedFacts([b,a,a],'id').map(r=>r.id),['9','1']);
});
test('one taker order counts once; two orders at 1 and 3 levels average 2',()=>{
  const group=[1,2,3].map((n)=>fill(n,20,{level_index:n,order_fill_count:3,consumed_levels:3,taker:{...fill(1).taker,order_ref:'multi'}}));
  const r=buildBackendReview(input([...group,fill(4),group[0],fill(5,20,{wash_flag:'internal_flow'}),fill(6,20,{taker:{...fill(6).taker,account_type:'internal'}})]));
  assert.equal(r.levelsMetric.value,2); assert.equal(r.levelsMetric.details[0].value,2);
  assert.deepEqual(r.levelsMetric.observations,[{label:'1 档',value:1},{label:'3 档',value:1}]);
  assert.equal(buildBackendReview(input(group.slice(1))).levelsMetric,null);
  const changed=input(group);changed.fills.versions=['v1','v2'];assert.equal(buildBackendReview(changed).levelsMetric,null);
});
test('whole order follows first fill market phase; boundaries and users are not guessed',()=>{
  const a=fill(1,11,{order_fill_count:2,consumed_levels:2});
  const b=fill(2,13,{level_index:2,order_fill_count:2,consumed_levels:2,taker:a.taker});
  assert.equal(buildBackendReview(input([a,b])).levelsMetric,null);
  assert.equal(buildBackendReview(input([fill(1,12)])).levelsMetric.value,1);
  assert.equal(buildBackendReview(input([fill(1,48)])).levelsMetric,null);
  const i=input([fill(1)]);delete i.market.market.create_time;assert.equal(buildBackendReview(i).levelsMetric,null);
});
test('self legs stay separate; missing quote counts coverage but not a fabricated zero',()=>{
  const i=input([fill(1),fill(2,20,{quote:{has_quote:false}}),fill(3,20,{status:'failed'})]);
  const r=buildBackendReview(i);assert.equal(r.phases[1].totalLegs,2);assert.equal(r.phases[1].quotedLegs,1);
  assert.ok(Math.abs(r.phases[1].spread+0.2)<1e-9);assert.equal(r.phases[0].spread,null);
});
test('FIFO records gross realized lots; claim never realizes profit twice',()=>{
  const i=input([], [activity(1,'buy',1),activity(2,'sell',20,{price:'0.6',realized_pnl:'1900000',fee_amount:'100000'}),activity(3,'claim',80,{realized_pnl:'999000000',value:'6000000'})]);
  const r=buildBackendReview(i);assert.equal(r.ledger.realized,1.9);assert.equal(r.ledger.fees,0.1);assert.equal(r.ledger.claims,6);
  assert.equal(r.phases[1].realized,1.9);assert.ok(Math.abs(r.phases[0].exposure-2)<1e-9);assert.equal(r.lots[0].phase,'开盘');
});
test('settlement is lifetime realized, not invented tail-period profit',()=>{
  const r=buildBackendReview(input([],[activity(1,'buy',1),activity(2,'win',75,{price:'1',realized_pnl:'6000000'}),activity(3,'claim',80,{price:'1',realized_pnl:'0',value:'10000000'})]));
  assert.equal(r.ledger.realized,6);assert.equal(r.phases[2].realized,0);assert.equal(r.lots[0].exitPrice,1);
});
test('custody does not close user lots; truncation and unknown records do not return full totals',()=>{
  const i=input([],[activity(1,'buy',1),activity(2,'sell',20,{ownership_type:'custody'})]);
  assert.equal(buildBackendReview(i).phases[0].exposure,null);
  i.ledger.complete=false;assert.equal(buildBackendReview(i).ledger.realized,null);
  i.ledger.complete=true;i.ledger.items[0].timestamp_ns='invalid';assert.equal(buildBackendReview(i).ledger.realized,null);
});
test('split/merge outcome legs each use their 0.5 allocation',()=>{
  const records=['yes','no'].flatMap((outcome,index)=>[activity(index*2+1,'split',1,{outcome,position_id:outcome,price:'0.5',value:'5000000'}),activity(index*2+2,'merge',20,{outcome,position_id:outcome,price:'0.5',value:'5000000'})]);
  const r=buildBackendReview(input([],records));assert.equal(r.ledger.splits,10);assert.equal(r.ledger.merges,10);assert.equal(r.lots.length,2);assert.equal(r.phases[0].exposure,0);
});
test('future phases remain unknown and failed ledger rows do not realize profit',()=>{
  const i=input([],[activity(1,'sell',5,{status:'failed',realized_pnl:'9000000'})]);
  i.now=start+10*60000;
  const r=buildBackendReview(i);
  assert.equal(r.ledger.realized,0);
  assert.equal(r.phases[0].realized,0);
  assert.equal(r.phases[1].realized,null);
  assert.equal(r.phases[2].realized,null);
});
test('pagination URL encodes opaque colon cursor and preserves fixed query end',async()=>{
  const calls=[];const api=async(path,q)=>{calls.push(pathWithSortedQuery(path,q));return {amount_unit:'usdb_raw6',condition_id:cid,has_more:calls.length===1,next_cursor:'178:activity:42',fills:[fill(calls.length)],quality:{classification_version:'v1'}};};
  const r=await readBackendPages(api,`/markets/${cid}/fills`,{to:'123'},'fills');
  assert.equal(r.complete,true);assert.match(calls[1],/cursor=178%3Aactivity%3A42/);assert.match(calls[1],/to=123/);
});
test('pagination bounds, repeated cursors, partial failures and business errors',async()=>{
  let calls=0;
  let r=await readBackendPages(async()=>({amount_unit:'usdb_raw6',condition_id:cid,has_more:true,next_cursor:String(++calls),fills:[],quality:{classification_version:'v1'}}),`/${cid}/fills`,{},'fills');
  assert.equal(calls,8);assert.equal(r.complete,false);
  r=await readBackendPages(async()=>({amount_unit:'usdb_raw6',has_more:true,next_cursor:'same',entries:[]}),'/activities',{},'entries');assert.match(r.error,/cursor/);
  await assert.rejects(readBoundedJson(new Response(JSON.stringify({code:1005,data:{}}))),/1005/);
  await assert.rejects(readBoundedJson(new Response(' '.repeat(2000001))),/size limit/);
});
