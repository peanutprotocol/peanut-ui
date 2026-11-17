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
type Availability = Awaited<ReturnType<typeof getPushProvisioningAvailability>>
const suffixAbsent: Availability = { available: true, alreadyInWallet: false }
const suffixPresent: Availability = { available: false, alreadyInWallet: true }

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((finish) => {
        resolve = finish
    })
    return { promise, resolve }
}

async function foreground() {
    await act(async () => {
        onAppStateChange({ isActive: false })
        onAppStateChange({ isActive: true })
    })
}

let onAppStateChange: (state: { isActive: boolean }) => void
let mockClearEpoch: number
let mockAddCard: jest.Mock
let removeListener: jest.Mock

beforeEach(() => {
    jest.resetAllMocks()
    mockClearEpoch = 0
    mockAddCard = jest.fn().mockResolvedValue({ added: true })
    removeListener = jest.fn().mockResolvedValue(undefined)
    exactStatus.mockResolvedValue('unknown')
    availability.mockResolvedValue(suffixAbsent)
    addListener.mockImplementation(async (_event, callback) => {
        onAppStateChange = callback
        return { remove: removeListener }
    })
})

afterEach(() => {
    jest.useRealTimers()
})

it.each(['present', 'absent', 'pending', 'unknown', 'unsupported'] as const)(
    'hides Add for an exact %s result when the Android suffix matches',
    async (status) => {
        exactStatus.mockResolvedValue(status)
        availability.mockResolvedValue(suffixPresent)
        const { result } = renderHook(() => usePushProvisioning(card))

        await waitFor(() => expect(result.current.isChecking).toBe(false))
        expect(availability).toHaveBeenCalledWith(card.last4)
        expect(result.current.nativeAvailable).toBe(false)
        expect(result.current.alreadyInWallet).toBe(true)
        expect(mockAddCard).not.toHaveBeenCalled()
    }
)

it('completes the initial suffix match atomically without flashing Add while exact verification is unknown', async () => {
    const pending = deferred<Status>()
    exactStatus.mockReturnValue(pending.promise)
    availability.mockResolvedValue(suffixPresent)
    const renders: { checking: boolean; nativeAvailable: boolean; present: boolean }[] = []
    const { result } = renderHook(() => {
        const value = usePushProvisioning(card)
        renders.push({
            checking: value.isChecking,
            nativeAvailable: value.nativeAvailable,
            present: value.alreadyInWallet,
        })
        return value
    })
    await act(async () => {})
    expect(renders.some((value) => value.nativeAvailable)).toBe(false)

    await act(async () => pending.resolve('unknown'))
    await waitFor(() => expect(result.current.isChecking).toBe(false))
    expect(result.current.alreadyInWallet).toBe(true)
    expect(renders.every((value) => value.checking || value.present)).toBe(true)
    expect(renders.some((value) => value.nativeAvailable)).toBe(false)
})

it('hides Add on exact presence after a suffix miss', async () => {
    const pending = deferred<Status>()
    exactStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))
    await act(async () => pending.resolve('present'))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    expect(result.current.nativeAvailable).toBe(false)
})

it('rechecks both lookups after a manual Wallet add and restores Add on the next suffix removal', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const initialExactReads = exactStatus.mock.calls.length
    const initialSuffixReads = availability.mock.calls.length
    availability.mockResolvedValue(suffixPresent)

    await foreground()
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    expect(exactStatus.mock.calls.length).toBeGreaterThan(initialExactReads)
    expect(availability.mock.calls.length).toBeGreaterThan(initialSuffixReads)
    expect(exactStatus).toHaveBeenLastCalledWith(card.id)
    expect(availability).toHaveBeenLastCalledWith(card.last4)
    expect(result.current.nativeAvailable).toBe(false)

    availability.mockResolvedValue(suffixAbsent)
    await foreground()
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(false))
    expect(result.current.nativeAvailable).toBe(true)
    expect(mockAddCard).not.toHaveBeenCalled()
})

