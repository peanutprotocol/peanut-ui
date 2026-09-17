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

// `--runInBand` shares one process, and `HARNESS_ENABLED` is read when a file
// first imports the harness consts — so leaving the flag on here would turn it
// on for whatever suite loads next.
const harnessFlag = process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK
afterAll(() => {
    process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK = harnessFlag
})

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
    // written before the first await and put back by the wipe, so nothing can
    // find the document unmarked and start the same link a second time
    expect(sessionStorage.getItem('__reproduce_applied')).toBe('session-1')
    expect(document.cookie).toContain('jwt-token=fresh-jwt')
})

/*
 * The first reproduce link used to be the only one a document would honour:
 * the effect read the URL once, so a second link opened in the same Playwright
 * profile left the app on its loader with nothing in the log to say why.
 */
it('applies a second reproduce link opened after the first', async () => {
    const first = render(<ReproduceBootstrap />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://api.test/dev/reproduce/session-1'))
    first.unmount()

    openUrl('/setup?__reproduce=session-2')
    render(<ReproduceBootstrap />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://api.test/dev/reproduce/session-2'))
    expect(global.fetch).toHaveBeenCalledTimes(2)
})

/*
 * Two runs of the SAME link fetched two manifests, and the second wipe erased
 * what the first had seeded — no cookie, no localStorage, no reload. The
 * marker is written before the first await, so the second run never starts.
 */
it('runs one link exactly once across a remount and a popstate', async () => {
    const first = render(<ReproduceBootstrap />)
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))

    first.unmount()
    render(<ReproduceBootstrap />)
    window.dispatchEvent(new Event('popstate'))
    window.dispatchEvent(new Event('pageshow'))
    await Promise.resolve()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(cacheKeys).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('harness-pk')).toBe('0xabc')
})

it('re-reads the URL when a reproduce link arrives without a fresh mount', async () => {
    render(<ReproduceBootstrap />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://api.test/dev/reproduce/session-1'))

    openUrl('/setup?__reproduce=session-3')
    window.dispatchEvent(new Event('popstate'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://api.test/dev/reproduce/session-3'))
})

it('says so in the log when the manifest cannot be fetched', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch

    render(<ReproduceBootstrap />)

    await waitFor(() =>
        expect(error).toHaveBeenCalledWith('[reproduce] bootstrap failed', 'session-1', expect.any(Error))
    )
    error.mockRestore()
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
