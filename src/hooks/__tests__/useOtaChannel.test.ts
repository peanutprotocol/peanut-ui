/**
 * The half-finished exit: the channel is already cleared but the beta bundle is
 * still running. Reading the channel alone calls that "not on beta", which hides
 * the card from anyone outside the cohort — and the card is the only way to
 * finish leaving, on a device no production OTA can reach.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { useOtaChannel } from '../useOtaChannel'

const status = {
    channel: null as string | null,
    bundleVersion: '1.1.10846' as string | null,
    deviceId: 'abc-123',
    onBuiltinBundle: false,
}
const BETA_BUNDLE = '1.1.10846'
const pending = { value: BETA_BUNDLE as string | null }

jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => true }))
jest.mock('@/utils/capgo-updater', () => ({
    BETA_OTA_CHANNEL: 'staging',
    UNKNOWN_BETA_EXIT_BUNDLE: '1',
    OtaChannelClosedError: class extends Error {},
    OtaChannelOverrideError: class extends Error {},
    OtaChannelUnknownError: class extends Error {},
    OtaResetFailedError: class extends Error {},
    readOtaChannelStatus: () => Promise.resolve(status),
    pendingBetaExitBundle: () => pending.value,
    clearPendingBetaExit: () => {
        pending.value = null
    },
}))

beforeEach(() => {
    pending.value = BETA_BUNDLE
    status.channel = null
    status.bundleVersion = BETA_BUNDLE
    status.onBuiltinBundle = false
})

it('still reads as beta while an exit is owed', async () => {
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(result.current.isBeta).toBe(true)
})

it('clears the marker once the store bundle is the one running', async () => {
    status.onBuiltinBundle = true
    status.bundleVersion = null
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(pending.value).toBeNull()
    expect(result.current.isBeta).toBe(false)
})

// The reset lands on the store shell, whose JS may predate the marker and never
// clear it; by the time this code runs again a production OTA has replaced the
// builtin bundle. The exit is still done — the beta bundle is gone.
it('clears the marker once a production OTA has replaced the beta bundle', async () => {
    status.channel = 'production'
    status.bundleVersion = '1.1.3'
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(pending.value).toBeNull()
    expect(result.current.isBeta).toBe(false)
})

it('keeps the marker while the recorded beta bundle is still running', async () => {
    status.channel = 'production'
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(pending.value).toBe(BETA_BUNDLE)
    expect(result.current.isBeta).toBe(true)
})

// A marker written before the bundle was recorded can only be settled by the
// builtin bundle — any other running version is indistinguishable from beta.
it('settles a legacy marker only on the builtin bundle', async () => {
    pending.value = '1'
    status.bundleVersion = '1.1.3'
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(pending.value).toBe('1')
    expect(result.current.isBeta).toBe(true)
})

it('keeps the marker while the channel is still beta', async () => {
    status.channel = 'staging'
    status.onBuiltinBundle = true
    await act(async () => {
        renderHook(() => useOtaChannel())
    })
    expect(pending.value).toBe(BETA_BUNDLE)
})
