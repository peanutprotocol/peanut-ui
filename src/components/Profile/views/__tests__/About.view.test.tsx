/**
 * The beta-updates switch is deliberately unreachable by accident: it appears
 * only after five taps on the version line, and only on a native build, since
 * OTA channels mean nothing on the web.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { AboutView } from '../About.view'

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

const fetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser }) }))

const claimPeanutTeamBadge = jest.fn<Promise<boolean>, []>()
jest.mock('@/services/peanut-team-badge', () => ({ claimPeanutTeamBadge: () => claimPeanutTeamBadge() }))

beforeEach(() => {
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

    it('keeps the beta switch hidden until the fifth tap', async () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(4)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        tapVersion(1)
        expect(toast.info).toHaveBeenCalledWith('Beta updates switch revealed below.')
        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
    })

    // The card reads the badge off the user object, so revealing before the
    // claim lands would show a disabled toggle and an "ask for access" line on
    // the very gesture that just granted it.
    it('earns the team badge and refetches the user before revealing the card', async () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)

        await waitFor(() => expect(claimPeanutTeamBadge).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(1))
        expect(await screen.findByTestId('beta-updates-card')).toBeInTheDocument()
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
})
