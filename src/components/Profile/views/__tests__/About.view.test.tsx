/**
 * The beta-updates switch is deliberately unreachable by accident: it appears
 * only after five taps on the version line, and only on a native build, since
 * OTA channels mean nothing on the web.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { IntlWrapper } from '@/test-utils/intl'
import { loadMessages } from '@/i18n/app/messages'
import en from '@/i18n/app/messages/en.json'
import { AboutView } from '../About.view'
import * as capacitor from '@/utils/capacitor'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
const access = { supported: true }
const toast = { info: jest.fn() }

jest.mock('@/components/Profile/components/BetaUpdatesCard', () => ({
    BetaUpdatesCard: () => <div data-testid="beta-updates-card" />,
    useBetaUpdatesAccess: () => access,
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

let mockOpenHelp: jest.Mock | null = null
jest.mock('@/components/Global/AppHelpDrawer', () => ({ useAppHelpDrawer: () => mockOpenHelp }))

const fetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser }) }))

const claimPeanutTeamBadge = jest.fn<Promise<boolean>, []>()
jest.mock('@/services/peanut-team-badge', () => ({ claimPeanutTeamBadge: () => claimPeanutTeamBadge() }))

beforeEach(() => {
    mockOpenHelp = null
    access.supported = true
    toast.info.mockClear()
    fetchUser.mockClear()
    claimPeanutTeamBadge.mockReset().mockResolvedValue(true)
})

const tapVersion = (times: number) => {
    const version = screen.getByText(/^Version /)
    for (let i = 0; i < times; i++) fireEvent.click(version)
}

describe('AboutView', () => {
    it('puts the native review invitation before policies', async () => {
        const native = jest.spyOn(capacitor, 'isNativeBridge').mockReturnValue(true)
        try {
            render(<AboutView appVersion="1.2.3" />)
            const invitation = await screen.findByRole('heading', { name: 'Liking it so far?' })
            const policies = screen.getByRole('heading', { name: 'Policies' })
            expect(invitation.compareDocumentPosition(policies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
            expect(screen.getByRole('button', { name: 'Leave a review' })).toBeInTheDocument()
        } finally {
            native.mockRestore()
        }
    })

    it('lists every policy under its catalog name', () => {
        render(<AboutView appVersion="1.2.3" />)
        const names = Object.values(en.profile.about.policies)
        expect(names).toHaveLength(8)
        for (const name of names) expect(screen.getByRole('link', { name })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Security Disclosure' })).toHaveAttribute(
            'href',
            '/en/help/security-disclosure'
        )
    })

    // TASK-23054: in the app, Security Disclosure opens the help drawer, and
    // that row once rendered as a <button> that ended at ~60% width.
    it('renders every policy row the same way in one card, the last row closing it', () => {
        mockOpenHelp = jest.fn()
        render(<AboutView appVersion="1.2.3" />)
        const rows = Object.values(en.profile.about.policies).map(
            (name) => screen.getByText(name).closest('a') as HTMLElement
        )
        expect(rows).toHaveLength(8)
        expect(new Set(rows.map((row) => row.parentElement)).size).toBe(1)
        expect(new Set(rows.map((row) => row.tagName)).size).toBe(1)
        expect(new Set(rows.map((row) => row.className.replace('cursor-pointer', '').trim())).size).toBe(1)

        const cards = rows.map((row) => row.firstElementChild as HTMLElement)
        expect(cards[0]).toHaveClass('rounded-t-sm')
        for (const card of cards.slice(1, -1)) {
            expect(card).not.toHaveClass('rounded-t-sm')
            expect(card).not.toHaveClass('rounded-b-sm')
        }
        expect(cards[cards.length - 1]).toHaveClass('rounded-b-sm')

        fireEvent.click(rows[rows.length - 1])
        expect(mockOpenHelp).toHaveBeenCalledWith('security-disclosure')
    })

    it('keeps the beta switch hidden until the fifth tap', async () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(4)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        tapVersion(1)
        expect(toast.info).toHaveBeenCalledWith('Beta updates switch revealed below.')
        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
    })

    // The badge is a support/diagnostic record. The card must be usable while
    // the record and the best-effort profile refresh complete.
    it('records the team badge and refreshes the user after revealing the card', async () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)

        await waitFor(() => expect(claimPeanutTeamBadge).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(1))
        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
    })

    it('reveals the usable switch before a slow badge write completes', async () => {
        let releaseClaim!: (claimed: boolean) => void
        claimPeanutTeamBadge.mockReturnValueOnce(new Promise<boolean>((resolve) => (releaseClaim = resolve)))

        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)

        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
        expect(fetchUser).not.toHaveBeenCalled()

        releaseClaim(true)
        await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(1))
    })

    // Offline, the switch still has to appear: a device already on beta needs
    // the off switch, and that must not depend on the claim succeeding.
    it('still reveals the card when the badge claim fails', async () => {
        claimPeanutTeamBadge.mockResolvedValue(false)
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)

        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
        expect(fetchUser).not.toHaveBeenCalled()
    })

    // The card renders nothing on the web, so without a toast the fifth tap
    // would look like the gesture is simply broken.
    it('says the switch is app-only when tapped on the web, and earns nothing', () => {
        access.supported = false
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        expect(toast.info).toHaveBeenCalledWith('Beta updates are only available in the Peanut app.')
        expect(claimPeanutTeamBadge).not.toHaveBeenCalled()
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
        ['pt-BR', 'Termos de Serviço', '/pt-br/help/security-disclosure'],
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
