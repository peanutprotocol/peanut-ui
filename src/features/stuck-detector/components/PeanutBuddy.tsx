'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
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
            initial={reducedMotion ? { opacity: 0 } : { x: 180, opacity: 0, rotate: -3 }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0, opacity: 1, rotate: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { x: 180, opacity: 0 }}
            transition={
                reducedMotion
                    ? { duration: 0.2 }
                    : {
                          x: { duration: 0.82, ease: [0.22, 1, 0.36, 1] },
                          rotate: { duration: 0.82, ease: [0.22, 1, 0.36, 1] },
                          opacity: { duration: 0.2 },
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
                className="pointer-events-auto flex max-w-[244px] min-w-[200px] flex-col gap-2 rounded-sm border border-border-default bg-background-default p-3 shadow-4"
            >
                <div className="flex items-start justify-between gap-2">
                    <p className="pt-1 text-body-s-semibold text-foreground-primary">{prompt}</p>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={dismissLabel}
                        data-testid="peanut-buddy-dismiss"
                        className="relative -mt-1.5 -mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-instant after:absolute after:-inset-0.5 hover:bg-background-page focus-visible:outline-3 focus-visible:outline-action-focus"
                    >
                        <Icon name="cancel" size={20} />
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onAction}
                    data-testid="peanut-buddy-cta"
                    className="btn btn-primary btn-small shadow-2 w-full justify-center"
                >
                    {ctaLabel}
                </button>
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