it.each(['absent', 'pending', 'unknown', 'unsupported'] as const)(
    'restores suffix-only presence for exact %s plus a resolved suffix miss',
    async (status) => {
        availability.mockResolvedValue(suffixPresent)
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
        exactStatus.mockResolvedValue(status)
        availability.mockResolvedValue(suffixAbsent)
        await foreground()
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(false))
        expect(result.current.nativeAvailable).toBe(true)
    }
)

it.each(['absent', 'pending'] as const)(
    'keeps Add hidden for foreground exact %s when the suffix still matches',
    async (status) => {
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
        exactStatus.mockResolvedValue(status)
        availability.mockResolvedValue(suffixPresent)
        await foreground()
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
        expect(result.current.nativeAvailable).toBe(false)
    }
)

it.each([
    { source: 'exact', failure: 'timeout' },
    { source: 'in-app', failure: 'timeout' },
    { source: 'exact', failure: 'rejection' },
    { source: 'in-app', failure: 'rejection' },
] as const)(
    'keeps $source confirmed presence on exact $failure despite a resolved suffix miss',
    async ({ source, failure }) => {
        if (source === 'exact') exactStatus.mockResolvedValue('present')
        const { result } = renderHook(() => usePushProvisioning(card))
        if (source === 'in-app') {
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            await act(async () => {
                await result.current.addToWallet()
            })
        }
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))

        jest.useFakeTimers()
        if (failure === 'timeout') exactStatus.mockReturnValue(deferred<Status>().promise)
        else exactStatus.mockRejectedValue(new Error('exact lookup unavailable'))
        const suffixReads = availability.mock.calls.length
        await foreground()
        expect(availability.mock.calls.length).toBeGreaterThan(suffixReads)
        await act(async () => {
            jest.advanceTimersByTime(6_000)
        })
        expect(result.current.alreadyInWallet).toBe(true)
        expect(result.current.nativeAvailable).toBe(false)
        expect(result.current.isChecking).toBe(false)
    }
)

it.each(['timeout', 'rejection'] as const)(
    'clears suffix-only presence after exact %s and a resolved suffix miss',
    async (failure) => {
        availability.mockResolvedValue(suffixPresent)
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
        availability.mockResolvedValue(suffixAbsent)
        jest.useFakeTimers()
        if (failure === 'timeout') exactStatus.mockReturnValue(deferred<Status>().promise)
        else exactStatus.mockRejectedValue(new Error('exact lookup unavailable'))
        await foreground()
        await act(async () => {
            jest.advanceTimersByTime(6_000)
        })
        expect(result.current.alreadyInWallet).toBe(false)
        expect(result.current.nativeAvailable).toBe(true)
    }
)

it.each([
    { prior: false, failure: 'timeout' },
    { prior: true, failure: 'timeout' },
    { prior: false, failure: 'rejection' },
    { prior: true, failure: 'rejection' },
])('keeps prior presence $prior when suffix $failure and exact is inconclusive', async ({ prior, failure }) => {
    availability.mockResolvedValue(prior ? suffixPresent : suffixAbsent)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.isChecking).toBe(false))
    expect(result.current.alreadyInWallet).toBe(prior)
    jest.useFakeTimers()
    if (failure === 'timeout') availability.mockReturnValue(deferred<Availability>().promise)
    else availability.mockRejectedValue(new Error('suffix lookup unavailable'))
    const suffixReads = availability.mock.calls.length
    await foreground()
    expect(availability.mock.calls.length).toBeGreaterThan(suffixReads)
    await act(async () => {
        jest.advanceTimersByTime(6_000)
    })
    expect(result.current.alreadyInWallet).toBe(prior)
    expect(result.current.isChecking).toBe(false)
})

