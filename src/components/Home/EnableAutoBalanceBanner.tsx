'use client'

import { useState } from 'react'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

/**
 * Blocking modal shown when the user holds an ACTIVE Rain card without
 * the one-tap session-key grant. Without it auto-balance silently no-ops
 * after every deposit and the first card spend would force the grant
 * inline anyway — surfacing it up-front avoids both surprises.
 *
 * Same preconditions `useGrantSessionKey().grant()` enforces (collateral
 * proxy + coordinator already provisioned by Rain) — otherwise the
 * passkey tap would throw `no-contracts`.
 *
 * Blocking on the happy path (no close button, no backdrop dismiss); hides
 * itself once `grant()` succeeds and the overview refetch flips
 * `hasWithdrawApproval` to true. BUT: once a grant FAILS we surface the
 * error and add a "Skip for now" escape — a passkey can fail or be
 * cancelled (very common on iOS / 1Password), and a non-dismissible modal
 * whose CTA silently does nothing is a hard lockout. Skipping is safe: the
 * grant is re-prompted on the first card spend regardless.
 */
export default function EnableAutoBalanceBanner() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting, lastError } = useGrantSessionKey()
    const [dismissed, setDismissed] = useState(false)

    const card = overview?.cards?.[0]
    const shouldShow =
        card?.status === 'ACTIVE' &&
        !card.hasWithdrawApproval &&
        !!overview?.status?.contractAddress &&
        !!overview?.status?.coordinatorAddress

    // `user-cancelled` just means the passkey sheet was dismissed — not a real
    // error, the user simply taps Continue again. Any other failure gets a
    // recoverable message.
    const hardError = !!lastError && lastError.kind !== 'user-cancelled'

    const ctas: ActionModalButtonProps[] = [
        {
            text: isGranting ? 'Working…' : hardError ? 'Try again' : 'Continue',
            variant: 'purple',
            shadowSize: '4',
            disabled: isGranting,
            onClick: () => {
                void grant()
            },
        },
    ]
    // Escape hatch, shown only once a grant has failed, so the user is never
    // trapped behind this non-dismissible modal.
    if (lastError) {
        ctas.push({
            text: 'Skip for now',
            variant: 'stroke',
            disabled: isGranting,
            onClick: () => setDismissed(true),
        })
    }

    return (
        <ActionModal
            visible={shouldShow && !dismissed}
            onClose={() => {}}
            preventClose
            hideModalCloseButton
            icon="credit-card"
            iconContainerClassName="bg-yellow-1"
            title="Finish setting up your card"
            description={
                hardError
                    ? "We couldn't finish setting up your card. Please try again, or skip for now — we'll prompt you again on your first card payment."
                    : 'One passkey tap to start using your card.'
            }
            ctas={ctas}
        />
    )
}
