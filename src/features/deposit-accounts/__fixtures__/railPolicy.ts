import type { ClaimableCorridor, DepositCorridor, DepositRules, SenderPolicy } from '../types'

/**
 * FIXTURES ONLY. Who may pay into a corridor, and the terms behind it.
 *
 * Production never reads this. The backend owns the policy — peanut-api-ts
 * `src/deposit-accounts/bridge-adapter.ts` derives it from
 * `product/providers/fiat/bridge-contracts-and-rail-rules.md` §3 — and the
 * screens read `matching.sender` and `rules` off the response and author
 * neither.
 *
 * It exists because the harness and the demo API each used to encode the same
 * policy separately, which made three sources of truth for one fact. They now
 * both read this table, so a rail rule that changes upstream is wrong in one
 * place instead of two.
 *
 * From §3 and Bridge's rail-specific docs, per corridor. Every rail takes the
 * holder's own transfer; the terms below are about everybody else:
 *   USD — a business unlimited; another person only under $4,000, with a
 *     shared surname exempting family.
 *   EUR — a business unlimited; another person only under 4,000 EUR, with a
 *     shared surname exempting family (assumed parity with the US rail,
 *     pending account-manager confirmation); 1 EUR floor.
 *   GBP — Bridge's pooled entity holds the account, a business unlimited,
 *     another person unavailable, 2 GBP floor.
 *   MXN — the holder up to 1,000,000 MXN, a business unlimited, another
 *     person to a 15,000 MXN volume limit with no period published,
 *     50 MXN floor.
 *   BRL (standing) — a business supported, another person unavailable, the
 *     holder's own transfer fine; 10 BRL floor, 500,000 USD monthly limit.
 *   COP (Bre-B) — a business supported, another person unavailable, the
 *     holder's own transfer fine; 100 COP floor, 11,552,000 COP ceiling.
 *   PIX_BR / ARS — own name only.
 */
export interface DepositRailPolicy {
    sender: SenderPolicy
    rules?: DepositRules
}

export const DEPOSIT_RAIL_POLICY: Record<DepositCorridor, DepositRailPolicy> = {
    ACH_US: {
        sender: 'anyone',
        rules: {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: {
                policy: 'capped',
                capBelow: { amount: '4000', currency: 'USD' },
                familySameSurnameExempt: true,
            },
        },
    },
    SEPA_EU: {
        sender: 'anyone',
        rules: {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: {
                policy: 'capped',
                capBelow: { amount: '4000', currency: 'EUR' },
                familySameSurnameExempt: true,
            },
            min: { amount: '1', currency: 'EUR' },
        },
    },
    FASTER_PAYMENTS_GB: {
        sender: 'business-only',
        rules: {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '2', currency: 'GBP' },
        },
    },
    SPEI_MX: {
        sender: 'anyone',
        rules: {
            ownAccount: { allowed: true, max: { amount: '1000000', currency: 'MXN' } },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'capped', volumeLimit: { amount: '15000', currency: 'MXN' } },
            min: { amount: '50', currency: 'MXN' },
        },
    },
    BANK_TRANSFER_BR: {
        sender: 'business-only',
        rules: {
            ownAccount: { allowed: true },
            // "supported", not "unlimited": §3 names no ceiling and no volume
            thirdPartyBusiness: 'allowed',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '10', currency: 'BRL' },
            monthlyLimit: { amount: '500000', currency: 'USD' },
        },
    },
    // §3 now carries a Colombian row: the `cop` endorsement covers Bre-B both
    // ways, a business is supported, another person unavailable. "supported",
    // not "unlimited", for the same reason as BRL — §3 names no ceiling.
    BANK_TRANSFER_CO: {
        sender: 'business-only',
        rules: {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'allowed',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '100', currency: 'COP' },
            max: { amount: '11552000', currency: 'COP' },
        },
    },
    PIX_BR: { sender: 'own-name-only' },
    BANK_TRANSFER_AR: { sender: 'own-name-only' },
}

/**
 * The same two corridors as a PRE-CLAIM preview: the terms the backend
 * resolves before an account exists, returned as `claimable`. Both the demo
 * API and the fixture registry read these, so the claim step shows one set of
 * terms wherever it is reviewed.
 *
 * `matching` carries no `nameOnAccount` — there is no account to have
 * returned a holder name yet — and the dollar preview is marked `preview`
 * with no `reason`, which is the real case: the residence subdivision was
 * unreadable, so the per-state rule is not in these terms and the claim
 * screen says so.
 */
export const CLAIMABLE_USD_PREVIEW = {
    railId: 'bridge.ach_us',
    method: 'ACH_US',
    country: 'USA',
    currency: 'USD',
    matching: { sender: DEPOSIT_RAIL_POLICY.ACH_US.sender },
    rules: DEPOSIT_RAIL_POLICY.ACH_US.rules,
    preview: true,
} satisfies ClaimableCorridor

/** Euros, resolved in full: nothing about this corridor's terms reads residence. */
export const CLAIMABLE_EUR = {
    railId: 'bridge.sepa_eu',
    method: 'SEPA_EU',
    country: 'DEU',
    currency: 'EUR',
    matching: { sender: DEPOSIT_RAIL_POLICY.SEPA_EU.sender },
    rules: DEPOSIT_RAIL_POLICY.SEPA_EU.rules,
} satisfies ClaimableCorridor
