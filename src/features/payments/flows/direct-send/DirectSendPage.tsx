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

import { useEffect, useState } from 'react'
import { DirectSendFlowProvider, useDirectSendFlowContext, type DirectSendRecipient } from './DirectSendFlowContext'
import { clearSendAgainDraft, peekSendAgainDraft } from './send-again-draft'
import { SendInputView } from './views/SendInputView'
import { SendSuccessView } from './views/SendSuccessView'

// internal component that switches views
function SendFlowContent() {
    const { currentView } = useDirectSendFlowContext()

    switch (currentView) {
        case 'STATUS':
            return <SendSuccessView />
        case 'INITIAL':
        default:
            return <SendInputView />
    }
}

// props for the page
interface DirectSendPageProps {
    recipient: DirectSendRecipient
}

// exported page component with provider
export function DirectSendPage({ recipient }: DirectSendPageProps) {
    // read in the initializer, cleared after mount: a strict-mode double
    // initializer must see the draft both times
    const [draft] = useState(() => peekSendAgainDraft(recipient.username))
    useEffect(() => {
        if (draft) clearSendAgainDraft()
    }, [draft])

    return (
        <DirectSendFlowProvider initialRecipient={recipient} initialDraft={draft ?? undefined}>
            <SendFlowContent />
        </DirectSendFlowProvider>
    )
}
