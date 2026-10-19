'use client'

/**
 * context provider for request pot flow
 *
 * request pots are group payment requests where multiple people can contribute.
 * this context manages all state for the contribution flow:
 * - amount being contributed
 * - request details and recipient info
 * - charge/payment results after execution
 * - derived data like total collected and contributors list
 *
 * wraps ContributePotPage and provides state to all child views
 */

import { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Address, type Hash } from 'viem'
import {
    type TRequestResponse,
    type TRequestChargeResponse,
    type PaymentCreationResponse,
} from '@/services/services.types'
import { collectedTotal, usdRemainingOf } from './collected'
import { contributedAmount, isPartialContribution } from '@/utils/request-pot.utils'
import { REQUEST_POT_QUERY_KEY, useRequestPot } from './useRequestPot'

// view states for contribute pot flow
export type ContributePotFlowView = 'INITIAL' | 'STATUS' | 'EXTERNAL_WALLET'

// recipient info derived from request
export interface PotRecipient {
    username: string
    address: Address
    userId?: string
    fullName?: string
    /** Their picked profile avatar; null means the username-letter fallback. */
    avatarKey?: string | null
}

// contributor info from charges
export interface PotContributor {
    uuid: string
    username?: string
    address?: string
    /** The contributor's picked profile avatar; null means the username-letter
     *  fallback, and it stays null for a raw-address contributor. */
    avatarKey?: string | null
    /** What the contributor paid — can be less than `askedAmount`. */
    amount: string
    /** What their charge asked for. */
    askedAmount?: string
    /** Paid short of `askedAmount`, as the API flags it. */
    isPartial?: boolean
    createdAt: string
}

// attachment state
interface ContributePotAttachment {
    message?: string
    file?: File
    fileUrl?: string
}

// error state
interface ContributePotError {
    showError: boolean
    errorMessage: string
}

// context value type
interface ContributePotFlowContextValue {
    // view state
    currentView: ContributePotFlowView
    setCurrentView: (view: ContributePotFlowView) => void

    // request data (fetched from api)
    request: TRequestResponse | null
    setRequest: (request: TRequestResponse | null) => void
    /** Read the request and what it still needs again, together. */
    refetchRequestPot: () => Promise<void>

    // derived recipient
    recipient: PotRecipient | null

    // amount state
    amount: string
    setAmount: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void

    // attachment state
    attachment: ContributePotAttachment
    setAttachment: (attachment: ContributePotAttachment) => void

    // charge and payment results
    charge: TRequestChargeResponse | null
    setCharge: (charge: TRequestChargeResponse | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void
    isExternalWalletPayment: boolean
    setIsExternalWalletPayment: (isExternalWalletPayment: boolean) => void
    /** The deposit address the external-wallet payer sent to; a short payment's rest goes there too. */
    externalDepositAddress: string | null
    setExternalDepositAddress: (address: string | null) => void

    // ui state
    error: ContributePotError
    setError: (error: ContributePotError) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    isSuccess: boolean
    setIsSuccess: (success: boolean) => void

    // derived data
    totalAmount: number
    totalCollected: number
    contributors: PotContributor[]

    // actions
    resetContributePotFlow: () => void
}

const ContributePotFlowContext = createContext<ContributePotFlowContextValue | null>(null)

interface ContributePotFlowProviderProps {
    children: ReactNode
    initialRequest: TRequestResponse
}

export function ContributePotFlowProvider({ children, initialRequest }: ContributePotFlowProviderProps) {
    // view state
    const [currentView, setCurrentView] = useState<ContributePotFlowView>('INITIAL')

    // request data: one source for the contributors and the remainder
    const queryClient = useQueryClient()
    const { request, payAmounts, refetch: refetchRequestPot } = useRequestPot(initialRequest)
    const setRequest = useCallback(
        (next: TRequestResponse | null) =>
            queryClient.setQueryData([...REQUEST_POT_QUERY_KEY, initialRequest.uuid], next ?? undefined),
        [queryClient, initialRequest.uuid]
    )

    // Back on the amount screen (from the deposit address or a finished
    // payment), the request may have changed meanwhile: read it again, with
    // the remainder, before the next suggestion is made.
    const previousView = useRef(currentView)
    useEffect(() => {
        if (currentView === 'INITIAL' && previousView.current !== 'INITIAL') void refetchRequestPot()
        previousView.current = currentView
    }, [currentView, refetchRequestPot])

    // amount state
    const [amount, setAmount] = useState<string>('')
    const [usdAmount, setUsdAmount] = useState<string>('')

    // attachment state
    const [attachment, setAttachment] = useState<ContributePotAttachment>({})

    // charge and payment results
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)
    const [isExternalWalletPayment, setIsExternalWalletPayment] = useState(false)
    const [externalDepositAddress, setExternalDepositAddress] = useState<string | null>(null)

