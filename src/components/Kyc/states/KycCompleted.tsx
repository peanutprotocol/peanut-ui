import Card from '@/components/Global/Card'
import InfoCard from '@/components/Global/InfoCard'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { REGION_UNLOCK_ITEMS } from '@/components/IdentityVerification/StartVerificationModal'
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
    region,
}: {
    bridgeKycApprovedAt?: string
    countryCode?: string | null
    isBridge?: boolean
    region?: 'STANDARD' | 'LATAM'
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

    const regionPath = region === 'LATAM' ? 'latam' : 'europe'
    const benefits = REGION_UNLOCK_ITEMS[regionPath] ?? []

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="completed" customText="Verified" />
            <Card position="single" className="pb-4">
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
                {benefits.length > 0 && (
                    <div className="mt-4">
                        <h2 className="mb-2 text-xs font-bold">What you've unlocked:</h2>
                        <InfoCard
                            variant="info"
                            itemIcon="check"
                            itemIconSize={12}
                            itemIconClassName="text-secondary-7"
                            items={benefits}
                        />
                    </div>
                )}
            </Card>
        </div>
    )
}
