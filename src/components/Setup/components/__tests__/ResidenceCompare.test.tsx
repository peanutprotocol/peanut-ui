/** @jest-environment jsdom */
/**
 * ResidenceCompare — the "Link your profile to one country" columns.
 *
 * Contract under test: the per-currency bank rails read as one "Bank account"
 * item naming only the currencies the server opens, in its order, as a
 * localized "or" list; what a residence rules out is not listed at all (no
 * struck-through items); the generic bank item is unchanged; P2P is last.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import { ResidenceCompare } from '@/components/Setup/components/ResidenceCompare'
import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'

let mockIntentsMissing = false
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) => ({
        intents: mockIntentsMissing
            ? undefined
            : jest.requireActual('@/test-utils/kycIntents.fixture').KYC_INTENTS_BY_COUNTRY[country],
        settled: true,
    }),
}))

const NAMES: Record<string, string> = {
    BR: 'Brazil',
    PT: 'Portugal',
    CF: 'Central African Republic',
    MX: 'Mexico',
    UA: 'Ukraine',
    JP: 'Japan',
    TR: 'Türkiye',
}

function renderCompare(
    residence: string,
    nationality: string,
    locale: 'en' | 'es-419' | 'pt-BR' = 'en',
    messages: object = en
) {
    return render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <ResidenceCompare
                residence={residence}
                nationality={nationality}
                labelOf={(iso2) => NAMES[iso2] ?? iso2}
                restrictionSets={RESIDENCE_RESTRICTION_SETS}
                busy={false}
                onChoose={jest.fn()}
            />
        </NextIntlClientProvider>
    )
}

const itemsOf = (country: string) =>
    within(screen.getByRole('heading', { level: 2, name: country }).closest('section')!)
        .getAllByRole('listitem')
        .map((item) => item.textContent)

describe('ResidenceCompare', () => {
    beforeEach(() => {
        mockIntentsMissing = false
    })

    it('lists the bank currencies as one item, with P2P last', () => {
        renderCompare('PT', 'BR')
        expect(itemsOf('Brazil')).toEqual([
            'PIX payments & transfers',
            'Bank account: US dollar, euro, British pound or Mexican peso',
            'Peanut card',
            'Peanut to Peanut',
        ])
        expect(itemsOf('Portugal')).toEqual([
            'Bank account: US dollar, euro, British pound or Mexican peso',
            'Peanut card',
            'Peanut to Peanut',
        ])
        // The multi-currency condition still applies to the merged item.
        expect(screen.getAllByText(en.setup.residenceStep.compare.multiCurrencyNote)).toHaveLength(2)
    })

    it('names only the currencies served, in the served order', () => {
        renderCompare('CF', 'MX')
        expect(itemsOf('Central African Republic')).toEqual([
            'Bank account: US dollar or Mexican peso',
            'Peanut card',
            'Peanut to Peanut',
        ])
        expect(itemsOf('Mexico')).toEqual([
            'Bank account: Mexican peso, US dollar, euro or British pound',
            'Peanut card',
            'Peanut to Peanut',
        ])
    })

    it('leaves out what a residence rules out instead of striking it through', () => {
        const { container } = renderCompare('UA', 'JP')
        // UA: the card is closed; JP: the bank is closed.
        expect(itemsOf('Ukraine')).toEqual([
            'Bank account: US dollar, euro, British pound or Mexican peso',
            'Peanut to Peanut',
        ])
        expect(itemsOf('Japan')).toEqual(['Peanut card', 'Peanut to Peanut'])
        expect(container.querySelector('.line-through')).toBeNull()
        expect(screen.queryByText('Bank transfers')).toBeNull()
    })

    it('keeps the generic bank item when only the restriction tiers are known', () => {
        mockIntentsMissing = true
        const { container } = renderCompare('PT', 'TR')
        expect(itemsOf('Portugal')).toEqual([
            en.setup.residenceStep.compare.items.bank,
            'Peanut card',
            'Peanut to Peanut',
        ])
        // TR's card is ruled out by Rain's list: not shown, not crossed out.
        expect(itemsOf('Türkiye')).toEqual([en.setup.residenceStep.compare.items.bank, 'Peanut to Peanut'])
        expect(container.querySelector('.line-through')).toBeNull()
    })

    it.each([
        ['es-419' as const, es419, 'Cuenta bancaria: dólar estadounidense, euro, libra esterlina o peso mexicano'],
        ['pt-BR' as const, ptBR, 'Conta bancária: dólar americano, euro, libra esterlina ou peso mexicano'],
    ])('joins the currencies with the %s "or"', (locale, messages, expected) => {
        renderCompare('PT', 'BR', locale, messages)
        expect(itemsOf('Brazil')).toContain(expected)
    })
})
