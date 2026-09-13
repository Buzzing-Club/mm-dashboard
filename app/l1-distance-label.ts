export const DEFAULT_L1_DISTANCE_THRESHOLD = 0.1;

export function l1DistanceLabel(thresholds: number[]) {
  const values = [...new Set(thresholds.filter(value => Number.isFinite(value) && value > 0))];
  if (values.length > 1) return 'L1 Distance · 多阈值';
  return `L1 Distance > ${values[0] ?? DEFAULT_L1_DISTANCE_THRESHOLD}`;
}

export const L1_DISTANCE_DESCRIPTION = '闪单提交时与对应一档价格的绝对价差超过标注阈值的事件数，不是成交笔数。0.1 表示 10 个百分点，不除以一档价格。当前筛选市场合计；历史快照沿用采集时阈值，多阈值合计需查看单市场口径。';
