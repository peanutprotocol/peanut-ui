/**
 * Two things keep the staging lane off customer devices: the card is native-only
 * and it is gated on an internal PostHog cohort — the five-tap gesture only
 * hides it. Beyond that, every join outcome has to read honestly: a tester told
 * to restart when nothing was downloaded goes looking for a build that isn't
 * there.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BETA_OTA_FLAG, BetaUpdatesCard } from '../BetaUpdatesCard'
import type { OtaChannelSwitchResult, UseOtaChannel } from '@/hooks/useOtaChannel'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

const flags = { enabled: [BETA_OTA_FLAG] as string[] }
jest.mock('@/hooks/useFeatureFlag', () => ({
    useFeatureFlags: () => (flag: string) => flags.enabled.includes(flag),
}))

const channel = { current: {} as UseOtaChannel }
jest.mock('@/hooks/useOtaChannel', () => ({ useOtaChannel: () => channel.current }))

const setup = (overrides: Partial<UseOtaChannel> = {}) => {
    channel.current = {
        supported: true,
        status: { channel: null, bundleVersion: '1.1.0', deviceId: 'abc-123' },
        isBeta: false,
        busy: false,
        setBeta: jest.fn().mockResolvedValue('staged' satisfies OtaChannelSwitchResult),
        ...overrides,
    }
    render(<BetaUpdatesCard />)
}

const switching = (result: OtaChannelSwitchResult) => ({ setBeta: jest.fn().mockResolvedValue(result) })

beforeEach(() => {
    jest.clearAllMocks()
    flags.enabled = [BETA_OTA_FLAG]
})

it('renders nothing off native, where there is no OTA layer at all', () => {
    setup({ supported: false })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('stays hidden for accounts outside the internal cohort', () => {
    flags.enabled = []
    setup()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

// Offboarding a tester (or a flag that fails to load) must not take the exit
// with it: the device is already on staging, and nothing else can bring it back.
it('keeps the exit reachable for a device already on the channel', async () => {
    flags.enabled = []
    setup({ isBeta: true, status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123' } })
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await waitFor(() => expect(channel.current.setBeta).toHaveBeenCalledWith(false))
})

it('says the app is still on beta code when the reset half of the exit fails', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123' },
        ...switching('left-still-beta'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Reinstall')))
})

it('tells the tester to get the channel opened when Capgo refuses', async () => {
    setup(switching('closed'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('self-assignment')))
})

it('asks for a restart only when a bundle is actually waiting', async () => {
    setup(switching('staged'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Restart')))
})

it('says so when the join downloaded nothing', async () => {
    setup(switching('join-no-bundle'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('no beta build')))
    expect(toast.success).not.toHaveBeenCalled()
})

it('does not promise a build when there is simply nothing newer', async () => {
    setup(switching('joined'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('no newer beta build')))
})
