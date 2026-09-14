/**
 * The card is native-only. The tap gesture controls discoverability; the
 * PEANUT_TEAM badge is what decides who may JOIN. It must never decide who may
 * leave, and it must never hide the card — a blocked device has to be able to
 * read why. Beyond that, every join outcome has to read honestly: a tester told
 * to restart when nothing was downloaded goes looking for a build that isn't
 * there.
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BetaUpdatesCard } from '../BetaUpdatesCard'
import type { OtaChannelSwitchResult, UseOtaChannel } from '@/hooks/useOtaChannel'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => toast }))

const channel = { current: {} as UseOtaChannel }
jest.mock('@/hooks/useOtaChannel', () => ({ useOtaChannel: () => channel.current }))

let badges: { code: string }[] = [{ code: 'PEANUT_TEAM' }]
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { badges } } }) }))

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
    badges = [{ code: 'PEANUT_TEAM' }]
})

it('renders nothing off native, where there is no OTA layer at all', () => {
    setup({ supported: false })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

describe('badge gating', () => {
    it('will not let an account without the badge join', () => {
        badges = []
        setup()
        expect(screen.getByRole('switch')).toBeDisabled()
    })

    // A missing badge must never look like silence: that is how the previous
    // PostHog gate hid the switch from its own testers for months.
    it('tells a blocked account why, and what to ask for', () => {
        badges = []
        setup()
        expect(screen.getByText(/not enabled for this account/i)).toBeInTheDocument()
    })

    // Revoking the badge mid-beta must not strand a device on beta code.
    it('still lets a device already on beta leave once the badge is revoked', async () => {
        badges = []
        setup({
            isBeta: true,
            status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        })
        const toggle = screen.getByRole('switch')
        expect(toggle).toBeEnabled()
        fireEvent.click(toggle)
        await waitFor(() => expect(channel.current.setBeta).toHaveBeenCalledWith(false))
    })

    it('says nothing about eligibility to an account holding the badge', () => {
        setup()
        expect(screen.queryByText(/not enabled for this account/i)).not.toBeInTheDocument()
        expect(screen.getByRole('switch')).toBeEnabled()
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

it('sends dashboard-assigned testers to an admin, since the app cannot unassign them', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left-override'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Capgo dashboard')))
})

it('keeps the switch on when the exit could not be confirmed', async () => {
    setup({
        isBeta: true,
        status: { channel: 'staging', bundleVersion: '1.1.10846', deviceId: 'abc-123', onBuiltinBundle: false },
        ...switching('left-unconfirmed'),
    })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('still on the beta build')))
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
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('no beta build')))
    expect(toast.success).not.toHaveBeenCalled()
})

it('does not promise a build when there is simply nothing newer', async () => {
    setup(switching('joined'))
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('no newer beta build')))
})
