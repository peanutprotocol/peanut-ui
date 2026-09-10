/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { useBalanceVisibility } from '../useBalanceVisibility'
import { getUserPreferences } from '@/utils/general.utils'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

// unique id per test — the store keeps a module-level in-memory cache
let n = 0
let USER_ID = ''

describe('useBalanceVisibility', () => {
    beforeEach(() => {
        localStorage.clear()
        USER_ID = `ds07-test-user-${n++}`
    })

    it('keeps working in-session when localStorage writes fail', () => {
        const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota')
        })
        const { result } = renderHook(() => useBalanceVisibility(USER_ID))
        act(() => result.current.toggleBalanceVisibility())
        expect(result.current.isBalanceHidden).toBe(true)
        spy.mockRestore()
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
