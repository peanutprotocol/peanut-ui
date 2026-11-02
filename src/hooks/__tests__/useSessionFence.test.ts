jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

import { act, renderHook } from '@testing-library/react'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/utils/auth-token'
import { disableDemoMode, enableDemoMode } from '@/utils/demo'
import { useSessionFence } from '../useSessionFence'

const jwt = (userId: string, extra: object = {}) => `x.${btoa(JSON.stringify({ userId, ...extra }))}.y`

beforeEach(async () => {
    disableDemoMode()
    await clearAuthToken()
})
afterEach(async () => {
    disableDemoMode()
    await clearAuthToken()
})

it('explicit demo mode has a synthetic owner without requiring a JWT', () => {
    expect(getAuthToken()).toBeFalsy()
    enableDemoMode()
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    expect(pending.userId).toBe('demo-user')
    expect(pending.current()).toBe(true)
    disableDemoMode()
    expect(pending.current()).toBe(false)
})

it('leaving a demo for an authenticated account invalidates the demo continuation', () => {
    enableDemoMode()
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    disableDemoMode()
    setAuthToken(jwt('user-a'))
    expect(pending.current()).toBe(false)
    const signedIn = result.current()
    expect(signedIn.userId).toBe('user-a')
    expect(signedIn.current()).toBe(true)
})

it('a normal session without a token cannot authorize a continuation', () => {
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    expect(pending.userId).toBeNull()
    expect(pending.current()).toBe(false)
})

it.each(['not-a-jwt', 'x.not-base64.y', `x.${btoa(JSON.stringify({ unrelated: 'value' }))}.y`])(
    'a malformed or unowned token cannot authorize a continuation: %s',
    (token) => {
        setAuthToken(token)
        const { result } = renderHook(() => useSessionFence())
        const pending = result.current()
        expect(pending.userId).toBeNull()
        expect(pending.current()).toBe(false)
    }
)

it('a same-user token rotation keeps the captured identity current', () => {
    setAuthToken(jwt('user-a'))
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    expect(pending.userId).toBe('user-a')
    setAuthToken(jwt('user-a', { refreshed: true }))
    expect(pending.current()).toBe(true)
})

it('changing from A to B invalidates A’s captured continuation', () => {
    setAuthToken(jwt('user-a'))
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    setAuthToken(jwt('user-b'))
    expect(pending.current()).toBe(false)
    expect(result.current().userId).toBe('user-b')
})

it('clearing the authenticated session invalidates a captured continuation', async () => {
    setAuthToken(jwt('user-a'))
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    await act(async () => {
        await clearAuthToken()
    })
    expect(pending.current()).toBe(false)
})

it.each(['authenticated', 'demo'] as const)('unmount invalidates a captured %s continuation', (mode) => {
    if (mode === 'authenticated') setAuthToken(jwt('user-a'))
    else enableDemoMode()
    const { result, unmount } = renderHook(() => useSessionFence())
    const pending = result.current()
    expect(pending.current()).toBe(true)
    unmount()
    expect(pending.current()).toBe(false)
})
