import assert from 'node:assert/strict';
import test from 'node:test';
import {l1DistanceLabel} from '../app/l1-distance-label.ts';

test('new L1 threshold labels use absolute price distance',()=>{
  assert.equal(l1DistanceLabel([]),'L1 Distance > 0.1');
  assert.equal(l1DistanceLabel([0.1,0.1]),'L1 Distance > 0.1');
});
test('historical and mixed thresholds are not relabelled as the new threshold',()=>{
  assert.equal(l1DistanceLabel([0.01]),'L1 Distance > 0.01');
  assert.equal(l1DistanceLabel([0.01,0.1]),'L1 Distance · 多阈值');
});
