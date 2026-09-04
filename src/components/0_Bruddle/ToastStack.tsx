'use client'

import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect } from 'react'
import { Notification } from './Notification'
import type { ToastMessage } from './Toast'

/**
 * The animated toast stack, split out so framer-motion is not in the initial
 * bundle of every route. ToastProvider loads this on demand the first time a
 * toast is shown — the marketing site never shows one, so it never pays.
 */

// toast tone -> notification priority (board 17369:136904: a toast is the
// notification component in its floating, dismissible format)
const TOAST_PRIORITY = {
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'attention',
} as const

const Toast: React.FC<ToastMessage & { onDismiss: () => void; onShow?: (id: ToastMessage['id']) => void }> = ({
    id,
    type = 'info',
    message,
    content,
    className,
    hideIcon,
    duration,
    onDismiss,
    onShow,
}) => {
    // the provider starts this toast's lifetime here, so the countdown bar and
    // the dismiss timeout measure the same interval from the same instant
    useEffect(() => {
        onShow?.(id)
    }, [id, onShow])

    return (
        <motion.div
            // no opacity in any of the three states: a toast is an opaque card and
            // must never render as a wash over the screen behind it, not even for
            // the 300ms it is arriving. It springs up into place and, on exit,
            // slides clear of the viewport instead of fading out. The stack is
            // position:fixed, so travelling past the bottom edge adds no scroll.
            initial={{ scale: 0.8, y: 80 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 200, transition: { duration: 0.2, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="max-w-[calc(100vw_-_2rem)] md:max-w-md"
        >
            <Notification
                variant="floating"
                priority={TOAST_PRIORITY[type]}
                onDismiss={onDismiss}
                className={className}
                // a 'persistent' toast has no timer to draw — only a numeric
                // duration gets the countdown bar
                progressMs={typeof duration === 'number' ? duration : undefined}
                // custom content designs its own leading visual (badge art, clock
                // pill) — the stock priority icon must never stack in front of it,
                // whether or not the caller remembered hideIcon
                hideIcon={hideIcon || content != null}
            >
                {content ?? message}
            </Notification>
        </motion.div>
    )
}

export default function ToastStack({
    toasts,
    dismiss,
    onShow,
}: {
    toasts: ToastMessage[]
    dismiss: (id: ToastMessage['id']) => void
    /** Fired per toast once it is on screen, so the provider can start that
     *  toast's lifetime from the moment it can actually be read. */
    onShow?: (id: ToastMessage['id']) => void
}) {
    return (
        <AnimatePresence mode="sync">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onDismiss={() => dismiss(toast.id)} onShow={onShow} />
            ))}
        </AnimatePresence>
    )
}
