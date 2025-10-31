import { EUROPE_GLOBE_ICON, LATAM_GLOBE_ICON, NORTH_AMERICA_GLOBE_ICON, REST_OF_WORLD_GLOBE_ICON } from '@/assets'
import type { StaticImageData } from 'next/image'
import useKycStatus from './useKycStatus'
import { useMemo } from 'react'

export type Region = {
    name: string
    icon: StaticImageData | string
    description?: string
}

const MANTECA_SUPPORTED_REGIONS = ['LATAM']
const BRIDGE_SUPPORTED_REGIONS = ['North America', 'Europe']

const SUPPORTED_REGIONS: Region[] = [
    {
        name: 'Europe',
        icon: EUROPE_GLOBE_ICON,
    },
    {
        name: 'North America',
        icon: NORTH_AMERICA_GLOBE_ICON,
    },
    {
        name: 'LATAM',
        icon: LATAM_GLOBE_ICON,
    },
    {
        name: 'Rest of the world',
        icon: REST_OF_WORLD_GLOBE_ICON,
    },
]

const MANTECA_QR_ONLY_REGIONS: Region[] = [
    {
        name: 'Argentina',
        icon: 'https://flagcdn.com/w160/ar.png',
        description: 'Only Mercado Pago QR payments',
    },
    {
        name: 'Brazil',
        icon: 'https://flagcdn.com/w160/br.png',
        description: 'Only PIX QR payments',
    },
]

export const useIdentityVerification = () => {
    const { isUserBridgeKycApproved, isUserMantecaKycApproved } = useKycStatus()

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

    return {
        lockedRegions,
        unlockedRegions,
    }
}
