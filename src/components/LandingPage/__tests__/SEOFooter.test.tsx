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

describe('SEOFooter labels', () => {
    const linkTexts = (container: HTMLElement) =>
        [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) => link.textContent)

    it('keeps the English Learn More labels on en', () => {
        const texts = linkTexts(render(<SEOFooter locale="en" />).container)
        expect(texts).toEqual(expect.arrayContaining(['Help Center', 'Fees and Pricing', 'Verification Guide']))
    })

    it('translates the Learn More labels instead of showing manifest names', () => {
        const texts = linkTexts(render(<SEOFooter locale="pt-br" />).container)
        expect(texts).toEqual(expect.arrayContaining(['Central de Ajuda', 'Taxas e preços', 'Guia de verificação']))
        expect(texts).not.toContain('Supported Networks')
        expect(texts).not.toContain('Send Money to Family')
    })

    it('names the send-money countries in the page language', () => {
        const texts = linkTexts(render(<SEOFooter locale="es-419" />).container)
        expect(texts).toEqual(expect.arrayContaining(['Enviar a Brasil', 'Enviar desde Reino Unido']))
        expect(texts).not.toContain('Enviar a Brazil')
        expect(linkTexts(render(<SEOFooter locale="en" />).container)).toContain('Send from UK')
    })
})
