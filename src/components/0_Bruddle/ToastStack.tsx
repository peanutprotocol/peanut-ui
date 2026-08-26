'use client'

import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
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

const Toast: React.FC<ToastMessage & { onDismiss: () => void }> = ({
    type = 'info',
    message,
    content,
    className,
    onDismiss,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 80 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 80 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="max-w-[calc(100vw_-_2rem)] md:max-w-md"
        >
            <Notification priority={TOAST_PRIORITY[type]} onDismiss={onDismiss} className={className}>
                {content ?? message}
            </Notification>
        </motion.div>
    )
}

export default function ToastStack({
    toasts,
    dismiss,
}: {
    toasts: ToastMessage[]
    dismiss: (id: ToastMessage['id']) => void
}) {
    return (
        <AnimatePresence mode="sync">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onDismiss={() => dismiss(toast.id)} />
            ))}
        </AnimatePresence>
    )
}
