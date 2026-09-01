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
    bundleVersion: '1.1.10846',
    deviceId: 'abc-123',
    onBuiltinBundle: false,
}
const pending = { value: true }

jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => true }))
jest.mock('@/utils/capgo-updater', () => ({
    BETA_OTA_CHANNEL: 'staging',
    OtaChannelClosedError: class extends Error {},
    OtaChannelOverrideError: class extends Error {},
    OtaChannelUnknownError: class extends Error {},
    OtaResetFailedError: class extends Error {},
    readOtaChannelStatus: () => Promise.resolve(status),
    hasPendingBetaExit: () => pending.value,
    clearPendingBetaExit: () => {
        pending.value = false
    },
}))

beforeEach(() => {
    pending.value = true
    status.channel = null
    status.onBuiltinBundle = false
})

it('still reads as beta while an exit is owed', async () => {
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(result.current.isBeta).toBe(true)
})

it('clears the marker once the store bundle is the one running', async () => {
    status.onBuiltinBundle = true
    const { result } = renderHook(() => useOtaChannel())
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(pending.value).toBe(false)
    expect(result.current.isBeta).toBe(false)
})

it('keeps the marker while the channel is still beta', async () => {
    status.channel = 'staging'
    status.onBuiltinBundle = true
    await act(async () => {
        renderHook(() => useOtaChannel())
    })
    expect(pending.value).toBe(true)
})
