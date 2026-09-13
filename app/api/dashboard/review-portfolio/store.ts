import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackendReview } from '../../../review-backend.ts';
import type { PortfolioMarket } from '../../../review-phase-portfolio-data.ts';

export type SavedPortfolioMarket = PortfolioMarket & { asOf:string; savedAt:string; warning?:string; storage:'disk'|'unsaved' };
type Record = { version:1; identity:string; row:SavedPortfolioMarket };
const MAX_BYTES=64_000;
const DAY=86_400_000;
const pending=new Map<string,Promise<SavedPortfolioMarket>>();

// One small record per market/account, not a cache of raw fills or order books.
export async function savedPortfolioMarket(options:{directory:string;identity:string;conditionId:string;refresh?:boolean;now?:number;load:()=>Promise<BackendReview>}):Promise<SavedPortfolioMarket> {
  const {directory,identity,conditionId,refresh=false,load,now=Date.now()}=options;
  if(!/^0x[a-f0-9]{64}$/.test(conditionId)) throw new Error('Invalid condition');
  const key=createHash('sha256').update(`review-portfolio.v1|${identity}|${conditionId}`).digest('hex');
  const path=join(directory,`${key}.json`);
  let previous:SavedPortfolioMarket|undefined;
  try {
    if((await stat(path)).size>MAX_BYTES) throw new Error('Oversized saved summary');
    const record=JSON.parse(await readFile(path,'utf8')) as Record;
    if(record.version===1 && record.identity===identity && record.row.id===conditionId && Array.isArray(record.row.valuations) && Array.isArray(record.row.spread) && Number.isFinite(Date.parse(record.row.savedAt))) previous=record.row;
  } catch { /* Missing or invalid records are rebuilt, never treated as zero. */ }
  const age=previous?now-Date.parse(previous.savedAt):Infinity;
  if(previous && age>=0 && age<(refresh?60_000:DAY)) return previous;
  const inflight=pending.get(path);
  if(inflight) return inflight;
  if(pending.size>=2) {
    if(previous) return {...previous,warning:'汇总服务繁忙，保留上次结果'};
    throw new Error('Review queries busy; retry shortly');
  }
  const task=(async():Promise<SavedPortfolioMarket>=>{
    try {
      const data=await load();
      if(data.conditionId!==conditionId) throw new Error('Market identity mismatch');
      if(!data.complete || data.valuations.length===0) throw new Error('历史读取不完整或缺少生命周期，未覆盖已保存结果');
      const row:SavedPortfolioMarket={id:conditionId,name:data.title,asOf:data.asOf,savedAt:new Date(now).toISOString(),storage:'disk',valuations:data.valuations,spread:data.phases.map(p=>({phase:p.phase,spread:p.spread,exposure:p.exposure}))};
      const content=JSON.stringify({version:1,identity,row} satisfies Record);
      if(Buffer.byteLength(content)>MAX_BYTES) throw new Error('Summary exceeds storage limit');
      let temporary:string|undefined;
      try {
        await mkdir(directory,{recursive:true,mode:0o700});
        temporary=join(directory,`${key}.${randomUUID()}.tmp`);
        await writeFile(temporary,content,{mode:0o600,flag:'wx'});
        await rename(temporary,path);
      } catch {
        return {...row,storage:'unsaved',warning:'汇总已计算，但磁盘保存失败；刷新后可能需要重新计算'};
      } finally { if(temporary) await unlink(temporary).catch(()=>{}); }
      return row;
    } catch(error) {
      if(previous) return {...previous,warning:`更新失败，保留上次结果：${error instanceof Error?error.message:'接口不可用'}`};
      throw error;
    }
  })();
  pending.set(path,task);
  try {return await task;} finally {pending.delete(path);}
}
