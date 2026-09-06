'use client'

import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { useQrPayFlow } from '../QrPayFlowContext'

/**
 * The three dead-end cards: provider maintenance, a failed scan init, and a
 * dynamic QR whose merchant never entered an amount. One Card + CTA shape,
 * parameterized by the derived view.
 */
export function QrPayBlockedView() {
    const t = useAppTranslations('qrPay')
    const { view, paymentMethodName, errorInitiatingPayment, onBack, retryOrderNotReady } = useQrPayFlow()
    const { setIsSupportModalOpen } = useModalsContext()

    const supportLink = (
        <button
            onClick={() => setIsSupportModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary transition-colors hover:text-black"
        >
            <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
            {t('havingTrouble')}
        </button>
    )

    // A failed init keeps its historical shape: message + CTA inside the card,
    // no title, no support link.
    if (view === 'INIT_ERROR') {
        return (
            <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="alert" size={24} />
                    </div>
                    <p className="font-medium"> {errorInitiatingPayment || t('errors.genericQrDetails')}</p>

                    <Button onClick={onBack} variant="purple">
                        {t('maintenance.goBack')}
                    </Button>
                </Card>
            </div>
        )
    }

    const isMaintenance = view === 'MAINTENANCE'
    const icon: IconName = isMaintenance ? 'alert' : 'qr-code'
    const title = isMaintenance ? t('maintenance.title') : t('orderNotReady.title')
    const description = isMaintenance
        ? t('maintenance.description', { method: paymentMethodName })
        : t('orderNotReady.description')

    return (
        <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center">
            <Card className="flex w-full flex-col items-center gap-2 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                    <Icon name={icon} size={24} />
                </div>
                <span className="text-heading-card">{title}</span>
                <p
                    className={
                        isMaintenance
                            ? 'text-center font-normal text-foreground-secondary'
                            : 'max-w-52 text-center font-normal text-foreground-secondary'
                    }
                >
                    {description}
                </p>
            </Card>
            {isMaintenance ? (
                <Button onClick={onBack} variant="purple" shadowSize="4">
                    {t('maintenance.goBack')}
                </Button>
            ) : (
                <Button onClick={retryOrderNotReady} variant="purple" shadowSize="4">
                    {t('orderNotReady.cta')}
                </Button>
            )}
            {supportLink}
        </div>
    )
}
