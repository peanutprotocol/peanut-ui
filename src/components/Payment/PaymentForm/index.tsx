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
import { normalizeChainName } from '@/lib/validation/chain-resolver'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useContext, useEffect, useState } from 'react'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | number | null
}

export const PaymentForm = ({ recipient, amount, token, chain }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const [tokenValue, setTokenValue] = useState<string>(amount || '')
    const { selectedWallet, isWalletConnected } = useWallet()
    const { setSelectedChainID, setSelectedTokenAddress } = useContext(context.tokenSelectorContext)

    // Effect to set initial chain and token from URL params
    useEffect(() => {
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
    }, [chain, token, setSelectedChainID, setSelectedTokenAddress])

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
                attachmentOptions={{
                    fileUrl: '',
                    message: '',
                    rawFile: undefined,
                }}
                setAttachmentOptions={() => {}}
            />

            <Button
                onClick={() => {
                    console.log('Pay Request Action')
                    dispatch(paymentActions.setView(2))
                }}
                disabled={!isWalletConnected || !tokenValue}
                className="w-full"
            >
                {!isWalletConnected ? 'Connect Wallet' : 'Pay'}
            </Button>
        </div>
    )
}
