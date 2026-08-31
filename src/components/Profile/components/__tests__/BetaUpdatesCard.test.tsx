/**
 * The card is native-only, and the failure a tester is most likely to hit is a
 * channel that has not been opened for self-assignment — that must read as a
 * concrete instruction, not a generic error.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BetaUpdatesCard } from '../BetaUpdatesCard'
import type { OtaChannelSwitchResult, UseOtaChannel } from '@/hooks/useOtaChannel'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

const channel = { current: {} as UseOtaChannel }
jest.mock('@/hooks/useOtaChannel', () => ({ useOtaChannel: () => channel.current }))

const setup = (overrides: Partial<UseOtaChannel> & { setBeta?: () => Promise<OtaChannelSwitchResult> } = {}) => {
    channel.current = {
        supported: true,
        status: { channel: null, bundleVersion: '1.1.0', deviceId: 'abc-123' },
        isBeta: false,
        busy: false,
        setBeta: jest.fn().mockResolvedValue('ok'),
        ...overrides,
    }
    render(<BetaUpdatesCard />)
}

beforeEach(() => jest.clearAllMocks())

it('renders nothing off native, where there is no OTA layer at all', () => {
    setup({ supported: false })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('tells the tester to get the channel opened when Capgo refuses', async () => {
    setup({ setBeta: jest.fn().mockResolvedValue('closed') })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('self-assignment')))
})

it('asks for a restart once the device is on the beta channel', async () => {
    setup()
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Restart')))
})
