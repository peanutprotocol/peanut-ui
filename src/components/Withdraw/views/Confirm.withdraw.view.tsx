'use client'

import { Button } from '@/components/0_Bruddle/Button'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { type ITokenPriceData } from '@/interfaces'
import { formatAmount, isStableCoin } from '@/utils/general.utils'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { useMemo } from 'react'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants/general.consts'

interface WithdrawConfirmViewProps {
    amount: string
    token: ITokenPriceData
    chain: ChainWithTokens
    toAddress: string
    networkFee?: number
    peanutFee?: string
    onConfirm: () => void
    onBack: () => void
    isProcessing?: boolean
    error?: string | null
    isCrossChain?: boolean
    /** True while the shared `useCrossChainTransfer` hook is provisioning the SDA / previewing fees. */
    isCalculating?: boolean
    /**
     * Decimal receive amount from Rhino's public quote — e.g. "99.95". Nullable
     * for same-chain (no bridge) or while the preview call is in flight. Under
     * SDA there's no slippage on same-stablecoin bridges; this is the deterministic
     * "they'll receive X" number.
     */
    receiveAmount?: string | null
}

export default function ConfirmWithdrawView({
    amount,
    token,
    chain,
    toAddress,
    networkFee = 0,
    peanutFee = '0.00',
    onConfirm,
    onBack,
    isProcessing,
    error,
    isCrossChain = false,
    isCalculating = false,
    receiveAmount,
}: WithdrawConfirmViewProps) {
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chain.chainId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
    })

    const displayReceived = useMemo<string | null>(() => {
        if (!isCrossChain || !receiveAmount || !resolvedTokenSymbol) return null
        return isStableCoin(resolvedTokenSymbol) ? `$ ${receiveAmount}` : `${receiveAmount} ${resolvedTokenSymbol}`
    }, [isCrossChain, receiveAmount, resolvedTokenSymbol])

    const networkFeeDisplay = useMemo<string | React.ReactNode>(() => {
        if (networkFee < 0.01) return 'Sponsored by Peanut!'
        return (
            <>
                <span className="line-through">$ {networkFee.toFixed(2)}</span>
                {' – '}
                <span className="font-medium text-gray-500">Sponsored by Peanut!</span>
            </>
        )
    }, [networkFee])

    return (
        <div className="space-y-8">
            <NavHeader title="Withdraw" onPrev={onBack} />

            <div className="space-y-4 pb-5">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'WITHDRAW'}
                    recipientType="USERNAME"
                    recipientName={''}
                    amount={formatAmount(amount)}
                    tokenSymbol="USDC"
                />

                <Card className="rounded-sm">
                    {displayReceived && (
                        <PaymentInfoRow
                            label="Recipient receives"
                            value={displayReceived}
                            moreInfoText="Cross-chain bridging fee is deducted from the sent amount by Rhino."
                        />
                    )}
                    <PaymentInfoRow
                        label="Token and network"
                        value={
                            <div className="flex items-center gap-2">
                                {token && (
                                    <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                        <DisplayIcon
                                            iconUrl={tokenIconUrl}
                                            altText={resolvedTokenSymbol || 'token'}
                                            fallbackName={resolvedTokenSymbol || 'T'}
                                            sizeClass="h-6 w-6"
                                        />
                                        {chainIconUrl && (
                                            <div className="absolute -bottom-1 -right-1">
                                                <DisplayIcon
                                                    iconUrl={chainIconUrl}
                                                    altText={resolvedChainName || 'chain'}
                                                    fallbackName={resolvedChainName || 'C'}
                                                    sizeClass="h-3.5 w-3.5"
                                                    className="rounded-full border-2 border-white dark:border-grey-4"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <span>
                                    {resolvedTokenSymbol || token.symbol} on{' '}
                                    <span className="capitalize">{resolvedChainName || chain.networkName}</span>
                                </span>
                            </div>
                        }
                    />
                    <PaymentInfoRow
                        label="To"
                        value={<AddressLink isLink={false} address={toAddress} className="text-black no-underline" />}
                    />
                    <PaymentInfoRow label="Max network fee" value={networkFeeDisplay} />
                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value={`$ ${peanutFee}`} />
                </Card>

                {error ? (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            if (error === ROUTE_NOT_FOUND_ERROR) {
                                onBack()
                            } else {
                                onConfirm()
                            }
                        }}
                        disabled={false}
                        loading={false}
                        className="w-full"
                        icon="retry"
                    >
                        Retry
                    </Button>
                ) : (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={onConfirm}
                        disabled={isProcessing || isCalculating}
                        loading={isProcessing}
                        className="w-full"
                    >
                        {isProcessing ? 'Withdrawing' : 'Withdraw'}
                    </Button>
                )}

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
