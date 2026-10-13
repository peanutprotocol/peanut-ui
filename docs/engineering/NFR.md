# Push identity checklist

- Explicit logout detaches this device from the account; generic push remains enabled.
- Latest identity wins; duplicate requests must not create duplicate subscriptions.
- SDK failures are unknown and retryable; startup reconciles after auth resolution.
- Bound the push wait during logout; no unbounded retries or batch work.
- No account IDs, push tokens, or notification bodies in new telemetry.
- Web and Capacitor retain existing OneSignal interfaces; no schema change.
- Verify Jest notification/auth tests, lint, TypeScript, concurrency/fault cases.
- Local `.codex/quality-gates.json` runs the relevant auth/notification Jest suites and full ESLint within 300 seconds. Full repository Jest/TypeScript and hosted branch protections remain the CI merge boundary; local focused checks are not a replacement.

Undecided: production rollout owner and provider-level suppression for account payloads already queued before logout. Device/provider delivery is separate evidence.
