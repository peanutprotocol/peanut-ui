'use client'

import { useAuth } from '@/context/authContext'
import { usePaperworkClosures } from '@/features/deposit-accounts/usePaperworkClosures'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { readDeclaredResidence, readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import {
    BANK_ROW_COUNTRIES,
    buildBankRows,
    type BankRegionChip,
    type BankRowKey,
    type BankRowsInput,
} from '@/utils/unlock-payments.utils'
import { useRequestedKycFeatures } from '@/features/paperwork-verification/useRequestedKycFeatures'
import { bankRailsFor, type AvailabilityItemKey } from '@/utils/residence-availability'
import { useCallback, useEffect, useMemo } from 'react'

/** Gate states that mean "a rail is here, it just cannot move money yet". */
const MID_FLIGHT_GATES: ReadonlySet<string> = new Set([
    'pending',
    'waiting-on-provider',
    'accept-tos',
    'fixable-rejection',
    'provide-email',
])

const isEuropeIso2 = (iso2: string | null): boolean =>
    !!iso2 && iso2 !== 'US' && iso2 !== 'MX' && isBridgeSupportedCountry(iso2)

/**
 * The chip for one currency's bank corridor, before residence restrictions:
 * `active` when the user can deposit or withdraw on it today. The bank rows
 * read it, and so does the Manteca top-up's residence gate (`residenceCloses`).
 */
export function useBankChipFor(): (key: BankRowKey) => BankRegionChip {
    const { gateFor } = useCapabilities()

    /**
     * The chip for one currency's bank corridor, read from the rails of that
     * corridor's own COUNTRY.
     *
     * Two separate truths are folded in here. Holding a rail is not being
     * allowed to use it: every Sumsub-approved user is enrolled on the QR-tier
     * Manteca rails whatever their residence, so the rail is `enabled` because
     * `pay` is while `deposit` and `withdraw` stay `requires-info`. A bank row
     * says Available only when the user can move money on one of those two
     * operations. And a provider is not a currency: scoping by provider gave
     * the US and Mexico — both Bridge — one shared verdict, so a user with a
     * working US rail read "Available" on a row that also named MXN. The gate
     * is the hook's own country-scoped primitive; nothing here walks rails.
     */
    const bankChipFor = useCallback(
        (key: BankRowKey): BankRegionChip => {
            const scope = { channel: 'bank' as const, country: BANK_ROW_COUNTRIES[key] }
            const kinds = [gateFor('deposit', scope).kind, gateFor('withdraw', scope).kind]
            if (kinds.includes('ready')) return 'active'
            // Only support can lift a blocked rail, so that one row says so.
            if (kinds.includes('blocked-rejection') || kinds.includes('restart-identity')) return 'attention'
            // A rail that exists but cannot move money yet is mid-flight,
            // whatever it is waiting on — provisioning, a document, a ToS.
            // Unlock is reserved for a corridor with no rail behind it at all,
            // because that is the only case where the tap starts something.
            if (kinds.some((kind) => MID_FLIGHT_GATES.has(kind))) return 'processing'
            return 'unlock'
        },
        [gateFor]
    )
    return bankChipFor
}

/** The rail each bank row is, as the residence availability names them. */
const ROW_RAIL: Readonly<Record<BankRowKey, AvailabilityItemKey>> = {
    brl: 'pix',
    ars: 'arQr',
    usd: 'usdAch',
    mxn: 'spei',
    sepa: 'eurSepa',
}

/**
 * A verified user who asked for a currency's feature, in a residence that gets
 * that rail, is waiting on the provider: Pending, not an offer to set it up
 * again (Slava, 2026-10-27). Pix and Argentine transfers are the local feature;
 * the rest are the bank one.
 */
export function requestedChip(
    chip: BankRegionChip,
    key: BankRowKey,
    {
        approved,
        requested,
        residenceIso2,
    }: { approved: boolean; requested: { bank: boolean; local: boolean } | null; residenceIso2: string | null }
): BankRegionChip {
    if (chip !== 'unlock' || !approved || !requested || !residenceIso2) return chip
    const asked = key === 'brl' || key === 'ars' ? requested.local : requested.bank
    return asked && bankRailsFor(residenceIso2).includes(ROW_RAIL[key]) ? 'processing' : chip
}

/**
 * The bank rows both money screens list — Add money and Accounts and payments
 * — with the residence they were read against.
 *
 * One hook, so the two screens can never give one currency two statuses.
 */
export function useBankRows() {
    const { user } = useAuth()
    const bankChipFor = useBankChipFor()
    const { isKycApproved } = useCapabilities()
    const requested = useRequestedKycFeatures()
    const restrictions = useResidenceRestrictions()
    const { closed: paperworkClosed } = usePaperworkClosures()

    // Server copy first; the localStorage mirror of the signup answer covers
    // reloads before /users/me returns it (or an API without the fields yet).
    const residence = user?.residence ?? null
    const userId = user?.user?.userId
    const localDeclared = useHydrationSnapshot(
        () => readDeclaredResidence(userId),
        () => null
    )
    const localSecond = useHydrationSnapshot(
        () => readSecondResidence(userId),
        () => null
    )
    // `declaredSecond` is authoritative when the server sends it AT ALL: `null`
    // means "no second residence", which `??` would wrongly treat like the
    // pre-deploy absent field and revive a stale device mirror. Only `undefined`
    // — an API that predates the field — falls back.
    const serverSecond = residence?.secondaryDeclaredCountry
    const secondResidenceIso2 = serverSecond === undefined ? localSecond : serverSecond
    // Re-sync the mirror to the server's answer, including clearing it: it is
    // read elsewhere (useResidenceRestrictions), so leaving a disowned country
    // there would keep shaping availability.
    useEffect(() => {
        if (userId && serverSecond !== undefined) storeSecondResidence(userId, serverSecond)
    }, [userId, serverSecond])

    // Once /users/me carries the residence, the server's answer stands, "none" included.
    const residenceIso2 = residence
        ? (residence.verified?.country ?? residence.declared?.country ?? null)
        : (localDeclared ?? null)

    const input: BankRowsInput = useMemo(() => {
        const asked = { approved: isKycApproved, requested, residenceIso2 }
        const chip = (key: BankRowKey) => requestedChip(bankChipFor(key), key, asked)
        return {
            bankChips: {
                brl: chip('brl'),
                ars: chip('ars'),
                usd: chip('usd'),
                mxn: chip('mxn'),
                sepa: chip('sepa'),
            },
            restrictions,
            residenceIso2,
            secondResidenceIso2,
            isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(secondResidenceIso2),
            paperworkClosed,
        }
    }, [bankChipFor, isKycApproved, requested, restrictions, residenceIso2, secondResidenceIso2, paperworkClosed])
    const rows = useMemo(() => buildBankRows(input), [input])

    return { rows, input, residence, residenceIso2, secondResidenceIso2 }
}
