'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { isAddress } from 'viem'
import { serverFetch } from '@/utils/api-fetch'
import { lookupPrimaryNameOnChain } from '@/utils/ens-onchain.utils'

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
 * #1237). When the server call fails, fall back to a client-side on-chain
 * lookup — this keeps ENS names working on web today, and native picks up the
 * server path automatically the moment the endpoint ships, with no frontend
 * change.
 *
 * Same `{ primaryName }` shape as before. If both paths fail, callers degrade
 * to the raw address exactly as before.
 */
const CACHE_KEY = 'ens-primary-name-cache'

type NameCache = Record<string, { name: string; ts: number }>

// localstorage warm cache so a fresh page load (mobile reopening the pwa)
// paints the last-known name immediately instead of flashing the raw
// address while the async lookup runs. lookups still revalidate on mount.
function readNameCache(): NameCache {
    if (typeof window === 'undefined') return {}
    try {
        // guard the root shape — JSON.parse("null") etc. passes but would blow up on lookup
        const cache: unknown = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? '{}')
        return cache && typeof cache === 'object' && !Array.isArray(cache) ? (cache as NameCache) : {}
    } catch {
        return {}
    }
}

function getCachedName(address?: string): string | undefined {
    if (!address) return undefined
    const entry = readNameCache()[address.toLowerCase()]
    return entry && Date.now() - entry.ts < PRIMARY_NAME_TTL_MS ? entry.name : undefined
}

function writeCachedName(address: string, name: string | undefined) {
    if (typeof window === 'undefined') return
    try {
        const cache = readNameCache()
        const key = address.toLowerCase()
        if (name) {
            cache[key] = { name, ts: Date.now() }
        } else {
            delete cache[key]
        }
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
        // storage full/blocked — warm cache is best-effort
    }
}

export function usePrimaryNameServer(address?: string): { primaryName: string | undefined } {
    const enabled = !!address && isAddress(address)

    const { data } = useQuery({
        queryKey: ['ens-primary-name', address?.toLowerCase()],
        enabled,
        staleTime: PRIMARY_NAME_TTL_MS,
        gcTime: PRIMARY_NAME_TTL_MS,
        retry: false,
        queryFn: async (): Promise<string | null> => {
            try {
                const res = await serverFetch(`/ens/reverse/${address}`, { method: 'GET' })
                if (!res.ok) throw new Error(`ens reverse lookup failed: ${res.status}`)
                const json = (await res.json()) as { name?: string | null }
                return json.name ?? null
            } catch {
                // On-chain fallback. A rejection here propagates, leaving the
                // query in an error state rather than caching a negative result
                // for 24h while the route 404s.
                return await lookupPrimaryNameOnChain(address as string)
            }
        },
    })

    // authoritative "no name": either path settled null/''. don't mask that
    // with a stale cached name, and evict below so it can't repaint next mount.
    const settledNoName = data === null || data === ''
    const resolved = data || undefined

    useEffect(() => {
        if (!enabled || !address) return
        if (resolved) writeCachedName(address, resolved)
        else if (settledNoName) writeCachedName(address, undefined)
    }, [enabled, address, resolved, settledNoName])

    // read once per address, not on every render — history feeds mount many rows
    const cachedName = useMemo(() => (enabled ? getCachedName(address) : undefined), [enabled, address])

    return { primaryName: resolved ?? (settledNoName ? undefined : cachedName) }
}
