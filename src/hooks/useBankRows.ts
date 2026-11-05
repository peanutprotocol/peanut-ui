'use client'

import { useAuth } from '@/context/authContext'
import { accountEntry, bestChip, entryChip, UNKNOWN_REPORT } from '@/features/kyc-features/report'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { FeatureReportEntry } from '@/types/capabilities'
import { readDeclaredResidence, readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import {
    buildBankRows,
    type BankRegionChip,
    type BankRowKey,
    type BankRowsInput,
    type UnlockChip,
    type UnlockRow,
} from '@/utils/unlock-payments.utils'
import { useCallback, useEffect, useMemo } from 'react'

const isEuropeIso2 = (iso2: string | null): boolean =>
    !!iso2 && iso2 !== 'US' && iso2 !== 'MX' && isBridgeSupportedCountry(iso2)

/** The account behind each bank row, as the feature report names it. */
const ROW_ACCOUNTS: Readonly<Record<BankRowKey, { feature: 'bank' | 'local'; currency: string }>> = {
    brl: { feature: 'local', currency: 'BRL' },
    ars: { feature: 'local', currency: 'ARS' },
    usd: { feature: 'bank', currency: 'USD' },
    mxn: { feature: 'bank', currency: 'MXN' },
    sepa: { feature: 'bank', currency: 'EUR' },
}

/** Which sentence explains a closed row: the residence's rule, the account's own, or the country's. */
function closedBecause(reason: string | undefined): NonNullable<UnlockRow['unavailableBecause']> {
    if (reason === 'account_unavailable_in_residence') return 'account-residence'
    if (reason === 'local_residence_unsupported') return 'residence'
    return 'restricted-country'
}

/** The report entry behind one bank row: its currency's account. */
export function useBankEntryFor(): (key: BankRowKey) => FeatureReportEntry {
    const { capabilities } = useCapabilities()
    const report = capabilities.features ?? UNKNOWN_REPORT
    return useCallback(
        (key: BankRowKey) => accountEntry(report, ROW_ACCOUNTS[key].feature, ROW_ACCOUNTS[key].currency),
        [report]
    )
}

/**
 * The chip for one currency's bank row: the API's answer for that account
 * (`capabilities.features`), so the row, the flow behind it and every other
 * screen say the same thing about it.
 */
export function useBankChipFor(): (key: BankRowKey) => UnlockChip {
    const { nextActions } = useCapabilities()
    const entryFor = useBankEntryFor()
    return useCallback((key: BankRowKey) => entryChip(entryFor(key), nextActions), [entryFor, nextActions])
}

/**
 * The bank rows both money screens list — Add money and Accounts and payments
 * — with the residence they were read against.
 *
 * One hook, so the two screens can never give one currency two statuses.
 */
export function useBankRows() {
    const { user } = useAuth()
    const { capabilities, nextActions } = useCapabilities()
    const entryFor = useBankEntryFor()

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
        const keys = Object.keys(ROW_ACCOUNTS) as BankRowKey[]
        const entries = keys.map((key) => [key, entryFor(key)] as const)
        return {
            bankChips: Object.fromEntries(
                entries.map(([key, entry]) => [key, entryChip(entry, nextActions)])
            ) as Record<BankRowKey, BankRegionChip>,
            closedBecause: Object.fromEntries(entries.map(([key, entry]) => [key, closedBecause(entry.reason)])),
            residenceIso2,
            secondResidenceIso2,
            isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(secondResidenceIso2),
        }
    }, [entryFor, nextActions, residenceIso2, secondResidenceIso2])
    const rows = useMemo(() => buildBankRows(input), [input])
    // The one bank account row: the bank and local features, each as the API states it.
    const report = capabilities.features ?? UNKNOWN_REPORT
    const accountChip = bestChip([entryChip(report.bank, nextActions), entryChip(report.local, nextActions)])

    return { rows, input, accountChip, residence, residenceIso2, secondResidenceIso2 }
}
