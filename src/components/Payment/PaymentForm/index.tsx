'use client'

import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { CreateChargeRequest } from '@/services/services.types'
import { ErrorHandler, isNativeCurrency, printableAddress, getTokenSymbol, getTokenDecimals } from '@/utils'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { PaymentInfoRow } from '../PaymentInfoRow'
import { AccountType } from '@/interfaces'

export const PaymentForm = ({ recipient, amount, token, chain }: ParsedURL) => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, requestDetails, error, chargeDetails } = usePaymentStore()
    const { isConnected: isExternalWalletConnected } = useAccount()
    const { signInModal, isPeanutWallet } = useWallet()
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [tokenValue, setTokenValue] = useState<string>(
        chargeDetails?.tokenAmount || requestDetails?.tokenAmount || ''
    )
    const {
        selectedChainID,
        selectedTokenDecimals,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,
        inputDenomination,
    } = useContext(context.tokenSelectorContext)
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const isConnected = isExternalWalletConnected || isPeanutWallet

    const recipientChainId = useMemo<string>(() => {
        if (chargeDetails?.chainId) return chargeDetails.chainId
        if (requestDetails?.chainId) return requestDetails.chainId
        switch (recipient.recipientType) {
            case 'USERNAME':
                return PEANUT_WALLET_CHAIN.id.toString()
            case 'ENS':
            case 'ADDRESS':
                return selectedChainID
            default:
                throw new Error('Invalid recipient type')
        }
    }, [chargeDetails?.chainId, requestDetails?.chainId, recipient, selectedChainID])

    const recipientTokenAddress = useMemo<string>(() => {
        if (chargeDetails?.tokenAddress) return chargeDetails.tokenAddress
        if (requestDetails?.tokenAddress) return requestDetails.tokenAddress
        switch (recipient.recipientType) {
            case 'USERNAME':
                return PEANUT_WALLET_TOKEN
            case 'ENS':
            case 'ADDRESS':
                return selectedTokenAddress
            default:
                throw new Error('Invalid recipient type')
        }
    }, [chargeDetails?.tokenAddress, requestDetails?.tokenAddress, recipient, selectedTokenAddress])

    const recipientTokenSymbol = useMemo<string>(() => {
        if (chargeDetails?.tokenSymbol) return chargeDetails.tokenSymbol
        if (requestDetails?.tokenSymbol) return requestDetails.tokenSymbol
        switch (recipient.recipientType) {
            case 'USERNAME':
                return 'USDC'
            case 'ENS':
            case 'ADDRESS':
                let tokenSymbol = selectedTokenData?.symbol ?? getTokenSymbol(recipientTokenAddress, recipientChainId)
                if (!tokenSymbol) {
                    throw new Error('Failed to get token symbol')
                }
                return tokenSymbol
            default:
                throw new Error('Invalid recipient type')
        }
    }, [
        chargeDetails?.tokenSymbol,
        requestDetails?.tokenSymbol,
        selectedTokenData?.symbol,
        recipient,
        recipientTokenAddress,
        recipientChainId,
    ])

    const recipientTokenDecimals = useMemo<number>(() => {
        if (chargeDetails?.tokenDecimals) return chargeDetails.tokenDecimals
        if (requestDetails?.tokenDecimals) return requestDetails.tokenDecimals
        switch (recipient.recipientType) {
            case 'USERNAME':
                return 6
            case 'ENS':
            case 'ADDRESS':
                let tokenDecimals =
                    selectedTokenData?.decimals ?? getTokenDecimals(recipientTokenAddress, recipientChainId)
                if (!tokenDecimals) {
                    throw new Error('Failed to get token decimals')
                }
                return tokenDecimals
            default:
                throw new Error('Invalid recipient type')
        }
    }, [
        chargeDetails?.tokenDecimals,
        requestDetails?.tokenDecimals,
        recipient,
        selectedTokenDecimals,
        recipientTokenAddress,
        recipientChainId,
        selectedTokenData?.decimals,
    ])

    // set initial values from parsedPaymentData
    useEffect(() => {
        if (initialSetupDone) return

        // set token amount if present
        if (amount) {
            setTokenValue(amount)
        }

        // set chain from URL if present
        if (chain) {
            setSelectedChainID((chain.chainId || requestDetails?.chainId) ?? '')
        }

        // set token from URL if present
        if (token) {
            setSelectedTokenAddress((token.address || requestDetails?.tokenAddress) ?? '')
        }

        setInitialSetupDone(true)
    }, [chain?.chainId, token?.address, amount, setSelectedChainID, setSelectedTokenAddress, initialSetupDone])

    // reset error when component mounts or recipient changes
    useEffect(() => {
        dispatch(paymentActions.setError(null))
    }, [dispatch, recipient])

    useEffect(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isPeanutWallet])

    const handleCreateCharge = async () => {
        if (!isConnected) {
            signInModal.open()

            return
        }

        if (!tokenValue || isSubmitting) return

        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            // if request ID available in URL, validate it
            let validRequestId: string | undefined = undefined
            if (requestId) {
                try {
                    const request = await requestsApi.get(requestId)
                    validRequestId = request.uuid
                } catch (error) {
                    throw new Error('Invalid request ID')
                }
            } else if (!requestDetails) {
                throw new Error('Request details not found')
            }

            const createChargeRequestPayload: CreateChargeRequest = {
                pricing_type: 'fixed_price',
                local_price: {
                    amount: tokenValue,
                    currency: 'USD',
                },
                baseUrl: window.location.origin,
                requestId: validRequestId || requestDetails!.uuid, // Use validated request ID if available
                requestProps: {
                    chainId: recipientChainId,
                    tokenAddress: recipientTokenAddress,
                    tokenType: isNativeCurrency(recipientTokenAddress) ? 'native' : 'erc20',
                    tokenSymbol: recipientTokenSymbol,
                    tokenDecimals: recipientTokenDecimals,
                    recipientAddress: recipient.resolvedAddress,
                },
            }

            // add attachment if present
            if (attachmentOptions?.rawFile) {
                createChargeRequestPayload.attachment = attachmentOptions.rawFile
            }
            if (attachmentOptions?.message) {
                createChargeRequestPayload.reference = attachmentOptions.message
            }

            // create charge using existing request ID and resolved address
            const charge = await chargesApi.create(createChargeRequestPayload)

            // replace URL params - remove requestId and add chargeId
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.delete('id') // reemove request ID
            newUrl.searchParams.set('chargeId', charge.data.id) // add charge ID
            window.history.replaceState(null, '', newUrl.toString())

            dispatch(paymentActions.setCreatedChargeDetails(charge))
            dispatch(paymentActions.setView('CONFIRM'))
        } catch (error) {
            console.error('Failed to create charge:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
        } finally {
            setIsSubmitting(false)
        }
    }

    // check if all required fields are present
    const canCreateCharge = useMemo(() => {
        return Boolean(recipient && tokenValue && selectedTokenAddress && selectedChainID)
    }, [recipient, tokenValue, selectedTokenAddress, selectedChainID])

    // Get button text based on state
    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isSubmitting) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span>Hang on...</span>
                </div>
            )
        }
        return 'Pay'
    }

    const resetTokenAndChain = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        } else {
            setSelectedChainID((requestDetails?.chainId || chain?.chainId) ?? '')
            setSelectedTokenAddress((requestDetails?.tokenAddress || token?.address) ?? '')
        }
    }, [requestDetails, isPeanutWallet])

    const recipientLabel = useMemo(() => {
        if (!requestDetails) return ''

        if (requestDetails.recipientAccount.type === AccountType.PEANUT_WALLET) {
            return requestDetails.recipientAccount.user.username
        }

        return printableAddress(requestDetails.recipientAddress)
    }, [requestDetails])

    const renderRequestedPaymentDetails = () => {
        if (!requestDetails) return null

        return (
            <div className="mb-6 border border-dashed border-black p-4">
                <div className="text-sm font-semibold text-black">{recipientLabel} is requesting:</div>
                <div className="flex flex-col">
                    <PaymentInfoRow
                        label="Amount"
                        value={`${requestDetails.tokenAmount} ${requestDetails.tokenSymbol || token?.symbol}`}
                    />
                    {requestDetails.chainId && (
                        <PaymentInfoRow label="Network" value={getReadableChainName(requestDetails.chainId)} />
                    )}
                    {requestDetails.reference && <PaymentInfoRow label="Message" value={requestDetails.reference} />}
                    {requestDetails.attachmentUrl && (
                        <PaymentInfoRow
                            label="Attachment"
                            value={
                                <a
                                    href={requestDetails.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-0.5 text-sm font-semibold hover:underline"
                                >
                                    <span>Download</span>
                                    <Icon name="download" className="h-4 fill-grey-1" />
                                </a>
                            }
                        />
                    )}
                </div>
                <div className="mt-4 text-xs text-grey-1">
                    You can choose to pay with any token on any network. The payment will be automatically converted to
                    the requested token.
                </div>
            </div>
        )
    }

    // check if this is a cross-chain request for Peanut Wallet
    const isPeanutWalletCrossChainRequest = useMemo(() => {
        if (!requestDetails || !isPeanutWallet) return false

        // check if requested chain and token match Peanut Wallet's supported chain/token
        return (
            requestDetails.chainId !== PEANUT_WALLET_CHAIN.id.toString() ||
            requestDetails.tokenAddress.toLowerCase() !== PEANUT_WALLET_TOKEN.toLowerCase()
        )
    }, [requestDetails, isPeanutWallet])

    return (
        <div className="space-y-4">
            <FlowHeader />

            {/* Show recipient from parsed data */}
            <div className="text-h6 font-bold">
                Sending to{' '}
                {recipient.recipientType === 'USERNAME' ? (
                    recipient.identifier
                ) : (
                    <AddressLink address={recipient?.identifier} />
                )}
            </div>

            <TokenAmountInput
                tokenValue={tokenValue}
                setTokenValue={(value: string | undefined) => setTokenValue(value || '')}
                className="w-full"
                disabled={!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount}
            />

            {requestDetails?.recipientAccount.type !== AccountType.PEANUT_WALLET && renderRequestedPaymentDetails()}

            {!isPeanutWallet && (
                <div>
                    <div className="mb-2 text-sm font-medium">Choose your payment method:</div>
                    <TokenSelector onReset={resetTokenAndChain} showOnlySquidSupported />
                </div>
            )}

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
            />

            {/* Show Peanut Wallet cross-chain warning */}
            {isPeanutWalletCrossChainRequest && (
                <ErrorAlert
                    label="Note"
                    description={
                        'Cross-chain payments are not supported with Peanut Wallet yet. Switch to an external wallet to pay this request.'
                    }
                />
            )}

            {!isPeanutWallet && !requestId && (
                <div className="mt-4 text-xs text-grey-1">
                    You can choose to pay with any token on any network. The payment will be automatically converted to
                    the requested token.
                </div>
            )}

            <div className="space-y-2">
                <Button
                    loading={isSubmitting}
                    shadowSize="4"
                    onClick={handleCreateCharge}
                    disabled={!canCreateCharge || isSubmitting || isPeanutWalletCrossChainRequest}
                    className="w-full"
                >
                    {getButtonText()}
                </Button>

                {error && (
                    <div className="bg-red-50 rounded-md p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">⚠️</div>
                            <div className="ml-3">
                                <h3 className="text-red-800 text-sm font-medium">Error</h3>
                                <div className="text-red-700 mt-2 text-sm">{error}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
