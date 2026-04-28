'use client'
import { type FC, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Button } from '@/components/0_Bruddle/Button'
import PinInput from '@/components/Card/PinInput'
import { validatePin } from '@/components/Card/pin.utils'
import { rainApi, RainCardRateLimitError } from '@/services/rain'

type Step = 'choose' | 'confirm' | 'saving' | 'success'

interface Props {
    cardId: string
    onDone: () => void
}

const CardPinSetupFlow: FC<Props> = ({ cardId, onDone }) => {
    const [step, setStep] = useState<Step>('choose')
    const [first, setFirst] = useState('')
    const [second, setSecond] = useState('')
    const [error, setError] = useState<string | null>(null)

    const onContinueFromChoose = () => {
        const v = validatePin(first)
        if (!v.valid) {
            setError(v.reason ?? 'Invalid PIN')
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_REJECTED, {
                reason: v.reason ?? 'invalid',
                stage: 'choose',
            })
            return
        }
        setError(null)
        setStep('confirm')
    }

    const onConfirm = async () => {
        if (second !== first) {
            setError('PINs do not match')
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_REJECTED, { reason: 'mismatch', stage: 'confirm' })
            return
        }
        setError(null)
        setStep('saving')
        posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_ATTEMPTED)
        try {
            await rainApi.setCardPin(cardId, first)
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_SUCCEEDED)
            setStep('success')
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to save PIN'
            setError(message)
            if (e instanceof RainCardRateLimitError) {
                posthog.capture(ANALYTICS_EVENTS.CARD_PIN_RATE_LIMITED, { action: 'set' })
            } else {
                posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_REJECTED, { reason: 'server', stage: 'submit' })
            }
            setStep('confirm')
        }
    }

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-xl font-extrabold">PIN successfully set</div>
                <p className="text-sm text-grey-1">You can now use your card for in-store purchases.</p>
                <Button variant="purple" shadowSize="4" className="w-full" onClick={onDone}>
                    Close
                </Button>
            </div>
        )
    }

    if (step === 'confirm' || step === 'saving') {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex flex-col gap-2">
                    <h1 className="text-xl font-extrabold">Confirm PIN</h1>
                    <p className="text-sm text-grey-1">Re-enter your PIN to verify.</p>
                </div>
                <PinInput value={second} onChange={setSecond} disabled={step === 'saving'} />
                {error && <p className="text-sm text-red">{error}</p>}
                <Button
                    variant="purple"
                    shadowSize="4"
                    className="w-full"
                    onClick={onConfirm}
                    loading={step === 'saving'}
                    disabled={second.length < 4 || step === 'saving'}
                >
                    Save
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-extrabold">Choose a 4 digit PIN</h1>
                <p className="text-sm text-grey-1">Needed for in store purchases.</p>
            </div>
            <PinInput value={first} onChange={setFirst} />
            <ul className="w-full list-inside list-disc text-left text-sm text-grey-1">
                <li>Numbers can&apos;t be sequential (1234)</li>
                <li>No repeating digits (1111)</li>
                <li>You can change your PIN later</li>
            </ul>
            {error && <p className="text-sm text-red">{error}</p>}
            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                onClick={onContinueFromChoose}
                disabled={first.length < 4}
            >
                Continue
            </Button>
        </div>
    )
}

export default CardPinSetupFlow
