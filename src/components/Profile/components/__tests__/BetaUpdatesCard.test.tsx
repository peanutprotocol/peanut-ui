/**
 * The card is native-only. The tap gesture controls discoverability; Capgo's
 * channel self-assignment is what decides who may JOIN. The PEANUT_TEAM record
 * must never make the visible switch inert, and it must never decide who may
 * leave. Beyond that, every join outcome has to read honestly: a tester told
 * to restart when nothing was downloaded goes looking for a build that isn't
 * there.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BetaUpdatesCard } from '../BetaUpdatesCard'
import type { OtaChannelSwitchResult, UseOtaChannel } from '@/hooks/useOtaChannel'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), attention: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

const channel = { current: {} as UseOtaChannel }
jest.mock('@/hooks/useOtaChannel', () => ({ useOtaChannel: () => channel.current }))

const setup = (overrides: Partial<UseOtaChannel> = {}) => {
    channel.current = {
        supported: true,
        status: { channel: null, bundleVersion: '1.1.0', deviceId: 'abc-123', onBuiltinBundle: false },
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
})

it('renders nothing off native, where there is no OTA layer at all', () => {
    setup({ supported: false })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('shows the public release in the beta card while retaining the Capgo ID for support', () => {
    const previous = process.env.NEXT_PUBLIC_OTA_DISPLAY_VERSION
    process.env.NEXT_PUBLIC_OTA_DISPLAY_VERSION = '1.6.9'
    try {
        setup({
            status: {
                channel: 'android-mobile-release',
                bundleVersion: '1.6.1000-android',
                deviceId: 'abc-123',
                onBuiltinBundle: false,
            },
        })
        expect(screen.getByText('1.6.9-a')).toHaveAttribute('title', '1.6.1000-android')
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_OTA_DISPLAY_VERSION
        else process.env.NEXT_PUBLIC_OTA_DISPLAY_VERSION = previous
    }
})

describe('channel switching access', () => {
    it('keeps the join control enabled when the profile refresh has no badge', async () => {
        setup()
        const toggle = screen.getByRole('switch')
        expect(toggle).toBeEnabled()
        fireEvent.click(toggle)
        await waitFor(() => expect(channel.current.setBeta).toHaveBeenCalledWith(true))
    })

    // The off switch is the only way back to the store bundle, so a device
    // already on beta must remain able to leave after any profile change.
    it('still lets a device already on beta leave', async () => {
        setup({
            isBeta: true,
            status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        })
        const toggle = screen.getByRole('switch')
        expect(toggle).toBeEnabled()
        fireEvent.click(toggle)
        await waitFor(() => expect(channel.current.setBeta).toHaveBeenCalledWith(false))
    })
})

// The off switch is the only way back to the store bundle, so it stays reachable
// on any native build for a device already on staging.
it('keeps the exit reachable for a device already on the channel', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
    })
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await waitFor(() => expect(channel.current.setBeta).toHaveBeenCalledWith(false))
})

it('says the app is still on beta code when the reset half of the exit fails', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left-still-beta'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Reinstall')))
})

// reset() normally reloads the app, so this toast is unobservable — except on a
// device already running the store bundle, where a silent no-op would look like
// the switch had failed.
it('confirms the exit when the app did not reload', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.0', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('released version')))
})

it('asks support to review a channel assignment that still wins after a local unset', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left-override'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('review its channel assignment'))
    )
})

it('keeps the switch on when the exit could not be confirmed', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left-unconfirmed'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not confirm the release channel'))
    )
    expect(screen.getByRole('switch')).toBeChecked()
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
    await waitFor(() => expect(toast.attention).toHaveBeenCalledWith(expect.stringContaining('no beta build')))
    expect(toast.success).not.toHaveBeenCalled()
})

it('does not promise a build when there is simply nothing newer', async () => {
    setup(switching('joined'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('no newer beta build')))
})
