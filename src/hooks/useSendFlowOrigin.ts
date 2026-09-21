'use client'

import { useSearchParams } from 'next/navigation'

/** Send entry routes use method; rail routes preserve the origin separately as sendMethod. */
export function useSendFlowOrigin() {
    const params = useSearchParams()
    const method = params.get('sendMethod') ?? params.get('method')

    return {
        isFromSendFlow: method === 'bank' || method === 'crypto',
        isBankFromSend: method === 'bank',
        isCryptoFromSend: method === 'crypto',
        /** The raw marker, for callers that must forward it verbatim rather than re-derive it. */
        sendFlowMethod: method === 'bank' || method === 'crypto' ? method : null,
    }
}
