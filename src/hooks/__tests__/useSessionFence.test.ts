const toastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: toastError }) }))
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

import { act } from '@testing-library/react'
import * as authToken from '@/utils/auth-token'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/utils/auth-token'
import { disableDemoMode, enableDemoMode } from '@/utils/demo'
import { useSessionFence } from '../useSessionFence'

const jwt = (userId: string, extra: object = {}) => `x.${btoa(JSON.stringify({ userId, ...extra }))}.y`

beforeEach(async () => {
    toastError.mockClear()
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

it('an unreadable identity can use the legacy cookie path after hydration', async () => {
    const { result } = renderHook(() => useSessionFence())
    const pending = result.current()
    expect(pending.userId).toBeNull()
    await pending.ready
    expect(pending.current()).toBe(true)
    expect(toastError).not.toHaveBeenCalled()
})

it('a failed session hydration aborts the continuation and shows the unavailable toast', async () => {
    const ready = jest.spyOn(authToken, 'authReady').mockRejectedValue(new Error('locked'))
    try {
        const { result } = renderHook(() => useSessionFence())
        const pending = result.current()
        await pending.ready
        expect(pending.current()).toBe(false)
        expect(toastError).toHaveBeenCalledTimes(1)
    } finally {
        ready.mockRestore()
    }
})

it.each(['not-a-jwt', 'x.not-base64.y', `x.${btoa(JSON.stringify({ unrelated: 'value' }))}.y`])(
    'an unreadable identity can use the API old-client path: %s',
    (token) => {
        setAuthToken(token)
        const { result } = renderHook(() => useSessionFence())
        const pending = result.current()
        expect(pending.userId).toBeNull()
        expect(pending.current()).toBe(true)
        expect(toastError).not.toHaveBeenCalled()
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
