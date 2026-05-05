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

type Mode = 'lock' | 'unlock'
type Phase = 'prompt' | 'loading' | 'success' | 'error'

interface Props {
    cardId: string
    mode: Mode
    isOpen: boolean
    onClose: () => void
}

const COPY: Record<Mode, { title: string; body: string; success: string; successBody: (linkLabel: string) => string }> =
    {
        lock: {
            title: 'Lock your card?',
            body: 'Card will not work for any transactions until you unlock it.',
            success: 'Card locked',
            successBody: (link) => `Come back at any time to ${link} it.`,
        },
        unlock: {
            title: 'Unlock your card?',
            body: 'Your card will work again for any transactions.',
            success: 'Card unlocked',
            successBody: () => 'Your card is active again.',
        },
    }

const LockCardModal: FC<Props> = ({ cardId, mode, isOpen, onClose }) => {
    const [phase, setPhase] = useState<Phase>('prompt')
    const [error, setError] = useState<string | null>(null)
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!isOpen) {
            // Reset on close so the next open starts fresh.
            setPhase('prompt')
            setError(null)
        }
    }, [isOpen])

    const copy = COPY[mode]

    const run = async () => {
        setPhase('loading')
        setError(null)
        try {
            if (mode === 'lock') await rainApi.lockCard(cardId)
            else await rainApi.activateCard(cardId)
            await queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            posthog.capture(mode === 'lock' ? ANALYTICS_EVENTS.CARD_LOCKED : ANALYTICS_EVENTS.CARD_UNLOCKED)
            setPhase('success')
        } catch (e) {
            const message = e instanceof Error ? e.message : `Failed to ${mode} card`
            setError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_LOCK_FAILED, { mode, error_message: message })
            setPhase('error')
        }
    }

    return (
        <Modal visible={isOpen} onClose={onClose} classWrap="sm:m-auto sm:self-center self-center m-4 rounded-2xl">
            <div className="p-6">
                {phase === 'success' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="lock" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{copy.success}</div>
                        <p className="text-sm text-grey-1">{copy.successBody(mode === 'lock' ? 'unlock' : 'lock')}</p>
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="lock" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{copy.title}</div>
                        <p className="text-sm text-grey-1">{copy.body}</p>
                        {phase === 'error' && error && <p className="text-sm text-red">{error}</p>}
                        {mode === 'lock' ? (
                            <SlideToAction
                                label={phase === 'loading' ? 'Locking…' : 'Slide to Lock'}
                                onComplete={run}
                                disabled={phase === 'loading'}
                            />
                        ) : (
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                onClick={run}
                                loading={phase === 'loading'}
                                disabled={phase === 'loading'}
                            >
                                Unlock
                            </Button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-black underline"
                            disabled={phase === 'loading'}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export default LockCardModal
