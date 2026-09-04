'use client'

import { useEffect, useMemo, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useRainCooldownOptional } from '@/context/RainCooldownContext'
import { computeCollateralPull } from '@/utils/collateralPull.utils'
import { useBalanceSplit } from './useBalanceSplit'

/**
 * Tells a review step, before the passkey, whether the amount being entered
 * will pull from the card balance — and whether the card's withdrawal lock is
 * still running (TASK-22293). Today the lock only surfaces as a 425 after the
 * tap; `RainCooldownContext` already knows `cooldownEndsAt`, this reads it
 * ahead of time. Captures one analytics event per notice appearance.
 */
export function useCollateralPullPreview(amountUsd: string | number | null | undefined) {
    const { hasActiveCard, offCardUnits, onCardCents } = useBalanceSplit()
    // Advisory only: no provider (a bare layout or a view test) reads as "no lock".
    const cooldownEndsAt = useRainCooldownOptional()?.cooldownEndsAt ?? null

    const pull = useMemo(
        () => (hasActiveCard ? computeCollateralPull({ amountUsd, offCardUnits, onCardCents }) : null),
        [hasActiveCard, amountUsd, offCardUnits, onCardCents]
    )
    const visible = !!pull?.pullsFromCard
    const lockActive = visible && cooldownEndsAt !== null && cooldownEndsAt > Date.now()

    const capturedRef = useRef(false)
    useEffect(() => {
        if (!visible) {
            capturedRef.current = false
            return
        }
        if (capturedRef.current) return
        capturedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.COLLATERAL_PULL_NOTICE_SHOWN, {
            from_card_cents: pull?.fromCardCents ?? 0,
            lock_active: lockActive,
        })
    }, [visible, lockActive, pull?.fromCardCents])

    return {
        visible,
        fromCardCents: pull?.fromCardCents ?? 0,
        cooldownEndsAt: lockActive ? cooldownEndsAt : null,
    }
}
