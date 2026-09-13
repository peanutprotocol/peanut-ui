import type { DepositCorridor, DepositRules, SenderPolicy } from '../types'

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
 *   EUR — a business unlimited, another person not agreed with the account
 *     manager yet, 1 EUR floor.
 *   GBP — Bridge's pooled entity holds the account, a business unlimited,
 *     another person unavailable, 2 GBP floor.
 *   MXN — the holder up to 1,000,000 MXN, a business unlimited, another
 *     person to a 15,000 MXN volume limit with no period published,
 *     50 MXN floor.
 *   BRL / ARS — own name only.
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
        sender: 'business-only',
        rules: {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'unavailable' },
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
    PIX_BR: { sender: 'own-name-only' },
    BANK_TRANSFER_AR: { sender: 'own-name-only' },
}
