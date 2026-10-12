'use client'
import { type FC, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
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
    const [fieldError, setFieldError] = useState<string | null>(null)
    // save/api failure — not attributable to the pin input, rendered as a
    // notification banner instead of a field error (design.md error display)
    const [flowError, setFlowError] = useState<string | null>(null)

    const onContinueFromChoose = () => {
        const v = validatePin(first)
        if (!v.valid) {
            setFieldError(v.reason ? t(REJECTION_KEYS[v.reason]) : t('pin.invalid'))
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_REJECTED, {
                reason: v.reason ?? 'invalid',
                stage: 'choose',
            })
            return
        }
        setFieldError(null)
        setStep('confirm')
    }

    const onConfirm = async () => {
        if (second !== first) {
            setFieldError(t('pin.mismatch'))
            setFlowError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_REJECTED, { reason: 'mismatch', stage: 'confirm' })
            return
        }
        setFieldError(null)
        setFlowError(null)
        setStep('saving')
        posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_ATTEMPTED)
        try {
            await rainApi.setCardPin(cardId, first)
            posthog.capture(ANALYTICS_EVENTS.CARD_PIN_SET_SUCCEEDED)
            setStep('success')
        } catch (e) {
            const message = e instanceof Error ? e.message : t('pin.saveFailed')
            setFlowError(message)
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
                <TitleBlock
                    title={<h1>{t('pin.successTitle')}</h1>}
                    description={t('pin.successBody')}
                    align="center"
                    size="s"
                />
                <Button variant="primary" className="w-full" onClick={onDone}>
                    {tCommon('close')}
                </Button>
            </div>
        )
    }

    if (step === 'confirm' || step === 'saving') {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <TitleBlock
                    title={<h1>{t('pin.confirmTitle')}</h1>}
                    description={t('pin.confirmBody')}
                    align="center"
                    size="s"
                />
                {/* pin input + its field error form one column, 4px apart (form-field board 17788:19179) */}
                <div className="flex flex-col items-center gap-1">
                    <PinInput value={second} onChange={setSecond} disabled={step === 'saving'} />
                    {fieldError && <FieldError>{fieldError}</FieldError>}
                </div>
                {flowError && <Callout priority="error">{flowError}</Callout>}
                <Button
                    variant="primary"
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
            <TitleBlock
                title={<h1>{t('pin.chooseTitle')}</h1>}
                description={t('pin.chooseBody')}
                align="center"
                size="s"
            />
            {/* pin input + its field error form one column, 4px apart (form-field board 17788:19179) */}
            <div className="flex flex-col items-center gap-1">
                <PinInput value={first} onChange={setFirst} />
                {choosePinValidation && !choosePinValidation.valid && choosePinValidation.reason && (
                    <FieldError>{t(REJECTION_KEYS[choosePinValidation.reason])}</FieldError>
                )}
            </div>
            <BulletList items={[t('pin.ruleSequential'), t('pin.ruleRepeating'), t('pin.ruleChangeLater')]} />
            <Button
                variant="primary"
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
