import { EUROPE_GLOBE_ICON, LATAM_GLOBE_ICON, NORTH_AMERICA_GLOBE_ICON, REST_OF_WORLD_GLOBE_ICON } from '@/assets'
import type { StaticImageData } from 'next/image'
import useKycStatus from './useKycStatus'
import { useMemo, useCallback } from 'react'
import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { MantecaSupportedExchanges, countryData } from '@/components/AddMoney/consts'

export type Region = {
    path: string
    name: string
    icon: StaticImageData | string
    description?: string
}

const MANTECA_SUPPORTED_REGIONS = ['LATAM']
const BRIDGE_SUPPORTED_REGIONS = ['North America', 'Europe']

const SUPPORTED_REGIONS: Region[] = [
    {
        path: 'europe',
        name: 'Europe',
        icon: EUROPE_GLOBE_ICON,
    },
    {
        path: 'north-america',
        name: 'North America',
        icon: NORTH_AMERICA_GLOBE_ICON,
    },
    {
        path: 'latam',
        name: 'LATAM',
        icon: LATAM_GLOBE_ICON,
    },
    {
        path: 'rest-of-the-world',
        name: 'Rest of the world',
        icon: REST_OF_WORLD_GLOBE_ICON,
    },
]

const MANTECA_QR_ONLY_REGIONS: Region[] = [
    {
        path: 'argentina',
        name: 'Argentina',
        icon: 'https://flagcdn.com/w160/ar.png',
        description: 'Only Mercado Pago QR payments',
    },
    {
        path: 'brazil',
        name: 'Brazil',
        icon: 'https://flagcdn.com/w160/br.png',
        description: 'Only PIX QR payments',
    },
]

export const useIdentityVerification = () => {
    const { user } = useAuth()
    const { isUserBridgeKycApproved, isUserMantecaKycApproved } = useKycStatus()

    const isMantecaSupportedCountry = useCallback((code: string) => {
        const upper = code.toUpperCase()
        return Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, upper)
    }, [])

    const isVerifiedForCountry = useCallback(
        (code: string) => {
            const upper = code.toUpperCase()
            const mantecaActive =
                user?.user.kycVerifications?.some(
                    (v) =>
                        v.provider === 'MANTECA' &&
                        (v.mantecaGeo || '').toUpperCase() === upper &&
                        v.status === MantecaKycStatus.ACTIVE
                ) ?? false
            return isMantecaSupportedCountry(upper) ? mantecaActive : isUserBridgeKycApproved
        },
        [user, isUserBridgeKycApproved, isMantecaSupportedCountry]
    )

    const { lockedRegions, unlockedRegions } = useMemo(() => {
        const isBridgeApproved = isUserBridgeKycApproved
        const isMantecaApproved = isUserMantecaKycApproved

        const isRegionUnlocked = (regionName: string) => {
            return (
                (isBridgeApproved && BRIDGE_SUPPORTED_REGIONS.includes(regionName)) ||
                (isMantecaApproved && MANTECA_SUPPORTED_REGIONS.includes(regionName))
            )
        }

        const unlocked = SUPPORTED_REGIONS.filter((region) => isRegionUnlocked(region.name))
        const locked = SUPPORTED_REGIONS.filter((region) => !isRegionUnlocked(region.name))

        // If user has completed Bridge KYC but not Manteca, they can do QR payments in Argentina and Brazil
        if (isBridgeApproved && !isMantecaApproved) {
            unlocked.push(...MANTECA_QR_ONLY_REGIONS)
        }

        return {
            lockedRegions: locked,
            unlockedRegions: unlocked,
        }
    }, [isUserBridgeKycApproved, isUserMantecaKycApproved])

    const isRegionAlreadyUnlocked = useCallback(
        (regionPath: string) => {
            return unlockedRegions.some((region) => region.path.toLowerCase() === regionPath.toLowerCase())
        },
        [unlockedRegions]
    )

    const getCountryTitle = useCallback((countryCode: string) => {
        return countryData.find((country) => country.id.toUpperCase() === countryCode.toUpperCase())?.title ?? null
    }, [])

    return {
        lockedRegions,
        unlockedRegions,
        isMantecaSupportedCountry,
        isVerifiedForCountry,
        isRegionAlreadyUnlocked,
        getCountryTitle,
    }
}