it.each([
    { status: 'absent', failure: 'timeout' },
    { status: 'pending', failure: 'timeout' },
    { status: 'absent', failure: 'rejection' },
    { status: 'pending', failure: 'rejection' },
] as const)(
    'keeps suffix-derived presence on exact $status when the suffix lookup fails ($failure)',
    async ({ status, failure }) => {
        availability.mockResolvedValue(suffixPresent)
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
        jest.useFakeTimers()
        exactStatus.mockResolvedValue(status)
        if (failure === 'timeout') availability.mockReturnValue(deferred<Availability>().promise)
        else availability.mockRejectedValue(new Error('suffix lookup unavailable'))
        await foreground()
        await act(async () => {
            jest.advanceTimersByTime(6_000)
        })
        expect(result.current.alreadyInWallet).toBe(true)
        expect(result.current.nativeAvailable).toBe(false)
    }
)

it.each(['absent', 'pending'] as const)(
    'clears exact-confirmed presence on exact %s even when the suffix lookup fails',
    async (status) => {
        exactStatus.mockResolvedValue('present')
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
        exactStatus.mockResolvedValue(status)
        availability.mockRejectedValue(new Error('suffix lookup unavailable'))
        await foreground()
        expect(result.current.alreadyInWallet).toBe(false)
        expect(result.current.nativeAvailable).toBe(true)
    }
)

it.each([
    {
        exact: 'unknown',
        source: 'native SDK failure',
        failed: { available: true, alreadyInWallet: false, lookupFailed: true },
    },
    {
        exact: 'absent',
        source: 'native SDK failure',
        failed: { available: true, alreadyInWallet: false, lookupFailed: true },
    },
    {
        exact: 'unknown',
        source: 'bridge fallback',
        failed: { available: false, alreadyInWallet: false, lookupFailed: true },
    },
] as const)('does not read a $source as a suffix miss when exact is $exact', async ({ exact, failed }) => {
    availability.mockResolvedValue(suffixPresent)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    exactStatus.mockResolvedValue(exact)
    availability.mockResolvedValue(failed)
    await foreground()
    expect(availability).toHaveBeenCalledTimes(2)
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)

    availability.mockResolvedValue(suffixAbsent)
    await foreground()
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(false))
    expect(result.current.nativeAvailable).toBe(true)
})

it('keeps Add disabled when the app returns to the foreground after a logout during the initial check', async () => {
    const pending = deferred<Availability>()
    availability.mockReturnValueOnce(pending.promise).mockResolvedValue(suffixAbsent)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(availability).toHaveBeenCalledWith(card.last4))
    await act(async () => {
        mockClearEpoch += 1
        pending.resolve(suffixAbsent)
    })
    expect(result.current.nativeAvailable).toBe(false)

    await foreground()
    expect(availability).toHaveBeenCalledTimes(2)
    expect(result.current.nativeAvailable).toBe(false)
    expect(result.current.alreadyInWallet).toBe(false)
})

it('bounds a foreground suffix lookup independently when the exact lookup resolves', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    jest.useFakeTimers()
    availability.mockReturnValue(deferred<Availability>().promise)
    exactStatus.mockResolvedValue('present')
    const suffixReads = availability.mock.calls.length
    await foreground()
    expect(availability.mock.calls.length).toBeGreaterThan(suffixReads)
    await act(async () => {
        jest.advanceTimersByTime(6_000)
    })
    expect(result.current.isChecking).toBe(false)
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)
})

it('does not apply late exact presence to another card with the same suffix', async () => {
    const pending = deferred<Status>()
    exactStatus.mockImplementation((id) => (id === card.id ? pending.promise : Promise.resolve('absent')))
    const { result, rerender } = renderHook((selectedCard) => usePushProvisioning(selectedCard), { initialProps: card })
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))
    rerender(otherCard)
    await waitFor(() => expect(result.current.isChecking).toBe(false))
    await act(async () => pending.resolve('present'))
    expect(result.current.alreadyInWallet).toBe(false)
})

it('ignores an exact presence response that arrives after logout', async () => {
    const pending = deferred<Status>()
    exactStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(exactStatus).toHaveBeenCalledWith(card.id))
    await act(async () => {
        mockClearEpoch += 1
        pending.resolve('present')
    })
    expect(result.current.alreadyInWallet).toBe(false)
})

it('ignores a late initial suffix match after logout', async () => {
    const pending = deferred<Availability>()
    availability.mockReturnValue(pending.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(availability).toHaveBeenCalledWith(card.last4))
    await act(async () => {
        mockClearEpoch += 1
        pending.resolve(suffixPresent)
    })
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(false)
})

