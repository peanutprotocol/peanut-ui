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
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { isStableCoin } from '@/utils/general.utils'

// view states for semantic request flow
export type SemanticRequestFlowView = 'INITIAL' | 'CONFIRM' | 'STATUS' | 'RECEIPT' | 'EXTERNAL_WALLET'

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

    // token denomination from url (e.g., ETH when url is /address/0.0001eth)
    // when set, amounts should be displayed in this token rather than USD
    urlToken: interfaces.ISquidToken | undefined

    // whether the url specified a non-stablecoin token (e.g., eth, not usdc)
    // when true, amounts are displayed in token units rather than USD
    isTokenDenominated: boolean

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
    isExternalWalletPayment: boolean
    setIsExternalWalletPayment: (isExternalWalletPayment: boolean) => void

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
    // view state - determine initial view based on chargeId and recipient type
    // for usernames with chargeId: start at INITIAL (direct request flow)
    // for address/ens with chargeId: start at CONFIRM (semantic request payment)
    const [currentView, setCurrentView] = useState<SemanticRequestFlowView>(() => {
        if (!initialChargeId) return 'INITIAL'
        const isUsernameRecipient = initialParsedUrl.recipient?.recipientType === 'USERNAME'
        return isUsernameRecipient ? 'INITIAL' : 'CONFIRM'
    })

    // store the initial charge id for fetching
    const [chargeIdFromUrl] = useState<string | undefined>(initialChargeId)

    // parsed url data
    const [parsedUrl, setParsedUrl] = useState<ParsedURL | null>(initialParsedUrl)

    // track what came from url
    const isAmountFromUrl = !!initialParsedUrl.amount
    const isTokenFromUrl = !!initialParsedUrl.token
    const isChainFromUrl = !!initialParsedUrl.chain

    // token denomination from url - when url specifies a token like /address/0.0001eth
    // this is used to display amounts in that token rather than USD
    const urlToken = initialParsedUrl.token

    // whether the url specified a non-stablecoin token (e.g., eth, not usdc)
    // computed once here to avoid duplication across components
    const isTokenDenominated = useMemo(() => {
        if (!urlToken) return false
        return !isStableCoin(urlToken.symbol)
    }, [urlToken])

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
    const [isExternalWalletPayment, setIsExternalWalletPayment] = useState(false)

    // derive recipient from parsed url OR charge
    const recipient = useMemo<SemanticRequestRecipient | null>(() => {
        // If we have a charge, use its recipient address
        if (charge?.requestLink?.recipientAddress) {
            return {
                identifier: charge.requestLink.recipientAddress,
                recipientType: 'ADDRESS' as RecipientType,
                resolvedAddress: charge.requestLink.recipientAddress as Address,
            }
        }
        // Otherwise use parsed URL recipient
        if (!parsedUrl?.recipient) return null
        return {
            identifier: parsedUrl.recipient.identifier,
            recipientType: parsedUrl.recipient.recipientType,
            resolvedAddress: parsedUrl.recipient.resolvedAddress as Address,
        }
    }, [parsedUrl, charge])

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
        setIsExternalWalletPayment(false)
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
            urlToken,
            isTokenDenominated,
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
            isExternalWalletPayment,
            setIsExternalWalletPayment,
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
            urlToken,
            isTokenDenominated,
            attachment,
            charge,
            payment,
            txHash,
            error,
            isLoading,
            isSuccess,
            resetSemanticRequestFlow,
            isExternalWalletPayment,
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
