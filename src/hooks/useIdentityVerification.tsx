import { EUROPE_GLOBE_ICON, LATAM_GLOBE_ICON, NORTH_AMERICA_GLOBE_ICON, REST_OF_WORLD_GLOBE_ICON } from '@/assets'
import type { StaticImageData } from 'next/image'
import useKycStatus from './useKycStatus'
import { useMemo, useCallback } from 'react'
import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { BRIDGE_ALPHA3_TO_ALPHA2, MantecaSupportedExchanges, countryData } from '@/components/AddMoney/consts'
import React from 'react'

/** Represents a geographic region with its display information */
export type Region = {
    path: string
    name: string
    icon: StaticImageData | string
    description?: string
}

/** Represents a feature that gets unlocked after identity verification */
export type VerificationUnlockItem = {
    title: React.ReactNode | string
    type: 'bridge' | 'manteca'
}

// Manteca handles LATAM countries (Argentina, Brazil, Mexico, etc.)
const MANTECA_SUPPORTED_REGIONS = ['LATAM']

// Bridge handles North America and Europe
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

// Special case: Users with Bridge KYC can do QR payments in these countries
// even without full Manteca KYC
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

const BRIDGE_SUPPORTED_LATAM_COUNTRIES: Region[] = [
    {
        path: 'mexico',
        name: 'Mexico',
        icon: 'https://flagcdn.com/w160/mx.png',
    },
]

/**
 * Hook for managing identity verification (KYC) status and region access.
 *
 * This hook handles two KYC providers:
 * - Bridge: Covers North America and Europe (ACH, Wire, SEPA transfers)
 * - Manteca: Covers LATAM countries (Bank transfers + QR payments)
 *
 * Users can complete one or both KYC processes to unlock different regions.
 * Special case: Bridge KYC also unlocks QR payments in Argentina and Brazil.
 *
 * @returns {Object} Identity verification utilities
 * @returns {Region[]} lockedRegions - Regions the user hasn't unlocked yet
 * @returns {Region[]} unlockedRegions - Regions the user has access to
 * @returns {Function} isMantecaSupportedCountry - Check if a country uses Manteca
 * @returns {Function} isVerifiedForCountry - Check if user is verified for a specific country
 * @returns {Function} isRegionAlreadyUnlocked - Check if a region path is already unlocked
 * @returns {Function} getCountryTitle - Get the display name for a country code
 * @returns {Function} getVerificationUnlockItems - Get list of features unlocked by verification
 */
