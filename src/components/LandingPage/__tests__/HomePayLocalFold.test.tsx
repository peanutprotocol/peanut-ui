import { render, screen, within } from '@testing-library/react'
import { HomePayLocalFold } from '../HomePayLocalFold'
import type { HomePayLocalStrings } from '../homeFolds.types'

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => true }))
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => false }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} />,
}))

const PT_BR: HomePayLocalStrings = {
    heading: 'Pague como um local.',
    lead: 'Mercado Pago na {argentina}. Pix no {brazil}. Com seu passaporte.',
    argentina: 'Argentina',
    brazil: 'Brasil',
}

describe('HomePayLocalFold', () => {
    it('links each country in the lead to its QR page, keeping the words around them', () => {
        const { container } = render(<HomePayLocalFold strings={PT_BR} locale="pt-br" />)
        const lead = container.querySelector('p:not([lang])')!
        expect(lead).toHaveTextContent('Mercado Pago na Argentina. Pix no Brasil. Com seu passaporte.')
        expect(within(lead as HTMLElement).getByRole('link', { name: 'Argentina' })).toHaveAttribute(
            'href',
            '/qr-payments/argentina'
        )
        expect(within(lead as HTMLElement).getByRole('link', { name: 'Brasil' })).toHaveAttribute(
            'href',
            '/qr-payments/brazil'
        )
    })

    it('keeps the lead links as the only keyboard path; the stickers repeat them out of the tab order', () => {
        render(<HomePayLocalFold strings={PT_BR} locale="pt-br" />)
        expect(screen.getAllByRole('link')).toHaveLength(2)
        const stickerLinks = document.querySelectorAll('a[aria-hidden="true"]')
        expect(Array.from(stickerLinks, (a) => [a.getAttribute('href'), a.getAttribute('tabindex')])).toEqual([
            ['/qr-payments/argentina', '-1'],
            ['/qr-payments/brazil', '-1'],
        ])
    })

    it("keeps each sticker's till line in the till's language", () => {
        render(<HomePayLocalFold strings={PT_BR} locale="es-ar" />)
        expect(screen.getByText('Pagá con QR')).toHaveAttribute('lang', 'es-AR')
        expect(screen.getByText('Pague com Pix')).toHaveAttribute('lang', 'pt-BR')
    })

    it.each(['en', 'es-419', 'es-ar', 'pt-br'] as const)(
        'registers both sticker codes as home QR slots for %s',
        (locale) => {
            render(<HomePayLocalFold strings={PT_BR} locale={locale} />)
            const origin = window.location.origin
            expect(screen.getAllByTestId('qr').map((qr) => qr.getAttribute('data-value'))).toEqual([
                `${origin}/q/home-pay-local-ar-${locale}`,
                `${origin}/q/home-pay-local-br-${locale}`,
            ])
        }
    )
})
