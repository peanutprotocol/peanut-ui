'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { twMerge } from '@/utils/tw'
import type { StuckBuddyPose } from '../types'
import { PeanutBuddyMascot } from './PeanutBuddyMascot'

const WHIMSY_WAVE_MS = 3_800
const WHIMSY_EXIT_SLIDE_MS = 680
const LOAD_FALLBACK_MS = 1_500

interface PeanutBuddyProps {
    pose: StuckBuddyPose
    prompt: string
    ctaLabel: string
    dismissLabel: string
    mascotLabel: string
    /** Offset bottom clearance so Peanut always docks cleanly above BottomNav or a pinned CTA footer. */
    clearance: 'bottom-nav' | 'footer' | 'setup-footer'
    /**
     * Playful Home-idle cameo mode (no speech bubble): Peanut walks in, does a friendly Disney
     * hop-wave for ~3.8s, and walks cheerfully back off the right edge unless tapped.
     */
    whimsy?: boolean
    /** Fired once when the helper actually lands and becomes interactive (for impression capping & telemetry). */
    onImpression?: () => void
    onAction: () => void
    onDismiss: () => void
    onAutoLeave?: () => void
}

const CLEARANCE_CLASS: Record<PeanutBuddyProps['clearance'], string> = {
    'bottom-nav': 'bottom-[calc(5.5rem_+_var(--safe-bottom))]',
    footer: 'bottom-[calc(6.5rem_+_var(--safe-bottom))]',
    'setup-footer': 'bottom-[calc(9.5rem_+_var(--safe-bottom))]',
}

/**
 * Floating walking Peanut helper ("Clippy-style" entry from the right edge).
 *
 * - Walks in to a pose-matched contact frame, performs a 4-beat Disney hop-turn into
 *   `waving-hello`, `thinking`, or `worried`, and settles cleanly above nav/footers.
 * - Keeps bubble `pointer-events-none` until landed so loading never creates an invisible tap target.
 * - Sits at `z-10` so `Global/Modal` (`z-20`), `Drawer`, and `QRScanner` (`z-50`) always sit above it.
 */
export function PeanutBuddy({
    pose,
    prompt,
    ctaLabel,
    dismissLabel,
    mascotLabel,
    clearance,
    whimsy = false,
    onImpression,
    onAction,
    onDismiss,
    onAutoLeave,
}: PeanutBuddyProps) {
    const reducedMotion = Boolean(useReducedMotion())
    const [bubbleVisible, setBubbleVisible] = useState(reducedMotion && !whimsy)
    const [whimsyLanded, setWhimsyLanded] = useState(false)
    const [whimsyExiting, setWhimsyExiting] = useState(false)
    const [mascotFailed, setMascotFailed] = useState(false)
    const impressionReportedRef = useRef(false)

    const reportImpressionOnce = useCallback(() => {
        if (impressionReportedRef.current) return
        impressionReportedRef.current = true
        onImpression?.()
    }, [onImpression])

    const handleLanded = useCallback(() => {
        if (whimsy) {
            setWhimsyLanded(true)
        } else {
            setBubbleVisible(true)
        }
        reportImpressionOnce()
    }, [whimsy, reportImpressionOnce])

    const handleLoadFailed = useCallback(() => {
        setMascotFailed(true)
        if (whimsy) {
            onAutoLeave?.()
            return
        }
        setBubbleVisible(true)
        reportImpressionOnce()
    }, [whimsy, onAutoLeave, reportImpressionOnce])

    // Reduced-motion stuck bubble is visible immediately on mount: report impression once.
    useEffect(() => {
        if (reducedMotion && !whimsy) {
            reportImpressionOnce()
        }
    }, [reducedMotion, whimsy, reportImpressionOnce])

    // If the Lottie chunk stalls on a slow network, reveal the stuck bubble after 1.5s (or bail on whimsy).
    useEffect(() => {
        if (bubbleVisible || whimsyLanded || reducedMotion) return
        const timer = window.setTimeout(() => {
            if (whimsy) {
                onAutoLeave?.()
            } else {
                setBubbleVisible(true)
                reportImpressionOnce()
            }
        }, LOAD_FALLBACK_MS)
        return () => window.clearTimeout(timer)
    }, [bubbleVisible, whimsyLanded, reducedMotion, whimsy, onAutoLeave, reportImpressionOnce])

    // In playful whimsy mode, auto-turn and walk cheerfully back off-screen after waving.
    useEffect(() => {
        if (!whimsy || !whimsyLanded) return
        const startExitTimer = window.setTimeout(() => {
            setWhimsyExiting(true)
        }, WHIMSY_WAVE_MS)
        return () => window.clearTimeout(startExitTimer)
    }, [whimsy, whimsyLanded])

    useEffect(() => {
        if (!whimsy || !whimsyExiting) return
        const finishTimer = window.setTimeout(() => {
            onAutoLeave?.()
        }, WHIMSY_EXIT_SLIDE_MS)
        return () => window.clearTimeout(finishTimer)
    }, [whimsy, whimsyExiting, onAutoLeave])

    // Skip unrequested whimsical motion completely under prefers-reduced-motion or mascot load failure.
    if (whimsy && (reducedMotion || mascotFailed)) return null

    const isBubbleInteractive = bubbleVisible || reducedMotion

    return (
        <motion.aside
            data-stuck-ignore="true"
            data-testid={whimsy ? 'peanut-buddy-whimsy' : 'peanut-buddy'}
            initial={reducedMotion ? { opacity: 0 } : { x: 148, opacity: 0 }}
            animate={whimsyExiting ? { x: 148, opacity: 0 } : reducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: 148, opacity: 0 }}
            transition={
                reducedMotion
                    ? { duration: 0.2 }
                    : whimsyExiting
                      ? {
                            x: { duration: WHIMSY_EXIT_SLIDE_MS / 1000, ease: [0.4, 0, 1, 1] },
                            opacity: { duration: 0.25, delay: 0.4 },
                        }
                      : {
                            x: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
                            opacity: { duration: 0.18 },
                        }
            }
            className={twMerge(
                'pointer-events-none fixed right-3 z-10 flex max-w-[calc(100vw-1.5rem)] items-end gap-2 md:right-6',
                CLEARANCE_CLASS[clearance]
            )}
        >
            {!whimsy && (
                <motion.div
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 6 }}
                    animate={isBubbleInteractive ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    aria-hidden={!isBubbleInteractive}
                    className={isBubbleInteractive ? 'pointer-events-auto' : 'pointer-events-none'}
                >
                    <Card shadowSize="4" className="max-w-[244px] min-w-[216px] gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <p
                                aria-live="polite"
                                className="min-w-0 flex-1 pt-1 text-body-s-semibold text-foreground-primary"
                            >
                                {isBubbleInteractive ? prompt : ''}
                            </p>
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
            )}

            {!mascotFailed && (
                <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.92, y: -6 }}
                    onClick={onAction}
                    tabIndex={whimsy ? 0 : -1}
                    aria-label={mascotLabel}
                    data-testid="peanut-buddy-mascot-btn"
                    className="pointer-events-auto relative h-24 w-20 shrink-0 cursor-pointer focus-visible:outline-3 focus-visible:outline-action-focus"
                >
                    <PeanutBuddyMascot
                        targetPose={pose}
                        exiting={whimsyExiting}
                        onLanded={handleLanded}
                        onLoadFailed={handleLoadFailed}
                    />
                </motion.button>
            )}
        </motion.aside>
    )
}
