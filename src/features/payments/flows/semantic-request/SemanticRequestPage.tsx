'use client'

/**
 * main entry point for semantic request flow
 *
 * wraps content with context provider and renders the correct view:
 * - INITIAL: amount/token input
 * - CONFIRM: review cross-chain payment details
 * - STATUS: success view after payment
 * - RECEIPT: shows receipt for already-paid charges
 * - a charge requests can no longer be paid in: an error card, never Confirm
 *
 * receives pre-parsed url data from wrapper
 */

import { SemanticRequestFlowProvider, useSemanticRequestFlowContext } from './SemanticRequestFlowContext'
import { SemanticRequestInputView } from './views/SemanticRequestInputView'
import { SemanticRequestConfirmView } from './views/SemanticRequestConfirmView'
import { SemanticRequestSuccessView } from './views/SemanticRequestSuccessView'
import { SemanticRequestReceiptView } from './views/SemanticRequestReceiptView'
import { SemanticRequestUnpayableView } from './views/SemanticRequestUnpayableView'
import { isUnpayableRequestCharge } from '@/utils/request-token.utils'
import { type ParsedURL } from '@/lib/url-parser/types/payment'
import SemanticRequestExternalWalletView from './views/SemanticRequestExternalWalletView'

// internal component that switches views
function SemanticRequestFlowContent() {
    const { currentView, charge } = useSemanticRequestFlowContext()

    // a ?chargeId= link in a token requests no longer take never reaches Confirm (TASK-23850)
    if (charge && isUnpayableRequestCharge(charge)) return <SemanticRequestUnpayableView />

    switch (currentView) {
        case 'CONFIRM':
            return <SemanticRequestConfirmView />
        case 'STATUS':
            return <SemanticRequestSuccessView />
        case 'RECEIPT':
            return <SemanticRequestReceiptView />
        case 'EXTERNAL_WALLET':
            return <SemanticRequestExternalWalletView />
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
