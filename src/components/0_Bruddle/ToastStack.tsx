'use client'

import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import type { ToastMessage } from './Toast'

/**
 * The animated toast stack, split out so framer-motion is not in the initial
 * bundle of every route. ToastProvider loads this on demand the first time a
 * toast is shown — the marketing site never shows one, so it never pays.
 */
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

export default function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
    return (
        <AnimatePresence mode="sync">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} />
            ))}
        </AnimatePresence>
    )
}
