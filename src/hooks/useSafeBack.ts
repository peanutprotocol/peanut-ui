import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isSameRoute } from '@/constants/routes'

/**
 * Returns a back handler. Calls `router.back()` when in-app history exists; otherwise
 * navigates to `fallbackUrl`.
 *
 * Pass `{ replace: true }` for terminal flows (error screens, success screens) where
 * leaving the current URL in history would let browser back pop the user into a now-stale
 * state. The fallback uses `router.replace` instead of `router.push`. The in-app `back()`
 * branch is unchanged either way — `replace` only affects the no-history fallback.
 *
 * The module-level patch below installs on import — side-effect imported from
 * `(mobile-ui)/layout.tsx` so the patch beats any child's mount-time router.push.
 */

// A mirror of this tab's in-app history. Every entry the app writes carries
// its position in `history.state`, so a popstate says where the browser
// landed — Back and Forward alike — instead of the mirror guessing a direction.
const INDEX_KEY = '__peanutHistoryIndex'
// The URL of each in-app entry, by position. Kept in sessionStorage because a
// reload keeps the tab's history but starts this module over; without the
// URLs a rewind after a reload could only replace, leaving a duplicate behind.
const ENTRIES_KEY = 'peanut:history-entries'
const entries: string[] = []
let index = 0
let installed = false

const saveEntries = () => {
    try {
        window.sessionStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
    } catch {}
}
const loadEntries = (): string[] => {
    try {
        const saved: unknown = JSON.parse(window.sessionStorage.getItem(ENTRIES_KEY) ?? '[]')
        return Array.isArray(saved) ? saved.filter((url): url is string => typeof url === 'string') : []
    } catch {
        return []
    }
}

const pathOf = (url: string) => url.split(/[?#]/)[0]
const currentUrl = () => `${window.location.pathname}${window.location.search}`
const indexOf = (state: unknown): number | undefined => {
    const value = (state as Record<string, unknown> | null)?.[INDEX_KEY]
    return typeof value === 'number' ? value : undefined
}
const withIndex = (state: unknown, at: number) => ({ ...((state as object | null) ?? {}), [INDEX_KEY]: at })

if (typeof window !== 'undefined' && !installed) {
    installed = true
    const push = window.history.pushState.bind(window.history)
    const replace = window.history.replaceState.bind(window.history)
    window.history.pushState = function patched(state, unused, url) {
        index++
        push(withIndex(state, index), unused, url)
        entries.length = index
        entries.push(currentUrl())
        saveEntries()
    }
    // Next and nuqs rewrite the state of the current entry; keep its position on it.
    window.history.replaceState = function patched(state, unused, url) {
        replace(withIndex(state, index), unused, url)
        entries[index] = currentUrl()
        saveEntries()
    }
    window.addEventListener('popstate', (event) => {
        index = indexOf(event.state) ?? Math.max(0, index - 1)
        entries[index] = currentUrl()
        saveEntries()
    })
    index = indexOf(window.history.state) ?? 0
    // a fresh tab entry (no index) starts a new mirror; a reload resumes the saved one
    if (index > 0) entries.push(...loadEntries().slice(0, index))
    replace(withIndex(window.history.state, index), '')
    entries[index] = currentUrl()
    saveEntries()
}

/**
 * True when the current entry was reached by an in-app navigation, so
 * `history.back()` stays inside the app. For link-mode back controls that
 * cannot hold a router (NavHeader's default `href`).
 */
export function hasInAppHistory(): boolean {
    return index > 0
}

type Options = {
    /** Use router.replace instead of router.push for the no-history fallback. */
    replace?: boolean
}

export function useSafeBack(fallbackUrl: string, options: Options = {}): () => void {
    const router = useRouter()
    const { replace = false } = options
    return useCallback(() => {
        if (index > 0) {
            router.back()
        } else if (replace) {
            router.replace(fallbackUrl)
        } else {
            router.push(fallbackUrl)
        }
    }, [router, fallbackUrl, replace])
}

/**
 * Returns a handler that leaves a flow for the page it was opened from, `origin`
 * (a `returnTo`, or `/home` for a flow entered from the tab bar).
 *
 * When `origin` is behind the current entry, history rewinds to its nearest
 * entry, so every page the flow pushed leaves with it. Pushing `origin` instead
 * kept the flow under it, and back from `origin` reopened the flow: Accounts and
 * payments → account details → back → Accounts and payments → back → account
 * details (TASK-23054). When `origin` is not in in-app history (a deep link, or
 * a flow entered from somewhere else), the current entry is replaced by it.
 */
export function useReturnTo(origin: string): () => void {
    const router = useRouter()
    return useCallback(() => {
        const originPath = pathOf(origin)
        for (let i = index - 1; i >= 0; i--) {
            if (entries[i] === undefined || !isSameRoute(pathOf(entries[i]), originPath)) continue
            window.history.go(i - index)
            return
        }
        router.replace(origin)
    }, [router, origin])
}

// Tests only — module state is global so cases must reset between runs.
export const __testing = {
    reset(): void {
        entries.length = 0
        index = 0
        window.sessionStorage.removeItem(ENTRIES_KEY)
        window.history.replaceState(null, '')
    },
}
