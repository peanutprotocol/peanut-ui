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
 * From §3, per corridor:
 *   USD — third-party permitted; from a person only under $4,000; a shared
 *     surname exempts family; businesses unlimited.
 *   EUR — businesses unlimited, individuals not agreed with the account
 *     manager yet, 1 EUR floor.
 *   GBP — Bridge's pooled entity holds the account, business payments only.
 *   MXN — Bridge documents no third-party policy, and silence is not
 *     permission.
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
            individualPerPaymentCap: { amount: '4000', currency: 'USD' },
            familySameSurnameExempt: true,
            businessesUnlimited: true,
        },
    },
    SEPA_EU: {
        sender: 'business-only',
        rules: { businessesUnlimited: true, individualsAllowed: false, min: { amount: '1', currency: 'EUR' } },
    },
    FASTER_PAYMENTS_GB: { sender: 'business-only' },
    SPEI_MX: { sender: 'unknown' },
    PIX_BR: { sender: 'own-name-only' },
    BANK_TRANSFER_AR: { sender: 'own-name-only' },
}
