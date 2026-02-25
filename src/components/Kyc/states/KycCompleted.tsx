import Card from '@/components/Global/Card'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import { CountryRegionRow } from '../CountryRegionRow'
import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'

// @dev TODO: Remove hardcoded KYC points - this should come from backend
// See comment in KycStatusItem.tsx for proper implementation plan
const KYC_BONUS_POINTS = 2000

// this component shows the kyc status when it's completed/approved.
export const KycCompleted = ({
    bridgeKycApprovedAt,
    countryCode,
    isBridge,
}: {
    bridgeKycApprovedAt?: string
    countryCode?: string | null
    isBridge?: boolean
}) => {
    const verifiedOn = useMemo(() => {
        if (!bridgeKycApprovedAt) return 'N/A'
        try {
            return formatDate(new Date(bridgeKycApprovedAt))
        } catch (error) {
            console.error('Failed to parse kycCompletedAt date:', error)
            return 'N/A'
        }
    }, [bridgeKycApprovedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="completed" />
            <Card position="single">
                <PaymentInfoRow label="Verified on" value={verifiedOn} />
                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} />
                <PaymentInfoRow
                    label="Points earned"
                    value={
                        <div className="flex items-center gap-2">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                            <span>{KYC_BONUS_POINTS}</span>
                        </div>
                    }
                />
                <PaymentInfoRow label="Status" value="You are now verified. Enjoy Peanut!" hideBottomBorder />
            </Card>
        </div>
    )
}
