import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEngagement, eventEnvironment, exportDate } from '../app/review-engagement.ts';
import { engagementWindow, parseExportLines, takeExportBudget } from '../app/api/dashboard/review-engagement/loader.ts';

const cid = `0x${'b'.repeat(64)}`;
const from = Date.parse('2026-09-14T00:00:00Z'), through = Date.parse('2026-09-15T00:00:00Z');
const row = (event, user, patch = {}) => ({ event, properties: { market_id: '4070060', time: from / 1000 + 60, distinct_id: user, environment: 'preview', ...patch } });

test('environment comes from web environment, app env_mode, then api_env; unknown stays unknown', () => {
  assert.equal(eventEnvironment({ environment: 'prod' }), 'prod');
  assert.equal(eventEnvironment({ environment: 'production' }), 'prod');
  assert.equal(eventEnvironment({ env_mode: 'preview' }), 'preview');
  assert.equal(eventEnvironment({ api_env: 'https://preview-api.buzzing.app' }), 'preview');
  assert.equal(eventEnvironment({ api_env: 'https://prod-api.buzzing.app' }), 'prod');
  assert.equal(eventEnvironment({ page_domain: 'preview.buzzing.app' }), null);
});

test('funnel counts unique users per stage and excludes other markets, environments and times', () => {
  const rows = [
    row('market_detail_enter', 'a'), row('market_detail_enter', 'a'), row('market_detail_enter', 'b'),
    row('market_detail_enter', 'c', { environment: undefined, env_mode: undefined }),
    row('market_detail_enter', 'd', { environment: 'prod' }),
    row('market_detail_enter', 'e', { market_id: '1' }),
    row('market_detail_enter', 'f', { time: through / 1000 + 1 }),
    row('market_trade_panel_enter', 'a'),
    row('bet_option_click', 'a', { environment: undefined, api_env: 'https://preview-api.buzzing.app' }),
    row('market_order_submit', 'a'),
    row('page_view', 'a'),
  ];
  const result = buildEngagement({ rows, conditionId: cid, marketId: '4070060', environment: 'preview', fromMs: from, throughMs: through, complete: true });
  assert.deepEqual(result.stages.map((stage) => [stage.users, stage.events]), [[2, 3], [1, 1], [1, 1], [1, 1]]);
  assert.equal(result.stages[3].conversion, 50);
  assert.equal(result.unattributed, 1);
  assert.equal(result.otherEnvironment, 1);
  assert.match(result.notes.join(''), /无法判定环境/);
});

test('empty market yields zero conversion instead of NaN', () => {
  const result = buildEngagement({ rows: [], conditionId: cid, marketId: '1', environment: 'preview', fromMs: from, throughMs: through, complete: true });
  assert.ok(result.stages.every((stage) => stage.users === 0 && stage.conversion === 0));
});

test('window is bounded to 31 days and open markets are incomplete', () => {
  const now = Date.parse('2026-09-16T00:00:00Z');
  assert.deepEqual(engagementWindow(from, through, now), { fromMs: from, throughMs: through, complete: true });
  const open = engagementWindow(from, null, now);
  assert.equal(open.throughMs, now); assert.equal(open.complete, false);
  const long = engagementWindow(now - 90 * 86_400_000, now - 1, now);
  assert.equal(long.throughMs - long.fromMs, 31 * 86_400_000); assert.equal(long.complete, false);
});

test('hourly export budget refuses excess calls and frees up after an hour', () => {
  const calls = [], now = 1_000_000_000;
  assert.equal(takeExportBudget(now, calls, 2), true);
  assert.equal(takeExportBudget(now + 1, calls, 2), true);
  assert.equal(takeExportBudget(now + 2, calls, 2), false);
  assert.equal(takeExportBudget(now + 3600_001, calls, 2), true);
});

test('export parsing and Raw Export UTC day boundaries', () => {
  assert.equal(parseExportLines('{"event":"a","properties":{}}\n\n{"event":"b","properties":{}}\n').length, 2);
  assert.throws(() => parseExportLines('not json'));
  // An 18:48Z event lives in that UTC day; a Shanghai date would skip it and could exceed Mixpanel's "today".
  assert.equal(exportDate(Date.parse('2026-09-14T18:48:00Z')), '2026-09-14');
  assert.equal(exportDate(Date.parse('2026-09-14T23:59:59Z')), '2026-09-14');
  assert.equal(exportDate(Date.parse('2026-09-15T00:00:00Z')), '2026-09-15');
});
