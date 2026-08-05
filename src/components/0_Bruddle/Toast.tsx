'use client'

import { AnimatePresence, motion } from 'framer-motion'
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
type ToastId = string | number

interface ToastOptions {
    /** Plain-string message — wrapped in a styled <p>. Ignored when `content` is provided. */
    message?: string
    /** Custom inner content. Use this when the toast needs an icon + dynamic text
     *  (e.g. a live countdown). Takes precedence over `message`. */
    content?: React.ReactNode
    type?: ToastType
    /** Number = ms until auto-dismiss. `'persistent'` = stays until `dismiss(id)` is called. */
    duration?: number | 'persistent'
    position?: ToastPosition
    /** Caller-supplied id. Lets the same toast be `dismiss(id)`-able and prevents
     *  duplicate stacking — if a toast with this id is already on screen, the
     *  duplicate call is a no-op (no re-animation). Auto-generated when omitted. */
    id?: ToastId
    /** Extra classes merged into the toast container — for one-off accents like
     *  `border-yellow-1` that don't fit the standard success/error/info/warning. */
    className?: string
}

interface ToastMessage extends Omit<ToastOptions, 'id'> {
    id: ToastId
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

const Toast: React.FC<ToastMessage> = ({ type = 'info', message, content, className }) => {
    const colors = {
        success: 'border-green-500 ',
        error: 'border-red-500 ',
        info: 'border-blue-500 ',
        warning: 'border-yellow-500 ',
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 80 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 80 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={twMerge(
                'border-2 px-6 py-1',
                'card shadow-4 max-w-[calc(100vw_-_2rem)] md:max-w-md',
                colors[type],
                className
            )}
        >
            {content ?? <p className="break-words text-center text-sm font-bold">{message}</p>}
        </motion.div>
    )
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([])
    // Tracks the auto-dismiss timer per toast id so `dismiss(id)` can cancel it
    // (avoids a late timer firing after the toast was removed manually).
    const timersRef = useRef<Map<ToastId, ReturnType<typeof setTimeout>>>(new Map())

    const dismiss = useCallback((id: ToastId) => {
        const t = timersRef.current.get(id)
        if (t) {
            clearTimeout(t)
            timersRef.current.delete(id)
        }
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const createToast = useCallback((options: ToastOptions | string): ToastId => {
        const defaults: Partial<ToastOptions> = {
            type: 'info',
            duration: 3000,
            position: 'bottom-right',
        }

        const toastOptions = typeof options === 'string' ? { message: options } : options
        const id: ToastId = toastOptions.id ?? Date.now()

        // De-dupe: a persistent toast (or any explicitly-id'd toast) is a
        // no-op if one with the same id is already showing. Stops a retry
        // mid-cooldown from re-pushing the pill and re-animating it in.
        let alreadyPresent = false
        setToasts((prev) => {
            if (prev.some((t) => t.id === id)) {
                alreadyPresent = true
                return prev
            }
            return [...prev, { ...defaults, ...toastOptions, id }]
        })

        const duration = toastOptions.duration ?? defaults.duration
        if (!alreadyPresent && duration !== 'persistent') {
            const handle = setTimeout(() => {
                timersRef.current.delete(id)
                setToasts((prev) => prev.filter((t) => t.id !== id))
            }, duration as number)
            timersRef.current.set(id, handle)
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
                <div className="fixed bottom-[100px] right-4 z-[99999] flex flex-col items-end gap-2">
                    <AnimatePresence mode="sync">
                        {toasts.map((toast) => (
                            <Toast key={toast.id} {...toast} />
                        ))}
                    </AnimatePresence>
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
