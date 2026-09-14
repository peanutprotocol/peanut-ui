'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { perksApi, type PendingPerk } from '@/services/perks'
import { extractInviteeName } from '@/utils/general.utils'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { notifyHaptic } from '@/utils/haptics'
import { getUserPreferences } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { ClaimPhase } from './perkClaim.types'
import { SURPRISE_CLAIM_COUNT_KEY } from './perkClaim.consts'

interface UsePerkClaimFlowArgs {
    perk: PendingPerk
    visible: boolean
    onClose: () => void
    onClaimed: (perkId: string) => void
}

/**
 * State machine for the perk claim modal: idle → opening → revealed → exiting.
 * Owns the optimistic claim (animation first, API in background), the reveal
 * and dismiss timers, and the phase-aware close handling.
 */
export function usePerkClaimFlow({ perk, visible, onClose, onClaimed }: UsePerkClaimFlowArgs) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const [claimPhase, setClaimPhase] = useState<ClaimPhase>('idle')
    const [lastClaimedPerk, setLastClaimedPerk] = useState<PendingPerk | null>(null)
    const apiCallRef = useRef<Promise<void> | null>(null)
    const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        }
    }, [])

    // Reset state when modal opens with new perk
    useEffect(() => {
        if (visible) {
            setClaimPhase('idle')
            setLastClaimedPerk(null)

            const eventProps = { amount_usd: perk.amountUsd, perk_name: perk.name }
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_SHOWN, eventProps)

            // Read claim count from user prefs to determine if this is a surprise moment
            const userId = user?.user.userId ?? ''
            const claimCount = getUserPreferences(userId)?.[SURPRISE_CLAIM_COUNT_KEY] ?? 0
            if (claimCount < 2) {
                posthog.capture(ANALYTICS_EVENTS.SURPRISE_MOMENT_SHOWN, {
                    ...eventProps,
                    claim_number: claimCount + 1,
                })
            }
        }
        // perk props and user are stable while modal is open — deps kept minimal to fire once per open
    }, [visible, perk.id, perk.amountUsd, perk.name, user?.user.userId])

    // Optimistic claim: trigger animation immediately, API call in background
    const handleHoldComplete = useCallback(async () => {
        // Phase 1: Opening animation (gift shakes on its own, builds anticipation)
        setClaimPhase('opening')

        // Fire API call in background - don't await it
        apiCallRef.current = (async () => {
            try {
                const result = await perksApi.claimPerk(perk.id)
                if (result.success) {
                    posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIMED, {
                        amount_usd: perk.amountUsd,
                        perk_name: perk.name,
                        invitee_name: perk.inviteeName ?? extractInviteeName(perk.reason),
                    })
                    onClaimed(perk.id)
                    queryClient.invalidateQueries({ queryKey: ['pendingPerks'] })
                    queryClient.invalidateQueries({ queryKey: ['transactions'] })
                }
            } catch (error) {
                console.error('Failed to claim perk:', error)
            }
        })()

        // Phase 2: After 600ms of autonomous shaking, burst into confetti
        revealTimerRef.current = setTimeout(() => {
            // Haptic burst feedback
            notifyHaptic('success')

            // Confetti explosion!
            shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })

            // Phase 3: Show revealed state
            setLastClaimedPerk(perk)
            setClaimPhase('revealed')
        }, 600)
    }, [perk, queryClient, onClaimed])

    // Handle dismissing the success message
    const handleDismissSuccess = useCallback(() => {
        setClaimPhase('exiting')
        dismissTimerRef.current = setTimeout(() => {
            onClose()
        }, 400)
    }, [onClose])

    // Handle modal close based on current phase
    const handleModalClose = useCallback(() => {
        if (claimPhase === 'revealed') {
            handleDismissSuccess()
        } else if (claimPhase === 'idle') {
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_DISMISSED, {
                amount_usd: perk.amountUsd,
                perk_name: perk.name,
            })
            onClose()
        }
        // Don't allow closing during opening/exiting phases
    }, [claimPhase, handleDismissSuccess, onClose, perk])

    const isSuccessPhase = (claimPhase === 'revealed' || claimPhase === 'exiting') && !!lastClaimedPerk

    return {
        claimPhase,
        lastClaimedPerk,
        isSuccessPhase,
        handleHoldComplete,
        handleDismissSuccess,
        handleModalClose,
    }
}
