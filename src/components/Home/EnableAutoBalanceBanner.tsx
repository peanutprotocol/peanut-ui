'use client'

import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { findActiveCard } from '@/components/Card/cardState.utils'
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
 *
 * The card this modal keys off MUST be `findActiveCard(overview)`, never
 * `cards[0]`: in the 2026-07-02 duplicate-card incident `cards[0]` was a
 * bare duplicate while the grant landed on the other card — every tap
 * "succeeded" and the modal never dismissed. As a second belt: if a grant
 * reports success but the flag still hasn't flipped, we surface the escape
 * anyway and page Sentry — a non-dismissible modal must never depend on a
 * distributed flag flipping.
 */
export default function EnableAutoBalanceBanner() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting, lastError } = useGrantSessionKey()
    const [dismissed, setDismissed] = useState(false)
    const [grantSucceeded, setGrantSucceeded] = useState(false)

    const card = findActiveCard(overview)
    const shouldShow =
        card?.status === 'ACTIVE' &&
        !card.hasWithdrawApproval &&
        !!overview?.status?.contractAddress &&
        !!overview?.status?.coordinatorAddress

    // `user-cancelled` just means the passkey sheet was dismissed — not a real
    // error, the user simply taps Continue again. Any other failure gets a
    // recoverable message.
    const hardError = !!lastError && lastError.kind !== 'user-cancelled'

    // Loop signal: grant() resolved ok (which includes the overview refetch),
    // yet the active card still lacks the approval. That is the dup-card
    // lockout shape — warn once and treat it like a failure so the escape
    // hatch renders.
    const stuckAfterSuccess = grantSucceeded && shouldShow
    const warnedRef = useRef(false)
    useEffect(() => {
        if (stuckAfterSuccess && !warnedRef.current) {
            warnedRef.current = true
            console.warn(
                '[EnableAutoBalanceBanner] grant succeeded but the active card still lacks hasWithdrawApproval — duplicate-card lockout shape'
            )
            Sentry.captureMessage('card session-key grant succeeded but hasWithdrawApproval never flipped', {
                level: 'error',
                extra: { cardId: card?.id },
            })
        }
    }, [stuckAfterSuccess, card?.id])

    const ctas: ActionModalButtonProps[] = [
        {
            text: isGranting ? 'Working…' : hardError ? 'Try again' : 'Continue',
            variant: 'purple',
            shadowSize: '4',
            disabled: isGranting,
            onClick: () => {
                void grant().then((result) => {
                    if (result.ok) setGrantSucceeded(true)
                })
            },
        },
    ]
    // Escape hatch, shown once a grant has failed — or "succeeded" without
    // clearing the modal — so the user is never trapped behind this
    // non-dismissible modal.
    if (lastError || stuckAfterSuccess) {
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
