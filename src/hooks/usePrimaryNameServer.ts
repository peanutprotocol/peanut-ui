'use client'

import { usePrimaryName } from '@justaname.id/react'
import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { serverFetch } from '@/utils/api-fetch'

const PRIMARY_NAME_TTL_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * ENS reverse-lookup (address → primary name), server-first with a client-side
 * fallback.
 *
 * Server-first: the backend `/ens/reverse` endpoint works on native, where the
 * WebView origin (`capacitor://localhost` / `https://localhost`) is rejected by
 * the mainnet RPC's CORS policy and a client lookup can never succeed.
 *
 * Client fallback: the endpoint is not deployed everywhere yet (peanut-api-ts
 * #1237). When the server call fails, fall back to JustaName's client-side
 * on-chain lookup — this keeps ENS names working on web today, and native
 * picks up the server path automatically the moment the endpoint ships,
 * with no frontend change.
 *
 * Drop-in for `@justaname.id/react`'s `usePrimaryName` — same
 * `{ primaryName }` shape. If both paths fail, callers degrade to the raw
 * address exactly as before.
 */
export function usePrimaryNameServer(address?: string): { primaryName: string | undefined } {
    const enabled = !!address && isAddress(address)

    const { data, isError } = useQuery({
        queryKey: ['ens-primary-name', address?.toLowerCase()],
        enabled,
        staleTime: PRIMARY_NAME_TTL_MS,
        gcTime: PRIMARY_NAME_TTL_MS,
        retry: false,
        queryFn: async (): Promise<string | null> => {
            // throw on non-OK so the client fallback below engages, instead of
            // caching a negative result for 24h while the route 404s
            const res = await serverFetch(`/ens/reverse/${address}`, { method: 'GET' })
            if (!res.ok) throw new Error(`ens reverse lookup failed: ${res.status}`)
            const json = (await res.json()) as { name?: string | null }
            return json.name ?? null
        },
    })

    // fallback lookup, only engaged when the server call failed. address stays
    // undefined otherwise, which makes the hook a no-op.
    const { primaryName: clientName } = usePrimaryName({
        address: enabled && isError ? (address as `0x${string}`) : undefined,
        chainId: 1, // mainnet for ens lookups
        priority: 'onChain',
    })

    return { primaryName: data ?? (isError ? clientName : undefined) }
}
