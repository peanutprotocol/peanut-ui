'use client'

import { useEffect, useRef, useState } from 'react'
import { captureMessage } from '@sentry/nextjs'
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
 * reports success (with a FRESH overview — a failed refetch is just a stale
 * flag, not a lockout) and the flag still hasn't flipped for the SAME card,
 * we surface the escape anyway, explain the failure, and page Sentry — a
 * non-dismissible modal must never depend on a distributed flag flipping.
 * All the "have we been here" state (grant success, skip dismissal, Sentry
 * dedupe) is keyed by card id, so a later re-issued card always gets its
 * own clean setup pass.
 */
export default function EnableAutoBalanceBanner() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting, lastError } = useGrantSessionKey()
    // Card id the user chose "Skip for now" for — per card, so skipping a
    // stuck card A never suppresses the prompt for a different card B that
    // legitimately needs its own setup later in the same session.
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    // Card id the last SUCCESSFUL grant (with a fresh overview) was tapped
    // for — keyed by identity so a later re-issued card never inherits the
    // stuck signal from an old card's grant.
    const [grantSucceededFor, setGrantSucceededFor] = useState<string | null>(null)
    // Card id of the last grant attempt that RESOLVED (ok or failed). Gates
    // `lastError` below: the hook's error state isn't card-scoped, so without
    // this a failure on card A would leak "Try again" copy and the escape
    // hatch into a re-issued card B's first-ever prompt.
    const [lastAttemptFor, setLastAttemptFor] = useState<string | null>(null)

    const card = findActiveCard(overview)
    const shouldShow =
        card?.status === 'ACTIVE' &&
        !card.hasWithdrawApproval &&
        !!overview?.status?.contractAddress &&
        !!overview?.status?.coordinatorAddress

    // Only honor the hook's error if the attempt it came from was for THIS
    // card. `lastAttemptFor === null` (error with no recorded attempt) can't
    // occur in real flows but defaults to honoring the error — an unearned
    // escape beats an unearned trap.
    const errorForThisCard = !!lastError && (lastAttemptFor === null || lastAttemptFor === card?.id)

    // `user-cancelled` just means the passkey sheet was dismissed — not a real
    // error, the user simply taps Continue again. Any other failure gets a
    // recoverable message.
    const hardError = errorForThisCard && lastError!.kind !== 'user-cancelled'

    // Loop signal: grant() resolved ok with a FRESH overview, yet the SAME
    // card still lacks the approval. That is the dup-card lockout shape —
    // warn once per card and treat it like a failure so the escape hatch
    // renders with an explanation.
    const stuckAfterSuccess = !!card && grantSucceededFor !== null && grantSucceededFor === card.id && shouldShow
    // Set of card ids already warned for — a plain "last id" ref would
    // re-page Sentry when the active card alternates (A → B → A) during
    // remediation.
    const warnedCardsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (stuckAfterSuccess && card && !warnedCardsRef.current.has(card.id)) {
            warnedCardsRef.current.add(card.id)
            console.warn(
                '[EnableAutoBalanceBanner] grant succeeded but the active card still lacks hasWithdrawApproval — duplicate-card lockout shape'
            )
            captureMessage('card session-key grant succeeded but hasWithdrawApproval never flipped', {
                level: 'error',
                extra: { cardId: card.id },
            })
        }
    }, [stuckAfterSuccess, card])

    const ctas: ActionModalButtonProps[] = [
        {
            text: isGranting ? 'Working…' : hardError || stuckAfterSuccess ? 'Try again' : 'Continue',
            variant: 'purple',
            shadowSize: '4',
            disabled: isGranting,
            onClick: () => {
                const grantedCardId = card?.id ?? null
                void grant().then((result) => {
                    setLastAttemptFor(grantedCardId)
                    // A failed refetch means the flag is merely STALE, not
                    // stuck — treating it as success would fire a false
                    // Sentry page on any flaky connection.
                    if (result.ok && result.overviewFresh) setGrantSucceededFor(grantedCardId)
                })
            },
        },
    ]
    // Escape hatch, shown once a grant has failed — or "succeeded" without
    // clearing the modal — so the user is never trapped behind this
    // non-dismissible modal.
    if (errorForThisCard || stuckAfterSuccess) {
        ctas.push({
            text: 'Skip for now',
            variant: 'stroke',
            disabled: isGranting,
            onClick: () => setDismissedFor(card?.id ?? null),
        })
    }

    const dismissed = dismissedFor !== null && dismissedFor === (card?.id ?? null)

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
                hardError || stuckAfterSuccess
                    ? "We couldn't finish setting up your card. Please try again, or skip for now — we'll prompt you again on your first card payment."
                    : 'One passkey tap to start using your card.'
            }
            ctas={ctas}
        />
    )
}
