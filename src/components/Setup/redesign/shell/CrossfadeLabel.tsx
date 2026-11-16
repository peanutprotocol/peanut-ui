'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** A button label that crossfades in 100 ms when it changes, so the button itself never moves (mock MOTION.md rule 9). */
export function CrossfadeLabel({ id, children, reduced }: { id: string; children: ReactNode; reduced: boolean }) {
    if (reduced) return <span className="inline-flex items-center">{children}</span>
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={id}
                className="inline-flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
            >
                {children}
            </motion.span>
        </AnimatePresence>
    )
}
