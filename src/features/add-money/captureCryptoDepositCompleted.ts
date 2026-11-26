import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { RhinoChainType } from '@/services/services.types'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import posthog from 'posthog-js'

/** deposits already reported, so a surface that sees an outcome another one reported does not count it twice */
const SENT_KEY = 'deposit_completed_sent_v1'
const SENT_KEEP = 50

/**
 * The deposit event every crypto add-money surface sends, so deposit charts count them all alike. With
 * `deposit` it is sent once per deposit (address and transaction, or the amount without one), across the
 * /add-money/crypto page and the card drawer.
 */
export function captureCryptoDepositCompleted(
    amount: number,
    network: RhinoChainType,
    invitedBy: string | null | undefined,
    deposit?: { address: string; txHash?: string }
) {
    if (deposit) {
        const key = `${deposit.address.toLowerCase()}:${deposit.txHash?.toLowerCase() ?? amount}`
        let sent: string[] = []
        try {
            const stored = JSON.parse(readStoredValue(SENT_KEY) ?? '[]')
            if (Array.isArray(stored)) sent = stored
        } catch {
            // unreadable storage: send, as before this check existed
        }
        if (sent.includes(key)) return
        writeStoredValue(SENT_KEY, JSON.stringify([...sent, key].slice(-SENT_KEEP)))
    }
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
        amount,
        chain_type: network,
        method_type: 'crypto',
        acquisition_source: invitedBy ? 'referred' : 'organic',
    })
}
