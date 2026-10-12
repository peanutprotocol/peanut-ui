import React, { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useHomeWelcome } from '../useHomeWelcome'

const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_RENDER = new Date('2026-10-05T20:00:00Z').getTime()
const initialProps = { userId: 'u1' as string | undefined, loading: false, progressed: false }
const mount = (props = initialProps) =>
    renderHook(({ userId, loading, progressed }) => useHomeWelcome(userId, loading, progressed), {
        initialProps: props,
    })

beforeEach(() => {
    localStorage.clear()
    jest.useFakeTimers().setSystemTime(FIRST_RENDER)
})
afterEach(() => jest.useRealTimers())

it('starts on the first usable Home render, once across rerenders', () => {
    const { result, rerender } = renderHook(({ loading }) => useHomeWelcome('u1', loading, false), {
        initialProps: { loading: true },
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    })
    expect(result.current).toBe(false)
    expect(getUserPreferences('u1')?.homeWelcome).toBeUndefined()

    act(() => jest.advanceTimersByTime(1000))
    rerender({ loading: false })
    rerender({ loading: false })
    expect(result.current).toBe(true)
    expect(getUserPreferences('u1')?.homeWelcome).toEqual({
        firstSeenAt: FIRST_RENDER + 1000,
        visits: 1,
        hidden: false,
    })
})

it('does not count React Strict Mode effect replay as another visit', () => {
    const { result } = renderHook(() => useHomeWelcome('u1', false, false), {
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    })
    expect(result.current).toBe(true)
    expect(getUserPreferences('u1')?.homeWelcome?.visits).toBe(1)
})

it('counts Home entries and hides on the fifth visit', () => {
    for (let visit = 1; visit <= 5; visit++) {
        const home = mount()
        expect(home.result.current).toBe(visit < 5)
        home.unmount()
    }
    expect(getUserPreferences('u1')?.homeWelcome?.visits).toBe(5)
    expect(mount().result.current).toBe(false)
})

it('expires at 24 hours even if Home stays open', () => {
    const { result } = mount()
    act(() => jest.advanceTimersByTime(DAY_MS - 1))
    expect(result.current).toBe(true)
    act(() => jest.advanceTimersByTime(1))
    expect(result.current).toBe(false)
    expect(getUserPreferences('u1')?.homeWelcome?.hidden).toBe(true)
})

it('keeps the first-render timestamp across Home visits', () => {
    const first = mount()
    first.unmount()
    act(() => jest.advanceTimersByTime(DAY_MS))
    expect(mount().result.current).toBe(false)
    expect(getUserPreferences('u1')?.homeWelcome?.firstSeenAt).toBe(FIRST_RENDER)
})

it('hides as soon as another item completes, and never returns if that item becomes incomplete', () => {
    const { result, rerender, unmount } = mount()
    expect(result.current).toBe(true)
    rerender({ ...initialProps, progressed: true })
    expect(result.current).toBe(false)
    rerender(initialProps)
    expect(result.current).toBe(false)
    unmount()
    expect(mount().result.current).toBe(false)
})

it('does not greet a user who already completed another item on their first visit', () => {
    expect(mount({ ...initialProps, progressed: true }).result.current).toBe(false)
})

it('keeps the visit budget separate for each user on the device', () => {
    updateUserPreferences('u1', { homeWelcome: { firstSeenAt: FIRST_RENDER, visits: 4, hidden: false } })
    const { result, rerender } = mount()
    expect(result.current).toBe(false)
    rerender({ ...initialProps, userId: 'u2' })
    expect(result.current).toBe(true)
    expect(getUserPreferences('u2')?.homeWelcome?.visits).toBe(1)
})

it('waits for an authenticated user before recording a visit', () => {
    const { result, rerender } = mount({ ...initialProps, userId: undefined })
    expect(result.current).toBe(false)
    rerender(initialProps)
    expect(result.current).toBe(true)
    expect(getUserPreferences('u1')?.homeWelcome?.visits).toBe(1)
})
