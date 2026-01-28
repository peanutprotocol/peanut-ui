'use client'

/**
 * confirm view for semantic request flow (cross-chain payments only)
 *
 * displays:
 * - recipient and amount being sent
 * - min received after slippage
 * - source token (usdc on arb) → destination token
 * - network fees (usually sponsored by peanut)
 * - countdown timer for rfq routes (auto-refreshes before expiry)
 *
 * handles route expiry - auto-fetches new quote when current expires
 */

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { formatAmount, isStableCoin } from '@/utils/general.utils'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import PeanutActionDetailsCard, {
    type PeanutActionDetailsCardRecipientType,
} from '@/components/Global/PeanutActionDetailsCard'

export function SemanticRequestConfirmView() {
    const {
        amount,
        usdAmount,
        recipient,
        charge,
        attachment,
        error,
        calculatedRoute,
        calculatedGasCost,
        isCalculatingRoute,
        isFeeEstimationError,
        routeError,
        isXChain,
        isDiffToken,
        isLoading,
        isFetchingCharge,
        selectedChainID,
        selectedTokenData,
        urlToken,
        isTokenDenominated,
        goBackToInitial,
        executePayment,
        prepareRoute,
        handleRouteExpired,
        handleRouteNearExpiry,
    } = useSemanticRequestFlow()

    // get the display symbol for the requested amount
    const displayTokenSymbol = useMemo(() => {
        if (isTokenDenominated && urlToken) {
            return urlToken.symbol.toUpperCase()
        }
        return '$'
    }, [isTokenDenominated, urlToken])

    // icons for sending token (peanut wallet usdc)
    const {
        tokenIconUrl: sendingTokenIconUrl,
        chainIconUrl: sendingChainIconUrl,
        resolvedChainName: sendingResolvedChainName,
        resolvedTokenSymbol: sendingResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: PEANUT_WALLET_CHAIN.id.toString(),
        tokenAddress: PEANUT_WALLET_TOKEN,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
    })

    // icons for requested/destination token
    const {
        tokenIconUrl: requestedTokenIconUrl,
        chainIconUrl: requestedChainIconUrl,
        resolvedChainName: requestedResolvedChainName,
        resolvedTokenSymbol: requestedResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: charge?.chainId,
        tokenAddress: charge?.tokenAddress,
        tokenSymbol: charge?.tokenSymbol,
    })

    // is cross-chain or different token
    const isCrossChainPayment = isXChain || isDiffToken

    // format display values
    // when token-denominated (e.g., eth), show the token amount, not usd amount
    const displayAmount = useMemo(() => {
        if (isTokenDenominated) {
            return `${formatAmount(amount)}`
        }
        return `${formatAmount(usdAmount || amount)}`
    }, [amount, usdAmount, isTokenDenominated])

    // get network fee display
    const networkFee = useMemo<string | React.ReactNode>(() => {
        if (isFeeEstimationError) return '-'
        if (calculatedGasCost === undefined) {
            return 'Sponsored by Peanut!'
        }
        if (calculatedGasCost < 0.01) {
            return 'Sponsored by Peanut!'
        }
        return (
            <>
                <span className="line-through">$ {calculatedGasCost.toFixed(2)}</span>
                {' - '}
                <span className="font-medium text-gray-500">Sponsored by Peanut!</span>
            </>
        )
    }, [calculatedGasCost, isFeeEstimationError])

    // min received amount
    const minReceived = useMemo<string | null>(() => {
        if (!charge?.tokenDecimals || !requestedResolvedTokenSymbol) return null
        if (!calculatedRoute) {
            return `$ ${charge?.tokenAmount}`
        }
        const amount = formatAmount(
            formatUnits(BigInt(calculatedRoute.rawResponse.route.estimate.toAmountMin), charge.tokenDecimals)
        )
        return isStableCoin(requestedResolvedTokenSymbol) ? `$ ${amount}` : `${amount} ${requestedResolvedTokenSymbol}`
    }, [calculatedRoute, charge?.tokenDecimals, charge?.tokenAmount, requestedResolvedTokenSymbol])

    // error message (route expiry auto-retries)
    const errorMessage = useMemo(() => {
        if (routeError) return routeError
        if (error.showError) return error.errorMessage
        return null
    }, [routeError, error])

    // handle confirm
    const handleConfirm = () => {
        if (!isLoading && !isCalculatingRoute) {
            executePayment()
        }
    }

    // handle retry
    const handleRetry = async () => {
        if (errorMessage) {
            // retry route calculation
            await prepareRoute()
        } else {
            await executePayment()
        }
    }

    // show loading if we don't have charge details yet or fetching
    if (!charge || isFetchingCharge) {
        return (
            <div className="flex min-h-[inherit] flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={goBackToInitial} title="Confirm Payment" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4 pb-5">
                {recipient && recipient.recipientType && (
                    <PeanutActionDetailsCard
                        avatarSize="small"
                        transactionType={'REQUEST_PAYMENT'}
                        recipientType={recipient?.recipientType as PeanutActionDetailsCardRecipientType}
                        recipientName={recipient?.identifier || recipient?.resolvedAddress || ''}
                        amount={displayAmount}
                        tokenSymbol={displayTokenSymbol}
                        message={attachment?.message ?? ''}
                        fileUrl={attachment?.fileUrl ?? ''}
                        showTimer={isCrossChainPayment && calculatedRoute?.type === 'rfq'}
                        timerExpiry={calculatedRoute?.expiry}
                        isTimerLoading={isCalculatingRoute}
                        onTimerNearExpiry={handleRouteNearExpiry}
                        onTimerExpired={handleRouteExpired}
                        disableTimerRefetch={isLoading}
                        timerError={routeError}
                    />
                )}
                {/* payment details card */}
                <Card className="rounded-sm">
                    <PaymentInfoRow
                        label="Min Received"
                        loading={!minReceived || isCalculatingRoute}
                        value={minReceived ?? '-'}
                        moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
                    />

                    {isCrossChainPayment && (
                        <PaymentInfoRow
                            label="Requested"
                            value={
                                <TokenChainInfoDisplay
                                    tokenIconUrl={requestedTokenIconUrl}
                                    chainIconUrl={requestedChainIconUrl}
                                    resolvedTokenSymbol={requestedResolvedTokenSymbol}
                                    fallbackTokenSymbol={selectedTokenData?.symbol || ''}
                                    resolvedChainName={requestedResolvedChainName}
                                    fallbackChainName={selectedChainID || ''}
                                />
                            }
                        />
                    )}

                    <PaymentInfoRow
                        label={isCrossChainPayment ? 'Sending' : 'Token and network'}
                        value={
                            <TokenChainInfoDisplay
                                tokenIconUrl={sendingTokenIconUrl}
                                chainIconUrl={sendingChainIconUrl}
                                resolvedTokenSymbol={sendingResolvedTokenSymbol}
                                fallbackTokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                                resolvedChainName={sendingResolvedChainName}
                                fallbackChainName="Arbitrum"
                            />
                        }
                    />

                    <PaymentInfoRow loading={isCalculatingRoute} label="Network fee" value={networkFee} />

                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value="$ 0.00" />
                </Card>

                {/* buttons and error */}
                <div className="flex flex-col gap-4">
                    {errorMessage ? (
                        <Button
                            disabled={isLoading || isCalculatingRoute}
                            onClick={handleRetry}
                            loading={isLoading || isCalculatingRoute}
                            shadowSize="4"
                            className="w-full"
                            icon="retry"
                            iconSize={14}
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            disabled={isLoading || isCalculatingRoute || isFeeEstimationError}
                            onClick={handleConfirm}
                            loading={isLoading || isCalculatingRoute}
                            shadowSize="4"
                            className="w-full"
                            icon="arrow-up-right"
                            iconSize={14}
                        >
                            Send
                        </Button>
                    )}
                    {errorMessage && (
                        <div className="space-y-2">
                            <ErrorAlert description={errorMessage} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// helper component for token/chain display
interface TokenChainInfoDisplayProps {
    tokenIconUrl?: string
    chainIconUrl?: string
    resolvedTokenSymbol?: string
    fallbackTokenSymbol: string
    resolvedChainName?: string
    fallbackChainName: string
}

function TokenChainInfoDisplay({
    tokenIconUrl,
    chainIconUrl,
    resolvedTokenSymbol,
    fallbackTokenSymbol,
    resolvedChainName,
    fallbackChainName,
}: TokenChainInfoDisplayProps) {
    const tokenSymbol = resolvedTokenSymbol || fallbackTokenSymbol
    const chainName = resolvedChainName || fallbackChainName

    return (
        <div className="flex items-center gap-2">
            {(tokenIconUrl || chainIconUrl) && (
                <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                    {tokenIconUrl && (
                        <DisplayIcon
                            iconUrl={tokenIconUrl}
                            altText={`${tokenSymbol} token`}
                            fallbackName={tokenSymbol.charAt(0) || 'T'}
                            sizeClass="h-6 w-6"
                        />
                    )}
                    {chainIconUrl && (
                        <div className="absolute -bottom-1 -right-1">
                            <DisplayIcon
                                iconUrl={chainIconUrl}
                                altText={`${chainName} chain`}
                                fallbackName={chainName.charAt(0) || 'C'}
                                sizeClass="h-3.5 w-3.5"
                                className="rounded-full border-2 border-white dark:border-grey-4"
                            />
                        </div>
                    )}
                </div>
            )}
            <span>
                {tokenSymbol} on <span className="capitalize">{chainName}</span>
            </span>
        </div>
    )
}
