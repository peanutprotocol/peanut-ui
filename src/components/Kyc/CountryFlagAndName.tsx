import Image from 'next/image'
import { countryData } from '../AddMoney/consts'
import IconStack from '../Global/IconStack'

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
                    icons={[
                        'https://flagcdn.com/w160/us.png',
                        'https://flagcdn.com/w160/eu.png',
                        'https://flagcdn.com/w160/mx.png',
                    ]}
                    iconSize={80}
                    imageClassName="h-5 w-5 min-h-5 min-w-5 rounded-full object-cover object-center shadow-sm"
                />
            ) : (
                <Image
                    src={`https://flagcdn.com/w160/${countryCode?.toLowerCase()}.png`}
                    alt={`${countryName} flag`}
                    width={80}
                    height={80}
                    className="h-5 w-5 rounded-full object-cover object-center shadow-sm"
                    loading="lazy"
                />
            )}
            {isBridgeRegion ? 'US/EU/MX' : countryName}
        </div>
    )
}
