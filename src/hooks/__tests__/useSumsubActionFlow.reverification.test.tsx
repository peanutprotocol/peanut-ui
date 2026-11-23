import { act, renderHook } from '@testing-library/react'
import type { FeatureReverificationConflict } from '@/app/actions/types/kyc-reverification.types'
import { useSumsubActionFlow } from '../useSumsubActionFlow'

const mockPush = jest.fn()
let mockUserId = 'owner'
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: mockUserId }) }))

const reverification: FeatureReverificationConflict = {
    code: 'feature_reverification_required',
    userMessage: 'Verify to increase your limits.',
    message: 'Re-verification required',
    error: 'Re-verification required',
    entry: { kind: 'reverify_for_feature', feature: 'local', targetProvider: 'MANTECA', attemptId: 'existing' },
}

beforeEach(() => {
    mockPush.mockClear()
    mockUserId = 'owner'
    window.history.replaceState(null, '', '/limits?currency=BRL')
})

it('opens the invitation without opening the legacy SDK', async () => {
    const fetchToken = jest.fn().mockResolvedValue({ reverification })
    const { result } = renderHook(() => useSumsubActionFlow({ fetchToken }))

    await act(() => result.current.handleInitiate())

    const destination = new URL(mockPush.mock.calls[0][0], window.location.origin)
    expect(destination.pathname).toBe('/verify')
    expect(Object.fromEntries(destination.searchParams)).toEqual({
        mode: 'reverify',
        feature: 'local',
        targetProvider: 'MANTECA',
        returnTo: '/limits?currency=BRL',
    })
    expect(result.current.showWrapper).toBe(false)
    expect(fetchToken).toHaveBeenCalledTimes(1)
})

it('ignores an invitation returned after the active account changes', async () => {
    let resolveResponse!: (response: { reverification: FeatureReverificationConflict }) => void
    const fetchToken = () =>
        new Promise<{ reverification: FeatureReverificationConflict }>((resolve) => {
            resolveResponse = resolve
        })
    const { result, rerender } = renderHook(() => useSumsubActionFlow({ fetchToken }))
    let pending!: Promise<void>

    act(() => {
        pending = result.current.handleInitiate()
    })
    mockUserId = 'another-owner'
    rerender()
    await act(async () => {
        resolveResponse({ reverification })
        await pending
    })

    expect(mockPush).not.toHaveBeenCalled()
    expect(result.current.showWrapper).toBe(false)
})
