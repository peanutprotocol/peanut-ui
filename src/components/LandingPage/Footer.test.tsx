import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import Footer from './Footer'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { MIGRATION_CUTOVER_DATE, STORE_URL } from '@/constants/migration.consts'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// FooterChrome can carry a client child that reads the migration flag, so the
// hook is stubbed off — the state this suite asserts. `showGetTheApp` is not
// passed anywhere here, so the block is not mounted at all.
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

    // This footer is a server component on every marketing page in all four
    // locales, and the migration flag is client-only — so the store listings
    // ride the cutover DATE instead. Before it, the flag-off page is exactly
    // today's; after it, the listings are in the crawlable link graph, which
    // is the one thing a script-driven store bounce cannot give them.
    //
    // The clock these cases move is the one the SERVER reads while rendering,
    // which for these statically prerendered pages is the build clock — so what
    // they pin is which side of the cutover a BUILD falls on, not a transition
    // a deployed page performs on its own. Shipping the links needs a deploy on
    // or after the cutover date.
    describe('store listings', () => {
        const at = (iso: string) => jest.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime())
        afterEach(() => jest.restoreAllMocks())

        it('are absent from a build before the cutover, so nothing changes today', () => {
            at('2026-09-07T00:00:00Z')
            const { container } = render(<Footer showSiteDirectory locale="en" />)
            const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) =>
                a.getAttribute('href')
            )

            expect(hrefs).not.toContain(STORE_URL.ios)
            expect(hrefs).not.toContain(STORE_URL.android)
        })

        it('are crawlable links in a build from the cutover on', () => {
            at(MIGRATION_CUTOVER_DATE.toISOString())
            render(<Footer showSiteDirectory locale="en" />)

            expect(screen.getByRole('link', { name: 'Peanut on the App Store' })).toHaveAttribute('href', STORE_URL.ios)
            expect(screen.getByRole('link', { name: 'Peanut on Google Play' })).toHaveAttribute(
                'href',
                STORE_URL.android
            )
        })
    })
})
