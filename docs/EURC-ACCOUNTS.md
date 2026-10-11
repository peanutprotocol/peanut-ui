# EURC accounts

Home starts with USDC. An optional `+` enrolls native Base EURC. Existing USDC
payments, card spending power and dollar history retain their existing behavior.
EURC has a separate six-decimal euro balance, receive QR/address, send, indicative
USDC exchange, SEPA funding/withdrawal, history and operation status/receipt views.
Bank-account creation uses the existing SEPA form and authentication flow.

Deploy API PR #1806 and its two migrations before this frontend. Build with
`NEXT_PUBLIC_EURC_BASE_BUNDLER_URL` and `NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL` for
Base mainnet EntryPoint 0.7. Both must be configured before actions are exposed,
including Confirm on an operation opened from history; the recovery Base URLs are
not a substitute.
Backend capabilities additionally gate each action by rollout, provider
verification and residence eligibility. UI configuration alone cannot enable an
action. Never put the dedicated backend deployer's private key in frontend env.

Signing uses the existing passkey Kernel client and legacy-validator migration
path. The browser signs the exact native-token transfer; the backend validates
it and journals it before broadcasting. Signed bytes are kept in localStorage
under `eurc-signed-operation:<userId>:<operationId>`, reused unchanged on retry
and after a reload, and removed on a final status or logout. When device storage
is unavailable they stay in memory for the session. A retry first probes the
operation, and one in-flight guard per operation survives remounts and tab
switches, so a reload never asks for a second signature. After an expired
submission the operation is re-probed and can be cancelled.

The open account, action and operation live in the URL (`currency`, `action`,
`operation`), so a reload returns to the same screen; signed bytes never appear
in the URL. Every backend status has its own screen: a polled `READY` shows
Confirm and `AWAITING_FUNDS` shows the bank instructions. Amount fields accept
comma decimals in es and pt locales without rounding. History loads further pages
through the backend cursor.

Reference exchange rates are indicative, and final provider rates/fees may vary.
The review displays the exact source amount and the completed receipt displays
actual settlement. Card payments continue to use USDC. EURC is excluded from Rain
spending power. Account queries are scoped by user and balance queries also by
chain, token and address; switching login resets selection and dialogs.

Strings cover en, es-419, es-AR and pt-BR. Demo and fixtures are synthetic and do
not query balances, invoke WebAuthn, or broadcast operations. Fixtures include
`home-add-eurc`, `home-eurc` and `home-add-eurc-error`. Notification links can select
an existing EURC account using `/home?currency=EURC`; regular Home opens USDC.
Deletion refusals identify EURC funds or pending operations, show a localized
euro-specific explanation, and return to the EURC account to resolve them.
Dollar refusals retain their existing amount and withdrawal destination.

Direct USD sends, send-by-link and EURC sends show an estimated total across
USDC and EURC below the sending-currency balance when that balance is short.
The other account is valued in the sending currency at Bridge's directional
`sell_rate`, never midmarket. Decimal math truncates instead of rounding up.
Cached or unavailable dollar balances never feed a total: they show the
unavailable state, and Retry refetches every source. Rates refresh every 30
seconds; missing balances or failed pricing show an unavailable state, never a
partial total. USDC-only accounts make no Base balance or conversion request.
The estimate does not change payment validation, the full-balance fill amount,
or signing; users must exchange into the sending currency before paying.

The release gate in the backend's `src/currency-accounts/README.md` is required:
tenant dry-runs, funded Base deployer and sponsorship configuration, actual bank
flows, passkey signing and recovery on a second device, all locales, final-head CI
and visual/native acceptance. These external checks have not been proved by unit
or PostgreSQL tests. Keep backend rollout flags off until evidence is recorded.

Home and Profile fit their original wordiness allowances. The EURC bank screen
has one baseline entry (87 words): its own copy fits the budget, and the rest
comes from the shared SEPA form's validation messages.
