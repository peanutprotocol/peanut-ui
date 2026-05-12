import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

let inAppPushCount = 0
let installed = false

if (typeof window !== 'undefined' && !installed) {
    installed = true
    const orig = window.history.pushState.bind(window.history)
    window.history.pushState = function patched(...args: Parameters<typeof orig>) {
        inAppPushCount++
        return orig(...args)
    }
    window.addEventListener('popstate', () => {
        inAppPushCount = Math.max(0, inAppPushCount - 1)
    })
}

type Options = {
    /** Use router.replace instead of router.push for the no-history fallback. */
    replace?: boolean
}

export function useSafeBack(fallbackUrl: string, options: Options = {}): () => void {
    const router = useRouter()
    const { replace = false } = options
    return useCallback(() => {
        if (inAppPushCount > 0) {
            router.back()
        } else if (replace) {
            router.replace(fallbackUrl)
        } else {
            router.push(fallbackUrl)
        }
    }, [router, fallbackUrl, replace])
}

// Tests only — module state is global so cases must reset between runs.
export const __testing = {
    reset(): void {
        inAppPushCount = 0
    },
}
