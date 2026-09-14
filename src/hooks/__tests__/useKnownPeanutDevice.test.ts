/**
 * useKnownPeanutDevice — "this device already belongs to a Peanut user"
 *
 * Two independent sources: the web passkey markers (cookie or a `webAuthnKey`
 * inside any `<userId>:user-preferences` entry) and a stored native session.
 * Either one is enough; the answer is null until both have been consulted.
 */
import { renderHook, waitFor } from '@testing-library/react'

let mockHasNativeSession = false
jest.mock('@/utils/auth-token', () => ({
    hasNativeSession: () => Promise.resolve(mockHasNativeSession),
}))

import { useKnownPeanutDevice } from '../useKnownPeanutDevice'

function clearCookies() {
    document.cookie.split(';').forEach((entry) => {
        const name = entry.trim().split('=')[0]
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    })
}

beforeEach(() => {
    mockHasNativeSession = false
    localStorage.clear()
    clearCookies()
})

test('starts null, then resolves — the reads cannot run during SSR or hydration', async () => {
    const { result } = renderHook(() => useKnownPeanutDevice())

    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(false))
})

test('the passkey cookie marks the device known', async () => {
    document.cookie = 'web-authn-key=some-key'

    const { result } = renderHook(() => useKnownPeanutDevice())

    await waitFor(() => expect(result.current).toBe(true))
})

test('a webAuthnKey in stored user preferences marks the device known', async () => {
    localStorage.setItem('user-1:user-preferences', JSON.stringify({ webAuthnKey: { authenticatorId: 'a' } }))

    const { result } = renderHook(() => useKnownPeanutDevice())

    await waitFor(() => expect(result.current).toBe(true))
})

test('user preferences without a webAuthnKey are not evidence of registration', async () => {
    // logout strips the key but leaves the entry behind
    localStorage.setItem('user-1:user-preferences', JSON.stringify({ balanceHidden: true }))

    const { result } = renderHook(() => useKnownPeanutDevice())

    await waitFor(() => expect(result.current).toBe(false))
})

test('a stored native session marks the device known without any web marker', async () => {
    // the WebView case: the passkey cookie is cross-origin-empty there
    mockHasNativeSession = true

    const { result } = renderHook(() => useKnownPeanutDevice())

    await waitFor(() => expect(result.current).toBe(true))
})
