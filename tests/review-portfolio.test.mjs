import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { savedPortfolioMarket } from '../app/api/dashboard/review-portfolio/store.ts';
import { backendMarketEnded } from '../app/api/dashboard/review-backend/loader.ts';

const id='0x'+'a'.repeat(64), now=Date.parse('2026-09-13T08:00:00Z');
const data={conditionId:id,title:'Ended QA',asOf:new Date(now).toISOString(),complete:true,valuations:[{phase:'开盘',phasePnl:0.48}],phases:[{phase:'开盘',spread:1,exposure:2}],lots:[{privateRaw:'not stored'}]};
async function directory(t) {const path=await mkdtemp(join(tmpdir(),'review-portfolio-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}

test('durable small summary survives subsequent requests; credentials have separate namespaces',async t=>{
  const dir=await directory(t);let calls=0;
  const options={directory:dir,identity:'account-a',conditionId:id,now,load:async()=>{calls++;return data;}};
  const first=await savedPortfolioMarket(options);
  assert.equal(first.storage,'disk');assert.equal(first.lots,undefined);
  assert.deepEqual(await savedPortfolioMarket({...options,now:now+5000}),first);
  assert.equal(calls,1);
  await savedPortfolioMarket({...options,identity:'account-b'});
  assert.equal(calls,2);assert.equal((await readdir(dir)).length,2);
});
test('explicit refresh updates after cooldown; failed or partial update preserves previous record',async t=>{
  const dir=await directory(t);
  const options={directory:dir,identity:'x',conditionId:id,now,load:async()=>data};
  const first=await savedPortfolioMarket(options);
  assert.deepEqual(await savedPortfolioMarket({...options,refresh:true,now:now+1000,load:async()=>{throw Error('must not call');}}),first);
  const partial=await savedPortfolioMarket({...options,refresh:true,now:now+61_000,load:async()=>({...data,complete:false})});
  assert.equal(partial.savedAt,first.savedAt);assert.match(partial.warning,/更新失败/);
  const changed=await savedPortfolioMarket({...options,refresh:true,now:now+62_000,load:async()=>({...data,title:'Updated'})});
  assert.equal(changed.name,'Updated');
});
test('old summaries revalidate on access, not on a realtime timer',async t=>{
  const dir=await directory(t);let calls=0;
  const options={directory:dir,identity:'x',conditionId:id,now,load:async()=>{calls++;return data;}};
  await savedPortfolioMarket(options);await savedPortfolioMarket({...options,now:now+86_400_001});
  assert.equal(calls,2);
});
test('cold failure is not saved as zero; corrupt record is rebuilt and save errors are explicit',async t=>{
  const dir=await directory(t), options={directory:dir,identity:'x',conditionId:id,now,load:async()=>data};
  await assert.rejects(savedPortfolioMarket({...options,load:async()=>({...data,complete:false})}));
  assert.equal((await readdir(dir)).length,0);
  await savedPortfolioMarket(options);
  await writeFile(join(dir,(await readdir(dir))[0]),'corrupt');
  assert.equal((await savedPortfolioMarket(options)).storage,'disk');
  await writeFile(join(dir,'not-a-directory'),'x');
  assert.equal((await savedPortfolioMarket({...options,directory:join(dir,'not-a-directory')})).storage,'unsaved');
});
test('parallel requests for same key share one computation and write',async t=>{
  const dir=await directory(t);let calls=0;
  const options={directory:dir,identity:'x',conditionId:id,now,load:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return data;}};
  const a=savedPortfolioMarket(options), b=savedPortfolioMarket(options);
  assert.deepEqual(await a,await b);assert.equal(calls,1);
});
test('server verifies ended lifecycle, not paused or supplied browser scope',()=>{
  assert.equal(backendMarketEnded({market:{condition_id:id,market_end_date:new Date(now+1).toISOString(),paused:true}},now),false);
  assert.equal(backendMarketEnded({market:{condition_id:id,market_end_date:new Date(now).toISOString()}},now),true);
  assert.equal(backendMarketEnded({market:{condition_id:id,closed:true}},now),true);
  assert.equal(backendMarketEnded({market:{condition_id:id,settlement_phase:'dispute1'}},now),true);
  assert.equal(backendMarketEnded({market:{condition_id:id}},now),false);
});
