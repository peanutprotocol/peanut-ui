'use client'

import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { NETWORK_LABELS, CHAIN_LOGOS, TOKEN_LOGOS, type ChainName, type TokenName } from '@/constants/rhino.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useSafeBack } from '@/hooks/useSafeBack'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
import { getExplorerUrl } from '@/utils/general.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useQueryState, parseAsStringEnum, parseAsString } from 'nuqs'
import posthog from 'posthog-js'
import { useCallback, useMemo, useState } from 'react'

// static — peanut wallet is always on arbitrum
const DEPOSIT_EXPLORER_BASE_URL = getExplorerUrl(PEANUT_WALLET_CHAIN.id.toString())

/**
 * flow hook for the /add-money/crypto page — owns the deposit-address query,
 * network url state, back routing and the success transition.
 */
export function useAddMoneyCryptoFlow() {
    const { user } = useAuth()
    // an explicit (sanitized) origin wins over history-back: the home Add
    // drawer carries the caller's returnTo here, and popping history would
    // land on the intermediate /home entry instead (chip P15). nuqs per the
    // URL-as-State rule; readReturnTo validates same-origin on the raw value.
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const safeBack = useSafeBack('/add-money')
    const returnTo = readReturnTo(
        { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) },
        '/add-money/crypto'
    )
    const router = useRouter()
    const onBack = returnTo ? () => router.push(returnTo) : safeBack
    const { address: peanutWalletAddress } = useWallet()
    // no default: a bare /add-money/crypto shows the choose-network step per the
    // Add/Crypto board (17830:78020); ?network= deep-links keep working
    const [networkParam, setNetworkParam] = useQueryState(
        'network',
        parseAsStringEnum<RhinoChainType>(['EVM', 'SOL', 'TRON'])
    )
    const needsNetworkChoice = networkParam === null
    const network: RhinoChainType = networkParam ?? 'EVM'
    const [showSuccessView, setShowSuccessView] = useState(false)
    const [depositResult, setDepositResult] = useState<DepositAddressStatusResponse | null>(null)

    const {
        data: depositAddressData,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['rhino-deposit-address', user?.user.userId, peanutWalletAddress, network],
        queryFn: () =>
            rhinoApi.createDepositAddress(peanutWalletAddress as string, network, user?.user.userId as string),
        enabled: !!user && !!peanutWalletAddress && !needsNetworkChoice,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const handleSuccess = useCallback(
        (amount: number, statusData?: DepositAddressStatusResponse) => {
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
                amount,
                chain_type: network,
                method_type: 'crypto',
                acquisition_source: user?.invitedBy ? 'referred' : 'organic',
            })
            setDepositResult(statusData ?? { status: 'completed', amount })
            setShowSuccessView(true)
        },
        [network, user?.invitedBy]
    )

    // build minimal transaction details for the receipt drawer
    const depositTransactionDetails: TransactionDetails | null = useMemo(() => {
        if (!depositResult) return null
        const usdAmount = depositResult.amount?.toString() ?? '0'
        const chainName = depositResult.chainIn ?? NETWORK_LABELS[network]
        const tokenSymbol = depositResult.tokenSymbol ?? 'USDT'
        const chainIconUrl = CHAIN_LOGOS[chainName as ChainName] ?? CHAIN_LOGOS.ETHEREUM
        const tokenIconUrl = TOKEN_LOGOS[tokenSymbol as TokenName] ?? TOKEN_LOGOS.USDT
        const explorerUrl =
            depositResult.txHash && DEPOSIT_EXPLORER_BASE_URL
                ? `${DEPOSIT_EXPLORER_BASE_URL}/tx/${depositResult.txHash}`
                : undefined
        const now = new Date()
        return {
            id: depositResult.txHash ?? 'deposit',
            txHash: depositResult.txHash,
            explorerUrl,
            direction: 'add',
            userName: chainName,
            fullName: chainName,
            amount: parseFloat(usdAmount),
            initials: 'CD',
            status: 'completed',
            date: now,
            createdAt: now,
            completedAt: now,
            tokenSymbol,
            sourceView: 'history',
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.RECIPIENT,
                kind: 'CRYPTO_DEPOSIT',
            },
            tokenDisplayDetails: {
                tokenSymbol,
                tokenIconUrl,
                chainName,
                chainIconUrl,
            },
            currency: { amount: usdAmount, code: 'USD' },
            totalAmountCollected: 0,
        } satisfies TransactionDetails
    }, [depositResult, network])

    const handleSuccessComplete = () => {
        setShowSuccessView(false)
        setDepositResult(null)
    }

    return {
        needsNetworkChoice,
        network,
        setNetworkParam,
        onBack,
        showSuccessView,
        depositResult,
        depositTransactionDetails,
        depositAddressData,
        isLoading,
        isError,
        refetch,
        handleSuccess,
        handleSuccessComplete,
    }
}
