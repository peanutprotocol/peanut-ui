'use client'

import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_NAME, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { getReadableChainName, normalizeChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { isNativeCurrency } from '@/utils'
import { useContext, useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | number | null
    recipientType?: RecipientType
}

export const PaymentForm = ({ recipient, amount, token, chain, recipientType }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, requestDetails, resolvedAddress } = usePaymentStore()
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

    const tokenInfo = useMemo(() => SUPPORTED_TOKENS[token?.toUpperCase() || ''], [token])

    const urlChainName = chain && getReadableChainName(chain?.toString())

    const showPeanutWalletWarning =
        recipientType === 'USERNAME' &&
        ((urlChainName && urlChainName !== PEANUT_WALLET_CHAIN.name) ||
            (tokenInfo && tokenInfo.symbol.toUpperCase() !== PEANUT_WALLET_TOKEN_NAME))

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

    const handleCreateRequest = async () => {
        if (!tokenValue || isSubmitting) return

        setIsSubmitting(true)
        try {
            // Use already resolved address from redux or the original address if it's already an address
            const recipientAddress = isAddress(recipient) ? recipient : resolvedAddress

            if (!recipientAddress) {
                throw new Error('No valid recipient address')
            }

            if (!requestDetails) {
                throw new Error('Request details not found')
            }

            // Create charge using existing request ID and resolved address
            const charge = await chargesApi.create({
                pricing_type: 'fixed_price',
                local_price: {
                    amount: tokenValue,
                    currency: 'USD',
                },
                baseUrl: window.location.origin,
                requestId: requestDetails.uuid,
                requestProps: {
                    chainId: selectedChainID.toString(),
                    tokenAddress: selectedTokenAddress,
                    tokenType: isNativeCurrency(selectedTokenAddress) ? 'native' : 'erc20',
                    tokenSymbol: selectedTokenData?.symbol || '',
                    tokenDecimals: selectedTokenDecimals || 18,
                    recipientAddress: recipientAddress,
                },
            })

            window.history.replaceState(null, '', `${window.location.pathname}?chargeId=${charge.data.id}`)
            dispatch(paymentActions.setCreatedChargeDetails(charge))
            dispatch(paymentActions.setView('CONFIRM'))
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

            {/* Always show token selector for payment options */}
            <div>
                <div className="mb-2 text-sm font-medium">Choose your payment method:</div>
                <TokenSelector />
            </div>

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
            />

            {/* Show destination details if specified in URL */}
            {(chain || token) && (
                <div className="shadow-primary-4 border border-black bg-white p-4">
                    <div className="text-sm font-medium">Recipient will receive:</div>
                    <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm">
                            <span className="uppercase">
                                {token || selectedTokenData?.name} on{' '}
                                {urlChainName || getReadableChainName(selectedChainID)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* todo: fix conditions for this note */}
            {/* {showPeanutWalletWarning && (
                <div className="py-2">
                    <div className="text-sm font-medium">
                        <span className="font-bold">Note:</span> You are trying to send {tokenInfo.symbol}{' '}
                        {urlChainName && `on ${urlChainName}`} to a native Peanut Wallet account, which at the moment
                        only accepts {PEANUT_WALLET_TOKEN_NAME} on {PEANUT_WALLET_CHAIN.name}. You can pay with any
                        ERC20 token or native token, but the {recipient} will receive {PEANUT_WALLET_TOKEN_NAME} on{' '}
                        {PEANUT_WALLET_CHAIN.name}.
                    </div>
                </div>
            )} */}

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
