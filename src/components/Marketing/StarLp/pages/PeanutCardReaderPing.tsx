'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// Two pings close together, then one every 4s.
const SECOND_PING_MS = 1200
const PING_EVERY_MS = 4000

/**
 * The reader's named idle loop ("reader ping"): a pink ring leaves the
 * contactless mark to invite a tap. The scene mounts it only after the story,
 * while it is in view, before the visitor's first tap, and never under reduced motion.
 */
export function PeanutCardReaderPing() {
    const [ping, setPing] = useState(0)

    useEffect(() => {
        const id = window.setTimeout(() => setPing((n) => n + 1), ping === 0 ? SECOND_PING_MS : PING_EVERY_MS)
        return () => window.clearTimeout(id)
    }, [ping])

    return (
        <motion.span
            key={ping}
            aria-hidden
            data-loop="star-lp-reader-ping"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-pink-500"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
        />
    )
}
