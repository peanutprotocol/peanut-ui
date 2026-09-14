import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { KycRegionRestrictedContent, useRegionRestrictedCta } from '../KycRegionRestrictedContent'

/**
 * Drawer state for a terminal rejection caused by the document's jurisdiction —
 * the sibling of {@link KycFailed}, minus the retry button.
 *
 * KycFailed offers "Retry verification" to everyone it renders. For this cohort
 * that button is a promise we cannot keep, which is the whole reason this is a
 * separate component rather than a prop on that one: the retry is not
 * conditionally hidden here, it does not exist.
 */
export const KycRegionRestricted = ({ reviewedAt, onNavigate }: { reviewedAt?: string; onNavigate?: () => void }) => {
    const t = useTranslations('kyc')
    const format = useFormatter()
    const cta = useRegionRestrictedCta(onNavigate)

    const rejectedOn = useMemo(() => {
        if (!reviewedAt) return t('notAvailable')
        const date = new Date(reviewedAt)
        if (isNaN(date.getTime())) return t('notAvailable')
        return format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
    }, [reviewedAt, format, t])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />

            <Card position="single" className="py-0">
                <PaymentInfoRow label={t('rejectedOn')} value={rejectedOn} hideBottomBorder />
            </Card>

            <KycRegionRestrictedContent />

            <Button variant="purple" className="w-full" shadowSize="4" onClick={cta.onClick}>
                {cta.label}
            </Button>
        </div>
    )
}
