'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import { ART_DELAY_S } from './shell.motion'

/**
 * One dot per step after the landing: done dots filled, the current one a 20 px pill that hops once when it
 * becomes current (mock shell.css .dots, shell.js updateChrome). Decorative: the step count is not announced.
 */
export function ProgressDots({ index, total, reduced }: { index: number; total: number; reduced: boolean }) {
    // the first paint shows the dots at rest; only a change of step hops the new current dot
    const firstPaint = useRef(true)
    useEffect(() => {
        firstPaint.current = false
    }, [])
    return (
        <span aria-hidden="true" className="flex items-center gap-[5px]" data-setup-dots>
            {Array.from({ length: total }, (_, i) => (
                <motion.i
                    key={i === index ? `now-${index}` : i}
                    className={twMerge(
                        'block h-[7px] w-[7px] origin-bottom rounded-full border-[1.5px] border-solid border-foreground-primary',
                        i < index && 'bg-foreground-primary',
                        i === index && 'w-5 bg-background-default',
                        reduced
                            ? 'transition-colors duration-fast'
                            : 'transition-[width,background-color] duration-moderate ease-spring'
                    )}
                    initial={firstPaint.current ? false : undefined}
                    animate={
                        i === index && !reduced
                            ? {
                                  y: [0, 0, -5, 0, 0],
                                  scaleX: [1, 1.1, 0.92, 1.08, 1],
                                  scaleY: [1, 0.8, 1.12, 0.88, 1],
                              }
                            : undefined
                    }
                    transition={{ duration: 0.4, delay: ART_DELAY_S, times: [0, 0.2, 0.5, 0.78, 1], ease: 'easeOut' }}
                />
            ))}
        </span>
    )
}
