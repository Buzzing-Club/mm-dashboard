import type { ReviewFactsPayload } from './review-facts.ts';

export type OrderFlow = NonNullable<ReviewFactsPayload['order_flow']> & {
  scope: Record<string, string | number>;
  complete: true;
  missingCount: number;
  pendingCount: number;
  savedAt?: string;
};
type Page = {
  contract_version: string; scope: OrderFlow['scope'];
  items: Array<{fill_key: string; score: number | null; reason: string | null}>;
  has_more: boolean; next_cursor: string | null;
};

export async function readOrderFlow(conditionId: string, readPage: (cursor: string) => Promise<unknown>): Promise<OrderFlow> {
  let cursor = '', scope: OrderFlow['scope'] | undefined;
  let candidateCount = 0, sampleCount = 0, sum = 0, positive = 0, neutral = 0, negative = 0, pendingCount = 0;
  const cursors = new Set<string>();
  const deadline = Date.now() + 40_000;
  for (let pageNumber = 0; pageNumber < 500; pageNumber++) {
    if (Date.now() > deadline) throw new Error('订单流历史读取超时，未得到完整汇总');
    const page = await readPage(cursor) as Page;
    if (page?.contract_version !== 'mm-review-order-flow.v1' || page.scope?.condition_id !== conditionId || !Array.isArray(page.items) || page.items.length > 200 || typeof page.has_more !== 'boolean') throw new Error('订单流历史接口格式或市场身份不匹配');
    if (scope && JSON.stringify(scope) !== JSON.stringify(page.scope)) throw new Error('订单流分页范围发生变化');
    scope = page.scope;
    const keys = new Set<string>();
    for (const row of page.items) {
      if (!row || typeof row.fill_key !== 'string' || !row.fill_key || keys.has(row.fill_key)) throw new Error('订单流分页含重复或无效成交');
      keys.add(row.fill_key);
      candidateCount++;
      if (row.score === null) {
        if (!['missing_reference','pending_window','invalid_fill','invalid_reference'].includes(row.reason ?? '')) throw new Error('订单流样本缺少失败口径');
        if (row.reason === 'pending_window') pendingCount++;
        continue;
      }
      if (typeof row.score !== 'number' || !Number.isFinite(row.score) || Math.abs(row.score) > 100 || row.reason !== null) throw new Error('订单流评分无效');
      sampleCount++; sum += row.score;
      if (row.score > 1e-8) positive++; else if (row.score < -1e-8) negative++; else neutral++;
    }
    if (!page.has_more) {
      if (page.next_cursor !== null) throw new Error('订单流分页终态不一致');
      const missingCount = candidateCount - sampleCount;
      return {scope, complete:true, candidateCount, sampleCount, missingCount, pendingCount,
        averageScore:sampleCount ? sum/sampleCount : null, favorableRate:sampleCount ? positive/sampleCount*100 : null,
        distribution:[{kind:'有利',count:positive,color:'#20d49b'},{kind:'中性',count:neutral,color:'#939daa'},{kind:'不利',count:negative,color:'#ff536b'}],
        note:`已按市场、账户和做市任务分页读取全部留存 MM_QUOTE 成交；成交后 60–90 秒首个公允价，YES/NO 及买卖方向换算，等权按笔。有效 ${sampleCount}/${candidateCount} 笔，未覆盖 ${missingCount} 笔（观察中 ${pendingCount} 笔）；截至 ${scope.as_of}。不等同于 30 秒毒性率。`};
    }
    if (!page.items.length || !page.next_cursor || cursors.has(page.next_cursor)) throw new Error('订单流历史游标未推进');
    cursor = page.next_cursor; cursors.add(cursor);
  }
  throw new Error('订单流历史分页超过本次读取预算，未得到完整汇总');
}
