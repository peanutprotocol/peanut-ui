/** Spec-only acceptance: provider activation must precede feature access. */
import { act, renderHook, waitFor } from '@testing-library/react'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { useAuth } from '@/context/authContext'
import { useKycFeatureActivation } from '../useKycFeatureActivation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('../paperworkVerificationEntry', () => ({
    paperworkVerificationFeaturePath: (feature: string) => '/verify?feature=' + feature,
}))

type Reply = Awaited<ReturnType<typeof activateKycFeature>>
const report = (state: string, action?: string) =>
    ({ kind: 'report', report: { state, ...(action ? { action } : {}) } }) as Reply
const deferred = () => {
    let resolve!: (value: Reply) => void
    const promise = new Promise<Reply>((done) => {
        resolve = done
    })
    return { promise, resolve }
}
const auth = (id: string | null = 'a', oneShot?: boolean, isFetchingUser = false) => {
    jest.mocked(useAuth).mockReturnValue({
        user: id ? { user: { userId: id }, identityVerification: { oneShot } } : null,
        isFetchingUser,
    } as ReturnType<typeof useAuth>)
}
const flush = async () => {
    await act(async () => {
        await Promise.resolve()
    })
}
const advance = async (ms: number) => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })
}

function renderActivation<T extends ReturnType<typeof useKycFeatureActivation>>(callback: () => T) {
    const view = renderHook(callback)
    act(() => {
        void view.result.current.activate()
    })
    return view
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(activateKycFeature).mockReset()
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'failed' } as Reply)
    auth('a', true)
})
afterEach(() => jest.useRealTimers())

it.each([false, undefined])('legacy oneShot=%s allows access without activating', async (oneShot) => {
    auth('a', oneShot)
    const { result } = renderActivation(() => useKycFeatureActivation('bank'))
    expect(result.current.allowed).toBe(true)
    await flush()
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it('blocks unauthenticated users without activating', async () => {
    auth(null)
    const { result } = renderActivation(() => useKycFeatureActivation('bank'))
    expect(result.current.allowed).toBe(false)
    await flush()
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it.each(['on', 'ready'])('starts blocked and allows a confirmed %s report', async (state) => {
    const request = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(request.promise)
    const { result } = renderActivation(() => useKycFeatureActivation('bank'))
    expect(result.current.allowed).toBe(false)
    expect(result.current.isLoading).toBe(true)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    const response = report(state)
    await act(async () => {
        request.resolve(response)
    })
    await waitFor(() => expect(result.current.allowed).toBe(true))
    expect(result.current.result).toEqual(response)
    expect(result.current.isLoading).toBe(false)
})

it('card waits for its explicit action and deduplicates simultaneous callers', async () => {
    const request = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(request.promise)
    const { result } = renderHook(() => useKycFeatureActivation('card', { automatic: false }))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(activateKycFeature).not.toHaveBeenCalled()
    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
        first = result.current.activate()
        second = result.current.activate()
    })
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    await act(async () => {
        request.resolve(report('action_required'))
    })
    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(result.current.allowed).toBe(true)
})

it.each([
    ['bank', undefined],
    ['local', undefined],
    ['qr', undefined],
    ['bank', 'activate'],
    ['card', 'supplement:rain'],
    ['bank', 'supplement:bridge'],
    ['local', 'supplement:manteca'],
] as const)('%s remains blocked for action_required action=%s', async (feature, action) => {
    jest.mocked(activateKycFeature).mockResolvedValue(report('action_required', action))
    const { result } = renderActivation(() => useKycFeatureActivation(feature))
    await flush()
    expect(result.current.allowed).toBe(false)
})

it.each(['pending', 'setting_up'])('polls %s at 15 seconds and on focus without overlap', async (state) => {
    const next = deferred()
    jest.mocked(activateKycFeature).mockResolvedValueOnce(report(state)).mockReturnValueOnce(next.promise)
    const { result } = renderActivation(() => useKycFeatureActivation('local'))
    await flush()
    expect(result.current.allowed).toBe(false)
    await advance(14999)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(activateKycFeature).toHaveBeenCalledTimes(2)
    act(() => {
        window.dispatchEvent(new Event('focus'))
    })
    await advance(45000)
    expect(activateKycFeature).toHaveBeenCalledTimes(2)
    await act(async () => {
        next.resolve(report(state))
    })
    jest.mocked(activateKycFeature).mockResolvedValue(report('on'))
    act(() => {
        window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(3)
    expect(result.current.allowed).toBe(true)
    await advance(30000)
    expect(activateKycFeature).toHaveBeenCalledTimes(3)
})

it('failure stops polling and focus retries until an explicit retry', async () => {
    jest.mocked(activateKycFeature)
        .mockResolvedValueOnce(report('pending'))
        .mockResolvedValueOnce({ kind: 'failed' } as Reply)
    const { result } = renderActivation(() => useKycFeatureActivation('qr'))
    await flush()
    await advance(15000)
    expect(result.current.allowed).toBe(false)
    expect(result.current.result).toEqual({ kind: 'failed' })
    await advance(60000)
    act(() => {
        window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(2)
    jest.mocked(activateKycFeature).mockResolvedValue(report('ready'))
    await act(async () => {
        expect(await result.current.activate()).toBe(true)
    })
    expect(result.current.allowed).toBe(true)
})

it('questions_missing navigates to the matching verification feature', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'questions_missing' } as Reply)
    const { result } = renderActivation(() => useKycFeatureActivation('local'))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(mockPush).toHaveBeenCalledWith('/verify?feature=local')
})

it('identity conflicts remain blocked and navigate to verification', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'identity_not_approved' } as Reply)
    const { result } = renderActivation(() => useKycFeatureActivation('bank'))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(mockPush).toHaveBeenCalledWith('/verify')
})

it('identity change ignores a prior user response', async () => {
    const old = deferred()
    const current = deferred()
    jest.mocked(activateKycFeature).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const { result, rerender } = renderActivation(() => useKycFeatureActivation('bank'))
    auth('b', true)
    rerender()
    act(() => {
        void result.current.activate()
    })
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(2)
    await act(async () => {
        old.resolve(report('on'))
    })
    expect(result.current.allowed).toBe(false)
    await act(async () => {
        current.resolve(report('pending'))
    })
    expect(result.current.allowed).toBe(false)
    expect(result.current.result).toEqual(report('pending'))
})

it('a background auth refresh preserves confirmed access and avoids duplicate activation', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue(report('on'))
    const { result, rerender } = renderActivation(() => useKycFeatureActivation('bank'))
    await flush()
    auth('a', true, true)
    rerender()
    expect(result.current.allowed).toBe(true)
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
})

it('unmount ignores late conflict navigation and leaves no polling', async () => {
    const request = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(request.promise)
    const { unmount } = renderActivation(() => useKycFeatureActivation('bank'))
    unmount()
    await act(async () => {
        request.resolve({ kind: 'conflict', code: 'questions_missing' } as Reply)
    })
    await advance(60000)
    act(() => {
        window.dispatchEvent(new Event('focus'))
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
})
