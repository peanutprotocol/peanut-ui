'use client'

import { useQuery } from '@tanstack/react-query'
import type { paths } from '@/types/api.generated'
import { apiFetch } from '@/utils/api-fetch'

export type KycIntents = paths['/config/kyc-intents']['get']['responses'][200]['content']['application/json']['intents']

const INTENTS = ['qr', 'local', 'card', 'bank'] as const

const parseIntents = (json: unknown): KycIntents | null => {
    const intents = (json as { intents?: Record<string, unknown> } | null)?.intents
    if (!intents) return null
    return INTENTS.every((key) => typeof (intents[key] as { available?: unknown })?.available === 'boolean')
        ? (intents as KycIntents)
        : null
}

async function fetchKycIntents(residence: string): Promise<KycIntents> {
    // public config: no auth, so it must not queue behind token hydration
    const res = await apiFetch(`/config/kyc-intents?residence=${encodeURIComponent(residence)}`, {
        includeAuth: false,
    })
    const intents = res.ok ? parseIntents(await res.json()) : null
    if (!intents) throw new Error('KYC intents unavailable')
    return intents
}

/**
 * What a residence can open, from the same rules the verification applies
 * (GET /config/kyc-intents): sign-up shows exactly what the server will
 * offer. `settled` is false while it loads; `intents` stays undefined when the
 * read failed, so callers fall back to the bundled restriction lists.
 */
export function useKycIntents(residence: string | null | undefined): {
    intents: KycIntents | undefined
    settled: boolean
} {
    const country = residence?.trim().toUpperCase() || null
    const { data, isError } = useQuery({
        queryKey: ['kyc-intents', country],
        queryFn: () => fetchKycIntents(country!),
        enabled: !!country,
        // the answer depends on the country alone and changes with API deploys
        staleTime: 60 * 60_000,
        retry: 1,
    })
    return { intents: data, settled: !!data || isError }
}
