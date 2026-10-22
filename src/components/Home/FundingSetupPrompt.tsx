'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal, { type ActionModalButtonProps, type ActionModalTertiaryCta } from '@/components/Global/ActionModal'
import CardFundingConsent from '@/components/Card/CardFundingConsent'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'
import { isRainBalanceKnown } from '@/utils/balance.utils'

/** Matches the hook's polling window for a pending grant (useRainFunding). */
const PENDING_WAIT_MS = 60_000

/**
 * The Home prompt for an existing cardholder whose card funding permission is
 * not in place: a centered modal with the plain description of the permission
 * and an unchecked authorization checkbox. Continue stays off until it is
 * ticked; consent is never implied and the old card checklist is not asked
 * again.
 *
 * It shows only while the BACKEND says the permission is missing (`required`,
 * `migration_required`) or accepted but not yet confirmed on chain
 * (`pending`). It never reads an allowance, and a funding state that could not
 * be read shows nothing: unknown is not "missing".
 *
 * Blocking on the happy path (no close button, no backdrop dismiss). It closes
 * onto Home by itself once the backend reports the permission ready. A passkey
 * can fail or be cancelled (very common on iOS / 1Password), so after a
 * cancelled or failed attempt a "Skip for now" escape appears; it also appears
 * for a pending grant once the polling window has passed. Skipping is local: it grants
 * nothing, forgets nothing in flight (the hook keeps polling and the grant
 * keeps running), and the prompt returns on the next Home visit.
 *
 * A legacy user confirms twice (the old permission is retired first). Card
 * balance moves back to the wallet only after the backend confirms the new
 * permission ready, which adds confirmations; the copy says so instead of
 * promising one tap. If ready comes after the attempt ended, or the move did
 * not finish, the dialog stays with one explicit "Move card balance to wallet"
 * step (funding is not touched again). A card withdrawal still confirming
 * keeps this dialog as a wait, never as done.
 *
 * The card this modal keys off MUST be `findActiveCard(overview)`, never
 * `cards[0]`: in the 2026-07-02 duplicate-card incident `cards[0]` was a bare
 * duplicate. All the "have we been here" state (skip dismissal, error scope) is
 * keyed by card id, so a later re-issued card gets its own clean pass.
 */
