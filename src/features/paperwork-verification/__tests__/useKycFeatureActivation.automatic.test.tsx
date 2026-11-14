/** The automatic activation (Avenia's Pix, TASK-24947): no tap, no redirect into the questions. */
import { act, renderHook } from '@testing-library/react'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { useAuth } from '@/context/authContext'
import { useKycFeatureActivation } from '../useKycFeatureActivation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))

type Reply = Awaited<ReturnType<typeof activateKycFeature>>
const SCOPE = { channel: 'bank', country: 'BR' } as const
const mockFetchUser = jest.fn(() => Promise.resolve(null))
const auth = (oneShot: boolean) =>
    jest.mocked(useAuth).mockReturnValue({
        user: { user: { userId: 'a' }, identityVerification: { oneShot, status: 'verified' } },
        fetchUser: mockFetchUser,
    } as unknown as ReturnType<typeof useAuth>)
const flush = async () => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(activateKycFeature).mockReset()
    auth(true)
})

it('activates once on mount, with no tap', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'setting_up' } } as Reply)
    const { result, rerender } = renderHook(() => useKycFeatureActivation('local', { scope: SCOPE, automatic: true }))
    await flush()
    rerender()
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
    expect(activateKycFeature).toHaveBeenCalledWith('local')
    expect(result.current.result).toEqual({ kind: 'report', report: { state: 'setting_up' } })
    expect(result.current.allowed).toBe(false)
})

// the caller asks the step in place: a redirect would send Back from the questions into them again
it('keeps a missing answer for the caller and never redirects to the questions', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({
        kind: 'conflict',
        code: 'questions_missing',
        step: 'address',
    } as Reply)
    const { result } = renderHook(() => useKycFeatureActivation('local', { scope: SCOPE, automatic: true }))
    await flush()
    expect(result.current.result).toEqual({ kind: 'conflict', code: 'questions_missing', step: 'address' })
    expect(mockPush).not.toHaveBeenCalled()
    // the answer saved: the caller runs it again
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'on' } } as Reply)
    await act(async () => {
        await result.current.activate()
    })
    expect(result.current.allowed).toBe(true)
    expect(mockFetchUser).toHaveBeenCalledWith({ throwOnError: true })
})

// review finding 3: Back from /verify returns to the Pix page, which would redirect again
it('keeps an identity not approved for the caller and never redirects to /verify', async () => {
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'identity_not_approved' } as Reply)
    const { result } = renderHook(() => useKycFeatureActivation('pix', { automatic: true }))
    await flush()
    expect(result.current.result).toEqual({ kind: 'conflict', code: 'identity_not_approved' })
    expect(mockPush).not.toHaveBeenCalled()
})

// the API opens the account for an identity of the older flow the same way (contract of 14 Nov)
it('activates an identity of the older flow too', async () => {
    auth(false)
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'setting_up' } } as Reply)
    const { result } = renderHook(() => useKycFeatureActivation('local', { scope: SCOPE, automatic: true }))
    expect(result.current.allowed).toBe(false)
    await flush()
    expect(activateKycFeature).toHaveBeenCalledTimes(1)
})

it('leaves a tap-only activation to the tap', async () => {
    renderHook(() => useKycFeatureActivation('local', { scope: SCOPE }))
    await flush()
    expect(activateKycFeature).not.toHaveBeenCalled()
})
