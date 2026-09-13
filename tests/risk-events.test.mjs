import assert from 'node:assert/strict';
import test from 'node:test';
import { abnormalRiskEvents } from '../app/risk-events.ts';

test('only abnormal risk events are shown; normal recoveries and heartbeats are hidden', () => {
  const events = [
    {type:'normal_quote',severity:'ok'},
    {type:'NORMAL',severity:'warn'},
    {type:'正常摆单',severity:'bad'},
    {type:'heartbeat',severity:'ok'},
    {type:'paused',severity:'warn'},
    {type:'adverse_flow_protection',severity:'bad'},
    {type:'data',severity:'warn'},
  ];
  assert.deepEqual(abnormalRiskEvents(events), events.slice(4));
  assert.equal(events.length, 7);
  assert.deepEqual(abnormalRiskEvents(events.slice(0,4)), []);
});
