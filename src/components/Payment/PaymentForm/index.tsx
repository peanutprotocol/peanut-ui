'use client'

import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { getReadableChainName, normalizeChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { CreateChargeRequest } from '@/services/services.types'
import { ErrorHandler, isNativeCurrency, printableAddress } from '@/utils'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | number | null
    recipientType?: RecipientType
}

export const PaymentForm = ({ recipient, amount, token, chain, recipientType }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, requestDetails, resolvedAddress, error } = usePaymentStore()
    const [tokenValue, setTokenValue] = useState<string>(amount || requestDetails?.tokenAmount || '')
    const { signInModal, isPeanutWallet } = useWallet()
    const {
        selectedChainID,
        selectedTokenDecimals,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,
    } = useContext(context.tokenSelectorContext)
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const { isConnected: isExternalWalletConnected } = useAccount()
    const isConnected = isExternalWalletConnected || isPeanutWallet

    const tokenInfo = useMemo(() => SUPPORTED_TOKENS[token?.toUpperCase() || ''], [token])

    const urlChainName = chain && getReadableChainName(chain?.toString())

    const showPeanutWalletWarning =
        recipientType === 'USERNAME' &&
        ((urlChainName && urlChainName !== PEANUT_WALLET_CHAIN.name) ||
            (tokenInfo && tokenInfo.symbol.toUpperCase() !== PEANUT_WALLET_TOKEN))

    // effect to set initial chain and token from URL params only once
    useEffect(() => {
        if (initialSetupDone) return

        // Set chain from URL if present
        if (chain) {
            let chainId: string | undefined

            if (typeof chain === 'number') {
                // Direct number from URL parsing
                chainId = chain.toString()
            } else if (typeof chain === 'string') {
                // try to parse as number
                const numericChainId = parseInt(chain)
                if (!isNaN(numericChainId)) {
                    const matchedChain = supportedPeanutChains.find((c) => Number(c.chainId) === numericChainId)
                    if (matchedChain) {
                        chainId = matchedChain.chainId.toString()
                    }
                } else {
                    // if not a number, try to match chain name
                    const normalizedChainName = normalizeChainName(chain)
                    const matchedChain = supportedPeanutChains.find(
                        (c) => normalizeChainName(c.name.toLowerCase()) === normalizedChainName
                    )
                    if (matchedChain) {
                        chainId = matchedChain.chainId.toString()
                    }
                }
            }

            if (chainId) {
                setSelectedChainID(chainId)
            }
        }

        // set token from URL if present
        if (token) {
            const upperToken = token.toUpperCase()
            const chainId = Number(selectedChainID)

            // handle native ETH
            if (upperToken === 'ETH') {
                // Set native token address
                setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
            } else {
                // handle other tokens
                const tokenInfo = SUPPORTED_TOKENS[upperToken]
                if (tokenInfo && tokenInfo.addresses[chainId]) {
                    setSelectedTokenAddress(tokenInfo.addresses[chainId])
                }
            }
        }

        setInitialSetupDone(true)
    }, [chain, token, setSelectedChainID, setSelectedTokenAddress, selectedChainID, initialSetupDone])

    // reset error when component mounts or recipient changes
    useEffect(() => {
        dispatch(paymentActions.setError(null))
    }, [dispatch, recipient])

    const handleCreateRequest = async () => {
        if (!isConnected) {
            signInModal.open()

            return
        }

        if (!tokenValue || isSubmitting) return

        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            // use already resolved address from redux or the original address if it's already an address
            const recipientAddress = isAddress(recipient) ? recipient : resolvedAddress

            if (!recipientAddress) {
                throw new Error('No valid recipient address')
            }

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
                    chainId: selectedChainID.toString(),
                    tokenAddress: selectedTokenAddress,
                    tokenType: isNativeCurrency(selectedTokenAddress) ? 'native' : 'erc20',
                    tokenSymbol: selectedTokenData?.symbol || token?.toUpperCase() || '',
                    tokenDecimals: selectedTokenDecimals || 18,
                    recipientAddress: recipientAddress,
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
    const canCreateRequest = useMemo(() => {
        return Boolean(recipient && tokenValue && selectedTokenAddress && selectedChainID)
    }, [recipient, tokenValue, selectedTokenAddress, selectedChainID])

    // get descriptive error messages
    const getValidationMessage = () => {
        if (!recipient) return 'Recipient address is required'
        if (!tokenValue) return 'Please enter an amount'
        if (!selectedTokenAddress) return 'Please select a token'
        if (!selectedChainID) return 'Please select a chain'
        return ''
    }

    // Get button text based on state
    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isSubmitting) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🥜</span>
                    <span>Processing...</span>
                </div>
            )
        }
        return 'Pay'
    }

    const renderRequestedPaymentDetails = () => {
        if (!requestDetails) return null

        return (
            <div className="mb-6 border border-dashed border-black p-4">
                <div className="text-sm font-semibold text-black">
                    {printableAddress(requestDetails?.recipientAddress)} is requesting:
                </div>
                <div className="flex flex-col">
                    <InfoRow
                        label="Amount"
                        value={`${requestDetails.tokenAmount} ${requestDetails.tokenSymbol || token}`}
                    />
                    {requestDetails.chainId && (
                        <InfoRow label="Network" value={getReadableChainName(requestDetails.chainId)} />
                    )}
                    {requestDetails.reference && <InfoRow label="Message" value={requestDetails.reference} />}
                    {requestDetails.attachmentUrl && (
                        <InfoRow
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

            <div className="text-h6 font-bold">Sending to {recipient}</div>

            <TokenAmountInput
                tokenValue={tokenValue}
                setTokenValue={(value: string | undefined) => setTokenValue(value || '')}
                className="w-full"
                disabled={!!amount}
            />

            {/* Requested payment details if available */}
            {renderRequestedPaymentDetails()}

            {/* Always show token selector for payment options */}
            {!isPeanutWallet && (
                <div>
                    <div className="mb-2 text-sm font-medium">Choose your payment method:</div>
                    <TokenSelector />
                </div>
            )}

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
            />

            {/* Show Peanut Wallet cross-chain warning */}
            {isPeanutWalletCrossChainRequest && (
                <ErrorAlert
                    error={
                        'Cross-chain payments are not supported with Peanut Wallet yet. Switch to an external wallet to pay this request.'
                    }
                />
            )}

            <div className="space-y-2">
                <Button
                    shadowSize="4"
                    onClick={handleCreateRequest}
                    disabled={!canCreateRequest || isSubmitting || isPeanutWalletCrossChainRequest}
                    className="w-full"
                >
                    {getButtonText()}
                </Button>

                {!canCreateRequest && !error && (
                    <div className="text-start text-sm text-red">{getValidationMessage()}</div>
                )}

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
