import { EUROPE_GLOBE_ICON, LATAM_GLOBE_ICON, NORTH_AMERICA_GLOBE_ICON, REST_OF_WORLD_GLOBE_ICON } from '@/assets/icons'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { type RailCapability } from '@/types/capabilities'
import { BRIDGE_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import type { StaticImageData } from 'next/image'

/**
 * Region display model + capability-based region-access derivation.
 *
 * MIGRATION-REVIEW: these used to live in `useIdentityVerification` (the Region
 * type, the region constants, getRegionIntent, and the lockedRegions/unlockedRegions
 * memo). The memo derived region access from raw `useKycStatus`/`useUnifiedKycStatus`
 * flags (isBridgeApproved / isMantecaApproved / isSumsubApproved /
 * sumsubVerificationRegionIntent) and raw `user.rails`. Relocated here as a pure,
 * capability-driven function so RegionsVerification + LimitsPageView no longer read
 * the legacy hook. See `deriveRegionAccess` for the faithful field-by-field mapping
 * and the flagged contract gaps (Sumsub has no rail in the capability model).
 */

/** Represents a geographic region with its display information */
export type Region = {
    path: string
    name: string
    icon: StaticImageData | string
    description?: string
}

// latam region access is separate from the ar/br manteca country gate.
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
        icon: getFlagUrl('ar'),
        description: 'Only Mercado Pago QR payments',
    },
    {
        path: 'brazil',
        name: 'Brazil',
        icon: getFlagUrl('br'),
        description: 'Only PIX QR payments',
    },
]

const BRIDGE_SUPPORTED_LATAM_COUNTRIES: Region[] = [
    {
        path: 'mexico',
        name: 'Mexico',
        icon: getFlagUrl('mx'),
    },
]

/** maps a region path to the sumsub kyc template intent */
export const getRegionIntent = (regionPath: string): KYCRegionIntent => {
    return regionPath === 'latam' ? 'LATAM' : 'STANDARD'
}

/**
 * True when the provider has at least one rail in a functional or in-progress
 * state (enabled / pending / requires-info). This is the capability-model
 * equivalent of the old hook's `hasProviderAccess` (which accepted
 * ENABLED / REQUIRES_INFORMATION / REQUIRES_EXTRA_INFORMATION) AND of the
 * `sumsubVerificationRegionIntent === 'LATAM'` optimism (a Manteca rail created
 * after Sumsub-LATAM approval is `pending` before it enables). We treat a
 * mid-flight rail as "region unlocked" to preserve the old optimistic display.
 */
const hasFunctionalRail = (rails: RailCapability[], provider: 'bridge' | 'manteca'): boolean =>
    rails.some(
        (rail) =>
            rail.provider === provider &&
            (rail.status === 'enabled' || rail.status === 'pending' || rail.status === 'requires-info')
    )

/**
 * Derive which SUPPORTED_REGIONS are unlocked vs locked for the user, from the
 * backend capability model. Faithful mapping of the old `useIdentityVerification`
 * memo (lines 161–221 of the legacy hook):
 *
 *   - Bridge regions (North America, Europe) ← any FUNCTIONAL Bridge rail.
 *       Old: `isSumsubApproved ? hasProviderAccess('BRIDGE') : isBridgeApproved`.
 *       Union of those two ≈ a functional Bridge rail.
 *   - LATAM ← any FUNCTIONAL Manteca rail.
 *       Old: `isSumsubApproved ? (regionIntent==='LATAM' || isMantecaApproved) : isMantecaApproved`.
 *       The regionIntent==='LATAM' optimism = a Manteca rail exists but hasn't
 *       enabled yet ⇒ `pending`/`requires-info`, covered by hasFunctionalRail.
 *   - Rest of the world ← `isKycApproved` (any enabled rail).
 *       CONTRACT GAP (flagged): old gate was `isSumsubApproved` alone. Sumsub has
 *       NO rail in the capability model; the established proxy across this migration
 *       is "any enabled rail ⇒ identity cleared at least once". DIVERGENCE: a
 *       Sumsub-approved user with ZERO enabled rails would have seen Rest-of-world
 *       unlocked before but won't now. In practice an approved user holds ≥1
 *       functional rail, so this only bites the (transient) pre-rail window.
 *   - QR-only AR/BR + Mexico ← Bridge enabled AND no functional Manteca rail.
 *       CONTRACT GAP (flagged): old condition was
 *       `isBridgeApproved && !isMantecaApproved && !isSumsubApproved` — the
 *       `!isSumsubApproved` clause targeted the legacy direct-Bridge cohort
 *       (Bridge-approved without ever doing Sumsub). That clause cannot be
 *       expressed in capabilities (no Sumsub signal). Dropped it; the remaining
 *       "Bridge enabled, no full Manteca rail ⇒ surface AR/BR QR + MX" preserves
 *       the user-visible "Bridge users get QR in AR/BR" behavior for the common case.
 */
