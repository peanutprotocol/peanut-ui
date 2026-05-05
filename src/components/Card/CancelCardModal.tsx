'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import SlideToAction from '@/components/Card/SlideToAction'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'

type Phase = 'confirm' | 'canceling' | 'feedback' | 'submitting-feedback' | 'thanks'

interface Props {
    cardId: string
    isOpen: boolean
    onClose: () => void
}

const CancelCardModal: FC<Props> = ({ cardId, isOpen, onClose }) => {
    const [phase, setPhase] = useState<Phase>('confirm')
    const [feedback, setFeedback] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [canceled, setCanceled] = useState(false)
    const queryClient = useQueryClient()

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
            await rainApi.cancelCard(cardId)
            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_CONFIRMED)
            setCanceled(true)
            setPhase('feedback')
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to cancel card'
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
            classWrap="sm:m-auto sm:self-center self-center m-4 rounded-2xl"
            preventClose={phase === 'canceling' || phase === 'submitting-feedback'}
        >
            <div className="p-6">
                {phase === 'confirm' || phase === 'canceling' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="alert-filled" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">Cancel card?</div>
                        <p className="text-sm text-grey-1">
                            This will permanently cancel your card. It won&apos;t work for any transactions. You will
                            have to request a new one if you change your mind.
                        </p>
                        {error && <p className="text-sm text-red">{error}</p>}
                        <SlideToAction
                            label={phase === 'canceling' ? 'Canceling…' : 'Slide to Cancel'}
                            onComplete={runCancel}
                            disabled={phase === 'canceling'}
                        />
                        <Button
                            variant="stroke"
                            className="w-full"
                            onClick={handleClose}
                            disabled={phase === 'canceling'}
                        >
                            Close
                        </Button>
                    </div>
                ) : phase === 'feedback' || phase === 'submitting-feedback' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="alert-filled" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">Card canceled</div>
                        <p className="text-sm text-grey-1">
                            If you change your mind later, you can request another card.
                        </p>
                        <div className="flex w-full flex-col gap-2 text-left">
                            <label htmlFor="cancel-feedback" className="text-sm font-bold">
                                Help us improve our product for you
                            </label>
                            <textarea
                                id="cancel-feedback"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Why did you cancel the card?"
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
                            Submit
                        </Button>
                        <button
                            type="button"
                            onClick={() => setPhase('thanks')}
                            className="text-black underline"
                            disabled={phase === 'submitting-feedback'}
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="text-xl font-extrabold">Thank you for the feedback</div>
                        <p className="text-sm text-grey-1">
                            We appreciate your feedback, it helps us improve the experience of our app.
                        </p>
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={handleClose}>
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export default CancelCardModal
