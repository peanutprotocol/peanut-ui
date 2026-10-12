# Screen Library viewer checklist

- Invalid input: only nonnegative safe integer screen counts are known; missing or malformed counts remain unknown and visible (user decision, 2026-10-13).
- Concurrency and idempotency: filtering is synchronous and read-only; repeated toggle changes must restore the same catalogue.
- Timeouts, retries and partial failure: introduce no requests or retries; preserve existing load/auth failures and reports.
- Auth: filter only already-authorized catalogue data; preserve Cloudflare Access boundaries.
- Limits: filter the loaded index once; do not fetch individual reports to determine counts.
- Compatibility: preserve legacy entries, source/branch/locale/profile/date controls and report deep links. Default the new toggle on for old URLs.
- Accessibility: use a labelled native checkbox with switch semantics, keyboard focus and responsive wrapping.
- Verification: Node screen tests, formatting/lint for changed files, disposable toggle mutation, desktop/mobile browser inspection when available.

Undecided: None for this change. Live deployment is outside this change.