export default function FundingSetupPrompt() {
    const t = useTranslations('home.fundingSetup')
    const tFunding = useTranslations('card.funding')
    const tCard = useTranslations('card.yourCard')
    const tCommon = useTranslations('common')
    const { overview } = useRainCardOverview()
    const card = findActiveCard(overview)
    const hasActiveCard = card?.status === 'ACTIVE'
    const {
        funding,
        status,
        needsGrant,
        isMigration,
        isPending,
        isWithdrawalInFlight,
        grant,
        recheck,
        isSubmitting,
        step,
        lastError,
        owesReturn,
        returnError,
        continueSetup,
    } = useRainFunding({ enabled: hasActiveCard })
    // Card id the user chose "Skip for now" for — per card, so skipping a
    // stuck card A never suppresses the prompt for a different card B that
    // legitimately needs its own setup later in the same session.
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    // Card id of the last grant attempt that RESOLVED (ok or failed). Gates
    // `lastError` below: the hook's error state isn't card-scoped, so without
    // this a failure on card A would leak "Try again" copy and the escape
    // hatch into a re-issued card B's first-ever prompt.
    const [lastAttemptFor, setLastAttemptFor] = useState<string | null>(null)
    const [authorizationAccepted, setAuthorizationAccepted] = useState(false)

    const cardId = card?.id ?? null
    // A new card starts unticked: consent is per prompt, never carried over.
    useEffect(() => {
        setAuthorizationAccepted(false)
    }, [cardId])
    // Terms that changed under the person invalidate what they ticked.
    const termsChanged = lastError?.kind === 'terms-changed'
    useEffect(() => {
        if (!termsChanged) return
        setAuthorizationAccepted(false)
    }, [termsChanged])

    // `needsGrant` is false for a retired permission: that needs internal
    // support and never a prompt the person cannot complete.
    // A grant that ended as retired or paused also ends the prompt: the person
    // can do nothing more, and it is never offered again.
    const endedForGood = lastError?.kind === 'scope-retired' || lastError?.kind === 'unavailable'

    // Card balance the provider can release moves back to the wallet once
    // funding is confirmed ready, which can take more than one confirmation. An
    // unreadable balance shows the usual copy; the return itself reads fresh.
    const returnCents =
        isRainBalanceKnown(overview) && !overview?.balanceUnavailable && overview?.balance
            ? Math.max(0, Math.floor(overview.balance.spendingPower))
            : 0
    // Funding is ready and the setup started here still owes that move: one
    // explicit step (a tap, never a render), and funding stays as it is.
    const finishingReturn = owesReturn && status === 'ready' && (returnCents > 0 || !!returnError)

    // A card withdrawal still confirming is unfinished setup, never done.
    const shouldShow =
        hasActiveCard && !endedForGood && (needsGrant === true || isPending || isWithdrawalInFlight || finishingReturn)

    // Only honor the hook's error if the attempt it came from was for THIS
    // card. `lastAttemptFor === null` (error with no recorded attempt) can't
    // occur in real flows but defaults to honoring the error — an unearned
    // escape beats an unearned trap.
    const errorForThisCard = !!lastError && (lastAttemptFor === null || lastAttemptFor === cardId)

    // `user-cancelled` just means the passkey sheet was dismissed — not a real
    // error, the user simply taps Continue again. Any other failure gets a
    // recoverable message. A withdrawal still confirming is shown as a wait.
    const hardError =
        errorForThisCard && lastError!.kind !== 'user-cancelled' && lastError!.kind !== 'withdrawal-in-flight'

    const authorizationText = funding?.permission.authorizationText ?? ''

    // While the hook polls a pending grant or a card withdrawal still
    // confirming, show the wait as the button's "Working…" state. Check status
    // and Skip appear only after the window. The window restarts per card.
    const waiting = isPending || isWithdrawalInFlight
    const [pendingTimedOut, setPendingTimedOut] = useState(false)
    useEffect(() => {
        setPendingTimedOut(false)
        if (!waiting) return
        const timer = setTimeout(() => setPendingTimedOut(true), PENDING_WAIT_MS)
        return () => clearTimeout(timer)
    }, [waiting, cardId])
    const stalled = waiting && pendingTimedOut
    const busy = isSubmitting || (waiting && !pendingTimedOut)

    const onContinue = () => {
        if (busy || !authorizationAccepted) return
        void grant({ authorizationAccepted, authorizationText }).then(() => setLastAttemptFor(cardId))
    }

    const returnRetryable = !!returnError && returnError.kind !== 'user-cancelled'

    const ctas: ActionModalButtonProps[] = [
        finishingReturn
            ? {
                  text: isSubmitting
                      ? step === 'returning-balance'
                          ? t('returningBalance')
                          : t('working')
                      : returnRetryable
                        ? tCommon('tryAgain')
                        : tCard('moveToWallet'),
                  variant: 'primary',
                  shadowSize: '4',
                  disabled: isSubmitting,
                  onClick: () => void continueSetup(),
              }
            : stalled
              ? {
                    text: t('checkStatus'),
                    variant: 'primary',
                    shadowSize: '4',
                    onClick: () => void recheck(),
                }
              : {
                    text: busy
                        ? isSubmitting && step === 'updating-permission'
                            ? t('confirmUpdate')
                            : isSubmitting && step === 'returning-balance'
                              ? t('returningBalance')
                              : t('working')
                        : hardError
                          ? tCommon('tryAgain')
                          : tCommon('continue'),
                    variant: 'primary',
                    shadowSize: '4',
                    disabled: busy || !authorizationAccepted,
                    onClick: onContinue,
                },
    ]
    // Escape hatch after a failure or a stalled wait, so the non-dismissible
    // modal never traps the user.
    const tertiaryCta: ActionModalTertiaryCta | undefined =
        finishingReturn || errorForThisCard || stalled
            ? {
                  text: tCommon('skipForNow'),
                  disabled: busy,
                  onClick: () => setDismissedFor(cardId),
              }
            : undefined

    const dismissed = dismissedFor !== null && dismissedFor === cardId

    const amount = `$${(returnCents / 100).toFixed(2)}`
    const failureDescription = (error: typeof lastError, fallback: string) =>
        error?.kind === 'return-pending'
            ? t('descriptionReturnPending')
            : error?.kind === 'return-wait'
              ? t('descriptionReturnWait')
              : error?.kind === 'balance-unavailable'
                ? t('descriptionBalanceUnavailable')
                : fallback

    const description = finishingReturn
        ? returnRetryable
            ? failureDescription(returnError, t('descriptionReturnRetry'))
            : t('descriptionReadyReturn', { amount })
        : isWithdrawalInFlight
          ? t('descriptionWithdrawalInFlight')
          : stalled
            ? t('descriptionPending')
            : termsChanged
              ? tFunding('termsChanged')
              : hardError
                ? failureDescription(lastError, t('descriptionError'))
                : returnCents > 0
                  ? t('descriptionReturn', { amount })
                  : isMigration
                    ? t('descriptionMigration')
                    : t('description')

    return (
        <ActionModal
            visible={shouldShow && !dismissed}
            onClose={() => {}}
            preventClose
            hideModalCloseButton
            concept="card"
            title={t('title')}
            description={description}
            content={
                // The move after setup needs no new consent: nothing is granted.
                stalled || finishingReturn ? undefined : (
                    <CardFundingConsent
                        authorizationText={authorizationText}
                        showDisclosure
                        authorizationAccepted={authorizationAccepted}
                        onAuthorizationChange={setAuthorizationAccepted}
                        disabled={busy}
                    />
                )
            }
            contentContainerClassName="max-h-[85dvh] overflow-y-auto"
            ctas={ctas}
            tertiaryCta={tertiaryCta}
        />
    )
}
