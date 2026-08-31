/**
 * The beta-updates switch is deliberately unreachable by accident: it appears
 * only after five taps on the version line, and only on a native build, since
 * OTA channels mean nothing on the web.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
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
})
