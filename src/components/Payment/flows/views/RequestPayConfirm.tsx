'use client'

import { useMemo, useContext } from 'react'
import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import Card from '@/components/Global/Card'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import ActionModal from '@/components/Global/ActionModal'
import { PaymentInfoRow } from '../../PaymentInfoRow'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAccount } from 'wagmi'
import { tokenSelectorContext } from '@/context'
import { formatAmount, areEvmAddressesEqual, isStableCoin } from '@/utils'
import { formatUnits } from 'viem'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import type { TRequestChargeResponse } from '@/services/services.types'
import type { RequestPayPayload } from '@/hooks/payment/types'
import type { PeanutCrossChainRoute } from '@/services/swap'

interface RequestPayConfirmProps {
    payload: RequestPayPayload
    chargeDetails?: TRequestChargeResponse | null
    route?: PeanutCrossChainRoute | null
    estimatedFees?: number
    isProcessing: boolean
    isPreparingRoute: boolean
    error?: string | null
    onConfirm: () => void
    onBack: () => void
}

/**
 * RequestPayConfirm - Confirmation view for request payment flow
 *
 * This component maintains the exact same UI as the legacy ConfirmPaymentView
 * but uses modern TanStack Query architecture underneath.
 *
 * Features:
 * - Transaction details display
 * - Fee estimation
 * - Cross-chain route information
 * - Loading states during preparation
 * - External wallet confirmation modal
 */
