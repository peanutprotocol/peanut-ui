import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
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
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('pay')} />
            <Card className="my-auto space-y-4 p-4">
                <h1 className="text-heading-xs">{t(`result.${status}.title`)}</h1>
                <p className="text-body-s">{t(`result.${status}.description`)}</p>
            </Card>
            <Button onClick={onViewActivity}>{t('result.viewActivity')}</Button>
        </div>
    )
}
