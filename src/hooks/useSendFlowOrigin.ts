'use client'

import { useSearchParams } from 'next/navigation'

/**
 * The send flow has no destination screens of its own — SendRouter navigates
 * into the withdraw routes (`/withdraw?method=crypto`, `/withdraw?method=bank`).
 * `?method=` is therefore the ONLY signal that the user framed this as a send,
 * and it has to survive every hop for the copy to stay honest.
 *
 * This rule used to be re-derived in four places with three different
 * definitions, which is how the copy drifted apart between screens. One owner.
 */
export function useSendFlowOrigin() {
    const method = useSearchParams().get('method')

    return {
        isFromSendFlow: method === 'bank' || method === 'crypto',
        isBankFromSend: method === 'bank',
        isCryptoFromSend: method === 'crypto',
    }
}
