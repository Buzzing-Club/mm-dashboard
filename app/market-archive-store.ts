import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finite, map, type Fact } from './review-facts.ts';

export type MarketArchive = {
  version: 1; id: string; finalized: boolean; capturedAt: number; endAt: number;
  strategy: Fact; lastBook?: { at: number; value: Fact };
  liveBusiness?: { at: number; value: Fact }; liveHistory?: { at: number; value: Fact };
  business?: Fact; attempts: number; nextAttemptAt?: number; complete?: boolean; note?: string;
};
const MAX_BYTES = 2_000_000;
const validId = (id: string) => /^0x[a-f0-9]{64}$/i.test(id);

export function marketArchiveDirectory() {
  const identity = createHash('sha256').update([process.env.STRATEGY_DASHBOARD_API, process.env.OPENAPI_BASE_URL, process.env.OPENAPI_API_KEY].join('|')).digest('hex').slice(0, 24);
  return join(process.env.REVIEW_SUMMARY_DIR ?? '/tmp/mm-review-summaries', 'market-archives', identity);
}

export async function readMarketArchive(directory: string, id: string): Promise<MarketArchive | null> {
  if (!validId(id)) return null;
  const path = join(directory, `${id.toLowerCase()}.json`);
  try {
    if ((await stat(path)).size > MAX_BYTES) throw new Error('oversized archive');
    const data = JSON.parse(await readFile(path, 'utf8')) as MarketArchive;
    if (data.version !== 1 || data.id !== id.toLowerCase() || map(data.strategy.identity).condition_id !== data.id) throw new Error('invalid archive identity');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeMarketArchive(directory: string, data: MarketArchive) {
  if (!validId(data.id) || map(data.strategy.identity).condition_id !== data.id) throw new Error('invalid archive identity');
  const content = JSON.stringify(data);
  if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('archive exceeds size limit');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `${data.id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await rename(temporary, join(directory, `${data.id}.json`));
  } finally { await unlink(temporary).catch(() => {}); }
}

export async function listMarketArchives(directory: string, limit = 500): Promise<MarketArchive[]> {
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const result: MarketArchive[] = [];
  let bytes = 0;
  for (const file of files.filter(file => /^0x[a-f0-9]{64}\.json$/.test(file))) {
    const data = await readMarketArchive(directory, file.slice(0, -5));
    if (data?.finalized) {
      result.push(data);
      result.sort((a, b) => b.endAt - a.endAt);
      if (result.length > limit) result.pop();
      bytes = result.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item)), 0);
      while (bytes > 8_000_000 && result.length > 1) bytes -= Buffer.byteLength(JSON.stringify(result.pop()));
    }
  }
  return result.sort((a, b) => b.endAt - a.endAt).slice(0, limit);
}

export function archiveTime(value: unknown): number {
  const n = finite(value);
  if (n !== null && n > 0) return n > 1e12 ? n : n * 1000;
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

// This is an overwrite-only last-valid checkpoint, not a growing tick history.
export function captureLiveArchive(previous: MarketArchive | null, item: Fact, now: number, business?: Fact, history?: Fact): MarketArchive {
  if (previous?.finalized) return previous;
  const id = String(map(item.identity).condition_id);
  const lifecycle = map(item.lifecycle), endAt = archiveTime(lifecycle.end_time);
  if (!validId(id) || !Number.isFinite(endAt) || now >= endAt) throw new Error('not a live market');
  const result: MarketArchive = { ...previous, version: 1, id, finalized: false, capturedAt: now, endAt, strategy: item, attempts: 0 };
  const book = map(item.orderbook_quality);
  const bookAt = archiveTime(book.book_ts_ms ?? book.book_received_at);
  if (book.available === true && Number.isFinite(bookAt) && bookAt <= now && now - bookAt <= 120_000
    && finite(book.best_bid) !== null && finite(book.best_ask) !== null && finite(book.spread) !== null
    && (finite(book.ask_k) !== null && finite(book.bid_k) !== null || !previous?.lastBook)) {
    result.lastBook = { at: bookAt, value: book };
  }
  if (business) result.liveBusiness = { at: now, value: business };
  if (history) result.liveHistory = { at: now, value: history };
  return result;
}

export function archivedStrategy(data: MarketArchive): Fact {
  const item = { ...data.strategy };
  const lastBook = data.lastBook;
  if (lastBook && lastBook.at <= data.endAt) item.orderbook_quality = lastBook.value;
  item.dashboard_archive = {
    storage: 'disk', captured_at: data.capturedAt, end_at: data.endAt,
    book_at: lastBook?.at ?? null, book_status: lastBook ? 'last_valid_pre_end' : 'not_retained',
    business: data.business ?? null, note: data.note ?? '已落盘；展示不再查询后端',
  };
  return item;
}
