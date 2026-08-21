import { render } from '@testing-library/react'
import HelpLanding from '../HelpLanding'

jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

describe('HelpLanding owner links', () => {
    it('renders the server-provided href instead of reconstructing it from the hub locale', () => {
        const { container } = render(
            <HelpLanding
                articles={[
                    {
                        slug: 'passkeys',
                        href: '/es-419/help/passkeys',
                        title: 'Passkeys',
                        description: 'Passkey help',
                        category: 'Security',
                    },
                    {
                        slug: 'mercadopago-qr',
                        href: '/es-ar/help/mercadopago-qr',
                        title: 'Mercado Pago QR',
                        description: 'QR help',
                        category: 'Payments',
                    },
                ]}
                categories={['Security', 'Payments']}
            />
        )
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        expect(hrefs).toEqual(['/es-419/help/passkeys', '/es-ar/help/mercadopago-qr'])
    })
})
