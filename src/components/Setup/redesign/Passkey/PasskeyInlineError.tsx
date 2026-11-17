'use client'

import { motion } from 'framer-motion'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/** One short passkey error in place of the points (DS error Callout); it shakes once when it appears. */
export function PasskeyInlineError({ message, className }: { message: string; className?: string }) {
    const { reducedMotion } = useSetupShell()
    return (
        <motion.div
            key={message}
            className={className}
            initial={{ opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 1], x: [0, -4, 4, 0] }}
            transition={{ duration: reducedMotion ? 0.2 : 0.3, ease: 'easeOut' }}
        >
            <Callout priority="error" data-testid="passkey-inline-error">
                {message}
            </Callout>
        </motion.div>
    )
}
