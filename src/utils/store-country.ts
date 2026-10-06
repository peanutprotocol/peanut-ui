import countries from 'i18n-iso-countries'
import { isIOSNative } from './capacitor'
import { nativeCapability } from './native-capability'

interface StoreCountryPlugin {
    getCurrent(options?: undefined): Promise<{ countryCode: string | null }>
}

export interface StoreCountry {
    /** ISO 3166-1 alpha-2, on both platforms. */
    countryCode: string
    source: 'app-store' | 'google-play'
}

const StoreCountryBridge = nativeCapability<StoreCountryPlugin>('StoreCountry', { platforms: ['ios', 'android'] })
export const STORE_COUNTRY_TIMEOUT_MS = 6000

/**
 * A fresh, transient store-region read for a product-availability decision.
 * This is the CURRENT store country, not original download country, residence,
 * or verified eligibility. Do not persist it, attach it to analytics/person
 * properties, or silently substitute IP/device locale when it is unknown.
 */
export async function getStoreCountry(): Promise<StoreCountry | null> {
    if (!StoreCountryBridge.isSupportedPlatform()) return null
    const source = isIOSNative() ? 'app-store' : 'google-play'
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        const result = await Promise.race([
            StoreCountryBridge.call('getCurrent', undefined, () => ({ countryCode: null })),
            new Promise<null>((resolve) => {
                timeout = setTimeout(() => resolve(null), STORE_COUNTRY_TIMEOUT_MS)
            }),
        ])
        const code = result?.countryCode
        // StoreKit uses alpha-3; Play uses alpha-2. Reject malformed/native
        // responses instead of letting an arbitrary string grant availability.
        if (typeof code !== 'string') return null
        const normalized = code.toUpperCase()
        if (!/^[A-Z]{2,3}$/.test(normalized) || !countries.isValid(normalized)) return null
        const countryCode = normalized.length === 3 ? countries.alpha3ToAlpha2(normalized) : normalized
        return countryCode ? { countryCode, source } : null
    } finally {
        clearTimeout(timeout)
    }
}
