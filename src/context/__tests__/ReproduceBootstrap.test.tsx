import { render, waitFor } from '@testing-library/react'
import { ReproduceBootstrap } from '../ReproduceBootstrap'

/*
 * A reproduce link opens in a browser that already ran a previous QA build.
 * The old service worker keeps serving its own app shell and its cached
 * /users/me, so the page loads the old bundle holding a token the API now
 * answers 401 to — and the app spins instead of recovering. The bootstrap has
 * to clear the previous BUILD, not only the previous user.
 */

const reload = jest.fn()

/**
 * The bootstrap reads the URL off `window.location`, not through a router
 * hook — that was the whole point of the fix — so the URL is seeded there, the
 * way a real reproduce link arrives.
 *
 * The whole `location` is replaced rather than patched: jsdom marks
 * `location.reload` unforgeable, so defining it on the real Location throws
 * `Cannot redefine property`. The property on `window` has no such rule.
 */
function openUrl(url: string) {
    const parsed = new URL(url, 'http://app.test')
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
            href: parsed.href,
            origin: parsed.origin,
            pathname: parsed.pathname,
            search: parsed.search,
            reload,
        },
    })
}

const unregister = jest.fn().mockResolvedValue(true)
const cacheDelete = jest.fn().mockResolvedValue(true)
const cacheKeys = jest.fn().mockResolvedValue(['peanut-app-shell-v7', 'user-data', 'workbox-precache'])

const MANIFEST = { localStorage: { 'harness-pk': '0xabc' }, token: 'fresh-jwt' }

beforeEach(() => {
    jest.clearAllMocks()
    openUrl('/home?__reproduce=session-1')
    process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK = 'true'
    process.env.NEXT_PUBLIC_PEANUT_API_URL = 'http://api.test'

    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('stale-user-key', 'previous user')
    sessionStorage.setItem('stale-session-key', 'previous build')

    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { keys: cacheKeys, delete: cacheDelete },
    })
    Object.defineProperty(window.navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistrations: jest.fn().mockResolvedValue([{ unregister }, { unregister }]) },
    })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => MANIFEST }) as unknown as typeof fetch
})

it('clears the previous build before applying the session', async () => {
    render(<ReproduceBootstrap />)

    await waitFor(() => expect(unregister).toHaveBeenCalledTimes(2))
    // every cache, not only the user-data ones: the app shell is the half that
    // pins the old build
    expect(cacheDelete.mock.calls.map((c) => c[0])).toEqual(['peanut-app-shell-v7', 'user-data', 'workbox-precache'])
    await waitFor(() => expect(localStorage.getItem('harness-pk')).toBe('0xabc'))
    expect(localStorage.getItem('stale-user-key')).toBeNull()
    expect(sessionStorage.getItem('stale-session-key')).toBeNull()
    // the session is applied AFTER the wipe, so its own marker survives it
    expect(sessionStorage.getItem('__reproduce_applied')).toBe('session-1')
    expect(document.cookie).toContain('jwt-token=fresh-jwt')
})

it('does nothing outside the harness build', async () => {
    process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK = 'false'
    render(<ReproduceBootstrap />)

    await Promise.resolve()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(unregister).not.toHaveBeenCalled()
    expect(cacheDelete).not.toHaveBeenCalled()
    expect(localStorage.getItem('stale-user-key')).toBe('previous user')
})

it('does nothing without the reproduce param', async () => {
    openUrl('/home')
    render(<ReproduceBootstrap />)

    await Promise.resolve()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(cacheDelete).not.toHaveBeenCalled()
})
