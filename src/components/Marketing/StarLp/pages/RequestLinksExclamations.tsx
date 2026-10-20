'use client'

import { motion, MotionConfig } from 'framer-motion'
import Exclamations from '@/assets/illustrations/exclamations.svg'

/**
 * The "!!" doodle by "week.": one shake when the title comes into view, never a
 * loop (the glove keeps the page's only loop). framer drops it under reduced motion.
 */
export function RequestLinksExclamations() {
    return (
        <MotionConfig reducedMotion="user">
            <motion.img
                src={Exclamations.src}
                width={Exclamations.width}
                height={Exclamations.height}
                alt=""
                aria-hidden
                className="ml-2 inline-block w-7 -translate-y-4 align-top md:-mb-4 md:w-10 md:-translate-y-1"
                initial={{ rotate: 12 }}
                whileInView={{ rotate: [12, 22, 4, 16, 12] }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.52, ease: [0.34, 1.56, 0.64, 1] }}
            />
        </MotionConfig>
    )
}
