import { useTranslations } from 'next-intl'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { CountryFlagAndName } from './CountryFlagAndName'

interface CountryRegionRowProps {
    countryCode?: string | null
    isBridge?: boolean
    hideBottomBorder?: boolean
}

export const CountryRegionRow = ({ countryCode, isBridge, hideBottomBorder }: CountryRegionRowProps) => {
    const t = useTranslations('kyc')

    if (!isBridge && !countryCode) {
        return null
    }

    return (
        <PaymentInfoRow
            label={t('countryRegion')}
            value={<CountryFlagAndName countryCode={countryCode ?? ''} isBridgeRegion={isBridge} />}
            hideBottomBorder={hideBottomBorder}
        />
    )
}
