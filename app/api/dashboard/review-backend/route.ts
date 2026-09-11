import { NextResponse } from 'next/server';
import { validConditionId } from '../openapi';
import { loadBackendReview } from './loader';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const params=new URL(request.url).searchParams;
  const conditionId = validConditionId(params.get('condition_id'));
  if (!conditionId) return NextResponse.json({error:'valid condition_id is required'},{status:400});
  const raw=params.get('as_of'), asOf=raw===null?undefined:Number(raw);
  if(asOf!==undefined && (!/^\d+$/.test(raw!) || !Number.isSafeInteger(asOf) || asOf<=0 || asOf>Math.floor(Date.now()/1000))) return NextResponse.json({error:'valid past as_of is required'},{status:400});
  try {
    const result=await loadBackendReview(conditionId,asOf);
    return NextResponse.json(params.get('summary')==='1'?{...result,lots:[],notes:result.notes.slice(0,12)}:result,{headers:{'cache-control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : 'Backend review unavailable'},{status:503});
  }
}
