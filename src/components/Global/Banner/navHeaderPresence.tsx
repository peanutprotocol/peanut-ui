'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'

/**
 * Tracks whether a NavHeader is mounted under the current app shell, so the
 * shell can fall back to a top-of-shell maintenance banner ONLY on headerless
 * states (loading, error screens, guest views). One rule: the banner renders
 * below the nav header when a page has one, at the top of the shell when it
 * does not (Chip finding on PR #2946 — a /card API failure has no NavHeader
 * and must still explain the outage).
 */
interface NavHeaderPresence {
    register: () => () => void
    hasNavHeader: boolean
}

const NavHeaderPresenceContext = createContext<NavHeaderPresence | null>(null)

export function NavHeaderPresenceProvider({ children }: { children: React.ReactNode }) {
    const [count, setCount] = useState(0)
    const register = useCallback(() => {
        setCount((c) => c + 1)
        return () => setCount((c) => c - 1)
    }, [])
    const value = useMemo(() => ({ register, hasNavHeader: count > 0 }), [register, count])
    return <NavHeaderPresenceContext.Provider value={value}>{children}</NavHeaderPresenceContext.Provider>
}

/** NavHeader calls this on mount. No-op outside a provider (marketing routes). */
export function useRegisterNavHeader() {
    const ctx = useContext(NavHeaderPresenceContext)
    // layout effect so the shell fallback flips before paint — no banner flash
    useLayoutEffect(() => ctx?.register(), [ctx])
}

export function useHasNavHeader(): boolean {
    return useContext(NavHeaderPresenceContext)?.hasNavHeader ?? false
}