it('ignores a late initial suffix match after switching cards with the same last four', async () => {
    const pending = deferred<Availability>()
    availability.mockReturnValueOnce(pending.promise).mockResolvedValue(suffixAbsent)
    const { result, rerender } = renderHook((selectedCard) => usePushProvisioning(selectedCard), { initialProps: card })
    await waitFor(() => expect(availability).toHaveBeenCalledTimes(1))
    rerender(otherCard)
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    await act(async () => pending.resolve(suffixPresent))
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('ignores a stale foreground suffix match after a newer refresh confirms removal', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    availability.mockReturnValueOnce(pending.promise).mockResolvedValue(suffixAbsent)
    await foreground()
    await foreground()
    await act(async () => pending.resolve(suffixPresent))
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('does not let an overlapping older suffix miss erase a newer matching suffix', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    availability.mockReturnValueOnce(pending.promise).mockResolvedValue(suffixPresent)
    await foreground()
    await foreground()
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))
    await act(async () => pending.resolve(suffixAbsent))
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)
})

it('cancels the listener and ignores a late suffix match after unmount', async () => {
    const { result, unmount } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    availability.mockReturnValueOnce(pending.promise)
    await foreground()
    const lastMountedResult = result.current
    unmount()
    await act(async () => pending.resolve(suffixPresent))
    expect(removeListener).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(lastMountedResult)
    expect(result.current.alreadyInWallet).toBe(false)
    expect(mockAddCard).not.toHaveBeenCalled()
})

it('hides Add after a successful native add for the current card', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    await act(async () => {
        await result.current.addToWallet()
    })
    expect(mockAddCard).toHaveBeenCalled()
    expect(result.current.alreadyInWallet).toBe(true)
})

it('preserves the mounted add result when exact status is unsupported on an older binary', async () => {
    exactStatus.mockResolvedValue('unsupported')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    await act(async () => {
        await result.current.addToWallet()
    })
    expect(result.current.alreadyInWallet).toBe(true)
    await foreground()
    expect(result.current.alreadyInWallet).toBe(true)
})

it.each(['absent', 'pending'] as const)(
    'clears in-app confirmed presence on exact %s and a suffix miss',
    async (status) => {
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
        await act(async () => {
            await result.current.addToWallet()
        })
        expect(result.current.alreadyInWallet).toBe(true)
        exactStatus.mockResolvedValue(status)
        await foreground()
        expect(result.current.alreadyInWallet).toBe(false)
        expect(result.current.nativeAvailable).toBe(true)
    }
)

it('finishes initial checking when exact verification stalls and the suffix misses', async () => {
    jest.useFakeTimers()
    exactStatus.mockReturnValue(deferred<Status>().promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await act(async () => {})
    await act(async () => {
        jest.advanceTimersByTime(6_000)
    })
    expect(result.current.isChecking).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
    expect(result.current.alreadyInWallet).toBe(false)
})

it('ignores a late foreground suffix match after logout', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    const previousReads = availability.mock.calls.length
    availability.mockReturnValueOnce(pending.promise)
    await foreground()
    expect(availability.mock.calls.length).toBeGreaterThan(previousReads)

    await act(async () => {
        mockClearEpoch += 1
        pending.resolve(suffixPresent)
    })
    expect(result.current.alreadyInWallet).toBe(false)
    expect(mockAddCard).not.toHaveBeenCalled()
})

