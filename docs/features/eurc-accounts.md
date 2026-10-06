# EURC accounts

Home starts with USDC. An optional `+` enrolls native Base EURC. Existing USDC
payments, card spending power and dollar history retain their existing behavior.
EURC has a separate six-decimal euro balance, receive QR/address, send, indicative
USDC exchange, SEPA funding/withdrawal, history and operation status/receipt views.
Bank-account creation uses the existing SEPA form and authentication flow.

Deploy API PR #1806 and its two migrations before this frontend. Build with
`NEXT_PUBLIC_EURC_BASE_BUNDLER_URL` and `NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL` for
Base mainnet EntryPoint 0.7. Both must be configured before actions are exposed.
Backend capabilities additionally gate each action by rollout, provider
verification and residence eligibility. UI configuration alone cannot enable an
action. Never put the dedicated backend deployer's private key in frontend env.

Signing uses the existing passkey Kernel client and legacy-validator migration
path. The browser signs the exact native-token transfer; the backend validates
it and journals it before broadcasting. A retry first probes the operation and
reuses signed bytes on ambiguous HTTP failure. Returning from a reload opens the
persisted operation without silently initiating a second payment.

Reference exchange rates are indicative, and final provider rates/fees may vary.
The review displays the exact source amount and the completed receipt displays
actual settlement. Card payments continue to use USDC. EURC is excluded from Rain
spending power. Account queries are scoped by user and balance queries also by
chain, token and address; switching login resets selection and dialogs.

Strings cover en, es-419, es-AR and pt-BR. Demo and fixtures are synthetic and do
not query balances, invoke WebAuthn, or broadcast operations. Fixtures include
`home-add-eurc`, `home-eurc` and `home-add-eurc-error`. Notification links can select
an existing EURC account using `/home?currency=EURC`; regular Home opens USDC.

The release gate in the backend's `docs/features/eurc-accounts.md` is required:
tenant dry-runs, funded Base deployer and sponsorship configuration, actual bank
flows, passkey signing and recovery on a second device, all locales, final-head CI
and visual/native acceptance. These external checks have not been proved by unit
or PostgreSQL tests. Keep backend rollout flags off until evidence is recorded.

The new SEPA form wordiness allowance matches the existing SEPA withdrawal form
(141 words); Home's account selector allowance grew from 394 to 437 words to
cover enrollment, asset/network availability and retry states. These are explicit
feature copy allowances, not a blanket baseline regeneration.