export const RequestPayConfirm = ({
    payload,
    chargeDetails,
    route,
    estimatedFees,
    isProcessing,
    isPreparingRoute,
    error,
    onConfirm,
    onBack,
}: RequestPayConfirmProps) => {
    const { isConnected: isPeanutWallet } = useWallet()
    const { isConnected: isExternalWallet } = useAccount()
    const { selectedTokenData, selectedChainID } = useContext(tokenSelectorContext)

    const isUsingExternalWallet = !isPeanutWallet

    // Token and chain icons for sending token
    const {
        tokenIconUrl: sendingTokenIconUrl,
        chainIconUrl: sendingChainIconUrl,
        resolvedChainName: sendingResolvedChainName,
        resolvedTokenSymbol: sendingResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: isUsingExternalWallet ? selectedChainID : PEANUT_WALLET_CHAIN.id.toString(),
        tokenAddress: isUsingExternalWallet ? selectedTokenData?.address : PEANUT_WALLET_TOKEN,
        tokenSymbol: isUsingExternalWallet ? selectedTokenData?.symbol : PEANUT_WALLET_TOKEN_SYMBOL,
    })

    // Token and chain icons for requested token
    const {
        tokenIconUrl: requestedTokenIconUrl,
        chainIconUrl: requestedChainIconUrl,
        resolvedChainName: requestedResolvedChainName,
        resolvedTokenSymbol: requestedResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: chargeDetails?.chainId,
        tokenAddress: chargeDetails?.tokenAddress,
        tokenSymbol: chargeDetails?.tokenSymbol,
    })

    // Network fee calculation
    const networkFee = useMemo<string | React.ReactNode>(() => {
        if (estimatedFees === undefined) {
            return isUsingExternalWallet ? '-' : 'Sponsored by Peanut!'
        }

        // External wallet flows
        if (isUsingExternalWallet) {
            return estimatedFees < 0.01 ? '$ <0.01' : `$ ${estimatedFees.toFixed(2)}`
        }

        // Peanut-sponsored transactions
        if (estimatedFees < 0.01) return 'Sponsored by Peanut!'

        return (
            <>
                <span className="line-through">$ {estimatedFees.toFixed(2)}</span>
                {' - '}
                <span className="font-medium text-gray-500">Sponsored by Peanut!</span>
            </>
        )
    }, [estimatedFees, isUsingExternalWallet])

    // Determine if this is a cross-chain payment
    const isCrossChainPayment = useMemo((): boolean => {
        if (!chargeDetails) return false
        if (!isUsingExternalWallet) {
            return (
                !areEvmAddressesEqual(chargeDetails.tokenAddress, PEANUT_WALLET_TOKEN) ||
                chargeDetails.chainId !== PEANUT_WALLET_CHAIN.id.toString()
            )
        } else if (selectedTokenData && selectedChainID) {
            return (
                !areEvmAddressesEqual(chargeDetails.tokenAddress, selectedTokenData.address) ||
                chargeDetails.chainId !== selectedChainID
            )
        }
        return false
    }, [chargeDetails, selectedTokenData, selectedChainID, isUsingExternalWallet])

    // Calculate minimum received amount
    const minReceived = useMemo<string | null>(() => {
        if (!chargeDetails?.tokenDecimals || !requestedResolvedTokenSymbol) return null
        if (!route) {
            return `$ ${chargeDetails?.tokenAmount}`
        }
        const amount = formatAmount(
            formatUnits(BigInt(route.rawResponse.route.estimate.toAmountMin), chargeDetails.tokenDecimals)
        )
        return isStableCoin(requestedResolvedTokenSymbol) ? `$ ${amount}` : `${amount} ${requestedResolvedTokenSymbol}`
    }, [route, chargeDetails?.tokenDecimals, requestedResolvedTokenSymbol])

    // Show external wallet confirmation modal
    const showExternalWalletModal = useMemo((): boolean => {
        return isProcessing && isUsingExternalWallet
    }, [isProcessing, isUsingExternalWallet])

    if (!chargeDetails) {
        return (
            <div className="flex items-center justify-center p-8">
                <ErrorAlert description="Charge details not found" />
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader title="Send" onPrev={onBack} />

            <div className="my-auto flex h-full flex-col justify-center space-y-4 pb-5">
                {/* Payment Details Card */}
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="REQUEST_PAYMENT"
                    recipientType="ADDRESS" // Will be enhanced based on actual recipient type
                    recipientName={chargeDetails.requestLink.recipientAddress}
                    amount={`$ ${formatAmount(chargeDetails.tokenAmount)}`}
                    tokenSymbol={chargeDetails.tokenSymbol}
                    message={chargeDetails.requestLink.reference || ''}
                    fileUrl={chargeDetails.requestLink.attachmentUrl || ''}
                    showTimer={isCrossChainPayment && route?.type === 'rfq'}
                    timerExpiry={route?.expiry}
                    isTimerLoading={isPreparingRoute}
                    disableTimerRefetch={isProcessing}
                />

                {/* Transaction Details */}
                <Card className="rounded-sm">
                    <PaymentInfoRow
                        label="Min Received"
                        loading={!minReceived || isPreparingRoute}
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
                                    fallbackTokenSymbol={chargeDetails.tokenSymbol}
                                    resolvedChainName={requestedResolvedChainName}
                                    fallbackChainName={chargeDetails.chainId}
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
                                fallbackTokenSymbol={selectedTokenData?.symbol || ''}
                                resolvedChainName={sendingResolvedChainName}
                                fallbackChainName={selectedChainID || ''}
                            />
                        }
                    />

                    <PaymentInfoRow loading={isPreparingRoute} label="Network fee" value={networkFee} />

                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value="$ 0.00" />
                </Card>

                {/* Action Button */}
                <div className="flex flex-col gap-4">
                    <Button
                        disabled={(!isPeanutWallet && !isExternalWallet) || isProcessing}
                        onClick={onConfirm}
                        loading={isProcessing}
                        shadowSize="4"
                        className="w-full"
                        icon="arrow-up-right"
                        iconSize={14}
                    >
                        {isProcessing ? 'Sending' : 'Send'}
                    </Button>

                    {error && (
                        <div className="space-y-2">
                            <ErrorAlert description={error} />
                        </div>
                    )}
                </div>

                {/* External Wallet Confirmation Modal */}
                <ActionModal
                    visible={showExternalWalletModal}
                    onClose={() => {}} // Prevent closing during transaction
                    title="Continue in your wallet"
                    description="Please confirm the transaction in your wallet app to proceed."
                    isLoadingIcon={true}
                    preventClose={true}
                />
            </div>
        </div>
    )
}

interface TokenChainInfoDisplayProps {
    tokenIconUrl?: string
    chainIconUrl?: string
    resolvedTokenSymbol?: string
    fallbackTokenSymbol: string
    resolvedChainName?: string
    fallbackChainName: string
}

/**
 * Displays token and chain information with icons and names.
 * Shows token icon with chain icon as a badge overlay, along with formatted text.
 */
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
                        <img src={tokenIconUrl} alt={`${tokenSymbol} token`} className="h-6 w-6 rounded-full" />
                    )}
                    {chainIconUrl && (
                        <div className="absolute -bottom-1 -right-1">
                            <img
                                src={chainIconUrl}
                                alt={`${chainName} chain`}
                                className="h-3.5 w-3.5 rounded-full border-2 border-white dark:border-grey-4"
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
