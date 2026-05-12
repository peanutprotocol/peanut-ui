'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Back-button primitive for deep-linkable screens.
 *
 * Plain `router.back()` is a no-op when the current screen is the first entry in the tab's
 * history (cold deep-link, QR scan, push notification, PWA install). The user clicks back
 * and nothing happens — the bug Konrad reported on the Pix decode error screen, and the
 * back-loop bugs in add-money/card.
 *
 * useSafeBack tracks whether the user has navigated within our app this session by patching
 * `history.pushState` once at install time. If there's an in-app history entry to pop, it
 * pops. Otherwise it pushes the caller-supplied fallback URL (typically a parent route or
 * /home), guaranteeing the back button always moves the user somewhere.
 *
 * The patch survives Next.js routing, nuqs query-state pushes, and any direct
 * `window.history.pushState` call — anything that grows the history stack is tracked.
 */

// Module-local — single source of truth across the app for "how many in-app pushes are
// still poppable?". popstate (browser/device back) decrements; pushState increments.
let inAppPushCount = 0
let installed = false

export function installNavTracker(): void {
    if (installed || typeof window === 'undefined') return
    installed = true

    const origPushState = window.history.pushState.bind(window.history)
    window.history.pushState = function patchedPushState(...args) {
        inAppPushCount++
        return origPushState(...(args as Parameters<typeof origPushState>))
    }

    window.addEventListener('popstate', () => {
        // Floor at 0 — a user can pop past our app's entries (e.g. back out into the
        // previous site that loaded our PWA). Don't go negative; treat as "exited."
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

// Test-only escape hatches. Module state is global so tests must reset it between cases.
// Not exported from any barrel — tests reach in directly.
export const __testing = {
    reset(): void {
        inAppPushCount = 0
        installed = false
    },
    getCount(): number {
        return inAppPushCount
    },
    isInstalled(): boolean {
        return installed
    },
}
