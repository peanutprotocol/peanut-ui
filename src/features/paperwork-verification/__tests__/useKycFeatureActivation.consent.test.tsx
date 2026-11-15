/** Fix E: frozen spec-only acceptance for explicit consent and request ownership. */
import { act, renderHook } from '@testing-library/react'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { useAuth } from '@/context/authContext'
import type { FeatureReport, FeatureReportEntry, IdentityVerificationStatus } from '@/types/capabilities'
import { useKycFeatureActivation } from '../useKycFeatureActivation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('../paperworkVerificationEntry', () => ({
    paperworkVerificationFeaturePath: (feature: string) => '/verify?feature=' + feature,
}))

type Reply = Awaited<ReturnType<typeof activateKycFeature>>
const ON: FeatureReportEntry = { state: 'on' }
const READY: FeatureReportEntry = { state: 'ready', action: 'activate' }
const features = (overrides: Partial<FeatureReport> = {}): FeatureReport => ({
    qr: READY,
    card: READY,
    bank: { ...READY, accounts: { EUR: READY, USD: READY } },
    local: { ...READY, accounts: { BRL: READY, ARS: READY } },
    ...overrides,
})
const reply = (entry: FeatureReportEntry): Reply => ({ kind: 'report', report: entry }) as Reply
const deferred = () => {
    let resolve!: (value: Reply) => void
    const promise = new Promise<Reply>((done) => {
        resolve = done
    })
    return { promise, resolve }
}
const auth = (id: string | null = 'a', report = features(), status: IdentityVerificationStatus = 'verified') => {
    jest.mocked(useAuth).mockReturnValue({
        user: id
            ? {
                  user: { userId: id },
                  identityVerification: { oneShot: true, status },
                  capabilities: { rails: [], nextActions: [], restrictions: [], features: report },
              }
            : null,
        isFetchingUser: false,
    } as ReturnType<typeof useAuth>)
}
const flush = async () => {
    await act(async () => {
        await Promise.resolve()
    })
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(activateKycFeature).mockReset()
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'failed' } as Reply)
    auth()
})
afterEach(() => jest.useRealTimers())

it.each(['bank', 'local', 'card', 'qr'] as const)(
    'mounting %s, focusing and waiting never activate an unopened feature',
    async (feature) => {
        const { result } = renderHook(() => useKycFeatureActivation(feature))
        await flush()
        act(() => window.dispatchEvent(new Event('focus')))
        await act(async () => jest.advanceTimersByTimeAsync(60000))
        expect(activateKycFeature).not.toHaveBeenCalled()
        expect(result.current.allowed).toBe(false)
        expect(result.current.isLoading).toBe(false)
        expect(mockPush).not.toHaveBeenCalled()
    }
)

it.each(['bank', 'local', 'card', 'qr'] as const)(
    'an existing on report for %s passes through without another activation',
    async (feature) => {
        const current = features()
        auth('a', features({ [feature]: { ...current[feature], state: 'on' } }))
        const { result } = renderHook(() => useKycFeatureActivation(feature))
        await flush()
        expect(result.current.allowed).toBe(true)
        await act(async () => {
            expect(await result.current.activate()).toBe(true)
        })
        expect(activateKycFeature).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    }
)

it('an explicit click opens a ready feature only after activation resolves', async () => {
    const pending = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(pending.promise)
    const { result } = renderHook(() => useKycFeatureActivation('bank'))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(activateKycFeature).not.toHaveBeenCalled()
    let activation!: Promise<boolean>
    act(() => {
        activation = result.current.activate()
    })
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(result.current.allowed).toBe(false)
    await act(async () => pending.resolve(reply(ON)))
    await expect(activation).resolves.toBe(true)
    expect(result.current.allowed).toBe(true)
})

it('simultaneous explicit clicks share one pending request', async () => {
    const pending = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(pending.promise)
    const { result } = renderHook(() => useKycFeatureActivation('bank'))
    await flush()
    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
        first = result.current.activate()
        second = result.current.activate()
    })
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(reply(ON)))
    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(result.current.allowed).toBe(true)
})

it('identity_not_approved directs the consenting user to verification', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'identity_not_approved' } as Reply)
    const { result } = renderHook(() => useKycFeatureActivation('bank'))
    await act(async () => {
        expect(await result.current.activate()).toBe(false)
    })
    expect(result.current.allowed).toBe(false)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/verify')
})

