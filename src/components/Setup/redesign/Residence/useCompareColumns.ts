'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useKycIntents } from '@/hooks/useKycIntents'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability } from '@/utils/residence-availability'
import { compareItemLabels, compareItemsOf, sameLabels } from './compareItems'

export type CompareState = 'compare' | 'compare-equal' | 'compare-loading'

export type CompareColumn = { iso2: string; items: string[] }

/**
 * The two compare columns from the server (GET /config/kyc-intents per country), the restriction tiers when a read
 * failed. Lists wait until both columns settle, so the equal check never flashes, and equal lists are hidden.
 * Both reads start with the sentence view, so the compare view usually opens with its lists.
 */
export function useCompareColumns(
    residence: string,
    nationality: string,
    sets: ResidenceRestrictionSets | null,
    setsSettled: boolean
): { state: CompareState; columns: CompareColumn[]; currencyNote: boolean } {
    const t = useTranslations('setupRedesign.residence')
    const locale = useLocale()
    const residenceIntents = useKycIntents(residence || null)
    const nationalityIntents = useKycIntents(nationality || null)
    const reads = [
        { iso2: residence, ...residenceIntents },
        { iso2: nationality, ...nationalityIntents },
    ]
    const settled = reads.every(({ intents, settled }) => settled && (!!intents || setsSettled))
    if (!settled)
        return {
            state: 'compare-loading',
            columns: reads.map(({ iso2 }) => ({ iso2, items: [] })),
            currencyNote: false,
        }
    const summaries = reads.map(({ iso2, intents }) => residenceAvailability(sets, iso2, intents))
    const lists = summaries.map((summary) => compareItemLabels(compareItemsOf(summary.available), t, locale))
    if (sameLabels(lists[0], lists[1]))
        return { state: 'compare-equal', columns: reads.map(({ iso2 }) => ({ iso2, items: [] })), currencyNote: false }
    return {
        state: 'compare',
        columns: reads.map(({ iso2 }, index) => ({ iso2, items: lists[index] })),
        currencyNote: summaries.some((summary) => summary.multiCurrency),
    }
}
