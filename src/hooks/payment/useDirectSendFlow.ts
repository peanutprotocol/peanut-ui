'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { CreateChargeRequest, PaymentCreationResponse, TRequestChargeResponse } from '@/services/services.types'
import { ErrorHandler } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useState } from 'react'
import type { Address } from 'viem'

export interface DirectSendPayload {
    recipient: {
        identifier: string
        resolvedAddress: string
    }
    tokenAmount: string
    requestId?: string
    attachmentOptions?: {
        message?: string
        rawFile?: File
    }
}

interface DirectSendResult {
    success: boolean
    charge?: TRequestChargeResponse
    payment?: PaymentCreationResponse
    txHash?: string
    error?: string
}

/**
 * Hook for handling direct send payments (Peanut → Peanut, USDC only)
 *
 * This is the simplest payment flow:
 * 1. Create charge
 * 2. Send USDC using Peanut wallet
 * 3. Create payment record
 *
 * No cross-chain complexity, no external wallets, just pure USDC transfers.
 */
export const useDirectSendFlow = () => {
    const { sendMoney, address: peanutWalletAddress } = useWallet()
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [chargeDetails, setChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)

    const reset = useCallback(() => {
        setError(null)
        setChargeDetails(null)
        setPaymentDetails(null)
        setTransactionHash(null)
    }, [])

    const sendDirectly = useCallback(
        async (payload: DirectSendPayload): Promise<DirectSendResult> => {
            setIsProcessing(true)
            setError(null)

            try {
                console.log('🚀 Starting direct send flow:', payload)

                // 1. Create charge using existing chargesApi
                const createChargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: {
                        amount: payload.tokenAmount,
                        currency: 'USD',
                    },
                    baseUrl: window.location.origin,
                    requestId: payload.requestId,
                    requestProps: {
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        tokenAmount: payload.tokenAmount,
                        tokenAddress: PEANUT_WALLET_TOKEN,
                        tokenType: peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: 'USDC',
                        tokenDecimals: 6,
                        recipientAddress: payload.recipient.resolvedAddress,
                    },
                    transactionType: 'DIRECT_SEND',
                }

                // Add attachment if present
                if (payload.attachmentOptions?.rawFile) {
                    createChargePayload.attachment = payload.attachmentOptions.rawFile
                    createChargePayload.filename = payload.attachmentOptions.rawFile.name
                    createChargePayload.mimeType = payload.attachmentOptions.rawFile.type
                }
                if (payload.attachmentOptions?.message) {
                    createChargePayload.reference = payload.attachmentOptions.message
                }

                console.log('📝 Creating charge with payload:', createChargePayload)
                const charge = await chargesApi.create(createChargePayload)

                if (!charge.data.id) {
                    throw new Error('Charge created but UUID is missing')
                }

                // 2. Get full charge details
                console.log('📋 Fetching charge details for ID:', charge.data.id)
                const fullChargeDetails = await chargesApi.get(charge.data.id)
                setChargeDetails(fullChargeDetails)

                // 3. Send USDC using Peanut wallet (simple transfer)
                console.log('💸 Sending USDC to:', fullChargeDetails.requestLink.recipientAddress)
                const receipt = await sendMoney(
                    fullChargeDetails.requestLink.recipientAddress as Address,
                    payload.tokenAmount
                )

                if (!receipt || !receipt.transactionHash) {
                    throw new Error('Transaction failed or receipt missing')
                }

                setTransactionHash(receipt.transactionHash)
                console.log('✅ Transaction successful, hash:', receipt.transactionHash)

                // 4. Create payment record
                console.log('📊 Creating payment record...')
                const payment = await chargesApi.createPayment({
                    chargeId: fullChargeDetails.uuid,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    hash: receipt.transactionHash,
                    tokenAddress: PEANUT_WALLET_TOKEN,
                    payerAddress: peanutWalletAddress ?? '',
                })

                setPaymentDetails(payment)
                console.log('🎉 Direct send flow completed successfully!')

                return {
                    success: true,
                    charge: fullChargeDetails,
                    payment,
                    txHash: receipt.transactionHash,
                }
            } catch (err) {
                console.error('❌ Direct send flow failed:', err)
                const errorMessage = ErrorHandler(err)
                setError(errorMessage)

                return {
                    success: false,
                    error: errorMessage,
                }
            } finally {
                setIsProcessing(false)
            }
        },
        [sendMoney, peanutWalletAddress]
    )

    return {
        // Main action
        sendDirectly,

        // State
        isProcessing,
        error,
        chargeDetails,
        paymentDetails,
        transactionHash,

        // Utilities
        reset,
    }
}
