'use client'

/**
 * context provider for semantic request flow state
 *
 * handles payments via semantic urls like:
 * - /username (peanut user)
 * - /0x1234... (address)
 * - /vitalik.eth (ens)
 * - /username/10/usdc/arbitrum (with amount/token/chain)
 *
 * supports cross-chain payments - user pays in usdc on arbitrum,
 * recipient can receive on different chain/token
 *
 * note: token/chain selection uses tokenSelectorContext
 */

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import { type Address, type Hash } from 'viem'
import { type TRequestChargeResponse, type PaymentCreationResponse } from '@/services/services.types'
import { type ParsedURL, type RecipientType } from '@/lib/url-parser/types/payment'

// view states for semantic request flow
export type SemanticRequestFlowView = 'INITIAL' | 'CONFIRM' | 'STATUS' | 'RECEIPT'

// recipient info from parsed url
export interface SemanticRequestRecipient {
    identifier: string
    recipientType: RecipientType
    resolvedAddress: Address
}

// attachment state
interface SemanticRequestAttachment {
    message?: string
    file?: File
    fileUrl?: string
}

// error state
interface SemanticRequestError {
    showError: boolean
    errorMessage: string
}

// context value type
interface SemanticRequestFlowContextValue {
    // view state
    currentView: SemanticRequestFlowView
    setCurrentView: (view: SemanticRequestFlowView) => void

    // parsed url data
    parsedUrl: ParsedURL | null
    setParsedUrl: (data: ParsedURL | null) => void

    // recipient (from parsed url)
    recipient: SemanticRequestRecipient | null

    // charge id from url (for direct confirm view access)
    chargeIdFromUrl: string | undefined

    // amount state (can be preset from url or entered)
    amount: string
    setAmount: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void
    isAmountFromUrl: boolean
    isTokenFromUrl: boolean
    isChainFromUrl: boolean

    // attachment state
    attachment: SemanticRequestAttachment
    setAttachment: (attachment: SemanticRequestAttachment) => void

    // charge and payment results
    charge: TRequestChargeResponse | null
    setCharge: (charge: TRequestChargeResponse | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void

    // ui state
    error: SemanticRequestError
    setError: (error: SemanticRequestError) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    isSuccess: boolean
    setIsSuccess: (success: boolean) => void

    // actions
    resetSemanticRequestFlow: () => void
}

const SemanticRequestFlowContext = createContext<SemanticRequestFlowContextValue | null>(null)

interface SemanticRequestFlowProviderProps {
    children: ReactNode
    initialParsedUrl: ParsedURL
    initialChargeId?: string
}

export function SemanticRequestFlowProvider({
    children,
    initialParsedUrl,
    initialChargeId,
}: SemanticRequestFlowProviderProps) {
    // view state - start at CONFIRM if chargeId is present in url
    const [currentView, setCurrentView] = useState<SemanticRequestFlowView>(initialChargeId ? 'CONFIRM' : 'INITIAL')

    // store the initial charge id for fetching
    const [chargeIdFromUrl] = useState<string | undefined>(initialChargeId)

    // parsed url data
    const [parsedUrl, setParsedUrl] = useState<ParsedURL | null>(initialParsedUrl)

    // track what came from url
    const isAmountFromUrl = !!initialParsedUrl.amount
    const isTokenFromUrl = !!initialParsedUrl.token
    const isChainFromUrl = !!initialParsedUrl.chain

    // amount state
    const [amount, setAmount] = useState<string>(initialParsedUrl.amount || '')
    const [usdAmount, setUsdAmount] = useState<string>(initialParsedUrl.amount || '')

    // attachment state
    const [attachment, setAttachment] = useState<SemanticRequestAttachment>({})

    // charge and payment results
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)

    // ui state
    const [error, setError] = useState<SemanticRequestError>({ showError: false, errorMessage: '' })
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // derive recipient from parsed url
    const recipient = useMemo<SemanticRequestRecipient | null>(() => {
        if (!parsedUrl?.recipient) return null
        return {
            identifier: parsedUrl.recipient.identifier,
            recipientType: parsedUrl.recipient.recipientType,
            resolvedAddress: parsedUrl.recipient.resolvedAddress as Address,
        }
    }, [parsedUrl])

    // reset flow
    const resetSemanticRequestFlow = useCallback(() => {
        setCurrentView('INITIAL')
        setAmount(initialParsedUrl.amount || '')
        setUsdAmount(initialParsedUrl.amount || '')
        setAttachment({})
        setCharge(null)
        setPayment(null)
        setTxHash(null)
        setError({ showError: false, errorMessage: '' })
        setIsLoading(false)
        setIsSuccess(false)
    }, [initialParsedUrl.amount])

    const value = useMemo<SemanticRequestFlowContextValue>(
        () => ({
            currentView,
            setCurrentView,
            parsedUrl,
            setParsedUrl,
            recipient,
            chargeIdFromUrl,
            amount,
            setAmount,
            usdAmount,
            setUsdAmount,
            isAmountFromUrl,
            isTokenFromUrl,
            isChainFromUrl,
            attachment,
            setAttachment,
            charge,
            setCharge,
            payment,
            setPayment,
            txHash,
            setTxHash,
            error,
            setError,
            isLoading,
            setIsLoading,
            isSuccess,
            setIsSuccess,
            resetSemanticRequestFlow,
        }),
        [
            currentView,
            parsedUrl,
            recipient,
            chargeIdFromUrl,
            amount,
            usdAmount,
            isAmountFromUrl,
            isTokenFromUrl,
            isChainFromUrl,
            attachment,
            charge,
            payment,
            txHash,
            error,
            isLoading,
            isSuccess,
            resetSemanticRequestFlow,
        ]
    )

    return <SemanticRequestFlowContext.Provider value={value}>{children}</SemanticRequestFlowContext.Provider>
}

export function useSemanticRequestFlowContext() {
    const context = useContext(SemanticRequestFlowContext)
    if (!context) {
        throw new Error('useSemanticRequestFlowContext must be used within SemanticRequestFlowProvider')
    }
    return context
}
