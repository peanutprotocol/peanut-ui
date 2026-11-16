import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'

export function QRPaymentStatusView({
    status,
    onViewActivity,
    onContactSupport,
}: {
    status: 'cancelled' | 'refunded' | 'failed' | 'processing'
    onViewActivity: () => void
    /** A person at Peanut is looking at the payment: support is the way on, in place of Activity. */
    onContactSupport?: () => void
}) {
    const t = useTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')

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
