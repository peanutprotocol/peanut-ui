import { isAddress, zeroAddress, type Address } from 'viem'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants/manteca.consts'
import * as Sentry from '@sentry/nextjs'

/**
 * Pick the Manteca deposit recipient for a spend: the API-served
 * entity-aware address when it is a real EVM address, else the local
 * constant fallback.
 *
 * The wire value decides where user USDC is irreversibly sent, so it gets a
 * RUNTIME check — a TypeScript cast validates nothing, and `??` alone would
 * let an empty string (or any malformed value) through. A served value that
 * exists but fails validation is reported to Sentry: after the 2026-09-14
 * entity split the constant fallback may fund the wrong entity, so ops must
 * see it happening.
 */
export function pickMantecaDepositAddress(served: unknown, fallback: Address): Address {
    if (
        typeof served === 'string' &&
        served.length > 0 &&
        isAddress(served, { strict: false }) &&
        served.toLowerCase() !== zeroAddress
    ) {
        return served as Address
    }
    if (served != null && served !== '') {
        Sentry.captureMessage('Manteca depositAddress from API failed validation — using constant fallback', {
            level: 'error',
            extra: { served: String(served).slice(0, 64) },
        })
    }
    return fallback
}

/**
 * Strict variant for the claim-link flow, which spends a ONE-SHOT link with
 * no server-side pre-broadcast validation: a missing, malformed, or zero
 * address must ABORT the flow (returns null), never fall back — after the
 * 2026-09-14 entity split a constant fallback can irreversibly strand the
 * link's funds at the wrong entity.
 */
export function requireMantecaDepositAddress(served: unknown): Address | null {
    if (
        typeof served === 'string' &&
        served.length > 0 &&
        isAddress(served, { strict: false }) &&
        served.toLowerCase() !== zeroAddress
    ) {
        return served as Address
    }
    Sentry.captureMessage('Manteca depositAddress missing or invalid on a fail-closed path', {
        level: 'error',
        extra: { served: served == null ? String(served) : String(served).slice(0, 64) },
    })
    return null
}

/**
 * The bank-withdraw page's spend recipient, extracted so the priceLock →
 * signSpend handoff is testable without the page harness: the price lock's
 * API-served entity address when valid, else the legacy constant (the
 * backend validates this recipient before anything broadcasts, so the
 * fallback is safe there — unlike the claim-link path above).
 */
export function resolveOfframpSpendRecipient(priceLock: { depositAddress?: string } | null): Address {
    return pickMantecaDepositAddress(priceLock?.depositAddress, MANTECA_DEPOSIT_ADDRESS as Address)
}
