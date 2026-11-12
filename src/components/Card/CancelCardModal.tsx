'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Field } from '@/components/0_Bruddle/Field'
import ActionModal from '@/components/Global/ActionModal'
import { Callout } from '@/components/0_Bruddle/Callout'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import CardReturnNotice from '@/components/Card/CardReturnNotice'
import CardReturnWait from '@/components/Card/CardReturnWait'
import CardStopNotice from '@/components/Card/CardStopNotice'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { rainApi, type CardCollateralReturn, type CardFundingStop } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { newStopAttemptId, type StopAttempt } from '@/hooks/useCardStopConfirmation'
import { useStopAttemptReporter } from '@/hooks/useStopAttemptReporter'
import { useCardWithdrawalProof } from '@/hooks/wallet/useCardWithdrawalProof'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'

type Phase = 'confirm' | 'canceling' | 'feedback' | 'submitting-feedback' | 'thanks'

interface Props {
    cardId: string
    isOpen: boolean
    onClose: () => void
    onStopAttempt?: (attempt: StopAttempt | null) => void
}

const CancelCardModal: FC<Props> = ({ cardId, isOpen, onClose, onStopAttempt }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const [phase, setPhase] = useState<Phase>('confirm')
    const [feedback, setFeedback] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [canceled, setCanceled] = useState(false)
    const [stop, setStop] = useState<
        { attemptId: string; stop?: CardFundingStop | null; collateralReturn?: CardCollateralReturn } | undefined
    >()
    // The backend refused the cancel until the card balance can move: which
    // refusal, and when the provider releases it (null: the backend gave no time).
    const [wait, setWait] = useState<{ kind: 'blocked' | 'remains'; retryAtMs: number | null } | null>(null)
    const [waitOver, setWaitOver] = useState(false)
    const endWait = useCallback(() => setWaitOver(true), [])
    // After a failed attempt the balance on screen can predate it: a partial
    // return, or the provider's release, changed what there is to sign for.
    const balanceIsStale = useRef(false)
    const queryClient = useQueryClient()
    const { overview, refetch: refetchOverview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const withdrawalProof = useCardWithdrawalProof(cardId, smartWalletAddress)
    const beginStopReport = useStopAttemptReporter(smartWalletAddress, onStopAttempt)

    useEffect(() => {
        if (!isOpen) {
            // Reset so reopening after dismiss starts fresh. A wait for the card
            // balance stays: it belongs to the card, not to this visit.
            setPhase('confirm')
            setFeedback('')
            setError(null)
            setCanceled(false)
            setStop(undefined)
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
        setWait(null)
        setWaitOver(false)
        const report = beginStopReport()
        try {
            const current = balanceIsStale.current ? ((await refetchOverview()).data ?? overview) : overview
            balanceIsStale.current = false
            // An unloaded overview reads as zero spending power below, which
            // would skip the withdrawal and get the cancel rejected by the
            // backend ("Withdrawal signature required"). Fail closed instead.
            if (!current) {
                throw new Error(t('errors.cardDetailsLoading'))
            }
            // Cancel can be terminal on Rain's side (collateral contract may
            // become unreachable), so we MUST drain it BEFORE the cancel.
            // Backend enforces order — this just delivers the signed body.
            const spendingPowerUnits = rainCentsToUsdcUnits(current.balance?.spendingPower)
            // A retry reuses the proof: signing again could be a second withdrawal.
            let verifiedWithdrawal = withdrawalProof.get()
            if (!verifiedWithdrawal && spendingPowerUnits > 0n) {
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
                withdrawalProof.save(verifiedWithdrawal)
            }
            // No draft back-out on a cancelCard throw: execution-ambiguous —
            // the probe-verified TTL sweep owns cleanup (TASK-21815 review).
            const result = await rainApi.cancelCard(cardId, { verifiedWithdrawal })
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_CONFIRMED)
            withdrawalProof.clear()
            const attemptId = newStopAttemptId()
            const fundingStop = result?.fundingStop
            // The card page keeps this once the card screen is gone.
            if (fundingStop && fundingStop.state !== 'not_applicable') report({ attemptId, stop: fundingStop })
            setStop({ attemptId, stop: fundingStop, collateralReturn: result?.collateralReturn })
            setCanceled(true)
            setPhase('feedback')
        } catch (e) {
            balanceIsStale.current = true
            // A signature the backend used or can never verify is signed again on the next try.
            withdrawalProof.dropIfSpent(e)
            const code = wireErrorCode(e)
            // The cancel waits for the card balance. The card is unchanged.
            if (code === API_ERROR_CODES.CARD_RETURN_BLOCKED || code === API_ERROR_CODES.CARD_BALANCE_REMAINS) {
                const retryAfterSec = (e as { retryAfterSec?: unknown }).retryAfterSec
                setWait({
                    kind: code === API_ERROR_CODES.CARD_RETURN_BLOCKED ? 'blocked' : 'remains',
                    retryAtMs:
                        typeof retryAfterSec === 'number' && retryAfterSec > 0
                            ? Date.now() + retryAfterSec * 1000
                            : null,
                })
                posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FAILED, { error_message: code })
                setPhase('confirm')
                return
            }
            let message = e instanceof Error ? e.message : t('cancel.failed')
            if (e instanceof InsufficientSpendableError) {
                message = t('errors.balanceReturnFailed')
            } else if (e instanceof SessionKeyGrantRequiredError) {
                message = t('errors.authorizationFailed')
            } else if (code === API_ERROR_CODES.CARD_BALANCE_UNREADABLE) {
                message = t('yourCard.moveBalanceUnavailable')
            }
            setError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_FAILED, { error_message: message })
            setPhase('confirm')
        }
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
    const isFeedback = phase === 'feedback' || phase === 'submitting-feedback'
    // A wait with a known end holds the slide until that end.
    const mustWait = !!wait && wait.retryAtMs !== null && !waitOver

    return (
        <ActionModal
            visible={isOpen}
            onClose={handleClose}
            preventClose={phase === 'canceling' || phase === 'submitting-feedback'}
            hideModalCloseButton={phase === 'canceling' || phase === 'submitting-feedback'}
            tone={isConfirm ? 'error' : 'attention'}
            icon={isConfirm ? 'alert' : isFeedback ? 'alert-filled' : undefined}
            title={t(isConfirm ? 'cancel.title' : isFeedback ? 'cancel.canceledTitle' : 'cancel.thanksTitle')}
            description={t(isConfirm ? 'cancel.body' : isFeedback ? 'cancel.canceledBody' : 'cancel.thanksBody')}
            content={
                isConfirm ? (
                    // visual-qa verdict: cancel keeps the slide friction — a
                    // terminal money action commits only at full travel.
                    <>
                        {error && <Callout priority="error">{error}</Callout>}
                        {wait && (
                            <CardReturnWait
                                key={wait.retryAtMs}
                                kind={wait.kind}
                                retryAtMs={wait.retryAtMs}
                                onOver={endWait}
                            />
                        )}
                        <SlideToConfirm
                            label={phase === 'canceling' ? t('cancel.canceling') : t('cancel.slideToCancel')}
                            onConfirm={runCancel}
                            disabled={phase === 'canceling' || mustWait}
                        />
                    </>
                ) : isFeedback || stop ? (
                    // The card is canceled; this says what stays in it and how far
                    // stopping wallet payments got.
                    <>
                        {/* the modal stacks its body with no gap, and two notices must not touch */}
                        <div className="flex w-full flex-col gap-2">
                            <CardReturnNotice action="cancel" collateralReturn={stop?.collateralReturn} />
                            {stop && (
                                <CardStopNotice
                                    key={stop.attemptId}
                                    stop={stop.stop}
                                    attemptId={stop.attemptId}
                                    wallet={smartWalletAddress}
                                />
                            )}
                        </div>
                        {isFeedback && (
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
                        )}
                    </>
                ) : undefined
            }
            ctas={
                isFeedback
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
                      : undefined
            }
            tertiaryCta={
                isConfirm
                    ? { text: t('cancel.keepCard'), onClick: handleClose, disabled: phase === 'canceling' }
                    : undefined
            }
        />
    )
}

export default CancelCardModal
