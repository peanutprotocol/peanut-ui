'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { twMerge } from '@/utils/tw'
import type { StuckBuddyPose } from '../types'
import { PeanutBuddyMascot } from './PeanutBuddyMascot'

interface PeanutBuddyProps {
    pose: StuckBuddyPose
    prompt: string
    ctaLabel: string
    dismissLabel: string
    mascotLabel: string
    /** Offset bottom clearance so Peanut always docks cleanly above BottomNav or a pinned CTA footer. */
    clearance: 'bottom-nav' | 'footer' | 'setup-footer'
    onAction: () => void
    onDismiss: () => void
}

const CLEARANCE_CLASS: Record<PeanutBuddyProps['clearance'], string> = {
    'bottom-nav': 'bottom-[calc(5.5rem_+_var(--safe-bottom))]',
    footer: 'bottom-[calc(6.5rem_+_var(--safe-bottom))]',
    'setup-footer': 'bottom-[calc(9.5rem_+_var(--safe-bottom))]',
}

/**
 * Floating walking Peanut helper ("Clippy-style" entry from the right edge).
 *
 * - Walks in with slight lean and deceleration, plants feet, and morphs its 13 shared
 *   Lottie rig layers cleanly into `waving-hello`, `thinking`, `worried`, or `sad`.
 * - Speech bubble springs in right as Peanut lands the pose.
 * - Marked `data-stuck-ignore` so taps on the helper never register as rage taps.
 */
export function PeanutBuddy({
    pose,
    prompt,
    ctaLabel,
    dismissLabel,
    mascotLabel,
    clearance,
    onAction,
    onDismiss,
}: PeanutBuddyProps) {
    const reducedMotion = useReducedMotion()
    const [bubbleVisible, setBubbleVisible] = useState(Boolean(reducedMotion))

    return (
        <motion.aside
            data-stuck-ignore="true"
            data-testid="peanut-buddy"
            aria-live="polite"
            initial={reducedMotion ? { opacity: 0 } : { x: 148, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: 148, opacity: 0 }}
            transition={
                reducedMotion
                    ? { duration: 0.2 }
                    : {
                          x: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
                          opacity: { duration: 0.18 },
                      }
            }
            className={twMerge(
                'pointer-events-none fixed right-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-end gap-2 md:right-6',
                CLEARANCE_CLASS[clearance]
            )}
        >
            <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 6 }}
                animate={
                    bubbleVisible || reducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 6 }
                }
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="pointer-events-auto"
            >
                <Card shadowSize="4" className="max-w-[244px] min-w-[216px] gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 pt-1 text-body-s-semibold text-foreground-primary">{prompt}</p>
                        <Button
                            type="button"
                            variant="ghost"
                            shape="square"
                            size="small"
                            icon="cancel"
                            iconSize={20}
                            onClick={onDismiss}
                            aria-label={dismissLabel}
                            data-testid="peanut-buddy-dismiss"
                            className="-mt-1 -mr-1 w-10 shrink-0 text-foreground-secondary"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="primary"
                        size="small"
                        shadowSize="2"
                        onClick={onAction}
                        data-testid="peanut-buddy-cta"
                    >
                        {ctaLabel}
                    </Button>
                </Card>
            </motion.div>

            <button
                type="button"
                onClick={onAction}
                aria-label={mascotLabel}
                data-testid="peanut-buddy-mascot-btn"
                className="pointer-events-auto relative h-24 w-20 shrink-0 cursor-pointer focus-visible:outline-3 focus-visible:outline-action-focus"
            >
                <PeanutBuddyMascot targetPose={pose} onLanded={() => setBubbleVisible(true)} />
            </button>
        </motion.aside>
    )
}
