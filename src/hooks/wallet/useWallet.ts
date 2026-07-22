'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { formatUnits, type Hex, type Address } from 'viem'
import { useZeroDev } from '../useZeroDev'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { useBalance } from './useBalance'
import { useSendMoney as useSendMoneyMutation } from './useSendMoney'
import { formatCurrency } from '@/utils/general.utils'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '../useRainCardOverview'
import {
    computeAvailableSpendable,
    computeDisplaySpendable,
    rainCentsToUsdcUnits,
    isAmountWithinBalance,
} from '@/utils/balance.utils'
import { useSpendBundle } from './useSpendBundle'
import type { SpendStrategy } from './spendPreflight'
import type { RainCollateralKind } from '@/services/rain'
import { isDemoMode } from '@/utils/demo'
import { useDemoBalanceUnits } from '@/utils/demo-balance'
import { readLastKnownSpendable, writeLastKnownSpendable } from './lastKnownSpendable'

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
    kind?: RainCollateralKind
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

    // Dev-only diagnostic: if the gate refuses to fetch balance even though
    // the user has loaded, log WHY exactly once. This was the silent-$0 bug
    // shape we hit during the 2026-04-27 card playtest — without this log
    // the only symptom is "balance shows 0 even though chain has funds",
    // and you have to read four hooks deep to find which condition failed.
    const loggedReasonRef = useRef<string | null>(null)
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return
        if (!user?.user?.userId) return // user still loading — don't log yet
        if (isAddressReady) {
            loggedReasonRef.current = null
            return
        }
        const reason = !address
            ? 'kernel address undefined (useZeroDev not ready or kernel init failed)'
            : !userAddress
              ? "no PEANUT_WALLET account in user.accounts (BE didn't return it)"
              : `address mismatch: kernel=${address} db=${userAddress}`
        if (loggedReasonRef.current !== reason) {
            console.warn('[useWallet] balance gate is blocked → showing $0 silently. reason:', reason)
            loggedReasonRef.current = reason
        }
    }, [address, userAddress, isAddressReady, user?.user?.userId])

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
    const { overview: rainOverview } = useRainCardOverview()

    // Mutation for sending money with optimistic updates
    const sendMoneyMutation = useSendMoneyMutation({ address: address as Address | undefined })
    const { spend: spendBundle } = useSpendBundle()

    const sendMoney = useCallback(
        async (toAddress: Address, amountInUsd: string, options?: { kind?: RainCollateralKind; chargeId?: string }) => {
            const result = await sendMoneyMutation.mutateAsync({
                toAddress,
                amountInUsd,
                kind: options?.kind,
                chargeId: options?.chargeId,
            })
            // `strategy` lets same-chain callers distinguish "funds left the smart
            // account" (smart-only) from "funds left Rain collateral" (collateral-
            // only/mixed). The latter is reconciled server-side via Rain's webhook
            // → TransactionIntent, so callers can skip legacy recordPayment paths
            // that would otherwise leave an unmatched Charge in history.
            // `intentId` is the receipt handle for collateral/mixed spends —
            // `/receipt/<intentId>?kind=<IntentKind>`.
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
                const rainSpendingPower = rainCentsToUsdcUnits(rainOverview?.balance?.spendingPower)
                const result = await spendBundle({
                    requiredUsdcAmount: options.requiredUsdcAmount,
                    recipient: options.recipient,
                    subsequentCalls: params,
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

    // demo mode: mutable, persisted balance overlay (utils/demo-balance.ts) —
    // debited on each simulated send so the displayed balance updates and
    // survives relaunch.
    const demoMode = isDemoMode()
    const demoBalanceUnits = useDemoBalanceUnits()

    // Use balance from query if available, otherwise fall back to Redux
    const balance = demoMode
        ? demoBalanceUnits
        : balanceFromQuery !== undefined
          ? balanceFromQuery
          : reduxBalance !== undefined
            ? BigInt(reduxBalance)
            : undefined

    // consider balance as fetching until: address is validated and query has resolved
    const isBalanceLoading = demoMode ? false : !isAddressReady || isFetchingBalance

    // Total spendable balance: smart-account balance + Rain collateral (landed +
    // in-transit). Display AND the affordability gate both run on THIS number.
    // DISPLAY spendable (smart + landed + in-transit collateral). What we show,
    // and what the fail-late flows (send-link, qr-pay, withdraw) gate on directly
    // via isAmountWithinBalance: the FE balance is only ~30s-polled while the live
    // spend routing reads the chain at submit, so blocking an in-transit amount at
    // input would reject funds that would actually succeed — it fails late with a
    // "settling, try again" message + a refetch instead.
    const rawSpendableBalance = useMemo(() => {
        if (balance === undefined) return undefined
        return computeDisplaySpendable(
            balance,
            rainOverview?.balance?.spendingPower,
            rainOverview?.balance?.inTransitToCollateralCents
        )
    }, [balance, rainOverview?.balance?.spendingPower, rainOverview?.balance?.inTransitToCollateralCents])

    // AVAILABLE-NOW spendable (smart + LANDED collateral, NO in-transit). What
    // useSpendBundle can route this instant, and what hasSufficientSpendableBalance
    // gates on — for flows that take an irreversible step BEFORE the spend (the
    // features/payments flows createCharge first), so an in-transit amount is
    // blocked at input rather than leaving an orphan charge when it fails late.
    const availableSpendableBalance = useMemo(() => {
        if (balance === undefined) return undefined
        return computeAvailableSpendable(balance, rainOverview?.balance?.spendingPower)
    }, [balance, rainOverview?.balance?.spendingPower])

    // `/rain/cards` supplies BOTH Rain terms of the sum, so until it has answered
    // once, `rainCentsToUsdcUnits(undefined)` folds them to 0n — and a failed
    // fetch is indistinguishable from "no collateral". For a card user whose
    // funds were swept into collateral that renders a confident, wrong $0.
    // React Query keeps the last good data across a failed refetch, so this gate
    // only matters on a session's first load. Demo has no Rain call at all, so
    // its synthesized balance is always "ready".
    const isRainReady = demoMode || rainOverview !== undefined

    // The two inputs (smart-account + rain overview) refresh independently.
    // When both change at once (e.g. auto-balancer deposit: smart goes down,
    // collateral goes up by the same amount), the queries settle at slightly
    // different times and the sum briefly shows a mid-state. Hold the last
    // "both-settled" value on-screen until both queries are idle again.
    const isSmartFetchingActive = useIsFetching({ queryKey: ['balance'] }) > 0
    const isRainFetchingActive = useIsFetching({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }) > 0
    const anyFetching = isSmartFetchingActive || isRainFetchingActive
    const [stableSpendable, setStableSpendable] = useState<bigint | undefined>(undefined)

    const userId = user?.user?.userId
    const [lastKnownSpendable, setLastKnownSpendable] = useState<bigint | undefined>(undefined)
    useEffect(() => {
        setLastKnownSpendable(readLastKnownSpendable(userId))
    }, [userId])

    // localStorage writes are synchronous disk I/O on native — only touch it when
    // the settled total actually moved, not on every 30s poll.
    const persistedSpendableRef = useRef<bigint | undefined>(undefined)
    useEffect(() => {
        if (anyFetching || !isRainReady || rawSpendableBalance === undefined || demoMode) return
        setStableSpendable((prev) => (prev === rawSpendableBalance ? prev : rawSpendableBalance))
        if (persistedSpendableRef.current === rawSpendableBalance) return
        persistedSpendableRef.current = rawSpendableBalance
        writeLastKnownSpendable(userId, rawSpendableBalance)
    }, [anyFetching, isRainReady, rawSpendableBalance, userId, demoMode])

    // Show the stable value once we have one, then the live sum once Rain has
    // answered, then the persisted last-known-good — so a cold start paints the
    // previous number immediately and corrects it in the background rather than
    // flashing $0. Cache is DISPLAY only; the gates below stay on the live
    // `availableSpendableBalance`.
    const spendableBalance = stableSpendable ?? (isRainReady ? rawSpendableBalance : lastKnownSpendable)
    const isSpendableBalanceLoading = demoMode ? false : spendableBalance === undefined
    // True while the number on screen came from cache and the live sum is still
    // pending — lets the UI mark it as refreshing instead of asserting it.
    const isSpendableBalanceStale = !demoMode && stableSpendable === undefined && !isRainReady && !!lastKnownSpendable

    // formatted balance for display (e.g. "1,234.56"). Smart-account only —
    // use `formattedSpendableBalance` below for user-facing widgets that
    // should reflect total spendable (smart + Rain collateral).
    const formattedBalance = useMemo(() => {
        if (balance === undefined) return '0.00'
        return formatCurrency(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [balance])

    // Total spendable (smart + Rain collateral) formatted for display. All
    // payment-input forms show THIS rather than the smart-only number — otherwise
    // a user with funds split across smart and collateral sees a smaller balance
    // than they actually have (2026-05-08 jotest097 report TASK-19573). Note the
    // gate may be stricter than the display: the features/payments flows gate on
    // available-now (see hasSufficientSpendableBalance) while still showing this
    // full total, so during the brief in-transit window display can exceed what
    // they can spend — by design, it reconciles in seconds.
    const formattedSpendableBalance = useMemo(() => {
        if (spendableBalance === undefined) return '0.00'
        return formatCurrency(formatUnits(spendableBalance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [spendableBalance])

    // STRICT affordability gate on AVAILABLE-NOW (excludes in-transit). Used by
    // the features/payments flows, which createCharge before spending — an
    // in-transit amount must be blocked here, not green-lit into an orphan charge.
    // Fail-late flows (send-link, qr-pay, withdraw) instead gate on the displayed
    // `spendableBalance` directly via isAmountWithinBalance. Logic is the pure,
    // unit-tested isAmountWithinBalance.
    const hasSufficientSpendableBalance = useCallback(
        (amountUsd: string | number): boolean => isAmountWithinBalance(amountUsd, availableSpendableBalance),
        [availableSpendableBalance]
    )

    return {
        address: isAddressReady ? address : undefined, // populate address only if it is validated and matches the user's wallet address
        balance,
        spendableBalance,
        formattedBalance,
        formattedSpendableBalance,
        hasSufficientSpendableBalance,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        fetchBalance,
        isFetchingBalance: isBalanceLoading,
        isFetchingSpendableBalance: isSpendableBalanceLoading,
        isSpendableBalanceStale,
    }
}
