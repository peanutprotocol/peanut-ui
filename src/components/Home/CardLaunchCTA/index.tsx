'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useAuth } from '@/context/authContext'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import CardLaunchCTABanner from './CardLaunchCTABanner'
import { dismissCardLaunchCTA, isCardLaunchCTADismissed } from './cardLaunchCTA.utils'

/**
 * Home launch CTA for the Peanut Card public launch (2026-06-29).
 *
 * Self-gating once `isPublicLaunched` flips. Audience = the active base who
 * could plausibly want a card and haven't engaged yet: ACTIVATED users who are
 * geo-eligible, have no active card, and aren't already on the waitlist (and
 * haven't dismissed/clicked it). Non-activated users are left to the activation
 * funnel; on-waitlist / card-holding / ineligible users are excluded so the
 * "find out if you're in" tap never dead-ends.
 *
 * Gates on `/card`'s `isPublicLaunched` — NOT `hasCardAccess` (the inner gate
 * that excludes most users). The point is to drive the eligible base to /card to
 * "test if they can get their card"; /card itself does the final eligibility gate.
 *
 * Dismissal is permanent (localStorage flag, no cooldown): clicking through OR
 * closing the X both hide it forever.
 */
export default function CardLaunchCTA() {
    const router = useRouter()
    const { user } = useAuth()
    const { isPublicLaunched, isEligible, cardInfo, isLoading } = useCardInfo()
    const { overview } = useRainCardOverview()
    const { isActivated } = useActivationStatus()

    // Read the permanent dismissal after mount to avoid a hydration mismatch —
    // localStorage is client-only. Mirrors useActivationStatus.dismissCardStep.
    const [dismissed, setDismissed] = useState(false)
    useEffect(() => {
        setDismissed(isCardLaunchCTADismissed())
    }, [])

    const hasActiveCard = !!findActiveCard(overview)
    const isOnWaitlist = !!cardInfo?.waitlistJoinedAt
    // Audience (per Hugo): the launch splash targets the active base who haven't engaged
    // with the card yet. Activated-only (non-activated users have the activation funnel);
    // exclude anyone who already has a card or already joined the waitlist; skip geo-
    // ineligible users so the "find out if you're in" tap never dead-ends on "not your country".
    const visible =
        !!user &&
        !isLoading &&
        isPublicLaunched === true &&
        isActivated &&
        isEligible === true &&
        !hasActiveCard &&
        !isOnWaitlist &&
        !dismissed &&
        !underMaintenanceConfig.disableCardPioneers

    // Fire "viewed" exactly once, when the banner first becomes visible.
    const viewedRef = useRef(false)
    useEffect(() => {
        if (visible && !viewedRef.current) {
            viewedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.CARD_LAUNCH_CTA_VIEWED)
        }
    }, [visible])

    if (!visible) return null

    const handleTryDoor = () => {
        dismissCardLaunchCTA()
        setDismissed(true)
        posthog.capture(ANALYTICS_EVENTS.CARD_LAUNCH_CTA_CLICKED)
        router.push('/card')
    }

    const handleDismiss = () => {
        dismissCardLaunchCTA()
        setDismissed(true)
        posthog.capture(ANALYTICS_EVENTS.CARD_LAUNCH_CTA_DISMISSED)
    }

    return <CardLaunchCTABanner onTryDoor={handleTryDoor} onDismiss={handleDismiss} />
}
