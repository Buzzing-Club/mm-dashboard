import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readOrderFlow } from '../app/review-order-flow.ts';
import { savedOrderFlow } from '../app/api/dashboard/review-facts/order-flow-store.ts';

const conditionId='0x'+'a'.repeat(64);
const scope={condition_id:conditionId,account_id:1,job_id:4,revision:1,as_of:'2026-09-13T09:00:00Z'};
const page=(items,extra={})=>({contract_version:'mm-review-order-flow.v1',scope,items,has_more:false,next_cursor:null,...extra});
const row=(fill_key,score,reason=null)=>({fill_key,score,reason});

test('market pages aggregate equally weighted scores, missing references are not zero',async()=>{
  const queries=[];
  const result=await readOrderFlow(conditionId,async cursor=>{
    queries.push(cursor);
    return cursor ? page([row('c',0),row('d',null,'missing_reference')]) : page([row('a',12),row('b',-3)],{has_more:true,next_cursor:'opaque:cursor'});
  });
  assert.deepEqual(queries,['','opaque:cursor']);
  assert.equal(result.candidateCount,4); assert.equal(result.sampleCount,3);
  assert.equal(result.averageScore,3); assert.ok(Math.abs(result.favorableRate-100/3)<1e-10);
  assert.equal(result.missingCount,1); assert.equal(result.complete,true);
  assert.deepEqual(result.distribution.map(r=>r.count),[1,1,1]);
});

test('broken pagination, scope changes and invalid scores fail instead of zero',async()=>{
  await assert.rejects(readOrderFlow(conditionId,async()=>page([row('a',1)],{has_more:true,next_cursor:'same'})),/游标/);
  await assert.rejects(readOrderFlow(conditionId,async cursor=>cursor?page([],{scope:{...scope,account_id:2}}):page([row('a',1)],{has_more:true,next_cursor:'next'})),/范围/);
  await assert.rejects(readOrderFlow(conditionId,async()=>page([row('a',NaN)])),/评分/);
  await assert.rejects(readOrderFlow(conditionId,async()=>{throw new Error('timeout');}),/timeout/);
  await assert.rejects(readOrderFlow(conditionId,async()=>page([row('a',1),row('a',1)])),/重复/);
  const empty=await readOrderFlow(conditionId,async()=>page([]));
  assert.equal(empty.averageScore,null); assert.equal(empty.sampleCount,0);
});

test('saved summary survives reload; retention loss and failed refresh do not replace it',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'review-flow-'));
  try {
    const load=()=>readOrderFlow(conditionId,async()=>page([row('a',8),row('b',4)]));
    const args={directory,identity:'account-1',conditionId,now:1000,load};
    const first=await savedOrderFlow(args);
    const second=await savedOrderFlow({...args,now:2000,load:async()=>{throw new Error('must use disk');}});
    assert.equal(second.savedAt,first.savedAt);assert.equal(second.averageScore,6);
    const retained=await savedOrderFlow({...args,now:90_000_000,load:()=>readOrderFlow(conditionId,async()=>page([]))});
    assert.equal(retained.sampleCount,2);assert.match(retained.note,/历史样本减少/);
    const failed=await savedOrderFlow({...args,now:90_000_001,load:async()=>{throw new Error('upstream failed');}});
    assert.equal(failed.savedAt,first.savedAt);assert.match(failed.note,/upstream failed/);
    await assert.rejects(savedOrderFlow({...args,identity:'other-account',load:async()=>{throw new Error('no source');}}),/no source/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
