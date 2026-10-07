# QR sponsorship response investigation — 7 October 2026

The preview payload rejection and the post-release signing failure are related,
but require different fixes. Removing unsupported preparation metadata allows
preview preparation to complete; QR reuse then reaches a validator that assumes
every successful sponsorship response contains an on-chain paymaster. That
assumption excludes UltraRelay's zero-fee, gas-only response.

## Evidence

- [TASK-23174](https://app.notion.com/p/3ea8381175798101af13e9e7f89c903a)
  reports unsupported `paymasterContext` reaching ZeroDev.
- [TASK-23386](https://app.notion.com/p/3f283811757981d3b224f1845709f24d)
  reports the new consuming-response validation failure.
- The fetched `origin/main` at `0d41aa300` and `origin/dev` at `6f0a9db92`
  contain identical `useSignUserOp.ts` and `paymasterSponsorship.ts` files.
  The metadata fix shipped through `0a2fb6b18`, even though the original
  [PR #3555](https://github.com/peanutprotocol/peanut-ui/pull/3555) remains open.
- Live [Sentry T8T](https://peanut-c34d84c05.sentry.io/issues/PEANUT-UI-T8T)
  explicitly reports an unrecognized `paymasterContext` key. Reverting metadata
  stripping would restore this known error.
- Live [Sentry TCK](https://peanut-c34d84c05.sentry.io/issues/PEANUT-UI-TCK)
  and [TCP](https://peanut-c34d84c05.sentry.io/issues/PEANUT-UI-TCP) show the
  failure in `consumeSponsorship`, reached through `reusePreparedUserOp`.
  At inspection they contained 8 events/2 users and 2 events/1 user respectively.
  Neither event supplied the rejected response shape.
- Production client configuration intentionally sets both fee fields to zero
  for Arbitrum's UltraRelay route. The ordinary viem preparation path accepts
  responses without a paymaster; the custom reuse validator did not.
- [ZeroDev's UltraRelay documentation](https://docs.zerodev.app/smart-accounts/sponsor-gas/evm)
  describes zero-fee operations and explicitly permits omitting paymaster
  middleware.

## Live reproduction

Using the installed `@zerodev/sdk` 5.5.7 and viem 2.55.0, a newly generated,
unfunded Kernel account previewed a zero-value self-call and a zero-amount USDC
transfer through the reported Arbitrum ZeroDev endpoint. Every request set
`shouldConsume=false`; nothing was signed or broadcast.

The raw response contained only:

```text
preVerificationGas
verificationGasLimit
callGasLimit
paymasterVerificationGasLimit
paymasterPostOpGasLimit
```

The paymaster gas limits were zero. The SDK converted gas values to bigints,
returned undefined `paymaster` and `paymasterData`, and retained the request's
zero fees. This succeeds in ordinary viem preparation but is rejected by the
old reuse validator. The patched validator accepted the live SDK result.
Removing existing preview paymaster fields from the refresh request did not
change this response shape.

The user also authorized replaying an older recorded preview request. Its
original nonce was stale; reading the current nonce and retrying the unsigned,
non-consuming preview instead failed because the transfer amount exceeded the
sender's current balance. That replay therefore cannot establish the historical
consuming response. The live synthetic result demonstrates a concrete validator
bug consistent with the production failure, rather than proving every TCK/TCP
event had that exact response.

## Repair and verification

Accept a response without paymaster fields only when the operation is on
Arbitrum, its effective fee fields are both zero, both paymaster fields are
absent, and both returned paymaster gas limits are zero. Validate all gas and
fee values as nonnegative bigints. Conventional sponsorship remains supported.

Explicitly clear all four preview paymaster fields before signing a gas-only
refresh. Preserve non-consuming preview preparation and exactly one consuming
callback at Pay; malformed responses still propagate without a second consuming
request. Attach only response field names/types to the existing Sentry capture
so future invalid shapes are diagnosable without recording response values.

Regression coverage exercises real SDK normalization in a child process outside
Jest's SDK mock, full preview-to-sign reuse through real viem preparation,
clearing stale preview sponsorship, invalid/partial responses, positive fees,
other chains, and no automatic re-consumption after failure.

After release, verify successful `preparation_origin=reused` signing and payment
completion, and compare QR signing failures with the pre-release baseline.
Local tests and preview probes do not establish a successful production payment.
