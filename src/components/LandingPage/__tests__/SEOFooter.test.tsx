import { render } from '@testing-library/react'
import { resolveContentHref } from '@/lib/content'
import { SEOFooter } from '../SEOFooter'

// Keep translation and regional-owner behavior independent of featured slots.
// The real manifest still supplies the income entry point tested below.
jest.mock('@/content/generated/footer-manifest.json', () => {
    const actual = jest.requireActual('@/content/generated/footer-manifest.json')
    return {
        ...actual,
        compare: [{ slug: 'wise', name: 'Wise', href: '/en/compare/peanut-vs-wise' }],
        articles: [
            ...actual.articles,
            { slug: 'verification', name: 'Verification Guide', href: '/en/help/verification' },
        ],
    }
})

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

        expect(hrefs).toContain('/es-419/use-cases/remote-workers')
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

    it.each([
        ['en', 'Get paid from abroad'],
        ['es-419', 'Cobra del exterior'],
        ['es-ar', 'Cobrá del exterior'],
        ['pt-br', 'Receba do exterior'],
    ] as const)('keeps the income entry point for %s', (locale, label) => {
        const actualManifest = jest.requireActual('@/content/generated/footer-manifest.json')
        expect(actualManifest.articles).toContainEqual(
            expect.objectContaining({
                slug: 'remote-workers',
                href: '/en/use-cases/remote-workers',
            })
        )
        const { container } = render(<SEOFooter locale={locale} />)
        const link = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].find((entry) =>
            entry.href.endsWith('/use-cases/remote-workers')
        )
        expect(link?.textContent).toBe(label)
    })
})
