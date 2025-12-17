'use client'

// context provider for contribute pot flow state
// manages the state machine for contributing to request pots

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import { type Address, type Hash } from 'viem'
import { type TRequestResponse, type ChargeEntry, type PaymentCreationResponse } from '@/services/services.types'

// view states for contribute pot flow
export type ContributePotFlowView = 'INITIAL' | 'STATUS'

// recipient info derived from request
export interface PotRecipient {
    username: string
    address: Address
    userId?: string
    fullName?: string
}

// contributor info from charges
export interface PotContributor {
    uuid: string
    username?: string
    address?: string
    amount: string
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
    charge: ChargeEntry | null
    setCharge: (charge: ChargeEntry | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void

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

    // request data
    const [request, setRequest] = useState<TRequestResponse | null>(initialRequest)

    // amount state
    const [amount, setAmount] = useState<string>('')
    const [usdAmount, setUsdAmount] = useState<string>('')

    // attachment state
    const [attachment, setAttachment] = useState<ContributePotAttachment>({})

    // charge and payment results
    const [charge, setCharge] = useState<ChargeEntry | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)

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
        }
    }, [request])

    // derive total amount and collected
    const totalAmount = useMemo(() => {
        return request?.tokenAmount ? parseFloat(request.tokenAmount) : 0
    }, [request?.tokenAmount])

    const totalCollected = useMemo(() => {
        return request?.totalCollectedAmount ?? 0
    }, [request?.totalCollectedAmount])

    // derive contributors from charges
    const contributors = useMemo<PotContributor[]>(() => {
        if (!request?.charges) return []
        return request.charges
            .filter((c) => c.fulfillmentPayment?.status === 'SUCCESSFUL')
            .map((c) => ({
                uuid: c.uuid,
                username: c.fulfillmentPayment?.payerAccount?.user?.username,
                address: c.fulfillmentPayment?.payerAddress ?? undefined,
                amount: c.tokenAmount,
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
    }, [])

    const value = useMemo<ContributePotFlowContextValue>(
        () => ({
            currentView,
            setCurrentView,
            request,
            setRequest,
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
        }),
        [
            currentView,
            request,
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
