import Image from 'next/image'
import { countryData } from '../AddMoney/consts'
import IconStack from '../Global/IconStack'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'

interface CountryFlagAndNameProps {
    countryCode?: string
    isBridgeRegion?: boolean
}

export const CountryFlagAndName = ({ countryCode, isBridgeRegion }: CountryFlagAndNameProps) => {
    const countryName = countryData.find((c) => c.id === countryCode?.toUpperCase())?.title
    return (
        <div className="flex items-center gap-2">
            {isBridgeRegion ? (
                <IconStack
                    icons={[getFlagUrl('us'), getFlagUrl('eu'), getFlagUrl('gb'), getFlagUrl('mx')]}
                    iconSize={80}
                    imageClassName="h-5 w-5 min-h-5 min-w-5 rounded-full object-cover object-center shadow-sm"
                />
            ) : (
                <Image
                    src={getFlagUrl(countryCode)}
                    alt={`${countryName} flag`}
                    width={80}
                    height={80}
                    className="h-5 w-5 rounded-full object-cover object-center shadow-sm"
                    loading="lazy"
                />
            )}
            {isBridgeRegion ? 'US/EU/UK/MX' : countryName}
        </div>
    )
}
