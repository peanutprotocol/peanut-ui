'use client'

/**
 * <BadgeSkipCelebration /> — celebration moment when a user with a skip
 * badge passes the eligibility check.
 *
 * Reveal choreography (driven by `phase`):
 *   1. `looking-up` (0 → 600ms) — pixelated card from the eligibility
 *      screen carries over, with a "Looking you up…" headline that
 *      sells the moment between hold-complete and the asset arriving.
 *   2. `shaking` (600 → 1100ms) — perk-claim shake + haptic + the asset
 *      starts fading/sliding in behind the pixelated card.
 *   3. `revealed` (1100ms+) — pixelated card animates out, share asset
 *      lands at full opacity with confetti + the inner D3 animation.
 *
 * Once dismissed, the parent stamps the seen marker + advances to add-card.
 */

import { type FC, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import NavHeader from '@/components/Global/NavHeader'
import { ScaledShareAsset } from '@/components/Card/share-asset/ScaledShareAsset'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { ShareAssetActions } from '@/components/Card/share-asset/ShareAssetActions'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { getShakeClass } from '@/utils/perk.utils'
import { useHaptic } from 'use-haptic'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { TierLevel } from '@/components/Card/share-asset/shareAsset.types'

interface Props {
    badgeCode?: string
    username?: string
    badges: Array<{ code: string; earnedAt?: string }>
    stats?: {
        joinedAt?: string | null
        totalMovedUsd?: number
        totalTxns?: number
        invitedCount?: number
    }
    tier?: TierLevel
    pointsBalance?: number
    onContinue: () => void
}

const SKIP_BADGE_HEADLINES: Record<string, string> = {
    OG_2025_10_12: 'OG access. You skipped the line.',
    DEVCONNECT_BA_2025: 'Devconnect crew. You skipped the line.',
    ARBIVERSE_DEVCONNECT_BA_2025: 'Arbiverse. You skipped the line.',
}

// Fallback when the user has card access but no skip badge (e.g. admin
// grant, waitlist roll-out). Same celebration moment, different framing.
const NO_BADGE_HEADLINE = "You're in."

type Phase = 'looking-up' | 'shaking' | 'revealed'

const BadgeSkipCelebration: FC<Props> = ({ badgeCode, username, badges, stats, tier, pointsBalance, onContinue }) => {
    const [phase, setPhase] = useState<Phase>('looking-up')
    const [hideUsername, setHideUsername] = useState(false)
    const { triggerHaptic } = useHaptic()
    const captureRef = useRef<HTMLDivElement | null>(null)
    const hasBadge = !!badgeCode
    const headline =
        (badgeCode && SKIP_BADGE_HEADLINES[badgeCode]) || (hasBadge ? 'You skipped the line.' : NO_BADGE_HEADLINE)
    const subline = hasBadge
        ? 'You hold a badge that skips the closed-beta queue. Card’s yours.'
        : 'Welcome to the closed beta. Card’s yours.'

    useEffect(() => {
        // Only fire the skipped-BY-BADGE event when the user actually has one.
        // Non-badge unlocks (admin grant, waitlist roll-out) reach this screen
        // too — misclassifying them inflates the badge-funnel metric.
        if (badgeCode) {
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_SKIPPED_BY_BADGE, { badge_code: badgeCode })
        }
        const shakeAt = setTimeout(() => {
            setPhase('shaking')
            triggerHaptic()
        }, 600)
        const revealAt = setTimeout(() => {
            setPhase('revealed')
            shootDoubleStarConfetti()
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'celebration' })
        }, 1100)
        return () => {
            clearTimeout(shakeAt)
            clearTimeout(revealAt)
        }
    }, [badgeCode, triggerHaptic])

    const showAsset = phase === 'revealed' || phase === 'shaking'

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Welcome in" />

            <AnimatePresence mode="wait">
                {phase === 'looking-up' ? (
                    <motion.div
                        key="looking"
                        className="flex flex-col gap-2 text-center"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <h1 className="text-3xl font-extrabold text-n-1">Looking you up…</h1>
                        <p className="text-grey-1">Checking your badges.</p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="headline"
                        className="flex flex-col gap-2 text-center"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    >
                        <h1 className="text-3xl font-extrabold text-n-1">{headline}</h1>
                        <p className="text-grey-1">{subline}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stage: pixelated card hangs out at first (carrying over from the
                eligibility screen), then animates away while the share asset
                slides up into view. */}
            <div className={`relative mx-auto w-full max-w-2xl ${getShakeClass(phase === 'shaking', 'strong')}`}>
                <AnimatePresence>
                    {!showAsset && (
                        <motion.div
                            key="pixel-card"
                            className="mx-auto w-full max-w-sm"
                            initial={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92, y: -12 }}
                            transition={{ duration: 0.35, ease: 'easeIn' }}
                        >
                            <ScaledPixelatedCardFace last4="????" blurAll />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showAsset && (
                        <motion.div
                            key="share-asset"
                            initial={{ opacity: 0, y: 32, scale: 0.9 }}
                            animate={{
                                opacity: phase === 'revealed' ? 1 : 0.7,
                                y: 0,
                                scale: 1,
                            }}
                            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <ScaledShareAsset
                                ref={captureRef}
                                username={username ?? 'anon'}
                                badges={badges}
                                stats={stats}
                                tier={tier ?? 0}
                                pointsBalance={pointsBalance ?? 0}
                                cardLast4="0420"
                                hideUsername={hideUsername}
                                animate={phase === 'revealed'}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <motion.div
                className="mt-auto flex flex-col gap-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: phase === 'revealed' ? 1 : 0, y: phase === 'revealed' ? 0 : 12 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: phase === 'revealed' ? 0.1 : 0 }}
            >
                {/* Anti-dox toggle — hides the peanut.me/<handle> pill on the asset */}
                <Checkbox
                    className="self-center"
                    label="Hide username"
                    value={hideUsername}
                    onChange={(e) => setHideUsername(e.target.checked)}
                />
                <ShareAssetActions
                    captureRef={captureRef}
                    source="celebration"
                    shareText="I got my Peanut card. shhhh."
                />
                <Button onClick={onContinue} variant="stroke" className="w-full">
                    Continue to your card
                </Button>
            </motion.div>
        </div>
    )
}

export default BadgeSkipCelebration
