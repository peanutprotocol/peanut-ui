import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'

export function QRPaymentStatusView({
    status,
    onViewActivity,
}: {
    status: 'cancelled' | 'refunded' | 'failed' | 'processing'
    onViewActivity: () => void
}) {
    const t = useTranslations('qrPay')
    const tNav = useTranslations('navigation')

    return (
        <PageStack>
            <NavHeader title={tNav('pay')} />
            <PageStack.Center>
                <Card className="gap-4 p-4">
                    <h1 className="text-heading-xs">{t(`result.${status}.title`)}</h1>
                    <p className="text-body-s">{t(`result.${status}.description`)}</p>
                </Card>
            </PageStack.Center>
            <Button onClick={onViewActivity}>{t('result.viewActivity')}</Button>
        </PageStack>
    )
}
