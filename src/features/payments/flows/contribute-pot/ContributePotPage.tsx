'use client'

/**
 * main entry point for contribute pot flow
 *
 * wraps content with context provider and renders the correct view:
 * - INITIAL: amount input with slider
 * - STATUS: success view after payment
 *
 * receives pre-fetched request data from wrapper
 */

import { ContributePotFlowProvider, useContributePotFlowContext } from './ContributePotFlowContext'
import { ContributePotInputView } from './views/ContributePotInputView'
import { ContributePotSuccessView } from './views/ContributePotSuccessView'
import { type TRequestResponse } from '@/services/services.types'

// internal component that switches views
function ContributePotFlowContent() {
    const { currentView } = useContributePotFlowContext()

    switch (currentView) {
        case 'STATUS':
            return <ContributePotSuccessView />
        case 'INITIAL':
        default:
            return <ContributePotInputView />
    }
}

// props for the page
interface ContributePotPageProps {
    request: TRequestResponse
}

// exported page component with provider
export function ContributePotPage({ request }: ContributePotPageProps) {
    return (
        <ContributePotFlowProvider initialRequest={request}>
            <ContributePotFlowContent />
        </ContributePotFlowProvider>
    )
}
