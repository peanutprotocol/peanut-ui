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

/**
 * NavHeader calls this with a ref to its root. No-op outside a provider
 * (marketing routes). Registration follows VISUAL presence, not mount: a
 * header inside a responsive-hidden wrapper (`md:hidden` on receipt pages,
 * DevPageShell, PaymentSuccessView) must not suppress the shell fallback at
 * the breakpoint where it is display:none — its own banner is hidden with it.
 * `checkVisibility()` sees ancestor display:none; where the API is missing
 * (jsdom, older Safari) we fall back to mount-equals-visible, the previous
 * behavior. Re-checked on resize for breakpoint crossings.
 */
export function useRegisterNavHeader(ref: React.RefObject<HTMLElement | null>, disabled = false) {
    const ctx = useContext(NavHeaderPresenceContext)
    // layout effect so the shell fallback flips before paint — no banner flash
    useLayoutEffect(() => {
        // a banner-opted-out header carries no banner, so it must not
        // suppress the shell fallback either
        if (!ctx || disabled) return undefined
        let unregister: (() => void) | null = null
        const sync = () => {
            const el = ref.current
            const visible = !!el && (typeof el.checkVisibility !== 'function' || el.checkVisibility())
            if (visible && !unregister) unregister = ctx.register()
            else if (!visible && unregister) {
                unregister()
                unregister = null
            }
        }
        sync()
        // resize is the only re-sync trigger — visibility here only ever
        // changes via breakpoint classes (md:hidden) or unmount, which resize
        // and the effect lifecycle cover. A header whose visibility flipped
        // via a state-driven class toggle would stay mis-registered; no such
        // caller exists today, so no observer machinery until one does.
        window.addEventListener('resize', sync)
        return () => {
            window.removeEventListener('resize', sync)
            unregister?.()
        }
    }, [ctx, ref, disabled])
}

export function useHasNavHeader(): boolean {
    return useContext(NavHeaderPresenceContext)?.hasNavHeader ?? false
}
