# Google Play crash monitor

The [Play Vitals workflow](../.github/workflows/play-vitals.yml) checks Android
user-perceived crash groups and the 7-day crash rate every six hours. It uses
`PLAY_SERVICE_ACCOUNT_JSON` from the existing `Production` GitHub environment.
The workflow calls read-only Google Play Developer Reporting API methods.
No new key, GitHub secret, or credential on Chip's host is required.

Each successful scheduled run publishes a two-day Actions artifact. It contains
only hashed issue IDs, P1/P2/P3 severity, and check time. It contains no crash
text, stack trace, version, user count, or Play credential. This repository is
public, so treat the artifact as public. Chip's
[`prod-watch`](https://github.com/peanutprotocol/mono/tree/main/ops/schedulers/prod-watch)
reads it and owns Discord routing, deduplication, recovery, and Notion tasks.

The workflow keeps private state in an Actions cache to avoid escalating an old
issue when reports have not changed. The first successful run seeds existing
crashes at P3. New issues reach P2 at two affected users and P1 at five.
The 7-day rate starts at P3 when already high; a fresh high daily point reaches
P2. The Google Play overall threshold is 1.09%.

## Activation

1. Confirm `playdeveloperreporting.googleapis.com` is enabled in the Google
   Cloud project for `play-publisher@peanut-489021.iam.gserviceaccount.com`.
   API status could not be verified with the current Cloud Console account.
2. Merge this workflow and the paired `mono` detector. The Production
   environment allows `main`, `dev`, and `release/android-kyc`; this branch
   cannot use its key for a live check.
3. On `main`, dispatch the workflow with `dry_run=true` and check that it
   succeeds without revealing Play data in public Actions logs.
4. Confirm the first scheduled run publishes `play-vitals-signals`. Run
   `PROD_WATCH_ONLY=play-vitals DRY_RUN=1` on Chip's monitor to check the feed
   before relying on Discord alerts.

A failed Play API call fails the workflow. Chip's existing `jobs` detector
watches repeated scheduled workflow failures. Play Vitals can lag and covers
opted-in Play installs; Sentry remains the faster source for live triage.
