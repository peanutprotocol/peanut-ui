/**
 * The exchange widget's note reaches every marketing surface in the page's
 * language: the landing page through `landingStrings`, the MDX embed through
 * `createMdxComponents` (TASK-21104). Both read one flat-catalog key.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { landingStrings } from '@/components/LandingPage/landingStrings'

const mockExchangeWidget = jest.fn((_props: unknown) => null)
jest.mock('@/components/Marketing/mdx/ExchangeWidget', () => ({
    ExchangeWidget: (props: unknown) => mockExchangeWidget(props),
}))

import { createMdxComponents, mdxComponents } from '@/components/Marketing/mdx/components'

const NOTE: Record<Locale, string> = {
    en: 'The rate is an estimate and may include conversion costs. Review the rate and any fees before confirming.',
    'es-419':
        'El tipo de cambio es estimado y puede incluir costos de conversión. Revisa el tipo de cambio y las comisiones antes de confirmar.',
    'es-ar':
        'El tipo de cambio es estimado y puede incluir costos de conversión. Revisá el tipo de cambio y las comisiones antes de confirmar.',
    'pt-br':
        'A cotação é uma estimativa e pode incluir custos de conversão. Confira a cotação e as tarifas antes de confirmar.',
}
const CASES = Object.entries(NOTE) as [Locale, string][]

describe('exchange widget rate note across marketing surfaces', () => {
    it.each(CASES)('landing strings carry the %s note and no fee-free label', (locale, note) => {
        const { exchange } = landingStrings(getTranslations(locale))
        expect(exchange.rateNote).toBe(note)
        expect(exchange).not.toHaveProperty('free')
        expect(exchange).not.toHaveProperty('bankFee')
    })

    it.each(CASES)('the MDX embed is bound to the %s note', (locale, note) => {
        mockExchangeWidget.mockClear()
        const Embed = createMdxComponents(locale).ExchangeWidget
        render(<Embed destinationCurrency="ARS" />)

        expect(mockExchangeWidget).toHaveBeenCalledWith(
            expect.objectContaining({ destinationCurrency: 'ARS', labels: expect.objectContaining({ rateNote: note }) })
        )
    })

    it('the unbound component map leaves the embed on its English defaults', () => {
        mockExchangeWidget.mockClear()
        const Embed = mdxComponents.ExchangeWidget
        render(<Embed destinationCurrency="ARS" />)

        expect(mockExchangeWidget).toHaveBeenCalledWith(expect.not.objectContaining({ labels: expect.anything() }))
    })
})
