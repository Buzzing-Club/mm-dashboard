"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Square, RotateCcw } from 'lucide-react';
import { formatReviewNumber } from "./review-number-format";
import { phasePortfolioTotals, type PortfolioMarket } from './review-phase-portfolio-data';
const money=(n:number|null)=>n===null?'无数据':`${n<0?'-':''}$${formatReviewNumber(Math.abs(n))}`;
export function ReviewPhasePortfolio({markets}:{markets:Array<{id:string;event:string}>}) {
  const idsKey=JSON.stringify([...new Map(markets.filter(row=>/^0x[a-f0-9]{64}$/i.test(row.id)).map(row=>[row.id.toLowerCase(),{id:row.id.toLowerCase(),event:row.event}])).values()].sort((a,b)=>a.id.localeCompare(b.id)));
  const [result,setResult]=useState<{key:string;rows:PortfolioMarket[]}|null>(null);
  const [running,setRunning]=useState(false);
  const [phase,setPhase]=useState('开盘');
  const controller=useRef<AbortController|null>(null);
  const current=result?.key===idsKey?result:null;
  const items=JSON.parse(idsKey) as Array<{id:string;event:string}>;
  const scope=items;
  const run=useCallback(async (refresh=false) => {
    controller.current?.abort();
    const active=new AbortController();controller.current=active;
    const pinned=JSON.parse(idsKey) as Array<{id:string;event:string}>;
    setRunning(true);
    setResult(previous=>previous?.key===idsKey?previous:{key:idsKey,rows:[]});
    try {
      for(const item of pinned) {
        let row:PortfolioMarket;
        try {
          const query=new URLSearchParams({condition_id:item.id,...(refresh?{refresh:'1'}:{})});
          let response:Response|undefined;
          for(let attempt=0;attempt<3;attempt++) {
            active.signal.throwIfAborted();
            response=await fetch(`/api/dashboard/review-portfolio?${query}`,{cache:'no-store',signal:AbortSignal.any([active.signal,AbortSignal.timeout(50_000)])});
            if(response.status!==503 || attempt===2) break;
            await new Promise(resolve=>setTimeout(resolve,2000));
          }
          const data=await response!.json();
          if(!response!.ok) throw new Error(data.error??`HTTP ${response!.status}`);
          if(data.id!==item.id || !Array.isArray(data.valuations) || !Array.isArray(data.spread)) throw new Error('invalid review response');
          row=data as PortfolioMarket;
        } catch(error) {
          if(active.signal.aborted) break;
          row={id:item.id,name:item.event,valuations:[],spread:[],error:error instanceof Error?error.message:'请求失败'};
        }
        if(active.signal.aborted) break;
        setResult(previous=>{
          const rows=previous?.key===idsKey?[...previous.rows]:[];
          const index=rows.findIndex(value=>value.id===item.id);
          if(index<0) rows.push(row);
          else rows[index]=row.error && rows[index].valuations.length?{...rows[index],warning:row.error}:row;
          return {key:idsKey,rows};
        });
        await new Promise(resolve=>setTimeout(resolve,300));
      }
    } finally {if(controller.current===active)setRunning(false);}
  },[idsKey,setRunning,setResult]);
  useEffect(()=>{
    const timer=setTimeout(()=>void run(),0);
    return ()=>{clearTimeout(timer);controller.current?.abort();};
  },[run]);
  const times=(current?.rows??[]).flatMap(row=>row.asOf?[Date.parse(row.asOf)]:[]).filter(Number.isFinite);
  const time=(value:number)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});
  const totals=['开盘','盘中','尾盘','盘后'].map(label=>({label,...phasePortfolioTotals(current?.rows??[],label)}));
  return <div className="review-phase-portfolio">
    <div className="review-portfolio-heading"><h3>已结束市场阶段 PnL · 离线汇总</h3><div>
      {running&&<button type="button" title="停止读取，保留已保存结果" aria-label="停止阶段汇总" onClick={()=>controller.current?.abort()}><Square size={16}/></button>}
      <button type="button" title="更新已结束市场的历史汇总" aria-label="更新阶段汇总" disabled={running} onClick={()=>void run(true)}><RotateCcw size={16}/></button>
    </div></div>
    <p className="review-data-coverage">{current?.rows.filter(row=>!row.error).length??0} / {scope.length} 个已结束市场已读取 · {running?'读取 / 汇总中':scope.length===0?'暂无已结束市场':current?.rows.length===scope.length?'读取完成':'读取已停止'}{times.length?` · 数据截至 ${time(Math.min(...times))}${Math.max(...times)!==Math.min(...times)?` 至 ${time(Math.max(...times))}`:''} (UTC+8)`:''} · API 账户跨市场收益；按各市场生命周期分阶段，盘后收益截至各行标注时间，未结算收益为历史近似估值。仅合计可计算样本；点差不与阶段 PnL 相加。</p>
    {current?.rows.some(row=>row.warning)&&<p role="status" className="review-data-coverage">部分市场沿用旧结果或保存失败，详见逐市场说明。</p>}
    <div className="review-seven-table-wrap"><table className="review-seven-table"><thead><tr><th>阶段</th><th>阶段 PnL</th><th>可计算市场 / 全部</th><th>已覆盖点差 PnL</th><th>有盘口市场</th><th title="按建仓阶段归因的已处置 FIFO 批次毛收益；与点差及阶段总 PnL 不能相加。">已处置敞口 PnL</th><th>敞口归因市场</th></tr></thead><tbody>{totals.map(row=><tr key={row.label}><th><button className="review-pnl-drill" aria-pressed={phase===row.label} onClick={()=>setPhase(row.label)}>{row.label}</button></th><td>{money(row.pnl)}</td><td>{row.count} / {scope.length}</td><td>{money(row.spread)}</td><td>{row.spreadCount}</td><td>{money(row.exposure)}</td><td>{row.exposureCount}</td></tr>)}</tbody></table></div>
    <div className="review-seven-table-wrap review-pnl-lots"><table className="review-seven-table"><caption>{phase} · 逐市场贡献与缺口</caption><thead><tr><th>市场</th><th>阶段 PnL</th><th>未实现 PnL</th><th>数据截至 (UTC+8)</th><th>估值口径 / 缺口</th></tr></thead><tbody>{current?.rows.map(row=>{const value=row.valuations.find(v=>v.phase===phase);return <tr key={row.id}><th title={row.id}>{row.name}</th><td>{money(value?.phasePnl??null)}</td><td>{money(value?.unrealized??null)}</td><td>{row.asOf?time(Date.parse(row.asOf)):'--'}</td><td title={value?.markAt??''}>{row.warning??row.error??value?.reason??'无该阶段'} {value?.markSource}</td></tr>;})}</tbody></table></div>
  </div>;
}
