'use client'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IExtendedLinkDetails } from '@/interfaces'
import { ErrorHandler, formatTokenAmount, saveClaimedLinkToLocalStorage } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import Image from 'next/image'
import { useContext, useState } from 'react'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import useClaimLink from '../../useClaimLink'

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
    const { claimLinkXchain, claimLink } = useClaimLink()
    const { selectedChainID, selectedTokenAddress, supportedSquidChainsAndTokens } = useContext(tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [fileType] = useState<string>('')

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
                    recipientName={claimLinkData.sender.username}
                    amount={
                        formatTokenAmount(
                            Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                        ) ?? ''
                    }
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                />
                <Card>
                    <PaymentInfoRow
                        label="Claiming to"
                        value={
                            <AddressLink
                                address={recipient.name ?? recipient.address ?? ''}
                                className="text-sm text-black no-underline"
                            />
                        }
                    />
                    <PaymentInfoRow
                        label="Token and network"
                        value={
                            <div className="flex items-center gap-2">
                                <div className="relative flex h-5 w-5">
                                    <Image
                                        src={`${supportedSquidChainsAndTokens[selectedRoute.route.params.toChain]?.chainIconURI}`}
                                        alt={selectedRoute.route.estimate.toToken.symbol}
                                        width={10}
                                        height={10}
                                        className="absolute -right-1 bottom-0"
                                    />
                                    <Image
                                        src={`${
                                            supportedSquidChainsAndTokens[
                                                selectedRoute.route.params.toChain
                                            ]?.tokens.find(
                                                (token) => token.symbol === selectedRoute.route.estimate.toToken.symbol
                                            )?.logoURI
                                        }`}
                                        alt={selectedRoute.route.estimate.toToken.symbol}
                                        width={20}
                                        height={20}
                                    />
                                </div>
                                <span>
                                    {selectedRoute.route.estimate.toToken.symbol} on{' '}
                                    <span className="capitalize">
                                        {
                                            supportedSquidChainsAndTokens[selectedRoute.route.params.toChain]
                                                ?.axelarChainName
                                        }
                                    </span>
                                </span>
                            </div>
                        }
                    />
                    <PaymentInfoRow
                        label="Network fee"
                        value={'$ 0.00'}
                        moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
                    />
                    <PaymentInfoRow label="Peanut fee" value={'$ 0.00'} hideBottomBorder />
                </Card>

                <Button
                    icon="arrow-down"
                    shadowSize="4"
                    onClick={handleOnClaim}
                    disabled={isLoading}
                    loading={isLoading}
                >
                    {isLoading ? 'Claiming' : 'Claim'}
                </Button>
            </div>
        </div>
    )
}
