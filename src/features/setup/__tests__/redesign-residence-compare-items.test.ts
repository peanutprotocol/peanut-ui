/**
 * P3-28 (unit): the 07 compare item builder, contract P3 § 3.3 "Changes over dev" and K1/K12.
 *
 * Seam (Residence/compareItems.ts, as P3 built it): `compareItemsOf(available)` → items,
 * `compareItemLabels(items, t, locale)` → visible lines, `sameLabels(a, b)` → string-for-string equality.
 * `available` is `residenceAvailability(sets, iso2, intents).available`; `t` is scoped to
 * `setupRedesign.residence`; `locale` picks the disjunction list (English as en-GB).
 */
import { createTranslator } from 'next-intl'
import type { KycIntents } from '@/hooks/useKycIntents'
import type { AppLocale } from '@/i18n/app/config'
import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'
import { type AvailabilityItemKey, residenceAvailability } from '@/utils/residence-availability'
import { copy, messagesFor } from '@/components/Setup/redesign/Accounts/__tests__/redesignHarness'

type Builder = {
    buildCompareItems: (
        available: readonly AvailabilityItemKey[],
        t: (key: string, values?: Record<string, string>) => string,
        locale: string
    ) => string[]
    sameCompareItems: (a: readonly string[], b: readonly string[]) => boolean
}

type CompareItemsModule = {
    compareItemsOf: (available: readonly AvailabilityItemKey[]) => unknown[]
    compareItemLabels: (
        items: readonly unknown[],
        t: (key: string, values?: Record<string, string>) => string,
        locale: string
    ) => string[]
    sameLabels: (a: readonly string[], b: readonly string[]) => boolean
}

// Resolved at run time so a missing module fails these tests, not the whole compile.
function loadBuilder(): Builder | null {
    try {
        const m = require('@/components/Setup/redesign/Residence/compareItems') as CompareItemsModule
        return {
            buildCompareItems: (available, t, locale) => m.compareItemLabels(m.compareItemsOf(available), t, locale),
            sameCompareItems: m.sameLabels,
        }
    } catch {
        return null
    }
}

const K = 'setupRedesign.residence'
const plain = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const translator = (locale: AppLocale) =>
    createTranslator({ locale, messages: messagesFor(locale), namespace: 'setupRedesign.residence' }) as unknown as (
        key: string,
        values?: Record<string, string>
    ) => string

const intents = (partial: Partial<KycIntents>): KycIntents => ({
    qr: { available: true },
    local: { available: false, reason: 'local_residence_unsupported' },
    card: { available: true },
    bank: { available: true, currencies: ['USD', 'EUR'] },
    ...partial,
})

function items(iso2: string, served: KycIntents | undefined, locale: AppLocale = 'en') {
    const builder = loadBuilder()
    expect(builder).not.toBeNull()
    const available = residenceAvailability(RESIDENCE_RESTRICTION_SETS, iso2, served).available
    return builder!.buildCompareItems(available, translator(locale), locale).map(plain)
}

describe('P3-28 compare items', () => {
    it.each([
        ['en', 'MXN, USD, EUR or GBP'],
        ['es-AR', 'MXN, USD, EUR o GBP'],
    ] as const)('formats served currencies in served order as one bank-account item (%s)', (locale, list) => {
        const result = items(
            'DE',
            intents({ bank: { available: true, currencies: ['MXN', 'USD', 'EUR', 'GBP'] } }),
            locale
        )
        expect(result[0]).toBe(copy(`${K}.itemBankAccount`, { currencies: list }, locale))
        expect(result[0]).toContain(list)
        expect(result.filter((item) => item.includes('USD'))).toHaveLength(1)
    })

    it('joins the list’s spaces with no-break spaces, as the mock binds it', () => {
        const builder = loadBuilder()
        expect(builder).not.toBeNull()
        const available = residenceAvailability(RESIDENCE_RESTRICTION_SETS, 'DE', intents({})).available
        const raw = builder!.buildCompareItems(available, translator('en'), 'en')[0]
        expect(raw).toContain('USD or EUR')
    })

    it('a single served currency reads "Bank account: USD"', () => {
        const result = items('DE', intents({ bank: { available: true, currencies: ['USD'] } }))
        expect(result[0]).toBe(copy(`${K}.itemBankAccount`, { currencies: 'USD' }))
        expect(result[0]).toMatch(/: USD$/)
    })

    it('tiers only (the intents read failed) gives the generic "Bank account"', () => {
        const result = items('DE', undefined)
        expect(result).toEqual([copy(`${K}.itemBank`), copy(`${K}.itemCard`), copy(`${K}.itemP2p`)])
    })

    it('puts the local rail first and P2P last, and leaves out what the residence rules out', () => {
        const br = items(
            'BR',
            intents({ local: { available: true }, card: { available: false, reason: 'geo-blocked' } })
        )
        expect(br[0]).toBe(copy(`${K}.itemPix`))
        expect(br[br.length - 1]).toBe(copy(`${K}.itemP2p`))
        expect(br).not.toContain(copy(`${K}.itemCard`))
        const ar = items('AR', intents({ local: { available: true } }))
        expect(ar[0]).toBe(copy(`${K}.itemArQr`))
    })

    it('a residence with no bank and no card still lists Peanut to Peanut', () => {
        const result = items(
            'IR',
            intents({
                local: { available: false, reason: 'residence_sanctioned' },
                card: { available: false, reason: 'geo-blocked' },
                bank: { available: false, currencies: [], reason: 'residence_bank_restricted' },
            })
        )
        expect(result).toEqual([copy(`${K}.itemP2p`)])
    })

    it('equal lists compare equal string-for-string, different ones do not', () => {
        const builder = loadBuilder()
        expect(builder).not.toBeNull()
        const a = items('PT', intents({}))
        const b = items('DE', intents({}))
        const c = items('BR', intents({ local: { available: true } }))
        expect(builder!.sameCompareItems(a, b)).toBe(true)
        expect(builder!.sameCompareItems(a, c)).toBe(false)
    })
})
