import { render, screen } from '@testing-library/react'
import Footer from './Footer'
import { SUPPORTED_LOCALES } from '@/i18n/types'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('Footer status link', () => {
    it.each(SUPPORTED_LOCALES)('links to the localized status page in %s', (locale) => {
        render(<Footer showSiteDirectory locale={locale} />)
        const link = screen.getByRole('link', { name: /^(Status|Estado)$/ })
        expect(link).toHaveAttribute('href', `/${locale}/status`)
    })

    // It lives in the site directory now, not the top nav.
    it('does not render a status link when the site directory is hidden', () => {
        render(<Footer showSiteDirectory={false} locale="en" />)
        expect(screen.queryByRole('link', { name: /^Status$/ })).not.toBeInTheDocument()
    })

    it('lists Status directly under Supported Networks, with one pricing link', () => {
        render(<Footer showSiteDirectory locale="en" />)
        const labels = screen
            .getAllByRole('link')
            .map((a) => a.textContent?.trim())
            .filter(Boolean) as string[]

        expect(labels).toContain('Fees and Pricing')
        // The /help/fees-pricing article read as a duplicate of /pricing.
        expect(labels).not.toContain('Fees & Pricing')
        expect(labels.filter((l) => /pricing/i.test(l))).toHaveLength(1)
        expect(labels.indexOf('Status')).toBe(labels.indexOf('Supported Networks') + 1)
    })
})
