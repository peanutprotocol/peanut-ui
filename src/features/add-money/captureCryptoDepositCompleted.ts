import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { RhinoChainType } from '@/services/services.types'
import posthog from 'posthog-js'

/** The deposit event every crypto add-money surface sends, so deposit charts count them all alike. */
export function captureCryptoDepositCompleted(
    amount: number,
    network: RhinoChainType,
    invitedBy: string | null | undefined
) {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
        amount,
        chain_type: network,
        method_type: 'crypto',
        acquisition_source: invitedBy ? 'referred' : 'organic',
    })
}
