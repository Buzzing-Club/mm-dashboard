import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OrderFlow } from '../../../review-order-flow.ts';

const pending = new Map<string, Promise<OrderFlow>>();
export async function savedOrderFlow({directory, identity, conditionId, load, now=Date.now()}: {
  directory:string; identity:string; conditionId:string; load:()=>Promise<OrderFlow>; now?:number;
}): Promise<OrderFlow> {
  const folder = join(directory, 'order-flow');
  const key = createHash('sha256').update(`order-flow.v1|${identity}|${conditionId}`).digest('hex');
  const path = join(folder, `${key}.json`);
  let previous: OrderFlow | undefined;
  try {
    if ((await stat(path)).size > 32_000) throw new Error('Oversized order flow summary');
    const record = JSON.parse(await readFile(path, 'utf8')) as OrderFlow;
    if (record.scope.condition_id === conditionId && record.complete && Number.isFinite(Date.parse(record.savedAt ?? '')) && Array.isArray(record.distribution)) previous = record;
  } catch { /* No usable persisted summary. */ }
  if (previous && now - Date.parse(previous.savedAt!) >= 0 && now - Date.parse(previous.savedAt!) < (previous.pendingCount ? 120_000 : 86_400_000)) return previous;
  const inflight = pending.get(path);
  if (inflight) return inflight;
  if (pending.size >= 2) {
    if (previous) return {...previous,note:`${previous.note} 汇总读取繁忙，保留上次结果。`};
    throw new Error('订单流汇总繁忙，请稍后重试');
  }
  const work = (async () => {
    let temporary:string|undefined;
    try {
      const value = await load();
      if (!value.complete || value.scope.condition_id !== conditionId) throw new Error('订单流历史未完整读取');
      if (previous && (value.candidateCount < previous.candidateCount || value.sampleCount < previous.sampleCount)) throw new Error('历史样本减少，未覆盖已保存的汇总');
      const result = {...value,savedAt:new Date(now).toISOString()};
      const content = JSON.stringify(result);
      if (Buffer.byteLength(content) > 32_000) throw new Error('订单流汇总超过大小限制');
      await mkdir(folder,{recursive:true,mode:0o700});
      temporary = join(folder,`${key}.${randomUUID()}.tmp`);
      await writeFile(temporary,content,{mode:0o600,flag:'wx'});
      await rename(temporary,path);
      return {...result,note:`${result.note} 已保存离线汇总。`};
    } catch (error) {
      if (previous) return {...previous,note:`${previous.note} 更新失败，保留已保存结果：${error instanceof Error ? error.message : '读取失败'}`};
      throw error;
    } finally { if (temporary) await unlink(temporary).catch(()=>{}); }
  })();
  pending.set(path,work);
  try {return await work;} finally {pending.delete(path);}
}
