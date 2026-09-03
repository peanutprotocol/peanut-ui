/**
 * The beta-updates switch is deliberately unreachable by accident: it appears
 * only after five taps on the version line, and only on a native build, since
 * OTA channels mean nothing on the web.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { AboutView } from '../About.view'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
const access = { supported: true, visible: true }
const toast = { info: jest.fn(), warning: jest.fn() }

jest.mock('@/components/Profile/components/BetaUpdatesCard', () => ({
    BetaUpdatesCard: () => <div data-testid="beta-updates-card" />,
    useBetaUpdatesAccess: () => access,
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

beforeEach(() => {
    access.supported = true
    access.visible = true
    toast.info.mockClear()
    toast.warning.mockClear()
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

    it('keeps the beta switch hidden until the fifth tap', () => {
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(4)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        tapVersion(1)
        expect(screen.getByTestId('beta-updates-card')).toBeInTheDocument()
        expect(toast.info).toHaveBeenCalledWith('Beta updates switch revealed below.')
    })

    // The card renders nothing on the web and outside the cohort, so without a
    // toast the fifth tap would look like the gesture is simply broken.
    it('says the switch is app-only when tapped on the web', () => {
        access.supported = false
        access.visible = false
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        expect(toast.info).toHaveBeenCalledWith('Beta updates are only available in the Peanut app.')
    })

    it('says beta is not enabled when the device is outside the cohort', () => {
        access.visible = false
        render(<AboutView appVersion="1.2.3" />)
        tapVersion(5)
        expect(screen.queryByTestId('beta-updates-card')).not.toBeInTheDocument()
        expect(toast.warning).toHaveBeenCalledWith("Beta updates aren't enabled for this device.")
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
