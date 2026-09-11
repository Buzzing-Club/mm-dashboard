import type { PhaseValuation } from './review-backend';
export type PortfolioMarket = {id:string;name:string;valuations:PhaseValuation[];spread:Array<{phase:string;spread:number|null;exposure?:number|null}>;error?:string};
export function phasePortfolioTotals(rows:PortfolioMarket[],phase:string) {
  const covered=rows.flatMap(row=>row.valuations.filter(value=>value.phase===phase && value.phasePnl!==null));
  const spreads=rows.flatMap(row=>row.spread.filter(value=>value.phase===phase && value.spread!==null));
  const exposures=rows.flatMap(row=>row.spread.filter(value=>value.phase===phase && value.exposure!=null));
  return {pnl:covered.length?covered.reduce((sum,row)=>sum+row.phasePnl!,0):null,count:covered.length,spread:spreads.length?spreads.reduce((sum,row)=>sum+row.spread!,0):null,spreadCount:spreads.length,exposure:exposures.length?exposures.reduce((sum,row)=>sum+row.exposure!,0):null,exposureCount:exposures.length};
}
