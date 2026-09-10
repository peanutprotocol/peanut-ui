/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useRewardsFlow } from '../useRewardsFlow'

const mockFetchUser = jest.fn()
const mockCapture = jest.fn()

let mockUser: any = { user: { userId: 'u1', username: 'kush' } }
let mockQueries: Record<string, any> = {}

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) =>
        mockQueries[queryKey[0]] ?? { data: undefined, isPending: false, isError: false, error: null },
}))
jest.mock('@/services/invites', () => ({ invitesApi: { getInvites: jest.fn() } }))
jest.mock('@/services/points', () => ({
    pointsApi: { getTierInfo: jest.fn(), getUserInvitesGraph: jest.fn(), getCashStatus: jest.fn() },
}))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@/hooks/useCountUp', () => ({
    useCountUp: (target: number) => target,
}))
jest.mock('framer-motion', () => ({
    useInView: () => true,
}))

describe('useRewardsFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUser = { user: { userId: 'u1', username: 'kush' } }
        mockQueries = {}
    })

    it('captures the page view and re-fetches the user on mount', () => {
        renderHook(() => useRewardsFlow())
        expect(mockCapture).toHaveBeenCalledWith('points_page_viewed')
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it('feeds the hero counter from tier info total points', () => {
        mockQueries.tierInfo = {
            data: { success: true, data: { totalPoints: 420 } },
            isPending: false,
            isError: false,
            error: null,
        }
        const { result } = renderHook(() => useRewardsFlow())
        expect(result.current.animatedTotal).toBe(420)
    })

    it('exposes query state and the username verbatim', () => {
        mockQueries.invites = { data: { invitees: [] }, isPending: false, isError: false, error: null }
        const { result } = renderHook(() => useRewardsFlow())
        expect(result.current.invites).toEqual({ invitees: [] })
        expect(result.current.username).toBe('kush')
        expect(result.current.inviteesInView).toBe(true)
    })

    it('toggles the invite modal', () => {
        const { result } = renderHook(() => useRewardsFlow())
        expect(result.current.isInviteModalOpen).toBe(false)
        act(() => result.current.setIsInviteModalOpen(true))
        expect(result.current.isInviteModalOpen).toBe(true)
    })
})
