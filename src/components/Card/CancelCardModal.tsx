'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Field } from '@/components/0_Bruddle/Field'
import ActionModal from '@/components/Global/ActionModal'
import { Callout } from '@/components/0_Bruddle/Callout'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'

type Phase = 'confirm' | 'canceling' | 'revoke' | 'revoking' | 'feedback' | 'submitting-feedback' | 'thanks'

interface Props {
    cardId: string
    isOpen: boolean
    onClose: () => void
}

const CancelCardModal: FC<Props> = ({ cardId, isOpen, onClose }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const [phase, setPhase] = useState<Phase>('confirm')
    const [feedback, setFeedback] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [canceled, setCanceled] = useState(false)
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const { funding, revoke } = useRainFunding({ enabled: isOpen })

    // Rain's operator allowance is per wallet, not per card, so removing it
    // would stop every other card too. Offer it only on a FRESH card list that
    // shows no other non-cancelled card — a failed or stale read means "do not
    // offer". Read outside react-query: refreshing the cached overview here
    // would unmount this modal (see handleClose).
    const shouldOfferRevoke = async (): Promise<boolean> => {
        if (funding?.allowance === '0') return false
        try {
            const fresh = await rainApi.getOverview()
            return !fresh.cards.some((c) => c.id !== cardId && c.status !== 'CANCELED')
        } catch {
            return false
        }
    }

    useEffect(() => {
        if (!isOpen) {
            // Reset so reopening after dismiss starts fresh.
            setPhase('confirm')
            setFeedback('')
            setError(null)
            setCanceled(false)
        }
    }, [isOpen])

    // Invalidating the overview query *during* the cancel flow would unmount
    // YourCardScreen (the state machine flips away from 'active'), taking
    // this modal with it — user would never see the feedback phase. Defer
    // the invalidation until the modal is actually closed.
    const handleClose = () => {
        if (canceled) {
            void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
        }
        onClose()
    }

    const runCancel = async () => {
        setPhase('canceling')
        setError(null)
        try {
            // An unloaded overview reads as zero spending power below, which
            // would skip the withdrawal and get the cancel rejected by the
            // backend ("Withdrawal signature required"). Fail closed instead.
            if (!overview) {
                throw new Error(t('errors.cardDetailsLoading'))
            }
            // Cancel can be terminal on Rain's side (collateral contract may
            // become unreachable), so we MUST drain it BEFORE the cancel.
            // Backend enforces order — this just delivers the signed body.
            const spendingPowerUnits = rainCentsToUsdcUnits(overview?.balance?.spendingPower)
            let verifiedWithdrawal: import('@/hooks/wallet/useSignSpendBundle').SignedRainWithdrawal | undefined
            if (spendingPowerUnits > 0n) {
                if (!smartWalletAddress) {
                    throw new Error(t('errors.walletNotReady'))
                }
                // Force collateral-only routing — same pattern as LockCardModal.
                const artifact = await signSpend({
                    requiredUsdcAmount: spendingPowerUnits,
                    recipient: smartWalletAddress as `0x${string}`,
                    rainSpendingPower: spendingPowerUnits,
                    kind: 'CRYPTO_WITHDRAW',
                    forceStrategy: 'collateral-only',
                })
                if (artifact.strategy !== 'collateral-only') {
                    throw new Error(t('errors.unexpectedStrategy'))
                }
                verifiedWithdrawal = artifact.rainWithdrawal
            }
            // No draft back-out on a cancelCard throw: execution-ambiguous —
            // the probe-verified TTL sweep owns cleanup (TASK-21815 review).
            await rainApi.cancelCard(cardId, { verifiedWithdrawal })
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_CONFIRMED)
            setCanceled(true)
            // The card is already cancelled. Removing Rain's permission is a
            // separate, optional onchain step — it can never undo the cancel.
            setPhase((await shouldOfferRevoke()) ? 'revoke' : 'feedback')
        } catch (e) {
            let message = e instanceof Error ? e.message : t('cancel.failed')
            if (e instanceof InsufficientSpendableError) {
                message = t('errors.balanceReturnFailed')
            } else if (e instanceof SessionKeyGrantRequiredError) {
                message = t('errors.authorizationFailed')
            }
            setError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FAILED, { error_message: message })
            setPhase('confirm')
        }
    }

    const runRevoke = async () => {
        setPhase('revoking')
        setError(null)
        // A replacement card may have been issued while this step was open.
        if (!(await shouldOfferRevoke())) {
            setPhase('feedback')
            return
        }
        const result = await revoke()
        if (result.ok) {
            setPhase('feedback')
            return
        }
        setError(t('funding.revokeFailed'))
        setPhase('revoke')
    }

    const submitFeedback = async () => {
        const trimmed = feedback.trim()
        if (!trimmed) {
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FEEDBACK_SUBMITTED, {
                gave_feedback: false,
                feedback_length: 0,
            })
            setPhase('thanks')
            return
        }
        setPhase('submitting-feedback')
        setError(null)
        try {
            await rainApi.submitCancellationFeedback(cardId, trimmed)
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FEEDBACK_SUBMITTED, {
                gave_feedback: true,
                feedback_length: trimmed.length,
            })
            setPhase('thanks')
        } catch (e) {
            // Non-fatal: cancel already succeeded, so show thanks and log the feedback failure.
            console.warn('[CancelCardModal] feedback submit failed:', e)
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FEEDBACK_SUBMITTED, {
                gave_feedback: true,
                feedback_length: trimmed.length,
                feedback_submit_failed: true,
            })
            setPhase('thanks')
        }
    }

    const isConfirm = phase === 'confirm' || phase === 'canceling'
    const isRevoke = phase === 'revoke' || phase === 'revoking'
    const isFeedback = phase === 'feedback' || phase === 'submitting-feedback'
    const isBusy = phase === 'canceling' || phase === 'revoking' || phase === 'submitting-feedback'

    return (
        <ActionModal
            visible={isOpen}
            onClose={handleClose}
            preventClose={isBusy}
            hideModalCloseButton={isBusy}
            tone={isConfirm ? 'error' : 'attention'}
            icon={isConfirm ? 'alert' : isRevoke || isFeedback ? 'alert-filled' : undefined}
            title={t(
                isConfirm
                    ? 'cancel.title'
                    : isRevoke
                      ? 'funding.revokeTitle'
                      : isFeedback
                        ? 'cancel.canceledTitle'
                        : 'cancel.thanksTitle'
            )}
            description={t(
                isConfirm
                    ? 'cancel.body'
                    : isRevoke
                      ? 'funding.revokeBody'
                      : isFeedback
                        ? 'cancel.canceledBody'
                        : 'cancel.thanksBody'
            )}
            content={
                isRevoke ? (
                    error ? (
                        <Callout priority="error">{error}</Callout>
                    ) : undefined
                ) : isConfirm ? (
                    // visual-qa verdict: cancel keeps the slide friction — a
                    // terminal money action commits only at full travel.
                    <>
                        {error && <Callout priority="error">{error}</Callout>}
                        <SlideToConfirm
                            label={phase === 'canceling' ? t('cancel.canceling') : t('cancel.slideToCancel')}
                            onConfirm={runCancel}
                            disabled={phase === 'canceling'}
                        />
                    </>
                ) : isFeedback ? (
                    <Field label={t('cancel.feedbackLabel')} htmlFor="cancel-feedback">
                        <textarea
                            id="cancel-feedback"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder={t('cancel.feedbackPlaceholder')}
                            rows={4}
                            maxLength={2000}
                            className="input h-auto resize-y py-3"
                            disabled={phase === 'submitting-feedback'}
                        />
                    </Field>
                ) : undefined
            }
            ctas={
                isRevoke
                    ? [
                          {
                              text: t(phase === 'revoking' ? 'funding.revokeWorking' : 'funding.revokeCta'),
                              variant: 'primary',
                              onClick: runRevoke,
                              loading: phase === 'revoking',
                              disabled: phase === 'revoking',
                          },
                          {
                              text: t('funding.revokeSkip'),
                              variant: 'stroke',
                              onClick: () => setPhase('feedback'),
                              disabled: phase === 'revoking',
                          },
                      ]
                    : isFeedback
                      ? [
                            {
                                text: t('cancel.submit'),
                                variant: 'primary',
                                onClick: submitFeedback,
                                loading: phase === 'submitting-feedback',
                                disabled: phase === 'submitting-feedback',
                            },
                        ]
                      : phase === 'thanks'
                        ? [
                              {
                                  text: tCommon('close'),
                                  variant: 'primary',
                                  onClick: handleClose,
                              },
                          ]
                        : [
                              {
                                  text: t('cancel.keepCard'),
                                  variant: 'stroke',
                                  className: 'w-full',
                                  onClick: handleClose,
                                  disabled: phase === 'canceling',
                              },
                          ]
            }
        />
    )
}

export default CancelCardModal