    // ui state
    const [error, setError] = useState<ContributePotError>({ showError: false, errorMessage: '' })
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // derive recipient from request
    const recipient = useMemo<PotRecipient | null>(() => {
        if (!request?.recipientAccount) return null
        return {
            username: request.recipientAccount.user?.username || request.recipientAccount.identifier,
            address: request.recipientAddress as Address,
            userId: request.recipientAccount.userId,
            avatarKey: request.recipientAccount.user?.avatarKey ?? null,
        }
    }, [request])

    // derive total amount and collected
    const totalAmount = useMemo(() => {
        return request?.tokenAmount ? parseFloat(request.tokenAmount) : 0
    }, [request?.tokenAmount])

    /**
     * charges and bank deposits together — see `collectedTotal`.
     *
     * The payer's read of a request carries no `receivedAmount`, so what a bank
     * transfer paid is counted from what the request still needs. Without it
     * the payer read "$0 contributed" on a request somebody had already paid by
     * bank — the requester saw the right figure, and only the requester.
     */
    const totalCollected = useMemo(() => collectedTotal(request, usdRemainingOf(payAmounts)), [request, payAmounts])

    // derive contributors from charges
    const contributors = useMemo<PotContributor[]>(() => {
        if (!request?.charges) return []
        return request.charges
            .filter((c) => c.fulfillmentPayment?.status === 'SUCCESSFUL')
            .map((c) => ({
                uuid: c.uuid,
                username: c.fulfillmentPayment?.payerAccount?.user?.username,
                address: c.fulfillmentPayment?.payerAddress ?? undefined,
                avatarKey: c.fulfillmentPayment?.payerAccount?.user?.avatarKey ?? null,
                amount: contributedAmount(c),
                askedAmount: c.tokenAmount,
                isPartial: isPartialContribution(c),
                createdAt: c.createdAt,
            }))
    }, [request?.charges])

    // reset flow
    const resetContributePotFlow = useCallback(() => {
        setCurrentView('INITIAL')
        setAmount('')
        setUsdAmount('')
        setAttachment({})
        setCharge(null)
        setPayment(null)
        setTxHash(null)
        setError({ showError: false, errorMessage: '' })
        setIsLoading(false)
        setIsSuccess(false)
        setIsExternalWalletPayment(false)
        setExternalDepositAddress(null)
    }, [])

    const value = useMemo<ContributePotFlowContextValue>(
        () => ({
            currentView,
            setCurrentView,
            request,
            setRequest,
            refetchRequestPot,
            recipient,
            amount,
            setAmount,
            usdAmount,
            setUsdAmount,
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
            totalAmount,
            totalCollected,
            contributors,
            resetContributePotFlow,
            isExternalWalletPayment,
            setIsExternalWalletPayment,
            externalDepositAddress,
            setExternalDepositAddress,
        }),
        [
            currentView,
            request,
            setRequest,
            refetchRequestPot,
            recipient,
            amount,
            usdAmount,
            attachment,
            charge,
            payment,
            txHash,
            error,
            isLoading,
            isSuccess,
            totalAmount,
            totalCollected,
            contributors,
            resetContributePotFlow,
            isExternalWalletPayment,
            setIsExternalWalletPayment,
            externalDepositAddress,
        ]
    )

    return <ContributePotFlowContext.Provider value={value}>{children}</ContributePotFlowContext.Provider>
}

export function useContributePotFlowContext() {
    const context = useContext(ContributePotFlowContext)
    if (!context) {
        throw new Error('useContributePotFlowContext must be used within ContributePotFlowProvider')
    }
    return context
}

// re-export types for convenience
export type { ContributePotAttachment, ContributePotError }
