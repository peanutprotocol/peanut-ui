import type { DepositCorridor, DepositRail } from './types'

/**
 * The corridor catalogue: structure only. Every sentence a user reads about a
 * corridor lives in the message catalog under `depositAccounts.corridors`,
 * keyed by corridor id — rail names stay here because SEPA, Pix and SPEI are
 * proper nouns in every locale.
 *
 * `thirdPartyCap` is a value, not a sentence: it is the amount somebody else
 * may send in one payment, and it is only set where we have proof. USD's
 * comes from the 2026-08-24 Bridge PoC. No other corridor claims a number.
 */
export const DEPOSIT_RAILS: Record<DepositCorridor, DepositRail> = {
    EUR_SEPA: {
        corridor: 'EUR_SEPA',
        currency: 'EUR',
        provider: 'bridge',
        railName: 'SEPA',
        flagIso2: 'eu',
        detailRowCount: 6,
    },
    GBP_FPS: {
        corridor: 'GBP_FPS',
        currency: 'GBP',
        provider: 'bridge',
        railName: 'Faster Payments',
        flagIso2: 'gb',
        detailRowCount: 6,
    },
    USD_ACH: {
        corridor: 'USD_ACH',
        currency: 'USD',
        provider: 'bridge',
        railName: 'ACH or wire',
        flagIso2: 'us',
        detailRowCount: 6,
        thirdPartyCap: '$4,000',
    },
    MXN_SPEI: {
        corridor: 'MXN_SPEI',
        currency: 'MXN',
        provider: 'bridge',
        railName: 'SPEI',
        flagIso2: 'mx',
        detailRowCount: 3,
    },
    BRL_PIX: {
        corridor: 'BRL_PIX',
        currency: 'BRL',
        provider: 'manteca',
        railName: 'Pix',
        flagIso2: 'br',
        detailRowCount: 3,
        claimable: false,
    },
    ARS_TRANSFER: {
        corridor: 'ARS_TRANSFER',
        currency: 'ARS',
        provider: 'manteca',
        railName: 'Bank transfer',
        flagIso2: 'ar',
        detailRowCount: 5,
        claimable: false,
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
