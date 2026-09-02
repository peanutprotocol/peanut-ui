/**
 * The beta-updates switch is deliberately unreachable by accident: it appears
 * only after five taps on the version line, and only on a native build, since
 * OTA channels mean nothing on the web.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { IntlWrapper } from '@/test-utils/intl'
import { loadMessages } from '@/i18n/app/messages'
import { AboutView } from '../About.view'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Profile/components/BetaUpdatesCard', () => ({
    BetaUpdatesCard: () => <div data-testid="beta-updates-card" />,
}))

const tapVersion = (times: number) => {
    const version = screen.getByText(/^Version /)
    for (let i = 0; i < times; i++) fireEvent.click(version)
}

describe('AboutView', () => {
    it('keeps the beta switch hidden until the fifth tap', () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(4)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        tapVersion(1)
        expect(screen.getByTestId('beta-updates-card')).toBeInTheDocument()
    })

    it('forgets a partial tap streak once the window lapses', () => {
        jest.useFakeTimers()
        try {
            render(<AboutView appVersion="1.2.3" />)
            tapVersion(4)
            jest.advanceTimersByTime(2_000)
            tapVersion(4)
            expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        } finally {
            jest.useRealTimers()
        }
    })

    // TASK-22146: every policy title follows the app language. The legal hrefs
    // do not, so each language opens the same English documents; only the help
    // link is locale-targeted, like every other DocsLink.
    it.each([
        ['en', 'Terms of Service', '/en/help/security-disclosure'],
        ['es-419', 'Términos de servicio', '/es-419/help/security-disclosure'],
        ['pt-BR', 'Termos de serviço', '/pt-br/help/security-disclosure'],
    ] as const)(
        'in %s the policy titles follow the catalog and the legal hrefs stay put',
        async (locale, termsTitle, helpHref) => {
            const messages = await loadMessages(locale)
            rtlRender(
                <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                    <AboutView appVersion="1.2.3" />
                </NextIntlClientProvider>
            )
            const links = screen.getAllByRole('link')
            expect(links.map((link) => link.textContent)).toEqual(Object.values(messages.profile.about.policies))
            expect(links.map((link) => link.getAttribute('href'))).toEqual([
                '/terms',
                '/privacy',
                '/card-terms-us',
                '/card-terms-international',
                '/card-esign',
                '/card-privacy',
                '/card-prohibited-activities',
                helpHref,
            ])
            expect(screen.getByRole('link', { name: termsTitle })).toHaveAttribute('href', '/terms')
        }
    )
})
