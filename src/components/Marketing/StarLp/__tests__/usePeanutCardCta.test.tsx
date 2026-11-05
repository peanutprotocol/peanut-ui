import { act, renderHook } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { usePeanutCardCta } from '../pages/usePeanutCardCta'

const mockIntercept = jest.fn(() => false)
const mockPush = jest.fn()
// null = no AuthProvider mounted (the optional hook returns null there).
let mockAuth: { user: unknown; isFetchingUser: boolean } | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => {
        throw new Error('useAuth must be used within an AuthProvider')
    },
    useOptionalAuth: () => mockAuth,
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({ interceptGuestCta: mockIntercept, storeHandoffModal: null }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

beforeEach(() => {
    mockAuth = null
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

describe('usePeanutCardCta on the app tree (/peanut-card, AuthProvider mounted)', () => {
    it('sends a signed-in visitor straight to /card without the store hand-off', () => {
        mockAuth = { user: { user: { userId: 'u1' } }, isFetchingUser: false }
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        expect(result.current.href).toBe(STAR_LP_HREF.cardSignedIn)
        const preventDefault = jest.fn()
        act(() => result.current.onClick({ preventDefault } as unknown as MouseEvent<HTMLAnchorElement>))
        expect(mockIntercept).not.toHaveBeenCalled()
        expect(preventDefault).not.toHaveBeenCalled()
    })

    it('queues a click while auth is loading and routes it once auth settles', () => {
        mockAuth = { user: null, isFetchingUser: true }
        const { result, rerender } = renderHook(() => usePeanutCardCta('hero'))
        const preventDefault = jest.fn()
        act(() => result.current.onClick({ preventDefault } as unknown as MouseEvent<HTMLAnchorElement>))
        expect(preventDefault).toHaveBeenCalled()
        expect(result.current.queued).toBe(true)
        mockAuth = { user: { user: { userId: 'u1' } }, isFetchingUser: false }
        rerender()
        expect(mockPush).toHaveBeenCalledWith(STAR_LP_HREF.cardSignedIn)
        expect(mockIntercept).not.toHaveBeenCalled()
    })
})
