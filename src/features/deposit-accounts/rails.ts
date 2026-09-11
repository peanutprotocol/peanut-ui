import type { DepositCorridor, DepositRail, SenderPolicy } from './types'

/**
 * Who Bridge lets pay into a virtual account, per currency.
 *
 * Source: `product/providers/fiat/rails/virtual-accounts.md` — "BRL, GBP and
 * COP say 'only 1st party and 3rd party business payments supported'. USD, EUR
 * and MXN carry no note either way — the docs are silent, not permissive."
 * USD is the one corridor with positive evidence of a private payer: Bridge
 * runs a person-to-person cap on it and exempts businesses, and a cap on a
 * thing is evidence the thing is allowed (`product/providers/fiat/ASSESSMENT.md`).
 *
 * Everything else stays `unknown` until Bridge answers, because the screens
 * only promise what a corridor can prove. A product build gets this per
 * account from the backend contract and deletes this map.
 */
const BRIDGE_SENDER_POLICY: Record<string, SenderPolicy> = {
    USD_ACH: 'anyone',
    GBP_FPS: 'business-only',
    EUR_SEPA: 'unknown',
    MXN_SPEI: 'unknown',
}

export function bridgeSenderPolicy(corridor: DepositCorridor): SenderPolicy {
    return BRIDGE_SENDER_POLICY[corridor] ?? 'unknown'
}

/**
 * The corridor catalogue: structure only. Every sentence a user reads lives in
 * the message catalog under `depositAccounts.corridors`, keyed by corridor —
 * rail names included, because "ACH or wire" and "Bank transfer" are English
 * sentences wearing a proper noun's clothes. Only the invariant part (SEPA,
 * SPEI, Pix) is a real proper noun, and the catalog holds it anyway so one
 * lookup answers the whole label.
 */
export const DEPOSIT_RAILS: Record<DepositCorridor, DepositRail> = {
    EUR_SEPA: {
        corridor: 'EUR_SEPA',
        currency: 'EUR',
        provider: 'bridge',
        flagIso2: 'eu',
        detailRowCount: 7,
        expectedSender: 'unknown',
    },
    GBP_FPS: {
        corridor: 'GBP_FPS',
        currency: 'GBP',
        provider: 'bridge',
        flagIso2: 'gb',
        detailRowCount: 6,
        expectedSender: 'business-only',
    },
    USD_ACH: {
        corridor: 'USD_ACH',
        currency: 'USD',
        provider: 'bridge',
        flagIso2: 'us',
        detailRowCount: 7,
        expectedSender: 'anyone',
        personCap: '$4,000',
    },
    MXN_SPEI: {
        corridor: 'MXN_SPEI',
        currency: 'MXN',
        provider: 'bridge',
        flagIso2: 'mx',
        detailRowCount: 3,
        expectedSender: 'unknown',
    },
    BRL_PIX: {
        corridor: 'BRL_PIX',
        currency: 'BRL',
        provider: 'manteca',
        flagIso2: 'br',
        detailRowCount: 3,
        expectedSender: 'own-name-only',
        claimable: false,
        topUpHref: '/add-money/brazil',
    },
    ARS_TRANSFER: {
        corridor: 'ARS_TRANSFER',
        currency: 'ARS',
        provider: 'manteca',
        flagIso2: 'ar',
        detailRowCount: 5,
        expectedSender: 'own-name-only',
        claimable: false,
        topUpHref: '/add-money/argentina',
    },
}

export const DEPOSIT_RAIL_ORDER: DepositCorridor[] = [
    'EUR_SEPA',
    'GBP_FPS',
    'USD_ACH',
    'MXN_SPEI',
    'BRL_PIX',
    'ARS_TRANSFER',
]

/** a corridor a user can hold as a reusable account somebody else can pay into */
export function isClaimable(rail: DepositRail): boolean {
    return rail.claimable !== false
}

/** may these details be handed to somebody else at all */
export function isShareable(sender: SenderPolicy): boolean {
    return sender === 'anyone' || sender === 'business-only'
}
