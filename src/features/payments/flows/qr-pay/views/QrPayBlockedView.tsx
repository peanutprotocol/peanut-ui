'use client'

import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useQrPayFlow } from '../QrPayFlowContext'

/**
 * The three dead-end cards: provider maintenance, a failed scan init, and a
 * dynamic QR whose merchant never entered an amount. One Card + CTA shape,
 * parameterized by the derived view.
 */
export function QrPayBlockedView() {
    const t = useAppTranslations('qrPay')
    const {
        view,
        paymentMethodName,
        errorInitiatingPayment,
        initErrorNeedsSupport,
        initErrorNeedsVerification,
        gate,
        targetMantecaCountry,
        onBack,
        retryOrderNotReady,
    } = useQrPayFlow()
    const { setIsSupportModalOpen } = useModalsContext()

    const supportLink = (
        <button
            onClick={() => setIsSupportModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary transition-colors hover:text-black active:text-black"
        >
            <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
            {t('havingTrouble')}
        </button>
    )

    // A failed init keeps its historical shape: message + CTA inside the card,
    // no title. The support link appears only for the refusals whose copy
    // sends the user to support, so the one instruction on screen is reachable.
    if (view === 'INIT_ERROR') {
        // A refusal for identity starts the verification from here, unless the
        // ID check already ended on a final decision: then only support helps.
        const canVerify = initErrorNeedsVerification && !gate.isTerminalFailure
        const isVerificationClosed = initErrorNeedsVerification && gate.isTerminalFailure
        return (
            <PageStack>
                <PageStack.Center className="gap-4">
                    <Card className="relative z-10 w-full items-center gap-4 p-4">
                        {/* terminal init failure — error tone, not the attention yellow
                            the maintenance/waiting states use */}
                        <IconBubble icon="alert" color="red" size="m" />
                        <p className="text-body-m">
                            {isVerificationClosed
                                ? t('kyc.blockedDescription')
                                : errorInitiatingPayment || t('errors.genericQrDetails')}
                        </p>

                        {canVerify ? (
                            <Button
                                onClick={() => gate.startVerification(targetMantecaCountry)}
                                loading={gate.sumsubFlow.isLoading}
                                variant="primary"
                                icon="check-circle"
                            >
                                {t('kyc.unlockCta')}
                            </Button>
                        ) : null}
                        <Button onClick={onBack} variant={canVerify ? 'secondary' : 'primary'}>
                            {t('maintenance.goBack')}
                        </Button>
                    </Card>
                    {initErrorNeedsSupport || isVerificationClosed ? supportLink : null}
                </PageStack.Center>
                {canVerify ? <SumsubKycModals flow={gate.sumsubFlow} /> : null}
            </PageStack>
        )
    }

    const isMaintenance = view === 'MAINTENANCE'
    const icon: IconName = isMaintenance ? 'alert' : 'qr-code'
    const title = isMaintenance ? t('maintenance.title') : t('orderNotReady.title')
    const description = isMaintenance
        ? t('maintenance.description', { method: paymentMethodName })
        : t('orderNotReady.description')

    return (
        <PageStack>
            <PageStack.Center className="gap-4">
                <Card className="w-full items-center gap-2 p-4 text-center">
                    <IconBubble icon={icon} color="yellow" size="m" />
                    <span className="text-heading-card">{title}</span>
                    <p
                        className={
                            isMaintenance
                                ? 'font-normal text-foreground-secondary'
                                : 'max-w-52 font-normal text-foreground-secondary'
                        }
                    >
                        {description}
                    </p>
                </Card>
                {isMaintenance ? (
                    <Button onClick={onBack} variant="primary" shadowSize="4">
                        {t('maintenance.goBack')}
                    </Button>
                ) : (
                    <Button onClick={retryOrderNotReady} variant="primary" shadowSize="4">
                        {t('orderNotReady.cta')}
                    </Button>
                )}
                {supportLink}
            </PageStack.Center>
        </PageStack>
    )
}
