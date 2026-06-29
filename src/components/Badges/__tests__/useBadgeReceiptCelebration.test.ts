import { renderHook, act } from '@testing-library/react'
import { useUserStore } from '@/redux/hooks'
import { useBadgeReceiptCelebration } from '@/components/Badges/useBadgeReceiptCelebration'
import { celebrationStorageKey } from '@/components/Badges/badgeCelebration.utils'

jest.mock('@/redux/hooks', () => ({ useUserStore: jest.fn() }))
const mockUseUserStore = useUserStore as jest.Mock

type TestBadge = { code: string; name: string; description: string | null; earnedAt: string; isVisible?: boolean }
const freshIso = () => new Date().toISOString()

function setUser(userId: string | undefined, badges: TestBadge[]): void {
    mockUseUserStore.mockReturnValue({ user: userId ? { user: { userId, badges } } : null })
}

describe('useBadgeReceiptCelebration', () => {
    beforeEach(() => {
        window.localStorage.clear()
        jest.clearAllMocks()
    })

    it('returns null pending when signed out', () => {
        setUser(undefined, [])
        const { result } = renderHook(() => useBadgeReceiptCelebration())
        expect(result.current.pending).toBeNull()
    })

    it('surfaces a freshly-earned badge', () => {
        setUser('user-a', [{ code: 'OG_2025_10_12', name: 'OG', description: null, earnedAt: freshIso() }])
        const { result } = renderHook(() => useBadgeReceiptCelebration())
        expect(result.current.pending?.code).toBe('OG_2025_10_12')
    })

    it('dismiss marks the badge seen (persisted) and clears pending', () => {
        setUser('user-a', [{ code: 'OG_2025_10_12', name: 'OG', description: null, earnedAt: freshIso() }])
        const { result } = renderHook(() => useBadgeReceiptCelebration())
        act(() => result.current.dismiss())
        expect(result.current.pending).toBeNull()
        expect(window.localStorage.getItem(celebrationStorageKey('user-a'))).toContain('OG_2025_10_12')
    })

    it('does not resurface a badge already in the seen-set', () => {
        window.localStorage.setItem(celebrationStorageKey('user-a'), JSON.stringify(['OG_2025_10_12']))
        setUser('user-a', [{ code: 'OG_2025_10_12', name: 'OG', description: null, earnedAt: freshIso() }])
        const { result } = renderHook(() => useBadgeReceiptCelebration())
        expect(result.current.pending).toBeNull()
    })
})
