'use client'

import dynamic from 'next/dynamic'
import { clipboardWrittenWithin } from '@/utils/clipboard.utils'
import { isAndroidNative } from '@/utils/capacitor'
import { twMerge } from '@/utils/tw'
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastId = string | number

const ToastStack = dynamic(() => import('./ToastStack'), { ssr: false })

/** How long after a clipboard write a toast is taken to be that copy's toast. */
const CLIPBOARD_OVERLAY_GRACE_MS = 1500

/**
 * Bottom offset while Android's system clipboard preview is on screen. That
 * preview is anchored bottom-left and grows with the copied text — a wrapped
 * peanut.me link measured ~124px tall on a 2.5x device, and the stack's normal
 * 16px sat inside it. Nothing in the WebView can measure the real overlay, so
 * this clears the tallest case seen rather than guessing per copy.
 */
const RAISED_BOTTOM = 'bottom-[calc(var(--safe-bottom)_+_8.5rem)]'
const NORMAL_BOTTOM = 'bottom-[calc(var(--safe-bottom)_+_1rem)]'

/**
 * How long a toast stays up, from how much there is to read: 2s for anything
 * you take in at a glance, +200ms per word up to six, +100ms per word after
 * that. A `content` toast designs its own body, so there is nothing to count —
 * it keeps the flat 3s. An explicit `duration` from the caller always wins.
 */
const readingDuration = (message?: string): number => {
    if (!message) return 3000
    const words = message.trim().split(/\s+/).filter(Boolean).length
    if (words <= 3) return 2000
    if (words <= 6) return 2000 + (words - 3) * 200
    return 2600 + (words - 6) * 100
}

interface ToastOptions {
    /** Plain-string message — wrapped in a styled <p>. Ignored when `content` is provided. */
    message?: string
    /** Custom inner content. Use this when the toast needs an icon + dynamic text
     *  (e.g. a live countdown). Takes precedence over `message`. */
    content?: React.ReactNode
    type?: ToastType
    /** Number = ms until auto-dismiss. `'persistent'` = stays until `dismiss(id)` is called. */
    duration?: number | 'persistent'
    /** Caller-supplied id. Lets the same toast be `dismiss(id)`-able and prevents
     *  duplicate stacking — if a toast with this id is already on screen, the
     *  duplicate call is a no-op (no re-animation). Auto-generated when omitted. */
    id?: ToastId
    /** Extra classes merged into the toast container — for one-off accents like
     *  `border-action-secondary` that don't fit the standard success/error/info/warning. */
    className?: string
    /** Self-designed toast content (badge celebrations): suppress the priority icon
     *  so Notification chrome doesn't stack onto the content's own artwork. */
    hideIcon?: boolean
}

export interface ToastMessage extends Omit<ToastOptions, 'id'> {
    id: ToastId
    /** Set by the provider, never by callers: this toast followed a clipboard
     *  write on Android, so the stack lifts clear of the system preview. */
    raised?: boolean
}

interface ToastContextType {
    toast: (options: ToastOptions | string) => ToastId
    success: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => ToastId
    error: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => ToastId
    info: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => ToastId
    warning: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => ToastId
    /** Remove a toast by id. No-op if not present. Used for `'persistent'` toasts. */
    dismiss: (id: ToastId) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([])
    // Once the renderer has been asked for, it stays. Unmounting it when the
    // list empties took AnimatePresence down with it, so in the common
    // one-toast case the last card vanished instead of playing its exit — the
    // presence owner has to outlive the child whose departure it animates.
    // Before the first toast it is still absent, so the chunk is never fetched
    // on a route that shows none.
    const [rendererWanted, setRendererWanted] = useState(false)
    // Tracks the auto-dismiss timer per toast id so `dismiss(id)` can cancel it
    // (avoids a late timer firing after the toast was removed manually).
    const timersRef = useRef<Map<ToastId, ReturnType<typeof setTimeout>>>(new Map())
    // Toasts waiting to be shown, holding the duration they will be armed with.
    // NOTHING is armed at creation: a lifetime starts when its own toast mounts.
    // ToastStack is next/dynamic and only STARTS loading on the first toast, so
    // arming at creation raced the chunk — on a cold session where it took
    // longer than the toast's lifetime, the timer removed the toast before
    // anything was drawn and the user saw no feedback at all. Gating on the
    // stack alone fixed only the first toast; every later one still armed
    // before React had committed it, so a delayed render shortened the toast and
    // desynced it from the bar, which starts at insertion. Per-toast is the only
    // version where the bar and the timeout measure the same interval.
    const pendingRef = useRef<Map<ToastId, number>>(new Map())

