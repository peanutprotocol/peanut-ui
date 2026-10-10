import { render, screen, within } from '@testing-library/react'
import { SupportedRailsFaqAnswer } from '../SupportedRailsFaqAnswer'
import { landingStrings } from '../landingStrings'
import { supportedFiatRails, supportedRailsFaq } from '@/constants/faq.consts'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'
import { getTranslations } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/types'

jest.mock('@/components/AddMoney/components/ChainChip', () => ({
    __esModule: true,
    default: ({ chainName }: { chainName: string }) => <span>{chainName}</span>,
}))

// The landing FAQ once listed six hand-typed rails and missed Colombia when the
// COP corridor shipped. Every corridor the app offers must reach both the
// rendered list and the plain-text answer that feeds the FAQPage JSON-LD.
describe.each(SUPPORTED_LOCALES)('supported-rails FAQ (%s)', (locale) => {
    const rails = supportedFiatRails(locale)

    it('lists every corridor in the deposit catalogue', () => {
        render(
            <SupportedRailsFaqAnswer strings={landingStrings(getTranslations(locale)).supportedRails} rails={rails} />
        )
        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(DEPOSIT_RAIL_ORDER.length)
        DEPOSIT_RAIL_ORDER.forEach((corridor, index) => {
            expect(within(items[index]).getByText(new RegExp(`^${DEPOSIT_RAILS[corridor].currency} ·`))).toBeTruthy()
        })
    })

    it('names every corridor in the plain-text answer', () => {
        const { answer } = supportedRailsFaq(locale)
        for (const rail of rails) {
            expect(answer).toContain(`${rail.name} (${rail.currency}, ${rail.region})`)
        }
        expect(answer).toContain('Bre-B (COP')
    })
})

describe('rail regions', () => {
    it('are in the reader language and never assert a SEPA country count', () => {
        const byCurrency = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
            Object.fromEntries(supportedFiatRails(locale).map((rail) => [rail.currency, rail.region]))

        expect(byCurrency('en')).toMatchObject({ EUR: 'Europe', COP: 'Colombia', MXN: 'Mexico' })
        expect(byCurrency('es-419')).toMatchObject({ EUR: 'Europa', USD: 'Estados Unidos', MXN: 'México' })
        expect(byCurrency('pt-br')).toMatchObject({ EUR: 'Europa', USD: 'Estados Unidos', BRL: 'Brasil' })
        expect(supportedFiatRails('en').map((rail) => rail.region)).not.toContain('36 countries')
    })
})
