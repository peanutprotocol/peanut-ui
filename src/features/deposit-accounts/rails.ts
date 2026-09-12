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
    ACH_US: 'anyone',
    FASTER_PAYMENTS_GB: 'business-only',
    SEPA_EU: 'unknown',
    SPEI_MX: 'unknown',
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
    SEPA_EU: {
        corridor: 'SEPA_EU',
        currency: 'EUR',
        provider: 'bridge',
        flagIso2: 'eu',
        detailRowCount: 7,
        expectedSender: 'unknown',
    },
    FASTER_PAYMENTS_GB: {
        corridor: 'FASTER_PAYMENTS_GB',
        currency: 'GBP',
        provider: 'bridge',
        flagIso2: 'gb',
        detailRowCount: 6,
        expectedSender: 'business-only',
    },
    ACH_US: {
        corridor: 'ACH_US',
        currency: 'USD',
        provider: 'bridge',
        flagIso2: 'us',
        detailRowCount: 7,
        expectedSender: 'anyone',
        personCap: '$4,000',
    },
    SPEI_MX: {
        corridor: 'SPEI_MX',
        currency: 'MXN',
        provider: 'bridge',
        flagIso2: 'mx',
        detailRowCount: 3,
        expectedSender: 'unknown',
    },
    PIX_BR: {
        corridor: 'PIX_BR',
        currency: 'BRL',
        provider: 'manteca',
        flagIso2: 'br',
        detailRowCount: 3,
        expectedSender: 'own-name-only',
        claimable: false,
        topUpHref: '/add-money/brazil/manteca',
    },
    BANK_TRANSFER_AR: {
        corridor: 'BANK_TRANSFER_AR',
        currency: 'ARS',
        provider: 'manteca',
        flagIso2: 'ar',
        detailRowCount: 5,
        expectedSender: 'own-name-only',
        claimable: false,
        topUpHref: '/add-money/argentina/manteca',
    },
}

export const DEPOSIT_RAIL_ORDER: DepositCorridor[] = [
    'SEPA_EU',
    'FASTER_PAYMENTS_GB',
    'ACH_US',
    'SPEI_MX',
    'PIX_BR',
    'BANK_TRANSFER_AR',
]

/** a corridor a user can hold as a reusable account somebody else can pay into */
export function isClaimable(rail: DepositRail): boolean {
    return rail.claimable !== false
}

/**
 * May these details be handed to somebody else at all?
 *
 * `unknown` shares. Bridge names restrictions where it has them — Pix and
 * Faster Payments are documented as first-party and third-party BUSINESS only,
 * and USD is documented permissively with a person-to-person cap — while EUR
 * and SPEI carry no sender rule either way. Withholding the feature over that
 * silence costs more than it protects, so the details are shareable and the
 * copy simply does not promise what Bridge has not said.
 *
 * Only `own-name-only` is withheld, because there the provider has told us
 * plainly that nobody else may pay in.
 */
export function isShareable(sender: SenderPolicy): boolean {
    return sender !== 'own-name-only'
}

/**
 * The capability rail id for a corridor — the inverse of `corridorFromRailId`.
 * The gate is asked about ONE corridor at a time through this: a bank-wide
 * question answers "ready" as soon as any bank rail is enabled, which let one
 * enabled Manteca rail unlock four Bridge corridors the user cannot claim.
 */
export function railIdFor(corridor: DepositCorridor): string {
    return `${DEPOSIT_RAILS[corridor].provider}.${corridor.toLowerCase()}`
}
