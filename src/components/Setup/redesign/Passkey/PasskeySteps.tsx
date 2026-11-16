'use client'

import { motion } from 'framer-motion'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/** Numbered fix steps on a failure screen; the rows rise in once (300 ms, staggered). */
export function PasskeySteps({ steps, firstDelay = 0.2 }: { steps: string[]; firstDelay?: number }) {
    const { reducedMotion } = useSetupShell()
    return (
        <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
                <motion.li
                    key={step}
                    className="flex gap-3 text-body-s text-foreground-primary"
                    initial={reducedMotion ? false : { y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: firstDelay + index * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background-brand text-body-xs font-bold">
                        {index + 1}
                    </span>
                    <span>{step}</span>
                </motion.li>
            ))}
        </ol>
    )
}
