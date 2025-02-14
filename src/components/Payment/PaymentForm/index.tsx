'use client'

import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { normalizeChainName } from '@/lib/validation/resolvers/chain-resolver'
import { resolveRecipientToAddress } from '@/lib/validation/resolvers/recipient-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { isNativeCurrency } from '@/utils'
import { useContext, useEffect, useState } from 'react'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | number | null
}

export const PaymentForm = ({ recipient, amount, token, chain }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, existingRequestId } = usePaymentStore()
    const [tokenValue, setTokenValue] = useState<string>(amount || '')
    const { selectedWallet, isWalletConnected } = useWallet()
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
    const [destinationChain] = useState(chain)
    const [destinationToken] = useState(token)

    // effect to set initial chain and token from URL params only once
    useEffect(() => {
        if (initialSetupDone) return

        if (chain) {
            // Handle chain setting
            if (typeof chain === 'number') {
                // If it's already a number, use it directly
                setSelectedChainID(chain.toString())
            } else {
                // If it's a string, normalize it and find matching chain
                const normalizedChainName = normalizeChainName(chain)
                const matchedChain = supportedPeanutChains.find(
                    (c) => normalizeChainName(c.name.toLowerCase()) === normalizedChainName
                )

                if (matchedChain) {
                    setSelectedChainID(matchedChain.chainId.toString())
                }
            }
        }

        if (token) {
            // Look up the token info
            const tokenInfo = SUPPORTED_TOKENS[token.toUpperCase()]
            if (tokenInfo) {
                let chainId: number | undefined

                // Determine chainId based on chain parameter type
                if (typeof chain === 'number') {
                    chainId = chain
                } else if (typeof chain === 'string') {
                    const normalizedChainName = normalizeChainName(chain)
                    const matchedChain = supportedPeanutChains.find(
                        (c) => normalizeChainName(c.name.toLowerCase()) === normalizedChainName
                    )
                    if (matchedChain) {
                        chainId = Number(matchedChain.chainId)
                    }
                }

                // If we have a valid chainId, try to set the token address
                if (chainId && tokenInfo.addresses[chainId]) {
                    setSelectedTokenAddress(tokenInfo.addresses[chainId])
                }
            }
        }

        setInitialSetupDone(true)
    }, [chain, token, setSelectedChainID, setSelectedTokenAddress, initialSetupDone])

    const handleCreateRequest = async () => {
        if (!tokenValue || isSubmitting) return

        setIsSubmitting(true)
        try {
            const resolvedAddress = await resolveRecipientToAddress(recipient)

            if (existingRequestId) {
                // create charge using existing request ID

                const tokenSymbol = selectedTokenData?.symbol || token

                if (!tokenSymbol) {
                    throw new Error('Token symbol not found')
                }
                const charge = await chargesApi.create({
                    pricing_type: 'fixed_price',
                    local_price: {
                        amount: tokenValue,
                        currency: 'USD',
                    },
                    baseUrl: window.location.origin,
                    requestId: existingRequestId || '',
                    requestProps: {
                        chainId: selectedChainID.toString(),
                        tokenAddress: selectedTokenAddress,
                        tokenType: isNativeCurrency(selectedTokenAddress) ? 'native' : 'erc20',
                        tokenSymbol,
                        tokenDecimals: selectedTokenDecimals || 18,
                        recipientAddress: resolvedAddress,
                    },
                })

                window.history.replaceState(null, '', `${window.location.pathname}?chargeId=${charge.data.id}`)
                dispatch(paymentActions.setRequestDetails({ ...charge.data }))
                dispatch(paymentActions.setView(2))
            }
        } catch (error) {
            console.error('Failed to create charge:', error)
            // todo: handle error better for users
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            <FlowHeader />
            <div className="text-h6 font-bold">Sending to {recipient}</div>

            <TokenAmountInput
                tokenValue={tokenValue}
                setTokenValue={(value: string | undefined) => setTokenValue(value || '')}
                className="w-full"
            />

            <TokenSelector />

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
            />

            {destinationChain && (
                <div className="text-sm text-gray-600">
                    Recipient will receive <span className="uppercase">{destinationToken}</span> on{' '}
                    <span className="capitalize">{destinationChain}</span>{' '}
                </div>
            )}

            <Button
                onClick={handleCreateRequest}
                disabled={!isWalletConnected || !tokenValue || isSubmitting}
                className="w-full"
            >
                {!isWalletConnected ? 'Connect Wallet' : isSubmitting ? 'Creating Request...' : 'Create Request'}
            </Button>
        </div>
    )
}
