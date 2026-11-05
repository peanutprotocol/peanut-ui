import { act, renderHook } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { usePeanutCardCta } from '../pages/usePeanutCardCta'

const mockIntercept = jest.fn(() => false)
const mockPush = jest.fn()
// The marketing tree mounts no AuthProvider, so the optional hook returns null there.
jest.mock('@/context/authContext', () => ({
    useAuth: () => {
        throw new Error('useAuth must be used within an AuthProvider')
    },
    useOptionalAuth: () => null,
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({ interceptGuestCta: mockIntercept, storeHandoffModal: null }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

beforeEach(() => {
    mockIntercept.mockClear()
    mockPush.mockClear()
})

describe('usePeanutCardCta without an AuthProvider', () => {
    it('gives every visitor the guest CTA and lets the link navigate', () => {
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        expect(result.current.href).toBe(STAR_LP_HREF.cardGuest)
        const preventDefault = jest.fn()
        act(() => result.current.onClick({ preventDefault } as unknown as MouseEvent<HTMLAnchorElement>))
        expect(mockIntercept).toHaveBeenCalledWith({ dest: '/card' })
        expect(preventDefault).not.toHaveBeenCalled()
        expect(result.current.queued).toBe(false)
    })

    it('hands the click to the store handoff when it takes it', () => {
        mockIntercept.mockReturnValueOnce(true)
        const { result } = renderHook(() => usePeanutCardCta('close'))
        const preventDefault = jest.fn()
        act(() => result.current.onClick({ preventDefault } as unknown as MouseEvent<HTMLAnchorElement>))
        expect(preventDefault).toHaveBeenCalled()
    })
})
