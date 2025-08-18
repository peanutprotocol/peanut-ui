'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRequestPayFlow } from '@/hooks/payment/useRequestPayFlow'
import type { RequestPayPayload } from '@/hooks/payment/types'

// Import view components
import { RequestPayInitial } from '@/components/Payment/flows/views/RequestPayInitial'
import { RequestPayConfirm } from '@/components/Payment/flows/views/RequestPayConfirm'
import { RequestPayStatus } from '@/components/Payment/flows/views/RequestPayStatus'

export type RequestPayFlowView = 'initial' | 'confirm' | 'status'

interface RequestPayFlowProps {
    recipient?: string[]
    onComplete?: () => void
}

/**
 * RequestPayFlow - Clean orchestrator for request payment flow
 *
 * Modernized with TanStack Query approach:
 * - Automatic caching and deduplication
 * - Built-in retry logic and error handling
 * - Race condition elimination
 * - Better loading states and UX
 *
 * Follows the same pattern as CryptoWithdrawFlow and DirectSendFlow
 * but keeps the UI exactly the same as the legacy PaymentForm system.
 */
export const RequestPayFlow = ({ recipient, onComplete }: RequestPayFlowProps) => {
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')

    // Local view state management (no Redux!)
    const [currentView, setCurrentView] = useState<RequestPayFlowView>('initial')
    const [paymentPayload, setPaymentPayload] = useState<RequestPayPayload | null>(null)
    const [isCreatingCharge, setIsCreatingCharge] = useState(false)

    // Use chargeId from payload (dynamic creation) or URL (existing charge)
    const effectiveChargeId = paymentPayload?.chargeId || chargeId || undefined

    // TanStack Query powered hook
    const {
        payRequest,
        createCharge,
        isProcessing,
        isPreparingRoute,
        error,
        chargeDetails,
        route,
        transactionHash,
        estimatedFees,
        isLoadingCharge,
        isLoadingRoute,
        reset,
    } = useRequestPayFlow(effectiveChargeId)

    const handleInitialSubmit = async (payload: RequestPayPayload) => {
        try {
            let finalPayload = payload

            // For dynamic scenarios (no existing charge), create charge before moving to confirm
            if (!payload.chargeId && payload.recipient && payload.selectedTokenAddress && payload.selectedChainID) {
                setIsCreatingCharge(true)

                const newCharge = await createCharge(payload)

                // Update payload with the new charge ID
                finalPayload = {
                    ...payload,
                    chargeId: newCharge.uuid,
                }
            }

            setPaymentPayload(finalPayload)
            setCurrentView('confirm')
        } catch (error) {
            console.error('❌ Failed to create charge:', error)
            // Error will be handled by the hook and displayed in the UI
        } finally {
            setIsCreatingCharge(false)
        }
    }

    const handleConfirmSubmit = async () => {
        if (!paymentPayload) return

        const result = await payRequest(paymentPayload)

        if (result.success) {
            setCurrentView('status')
        }
        // Error handling is done by the hook via TanStack Query
    }

    const handleGoBack = () => {
        if (currentView === 'confirm') {
            setCurrentView('initial')
        } else if (currentView === 'status') {
            setCurrentView('initial')
            reset()
            onComplete?.()
        }
    }

    const handleRetry = () => {
        if (currentView === 'status') {
            setCurrentView('confirm')
        }
    }

    // Show loading while fetching initial charge data
    if (isLoadingCharge) {
        return <div className="flex items-center justify-center p-8">Loading...</div>
    }

    // Render appropriate view
    switch (currentView) {
        case 'initial':
            return (
                <RequestPayInitial
                    recipient={recipient}
                    chargeDetails={chargeDetails}
                    requestId={requestId}
                    onSubmit={handleInitialSubmit}
                    onBack={handleGoBack}
                    error={error}
                    isCreatingCharge={isCreatingCharge}
                />
            )

        case 'confirm':
            return (
                <RequestPayConfirm
                    payload={paymentPayload!}
                    chargeDetails={chargeDetails}
                    route={route}
                    estimatedFees={estimatedFees}
                    isProcessing={isProcessing}
                    isPreparingRoute={isPreparingRoute || isLoadingRoute}
                    error={error}
                    onConfirm={handleConfirmSubmit}
                    onBack={handleGoBack}
                />
            )

        case 'status':
            return (
                <RequestPayStatus
                    success={!!transactionHash}
                    transactionHash={transactionHash}
                    chargeDetails={chargeDetails}
                    error={error}
                    onRetry={handleRetry}
                    onClose={handleGoBack}
                />
            )

        default:
            return null
    }
}
