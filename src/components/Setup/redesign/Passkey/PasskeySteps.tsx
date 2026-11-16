'use client'

import { motion } from 'framer-motion'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/**
 * Numbered fix steps on a failure screen; the rows rise in once (300 ms, staggered). The number badge is a CSS
 * counter, so each item's text is the step alone: the `ol` already gives assistive tech the position.
 */
export function PasskeySteps({ steps, firstDelay = 0.2 }: { steps: string[]; firstDelay?: number }) {
    const { reducedMotion } = useSetupShell()
    return (
        <ol className="flex flex-col gap-3 [counter-reset:passkey-step]">
            {steps.map((step, index) => (
                <motion.li
                    key={step}
                    className="flex gap-3 text-body-s text-foreground-primary [counter-increment:passkey-step] before:flex before:size-5 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-background-brand before:text-body-xs before:font-bold before:content-[counter(passkey-step)]"
                    initial={reducedMotion ? false : { y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: firstDelay + index * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <span>{step}</span>
                </motion.li>
            ))}
        </ol>
    )
}
