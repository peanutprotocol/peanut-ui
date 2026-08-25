// Which fixture, if any, this tab is running. Kept tiny and dependency-free:
// api-fetch imports it on every call, and DEV_TOOLS_ENABLED folds it to
// `return null` in a production build.

import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'

export const FIXTURE_PARAM = '__fixture'
const STORAGE_KEY = 'peanut_fixture'
const JWT_COOKIE = 'jwt-token'

// sessionStorage, not React state or a URL param alone: the app does a lot of
// nuqs/router navigation and the param is dropped on the first route change,
// so a param-only fixture would evaporate. Session scope also means the fake
// session dies with the tab instead of following a developer around.
function stored(): string | null {
    try {
        return window.sessionStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

function activate(name: string): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, name)
    } catch {}
    // The frontend only checks that a jwt-token cookie EXISTS (proxy.ts,
    // auth-token.ts). Every API answer is faked, so an opaque value is enough —
    // no real JWT, no login call.
    document.cookie = `${JWT_COOKIE}=fixture; path=/`
}

/** Drops the fixture and the fake session, so the tab behaves normally again. */
export function clearFixture(): void {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
    document.cookie = `${JWT_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
}

/**
 * Name of the running fixture, or null. Reads `?__fixture=<name>` first so a
 * pasted URL always wins, then falls back to the session. `?__fixture=off`
 * clears it.
 *
 * `ensure`, not `get`: promoting a URL param to the session writes
 * sessionStorage and the cookie. Idempotent, so the render-time callers and a
 * StrictMode double-render are both safe.
 */
export function ensureActiveFixture(): string | null {
    if (!DEV_TOOLS_ENABLED || typeof window === 'undefined') return null
    const fromUrl = new URLSearchParams(window.location.search).get(FIXTURE_PARAM)
    if (fromUrl === 'off' || fromUrl === '') {
        clearFixture()
        return null
    }
    if (fromUrl && fromUrl !== stored()) activate(fromUrl)
    return fromUrl ?? stored()
}
