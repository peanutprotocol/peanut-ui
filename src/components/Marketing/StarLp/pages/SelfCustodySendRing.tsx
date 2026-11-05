'use client'

import { motion } from 'framer-motion'
import { twMerge } from '@/utils/tw'
import type { SelfCustodySendRingProps } from './selfCustody.types'

/**
 * A pink ring that leaves the Peanut phone's Send button once, after the
 * "Funds on hold" stamp has landed on the usual app: theirs freezes, yours
 * sends. Not shown under reduced motion (a class, so the server and client
 * render the same node).
 */
export function SelfCustodySendRing({ delay, className }: SelfCustodySendRingProps) {
    return (
        <motion.span
            aria-hidden
            className={twMerge('motion-reduce:hidden', className)}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: [0, 1, 0], scale: [0.8, 1, 1.3] }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay }}
        />
    )
}
