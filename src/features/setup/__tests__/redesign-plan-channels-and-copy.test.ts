/**
 * P3-40 (unit): the 08 option lists stay dev's `setupChannelsForResidence`.
 * P3-56 (unit): every 05–08 key of contract P3 §§ 1.4, 2.4, 3.4, 4.4 exists in en, es-419, es-AR and pt-BR with the
 * same ICU placeholders and rich tags.
 */
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'
import type { KycIntents } from '@/hooks/useKycIntents'
import { KYC_INTENTS_BY_COUNTRY } from '@/test-utils/kycIntents.fixture'
import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'
import { setupChannelsForResidence } from '../paymentChannels'

describe('P3-40 payment-plan options per residence (dev behaviour)', () => {
    const lists = (country: string) =>
        setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, country, true, KYC_INTENTS_BY_COUNTRY[country])

    it('Argentina adds its local bank first', () => {
        expect(lists('AR').funding).toEqual(['arsBank', 'bank', 'crypto', 'peanut'])
    })

    it('Brazil adds brlBank where Pix is open, and where another entry serves it', () => {
        expect(lists('BR').funding).toEqual(['brlBank', 'bank', 'crypto', 'peanut'])
        const servedElsewhere: KycIntents = {
            ...KYC_INTENTS_BY_COUNTRY.BR,
            local: { available: false, reason: LOCAL_SERVED_ELSEWHERE_REASON },
        } as KycIntents
        expect(setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'BR', true, servedElsewhere).funding[0]).toBe(
            'brlBank'
        )
    })

    it('no card and no QR leaves spending to another Peanut user', () => {
        expect(lists('IR').payment).toEqual(['peanut'])
        expect(lists('US')).toEqual({ funding: ['bank', 'crypto', 'peanut'], payment: ['card', 'qr'] })
    })

    it('unsettled lookups give the universal lists', () => {
        expect(setupChannelsForResidence(null, 'PT', false)).toEqual({
            funding: ['crypto', 'peanut'],
            payment: ['peanut'],
        })
    })
})

// Contract P3 §§ 1.4, 2.4, 3.4, 4.4 (keys under setupRedesign.)
const P3_KEYS = [
    'accounts.title',
    'accounts.desc',
    'accounts.holder',
    'accounts.holderName',
    'accounts.account',
    'accounts.routing',
    'card.title',
    'card.desc',
    'residence.sheetResidence',
    'residence.sheetNationality',
    'residence.sentence',
    'residence.choose',
    'residence.sameRow',
    'residence.search',
    'residence.noCountry',
    'residence.refusedPassport',
    'residence.compareTitle',
    'residence.compareRule',
    'residence.itemPix',
    'residence.itemArQr',
    'residence.itemBankAccount',
    'residence.itemBank',
    'residence.itemCard',
    'residence.itemP2p',
    'residence.select',
    'residence.compareCurrencyNote',
    'plan.title',
    'plan.sentence',
    'plan.choose',
    'plan.sheetFunding',
    'plan.sheetPayment',
    'plan.fundBank',
    'plan.fundBankCurrencies',
    'plan.fundBankPill',
    'plan.fundArsBank',
    'plan.fundArsBankPill',
    'plan.fundBrlBank',
    'plan.fundBrlBankPill',
    'plan.fundPeanut',
    'plan.fundCrypto',
    'plan.payQr',
    'plan.payCard',
    'plan.payPeanut',
    'plan.peanutPill',
]

const CATALOGS = { en, 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR } as Record<string, unknown>
const at = (catalog: unknown, key: string): unknown =>
    `setupRedesign.${key}`
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog)
// the placeholder and rich-tag names a value uses, as a sorted set: a locale may group words in more or fewer
// no-wrap tags (the contract's own es-AR sentence has one <nw> fewer than en), but never drops or adds a name
const shape = (value: string) =>
    [...new Set((value.match(/\{\s*\w+|<\/?\w+>/g) ?? []).map((token) => token.replace(/[{}<>/\s]/g, '')))].sort()

describe('P3-56 catalog parity for 05–08', () => {
    it.each(P3_KEYS)('%s exists in all four catalogs with identical placeholders and tags', (key) => {
        const base = at(en, key)
        expect(typeof base).toBe('string')
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            const value = at(catalog, key)
            expect({ locale, key, type: typeof value }).toEqual({ locale, key, type: 'string' })
            expect({ locale, key, shape: shape(value as string) }).toEqual({
                locale,
                key,
                shape: shape(base as string),
            })
        }
    })

    it('the compare bank item takes the served currency list ({currencies}), as ruled (K1)', () => {
        expect(at(en, 'residence.itemBankAccount')).toMatch(/\{currencies\}/)
        expect(at(en, 'plan.fundBankCurrencies')).toMatch(/\{currencies\}/)
    })

    it('the 08 es-AR bank pills are the ruled ones: "Banco USD/EUR" and "Mercado Pago"', () => {
        // ruled pill text (FLEET ruling 9); dev's TASK-25015 names Argentina's ARS row Mercado Pago
        expect(at(esAR, 'plan.fundBankPill')).toBe('Banco USD/EUR')
        expect(at(esAR, 'plan.fundArsBankPill')).toBe('Mercado Pago')
    })
})
