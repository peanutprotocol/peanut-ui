'use client'

// main entry point for semantic request flow
// renders correct view based on flow state

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
