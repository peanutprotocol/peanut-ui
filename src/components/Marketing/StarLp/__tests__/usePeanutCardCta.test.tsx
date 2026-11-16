import { act, renderHook, waitFor } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { usePeanutCardCta } from '../pages/usePeanutCardCta'
import { getRedirectUrl } from '@/utils/general.utils'

const mockIntercept = jest.fn(() => false)
const mockPush = jest.fn()
// null = no AuthProvider mounted (the optional hook returns null there).
let mockAuth: { user: unknown; isFetchingUser: boolean; fetchUser?: jest.Mock } | null = null
const mockClaim = jest.fn()
const callOrder: string[] = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => {
        throw new Error('useAuth must be used within an AuthProvider')
    },
    useOptionalAuth: () => mockAuth,
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({
        interceptGuestCta: (handoff: { dest: string }) => {
            callOrder.push('intercept')
            return (mockIntercept as jest.Mock)(handoff)
        },
        storeHandoffModal: null,
    }),
}))
jest.mock('@/components/Invites/badge-campaign-context', () => {
    const actual = jest.requireActual('@/components/Invites/badge-campaign-context')
    return {
        ...actual,
        queuePendingBadgeCampaigns: (...args: [string[], number]) => {
            callOrder.push('queue')
            return actual.queuePendingBadgeCampaigns(...args)
        },
    }
})
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (...args: unknown[]) => mockClaim(...args),
    isConfirmedBadgeCampaignClaim: (claim: { outcome: string }) => claim.outcome === 'awarded',
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const click = (result: { current: ReturnType<typeof usePeanutCardCta> }) => {
    const preventDefault = jest.fn()
    act(() => result.current.onClick({ preventDefault } as unknown as MouseEvent<HTMLAnchorElement>))
    return preventDefault
}

beforeEach(() => {
    mockAuth = null
    mockIntercept.mockReset()
    mockIntercept.mockReturnValue(false)
    mockPush.mockClear()
    mockClaim.mockReset()
    callOrder.length = 0
    localStorage.clear()
    document.cookie.split(';').forEach((c) => {
        document.cookie = `${c.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    })
    window.history.replaceState(null, '', '/peanut-card')
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

// Campaign links used to land on /shhhhh, which now 308s here with its query.
describe('usePeanutCardCta with a badge campaign in the URL', () => {
    beforeEach(() => window.history.replaceState(null, '', '/peanut-card?campaign=event-alumni'))

    it('queues the campaign before the store hand-off, so it rides the deferred link', () => {
        mockIntercept.mockReturnValue(true)
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        expect(click(result)).toHaveBeenCalled()
        expect(callOrder).toEqual(['queue', 'intercept'])
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('sends a guest the hand-off did not take to campaign signup with a /card destination', () => {
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        expect(click(result)).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup&redirect_uri=%2Fcard')
        expect(getRedirectUrl()).toBe('/card')
        expect(mockClaim).not.toHaveBeenCalled()
    })

    it.each(['awarded', 'inactive', 'unknown', 'retryable'])(
        'claims for a signed-in visitor and opens /card whatever the outcome (%s)',
        async (outcome) => {
            const fetchUser = jest.fn()
            mockAuth = { user: { user: { userId: 'u1' } }, isFetchingUser: false, fetchUser }
            mockClaim.mockResolvedValue({ claims: [{ badgeCampaign: 'event-alumni', outcome }], pending: [] })
            const { result } = renderHook(() => usePeanutCardCta('close'))
            expect(click(result)).toHaveBeenCalled()
            expect(mockClaim).toHaveBeenCalledWith(expect.arrayContaining(['event-alumni']))
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
            expect(fetchUser).toHaveBeenCalledTimes(outcome === 'awarded' ? 1 : 0)
            expect(mockIntercept).not.toHaveBeenCalled()
        }
    )

    it('still opens /card when the claim fails', async () => {
        mockAuth = { user: { user: { userId: 'u1' } }, isFetchingUser: false, fetchUser: jest.fn() }
        mockClaim.mockRejectedValue(new Error('temporary transport failure'))
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        click(result)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
    })

    it('reads the canonical badge_campaign parameter too', () => {
        window.history.replaceState(null, '', '/peanut-card?badge_campaign=tron')
        mockIntercept.mockReturnValue(true)
        const { result } = renderHook(() => usePeanutCardCta('hero'))
        click(result)
        expect(callOrder).toEqual(['queue', 'intercept'])
    })
})
