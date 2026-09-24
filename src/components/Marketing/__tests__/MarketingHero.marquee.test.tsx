/**
 * The marquee under a marketing hero (MarketingHero and the MDX Hero) is shared
 * by every landing page. It said "No fees" in every locale, which is not true
 * for every route (a conversion cost is part of the rate). It now names what
 * the user can check instead, in the page's language.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MarketingHero } from '../MarketingHero'
import { createMdxComponents } from '../mdx/components'

jest.mock('@/components/Global/MarqueeWrapper', () => ({
    MarqueeComp: ({ message }: { message: string[] }) => <p data-testid="marquee">{message.join(' | ')}</p>,
}))
jest.mock('@/components/LandingPage/CloudsCss', () => ({ CloudsCss: () => null }))

const LOCALES = [
    ['en', 'Rate shown upfront'],
    ['es-419', 'Tipo de cambio a la vista'],
    ['es-ar', 'Tipo de cambio a la vista'],
    ['pt-br', 'Cotação à mostra'],
] as const

const expectTruthfulMarquee = (rateClaim: string) => {
    const marquee = screen.getByTestId('marquee')
    expect(marquee).toHaveTextContent(rateClaim)
    expect(marquee.textContent).not.toMatch(/no fees|sin comisiones|sem taxas/i)
}

it.each(LOCALES)('%s MarketingHero marquee names the rate, no blanket no-fees claim', (locale, rateClaim) => {
    render(<MarketingHero title="Send money" subtitle="Fast" locale={locale} />)
    expectTruthfulMarquee(rateClaim)
})

it.each(LOCALES)('%s MDX Hero marquee is bound to the page locale', (locale, rateClaim) => {
    const { Hero } = createMdxComponents(locale)
    render(<Hero title="Send money" />)
    expectTruthfulMarquee(rateClaim)
})
