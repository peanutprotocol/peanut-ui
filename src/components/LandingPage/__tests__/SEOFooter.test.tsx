import { render } from '@testing-library/react'
import { resolveContentHref } from '@/lib/content'
import { SEOFooter } from '../SEOFooter'

describe('SEOFooter locale ownership', () => {
    it('does not emit fallback-only es-ar links', () => {
        const { container } = render(<SEOFooter locale="es-ar" />)
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        const fallbackOnly = hrefs.filter(
            (href): href is string => href?.startsWith('/es-ar/') === true && resolveContentHref(href, 'es-ar') !== href
        )

        expect(fallbackOnly).toEqual([])
        expect(hrefs).toContain('/es-419/pricing')
        expect(hrefs).toContain('/en/card-terms-us')
        expect(hrefs).not.toContain('/es-ar/pricing')
        expect(hrefs).not.toContain('/es-ar/card-terms-us')
    })

    it('keeps links whose prose is owned by es-ar', () => {
        const { container } = render(<SEOFooter locale="es-ar" />)
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        expect(hrefs).toContain('/es-ar/send-money-to/argentina')
        expect(hrefs).toContain('/es-ar/compare/peanut-vs-wise')
    })
})
