'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { captureMessage } from '@sentry/nextjs'
import type { ActionModalButtonProps, ActionModalTertiaryCta } from '@/components/Global/ActionModal'
import { AskShell } from '@/features/attention/AskShell'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useCardFundingAccess } from '@/hooks/useCardFundingAccess'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { fundingReturnCents, holdsCardApproval, useCardPaymentsUpdate } from '@/features/attention/cardFunding'
import type { AskSurfaceProps } from '@/features/attention/types'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Blocking modal shown when the user holds an ACTIVE Rain card without
 * the one-tap session-key grant. Without it auto-balance silently no-ops
 * after every deposit and the first card spend would force the grant
 * inline anyway — surfacing it up-front avoids both surprises.
 *
 * Only for an account on the existing card permission that new managed
 * funding is not open to (the server's decision, `setupPath === 'legacy'`).
 * An account it is open to, or one already managed, gets the managed setup
 * prompt instead; an unknown decision shows nothing.
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
 *
 * A card that already worked (an outdated approval on file, or card balance)
 * reads as a card payments update in every state; a new card reads as
 * finishing setup.
 */
export default function EnableAutoBalanceBanner({ onActed, onSnoozed, presentation }: AskSurfaceProps) {
    const t = useTranslations('home.fundingSetup')
    const tCommon = useTranslations('common')
    const { overview } = useRainCardOverview()
    const card = findActiveCard(overview)
    const { setupPath } = useCardFundingAccess({ enabled: card?.status === 'ACTIVE' })
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
    const isUpdate = useCardPaymentsUpdate(
        card?.id ?? null,
        // an approval this prompt just stored is the stuck shape below, not evidence of an older card
        (holdsCardApproval(card) && grantSucceededFor !== card?.id) || fundingReturnCents(overview) > 0
    )

    const shouldShow =
        setupPath === 'legacy' &&
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

    // Settled only when a fresh overview shows the approval on the card the grant was for;
    // an ok response alone is the stuck-after-success shape above.
    const approvedAfterGrant =
        !!card && grantSucceededFor === card.id && card.status === 'ACTIVE' && card.hasWithdrawApproval
    const actedRef = useRef<string | null>(null)
    useEffect(() => {
        if (!approvedAfterGrant || !card || actedRef.current === card.id) return
        actedRef.current = card.id
        onActed()
    }, [approvedAfterGrant, card, onActed])

    const ctas: ActionModalButtonProps[] = [
        {
            text: isGranting
                ? t('working')
                : hardError || stuckAfterSuccess
                  ? tCommon('tryAgain')
                  : tCommon('continue'),
            variant: 'primary',
            shadowSize: '4',
            disabled: isGranting,
            onClick: () => {
                if (isGranting) return
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
    const tertiaryCta: ActionModalTertiaryCta | undefined =
        errorForThisCard || stuckAfterSuccess
            ? {
                  text: tCommon('skipForNow'),
                  disabled: isGranting,
                  onClick: () => {
                      setDismissedFor(card?.id ?? null)
                      // the grant is re-prompted on the first card spend regardless
                      onSnoozed(Date.now() + DAY_MS)
                  },
              }
            : undefined

    const dismissed = dismissedFor !== null && dismissedFor === (card?.id ?? null)

    return (
        <AskShell
            presentation={presentation}
            visible={shouldShow && !dismissed}
            onClose={() => {}}
            dismissible={false}
            concept="card"
            title={t(isUpdate ? 'updateTitle' : 'title')}
            description={
                hardError && lastError!.kind === 'signature-rejected'
                    ? t('descriptionSignatureRejected')
                    : hardError || stuckAfterSuccess
                      ? t(isUpdate ? 'descriptionUpdateError' : 'descriptionError')
                      : t(isUpdate ? 'updateApprove' : 'description')
            }
            ctas={ctas}
            tertiaryCta={tertiaryCta}
        />
    )
}
