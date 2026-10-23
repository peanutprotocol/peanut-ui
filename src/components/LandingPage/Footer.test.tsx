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

    // Card pages (Rain §11): no flags or selectors in the footer.
    it('drops the language picker when showLocaleSwitcher is false', () => {
        render(<Footer showSiteDirectory={false} showLocaleSwitcher={false} locale="en" />)
        expect(screen.queryByRole('button', { name: /^Language:/ })).not.toBeInTheDocument()
    })

    it('shows the language picker by default', () => {
        render(<Footer showSiteDirectory={false} locale="en" />)
        expect(screen.getAllByRole('button', { name: /^Language:/ }).length).toBeGreaterThan(0)
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
