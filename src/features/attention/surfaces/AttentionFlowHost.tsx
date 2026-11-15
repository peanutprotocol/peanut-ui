'use client'

import { useState, type ReactNode } from 'react'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import type { NextAction } from '@/types/capabilities'
import { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'
import { AttentionFlowContext } from './AttentionFlowContext'

export function AttentionFlowHost({ children }: { children: ReactNode }) {
    const document = useDocumentRequestFlow()
    const qr = useQrIdentityCheck()
    const [tosTask, setTosTask] = useState<NextAction | null>(null)
    return (
        <AttentionFlowContext.Provider value={{ document, qr, tosTask, setTosTask }}>
            {children}
            {document.modals}
            {qr.modals}
            {tosTask && <BridgeTosStep visible onComplete={() => setTosTask(null)} onSkip={() => setTosTask(null)} />}
        </AttentionFlowContext.Provider>
    )
}
