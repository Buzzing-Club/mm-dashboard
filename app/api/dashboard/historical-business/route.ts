import { NextResponse } from 'next/server';
import { marketArchiveDirectory, readMarketArchive } from '../../../market-archive-store.ts';
import { validConditionId } from '../openapi.ts';

export const runtime = 'nodejs';

// Read-only compatibility endpoint. Finalization belongs to the collector, never a page request.
export async function GET(request: Request) {
  const id = validConditionId(new URL(request.url).searchParams.get('condition_id'));
  if (!id) return NextResponse.json({ error: 'valid condition_id is required' }, { status: 400 });
  try {
    const archive = await readMarketArchive(marketArchiveDirectory(), id);
    if (!archive?.finalized || !archive.business) return NextResponse.json({ error: '历史业务快照未留存', storage: 'missing' }, { status: 404 });
    return NextResponse.json({ ...archive.business, storage: 'disk' }, { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: '历史快照读取失败' }, { status: 503 }); }
}
