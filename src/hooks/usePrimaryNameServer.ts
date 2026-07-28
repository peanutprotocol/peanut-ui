'use client'

import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { serverFetch } from '@/utils/api-fetch'

const PRIMARY_NAME_TTL_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * ENS reverse-lookup (address → primary name) resolved SERVER-SIDE via the
 * backend `/ens/reverse` endpoint, instead of a client call to the mainnet RPC.
 *
 * Why: on native the WebView origin (`capacitor://localhost` / `https://localhost`)
 * is rejected by the RPC's CORS policy, so the client-side `usePrimaryName`
 * (JustaName, `priority: 'onChain'`) always failed on mobile and the feed fell
 * back to the raw address. The backend has no such origin restriction and is
 * already CORS-allowed for native, so this resolves identically on web and
 * native. Drop-in for `@justaname.id/react`'s `usePrimaryName` — same
 * `{ primaryName }` shape.
 *
 * Fail-safe: any non-OK response (incl. a backend that doesn't yet expose the
 * route) yields `undefined`, so callers degrade to the address exactly as before.
 */
export function usePrimaryNameServer(address?: string): { primaryName: string | undefined } {
    const enabled = !!address && isAddress(address)

    const { data } = useQuery({
        queryKey: ['ens-primary-name', address?.toLowerCase()],
        enabled,
        staleTime: PRIMARY_NAME_TTL_MS,
        gcTime: PRIMARY_NAME_TTL_MS,
        retry: false,
        queryFn: async (): Promise<string | null> => {
            const res = await serverFetch(`/ens/reverse/${address}`, { method: 'GET' })
            if (!res.ok) return null
            const json = (await res.json()) as { name?: string | null }
            return json.name ?? null
        },
    })

    return { primaryName: data ?? undefined }
}
