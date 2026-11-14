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

it('shows existing ARS provisioning without starting paperwork when QR already works', async () => {
    const profile = (state: 'setting_up' | 'on') =>
        ({
            user: {
                user: { userId: 'a' },
                identityVerification: { oneShot: true, status: 'verified' },
                capabilities: {
                    features: { local: { state: 'ready', accounts: { ARS: { state } } }, qr: { state: 'on' } },
                },
            },
        }) as unknown as ReturnType<typeof useAuth>
    jest.mocked(useAuth).mockReturnValue(profile('setting_up'))
    const { result, rerender } = renderHook(() =>
        useKycFeatureActivation('local', { scope: { channel: 'bank', country: 'AR' } })
    )
    expect(result.current.allowed).toBe(false)
    expect(result.current.result).toEqual(report('setting_up'))
    await act(async () => {
        await expect(result.current.activate()).resolves.toBe(false)
    })
    expect(activateKycFeature).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    jest.mocked(useAuth).mockReturnValue(profile('on'))
    rerender()
    expect(result.current.allowed).toBe(true)
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

// TASK-24910: Bridge's Pix answers a step of its own with no action; the Pix route names it
it('local continues to its own screen for a step the activation names no action for', async () => {
    const fetchUser = jest.fn(() => Promise.resolve(null))
    jest.mocked(useAuth).mockReturnValue({
        user: { user: { userId: 'a' }, identityVerification: { oneShot: true } },
        fetchUser,
    } as unknown as ReturnType<typeof useAuth>)
    jest.mocked(activateKycFeature).mockResolvedValue(report('action_required'))
    const { result } = renderActivation(() => useKycFeatureActivation('local'))
    await flush()
    expect(result.current.allowed).toBe(true)
    // the refreshed capabilities carry the route's step
    expect(fetchUser).toHaveBeenCalledWith({ throwOnError: true })
})

// TASK-24910, API-CONTRACT.md 4a: the Pix setup asks the API for every user, and a legacy approval gets its step
it.each([false, undefined])('everyUser activates a legacy oneShot=%s approval too', async (oneShot) => {
    auth('a', oneShot)
    const corridorStep = { key: 'verify-corridor:pix_br', kind: 'sumsub', purpose: 'x', levelKey: 'bridge' }
    jest.mocked(activateKycFeature).mockResolvedValue({
        kind: 'report',
        report: { state: 'action_required', nextAction: corridorStep },
    } as Reply)
    const { result } = renderActivation(() => useKycFeatureActivation('local', { everyUser: true }))
    await flush()
    expect(activateKycFeature).toHaveBeenCalledWith('local')
    // the step the answer names is the caller's to start: nothing passes through
    expect(result.current.allowed).toBe(false)
})

it.each([
    ['bank', undefined],
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

it('a caller URL write runs before the questions redirect, never after it', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'questions_missing' } as Reply)
    const order: string[] = []
    mockPush.mockImplementation((path: string) => order.push(`push ${path}`))
    const { result } = renderHook(() => useKycFeatureActivation('card'))
    await act(async () => {
        await result.current.activate({
            beforeRedirect: async () => {
                order.push('caller clears its URL state')
            },
        })
    })
    expect(order).toEqual(['caller clears its URL state', 'push /verify?feature=card'])
    mockPush.mockReset()
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

it('a rejected identity is sent to its status screen once, with nothing left waiting to re-activate', async () => {
    const rejected = (status: string) =>
        jest.mocked(useAuth).mockReturnValue({
            user: {
                user: { userId: 'a' },
                identityVerification: { oneShot: true, status, canRetry: false, rejectLabels: ['DUPLICATE'] },
            },
            isFetchingUser: false,
        } as ReturnType<typeof useAuth>)
    rejected('failed')
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'identity_not_approved' } as Reply)
    const { result, rerender } = renderActivation(() => useKycFeatureActivation('card'))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/verify')
    rerender()
    rejected('verified')
    rerender()
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
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
