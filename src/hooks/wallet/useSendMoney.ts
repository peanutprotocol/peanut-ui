import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import type { Address } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS, BALANCE_DECREASE, SEND_MONEY } from '@/constants/query.consts'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useBalance } from './useBalance'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '../useRainCardOverview'
import { rainSpendingPowerToWei } from '@/utils/balance.utils'
import type { TransactionIntentKind } from '@/services/rain'
import {
    InsufficientSpendableError,
    SessionKeyGrantRequiredError,
    type SpendStrategy,
    useSpendBundle,
} from './useSpendBundle'

type SendMoneyParams = {
    toAddress: Address
    amountInUsd: string
    /** User-semantic kind for history categorization. Defaults to P2P_SEND when
     *  omitted — the default represents "home-screen send flow". Callers with
     *  other semantics (QR pay, crypto withdraw, request pay, …) should pass
     *  the appropriate kind explicitly. */
    kind?: TransactionIntentKind
    /** Optional UI hook — fires once routing is picked, before any signing prompt. */
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
    /** Optional UI hook — fires when we're about to prompt for the one-time
     *  session-key grant (first collateral spend only). Use it to show
     *  explainer copy before the WebAuthn sheet appears. */
    onGrantRequired?: () => void
}

type UseSendMoneyOptions = {
    address?: Address
}

/**
 * Sends USDC to a recipient, pulling from Rain collateral first, smart-account
 * second, or a mix when neither alone covers the amount. Delegates routing +
 * signing + submission to `useSpendBundle`.
 *
 * Optimistic update still applies to the smart-account balance (for the smart-
 * and mixed-strategy paths). Collateral-only spends don't touch the smart
 * account, so the optimistic snapshot is left alone for those.
 */
export const useSendMoney = ({ address }: UseSendMoneyOptions) => {
    const queryClient = useQueryClient()
    const toast = useToast()
    const { spend } = useSpendBundle()
    const { data: smartBalance } = useBalance(address)
    const { overview } = useRainCardOverview()

    return useMutation({
        mutationKey: [BALANCE_DECREASE, SEND_MONEY],
        // Disable retry for financial transactions to prevent duplicate payments
        // Blockchain transactions are not idempotent at the mutation level
        retry: false,
        mutationFn: async ({
            toAddress,
            amountInUsd,
            kind = 'P2P_SEND',
            onStrategyDecided,
            onGrantRequired,
        }: SendMoneyParams) => {
            const amountToSend = parseUnits(amountInUsd, PEANUT_WALLET_TOKEN_DECIMALS)
            const result = await spend({
                requiredUsdcAmount: amountToSend,
                recipient: toAddress,
                smartBalance: smartBalance ?? 0n,
                rainSpendingPower: rainSpendingPowerToWei(overview?.balance?.spendingPower),
                kind,
                onStrategyDecided,
                onGrantRequired,
            })
            return { ...result, amount: amountToSend }
        },

        // Optimistic update — only relevant when the smart-account balance is
        // actually the one moving (smart-only and mixed both touch smart).
        // Collateral-only spends don't deduct from smart, so skip the snapshot.
        onMutate: async ({ amountInUsd }) => {
            if (!address) return

            const amountToSend = parseUnits(amountInUsd, PEANUT_WALLET_TOKEN_DECIMALS)

            await queryClient.cancelQueries({ queryKey: ['balance', address] })
            const previousBalance = queryClient.getQueryData<bigint>(['balance', address])

            if (previousBalance !== undefined && previousBalance >= amountToSend) {
                queryClient.setQueryData<bigint>(['balance', address], previousBalance - amountToSend)
            }

            return { previousBalance }
        },

        onSuccess: () => {
            // Refresh both buckets. For collateral-only the smart balance didn't
            // actually change, but invalidating is cheap and keeps the display honest.
            queryClient.invalidateQueries({ queryKey: ['balance', address] })
            queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        },

        onError: (error, _variables, context) => {
            if (!address || !context) return

            if (context.previousBalance !== undefined) {
                queryClient.setQueryData(['balance', address], context.previousBalance)
            }

            console.error('[useSendMoney] Transaction failed, rolled back balance:', error)

            if (error instanceof InsufficientSpendableError) {
                toast.error('Insufficient balance for this transfer.')
                return
            }
            if (error instanceof SessionKeyGrantRequiredError) {
                // User cancelled or the grant failed — no transaction happened.
                // Let the caller show its own UI for this; default to a toast.
                if (error.cause.kind === 'user-cancelled') {
                    toast.error('Approval cancelled — you can retry anytime.')
                } else {
                    toast.error('Card approval failed — please try again.')
                }
                return
            }
            if ((error as any)?.isStaleKeyError) {
                toast.error((error as Error).message)
            }
        },
    })
}
