'use client'

/**
 * Recoverable-balance discovery for /recover-funds (TASK-21829).
 *
 * Fetches the wallet portfolio through the backend proxy, filters it to the
 * recoverable chains, and appends the manual Linea USDC row (Mobula never
 * returns Linea — that balance exists ONLY via a direct readContract).
 *
 * Failure semantics — the part this hook exists to make testable:
 * - portfolio fetch rejects (backend 404 "unavailable", 5xx, transport) →
 *   error=true, retryable. Never "no tokens".
 * - Linea read rejects with NO other recoverable balances → error=true:
 *   telling the user "no tokens to recover" on the strength of a failed
 *   lookup would be a false statement about their money.
 * - Linea read rejects but other balances exist → the list renders without
 *   the Linea row (captured to Sentry); hiding a user's other tokens over a
 *   Linea RPC hiccup is the worse trade.
 */

import { useState, useEffect, useCallback } from 'react'
import { erc20Abi, formatUnits } from 'viem'
import type { Address } from 'viem'
import { mainnet, base, linea } from 'viem/chains'
import { captureException } from '@sentry/nextjs'
import { type IUserBalance } from '@/interfaces/interfaces'
import { fetchWalletBalances } from '@/services/tokens-price'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { areEvmAddressesEqual, getTokenLogo } from '@/utils/general.utils'
import { getPublicClient } from '@/app/actions/clients'

// Mobula does not return Linea balances; one known user balance holds USDC in
// Linea, so it is fetched manually.
export const USDC_IN_LINEA = '0x176211869cA2b568f2A7D4EE941E073a821EE1ff'

export const RECOVERABLE_CHAINS = [PEANUT_WALLET_CHAIN, mainnet, base, linea]

export function useRecoverableBalances(peanutAddress: string | undefined) {
    const [tokenBalances, setTokenBalances] = useState<IUserBalance[]>([])
    const [fetchingBalances, setFetchingBalances] = useState(true)
    const [balancesError, setBalancesError] = useState(false)
    const [fetchNonce, setFetchNonce] = useState(0)

    const retry = useCallback(() => setFetchNonce((n) => n + 1), [])

    useEffect(() => {
        if (!peanutAddress) return
        let cancelled = false
        const fetchBalances = async () => {
            setFetchingBalances(true)
            setBalancesError(false)
            try {
                // A rejection here used to escape the effect unhandled and leave
                // fetchingBalances stuck true — the page hung on the mascot
                // loader forever whenever the balance fetch failed (TASK-21829).
                const [balancesResult, lineaResult] = await Promise.allSettled([
                    fetchWalletBalances(peanutAddress),
                    getPublicClient(linea.id).readContract({
                        address: USDC_IN_LINEA,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [peanutAddress as Address],
                    }),
                ])
                if (cancelled) return
                if (balancesResult.status === 'rejected') throw balancesResult.reason
                const recoverableBalances = balancesResult.value.balances.filter(
                    (b) =>
                        RECOVERABLE_CHAINS.some((chain) => b.chainId === chain.id.toString()) &&
                        !areEvmAddressesEqual(PEANUT_WALLET_TOKEN, b.address)
                )
                if (lineaResult.status === 'rejected') {
                    captureException(lineaResult.reason)
                    if (recoverableBalances.length === 0) {
                        setBalancesError(true)
                        return
                    }
                }
                const lineaBalance = lineaResult.status === 'fulfilled' ? lineaResult.value : 0n
                if (!!lineaBalance) {
                    recoverableBalances.push({
                        chainId: linea.id.toString(),
                        address: USDC_IN_LINEA,
                        name: 'USDC',
                        symbol: 'USDC',
                        decimals: 6,
                        price: 1,
                        amount: Number(formatUnits(lineaBalance, 6)),
                        currency: 'usd',
                        logoURI: getTokenLogo('USDC'),
                        value: formatUnits(lineaBalance, 6),
                    })
                }
                setTokenBalances(recoverableBalances)
            } catch {
                if (cancelled) return
                // No captureException here: the only rejection reaching this
                // catch is the portfolio fetch, and apiFetch/fetchWithSentry
                // already reported it — a second capture per occurrence would
                // duplicate the issue under a different fingerprint. The Linea
                // RPC read above is the one leg Sentry has not seen.
                setBalancesError(true)
            } finally {
                if (!cancelled) setFetchingBalances(false)
            }
        }
        fetchBalances()
        return () => {
            cancelled = true
        }
    }, [peanutAddress, fetchNonce])

    return { tokenBalances, setTokenBalances, fetchingBalances, balancesError, retry }
}
