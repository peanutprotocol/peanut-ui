import Card from '@/components/Global/Card'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'

// @dev TODO: Remove hardcoded KYC points - this should come from backend
// See comment in KycStatusItem.tsx for proper implementation plan
const KYC_BONUS_POINTS = 2000

// this component shows the identity-verification status when it's completed/approved.
export const KycCompleted = ({ reviewedAt }: { reviewedAt?: string }) => {
    const verifiedOn = useMemo(() => {
        if (!reviewedAt) return 'N/A'
        try {
            return formatDate(new Date(reviewedAt))
        } catch (error) {
            console.error('Failed to parse reviewedAt date:', error)
            return 'N/A'
        }
    }, [reviewedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="completed" customText="Verified" />
            <Card position="single" className="pb-4">
                <PaymentInfoRow label="Verified on" value={verifiedOn} />
                <PaymentInfoRow
                    label="Points earned"
                    value={
                        <div className="flex items-center gap-2">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                            <span>{KYC_BONUS_POINTS}</span>
                        </div>
                    }
                    hideBottomBorder
                />
            </Card>
        </div>
    )
}
