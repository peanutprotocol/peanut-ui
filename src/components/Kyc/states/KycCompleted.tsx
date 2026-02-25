import Card from '@/components/Global/Card'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import { CountryRegionRow } from '../CountryRegionRow'
import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'
import { type IUserRail } from '@/interfaces'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'

// @dev TODO: Remove hardcoded KYC points - this should come from backend
// See comment in KycStatusItem.tsx for proper implementation plan
const KYC_BONUS_POINTS = 2000

// this component shows the kyc status when it's completed/approved.
export const KycCompleted = ({
    bridgeKycApprovedAt,
    countryCode,
    isBridge,
    rails,
}: {
    bridgeKycApprovedAt?: string
    countryCode?: string | null
    isBridge?: boolean
    rails?: IUserRail[]
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

    const enabledRails = useMemo(() => (rails ?? []).filter((r) => r.status === 'ENABLED'), [rails])

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
            {enabledRails.length > 0 && (
                <Card position="single">
                    {enabledRails.map((r, index) => (
                        <PaymentInfoRow
                            key={r.id}
                            label={
                                <div className="flex items-center gap-2">
                                    {getCurrencyFlagUrl(r.rail.method.currency) && (
                                        <Image
                                            src={getCurrencyFlagUrl(r.rail.method.currency)!}
                                            alt={`${r.rail.method.currency} flag`}
                                            width={80}
                                            height={80}
                                            className="h-4 w-4 rounded-full object-cover object-center"
                                            loading="lazy"
                                        />
                                    )}
                                    <span>{r.rail.method.name}</span>
                                </div>
                            }
                            value={r.rail.method.currency}
                            hideBottomBorder={index === enabledRails.length - 1}
                        />
                    ))}
                </Card>
            )}
        </div>
    )
}
