import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeDashboardMarkets } from '../app/dashboard-test-scope.ts';

const a = '0x' + 'a'.repeat(64);
const b = '0x' + 'b'.repeat(64);
const payload = { items: [{identity:{condition_id:a}}, {identity:{condition_id:b}}, {}], source:'strategy' };
test('unconfigured scope preserves normal deployment', () => assert.equal(scopeDashboardMarkets(payload), payload));
test('scope keeps only selected markets without mutating source', () => {
  const scoped = scopeDashboardMarkets(payload, a.toUpperCase());
  assert.equal(scoped.items.length, 1);
  assert.equal(scoped.source, 'strategy');
  assert.equal(scoped.display_scope, 'PREVIEW QA');
  assert.equal(payload.items.length, 3);
});
test('empty scoped history stays empty', () => assert.deepEqual(scopeDashboardMarkets({items:[]}, a).items, []));
test('invalid scope fails instead of displaying all markets', () => assert.throws(() => scopeDashboardMarkets(payload, 'invalid')));
