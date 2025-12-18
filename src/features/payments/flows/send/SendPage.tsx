'use client'

/**
 * main entry point for direct send flow
 *
 * wraps content with context provider and renders the correct view:
 * - INITIAL: amount input with optional message
 * - STATUS: success view after payment
 *
 * receives pre-resolved recipient data from wrapper
 */

import { SendFlowProvider, useSendFlowContext, type SendRecipient } from './SendFlowContext'
import { SendInputView } from './views/SendInputView'
import { SendSuccessView } from './views/SendSuccessView'

// internal component that switches views
function SendFlowContent() {
    const { currentView } = useSendFlowContext()

    switch (currentView) {
        case 'STATUS':
            return <SendSuccessView />
        case 'INITIAL':
        default:
            return <SendInputView />
    }
}

// props for the page
interface SendPageProps {
    recipient: SendRecipient
}

// exported page component with provider
export function SendPage({ recipient }: SendPageProps) {
    return (
        <SendFlowProvider initialRecipient={recipient}>
            <SendFlowContent />
        </SendFlowProvider>
    )
}
