import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Returns a back handler. Calls `router.back()` when in-app history exists; otherwise pushes
 * `fallbackUrl`. The module-level patch below installs on import — side-effect imported from
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

export function useSafeBack(fallbackUrl: string): () => void {
    const router = useRouter()
    return useCallback(() => {
        if (inAppPushCount > 0) {
            router.back()
        } else {
            router.push(fallbackUrl)
        }
    }, [router, fallbackUrl])
}

// Tests only — module state is global so cases must reset between runs.
export const __testing = {
    reset(): void {
        inAppPushCount = 0
    },
}
