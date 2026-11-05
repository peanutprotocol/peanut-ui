# Google Play crash monitor

The [Play Vitals workflow](../.github/workflows/play-vitals.yml) checks Android
user-perceived crash groups and the 7-day crash rate every six hours. It uses
`PLAY_VITALS_SERVICE_ACCOUNT_JSON` from its own `play-vitals` GitHub
environment, which only `main` can use. That key belongs to a separate Play
service account with read-only access to app reports; it cannot publish.
The release key stays in `Production`, which needs a reviewer's approval for
each deploy. The workflow calls read-only Google Play Developer Reporting API
methods. No credential on Chip's host is required.

Each successful scheduled run publishes a two-day Actions artifact. It contains
only hashed issue IDs, P1/P2/P3 severity, and check time. It contains no crash
text, stack trace, version, user count, or Play credential. This repository is
public, so treat the artifact as public. Chip's
[`prod-watch`](https://github.com/peanutprotocol/mono/tree/main/ops/schedulers/prod-watch)
reads it and owns Discord routing, deduplication, recovery, and Notion tasks.

The workflow encrypts its state with keys derived from the Play credential
before saving it to an Actions cache. Fork PRs can read caches from the base
branch, so the cache must not contain plain crash counts or report
times. The first successful run seeds existing
crashes at P3. New issues reach P2 at two affected users and P1 at five.
The 7-day rate starts at P3 when already high; a fresh high daily point reaches
P2. The Google Play overall threshold is 1.09%. If the key rotates or the
service account changes, change the cache key prefix in the workflow to start a new
baseline. An old cache will fail authentication rather than report a false recovery.

## Activation

1. In the Google Cloud project of the Play publisher account
   (`peanut-489021`), enable `playdeveloperreporting.googleapis.com` and create
   a service account for this check, with no Cloud IAM roles. Create a JSON key.
2. In Play Console, Users and permissions, invite the service account email.
   Give it only "View app information (read-only)" for the Peanut app.
3. Create the `play-vitals` environment, limited to `main`, and save the JSON
   key as its `PLAY_VITALS_SERVICE_ACCOUNT_JSON` secret.
4. On `main`, dispatch the workflow with `dry_run=true` and check that it
   succeeds without revealing Play data in public Actions logs.
5. Confirm the first scheduled run publishes `play-vitals-signals`. Run
   `PROD_WATCH_ONLY=play-vitals DRY_RUN=1` on Chip's monitor to check the feed
   before relying on Discord alerts.

A failed Play API call fails the workflow. Chip's existing `jobs` detector
watches repeated scheduled workflow failures. Play Vitals can lag and covers
opted-in Play installs; Sentry remains the faster source for live triage.