export function deriveRegionAccess(rails: RailCapability[]): { unlockedRegions: Region[]; lockedRegions: Region[] } {
    const hasBridge = hasFunctionalRail(rails, 'bridge')
    const hasManteca = hasFunctionalRail(rails, 'manteca')
    const isKycApproved = rails.some((rail) => rail.status === 'enabled')
    const isBridgeEnabled = rails.some((rail) => rail.provider === 'bridge' && rail.status === 'enabled')

    const isRegionUnlocked = (regionName: string): boolean => {
        if (regionName === 'Rest of the world') return isKycApproved
        if (BRIDGE_SUPPORTED_REGIONS.includes(regionName)) return hasBridge
        if (MANTECA_SUPPORTED_REGIONS.includes(regionName)) return hasManteca
        return false
    }

    const unlocked = SUPPORTED_REGIONS.filter((region) => isRegionUnlocked(region.name))
    const locked = SUPPORTED_REGIONS.filter((region) => !isRegionUnlocked(region.name))

    // bridge users get qr payment access in argentina & brazil (+ MX SPEI)
    // even without a full Manteca rail (which unlocks bank transfers too)
    if (isBridgeEnabled && !hasManteca) {
        unlocked.push(...MANTECA_QR_ONLY_REGIONS, ...BRIDGE_SUPPORTED_LATAM_COUNTRIES)
    }

    return { unlockedRegions: unlocked, lockedRegions: locked }
}

// precompute bridge alpha2 values for O(1) lookup
const BRIDGE_ALPHA2_SET = new Set(Object.values(BRIDGE_ALPHA3_TO_ALPHA2))

/**
 * True when a country is served by Bridge (US, MX, or any EU/UK country in the
 * Bridge alpha3 map). Pure static lookup — never reads KYC/capability state.
 *
 * MIGRATION-REVIEW: relocated verbatim from `useIdentityVerification` (the only
 * remaining straggler consumer is withdraw/[country]/bank, which used it purely
 * as a routing guard). Behavior is identical to the old hook method.
 */
export const isBridgeSupportedCountry = (code: string): boolean => {
    const upper = code.toUpperCase()
    return upper === 'US' || upper === 'MX' || upper in BRIDGE_ALPHA3_TO_ALPHA2 || BRIDGE_ALPHA2_SET.has(upper)
}

/**
 * True when the user has an enabled bank rail in `countryCode` — provider-blind.
 *
 *   - LATAM country (AR/BR/…): bank rail for that country with `deposit` op
 *     enabled (full-tier — pool-only rails enable `pay` only).
 *   - Other countries: any enabled bank rail.
 */
export function isVerifiedForCountry(rails: RailCapability[], countryCode: string): boolean {
    const upper = countryCode.toUpperCase()
    if (isMantecaSupportedCountryCode(upper)) {
        return rails.some(
            (rail) =>
                rail.channel === 'bank' &&
                rail.country.toUpperCase() === upper &&
                (rail.operations?.deposit ?? rail.status) === 'enabled'
        )
    }
    return rails.some((rail) => rail.channel === 'bank' && rail.status === 'enabled')
}
