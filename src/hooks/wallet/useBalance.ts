import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { peanutPublicClient } from '@/app/actions/clients'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import type { Address } from 'viem'

/**
 * Single source of truth for "read the smart-account USDC balance": the
 * queryKey + queryFn + caching knobs, shared by BOTH consumers so they can
 * never drift on token address, chain, or retry policy.
 *   - the reactive `useBalance` hook below — display / optimistic UI (30s cache)
 *   - the imperative routing reads in the spend hooks via
 *     `fetchLiveSmartUsdcBalance`, which force-refetches this exact query
 *     (`staleTime: 0`) so a spend routes on a live balance AND the cached value
 *     the UI shows gets refreshed in the same call.
 *
 * ⚠️ NOTE: Service Worker CANNOT cache RPC POST requests
 * - Blockchain RPC calls use POST method (not cacheable by Cache Storage API)
 * - See: https://w3c.github.io/ServiceWorker/#cache-put (point 4)
 *
 * Why staleTime: 30s — balances are displayed on many pages; a 30s in-memory
 * cache cuts RPC calls during navigation and avoids provider rate-limiting,
 * while the `refetchInterval` in `useBalance` still refreshes every 30s.
 */
export const smartUsdcBalanceQueryOptions = (address: Address | undefined) => ({
    queryKey: ['balance', address] as const,
    queryFn: async (): Promise<bigint> =>
        peanutPublicClient.readContract({
            address: PEANUT_WALLET_TOKEN as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            // Guarded by `enabled` (useBalance) or a concrete sender address
            // (routing) — never called with undefined in practice.
            args: [address!],
        }),
    staleTime: 30 * 1000, // 30s in-memory cache (no SW caching for POST RPC)
    gcTime: 5 * 60 * 1000, // Keep in memory for 5min
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
})

/**
 * Hook to fetch and auto-refresh the wallet balance using TanStack Query.
 *
 * Backs display + optimistic UI. Spend routing does NOT read this cached value
 * — it force-refetches the same query (see `fetchLiveSmartUsdcBalance`), because
 * card funds are swept smart→collateral and a stale balance mis-routes a spend.
 */
export const useBalance = (address: Address | undefined) =>
    useQuery({
        ...smartUsdcBalanceQueryOptions(address),
        enabled: !!address, // Only run query if address exists
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        refetchOnWindowFocus: true, // Refresh when tab regains focus
        refetchOnReconnect: true, // Refresh after network reconnection
    })
