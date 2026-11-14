import { act, renderHook, waitFor } from '@testing-library/react'
import { App } from '@capacitor/app'
import { getGoogleWalletCardStatus, getPushProvisioningAvailability } from '@/utils/push-provisioning'
import { usePushProvisioning } from '@/hooks/usePushProvisioning'

jest.mock('@/utils/native-platform', () => ({
    useNativePlatform: () => ({ isAndroidNative: true, isIOSNative: false }),
}))
jest.mock('@/utils/capacitor', () => ({ isIOSNative: () => false }))
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => () => true }))
jest.mock('@/utils/auth-token', () => ({ getClearEpoch: () => mockClearEpoch }))
jest.mock('@/services/rain', () => ({
    rainApi: { getProvisioningData: async () => ({ cardId: 'processor-card', cardSecret: 'test-secret' }) },
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@capacitor/app', () => ({ App: { addListener: jest.fn() } }))
jest.mock('@/utils/push-provisioning', () => ({
    PUSH_PROVISIONING_FLAGS: { google: 'push-provisioning-google', apple: 'push-provisioning-apple' },
    addCardToWallet: (...args: unknown[]) => mockAddCard(...args),
    getGoogleWalletCardStatus: jest.fn(),
    getPushProvisioningAvailability: jest.fn(),
}))

const exactStatus = jest.mocked(getGoogleWalletCardStatus)
const availability = jest.mocked(getPushProvisioningAvailability)
const addListener = jest.mocked(
    App.addListener as (
        event: 'appStateChange',
        callback: (state: { isActive: boolean }) => void
    ) => Promise<{ remove: () => Promise<void> }>
)
const card = { id: 'card-a', last4: '1234' }
const otherCard = { id: 'card-b', last4: card.last4 }
type Status = Awaited<ReturnType<typeof getGoogleWalletCardStatus>>

function pendingStatus() {
    let resolve!: (status: Status) => void
    const promise = new Promise<Status>((finish) => {
        resolve = finish
    })
    return { promise, resolve }
}

let onAppStateChange: (state: { isActive: boolean }) => void
let mockClearEpoch: number
let mockAddCard: jest.Mock

beforeEach(() => {
    jest.resetAllMocks()
    mockClearEpoch = 0
    mockAddCard = jest.fn().mockResolvedValue({ added: true })
    availability.mockResolvedValue({ available: true, alreadyInWallet: true })
    addListener.mockImplementation(async (_event, callback) => {
        onAppStateChange = callback
        return { remove: jest.fn().mockResolvedValue(undefined) }
    })
})

afterEach(() => {
    jest.useRealTimers()
})

it.each(['absent', 'pending', 'unknown'] as const)(
    'keeps add available for an exact %s result despite a matching suffix',
    async (status) => {
        exactStatus.mockResolvedValue(status)
        const { result } = renderHook(() => usePushProvisioning(card))

        await waitFor(() => {
            expect(exactStatus).toHaveBeenCalledWith(card.id)
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.nativeAvailable).toBe(true)
        expect(result.current.alreadyInWallet).toBe(false)
    }
)

it('keeps add available during verification and hides it on exact presence', async () => {
    const pending = pendingStatus()
    exactStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))

    await waitFor(() => {
        expect(exactStatus).toHaveBeenCalledWith(card.id)
        expect(result.current.nativeAvailable).toBe(true)
    })
    expect(result.current.alreadyInWallet).toBe(false)

    await act(async () => {
        pending.resolve('present')
    })
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
})

it('restores add when a resume confirms removal', async () => {
    exactStatus.mockResolvedValue('present')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    expect(addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function))
    const initialReads = exactStatus.mock.calls.length
    exactStatus.mockResolvedValue('absent')

    await act(async () => {
        onAppStateChange({ isActive: false })
        onAppStateChange({ isActive: true })
    })

    await waitFor(() => {
        expect(exactStatus.mock.calls.length).toBeGreaterThan(initialReads)
        expect(exactStatus).toHaveBeenLastCalledWith(card.id)
        expect(result.current.alreadyInWallet).toBe(false)
    })
    expect(result.current.nativeAvailable).toBe(true)
})

it('keeps confirmed presence when a resume check errors', async () => {
    exactStatus.mockResolvedValue('present')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    const initialReads = exactStatus.mock.calls.length
    exactStatus.mockResolvedValue('unknown')

    await act(async () => {
        onAppStateChange({ isActive: true })
    })

    expect(exactStatus.mock.calls.length).toBeGreaterThan(initialReads)
    expect(result.current.alreadyInWallet).toBe(true)
})

it('keeps confirmed presence when a resume check times out, and still clears on a later pending result', async () => {
    exactStatus.mockResolvedValue('present')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))

    jest.useFakeTimers()
    exactStatus.mockReturnValue(pendingStatus().promise)
    await act(async () => {
        onAppStateChange({ isActive: true })
    })
    await act(async () => {
        jest.advanceTimersByTime(6_000)
    })
    expect(result.current.alreadyInWallet).toBe(true)

    exactStatus.mockResolvedValue('pending')
    await act(async () => {
        onAppStateChange({ isActive: true })
    })
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('does not apply late presence to another card with the same suffix', async () => {
    const pending = pendingStatus()
    exactStatus.mockImplementation((id) => (id === card.id ? pending.promise : Promise.resolve('absent')))
    const { result, rerender } = renderHook((selectedCard) => usePushProvisioning(selectedCard), { initialProps: card })
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))

    rerender(otherCard)
    await waitFor(() => {
        expect(exactStatus).toHaveBeenCalledWith(otherCard.id)
        expect(result.current.isChecking).toBe(false)
    })
    await act(async () => {
        pending.resolve('present')
    })
    expect(result.current.alreadyInWallet).toBe(false)
})

it('ignores a presence response that arrives after logout', async () => {
    const pending = pendingStatus()
    exactStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))

    await act(async () => {
        mockClearEpoch += 1
        pending.resolve('present')
    })

    expect(result.current.alreadyInWallet).toBe(false)
})

it('hides add after a successful native add for the current card', async () => {
    exactStatus.mockResolvedValue('unknown')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.isChecking).toBe(false))
    expect(result.current.alreadyInWallet).toBe(false)

    await act(async () => {
        await result.current.addToWallet()
    })

    expect(mockAddCard).toHaveBeenCalled()
    expect(result.current.alreadyInWallet).toBe(true)
})

it('preserves the mounted add result when the native status method is unavailable on an older binary', async () => {
    exactStatus.mockResolvedValue('unsupported')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

    await act(async () => {
        await result.current.addToWallet()
    })
    expect(result.current.alreadyInWallet).toBe(true)

    await act(async () => {
        onAppStateChange({ isActive: true })
    })
    expect(result.current.alreadyInWallet).toBe(true)
})

it('restores the native add after removing a card added during the current mount', async () => {
    exactStatus.mockResolvedValue('unknown')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

    await act(async () => {
        await result.current.addToWallet()
    })
    expect(result.current.alreadyInWallet).toBe(true)

    exactStatus.mockResolvedValue('absent')
    await act(async () => {
        onAppStateChange({ isActive: true })
    })
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('finishes checking when native exact verification stalls', async () => {
    jest.useFakeTimers()
    const pending = pendingStatus()
    exactStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))

    await act(async () => {
        jest.advanceTimersByTime(6_000)
    })

    expect(result.current.isChecking).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
    expect(result.current.alreadyInWallet).toBe(false)
})