it('ignores a late foreground suffix match after switching cards with the same last four', async () => {
    const { result, rerender } = renderHook((selectedCard) => usePushProvisioning(selectedCard), { initialProps: card })
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    const previousReads = availability.mock.calls.length
    availability.mockReturnValueOnce(pending.promise).mockResolvedValue(suffixAbsent)
    await foreground()
    expect(availability.mock.calls.length).toBeGreaterThan(previousReads)

    rerender(otherCard)
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    expect(exactStatus).toHaveBeenLastCalledWith(otherCard.id)
    await act(async () => pending.resolve(suffixPresent))
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('does not let an older foreground suffix miss erase a newer successful in-app add', async () => {
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    const pending = deferred<Availability>()
    const previousReads = availability.mock.calls.length
    availability.mockReturnValueOnce(pending.promise)
    await foreground()
    expect(availability.mock.calls.length).toBeGreaterThan(previousReads)

    await act(async () => {
        await result.current.addToWallet()
    })
    expect(result.current.alreadyInWallet).toBe(true)
    await act(async () => pending.resolve(suffixAbsent))
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)
})

it('resets exact confirmation after exact absence even while a suffix match keeps Add hidden', async () => {
    exactStatus.mockResolvedValue('present')
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.alreadyInWallet).toBe(true))

    exactStatus.mockResolvedValue('absent')
    availability.mockResolvedValue(suffixPresent)
    await foreground()
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)

    exactStatus.mockResolvedValue('unknown')
    availability.mockResolvedValue(suffixAbsent)
    await foreground()
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})

it('cleans up both pending foreground lookup timers on unmount', async () => {
    const { result, unmount } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
    jest.useFakeTimers()
    const timerCountBeforeRefresh = jest.getTimerCount()
    exactStatus.mockReturnValue(deferred<Status>().promise)
    availability.mockReturnValue(deferred<Availability>().promise)
    await foreground()
    expect(jest.getTimerCount()).toBeGreaterThan(timerCountBeforeRefresh)

    unmount()
    jest.runAllTicks()
    expect(jest.getTimerCount()).toBe(timerCountBeforeRefresh)
    expect(removeListener).toHaveBeenCalledTimes(1)
})

it('publishes an initial suffix match atomically while a newer foreground refresh remains pending', async () => {
    const initialSuffix = deferred<Availability>()
    const foregroundSuffix = deferred<Availability>()
    const foregroundExact = deferred<Status>()
    availability.mockReturnValueOnce(initialSuffix.promise).mockReturnValue(foregroundSuffix.promise)
    const renders: { checking: boolean; nativeAvailable: boolean; present: boolean }[] = []
    const { result } = renderHook(() => {
        const value = usePushProvisioning(card)
        renders.push({
            checking: value.isChecking,
            nativeAvailable: value.nativeAvailable,
            present: value.alreadyInWallet,
        })
        return value
    })
    await waitFor(() => expect(addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function)))
    exactStatus.mockReturnValue(foregroundExact.promise)
    await foreground()

    await act(async () => initialSuffix.resolve(suffixPresent))
    expect(result.current.isChecking).toBe(false)
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)
    expect(renders.some((value) => value.nativeAvailable)).toBe(false)
    expect(renders.every((value) => value.checking || value.present)).toBe(true)

    await act(async () => {
        foregroundExact.resolve('unknown')
        foregroundSuffix.resolve(suffixPresent)
    })
    expect(result.current.isChecking).toBe(false)
    expect(result.current.alreadyInWallet).toBe(true)
    expect(result.current.nativeAvailable).toBe(false)
    expect(renders.some((value) => value.nativeAvailable)).toBe(false)
})

it('does not let a late initial suffix match overwrite a completed foreground removal', async () => {
    const initialSuffix = deferred<Availability>()
    const foregroundSuffix = deferred<Availability>()
    const foregroundExact = deferred<Status>()
    availability.mockReturnValueOnce(initialSuffix.promise).mockReturnValue(foregroundSuffix.promise)
    const { result } = renderHook(() => usePushProvisioning(card))
    await waitFor(() => expect(addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function)))
    exactStatus.mockReturnValue(foregroundExact.promise)
    await foreground()

    await act(async () => {
        foregroundExact.resolve('absent')
        foregroundSuffix.resolve(suffixAbsent)
    })
    expect(result.current.isChecking).toBe(false)
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)

    await act(async () => initialSuffix.resolve(suffixPresent))
    expect(result.current.isChecking).toBe(false)
    expect(result.current.alreadyInWallet).toBe(false)
    expect(result.current.nativeAvailable).toBe(true)
})
