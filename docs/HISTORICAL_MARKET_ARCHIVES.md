# Historical Market Archives

Historical markets in the realtime dashboard read a durable dashboard archive.
They do not fetch fills or recalculate metrics when selected or refreshed.
This is separate from the offline strategy Review subsystem.

## Storage and lifecycle

- Directory: `REVIEW_SUMMARY_DIR/market-archives/<strategy-and-account-namespace>`.
  Preview mounts `REVIEW_SUMMARY_DIR` on persistent host storage.
- One atomic JSON record per condition. Running checkpoints overwrite that record;
  this is not an accumulating tick log. Files are not automatically expired.
- A standalone collector runs serially through markets, independently of browser visits.
  The systemd timer waits 60 seconds after the previous run finishes, preventing overlap.
  Node heap is limited to 128 MB, source responses to 8 MB, each record to 2 MB.
- While live, save strategy state, the last fresh two-sided book, backend business
  statistics (24h window), and the last 4h of one-minute historical chart data.
  Empty/stale/post-end books cannot overwrite the saved valid book.
- When the strategy archive appears, freeze its lifecycle, events and strategy state.
  The collector supplements missing business fields from historical sources once,
  then persists the result. No samples remain null, not invented zeros.
  Failed/partial finalization gets at most three attempts spaced five minutes apart.
- Final business totals and net-fill slippage cover the historical cutoff, rounded
  down to the last completed minute. Slippage uses the backend first-fill-L1 rule;
  the mean is per fill, while amount buckets group taker orders and weight by notional.
  The stored chart covers the final four hours, not an unlimited tick history.
- If the backend is unavailable at close, retained pre-end observations are shown
  with their actual timestamp and 24h-window provenance, not labelled final totals.
- Completed records are not overwritten by subsequent collector runs. Missing-only
  backfill preserves existing values including zeros and retained series.

## Read path

`GET /api/dashboard/history` embeds the saved business and chart payload in
`dashboard_archive`, and falls back to stored strategy records if the strategy
service is unavailable. `GET /api/dashboard/historical-business` is read-only.
The frontend hydrates all historical cards and details directly from this payload.
The 15m/1h/4h controls slice stored series locally.

Missing pre-end book fields cannot be reconstructed from today's order book.
Old archives may be supplemented only from verifiable previously saved observations;
retain each original observation timestamp and do not invent missing slopes or depth.

## Preview deployment

Deploy the Dashboard `preview` branch, preserving the persistent volume and account
environment. Install `deploy/mm-dashboard-archive.service` and `.timer` in systemd,
then enable/start the timer and run the service once for old-market backfill.
No strategy/prod restart, trading or release-guard bypass is required.

Check `systemctl status mm-dashboard-archive.service`, its journal, and the archived
payloads. Verify: reopen without fills requests, restart retains identical final
records, simulated backend failure returns saved data, and null/zero are distinct.