export const useIdentityVerification = () => {
    const { user } = useAuth()
    const { isUserBridgeKycApproved, isUserMantecaKycApproved } = useKycStatus()

    /**
     * Check if a country is supported by Manteca (LATAM countries).
     * @param code - Country code (e.g., 'AR', 'BR', 'MX')
     * @returns true if the country is supported by Manteca
     */
    const isMantecaSupportedCountry = useCallback((code: string) => {
        const upper = code.toUpperCase()
        return Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, upper)
    }, [])

    /**
     * Check if the user is verified for a specific country.
     *
     * Logic:
     * - For Manteca countries: User must have an ACTIVE Manteca verification for that specific country
     * - For Bridge countries: User just needs Bridge KYC approval
     *
     * @param code - Country code (e.g., 'US', 'GB', 'AR')
     * @returns true if user has the required verification
     */
    const isVerifiedForCountry = useCallback(
        (code: string) => {
            const upper = code.toUpperCase()

            // Check if user has active Manteca verification for this specific country
            const mantecaActive =
                user?.user.kycVerifications?.some(
                    (v) =>
                        v.provider === 'MANTECA' &&
                        (v.mantecaGeo || '').toUpperCase() === upper &&
                        v.status === MantecaKycStatus.ACTIVE
                ) ?? false

            // Manteca countries need country-specific verification, others just need Bridge KYC
            return isMantecaSupportedCountry(upper) ? mantecaActive : isUserBridgeKycApproved
        },
        [user, isUserBridgeKycApproved, isMantecaSupportedCountry]
    )

    /**
     * Calculate which regions are locked vs unlocked for the current user.
     *
     * Region unlock logic:
     * - Bridge KYC → Unlocks North America, Mexico & Europe
     * - Manteca KYC → Unlocks LATAM
     * - Bridge KYC (without Manteca) → Also gets QR-only access to Argentina & Brazil
     *
     */
    const { lockedRegions, unlockedRegions } = useMemo(() => {
        const isBridgeApproved = isUserBridgeKycApproved
        const isMantecaApproved = isUserMantecaKycApproved

        // Helper to check if a region should be unlocked
        const isRegionUnlocked = (regionName: string) => {
            return (
                (isBridgeApproved && BRIDGE_SUPPORTED_REGIONS.includes(regionName)) ||
                (isMantecaApproved && MANTECA_SUPPORTED_REGIONS.includes(regionName))
            )
        }

        const unlocked = SUPPORTED_REGIONS.filter((region) => isRegionUnlocked(region.name))
        const locked = SUPPORTED_REGIONS.filter((region) => !isRegionUnlocked(region.name))

        // Bridge users get QR payment access in Argentina & Brazil
        // even without full Manteca KYC (which unlocks bank transfers too)
        if (isBridgeApproved && !isMantecaApproved) {
            unlocked.push(...MANTECA_QR_ONLY_REGIONS, ...BRIDGE_SUPPORTED_LATAM_COUNTRIES)
        }

        return {
            lockedRegions: locked,
            unlockedRegions: unlocked,
        }
    }, [isUserBridgeKycApproved, isUserMantecaKycApproved])

    /**
     * Check if a region is already unlocked by comparing region paths.
     * @param regionPath - Region path to check (e.g., 'north-america', 'latam')
     * @returns true if the region is in the user's unlocked regions
     */
    const isRegionAlreadyUnlocked = useCallback(
        (regionPath: string) => {
            return unlockedRegions.some((region) => region.path.toLowerCase() === regionPath.toLowerCase())
        },
        [unlockedRegions]
    )

    /**
     * Get the human-readable country name from a country code.
     * @param countryCode - ISO country code (e.g., 'US', 'BR', 'AR')
     * @returns Country display name or null if not found
     */
    const getCountryTitle = useCallback((countryCode: string) => {
        return countryData.find((country) => country.id.toUpperCase() === countryCode.toUpperCase())?.title ?? null
    }, [])

    /**
     * Get a list of features that will be unlocked after verification.
     * Used to show users what they'll gain access to.
     *
     * @param countryTitle - Optional country name to personalize the messaging
     * @returns Array of unlock items with title and which KYC provider unlocks it
     */
    const getVerificationUnlockItems = useCallback((countryTitle?: string): VerificationUnlockItem[] => {
        return [
            {
                title: (
                    <p>
                        QR Payments in <b>Argentina and Brazil</b>
                    </p>
                ),
                type: 'bridge',
            },
            {
                title: (
                    <p>
                        <b>United States</b> ACH and Wire transfers
                    </p>
                ),
                type: 'bridge',
            },
            {
                title: (
                    <p>
                        <b>Europe</b> SEPA transfers (+30 countries)
                    </p>
                ),
                type: 'bridge',
            },
            {
                title: (
                    <p>
                        <b>Mexico</b> SPEI transfers
                    </p>
                ),
                type: 'bridge',
            },
            {
                // Important: This uses the user's verified ID country, not their selected country
                // Example: User picks Argentina but has Brazil ID → they get QR in Argentina
                // but bank transfers only work in Brazil (their verified country)
                title: `Bank transfers to your own accounts in ${countryTitle || 'your country'}`,
                type: 'manteca',
            },
            {
                title: 'QR Payments in Brazil and Argentina',
                type: 'manteca',
            },
        ]
    }, [])

    const isBridgeSupportedCountry = (code: string) => {
        const upper = code.toUpperCase()
        return (
            upper === 'US' ||
            upper === 'MX' ||
            Object.keys(BRIDGE_ALPHA3_TO_ALPHA2).includes(upper) ||
            Object.values(BRIDGE_ALPHA3_TO_ALPHA2).includes(upper)
        )
    }

    return {
        lockedRegions,
        unlockedRegions,
        isMantecaSupportedCountry,
        isVerifiedForCountry,
        isRegionAlreadyUnlocked,
        getCountryTitle,
        getVerificationUnlockItems,
        isBridgeSupportedCountry,
    }
}
