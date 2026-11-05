'use client'

import { createContext, useContext } from 'react'
import type { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import type { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'
import type { NextAction } from '@/types/capabilities'

export const AttentionFlowContext = createContext<{
    document: ReturnType<typeof useDocumentRequestFlow>
    qr: ReturnType<typeof useQrIdentityCheck>
    tosTask: NextAction | null
    setTosTask: (task: NextAction | null) => void
} | null>(null)

export const useAttentionFlows = () => useContext(AttentionFlowContext)
