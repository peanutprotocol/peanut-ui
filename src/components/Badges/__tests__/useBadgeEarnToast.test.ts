import { renderHook, act } from '@testing-library/react'
import { useUserStore } from '@/redux/hooks'
import { useBadgeEarnToast } from '@/components/Badges/useBadgeEarnToast'
import { celebrationStorageKey } from '@/components/Badges/badgeCelebration.utils'

jest.mock('@/redux/hooks', () => ({ useUserStore: jest.fn() }))
const mockUseUserStore = useUserStore as jest.Mock

type TestBadge = { code: string; name: string; description: string | null; earnedAt: string; isVisible?: boolean }
const freshIso = () => new Date().toISOString()

function setUser(userId: string | undefined, badges: TestBadge[]): void {
    mockUseUserStore.mockReturnValue({ user: userId ? { user: { userId, badges } } : null })
}

describe('useBadgeEarnToast', () => {
    beforeEach(() => {
        window.localStorage.clear()
        jest.clearAllMocks()
    })

    it('returns no pending badges when signed out', () => {
        setUser(undefined, [])
        const { result } = renderHook(() => useBadgeEarnToast())
        expect(result.current.pending).toEqual([])
    })

    it('reads seen synchronously when the user resolves after mount (no cold-start re-fire)', () => {
        window.localStorage.setItem(celebrationStorageKey('user-a'), JSON.stringify(['SHHHHH']))
        setUser(undefined, [])
        const { result, rerender } = renderHook(() => useBadgeEarnToast())
        expect(result.current.pending).toEqual([])
        // user loads async: on the first render with a userId, seen must already
        // reflect localStorage — not lag a render behind (which re-fired the toast).
        setUser('user-a', [{ code: 'SHHHHH', name: 'Shhh', description: null, earnedAt: freshIso() }])
        rerender()
        expect(result.current.pending).toEqual([])
    })

    it('surfaces all freshly-earned badges, newest first', () => {
        setUser('user-a', [
            {
                code: 'EVENT_ALUMNI',
                name: 'Alumni',
                description: null,
                earnedAt: new Date(Date.now() - 1000).toISOString(),
            },
            { code: 'SHHHHH', name: 'Shhh', description: null, earnedAt: freshIso() },
        ])
        const { result } = renderHook(() => useBadgeEarnToast())
        expect(result.current.pending.map((b) => b.code)).toEqual(['SHHHHH', 'EVENT_ALUMNI'])
    })

    it('excludes universal/bespoke badges (BETA_TESTER, WAITLIST_SKIP)', () => {
        setUser('user-a', [
            { code: 'BETA_TESTER', name: 'Beta', description: null, earnedAt: freshIso() },
            { code: 'WAITLIST_SKIP', name: 'Skip', description: null, earnedAt: freshIso() },
            { code: 'SHHHHH', name: 'Shhh', description: null, earnedAt: freshIso() },
        ])
        const { result } = renderHook(() => useBadgeEarnToast())
        expect(result.current.pending.map((b) => b.code)).toEqual(['SHHHHH'])
    })

    it('markSeen persists the codes and clears them from pending', () => {
        setUser('user-a', [
            { code: 'SHHHHH', name: 'Shhh', description: null, earnedAt: freshIso() },
            { code: 'EVENT_ALUMNI', name: 'Alumni', description: null, earnedAt: freshIso() },
        ])
        const { result } = renderHook(() => useBadgeEarnToast())
        act(() => result.current.markSeen(['SHHHHH', 'EVENT_ALUMNI']))
        expect(result.current.pending).toEqual([])
        expect(window.localStorage.getItem(celebrationStorageKey('user-a'))).toContain('SHHHHH')
    })

    it('does not resurface badges already in the seen-set', () => {
        window.localStorage.setItem(celebrationStorageKey('user-a'), JSON.stringify(['SHHHHH']))
        setUser('user-a', [{ code: 'SHHHHH', name: 'Shhh', description: null, earnedAt: freshIso() }])
        const { result } = renderHook(() => useBadgeEarnToast())
        expect(result.current.pending).toEqual([])
    })
})
