'use client'

import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { NETWORK_LABELS, CHAIN_LOGOS, TOKEN_LOGOS, type ChainName, type TokenName } from '@/constants/rhino.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { getExplorerUrl } from '@/utils/general.utils'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

// static — peanut wallet is always on arbitrum
const DEPOSIT_EXPLORER_BASE_URL = getExplorerUrl(PEANUT_WALLET_CHAIN.id.toString())

const AddMoneyCryptoPage = () => {
    const { user } = useAuth()
    const router = useRouter()
    const { address: peanutWalletAddress } = useWallet()
    const [network] = useQueryState(
        'network',
        parseAsStringEnum<RhinoChainType>(['EVM', 'SOL', 'TRON']).withDefault('EVM')
    )
    const [showSuccessView, setShowSuccessView] = useState(false)
    const [depositResult, setDepositResult] = useState<DepositAddressStatusResponse | null>(null)

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', user?.user.userId, peanutWalletAddress, network],
        queryFn: () =>
            rhinoApi.createDepositAddress(peanutWalletAddress as string, network, user?.user.userId as string),
        enabled: !!user && !!peanutWalletAddress,
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
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.RECIPIENT,
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

    if (showSuccessView && depositResult) {
        return (
            <PaymentSuccessView
                type="DEPOSIT"
                headerTitle="Deposited Crypto"
                usdAmount={depositResult.amount?.toString()}
                amount={depositResult.tokenAmount}
                transactionDetails={depositTransactionDetails}
                onComplete={() => {
                    setShowSuccessView(false)
                    setDepositResult(null)
                }}
            />
        )
    }

    return (
        <CryptoDepositView
            network={network}
            depositAddressData={depositAddressData}
            isLoading={isLoading}
            onSuccess={handleSuccess}
            onBack={() => router.back()}
        />
    )
}

export default AddMoneyCryptoPage
