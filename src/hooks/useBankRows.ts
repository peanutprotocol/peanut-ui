'use client'

import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { readDeclaredResidence, readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import {
    BANK_ROW_COUNTRIES,
    buildBankRows,
    type BankRegionChip,
    type BankRowKey,
    type BankRowsInput,
} from '@/utils/unlock-payments.utils'
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

/**
 * The bank rows both money screens list — Add money and Accounts and payments
 * — with the residence they were read against.
 *
 * One hook, so the two screens can never give one currency two statuses.
 */
export function useBankRows() {
    const { user } = useAuth()
    const bankChipFor = useBankChipFor()
    const restrictions = useResidenceRestrictions()

    // Server copy first; the localStorage mirror of the signup answer covers
    // reloads before /users/me returns it (or an API without the fields yet).
    const residence = user?.residence ?? null
    const userId = user?.user?.userId
    // localStorage is synchronous I/O: read once per account, not per render.
    const { localDeclared, localSecond } = useMemo(
        () => ({ localDeclared: readDeclaredResidence(userId), localSecond: readSecondResidence(userId) }),
        [userId]
    )
    // `declaredSecond` is authoritative when the server sends it AT ALL: `null`
    // means "no second residence", which `??` would wrongly treat like the
    // pre-deploy absent field and revive a stale device mirror. Only `undefined`
    // — an API that predates the field — falls back.
    const serverSecond = residence?.declaredSecond
    const secondResidenceIso2 = serverSecond === undefined ? localSecond : serverSecond
    // Re-sync the mirror to the server's answer, including clearing it: it is
    // read elsewhere (useResidenceRestrictions), so leaving a disowned country
    // there would keep shaping availability.
    useEffect(() => {
        if (userId && serverSecond !== undefined) storeSecondResidence(userId, serverSecond)
    }, [userId, serverSecond])

    const residenceIso2 = residence?.verified ?? residence?.declared ?? localDeclared ?? null

    const input: BankRowsInput = useMemo(
        () => ({
            bankChips: {
                brl: bankChipFor('brl'),
                ars: bankChipFor('ars'),
                usd: bankChipFor('usd'),
                mxn: bankChipFor('mxn'),
                sepa: bankChipFor('sepa'),
            },
            restrictions,
            residenceIso2,
            secondResidenceIso2,
            isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(secondResidenceIso2),
        }),
        [bankChipFor, restrictions, residenceIso2, secondResidenceIso2]
    )
    const rows = useMemo(() => buildBankRows(input), [input])

    return { rows, input, residence, residenceIso2, secondResidenceIso2 }
}
