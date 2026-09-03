import { isAddress, type Address } from 'viem'
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
    if (typeof served === 'string' && served.length > 0 && isAddress(served, { strict: false })) {
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
