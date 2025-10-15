'use server'

import { unstable_cache } from 'next/cache'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants'
import { countryData } from '@/components/AddMoney/consts'

type BridgeCustomer = {
    id: string
    email: string
    type: string
    status?: string
    residential_address?: {
        subdivision?: string | null
        country?: string | null
    } | null
}

// build a comprehensive ISO3 -> ISO2 map from our country list to normalize country codes and avoid issues with bridge kyc
const ISO3_TO_ISO2: Record<string, string> = (() => {
    const map: Record<string, string> = {}
    for (const c of countryData) {
        const iso2 = (c as any).iso2 || c.id
        const iso3 = (c as any).iso3
        if (iso2 && iso3) {
            map[String(iso3).toUpperCase()] = String(iso2).toUpperCase()
        }
    }
    return map
})()

const normalizeCountry = (input?: string | null): string | null => {
    if (!input) return null
    const upper = input.toUpperCase()
    if (upper.length === 2) return upper
    return ISO3_TO_ISO2[upper] ?? null
}

export const getBridgeCustomerCountry = async (
    bridgeCustomerId: string
): Promise<{ countryCode: string | null; rawCountry: string | null }> => {
    const runner = unstable_cache(
        async () => {
            const response = await fetch(`${PEANUT_API_URL}/bridge/customers/${bridgeCustomerId}` as string, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': PEANUT_API_KEY,
                },
                cache: 'no-store',
            })

            if (!response.ok) {
                // do not throw to avoid breaking callers; return nulls for graceful fallback
                return { countryCode: null, rawCountry: null } as const
            }
            const data = (await response.json()) as BridgeCustomer
            const raw = data?.residential_address?.country ?? null
            const normalized = normalizeCountry(raw)
            console.log('normalized kushagra', normalized)
            return { countryCode: normalized, rawCountry: raw }
        },
        ['getBridgeCustomerCountry', bridgeCustomerId],
        { revalidate: 5 * 60 }
    )

    return runner()
}
