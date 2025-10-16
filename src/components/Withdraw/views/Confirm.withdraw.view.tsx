'use client'

import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { type ITokenPriceData } from '@/interfaces'
import { formatAmount, isStableCoin } from '@/utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { type PeanutCrossChainRoute } from '@/services/swap'
import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants'

interface WithdrawConfirmViewProps {
    amount: string
    token: ITokenPriceData
    chain: interfaces.ISquidChain & { networkName: string; tokens: interfaces.ISquidToken[] }
    toAddress: string
    networkFee?: number
    peanutFee?: string
    onConfirm: () => void
    onBack: () => void
    isProcessing?: boolean
    error?: string | null
    // Timer props for cross-chain withdrawals
    isCrossChain?: boolean
    routeExpiry?: string
    isRouteLoading?: boolean
    onRouteRefresh?: () => void
    xChainRoute?: PeanutCrossChainRoute
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
    routeExpiry,
    isRouteLoading = false,
    onRouteRefresh,
    xChainRoute,
}: WithdrawConfirmViewProps) {
    const [isRouteExpired, setIsRouteExpired] = useState(false)
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chain.chainId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
    })

    const minReceived = useMemo<string | null>(() => {
        if (!xChainRoute || !resolvedTokenSymbol) return null
        const amount = formatUnits(BigInt(xChainRoute.rawResponse.route.estimate.toAmountMin), token.decimals)
        return isStableCoin(resolvedTokenSymbol) ? `$ ${amount}` : `${amount} ${resolvedTokenSymbol}`
    }, [xChainRoute, resolvedTokenSymbol])

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
                    showTimer={isCrossChain}
                    timerExpiry={routeExpiry}
                    isTimerLoading={isRouteLoading}
                    onTimerNearExpiry={() => {
                        setIsRouteExpired(false)
                        onRouteRefresh?.()
                    }}
                    onTimerExpired={() => {
                        setIsRouteExpired(true)
                    }}
                    disableTimerRefetch={isProcessing}
                    timerError={error == ROUTE_NOT_FOUND_ERROR ? error : null}
                />

                <Card className="rounded-sm">
                    {minReceived && (
                        <PaymentInfoRow
                            label="Min Received"
                            value={minReceived}
                            moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
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
                            } else if (isRouteExpired) {
                                onRouteRefresh?.()
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
                        disabled={isProcessing || isRouteLoading}
                        loading={isProcessing}
                        className="w-full"
                    >
                        {isProcessing ? 'Withdrawing' : 'Withdraw'}
                    </Button>
                )}

                {error && (
                    <ErrorAlert
                        description={
                            isRouteExpired ? 'This quote has expired. Please retry to fetch latest quote.' : error
                        }
                    />
                )}
            </div>
        </div>
    )
}
