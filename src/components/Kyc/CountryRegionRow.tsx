import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { CountryFlagAndName } from './CountryFlagAndName'

interface CountryRegionRowProps {
    countryCode?: string | null
    isBridge?: boolean
    hideBottomBorder?: boolean
}

export const CountryRegionRow = ({ countryCode, isBridge, hideBottomBorder }: CountryRegionRowProps) => {
    if (!isBridge && !countryCode) {
        return null
    }

    return (
        <PaymentInfoRow
            label="Country/Region"
            value={<CountryFlagAndName countryCode={countryCode ?? ''} isBridgeRegion={isBridge} />}
            hideBottomBorder={hideBottomBorder}
        />
    )
}
