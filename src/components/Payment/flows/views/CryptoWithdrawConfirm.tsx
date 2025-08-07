'use client'

import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useCryptoWithdrawFlow } from '@/hooks/payment'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { ITokenPriceData } from '@/interfaces'
import { formatAmount } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useEffect, useMemo } from 'react'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants'

interface CryptoWithdrawFormData {
    amount: string
    selectedToken: ITokenPriceData | null
    selectedChain: (peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }) | null
    recipientAddress: string
    isValidRecipient: boolean
}

interface CryptoWithdrawConfirmProps {
    formData: CryptoWithdrawFormData
    cryptoWithdrawHook: ReturnType<typeof useCryptoWithdrawFlow>
    onNextAction: () => void
    onBackAction: () => void
}

/**
 * Enhanced CryptoWithdrawConfirm View
 *
 * The confirmation step for crypto withdraw flow with full feature parity:
 * - Shows transaction details with actual route data
 * - Displays proper min received from route
 * - Timer functionality for route expiry
 * - Route refresh capability
 * - Enhanced error handling and retry logic
 */
export const CryptoWithdrawConfirm = ({
    formData,
    cryptoWithdrawHook,
    onNextAction,
    onBackAction,
}: CryptoWithdrawConfirmProps) => {
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: formData.selectedChain?.chainId,
        tokenAddress: formData.selectedToken?.address,
        tokenSymbol: formData.selectedToken?.symbol,
    })

    const {
        isProcessing,
        isPreparingRoute,
        displayError,
        routeError,
        routeExpiry,
        isRouteExpired,
        minReceived,
        estimatedFees,
        isCrossChain,
        refreshRoute,
        isStale, // TanStack Query feature - indicates if data might be outdated
        isFetching, // TanStack Query feature - indicates if currently fetching
    } = cryptoWithdrawHook

    useEffect(() => {
        if (!routeExpiry) return

        const interval = setInterval(() => {
            const expiryTime = new Date(routeExpiry).getTime()
            const currentTime = Date.now()
            const remaining = Math.max(0, expiryTime - currentTime)

            if (remaining === 0) {
                clearInterval(interval)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [routeExpiry])

    // Route refresh handler - simplified with TanStack Query
    const handleRouteRefresh = useCallback(async () => {
        console.log('Refreshing route...')
        await refreshRoute()
    }, [refreshRoute])

    const networkFeeDisplay = useMemo<string | React.ReactNode>(() => {
        const fee = estimatedFees || 0
        if (fee < 0.01) return 'Sponsored by Peanut!'
        return (
            <>
                <span className="line-through">$ {fee.toFixed(2)}</span>
                {' – '}
                <span className="font-medium text-gray-500">Sponsored by Peanut!</span>
            </>
        )
    }, [estimatedFees])

    return (
        <div className="space-y-8">
            <NavHeader title="Withdraw" onPrev={onBackAction} />

            <div className="space-y-4 pb-5">
                {/* Enhanced Amount Display Card with Timer */}
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="WITHDRAW"
                    recipientType="USERNAME"
                    recipientName=""
                    amount={formatAmount(formData.amount)}
                    tokenSymbol="USDC"
                    showTimer={isCrossChain}
                    timerExpiry={routeExpiry}
                    isTimerLoading={isPreparingRoute}
                    onTimerNearExpiry={() => {
                        handleRouteRefresh()
                    }}
                    disableTimerRefetch={isProcessing}
                    timerError={routeError === ROUTE_NOT_FOUND_ERROR ? routeError : null}
                />

                {/* Enhanced Transaction Details Card */}
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
                                {formData.selectedToken && (
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
                                    {resolvedTokenSymbol || formData.selectedToken?.symbol} on{' '}
                                    <span className="capitalize">
                                        {resolvedChainName || formData.selectedChain?.axelarChainName}
                                    </span>
                                </span>
                            </div>
                        }
                    />

                    <PaymentInfoRow
                        label="To"
                        value={
                            <AddressLink
                                isLink={false}
                                address={formData.recipientAddress}
                                className="text-black no-underline"
                            />
                        }
                    />

                    <PaymentInfoRow label="Max network fee" value={networkFeeDisplay} />
                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value="$ 0.00" />
                </Card>

                {/* Enhanced Action Button with Error Handling */}
                {displayError ? (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            if (routeError === ROUTE_NOT_FOUND_ERROR) {
                                console.log('Route not found, going back to initial view')
                                onBackAction()
                            } else if (isRouteExpired) {
                                console.log('Route expired, refreshing...')
                                handleRouteRefresh()
                            } else {
                                console.log('Retrying withdrawal...')
                                onNextAction()
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
                        onClick={onNextAction}
                        disabled={isProcessing || isPreparingRoute || isRouteExpired || isFetching}
                        loading={isProcessing || isFetching}
                        className="w-full"
                    >
                        {isProcessing
                            ? 'Withdrawing...'
                            : isFetching
                              ? 'Updating route...'
                              : isStale
                                ? 'Withdraw (route may be outdated)'
                                : 'Withdraw'}
                    </Button>
                )}

                {/* Enhanced Error Display */}
                {displayError && (
                    <ErrorAlert
                        description={
                            isRouteExpired
                                ? 'This quote has expired. Please retry to fetch latest quote.'
                                : displayError
                        }
                    />
                )}
            </div>
        </div>
    )
}
