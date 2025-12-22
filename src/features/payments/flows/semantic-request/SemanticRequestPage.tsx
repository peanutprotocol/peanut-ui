'use client'

/**
 * main entry point for semantic request flow
 *
 * wraps content with context provider and renders the correct view:
 * - INITIAL: amount/token input
 * - CONFIRM: review cross-chain payment details
 * - STATUS: success view after payment
 *
 * receives pre-parsed url data from wrapper
 */

import { SemanticRequestFlowProvider, useSemanticRequestFlowContext } from './SemanticRequestFlowContext'
import { SemanticRequestInputView } from './views/SemanticRequestInputView'
import { SemanticRequestConfirmView } from './views/SemanticRequestConfirmView'
import { SemanticRequestSuccessView } from './views/SemanticRequestSuccessView'
import { type ParsedURL } from '@/lib/url-parser/types/payment'

// internal component that switches views
function SemanticRequestFlowContent() {
    const { currentView } = useSemanticRequestFlowContext()

    switch (currentView) {
        case 'CONFIRM':
            return <SemanticRequestConfirmView />
        case 'STATUS':
            return <SemanticRequestSuccessView />
        case 'INITIAL':
        default:
            return <SemanticRequestInputView />
    }
}

// props for the page
interface SemanticRequestPageProps {
    parsedUrl: ParsedURL
    initialChargeId?: string
}

// exported page component with provider
export function SemanticRequestPage({ parsedUrl, initialChargeId }: SemanticRequestPageProps) {
    return (
        <SemanticRequestFlowProvider initialParsedUrl={parsedUrl} initialChargeId={initialChargeId}>
            <SemanticRequestFlowContent />
        </SemanticRequestFlowProvider>
    )
}
