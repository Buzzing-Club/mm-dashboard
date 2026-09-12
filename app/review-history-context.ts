import { epochMs, map, rows, selectReviewJob, type Fact, type ReviewFacts } from './review-facts.ts';

export function hasReviewBounds(market: Fact | undefined) {
  const start = epochMs(market?.start_time) ?? epochMs(market?.create_time);
  const end = epochMs(market?.end_time);
  return start !== null && end !== null && end > start;
}

// Recover only the requested market. Never mutate the shared live-source cache.
export function recoverReviewContext(conditionId: string, source: ReviewFacts, history: unknown, observations: unknown) {
  let result = source;
  const historical = map(history);
  const archived = historical.contract_version === 'mm-dashboard-history.v1'
    ? rows(historical.items).filter(item => map(item.identity).condition_id === conditionId) : [];
  const archive = archived.length === 1 ? archived[0] : undefined;
  let job = selectReviewJob(conditionId, result);
  if (!job && archive) {
    const identity = map(archive.identity);
    if (identity.job_type === 'market_maker' && identity.account_id != null && identity.job_id != null) {
      job = identity;
      result = { ...result, jobs: { ...result.jobs, rows: [...result.jobs.rows, job], available: true } };
    }
  }
  const raw = map(observations);
  const candidates = raw.contract_version === 'mm-review-observations.v1' ? rows(raw.items).filter(item =>
    item.condition_id === conditionId && item.job_type === 'market_maker' && !item.observation_failed &&
    (!job || (String(item.account_id) === String(job.account_id) && String(item.job_id) === String(job.job_id)))
  ) : [];
  const observed = candidates.length === 1 ? candidates[0] : undefined;
  if (!job && observed?.account_id != null && observed.job_id != null) {
    job = observed;
    result = { ...result, jobs: { ...result.jobs, rows: [...result.jobs.rows, job], available: true } };
  }
  const market = result.catalog.rows.find(item => item.condition_id === conditionId);
  if (hasReviewBounds(market)) return result;
  let recovered: Fact | undefined;
  if (archive && hasReviewBounds(map(archive.lifecycle))) {
    recovered = { ...map(archive.identity), ...map(archive.lifecycle) };
  } else if (observed) {
    const capture = map(observed.observations);
    if (capture.contract_version === 'mm-review-observations.v1' && map(capture.coverage).phase_bounds_valid === true && hasReviewBounds(capture)) {
      recovered = { condition_id: conditionId, start_time: capture.start_time, end_time: capture.end_time };
    }
  }
  if (!recovered) return result;
  return { ...result, catalog: { ...result.catalog, available: true, rows: [
    ...result.catalog.rows.filter(item => item.condition_id !== conditionId),
    { ...market, ...recovered, condition_id: conditionId },
  ] } };
}
