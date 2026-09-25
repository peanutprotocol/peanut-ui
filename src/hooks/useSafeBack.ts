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

// The URLs of the in-app history entries behind the current one, oldest first.
// Approximate like any history mirror: a browser forward also fires popstate.
const behind: string[] = []
// useReturnTo rewinds several entries in one popstate and trims `behind` itself.
let rewinding = false
let installed = false

const pathOf = (url: string) => url.split(/[?#]/)[0]

if (typeof window !== 'undefined' && !installed) {
    installed = true
    const orig = window.history.pushState.bind(window.history)
    window.history.pushState = function patched(...args: Parameters<typeof orig>) {
        behind.push(`${window.location.pathname}${window.location.search}`)
        return orig(...args)
    }
    window.addEventListener('popstate', () => {
        if (rewinding) {
            rewinding = false
            return
        }
        behind.pop()
    })
}

/**
 * True when the current entry was reached by an in-app navigation, so
 * `history.back()` stays inside the app. For link-mode back controls that
 * cannot hold a router (NavHeader's default `href`).
 */
export function hasInAppHistory(): boolean {
    return behind.length > 0
}

type Options = {
    /** Use router.replace instead of router.push for the no-history fallback. */
    replace?: boolean
}

export function useSafeBack(fallbackUrl: string, options: Options = {}): () => void {
    const router = useRouter()
    const { replace = false } = options
    return useCallback(() => {
        if (behind.length > 0) {
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
        for (let i = behind.length - 1; i >= 0; i--) {
            if (!isSameRoute(pathOf(behind[i]), originPath)) continue
            const steps = behind.length - i
            behind.length = i
            rewinding = true
            window.history.go(-steps)
            return
        }
        router.replace(origin)
    }, [router, origin])
}

// Tests only — module state is global so cases must reset between runs.
export const __testing = {
    reset(): void {
        behind.length = 0
        rewinding = false
    },
}
