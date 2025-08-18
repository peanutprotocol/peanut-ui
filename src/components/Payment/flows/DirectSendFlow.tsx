'use client'

import { useDirectSendFlow } from '@/hooks/payment'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useState, useCallback } from 'react'
import { DirectSendInitial } from './views/DirectSendInitial'

import { DirectSendStatus } from './views/DirectSendStatus'

// Flow-specific types
interface DirectSendFormData {
    amount: string
    message: string
    recipient: ParsedURL['recipient'] | null
}

interface DirectSendFlowProps {
    recipient?: ParsedURL['recipient']
    initialAmount?: string
    onComplete?: () => void
}

type DirectSendView = 'INITIAL' | 'STATUS'

/**
 * DirectSendFlow Orchestrator
 *
 * Manages the complete direct send flow (Peanut → Peanut, USDC only):
 * INITIAL → STATUS (no confirmation needed for direct USDC transfers)
 *
 * Key benefits:
 * - Clean state management (no Redux!)
 * - State resets on unmount (fresh start every time)
 * - Flow-specific logic isolated from other flows
 * - Reuses existing shared UI components
 */
export const DirectSendFlow = ({ recipient, initialAmount = '', onComplete }: DirectSendFlowProps) => {
    // Simple UI state (orchestrator manages this)
    const [currentView, setCurrentView] = useState<DirectSendView>('INITIAL')
    const [formData, setFormData] = useState<DirectSendFormData>({
        amount: initialAmount,
        message: '',
        recipient: recipient || null,
    })

    // Complex business logic state (hook manages this)
    const directSendHook = useDirectSendFlow()

    // Form data updater
    const updateFormData = useCallback((updates: Partial<DirectSendFormData>) => {
        setFormData((prev) => ({ ...prev, ...updates }))
    }, [])

    // View navigation handlers
    const handleNext = useCallback(async () => {
        if (currentView === 'INITIAL') {
            // Validate form before proceeding
            if (!formData.recipient?.resolvedAddress) {
                console.error('Recipient is required')
                return
            }
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                console.error('Valid amount is required')
                return
            }

            // Execute the direct send transaction immediately (no confirmation needed)
            const result = await directSendHook.sendDirectly({
                recipient: {
                    identifier: formData.recipient!.identifier,
                    resolvedAddress: formData.recipient!.resolvedAddress,
                },
                tokenAmount: formData.amount,
                attachmentOptions: formData.message ? { message: formData.message } : undefined,
            })

            if (result.success) {
                setCurrentView('STATUS')
            }
            // If error, stay on INITIAL view - error will be shown by the hook
        }
    }, [currentView, formData, directSendHook])

    const handleBack = useCallback(() => {
        if (currentView === 'STATUS') {
            // Reset everything and start over
            setCurrentView('INITIAL')
            setFormData({
                amount: '',
                message: '',
                recipient: recipient || null,
            })
            directSendHook.reset()
        }
    }, [currentView, recipient, directSendHook])

    const handleComplete = useCallback(() => {
        onComplete?.()
        // Note: Component will unmount and all state will be cleaned up automatically!
    }, [onComplete])

    // Render the appropriate view
    if (currentView === 'INITIAL') {
        return (
            <DirectSendInitial
                formData={formData}
                updateFormDataAction={updateFormData}
                onNextAction={handleNext}
                isProcessing={directSendHook.isProcessing}
                error={directSendHook.error}
            />
        )
    }

    if (currentView === 'STATUS') {
        return (
            <DirectSendStatus
                formData={formData}
                directSendHook={directSendHook}
                onCompleteAction={handleComplete}
                onSendAnotherAction={handleBack}
            />
        )
    }

    return null
}
