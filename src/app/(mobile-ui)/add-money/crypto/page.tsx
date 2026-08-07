'use client'

import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import OfframpHandleGateView from '@/components/AddMoney/views/OfframpHandleGate.view'
import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { NETWORK_LABELS, CHAIN_LOGOS, TOKEN_LOGOS, type ChainName, type TokenName } from '@/constants/rhino.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { getExplorerUrl } from '@/utils/general.utils'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { useSafeBack } from '@/hooks/useSafeBack'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

// static — peanut wallet is always on arbitrum
const DEPOSIT_EXPLORER_BASE_URL = getExplorerUrl(PEANUT_WALLET_CHAIN.id.toString())

const AddMoneyCryptoPage = () => {
    const { user, isFetchingUser } = useAuth()
    const t = useTranslations('addMoney')
    const onBack = useSafeBack('/add-money')
    const { address: peanutWalletAddress } = useWallet()
    const [networkParam] = useQueryState(
        'network',
        parseAsStringEnum<RhinoChainType>(['EVM', 'SOL', 'TRON']).withDefault('EVM')
    )
    // offramp migration deep-link: strips the chain/token picker down to arbitrum + usdc
    const [source] = useQueryState('source', parseAsStringEnum(['offramp']))
    const isOfframp = source === 'offramp'
    // The offramp UI is hardwired to Arbitrum copy, so the underlying address
    // must be EVM no matter what a shared/edited link says — otherwise a
    // ?network=SOL&source=offramp URL would show a Solana address labeled
    // "Arbitrum" and instruct the user to send funds to it.
    const network: RhinoChainType = isOfframp ? 'EVM' : networkParam
    const [showSuccessView, setShowSuccessView] = useState(false)
    const [depositResult, setDepositResult] = useState<DepositAddressStatusResponse | null>(null)
    // Offramp migrants must self-report their offramp.xyz username/email once
    // before the deposit address is revealed — Peanut owes the partner a
    // per-migrant payout, and this handle is what reconciliation keys on.
    // Local flag bridges the moment between saving and the user refetch.
    const [offrampHandleSaved, setOfframpHandleSaved] = useState(false)
    const needsOfframpHandle = isOfframp && !offrampHandleSaved && !user?.user.offrampHandle

    const {
        data: depositAddressData,
        isLoading,
        isError,
        refetch,
    } = useQuery({
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
                method_type: isOfframp ? 'offramp_migration' : 'crypto',
                acquisition_source: user?.invitedBy ? 'referred' : 'organic',
            })
            setDepositResult(statusData ?? { status: 'completed', amount })
            setShowSuccessView(true)
        },
        [network, user?.invitedBy, isOfframp]
    )

    // build minimal transaction details for the receipt drawer
    const depositTransactionDetails: TransactionDetails | null = useMemo(() => {
        if (!depositResult) return null
        const usdAmount = depositResult.amount?.toString() ?? '0'
        // offramp migrants were told "USDC on Arbitrum" — when Rhino's status
        // response omits token/chain, fall back to that promise instead of the
        // generic USDT/EVM guess (which renders an Ethereum icon on the receipt).
        const chainName = depositResult.chainIn ?? (isOfframp ? 'ARBITRUM' : NETWORK_LABELS[network])
        const tokenSymbol = depositResult.tokenSymbol ?? (isOfframp ? 'USDC' : 'USDT')
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
    }, [depositResult, network, isOfframp])

    if (needsOfframpHandle && !showSuccessView) {
        // wait for the cached user before deciding — otherwise a migrant who
        // already provided their handle gets a flash of the gate on every visit
        if (isFetchingUser && !user) {
            return <PeanutLoading />
        }
        return <OfframpHandleGateView onBack={onBack} onDone={() => setOfframpHandleSaved(true)} />
    }

    if (showSuccessView && depositResult) {
        return (
            <PaymentSuccessView
                type="DEPOSIT"
                headerTitle={isOfframp ? t('crypto.migrationComplete') : t('crypto.depositedCrypto')}
                usdAmount={depositResult.amount?.toString()}
                amount={depositResult.tokenAmount}
                transactionDetails={depositTransactionDetails}
                replaceOnDone
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
            isError={isError}
            onRetry={() => refetch()}
            onSuccess={handleSuccess}
            onBack={onBack}
            variant={isOfframp ? 'offramp' : 'default'}
        />
    )
}

export default AddMoneyCryptoPage
