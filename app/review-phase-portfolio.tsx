"use client";
import { useEffect, useRef, useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import type { BackendReview } from './review-backend';
import { phasePortfolioTotals, type PortfolioMarket } from './review-phase-portfolio-data';
const money=(n:number|null)=>n===null?'无数据':`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export function ReviewPhasePortfolio({markets}:{markets:Array<{id:string;event:string}>}) {
  const idsKey=JSON.stringify([...new Map(markets.filter(row=>/^0x[a-f0-9]{64}$/i.test(row.id)).map(row=>[row.id.toLowerCase(),{id:row.id.toLowerCase(),event:row.event}])).values()].sort((a,b)=>a.id.localeCompare(b.id)));
  const [result,setResult]=useState<{key:string;at:number;markets:Array<{id:string;event:string}>;rows:PortfolioMarket[]}|null>(null);
  const [running,setRunning]=useState(false);
  const [phase,setPhase]=useState('开盘');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  const current=result;
  const items=JSON.parse(idsKey) as Array<{id:string;event:string}>;
  const scope=current?.markets??items;
  async function run(reset=false) {
    controller.current?.abort();
    const active=new AbortController();controller.current=active;
    const asOf=reset||!current?Math.floor(Date.now()/1000):current.at;
    const pinned=reset?items:current?.markets??items;
    const collected=reset?[]:[...(current?.rows??[])];
    setRunning(true);setResult({key:JSON.stringify(pinned),at:asOf,markets:pinned,rows:[...collected]});
    try {
      for(const item of pinned.slice(collected.length)) {
        try {
          const query=new URLSearchParams({condition_id:item.id,as_of:String(asOf),summary:'1'});
          const response=await fetch(`/api/dashboard/review-backend?${query}`,{cache:'no-store',signal:AbortSignal.any([active.signal,AbortSignal.timeout(50_000)])});
          if(!response.ok) throw new Error(`HTTP ${response.status}`);
          const data=await response.json() as BackendReview;
          if(data.conditionId!==item.id || !Array.isArray(data.valuations)) throw new Error('invalid review response');
          collected.push({id:item.id,name:item.event,valuations:data.valuations,spread:data.phases.map(row=>({phase:row.phase,spread:row.spread,exposure:row.exposure}))});
        } catch(error) {
          if(active.signal.aborted) break;
          collected.push({id:item.id,name:item.event,valuations:[],spread:[],error:error instanceof Error?error.message:'请求失败'});
        }
        if(active.signal.aborted) break;
        setResult({key:JSON.stringify(pinned),at:asOf,markets:pinned,rows:[...collected]});
        await new Promise(resolve=>setTimeout(resolve,300));
      }
    } finally {if(controller.current===active)setRunning(false);}
  }
  const totals=['开盘','盘中','尾盘','盘后'].map(label=>({label,...phasePortfolioTotals(current?.rows??[],label)}));
  return <div className="review-phase-portfolio">
    <div className="review-portfolio-heading"><h3>全市场阶段 PnL · 近似复盘</h3><div>
      <button type="button" title={running?'停止计算':'计算 / 继续阶段汇总'} aria-label={running?'停止阶段汇总':'计算阶段汇总'} onClick={()=>running?controller.current?.abort():void run()}>{running?<Square size={16}/>:<Play size={16}/>}</button>
      <button type="button" title="重新计算全部市场" aria-label="重新计算全部市场" disabled={running} onClick={()=>void run(true)}><RotateCcw size={16}/></button>
    </div></div>
    <p className="review-data-coverage">{current?.rows.length??0} / {scope.length} 个当前及历史市场已读取 · {running?'计算中':current?.rows.length===scope.length?'本轮完成':'未运行'}{current?` · 统一截止 ${new Date(current.at*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} (UTC+8)`:''}{current?.key!==idsKey&&current?` · 市场列表已更新为 ${items.length} 个，重算可纳入新列表`:''} · 各市场按自己的生命周期分阶段；仅合计可计算样本，不代表全量。点差仅含有盘口的账户腿，不与阶段 PnL 相加。</p>
    <div className="review-seven-table-wrap"><table className="review-seven-table"><thead><tr><th>阶段</th><th>阶段 PnL</th><th>可计算市场 / 全部</th><th>已覆盖点差 PnL</th><th>有盘口市场</th><th title="按建仓阶段归因的已处置 FIFO 批次毛收益；与点差及阶段总 PnL 不能相加。">已处置敞口 PnL</th><th>敞口归因市场</th></tr></thead><tbody>{totals.map(row=><tr key={row.label}><th><button className="review-pnl-drill" aria-pressed={phase===row.label} onClick={()=>setPhase(row.label)}>{row.label}</button></th><td>{money(row.pnl)}</td><td>{row.count} / {scope.length}</td><td>{money(row.spread)}</td><td>{row.spreadCount}</td><td>{money(row.exposure)}</td><td>{row.exposureCount}</td></tr>)}</tbody></table></div>
    <div className="review-seven-table-wrap review-pnl-lots"><table className="review-seven-table"><caption>{phase} · 逐市场贡献与缺口</caption><thead><tr><th>市场</th><th>阶段 PnL</th><th>未实现 PnL</th><th>估值口径 / 缺口</th></tr></thead><tbody>{current?.rows.map(row=>{const value=row.valuations.find(v=>v.phase===phase);return <tr key={row.id}><th title={row.id}>{row.name}</th><td>{money(value?.phasePnl??null)}</td><td>{money(value?.unrealized??null)}</td><td title={value?.markAt??''}>{row.error??value?.reason??'无该阶段'} {value?.markSource}</td></tr>;})}</tbody></table></div>
  </div>;
}
