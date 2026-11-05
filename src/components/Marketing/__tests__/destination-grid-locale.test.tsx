import { render } from '@testing-library/react'
import { DestinationGrid } from '../DestinationGrid'

jest.mock('@/data/seo', () => ({
    SEND_TO_COUNTRIES: ['australia', 'argentina'],
    countryIso2: (slug: string) => (slug === 'australia' ? 'au' : 'ar'),
    getCountryName: (slug: string) => slug,
}))
jest.mock('@/lib/content', () => ({
    resolveContentHref: (href: string) => (href.endsWith('/australia') ? '/es-419/send-money-to/australia' : href),
}))

describe('DestinationGrid locale ownership', () => {
    it('links fallback prose to its owner while retaining owned es-ar prose', () => {
        const { container } = render(
            <DestinationGrid
                locale="es-ar"
                countries={['australia', 'argentina', 'retired-country']}
                title="Destinations"
            />
        )
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        expect(hrefs).toEqual(['/es-419/send-money-to/australia', '/es-ar/send-money-to/argentina'])
    })
})