it.each(['processing', 'action_required', 'not_started'] as const)(
    'explicit consent from %s resumes once when identity becomes APPROVED',
    async (status) => {
        auth('a', features(), status)
        jest.mocked(activateKycFeature)
            .mockResolvedValueOnce({ kind: 'conflict', code: 'identity_not_approved' } as Reply)
            .mockResolvedValueOnce(reply(ON))
        const { result, rerender } = renderHook(() => useKycFeatureActivation('bank'))
        await act(async () => {
            await result.current.activate()
        })
        expect(result.current.allowed).toBe(false)
        expect(mockPush).toHaveBeenCalledWith('/verify')
        auth('a', features(), 'verified')
        rerender()
        await flush()
        expect(activateKycFeature).toHaveBeenCalledTimes(2)
        expect(result.current.allowed).toBe(true)
        rerender()
        act(() => window.dispatchEvent(new Event('focus')))
        await act(async () => jest.advanceTimersByTimeAsync(60000))
        expect(activateKycFeature).toHaveBeenCalledTimes(2)
        expect(mockPush).toHaveBeenCalledTimes(1)
    }
)

it('an identity approval without prior consent never activates', async () => {
    auth('a', features(), 'processing')
    const { result, rerender } = renderHook(() => useKycFeatureActivation('bank'))
    auth('a', features(), 'verified')
    rerender()
    await flush()
    expect(activateKycFeature).not.toHaveBeenCalled()
    expect(result.current.allowed).toBe(false)
})

it('an already-on requested EUR account bypasses activation despite an aggregate ready state', async () => {
    auth('a', features({ bank: { ...READY, accounts: { EUR: ON, USD: READY } } }))
    const { result } = renderHook(() => useKycFeatureActivation('bank', { scope: { channel: 'bank', country: 'EU' } }))
    await flush()
    expect(result.current.allowed).toBe(true)
    await act(async () => {
        expect(await result.current.activate()).toBe(true)
    })
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it('another on account never unlocks the requested ready account before consent', async () => {
    auth('a', features({ bank: { ...ON, accounts: { EUR: ON, USD: READY } } }))
    const { result } = renderHook(() => useKycFeatureActivation('bank', { scope: { channel: 'bank', country: 'US' } }))
    await flush()
    expect(result.current.allowed).toBe(false)
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it.each([
    ['success', reply(ON)],
    ['identity conflict', { kind: 'conflict', code: 'identity_not_approved' } as Reply],
    ['questions conflict', { kind: 'conflict', code: 'questions_missing' } as Reply],
] as const)('changing account scope ignores the previous account late %s', async (_name, response) => {
    const pending = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
        ({ country }) => useKycFeatureActivation('bank', { scope: { channel: 'bank', country } }),
        { initialProps: { country: 'EU' } }
    )
    let activation!: Promise<boolean>
    act(() => {
        activation = result.current.activate()
    })
    rerender({ country: 'US' })
    await act(async () => pending.resolve(response))
    await expect(activation).resolves.toBe(false)
    expect(result.current.allowed).toBe(false)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it.each([
    ['success', reply(ON)],
    ['identity conflict', { kind: 'conflict', code: 'identity_not_approved' } as Reply],
    ['questions conflict', { kind: 'conflict', code: 'questions_missing' } as Reply],
] as const)('another user never inherits a late %s', async (_name, response) => {
    const pending = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(() => useKycFeatureActivation('bank'))
    let activation!: Promise<boolean>
    act(() => {
        activation = result.current.activate()
    })
    auth('b')
    rerender()
    await act(async () => pending.resolve(response))
    await expect(activation).resolves.toBe(false)
    expect(result.current.allowed).toBe(false)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it.each([
    ['success', reply(ON)],
    ['identity conflict', { kind: 'conflict', code: 'identity_not_approved' } as Reply],
    ['questions conflict', { kind: 'conflict', code: 'questions_missing' } as Reply],
] as const)('a late %s cannot unlock or navigate after leaving', async (_name, response) => {
    const pending = deferred()
    jest.mocked(activateKycFeature).mockReturnValue(pending.promise)
    const { result, unmount } = renderHook(() => useKycFeatureActivation('bank'))
    let activation!: Promise<boolean>
    act(() => {
        activation = result.current.activate()
    })
    unmount()
    await act(async () => pending.resolve(response))
    await expect(activation).resolves.toBe(false)
    await act(async () => jest.advanceTimersByTimeAsync(60000))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(mockPush).not.toHaveBeenCalled()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
})
