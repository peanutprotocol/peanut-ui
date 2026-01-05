import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KycStatusItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import { CountryRegionRow } from '../CountryRegionRow'

// this component shows the kyc status while it's being processed.
export const KycProcessing = ({
    bridgeKycStartedAt,
    countryCode,
    isBridge,
}: {
    bridgeKycStartedAt?: string
    countryCode?: string | null
    isBridge?: boolean
}) => {
    const submittedOn = useMemo(() => {
        if (!bridgeKycStartedAt) return 'N/A'
        try {
            return formatDate(new Date(bridgeKycStartedAt))
        } catch (error) {
            console.error('Failed to parse bridgeKycStartedAt date:', error)
            return 'N/A'
        }
    }, [bridgeKycStartedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="processing" />
            <Card position="single">
                <PaymentInfoRow label="Submitted" value={submittedOn} />
                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} />
                <PaymentInfoRow
                    label="Status"
                    value="We're reviewing your documents. This usually takes 5-10 min."
                    hideBottomBorder
                />
            </Card>
        </div>
    )
}
