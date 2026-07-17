'use client'
import { type FC, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Button } from '@/components/0_Bruddle/Button'
import PinInput from '@/components/Card/PinInput'
import { type PinRejectionReason, validatePin } from '@/components/Card/pin.utils'
import { rainApi, RainCardRateLimitError } from '@/services/rain'

type Step = 'choose' | 'confirm' | 'saving' | 'success'

const REJECTION_KEYS = {
    length: 'pin.validationLength',
    repeating: 'pin.validationRepeating',
    sequential: 'pin.validationSequential',
} as const satisfies Record<PinRejectionReason, string>

interface Props {
    cardId: string
    onDone: () => void
}

const CardPinSetupFlow: FC<Props> = ({ cardId, onDone }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const [step, setStep] = useState<Step>('choose')
    const [first, setFirst] = useState('')
    const [second, setSecond] = useState('')
    const [error, setError] = useState<string | null>(null)

    const onContinueFromChoose = () => {
        const v = validatePin(first)
        if (!v.valid) {
            setError(v.reason ? t(REJECTION_KEYS[v.reason]) : t('pin.invalid'))
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
            setError(t('pin.mismatch'))
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
            const message = e instanceof Error ? e.message : t('pin.saveFailed')
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
                <div className="text-xl font-extrabold">{t('pin.successTitle')}</div>
                <p className="text-sm text-grey-1">{t('pin.successBody')}</p>
                <Button variant="purple" shadowSize="4" className="w-full" onClick={onDone}>
                    {tCommon('close')}
                </Button>
            </div>
        )
    }

    if (step === 'confirm' || step === 'saving') {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex flex-col gap-2">
                    <h1 className="text-xl font-extrabold">{t('pin.confirmTitle')}</h1>
                    <p className="text-sm text-grey-1">{t('pin.confirmBody')}</p>
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
                    {tCommon('save')}
                </Button>
            </div>
        )
    }

    // Validate live once the user has typed all 4 digits so they see the
    // failure reason BEFORE clicking Continue (and the button stays disabled
    // for invalid PINs). Past behavior: 1111 only failed on the next step
    // after the user re-entered + submitted, surprising them.
    const choosePinValidation = first.length === 4 ? validatePin(first) : null

    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-extrabold">{t('pin.chooseTitle')}</h1>
                <p className="text-sm text-grey-1">{t('pin.chooseBody')}</p>
            </div>
            <PinInput value={first} onChange={setFirst} />
            <ul className="w-full list-inside list-disc text-left text-sm text-grey-1">
                <li>{t('pin.ruleSequential')}</li>
                <li>{t('pin.ruleRepeating')}</li>
                <li>{t('pin.ruleChangeLater')}</li>
            </ul>
            {choosePinValidation && !choosePinValidation.valid && choosePinValidation.reason && (
                <p className="text-sm text-red">{t(REJECTION_KEYS[choosePinValidation.reason])}</p>
            )}
            {error && <p className="text-sm text-red">{error}</p>}
            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                onClick={onContinueFromChoose}
                disabled={!choosePinValidation || !choosePinValidation.valid}
            >
                {tCommon('continue')}
            </Button>
        </div>
    )
}

export default CardPinSetupFlow
