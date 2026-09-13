import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReviewNumber, formatReviewTooltip } from '../app/review-number-format.ts';

test('review numbers use two fixed decimals including trailing zeros', () => {
  for (const [value, expected] of [[22.22222222222222,'22.22'],[1,'1.00'],[12.3,'12.30'],[0,'0.00'],[-0,'0.00'],[0.01,'0.01'],[-1250.126,'-1,250.13']]) {
    assert.equal(formatReviewNumber(value),expected);
  }
});
test('small nonzero values keep two significant digits and their sign', () => {
  for (const [value, expected] of [[0.001234,'0.0012'],[-0.0004567,'-0.00046'],[0.001,'0.0010'],[0.009999,'0.010'],[1.234e-9,'0.0000000012']]) {
    assert.equal(formatReviewNumber(value),expected);
  }
});
test('tooltip formatting does not change raw numbers or invent missing values', () => {
  const values = [22.22222222222222, 0.0001234];
  assert.equal(formatReviewTooltip(values),'22.22 ~ 0.00012');
  assert.equal(values[0],22.22222222222222);
  assert.equal(formatReviewTooltip(null),'--');
  assert.equal(formatReviewTooltip('盘中'),'盘中');
  for (const value of [NaN,Infinity,-Infinity]) assert.equal(formatReviewNumber(value),'--');
});
