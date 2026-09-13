import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { openApiConfig, validConditionId } from '../openapi';
import { loadBackendReview } from '../review-backend/loader';
import { savedPortfolioMarket } from './store';

export const runtime='nodejs';
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  const conditionId=validConditionId(params.get('condition_id'))?.toLowerCase();
  if(!conditionId) return NextResponse.json({error:'valid condition_id is required'},{status:400});
  const allowed=process.env.DASHBOARD_TEST_CONDITION_IDS?.split(',').map(id=>id.trim().toLowerCase()).filter(Boolean);
  if(allowed?.length && !allowed.includes(conditionId)) return NextResponse.json({error:'Market outside Preview test scope'},{status:403});
  const config=openApiConfig(), directory=process.env.REVIEW_SUMMARY_DIR;
  if(!config || !directory) return NextResponse.json({error:'Offline Review storage or OpenAPI is not configured'},{status:503});
  const identity=createHash('sha256').update(`${config.baseUrl}|${config.apiKey}|${config.apiSecret}`).digest('hex');
  try {
    const result=await savedPortfolioMarket({directory,identity,conditionId,refresh:params.get('refresh')==='1',load:()=>loadBackendReview(conditionId,undefined,true)});
    return NextResponse.json(result,{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Offline review unavailable'},{status:503,headers:{'retry-after':'2'}});
  }
}
