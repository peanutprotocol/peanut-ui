import { render } from '@testing-library/react'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { RelatedLink, RelatedPages } from '../mdx/RelatedPages'

describe('RelatedPages retired marketing links', () => {
    it.each(SUPPORTED_LOCALES)('keeps only retained UK routes in %s', (locale) => {
        const { container } = render(
            <RelatedPages locale={locale}>
                <RelatedLink href="/en/united-kingdom">United Kingdom guide</RelatedLink>
                <RelatedLink href="/send-money-from/united-kingdom/to/argentina">UK to Argentina</RelatedLink>
                <RelatedLink href="/send-money-from/united-kingdom/to/brazil">UK to Brazil</RelatedLink>
                <RelatedLink href="/withdraw/faster-payments">Withdraw to the UK</RelatedLink>
                <RelatedLink href="/deposit/from-gbp-account">Receive pounds</RelatedLink>
                <RelatedLink href="/deposit/via-faster-payments">Faster Payments</RelatedLink>
            </RelatedPages>
        )

        const links = [...container.querySelectorAll('a')]
        expect(links.map((link) => link.textContent)).toEqual([
            'Withdraw to the UK',
            'Receive pounds',
            'Faster Payments',
        ])
        expect(
            links.every((link) => link.getAttribute('href')?.startsWith(`/${locale === 'es-ar' ? 'es-419' : locale}/`))
        ).toBe(true)
    })

    it('omits the section when every related page is retired', () => {
        const { container } = render(
            <RelatedPages>
                <RelatedLink href="/united-kingdom">United Kingdom guide</RelatedLink>
            </RelatedPages>
        )

        expect(container).toBeEmptyDOMElement()
    })
})
