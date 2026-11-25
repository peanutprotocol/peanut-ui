/**
 * TASK-25059: ARS Add money asked "Set up local transfers", then said "we're setting up your ARS account"
 * with a button that left the flow, seconds before Manteca opened the account. The peso account now starts
 * on arrival, the user waits on a progress screen read every 5 s, and the amount screen opens once it is on.
 */
import { act, renderHook } from '@testing-library/react'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { useAuth } from '@/context/authContext'
import type { FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import {
    KYC_ACTIVATION_POLL_MS,
    KYC_ACTIVATION_SETTLE_MS,
    KYC_ACTIVATION_SETTLE_POLL_MS,
    useKycFeatureActivation,
} from '../useKycFeatureActivation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('../paperworkVerificationEntry', () => ({
    paperworkVerificationFeaturePath: (feature: string) => '/verify?feature=' + feature,
}))

type Reply = Awaited<ReturnType<typeof activateKycFeature>>
const READY: FeatureReportEntry = { state: 'ready', action: 'activate' }
const features = (ars: FeatureReportEntry): FeatureReport => ({
    qr: READY,
    card: READY,
    bank: { ...READY, accounts: { EUR: READY, USD: READY } },
    local: { ...READY, accounts: { BRL: READY, ARS: ars } },
})
const fetchUser = jest.fn()
const auth = (ars: FeatureReportEntry) => {
    jest.mocked(useAuth).mockReturnValue({
        user: {
            user: { userId: 'a' },
            identityVerification: { oneShot: true, status: 'verified' },
            capabilities: { rails: [], nextActions: [], restrictions: [], features: features(ars) },
        },
        isFetchingUser: false,
        fetchUser,
    } as unknown as ReturnType<typeof useAuth>)
}
const advance = async (ms: number) => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })
}
const ars = (startOnArrival: boolean) => () =>
    useKycFeatureActivation('local', {
        scope: { channel: 'bank', country: 'AR' },
        selectedCurrency: 'ARS',
        startOnArrival,
    })

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(activateKycFeature).mockReset()
    fetchUser.mockResolvedValue(undefined)
    auth(READY)
})
afterEach(() => jest.useRealTimers())

it('starts the peso account on arrival, with no tap, and shows progress while the request runs', async () => {
    let answer!: (reply: Reply) => void
    jest.mocked(activateKycFeature).mockReturnValue(new Promise<Reply>((resolve) => (answer = resolve)))
    const { result } = renderHook(ars(true))
    await advance(0)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(activateKycFeature).toHaveBeenCalledWith('local')
    expect(result.current.settling).toBe(true)
    await act(async () => answer({ kind: 'report', report: { state: 'pending' } } as Reply))
    expect(result.current.settling).toBe(true)
    expect(result.current.allowed).toBe(false)
})

it('reads the user every 5 seconds while settling and opens the flow once the account is on', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'pending' } } as Reply)
    const { result, rerender } = renderHook(ars(true))
    await advance(0)
    expect(fetchUser).not.toHaveBeenCalled()
    await advance(KYC_ACTIVATION_SETTLE_POLL_MS)
    expect(fetchUser).toHaveBeenCalledTimes(1)
    // the profile read sees the account still being set up: the screen keeps waiting
    auth({ state: 'pending' })
    rerender()
    expect(result.current.settling).toBe(true)
    expect(result.current.allowed).toBe(false)
    await advance(KYC_ACTIVATION_SETTLE_POLL_MS)
    expect(fetchUser).toHaveBeenCalledTimes(2)
    auth({ state: 'on' })
    rerender()
    expect(result.current.allowed).toBe(true)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it('after the settle window the screen stops waiting and the read slows to 15 seconds', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'pending' } } as Reply)
    const { result } = renderHook(ars(true))
    await advance(0)
    await advance(KYC_ACTIVATION_SETTLE_MS)
    expect(result.current.settling).toBe(false)
    expect(result.current.allowed).toBe(false)
    fetchUser.mockClear()
    await advance(KYC_ACTIVATION_POLL_MS - 1)
    expect(fetchUser).not.toHaveBeenCalled()
    await advance(1)
    expect(fetchUser).toHaveBeenCalledTimes(1)
})

it('an account that opens at once lets the flow through without a wait', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'on' } } as Reply)
    const { result } = renderHook(ars(true))
    await advance(0)
    expect(result.current.allowed).toBe(true)
    expect(result.current.settling).toBe(false)
})

it('a failed start stays on its retry screen instead of starting again', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'failed' } as Reply)
    const { result } = renderHook(ars(true))
    await advance(0)
    await advance(60_000)
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(result.current.result).toEqual({ kind: 'failed' })
    expect(result.current.settling).toBe(false)
})

it.each([
    ['identity_not_approved', '/verify'],
    ['questions_missing', '/verify?feature=local'],
] as const)(
    'a start on arrival answered %s does not redirect, so Back cannot loop; the tap still redirects',
    async (code, path) => {
        jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code } as Reply)
        const first = renderHook(ars(true))
        await advance(0)
        expect(mockPush).not.toHaveBeenCalled()
        expect(first.result.current.result).toEqual({ kind: 'conflict', code })
        expect(first.result.current.settling).toBe(false)
        // Back from the page lands here again: a fresh mount starts again and still does not redirect
        first.unmount()
        const second = renderHook(ars(true))
        await advance(0)
        expect(activateKycFeature).toHaveBeenCalledTimes(2)
        expect(mockPush).not.toHaveBeenCalled()
        // the screen's tap is a consent: it redirects as before
        await act(async () => {
            await second.result.current.activate()
        })
        expect(mockPush).toHaveBeenCalledWith(path)
    }
)

it('the first frame of a start on arrival already shows progress', () => {
    jest.mocked(activateKycFeature).mockReturnValue(new Promise<Reply>(() => {}))
    const { result } = renderHook(ars(true))
    expect(result.current.settling).toBe(true)
})

it('an account already being set up waits on progress again, read every 5 s, with no second request', async () => {
    auth({ state: 'pending' })
    const { result, rerender } = renderHook(ars(true))
    expect(result.current.settling).toBe(true)
    await advance(KYC_ACTIVATION_SETTLE_POLL_MS)
    expect(fetchUser).toHaveBeenCalledTimes(1)
    expect(activateKycFeature).not.toHaveBeenCalled()
    auth({ state: 'on' })
    rerender()
    expect(result.current.allowed).toBe(true)
})

it('an account still being set up after the wait shows the exit, and the wait does not start again', async () => {
    auth({ state: 'pending' })
    const { result } = renderHook(ars(true))
    await advance(KYC_ACTIVATION_SETTLE_MS)
    expect(result.current.settling).toBe(false)
    await advance(KYC_ACTIVATION_SETTLE_MS)
    expect(result.current.settling).toBe(false)
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it('without startOnArrival the account still waits for the tap', async () => {
    const { result } = renderHook(ars(false))
    await advance(60_000)
    expect(activateKycFeature).not.toHaveBeenCalled()
    expect(result.current.settling).toBe(false)
})
