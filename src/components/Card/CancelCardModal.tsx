'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import SlideToAction from '@/components/Card/SlideToAction'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'

type Phase = 'confirm' | 'canceling' | 'feedback' | 'submitting-feedback' | 'thanks'

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
                })
                if (artifact.strategy !== 'collateral-only') {
                    throw new Error(t('errors.unexpectedStrategy'))
                }
                verifiedWithdrawal = artifact.rainWithdrawal
            }
            await rainApi.cancelCard(cardId, { verifiedWithdrawal })
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_CONFIRMED)
            setCanceled(true)
            setPhase('feedback')
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

    return (
        <Modal
            visible={isOpen}
            onClose={handleClose}
            classWrap="sm:m-auto sm:self-center self-center m-4"
            preventClose={phase === 'canceling' || phase === 'submitting-feedback'}
        >
            <div className="p-6">
                {phase === 'confirm' || phase === 'canceling' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="alert" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{t('cancel.title')}</div>
                        <p className="text-sm text-grey-1">{t('cancel.body')}</p>
                        {error && <p className="text-sm text-red">{error}</p>}
                        <SlideToAction
                            label={phase === 'canceling' ? t('cancel.canceling') : t('cancel.slideToCancel')}
                            onComplete={runCancel}
                            disabled={phase === 'canceling'}
                        />
                    </div>
                ) : phase === 'feedback' || phase === 'submitting-feedback' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="alert-filled" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{t('cancel.canceledTitle')}</div>
                        <p className="text-sm text-grey-1">{t('cancel.canceledBody')}</p>
                        <div className="flex w-full flex-col gap-2 text-left">
                            <label htmlFor="cancel-feedback" className="text-sm font-bold">
                                {t('cancel.feedbackLabel')}
                            </label>
                            <textarea
                                id="cancel-feedback"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder={t('cancel.feedbackPlaceholder')}
                                rows={4}
                                maxLength={2000}
                                className="w-full resize-none rounded-sm border border-n-1 bg-white p-3 text-sm focus:outline-none"
                                disabled={phase === 'submitting-feedback'}
                            />
                        </div>
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="w-full"
                            onClick={submitFeedback}
                            loading={phase === 'submitting-feedback'}
                            disabled={phase === 'submitting-feedback'}
                        >
                            {t('cancel.submit')}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="text-xl font-extrabold">{t('cancel.thanksTitle')}</div>
                        <p className="text-sm text-grey-1">{t('cancel.thanksBody')}</p>
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={handleClose}>
                            {tCommon('close')}
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export default CancelCardModal
