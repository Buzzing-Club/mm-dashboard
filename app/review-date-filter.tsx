import { currentReviewWeek, reviewDateBounds, type ReviewDateFilter } from './review-market-scope';

export function ReviewDateSelector({ value, onChange, now }: { value: ReviewDateFilter; onChange: (value: ReviewDateFilter) => void; now: number }) {
  const dates = value.mode === 'week' ? currentReviewWeek(now) : value;
  return <div className="review-date-toolbar">
    <span title="按市场结束日期筛选，UTC+8；本周从周一开始。单市场指标保留完整生命周期口径。">市场结束日期 · UTC+8</span>
    <div className="review-period" role="group" aria-label="复盘市场日期范围">
      {([['week', '本周'], ['custom', '自定义'], ['all', '全部历史']] as const).map(([mode, label]) =>
        <button key={mode} type="button" className={value.mode === mode ? 'active' : ''} aria-pressed={value.mode === mode}
          onClick={() => onChange({ ...value, ...(mode === 'custom' && value.mode === 'week' ? currentReviewWeek(now) : {}), mode })}>{label}</button>)}
    </div>
    {value.mode !== 'all' && <div className="review-date-inputs">
      <input type="date" aria-label="市场结束起始日期" value={dates.from} max={dates.to || undefined}
        onChange={event => onChange({ ...dates, mode: 'custom', from: event.target.value })} />
      <span>至</span>
      <input type="date" aria-label="市场结束截止日期" value={dates.to} min={dates.from || undefined}
        onChange={event => onChange({ ...dates, mode: 'custom', to: event.target.value })} />
    </div>}
    {!reviewDateBounds(value, now) && <span role="alert">请选择有效的起止日期</span>}
  </div>;
}
