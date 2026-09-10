import { render } from '@testing-library/react'
import { DestinationGrid } from '../DestinationGrid'

describe('DestinationGrid locale ownership', () => {
    it('links fallback prose to its owner while retaining owned es-ar prose', () => {
        const { container } = render(
            <DestinationGrid locale="es-ar" countries={['australia', 'argentina']} title="Destinations" />
        )
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        expect(hrefs).toEqual(['/es-419/send-money-to/australia', '/es-ar/send-money-to/argentina'])
    })
})
