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

    it('joins the staging channel and pulls its bundle straight away', async () => {
        const { joinBetaOtaChannel, BETA_OTA_CHANNEL } = await import('../capgo-updater')
        await joinBetaOtaChannel()
        expect(mockUpdater.setChannel).toHaveBeenCalledWith({ channel: BETA_OTA_CHANNEL })
        expect(mockUpdater.getLatest).toHaveBeenCalled()
    })

    it('reports a channel that does not accept self-assignment', async () => {
        const { joinBetaOtaChannel, OtaChannelClosedError } = await import('../capgo-updater')
        mockUpdater.setChannel.mockRejectedValue(new Error('channel_not_found'))
        await expect(joinBetaOtaChannel()).rejects.toBeInstanceOf(OtaChannelClosedError)
        expect(mockUpdater.getLatest).not.toHaveBeenCalled()
    })

    it('treats an error field in the response as a rejection', async () => {
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
})
