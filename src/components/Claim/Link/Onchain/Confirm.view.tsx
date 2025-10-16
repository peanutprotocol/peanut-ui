'use client'
import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useWallet } from '@/hooks/wallet/useWallet'
import { type IExtendedLinkDetails } from '@/interfaces'
import { ErrorHandler, formatTokenAmount, saveClaimedLinkToLocalStorage, printableAddress, isStableCoin } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useContext, useState, useMemo } from 'react'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import useClaimLink from '../../useClaimLink'
import { useAuth } from '@/context/authContext'
import { sendLinksApi } from '@/services/sendLinks'

export const ConfirmClaimLinkView = ({
    onNext,
    onPrev,
    setClaimType,
    claimLinkData,
    recipient,
    tokenPrice,
    setTransactionHash,
    estimatedPoints,
    attachment,
    selectedRoute,
}: _consts.IClaimScreenProps) => {
    const { address, fetchBalance } = useWallet()
    const { user } = useAuth()
    const { claimLinkXchain, claimLink } = useClaimLink()
    const { selectedChainID, selectedTokenAddress, isXChain } = useContext(tokenSelectorContext)
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    // We may need this when we re add rewards via specific tokens
    // If not, feel free to remove
    const isReward = useMemo(() => {
        return false
    }, [])

    // Determine which chain/token details to show – prefer the selectedRoute details if present,
    // otherwise fall back to what the user picked in the token selector.
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: selectedRoute?.rawResponse.route.params.toChain ?? selectedChainID,
        tokenAddress: selectedRoute?.rawResponse.route.estimate.toToken.address ?? selectedTokenAddress,
        tokenSymbol: selectedRoute?.rawResponse.route.estimate.toToken.symbol ?? claimLinkData.tokenSymbol,
    })

    const minReceived = useMemo<string>(() => {
        if (!selectedRoute || !resolvedTokenSymbol) return ''
        const amount = formatUnits(
            BigInt(selectedRoute.rawResponse.route.estimate.toAmountMin),
            selectedRoute.rawResponse.route.estimate.toToken.decimals
        )
        return isStableCoin(resolvedTokenSymbol) ? `$ ${amount}` : `${amount} ${resolvedTokenSymbol}`
    }, [selectedRoute, resolvedTokenSymbol, claimLinkData])

    // Network fee display – always sponsored in this flow
    const networkFeeDisplay: string = 'Sponsored by Peanut!'

    const handleOnClaim = async () => {
        if (!recipient) {
            return
        }

        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let claimTxHash = ''
            if (selectedRoute) {
                claimTxHash = await claimLinkXchain({
                    address: recipient ? recipient.address : (address ?? ''),
                    link: claimLinkData.link,
                    destinationChainId: selectedChainID,
                    destinationToken: selectedTokenAddress,
                })
                setClaimType('claimxchain')
            } else {
                claimTxHash = await claimLink({
                    address: recipient ? recipient.address : (address ?? ''),
                    link: claimLinkData.link,
                })
                setClaimType('claim')
            }
            if (claimTxHash) {
                // associate the claim with the user so it shows up in their activity
                if (user) {
                    try {
                        await sendLinksApi.associateClaim(claimTxHash)
                    } catch (e) {
                        Sentry.captureException(e)
                        console.error('Failed to associate claim', e)
                    }
                }
                saveClaimedLinkToLocalStorage({
                    address: recipient ? recipient.address : (address ?? ''),
                    data: {
                        ...claimLinkData,
                        depositDate: new Date(),
                        USDTokenPrice: tokenPrice,
                        points: estimatedPoints,
                        txHash: claimTxHash,
                        message: attachment.message ? attachment.message : undefined,
                        attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
                    } as unknown as IExtendedLinkDetails,
                })
                setTransactionHash(claimTxHash)
                onNext()
                fetchBalance()
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
            Sentry.captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader title="Claim" onPrev={onPrev} />
            </div>
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={claimLinkData.sender?.username ?? printableAddress(claimLinkData.senderAddress)}
                    amount={
                        isReward
                            ? formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!
                            : (formatTokenAmount(
                                  Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                              ) ?? '')
                    }
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                />
                {!isReward && (
                    <Card>
                        {/* Min received row */}
                        {minReceived && (
                            <PaymentInfoRow
                                label="Min Received"
                                value={minReceived}
                                moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
                            />
                        )}

                        {/* Token & network row */}
                        {
                            <PaymentInfoRow
                                label="Token and network"
                                value={
                                    <div className="flex items-center gap-2">
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
                                        <span>
                                            {resolvedTokenSymbol || claimLinkData.tokenSymbol} on{' '}
                                            <span className="capitalize">{resolvedChainName || selectedChainID}</span>
                                        </span>
                                    </div>
                                }
                            />
                        }

                        {/* Max network fee row */}
                        <PaymentInfoRow label="Max network fee" value={networkFeeDisplay} />

                        {/* Peanut fee row */}
                        <PaymentInfoRow label="Peanut fee" value={'$ 0.00'} hideBottomBorder />
                    </Card>
                )}

                <Button
                    icon="arrow-down"
                    shadowSize="4"
                    onClick={handleOnClaim}
                    disabled={isLoading || (isXChain && !selectedRoute)}
                    loading={isLoading || (isXChain && !selectedRoute)}
                >
                    Receive now
                </Button>

                {errorState.showError && <ErrorAlert description={errorState.errorMessage} />}
            </div>
        </div>
    )
}