    // Each toast reports its own mount here, and that is the only place a
    // lifetime starts. Taking the duration out of `pending` makes this
    // idempotent, so StrictMode's double mount cannot double-arm.
    const handleToastShown = useCallback((id: ToastId) => {
        const duration = pendingRef.current.get(id)
        if (duration === undefined) return
        pendingRef.current.delete(id)
        timersRef.current.set(
            id,
            setTimeout(() => {
                timersRef.current.delete(id)
                setToasts((prev) => prev.filter((t) => t.id !== id))
            }, duration)
        )
    }, [])

    const dismiss = useCallback((id: ToastId) => {
        const t = timersRef.current.get(id)
        if (t) {
            clearTimeout(t)
            timersRef.current.delete(id)
        }
        pendingRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const createToast = useCallback((options: ToastOptions | string): ToastId => {
        const toastOptions = typeof options === 'string' ? { message: options } : options

        const defaults: Partial<ToastOptions> = {
            type: 'info',
            duration: readingDuration(toastOptions.message),
        }

        const id: ToastId = toastOptions.id ?? Date.now()
        setRendererWanted(true)
        // only Android pops the clipboard preview, and only just after a write
        const raised = isAndroidNative() && clipboardWrittenWithin(CLIPBOARD_OVERLAY_GRACE_MS)

        // De-dupe: a persistent toast (or any explicitly-id'd toast) is a
        // no-op if one with the same id is already showing. Stops a retry
        // mid-cooldown from re-pushing the pill and re-animating it in.
        let alreadyPresent = false
        setToasts((prev) => {
            if (prev.some((t) => t.id === id)) {
                alreadyPresent = true
                return prev
            }
            return [...prev, { ...defaults, ...toastOptions, id, raised }]
        })

        const duration = toastOptions.duration ?? defaults.duration
        if (!alreadyPresent && duration !== 'persistent') {
            pendingRef.current.set(id, duration as number)
        }

        return id
    }, [])

    // Memoized so consumers that include this in effect/callback dep arrays
    // don't re-fire on every render. createToast/dismiss are useCallback-stable.
    const contextValue: ToastContextType = useMemo(
        () => ({
            toast: createToast,
            success: (message, options) => createToast({ ...options, type: 'success', message }),
            error: (message, options) => createToast({ ...options, type: 'error', message }),
            info: (message, options) => createToast({ ...options, type: 'info', message }),
            warning: (message, options) => createToast({ ...options, type: 'warning', message }),
            dismiss,
        }),
        [createToast, dismiss]
    )

    return (
        <>
            <ToastContext.Provider value={contextValue}>
                {/* L/16 off the bottom edge, plus the home indicator so the toast
                    never lands in the gesture area. It deliberately sits OVER the
                    bottom nav (z beats the nav's z-10) rather than clearing it —
                    the notification board has no toast component, so placement was
                    never ruled; this one is (2026-09-04, slava). */}
                <div
                    className={twMerge(
                        // motion-safe: the lift is a ~120px travel, which is the
                        // same large decorative motion the card's own spring is
                        // gated on. Under reduce the stack simply moves.
                        'fixed right-4 z-[99999] flex flex-col items-end gap-2 motion-safe:transition-[bottom] motion-safe:duration-fast',
                        toasts.some((t) => t.raised) ? RAISED_BOTTOM : NORMAL_BOTTOM
                    )}
                >
                    {rendererWanted && <ToastStack toasts={toasts} dismiss={dismiss} onShow={handleToastShown} />}
                </div>
                {children}
            </ToastContext.Provider>
        </>
    )
}

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
