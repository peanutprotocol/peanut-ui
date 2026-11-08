'use client'

import ActivationCTAs from '@/components/Home/ActivationCTAs'
import { useAuth } from '@/context/authContext'
import { useHomeWelcome } from '@/features/home/useHomeWelcome'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import type { ZoneSurfaceProps } from '../../types'

/**
 * The getting-started checklist, or the one blocked card that replaces it
 * when a door is shut. The manager picks which: `blocked-card` draws the
 * card, `checklist` the list, so a hidden blocked card leaves the list.
 */
export default function ChecklistSurface({ askId, onDismissed }: ZoneSurfaceProps) {
    const { user, isFetchingUser } = useAuth()
    const { onboarding } = useActivationStatus()
    const userId = user?.user.userId
    const showWelcome = useHomeWelcome(
        userId,
        isFetchingUser && !user,
        onboarding.verify === 'done' || onboarding.addMoneyDone || onboarding.firstPaymentDone
    )
    return (
        <ActivationCTAs
            onboarding={onboarding}
            showWelcome={showWelcome}
            showBlockedCard={askId === 'blocked-card'}
            onHideBlockedCard={askId === 'blocked-card' ? onDismissed : undefined}
        />
    )
}
