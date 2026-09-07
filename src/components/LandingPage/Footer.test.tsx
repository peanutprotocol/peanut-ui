import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import Footer from './Footer'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { STORE_URL } from '@/constants/migration.consts'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// FooterChrome now carries a client child that reads the migration copy through
// next-intl, so the footer no longer renders bare — renderWithIntl supplies the
// provider. The flag stays off here, which is the state this suite asserts.
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))

const render = renderWithIntl

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

    // Every other download CTA is a script-driven bounce a crawler can't follow.
    it('lists both store listings as crawlable links', () => {
        const { container } = render(<Footer showSiteDirectory locale="en" />)
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => a.getAttribute('href'))

        expect(hrefs).toContain(STORE_URL.ios)
        expect(hrefs).toContain(STORE_URL.android)
        expect(screen.getByRole('link', { name: 'Peanut on the App Store' })).toHaveAttribute('href', STORE_URL.ios)
        expect(screen.getByRole('link', { name: 'Peanut on Google Play' })).toHaveAttribute('href', STORE_URL.android)
    })
})
