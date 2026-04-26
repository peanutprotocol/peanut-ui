'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { formatUnits, type Hex, type Address } from 'viem'
import { useZeroDev } from '../useZeroDev'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useBalance } from './useBalance'
import { useSendMoney as useSendMoneyMutation } from './useSendMoney'
import { formatCurrency } from '@/utils/general.utils'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '../useRainCardOverview'
import { rainSpendingPowerToWei } from '@/utils/balance.utils'
import { useSpendBundle, type SpendStrategy } from './useSpendBundle'
import type { TransactionIntentKind } from '@/services/rain'

type SendTransactionsOptions = {
    chainId?: string
    /**
     * Total USDC (token smallest units) the bundle needs available on the
     * smart account for its calls to succeed. When set, the kernel UserOp
     * is prepended with a Rain collateral withdraw if the smart-account
     * balance is short but the user's spendable total covers it.
     *
     * Omit for flows that don't move user USDC (e.g., fund recovery from
     * another chain) — legacy behaviour is preserved.
     */
    requiredUsdcAmount?: bigint
    /**
     * Final recipient when the spend is a plain transfer that collateral-only
     * routing could serve (no intermediate kernel calls needed). Omit for
     * approve+deposit-style flows.
     */
    recipient?: Address
    /** User-semantic kind for history categorization. Required whenever
     *  `requiredUsdcAmount` is set (i.e. the bundle may touch Rain collateral). */
    kind?: TransactionIntentKind
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
}

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const { balance: reduxBalance } = useWalletStore()
    const { user } = useAuth()

    // check if address matches user's wallet address
    const userAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier

    // only fetch balance if both address and userAddress are defined AND they match
    const isAddressReady = !!address && !!userAddress && userAddress.toLowerCase() === address.toLowerCase()

    // Use TanStack Query for auto-refreshing balance
    // only fetch balance when the validated address is ready
    const shouldFetchBalance = isAddressReady
    const {
        data: balanceFromQuery,
        isLoading: isFetchingBalance,
        refetch: refetchBalance,
    } = useBalance(shouldFetchBalance ? (address as Address) : undefined)

    // Sync TanStack Query balance with Redux (for backward compatibility)
    useEffect(() => {
        if (balanceFromQuery !== undefined) {
            dispatch(walletActions.setBalance(balanceFromQuery))
        }
    }, [balanceFromQuery, dispatch])

    // Rain collateral overview — loaded here so `sendTransactions` can consult
    // the current `spendingPower` when callers opt into collateral top-up.
    const { overview: rainOverview, isLoading: isRainOverviewLoading } = useRainCardOverview()

    // Mutation for sending money with optimistic updates
    const sendMoneyMutation = useSendMoneyMutation({ address: address as Address | undefined })
    const { spend: spendBundle } = useSpendBundle()

    const sendMoney = useCallback(
        async (toAddress: Address, amountInUsd: string, options?: { kind?: TransactionIntentKind }) => {
            const result = await sendMoneyMutation.mutateAsync({
                toAddress,
                amountInUsd,
                kind: options?.kind,
            })
            // `strategy` lets same-chain callers distinguish "funds left the smart
            // account" (smart-only) from "funds left Rain collateral" (collateral-
            // only/mixed). The latter is reconciled server-side via Rain's webhook
            // → TransactionIntent, so callers can skip legacy recordPayment paths
            // that would otherwise leave an unmatched Charge in history.
            // `intentId` is the receipt handle for collateral/mixed spends —
            // `/receipt/<intentId>?t=<TRANSACTION_INTENT number>`.
            return {
                userOpHash: result.userOpHash,
                txHash: result.txHash,
                receipt: result.receipt ?? null,
                strategy: result.strategy,
                intentId: result.intentId,
            }
        },
        [sendMoneyMutation]
    )

    const sendTransactions = useCallback(
        async (
            unsignedTxs: peanutInterfaces.IPeanutUnsignedTransaction[],
            optionsOrChainId?: SendTransactionsOptions | string
        ) => {
            const options: SendTransactionsOptions =
                typeof optionsOrChainId === 'string' ? { chainId: optionsOrChainId } : (optionsOrChainId ?? {})
            const chainId = options.chainId ?? PEANUT_WALLET_CHAIN.id.toString()

            const params = unsignedTxs.map((tx) => ({
                to: tx.to! as Hex,
                value: tx.value?.valueOf() ?? 0n,
                data: (tx.data as Hex | undefined) ?? '0x',
            }))

            // If caller told us how much USDC the kernel needs on-hand for these
            // calls, route through useSpendBundle so Rain collateral can top up
            // the smart account within the same UserOp when the balance is short.
            if (options.requiredUsdcAmount !== undefined) {
                const rainSpendingPower = rainSpendingPowerToWei(rainOverview?.balance?.spendingPower)
                const smartNow = balanceFromQuery ?? 0n
                const result = await spendBundle({
                    requiredUsdcAmount: options.requiredUsdcAmount,
                    recipient: options.recipient,
                    subsequentCalls: params,
                    smartBalance: smartNow,
                    rainSpendingPower,
                    kind: options.kind ?? 'OTHER',
                    onStrategyDecided: options.onStrategyDecided,
                })
                // `subsequentCalls` is non-empty here (we just passed `params`), so
                // the collateral-only branch inside useSpendBundle is never taken:
                // userOpHash is guaranteed defined, txHash is always undefined.
                if (!result.userOpHash) {
                    throw new Error('sendTransactions: unexpected collateral-only result')
                }
                return {
                    userOpHash: result.userOpHash,
                    receipt: result.receipt ?? null,
                    strategy: result.strategy,
                    intentId: result.intentId,
                }
            }

            // Legacy path — kernel UserOp, no Rain collateral involvement.
            const legacy = await handleSendUserOpEncoded(params, chainId)
            return { userOpHash: legacy.userOpHash, receipt: legacy.receipt }
        },
        [handleSendUserOpEncoded, spendBundle, balanceFromQuery, rainOverview]
    )

    // Legacy fetchBalance function for backward compatibility
    // now it just triggers a refetch of the tanstack query
    const fetchBalance = useCallback(async () => {
        // guard: need a validated, matching address before fetching
        if (!isAddressReady) {
            console.warn('Skipping fetch balance, wallet address not ready or does not match user address.')
            return
        }

        await refetchBalance()
    }, [isAddressReady, refetchBalance])

    // Use balance from query if available, otherwise fall back to Redux
    const balance =
        balanceFromQuery !== undefined
            ? balanceFromQuery
            : reduxBalance !== undefined
              ? BigInt(reduxBalance)
              : undefined

    // consider balance as fetching until: address is validated and query has resolved
    const isBalanceLoading = !isAddressReady || isFetchingBalance

    // Rain collateral (spendingPower) — added to the smart-account balance to produce
    // the single "spendable" number the user sees on home. See docs §4.5 and §6 in
    // peanut-api-ts/docs/rain-card-test-summary.md and the card design spec.
    // `rainOverview` is declared above so `sendTransactions` can consult it too.
    const rainSpendingPowerWei = useMemo(
        () => rainSpendingPowerToWei(rainOverview?.balance?.spendingPower),
        [rainOverview?.balance?.spendingPower]
    )
    const rawSpendableBalance = useMemo(() => {
        if (balance === undefined) return undefined
        return balance + rainSpendingPowerWei
    }, [balance, rainSpendingPowerWei])

    // The two inputs (smart-account + rain overview) refresh independently.
    // When both change at once (e.g. auto-balancer deposit: smart goes down,
    // collateral goes up by the same amount), the queries settle at slightly
    // different times and the sum briefly shows a mid-state. Hold the last
    // "both-settled" value on-screen until both queries are idle again.
    const isSmartFetchingActive = useIsFetching({ queryKey: ['balance'] }) > 0
    const isRainFetchingActive = useIsFetching({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }) > 0
    const anyFetching = isSmartFetchingActive || isRainFetchingActive
    const [stableSpendable, setStableSpendable] = useState<bigint | undefined>(undefined)
    useEffect(() => {
        if (!anyFetching && rawSpendableBalance !== undefined) {
            setStableSpendable((prev) => (prev === rawSpendableBalance ? prev : rawSpendableBalance))
        }
    }, [anyFetching, rawSpendableBalance])

    // Show the stable value once we have one; fall back to the raw sum on
    // first paint (before any query has settled).
    const spendableBalance = stableSpendable ?? rawSpendableBalance
    // Block on both smart-account and rain queries to avoid a flicker from
    // the balance jumping when the rain number arrives.
    const isSpendableBalanceLoading = isBalanceLoading || isRainOverviewLoading

    // formatted balance for display (e.g. "1,234.56")
    const formattedBalance = useMemo(() => {
        if (balance === undefined) return '0.00'
        return formatCurrency(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [balance])

    // Check if the user has enough spendable to cover a USD amount.
    // Spendable = smart account + Rain collateral `spendingPower`. Use this
    // anywhere a user-facing "can you afford X?" gate is needed.
    const hasSufficientSpendableBalance = useCallback(
        (amountUsd: string | number): boolean => {
            if (spendableBalance === undefined) return false
            const amount = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd
            if (isNaN(amount) || amount < 0) return false
            const amountInWei = BigInt(Math.floor(amount * 10 ** PEANUT_WALLET_TOKEN_DECIMALS))
            return spendableBalance >= amountInWei
        },
        [spendableBalance]
    )

    return {
        address: isAddressReady ? address : undefined, // populate address only if it is validated and matches the user's wallet address
        balance,
        spendableBalance,
        formattedBalance,
        hasSufficientSpendableBalance,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        fetchBalance,
        isFetchingBalance: isBalanceLoading,
        isFetchingSpendableBalance: isSpendableBalanceLoading,
    }
}
