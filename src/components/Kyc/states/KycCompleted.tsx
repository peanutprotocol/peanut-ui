import Card from '@/components/Global/Card'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'

// @dev TODO: Remove hardcoded KYC points - this should come from backend
// See comment in KycStatusItem.tsx for proper implementation plan
const KYC_BONUS_POINTS = 2000

// this component shows the identity-verification status when it's completed/approved.
export const KycCompleted = ({ reviewedAt }: { reviewedAt?: string }) => {
    const t = useTranslations('kyc')
    const format = useFormatter()

    const verifiedOn = useMemo(() => {
        if (!reviewedAt) return t('notAvailable')
        try {
            const date = new Date(reviewedAt)
            if (isNaN(date.getTime())) return t('notAvailable')
            return format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
        } catch (error) {
            console.error('Failed to parse reviewedAt date:', error)
            return t('notAvailable')
        }
    }, [reviewedAt, format, t])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="completed" customText={t('verified')} />
            <Card position="single" className="pb-4">
                <PaymentInfoRow label={t('verifiedOn')} value={verifiedOn} />
                <PaymentInfoRow
                    label={t('pointsEarned')}
                    value={
                        <div className="flex items-center gap-2">
                            <Image src={STAR_STRAIGHT_ICON} alt={t('starAlt')} width={16} height={16} />
                            <span>{format.number(KYC_BONUS_POINTS)}</span>
                        </div>
                    }
                    hideBottomBorder
                />
            </Card>
        </div>
    )
}
