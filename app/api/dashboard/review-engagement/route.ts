import { NextResponse } from 'next/server';
import { validConditionId } from '../openapi';
import { loadReviewEngagement } from './loader';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const conditionId = validConditionId(new URL(request.url).searchParams.get('condition_id'));
  if (!conditionId) return NextResponse.json({ error: 'valid condition_id is required' }, { status: 400 });
  try {
    return NextResponse.json(await loadReviewEngagement(conditionId), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Engagement unavailable' }, { status: 503, headers: { 'retry-after': '30' } });
  }
}
