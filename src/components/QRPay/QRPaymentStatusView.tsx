import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'

/** The payment the pending screen names, so the payer and the cashier can tell which one it is. */
export interface PendingQrPayment {
    merchantName: string
    /** In the merchant's currency, e.g. "ARS 4,500". */
    amount: string
    /** What left the wallet, e.g. "$2.59". */
    usdAmount: string
}

export function QRPaymentStatusView({
    status,
    payment,
    onViewActivity,
    onContactSupport,
}: {
    status: 'cancelled' | 'refunded' | 'failed' | 'processing'
    /** Shown on the processing screen only. */
    payment?: PendingQrPayment | null
    onViewActivity: () => void
    /** A person at Peanut is looking at the payment: support is the way on, in place of Activity. */
    onContactSupport?: () => void
}) {
    const t = useTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')

    // The provider did not confirm within the API's wait: the payment exists and is funded, so the
    // screen says it is pending and names it, the way the Pix withdraw outcome shows its wait.
    if (status === 'processing') {
        return (
            <PageStack>
                <NavHeader title={tNav('pay')} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="clock" size="l" color="yellow" />
                    <TitleBlock align="center" title={t('result.processing.title')} />
                    {payment && (
                        // the receipt head's anatomy (name, amount); a pending amount is greyed, as on the receipt
                        <Card className="flex w-full flex-col items-center gap-1 p-4">
                            <p className="text-body-s text-foreground-secondary">{payment.merchantName}</p>
                            <p className="text-heading-m text-foreground-secondary">{payment.amount}</p>
                            <p className="text-body-s text-foreground-secondary">{payment.usdAmount}</p>
                        </Card>
                    )}
                    <p className="text-body-s text-foreground-secondary">{t('result.processing.description')}</p>
                    {onContactSupport ? (
                        <Button variant="primary" className="w-full" onClick={onContactSupport}>
                            {tCommon('contactSupport')}
                        </Button>
                    ) : (
                        <Button variant="primary" className="w-full" onClick={onViewActivity}>
                            {t('result.viewActivity')}
                        </Button>
                    )}
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={tNav('pay')} />
            <PageStack.Center>
                <Card className="gap-4 p-4">
                    <h1 className="text-heading-xs">{t(`result.${status}.title`)}</h1>
                    <p className="text-body-s">{t(`result.${status}.description`)}</p>
                </Card>
            </PageStack.Center>
            {onContactSupport ? (
                <Button onClick={onContactSupport}>{tCommon('contactSupport')}</Button>
            ) : (
                <Button onClick={onViewActivity}>{t('result.viewActivity')}</Button>
            )}
        </PageStack>
    )
}
