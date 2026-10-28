'use client'

/**
 * Recoverable-balance discovery for /recover-funds (TASK-21829, TASK-23850).
 *
 * Reads balances on-chain, chain by chain: one multicall of `balanceOf` over
 * our token list, Rhino's token list and RECOVER_FUNDS_EXTRA_TOKENS, plus the
 * native balance. Amounts stay raw bigints, so a transfer moves the exact
 * balance. USD values: stablecoins at $1, the native coin at the API's price,
 * anything else none.
 *
 * Failure semantics — the part this hook exists to make testable:
 * - Rhino's list fails → our list plus the extra list are still read. The
 *   service already reported the failure.
 * - a chain's read fails with NO recoverable balances on the others →
 *   error=true, retryable. Telling the user "no tokens to recover" on the
 *   strength of a failed lookup would be a false statement about their money.
 * - a chain's read fails but other balances exist → the list renders without
 *   that chain (captured to Sentry); hiding a user's other tokens over one
 *   RPC hiccup is the worse trade.
 */

import { useState, useEffect, useCallback } from 'react'
import { erc20Abi, formatUnits } from 'viem'
import type { Address, Chain } from 'viem'
import { mainnet, base, linea } from 'viem/chains'
import { captureException } from '@sentry/nextjs'
import { type ChainId, getPublicClient } from '@/app/actions/clients'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { NATIVE_TOKEN_ADDRESS } from '@/constants/tokens.consts'
import { fetchRhinoTokenConfigs } from '@/services/rhino-token-configs'
import { fetchTokenPrice } from '@/services/tokens-price'
import type { RecoverableBalance, RecoverableToken, RhinoTokenConfigs } from '@/types/recover-funds'
import { getTokenLogo, isStableCoin } from '@/utils/general.utils'
import { recoverableTokensForChain } from '@/utils/recoverable-tokens.utils'

export const RECOVERABLE_CHAINS: readonly Chain[] = [PEANUT_WALLET_CHAIN as Chain, mainnet, base, linea]

interface HeldToken {
    chainId: string
    token: RecoverableToken
    rawAmount: bigint
}

/** Every non-zero balance the account holds on one chain. Rejects when the chain's reads fail. */
async function readChainBalances(
    chain: Chain,
    owner: Address,
    rhinoTokens: RhinoTokenConfigs | null
): Promise<HeldToken[]> {
    const chainId = chain.id.toString()
    const tokens = recoverableTokensForChain(chainId, rhinoTokens)
    const client = getPublicClient(chain.id as ChainId)
    const [nativeBalance, tokenResults] = await Promise.all([
        client.getBalance({ address: owner }),
        client.multicall({
            contracts: tokens.map((token) => ({
                address: token.address as Address,
                abi: erc20Abi,
                functionName: 'balanceOf' as const,
                args: [owner] as const,
            })),
            // a listed address that is not a token on this chain fails alone
            allowFailure: true,
        }),
    ])
    const held: HeldToken[] = []
    if (nativeBalance > 0n) {
        const { symbol, name, decimals } = chain.nativeCurrency
        held.push({
            chainId,
            token: { address: NATIVE_TOKEN_ADDRESS, symbol, name, decimals, logoURI: getTokenLogo(symbol) },
            rawAmount: nativeBalance,
        })
    }
    tokenResults.forEach((result, index) => {
        if (result.status === 'success' && result.result > 0n) {
            held.push({ chainId, token: tokens[index], rawAmount: result.result })
        }
    })
    return held
}

/** The native coin's USD price per chain; a failed or missing price is no label, not an error. */
async function nativeUsdPrices(chainIds: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>()
    await Promise.all(
        chainIds.map(async (chainId) => {
            const price = await fetchTokenPrice(NATIVE_TOKEN_ADDRESS, chainId).catch(() => undefined)
            if (price && Number.isFinite(price.price) && price.price > 0) prices.set(chainId, price.price)
        })
    )
    return prices
}

function toBalance({ chainId, token, rawAmount }: HeldToken, nativePrices: Map<string, number>): RecoverableBalance {
    const amount = Number(formatUnits(rawAmount, token.decimals))
    const price = isStableCoin(token.symbol)
        ? 1
        : token.address === NATIVE_TOKEN_ADDRESS
          ? (nativePrices.get(chainId) ?? 0)
          : 0
    return {
        chainId,
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        price,
        amount,
        currency: 'usd',
        logoURI: token.logoURI,
        value: (amount * price).toString(),
        rawAmount,
    }
}

export function useRecoverableBalances(peanutAddress: string | undefined) {
    const [tokenBalances, setTokenBalances] = useState<RecoverableBalance[]>([])
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
                const rhinoTokens = await fetchRhinoTokenConfigs().catch(() => null)
                if (cancelled) return
                const chainResults = await Promise.allSettled(
                    RECOVERABLE_CHAINS.map((chain) => readChainBalances(chain, peanutAddress as Address, rhinoTokens))
                )
                if (cancelled) return
                const held = chainResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
                const failures = chainResults.filter((result) => result.status === 'rejected')
                failures.forEach((failure) => captureException(failure.reason))
                if (failures.length > 0 && held.length === 0) {
                    setBalancesError(true)
                    return
                }
                const nativeChainIds = held
                    .filter((balance) => balance.token.address === NATIVE_TOKEN_ADDRESS)
                    .map((balance) => balance.chainId)
                const nativePrices = await nativeUsdPrices(nativeChainIds)
                if (cancelled) return
                setTokenBalances(held.map((balance) => toBalance(balance, nativePrices)))
            } catch (error) {
                if (cancelled) return
                captureException(error)
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
