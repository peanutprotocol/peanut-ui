'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal, { type ActionModalButtonProps, type ActionModalTertiaryCta } from '@/components/Global/ActionModal'
import CardFundingConsent from '@/components/Card/CardFundingConsent'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'

/**
 * The Home prompt for an existing cardholder whose card funding permission is
 * not in place: a centered modal with the plain description of the permission
 * and two explicit, unchecked boxes. Continue stays off until both are ticked;
 * consent is never implied and the old card checklist is not asked again.
 *
 * It shows only while the BACKEND says the permission is missing (`required`,
 * `migration_required`) or accepted but not yet confirmed on chain
 * (`pending`). It never reads an allowance, and a funding state that could not
 * be read shows nothing: unknown is not "missing".
 *
 * Blocking on the happy path (no close button, no backdrop dismiss). It closes
 * onto Home by itself once the backend reports the permission ready. A passkey
 * can fail or be cancelled (very common on iOS / 1Password), so after a
 * cancelled or failed attempt a "Skip for now" escape appears; the same escape
 * shows while a grant waits for confirmation. Skipping is local: it grants
 * nothing, forgets nothing in flight (the hook keeps polling and the grant
 * keeps running), and the prompt returns on the next Home visit.
 *
 * A legacy user confirms twice (the old permission is retired first), and the
 * copy says so instead of promising one tap.
 *
 * The card this modal keys off MUST be `findActiveCard(overview)`, never
 * `cards[0]`: in the 2026-07-02 duplicate-card incident `cards[0]` was a bare
 * duplicate. All the "have we been here" state (skip dismissal, error scope) is
 * keyed by card id, so a later re-issued card gets its own clean pass.
 */
export default function EnableAutoBalanceBanner() {
    const t = useTranslations('home.autoBalance')
    const tFunding = useTranslations('card.funding')
    const tCommon = useTranslations('common')
    const { overview } = useRainCardOverview()
    const card = findActiveCard(overview)
    const hasActiveCard = card?.status === 'ACTIVE'
    const { funding, needsGrant, isMigration, isPending, grant, recheck, isSubmitting, step, lastError } =
        useRainFunding({ enabled: hasActiveCard })
    // Card id the user chose "Skip for now" for — per card, so skipping a
    // stuck card A never suppresses the prompt for a different card B that
    // legitimately needs its own setup later in the same session.
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    // Card id of the last grant attempt that RESOLVED (ok or failed). Gates
    // `lastError` below: the hook's error state isn't card-scoped, so without
    // this a failure on card A would leak "Try again" copy and the escape
    // hatch into a re-issued card B's first-ever prompt.
    const [lastAttemptFor, setLastAttemptFor] = useState<string | null>(null)
    const [managementAccepted, setManagementAccepted] = useState(false)
    const [authorizationAccepted, setAuthorizationAccepted] = useState(false)

    const cardId = card?.id ?? null
    // A new card starts unticked: consent is per prompt, never carried over.
    useEffect(() => {
        setManagementAccepted(false)
        setAuthorizationAccepted(false)
    }, [cardId])
    // Terms that changed under the person invalidate what they ticked.
    const termsChanged = lastError?.kind === 'terms-changed'
    useEffect(() => {
        if (!termsChanged) return
        setManagementAccepted(false)
        setAuthorizationAccepted(false)
    }, [termsChanged])

    // `needsGrant` is false for a retired permission: that needs internal
    // support and never a prompt the person cannot complete.
    // A grant that ended as retired or paused also ends the prompt: the person
    // can do nothing more, and it is never offered again.
    const endedForGood = lastError?.kind === 'scope-retired' || lastError?.kind === 'unavailable'
    const shouldShow = hasActiveCard && !endedForGood && (needsGrant === true || isPending)

    // Only honor the hook's error if the attempt it came from was for THIS
    // card. `lastAttemptFor === null` (error with no recorded attempt) can't
    // occur in real flows but defaults to honoring the error — an unearned
    // escape beats an unearned trap.
    const errorForThisCard = !!lastError && (lastAttemptFor === null || lastAttemptFor === cardId)

    // `user-cancelled` just means the passkey sheet was dismissed — not a real
    // error, the user simply taps Continue again. Any other failure gets a
    // recoverable message.
    const hardError = errorForThisCard && lastError!.kind !== 'user-cancelled'

    const authorizationText = funding?.permission.authorizationText ?? ''
    const consentGiven = managementAccepted && authorizationAccepted

    const onContinue = () => {
        if (isSubmitting || !consentGiven) return
        void grant({ managementAccepted, authorizationAccepted, authorizationText }).then(() =>
            setLastAttemptFor(cardId)
        )
    }

    const ctas: ActionModalButtonProps[] = [
        isPending
            ? {
                  text: t('checkStatus'),
                  variant: 'primary',
                  shadowSize: '4',
                  onClick: () => void recheck(),
              }
            : {
                  text: isSubmitting
                      ? step === 'updating-permission'
                          ? t('confirmUpdate')
                          : t('working')
                      : hardError
                        ? tCommon('tryAgain')
                        : tCommon('continue'),
                  variant: 'primary',
                  shadowSize: '4',
                  disabled: isSubmitting || !consentGiven,
                  onClick: onContinue,
              },
    ]
    // Escape hatch, shown once a grant has failed, and while one waits for
    // confirmation, so the user is never trapped behind this non-dismissible
    // modal.
    const tertiaryCta: ActionModalTertiaryCta | undefined =
        errorForThisCard || isPending
            ? {
                  text: tCommon('skipForNow'),
                  disabled: isSubmitting,
                  onClick: () => setDismissedFor(cardId),
              }
            : undefined

    const dismissed = dismissedFor !== null && dismissedFor === cardId

    const description = isPending
        ? t('descriptionPending')
        : termsChanged
          ? tFunding('termsChanged')
          : hardError
            ? t('descriptionError')
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
                isPending ? undefined : (
                    <CardFundingConsent
                        authorizationText={authorizationText}
                        managementAccepted={managementAccepted}
                        authorizationAccepted={authorizationAccepted}
                        onManagementChange={setManagementAccepted}
                        onAuthorizationChange={setAuthorizationAccepted}
                        disabled={isSubmitting}
                    />
                )
            }
            contentContainerClassName="max-h-[85dvh] overflow-y-auto"
            ctas={ctas}
            tertiaryCta={tertiaryCta}
        />
    )
}
