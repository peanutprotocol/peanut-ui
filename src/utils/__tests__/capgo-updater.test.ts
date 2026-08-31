/**
 * Log-level contract for OTA update-check failures: transient failures stay at
 * info (invisible to Sentry's captureConsoleIntegration), known-fatal patterns
 * and persistent streaks escalate to error. Plus the beta-channel opt-in, which
 * must never strand a tester on a bundle production can no longer replace.
 */
const mockUpdater = {
    notifyAppReady: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    getLatest: jest.fn(),
    download: jest.fn(),
    next: jest.fn().mockResolvedValue(undefined),
    setChannel: jest.fn(),
    unsetChannel: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
}

jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: mockUpdater }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

import { initCapgoUpdater } from '../capgo-updater'

let info: jest.SpyInstance
let error: jest.SpyInstance

beforeEach(() => {
    jest.useFakeTimers()
    window.localStorage.clear()
    info = jest.spyOn(console, 'info').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

// one simulated app launch: init + the deferred update check
async function launch(): Promise<void> {
    await initCapgoUpdater()
    await jest.advanceTimersByTimeAsync(5_000)
}

it('logs a transient failure at info, not error', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('Failed to fetch'))
    await launch()
    expect(info).toHaveBeenCalledWith('[capgo] update check failed:', 'Failed to fetch')
    expect(error).not.toHaveBeenCalled()
})

it('logs a known-fatal failure at error on the first launch', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('Checksum mismatch for bundle'))
    await launch()
    expect(error).toHaveBeenCalledWith('[capgo] update check failed:', 'Checksum mismatch for bundle')
    expect(info).not.toHaveBeenCalled()
})

it('escalates the same failure to error on the third consecutive launch', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('Failed to fetch'))
    await launch()
    await launch()
    expect(error).not.toHaveBeenCalled()
    await launch()
    expect(error).toHaveBeenCalledWith('[capgo] update check failed on 3 consecutive launches:', 'Failed to fetch')
    expect(info).toHaveBeenCalledTimes(2)
})

it('resets the streak after a successful check', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('Failed to fetch'))
    await launch()
    await launch()
    mockUpdater.getLatest.mockRejectedValue(new Error('No new version available'))
    await launch()
    mockUpdater.getLatest.mockRejectedValue(new Error('Failed to fetch'))
    await launch()
    expect(error).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(3)
})

it('restarts the streak when the failure message changes', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('Failed to fetch'))
    await launch()
    await launch()
    mockUpdater.getLatest.mockRejectedValue(new Error('Request timed out'))
    await launch()
    expect(error).not.toHaveBeenCalled()
})

describe('beta channel opt-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUpdater.setChannel.mockResolvedValue({ status: 'ok' })
        mockUpdater.getLatest.mockRejectedValue(new Error('No new version available'))
    })

    it('joins the staging channel and stages its bundle straight away', async () => {
        const { joinBetaOtaChannel, BETA_OTA_CHANNEL } = await import('../capgo-updater')
        mockUpdater.getLatest.mockResolvedValue({ url: 'https://bundles/1.1.10846', version: '1.1.10846' })
        mockUpdater.download.mockResolvedValue({ id: 'beta-bundle' })
        await expect(joinBetaOtaChannel()).resolves.toBe('staged')
        expect(mockUpdater.setChannel).toHaveBeenCalledWith({ channel: BETA_OTA_CHANNEL })
        expect(mockUpdater.next).toHaveBeenCalledWith({ id: 'beta-bundle' })
    })

    // The tester is on the channel, but nothing is pending — telling them to
    // restart would send them looking for a build that was never downloaded.
    it('separates "joined, nothing new" from "joined, bundle waiting"', async () => {
        const { joinBetaOtaChannel } = await import('../capgo-updater')
        await expect(joinBetaOtaChannel()).resolves.toBe('up-to-date')
    })

    it('reports a failed download rather than a staged bundle', async () => {
        const { joinBetaOtaChannel } = await import('../capgo-updater')
        mockUpdater.getLatest.mockRejectedValue(new Error('disable_auto_update_under_native'))
        await expect(joinBetaOtaChannel()).resolves.toBe('failed')
    })

    it('reports a channel that does not accept self-assignment', async () => {
        const { joinBetaOtaChannel, OtaChannelClosedError } = await import('../capgo-updater')
        mockUpdater.setChannel.mockRejectedValue(new Error('channel_not_found'))
        await expect(joinBetaOtaChannel()).rejects.toBeInstanceOf(OtaChannelClosedError)
        expect(mockUpdater.getLatest).not.toHaveBeenCalled()
    })

    // iOS normalises the private-channel case to `channel_private`; Android
    // rejects with the backend's own codes, which read nothing like it.
    it.each(['channel_private', 'cannot_update_via_private_channel', 'channel_self_set_not_allowed'])(
        'reads %s off a CapacitorException data code',
        async (code) => {
            const { joinBetaOtaChannel, OtaChannelClosedError } = await import('../capgo-updater')
            mockUpdater.setChannel.mockRejectedValue(
                Object.assign(new Error('setChannel failed'), { data: { error: code } })
            )
            await expect(joinBetaOtaChannel()).rejects.toBeInstanceOf(OtaChannelClosedError)
        }
    )

    // A timeout must not send the tester chasing a dashboard toggle that is
    // already correct.
    it('leaves a network failure as an ordinary error', async () => {
        const { joinBetaOtaChannel, OtaChannelClosedError } = await import('../capgo-updater')
        mockUpdater.setChannel.mockRejectedValue(new Error('Failed to fetch'))
        await expect(joinBetaOtaChannel()).rejects.not.toBeInstanceOf(OtaChannelClosedError)
    })

    it('treats a closed-channel code in the response as a rejection', async () => {
        const { joinBetaOtaChannel, OtaChannelClosedError } = await import('../capgo-updater')
        mockUpdater.setChannel.mockResolvedValue({ status: 'error', error: 'disabled_by_config' })
        await expect(joinBetaOtaChannel()).rejects.toBeInstanceOf(OtaChannelClosedError)
    })

    // A staging bundle outranks every production one, so unsetting the channel
    // alone would leave the tester stuck on beta code forever.
    it('drops back to the store bundle when leaving', async () => {
        const { leaveBetaOtaChannel } = await import('../capgo-updater')
        await leaveBetaOtaChannel()
        expect(mockUpdater.unsetChannel).toHaveBeenCalled()
        expect(mockUpdater.reset).toHaveBeenCalled()
    })

    // Channel unset + beta bundle still running is the one state no OTA can
    // repair, so a failed reset must not be reported as a clean exit.
    it('retries a failed reset and reports the device is still on beta code', async () => {
        const { leaveBetaOtaChannel, OtaResetFailedError } = await import('../capgo-updater')
        mockUpdater.reset.mockRejectedValue(new Error('reset failed'))
        await expect(leaveBetaOtaChannel()).rejects.toBeInstanceOf(OtaResetFailedError)
        expect(mockUpdater.reset).toHaveBeenCalledTimes(2)
    })

    it('accepts a reset that only succeeds on the retry', async () => {
        const { leaveBetaOtaChannel } = await import('../capgo-updater')
        mockUpdater.reset.mockRejectedValueOnce(new Error('reset failed')).mockResolvedValueOnce(undefined)
        await expect(leaveBetaOtaChannel()).resolves.toBeUndefined()
    })
})
