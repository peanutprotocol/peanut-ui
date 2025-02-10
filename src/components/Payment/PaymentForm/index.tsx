'use client'

import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { IRequestLinkData } from '@/components/Request/Pay/Pay.consts'
import { supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { normalizeChainName } from '@/lib/validation/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { isNativeCurrency, saveRequestLinkToLocalStorage } from '@/utils'
import { interfaces, peanut } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useState } from 'react'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | number | null
}

export const PaymentForm = ({ recipient, amount, token, chain }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const { attachmentOptions } = usePaymentStore()
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

    // Effect to set initial chain and token from URL params only once
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
        try {
            const { link } = await peanut.createRequestLink({
                chainId: selectedChainID,
                recipientAddress: recipient,
                tokenAddress: selectedTokenAddress,
                tokenAmount: tokenValue,
                tokenDecimals: selectedTokenDecimals?.toString() || '18',
                tokenType: isNativeCurrency(selectedTokenAddress)
                    ? interfaces.EPeanutLinkType.native
                    : interfaces.EPeanutLinkType.erc20,
                tokenSymbol: selectedTokenData?.symbol || '',
                apiUrl: '/api/proxy/withFormData',
                baseUrl: `${window.location.origin}/request/pay`,
                attachment: attachmentOptions?.rawFile,
                reference: attachmentOptions?.message,
            })

            const requestLinkDetails = await peanut.getRequestLinkDetails({
                link,
                apiUrl: '/api/proxy/get',
            })

            // Save to localStorage and redux
            saveRequestLinkToLocalStorage({ details: requestLinkDetails as IRequestLinkData })
            dispatch(paymentActions.setRequestDetails(requestLinkDetails))
            dispatch(paymentActions.setView(2))
        } catch (error) {
            console.error('Failed to create request:', error)
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

            <Button onClick={handleCreateRequest} disabled={!isWalletConnected || !tokenValue} className="w-full">
                {!isWalletConnected ? 'Connect Wallet' : 'Create Request'}
            </Button>
        </div>
    )
}
