import { readFile } from 'node:fs/promises';
import { archiveTime, marketArchiveDirectory, readMarketArchive, writeMarketArchive } from '../app/market-archive-store.ts';
import { finite, map, rows } from '../app/review-facts.ts';

// Explicit one-time migration from previously saved QA observations, never today's book.
const file = process.argv[2];
if (!file) throw new Error('Provide verified saved observations JSON');
const records = rows(JSON.parse(await readFile(file, 'utf8')));
let restored = 0;
for (const record of records) {
  const id = String(record.id), archive = await readMarketArchive(marketArchiveDirectory(), id);
  if (!archive?.finalized || archive.lastBook) continue;
  const book = map(record.book), at = archiveTime(book.book_ts_ms ?? book.book_received_at), observedAt = Number(record.observedAt);
  if (!Number.isFinite(at) || !Number.isFinite(observedAt) || at > archive.endAt || observedAt < at || observedAt - at > 120000
    || book.available !== true || [book.best_bid, book.best_ask, book.spread, book.ask_k, book.bid_k].some(value => finite(value) === null)) continue;
  archive.lastBook = { at, value: book };
  archive.note = `结束业务归档已落盘；盘口从已保存的历史观测恢复（${String(record.source)}），采样时间 ${new Date(at).toISOString()}，不是结束瞬时盘口。`;
  await writeMarketArchive(marketArchiveDirectory(), archive);
  restored++;
}
console.log(JSON.stringify({ restored }));
