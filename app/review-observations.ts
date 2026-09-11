import { epochMs, finite, map, rows, type Fact, type ReviewFactsPayload } from './review-facts.ts';
import type { MetricId, SectionSevenMetric } from './review-section-seven-data.ts';

const phases = ['opening','intraday','tail'] as const;
const names = ['开盘','盘中','尾盘'];
export function mergeReviewObservations(payload: ReviewFactsPayload, raw: unknown, job: Fact, bounds: {start:number|null;end:number|null}) {
  const json=map(raw);
  const reject=(reason:string)=>{payload.coverage.notes.push(`策略观测：${reason}`);return payload;};
  if(json.contract_version!=='mm-review-observations.v1') return reject('接口不可用或版本不支持');
  const candidates=rows(json.items).filter(row=>row.condition_id===payload.condition_id && String(row.account_id)===String(job.account_id) && row.job_type==='market_maker');
  if(candidates.length!==1) return reject('没有唯一匹配的账户/任务版本观测，不合并其他账户或版本');
  const item=candidates[0], capture=map(item.observations), coverage=map(capture.coverage);
  if(job.revision!==undefined && String(job.revision)!==String(item.revision)) payload.coverage.notes.push(`观测来自实际运行 revision ${String(item.revision)}；配置期望 revision ${String(job.revision)}，未合并两个版本。`);
  if(item.observation_failed || capture.contract_version!=='mm-review-observations.v1') return reject('当前捕获失败');
  if(coverage.phase_bounds_valid!==true || epochMs(capture.start_time)!==bounds.start || epochMs(capture.end_time)!==bounds.end) return reject('市场阶段边界缺失或与目录不一致');
  const from=epochMs(coverage.observed_from), through=epochMs(coverage.observed_through);
  if(from===null || through===null || through<from) return reject('尚无有效观察时间窗');
  const data=phases.map(phase=>map(map(capture.phases)[phase]));
  const context=`账户 ${String(item.account_id)} / revision ${String(item.revision)}；${new Date(from).toISOString()} 至 ${new Date(through).toISOString()}，仅捕获区间；重启或任务移除会重置。`;
  payload.coverage.notes.push(context);
  const add=(id:MetricId, value:number|null, observations:SectionSevenMetric['observations'], note:string, unit:string, details:SectionSevenMetric['details']=[])=>{
    // Do not replace useful durable samples with an empty capture.
    if(value===null && !observations.length) {
      payload.section_seven.unavailable={...payload.section_seven.unavailable,[id]:`${note} 当前无成熟样本。${context}`};
      if(payload.section_seven.metrics[id]) return;
    }
    payload.section_seven.metrics[id]={value,observations,precision:'sampled',observationUnit:unit,note:`${note} ${context}`,details};
  };
  const series=(field:string)=>data.flatMap((row,i)=>finite(row[field])===null?[]:[{label:names[i],value:finite(row[field])!}]);
  add('toxicity',finite(data[0].toxicity_pct),series('toxicity_pct').filter(row=>row.label!=='尾盘'),'30 秒不利漂移确认；该阶段捕获成交全部完成分类后才给毒性率。','毒性率 (%)',data.flatMap((row,i)=>[{label:`${names[i]} 已分类覆盖率`,value:finite(row.toxicity_coverage_pct),unit:'%'}]));
  const directionDetails=data.flatMap((row,i)=>['BUY','SELL'].map(side=>{
    const count=finite(row[`recross_${side.toLowerCase()}_count`]), total=finite(row[`recross_${side.toLowerCase()}_eligible`]);
    return {label:`${names[i]} ${side==='BUY'?'买入':'卖出'}回摆率`,value:total!==null&&total>0&&count!==null?100*count/total:null,unit:'%'};
  }));
  add('recross',finite(data[1].recross_pct),series('recross_pct'),'仅完整 60 秒且无超过 5 秒空档的公允价观察窗；买卖方向分别按完整窗口计数。','回摆率 (%)',directionDetails);
  const observed=data.reduce((sum,row)=>sum+(finite(row.observed_seconds)??0),0);
  const healthy=data.reduce((sum,row)=>sum+(finite(row.book_healthy_seconds)??0),0);
  add('healthyBook',observed>0?100*healthy/observed:null,series('healthy_book_pct'),'NORMAL 双边健全秒数 / 已观察秒数；不是完整生命周期覆盖率。','观察区间健全率 (%)',data.map((row,i)=>({label:`${names[i]} 覆盖时长`,value:finite(row.observed_seconds),unit:'秒'})));
  add('supplyConversion',finite(data[1].supply_conversion_pct),series('supply_conversion_pct'),'捕获区间 MM_QUOTE maker 成交数 / 语义变化时记录的计划挂单数；不冒充完整历史。','供给转化 (%)',data.flatMap((row,i)=>[{label:`${names[i]} 计划数`,value:finite(row.planned_orders),unit:'笔'},{label:`${names[i]} 成交数`,value:finite(row.fills),unit:'笔'}]));
  for(const [id,kind,index] of [['requoteLatency','requote',0],['followLatency','follow',1]] as const) {
    const stats=data.map(row=>map(row[kind]));
    const samples=stats.flatMap((row,i)=>['p50_ms','p95_ms'].flatMap(field=>finite(row[field])===null?[]:[{label:`${names[i]} ${field.slice(0,3).toUpperCase()}`,value:finite(row[field])!}]));
    add(id,finite(stats[index].p95_ms),samples,'策略 actor 观测触发至变化报价确认的耗时上界，最新 128 个完成样本；不含外部源发布时间和分层网络耗时。','耗时 (ms)',stats.map((row,i)=>({label:`${names[i]} 确认样本`,value:finite(row.sample_count),unit:'个'})));
  }
  const first=finite(capture.first_imbalance_pct);
  const oldFirst=payload.section_seven.metrics.firstImbalance?.value;
  if(first!==null && (oldFirst==null || first<oldFirst)) add('firstImbalance',first,[{label:'首次观测',value:first}],'捕获区间首次库存越界，取已有历史与运行观测中较早者。','% 生命周期');
  const events=rows(capture.reversals).filter(row=>epochMs(row.at)!==null&&finite(row.inventory)!==null);
  const up=finite(data[2].reversals_up), down=finite(data[2].reversals_down);
  if(!payload.section_seven.metrics.reversals && (up!==null||down!==null)) add('reversals',(up??0)+(down??0),[{label:'向上',value:up??0},{label:'向下',value:down??0}],'尾盘累计反转次数，明细仅保留最近32次。','次');
  if(!payload.section_seven.metrics.reversalExposure && events.length) add('reversalExposure',finite(events.at(-1)!.inventory),events.map(row=>({label:new Date(epochMs(row.at)!).toISOString(),value:finite(row.inventory)!})),'反转时净库存及后续30/120秒观察。','shares',events.flatMap(row=>[30,120].map(seconds=>({label:`${new Date(epochMs(row.at)!).toISOString()} +${seconds}s`,value:finite(row[`after_${seconds}s`]),unit:'shares'}))));
  const residual=finite(capture.residual_inventory_pct), waiting=finite(capture.waiting_result_inventory);
  if(residual!==null&&waiting!==null) add('reduction',residual,[{label:'剩余净库存',value:Math.abs(waiting)},{label:'同方向峰值',value:finite(waiting<0?capture.peak_no:waiting>0?capture.peak_yes:Math.max(Number(capture.peak_yes??0),Number(capture.peak_no??0)))??0}],'waiting_result 库存相对交易期捕获峰值；不是已挂减仓单数量。','shares');
  return payload;
}
