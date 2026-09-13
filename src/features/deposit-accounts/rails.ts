import type { RailCapability } from '@/types/capabilities'
import type { DepositCorridor, DepositRail, SenderPolicy } from './types'

/**
 * How each corridor PRESENTS: flag, currency, arrival, row count. It never
 * decides which corridors a user sees — `corridorsFromRails` does, from the
 * rails the capabilities endpoint returns. A table that also picked the rows
 * showed every user an unavailable ARS row, including users in Germany.
 *
 * Every sentence a user reads lives in the message catalog under
 * `depositAccounts.corridors`, keyed by corridor — rail names included,
 * because "ACH or wire" and "Bank transfer" are English sentences wearing a
 * proper noun's clothes. Only the invariant part (SEPA, SPEI, Pix) is a real
 * proper noun, and the catalog holds it anyway so one lookup answers the whole
 * label.
 */
export const DEPOSIT_RAILS: Record<DepositCorridor, DepositRail> = {
    SEPA_EU: {
        corridor: 'SEPA_EU',
        currency: 'EUR',
        provider: 'bridge',
        flagIso2: 'eu',
        detailRowCount: 7,
    },
    FASTER_PAYMENTS_GB: {
        corridor: 'FASTER_PAYMENTS_GB',
        currency: 'GBP',
        provider: 'bridge',
        flagIso2: 'gb',
        detailRowCount: 6,
    },
    ACH_US: {
        corridor: 'ACH_US',
        currency: 'USD',
        provider: 'bridge',
        flagIso2: 'us',
        detailRowCount: 7,
    },
    SPEI_MX: {
        corridor: 'SPEI_MX',
        currency: 'MXN',
        provider: 'bridge',
        flagIso2: 'mx',
        detailRowCount: 3,
    },
    PIX_BR: {
        corridor: 'PIX_BR',
        currency: 'BRL',
        provider: 'manteca',
        flagIso2: 'br',
        detailRowCount: 3,
        claimable: false,
        topUpHref: '/add-money/brazil/manteca',
    },
    BANK_TRANSFER_AR: {
        corridor: 'BANK_TRANSFER_AR',
        currency: 'ARS',
        provider: 'manteca',
        flagIso2: 'ar',
        detailRowCount: 5,
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
 * The answer is `matching.sender`, which the backend derives from the rail
 * rules. Only `own-name-only` is withheld: there the provider has said plainly
 * that nobody else may pay in, so a Share button would offer details that
 * return whatever is sent to them. Every other policy shares, and the copy
 * carries the terms rather than the feature being withheld.
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

/**
 * `bridge.ach_us` → `ACH_US`. The corridor key IS the rail method code in both
 * repos, so this only has to undo the provider prefix and the lower-casing the
 * capability contract applies to rail ids.
 */
export function corridorFromRailId(railId: string): DepositCorridor | undefined {
    const method = railId.split('.')[1]?.toUpperCase()
    return method && method in DEPOSIT_RAILS ? (method as DepositCorridor) : undefined
}

/**
 * Which corridors this user has a row for.
 *
 * One row per bank rail the capabilities name, whatever its status: a rail in
 * the block means the corridor is part of this user's world, and its status
 * decides what the row says rather than whether it exists. A user with no AR
 * rail never reads about ARS.
 *
 * A corridor the user already HOLDS an account on is a row too, even with no
 * rail behind it. The capability block leaves an inactive catalogue rail out;
 * the accounts endpoint deliberately keeps the account, because details that
 * are already in a payer's records still have to be readable. Taking the rails
 * alone would drop that account off the list and bounce its details URL back,
 * with nowhere left to see what a payer is still sending money to. The gate on
 * such a corridor is not `ready`, so it reads as the account it is and offers
 * no claim.
 */
export function corridorsFromRails(
    rails: RailCapability[],
    heldCorridors: Iterable<DepositCorridor> = []
): DepositCorridor[] {
    const held = new Set<DepositCorridor>(heldCorridors)
    for (const rail of rails) {
        if (rail.channel !== 'bank') continue
        const corridor = corridorFromRailId(rail.id)
        if (corridor) held.add(corridor)
    }
    return DEPOSIT_RAIL_ORDER.filter((corridor) => held.has(corridor))
}
