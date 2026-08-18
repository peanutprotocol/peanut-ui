/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { useBalanceVisibility } from '../useBalanceVisibility'
import { getUserPreferences } from '@/utils/general.utils'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const USER_ID = 'ds07-test-user'

describe('useBalanceVisibility', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('defaults to visible and toggles + persists the preference', () => {
        const { result } = renderHook(() => useBalanceVisibility(USER_ID))
        expect(result.current.isBalanceHidden).toBe(false)

        act(() => result.current.toggleBalanceVisibility())
        expect(result.current.isBalanceHidden).toBe(true)
        expect(getUserPreferences(USER_ID)?.balanceHidden).toBe(true)

        act(() => result.current.toggleBalanceVisibility())
        expect(result.current.isBalanceHidden).toBe(false)
        expect(getUserPreferences(USER_ID)?.balanceHidden).toBe(false)
    })

    it('keeps every subscriber in sync (balance display + activity amounts)', () => {
        const a = renderHook(() => useBalanceVisibility(USER_ID))
        const b = renderHook(() => useBalanceVisibility(USER_ID))

        act(() => a.result.current.toggleBalanceVisibility())
        expect(a.result.current.isBalanceHidden).toBe(true)
        expect(b.result.current.isBalanceHidden).toBe(true)
    })

    it('is a no-op without a userId', () => {
        const { result } = renderHook(() => useBalanceVisibility(undefined))
        expect(result.current.isBalanceHidden).toBe(false)
        act(() => result.current.toggleBalanceVisibility())
        expect(result.current.isBalanceHidden).toBe(false)
    })
})
